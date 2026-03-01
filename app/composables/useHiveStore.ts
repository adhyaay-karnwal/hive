/**
 * Global Hive store.
 *
 * Manages all project connections, sessions, messages, and status.
 * WebSocket connections persist across tab switches - they're only
 * torn down when a project tab is explicitly closed.
 *
 * Usage:
 *   const store = useHiveStore()
 *   store.activate(projectId)              // start server + connect WS
 *   const project = store.project(id)      // reactive project state
 *   store.sendPrompt(id, "hello")          // send through WS
 *   store.abort(id)                        // abort through WS
 *   store.deactivate(id)                   // close WS, cleanup
 */

type RawMessage = {
  info: {
    role: "user" | "assistant";
    id: string;
    sessionID: string;
    parentID?: string;
    time?: { created: number };
    modelID?: string;
    providerID?: string;
    agent?: string;
    [key: string]: any;
  };
  parts: any[];
};

type Turn = {
  userMessage: RawMessage;
  assistantMessages: RawMessage[];
};

type Signal = {
  id: string;
  type: string;
  content: string;
  options?: string[] | null;
  resolved: boolean;
};

type ProjectState = {
  port: number | null;
  sessionId: string | null;
  isWorking: boolean;
  pendingQuestions: Signal[];
  modelName: string;
  connected: boolean;
  initializing: boolean;
  error: string | null;
};

type ProjectConnections = {
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

// Singleton state - survives across component mounts/unmounts
const state = reactive<Record<string, ProjectState>>({});
const connections: Record<string, ProjectConnections> = {};

// Messages stored in shallowRef per project to avoid deep reactivity overhead.
// Vue only tracks the ref itself, not the (potentially huge) nested message objects.
const projectMessages = new Map<string, ShallowRef<RawMessage[]>>();

function getMessages(projectId: string): ShallowRef<RawMessage[]> {
  let msgs = projectMessages.get(projectId);
  if (!msgs) {
    msgs = shallowRef<RawMessage[]>([]);
    projectMessages.set(projectId, msgs);
  }
  return msgs;
}

function ensureState(projectId: string): ProjectState {
  if (!state[projectId]) {
    state[projectId] = {
      port: null,
      sessionId: null,
      isWorking: false,
      pendingQuestions: [],
      modelName: "",
      connected: false,
      initializing: false,
      error: null,
    };
  }
  // Ensure messages ref exists too
  getMessages(projectId);
  return state[projectId];
}

function groupTurns(messages: RawMessage[]): Turn[] {
  const result: Turn[] = [];
  let currentTurn: Turn | null = null;

  for (const msg of messages) {
    if (msg.info.role === "user") {
      currentTurn = { userMessage: msg, assistantMessages: [] };
      result.push(currentTurn);
    } else if (msg.info.role === "assistant" && currentTurn) {
      currentTurn.assistantMessages.push(msg);
    }
  }

  return result;
}

// Memoized version that reuses Turn objects when the structure hasn't changed.
// This prevents Vue from unmounting/remounting turn components on every message update.
let prevTurns: Turn[] = [];

function groupTurnsStable(messages: RawMessage[]): Turn[] {
  const newTurns = groupTurns(messages);

  const result = newTurns.map((turn, i) => {
    const prev = prevTurns[i];
    if (prev && prev.userMessage.info.id === turn.userMessage.info.id) {
      // Same turn — keep the object identity, update assistant messages
      prev.assistantMessages = turn.assistantMessages;
      return prev;
    }
    return turn;
  });

  prevTurns = result;
  return result;
}

function handleWsMessage(projectId: string, event: MessageEvent) {
  const s = ensureState(projectId);

  let msg: { type: string; data: any };
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }

  switch (msg.type) {
    case "messages": {
      const msgs = getMessages(projectId);
      msgs.value = msg.data as RawMessage[];
      for (let i = msgs.value.length - 1; i >= 0; i--) {
        if (msgs.value[i]?.info?.role === "assistant" && msgs.value[i]?.info?.modelID) {
          s.modelName = msgs.value[i].info.modelID;
          break;
        }
      }
      break;
    }

    case "message:updated": {
      const msgs = getMessages(projectId);
      const info = msg.data.info;
      if (!info?.id) break;

      const idx = msgs.value.findIndex((m) => m.info.id === info.id);
      if (idx >= 0) {
        msgs.value[idx] = { ...msgs.value[idx], info };
      } else {
        // New message — check for a matching optimistic message
        const optimisticIdx = msgs.value.findIndex(
          (m) => m.info.id.startsWith("optimistic-") && m.info.role === info.role,
        );
        if (optimisticIdx >= 0) {
          // Carry over the optimistic parts (user text) to the real message
          const optimisticParts = msgs.value[optimisticIdx].parts;
          msgs.value.splice(optimisticIdx, 1);
          msgs.value.push({ info, parts: optimisticParts });
        } else {
          msgs.value.push({ info, parts: [] });
        }
      }
      if (info.role === "assistant" && info.modelID) {
        s.modelName = info.modelID;
      }
      triggerRef(msgs);
      break;
    }

    case "message:part.updated": {
      const msgs = getMessages(projectId);
      const part = msg.data.part;
      if (!part?.messageID) break;

      const msgIdx = msgs.value.findIndex((m) => m.info.id === part.messageID);
      if (msgIdx >= 0) {
        const message = msgs.value[msgIdx];
        const partIdx = message.parts.findIndex((p: any) => p.id === part.id);
        if (partIdx >= 0) {
          message.parts[partIdx] = part;
        } else {
          // Remove any optimistic parts (parts without an id) before adding the real one
          message.parts = message.parts.filter((p: any) => p.id);
          message.parts.push(part);
        }
        triggerRef(msgs);
      }
      break;
    }

    case "message:part.delta": {
      // v2 streaming: incremental text append
      const msgs = getMessages(projectId);
      const { sessionID, messageID, partID, field, delta } = msg.data;
      if (!messageID || !partID || !delta) break;

      const msgIdx = msgs.value.findIndex((m) => m.info.id === messageID);
      if (msgIdx >= 0) {
        const message = msgs.value[msgIdx];
        const partIdx = message.parts.findIndex((p: any) => p.id === partID);
        if (partIdx >= 0) {
          // Append delta to the specified field (usually "text")
          const part = message.parts[partIdx] as any;
          if (field && typeof part[field] === "string") {
            part[field] += delta;
          } else if (field) {
            part[field] = delta;
          }
        } else {
          // Part doesn't exist yet — create it with the delta
          message.parts.push({
            id: partID,
            messageID,
            sessionID,
            type: "text",
            [field || "text"]: delta,
          } as any);
        }
        triggerRef(msgs);
      }
      break;
    }

    case "message:removed": {
      const msgs = getMessages(projectId);
      const { messageID } = msg.data;
      if (!messageID) break;
      const idx = msgs.value.findIndex((m) => m.info.id === messageID);
      if (idx >= 0) {
        msgs.value.splice(idx, 1);
        triggerRef(msgs);
      }
      break;
    }

    case "message:part.removed": {
      const msgs = getMessages(projectId);
      const { messageID, partID } = msg.data;
      if (!messageID || !partID) break;
      const msgIdx = msgs.value.findIndex((m) => m.info.id === messageID);
      if (msgIdx >= 0) {
        const parts = msgs.value[msgIdx].parts;
        const partIdx = parts.findIndex((p: any) => p.id === partID);
        if (partIdx >= 0) {
          parts.splice(partIdx, 1);
          triggerRef(msgs);
        }
      }
      break;
    }

    case "status":
      s.isWorking = msg.data.type !== "idle";
      break;

    case "signal": {
      const idx = s.pendingQuestions.findIndex((q) => q.id === msg.data.id);
      if (idx >= 0) {
        s.pendingQuestions[idx] = msg.data;
      } else if (msg.data.type === "question" && !msg.data.resolved) {
        s.pendingQuestions.push(msg.data);
      }
      break;
    }

    case "signal.resolved":
      s.pendingQuestions = s.pendingQuestions.filter(
        (q) => q.id !== msg.data.signalId,
      );
      break;

    case "connected":
      s.connected = true;
      s.initializing = false;
      s.error = null;
      console.log(`[activate] WS connected for ${projectId}`);
      break;

    case "error":
      console.error(`[hive:store:${projectId}]`, msg.data.message);
      s.error = msg.data.message;
      break;
  }
}

function connectWs(projectId: string) {
  const s = ensureState(projectId);

  if (!s.sessionId || !s.port) return;

  // Clean up existing connection
  disconnectWs(projectId);

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/ws/project?projectId=${projectId}&sessionId=${s.sessionId}`;

  const ws = new WebSocket(url);
  connections[projectId] = { ws, reconnectTimer: null };

  ws.onopen = () => {
    s.connected = true;
    s.error = null;
  };

  ws.onmessage = (event) => {
    handleWsMessage(projectId, event);
  };

  ws.onclose = () => {
    s.connected = false;
    // Auto-reconnect after 3 seconds if the project is still in state
    if (state[projectId] && !connections[projectId]?.reconnectTimer) {
      connections[projectId] = connections[projectId] || { ws: null, reconnectTimer: null };
      connections[projectId].reconnectTimer = setTimeout(() => {
        if (state[projectId]) {
          connections[projectId].reconnectTimer = null;
          connectWs(projectId);
        }
      }, 3000);
    }
  };

  ws.onerror = () => {
    // onclose will fire after this
  };
}

function disconnectWs(projectId: string) {
  const conn = connections[projectId];
  if (conn) {
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }
    if (conn.ws) {
      conn.ws.onclose = null; // prevent reconnect
      conn.ws.close();
      conn.ws = null;
    }
  }
}

function wsSend(projectId: string, data: any) {
  const conn = connections[projectId];
  if (conn?.ws?.readyState === WebSocket.OPEN) {
    conn.ws.send(JSON.stringify(data));
  }
}

export function useHiveStore() {
  /**
   * Initialize a project: start OpenCode server, get session, connect WebSocket.
   * Safe to call multiple times - skips if already initialized.
   */
  async function activate(projectId: string) {
    const s = ensureState(projectId);

    // Already connected or initializing
    if (s.connected || s.initializing) return;

    // Already have port + session, just reconnect WS
    if (s.port && s.sessionId) {
      console.log(`[activate] Reconnecting WS (port=${s.port}, session=${s.sessionId})`);
      connectWs(projectId);
      return;
    }

    s.initializing = true;
    s.error = null;

    const t0 = performance.now();
    console.log(`[activate] Starting for ${projectId}...`);

    try {
      // Start OpenCode server (waits for health internally)
      const startResult = await $fetch(`/api/projects/${projectId}/start`, {
        method: "POST",
      });
      s.port = (startResult as any).port;
      console.log(`[activate] POST /start done: ${Math.round(performance.now() - t0)}ms (port=${s.port}, alreadyRunning=${(startResult as any).alreadyRunning})`);

      // Get or create session
      const t1 = performance.now();
      const sessResult = await $fetch(`/api/projects/${projectId}/session`, {
        method: "POST",
      });
      s.sessionId = (sessResult as any).sessionId;
      console.log(`[activate] POST /session done: ${Math.round(performance.now() - t1)}ms (sessionId=${s.sessionId}, reconnected=${(sessResult as any).reconnected})`);

      // Connect WebSocket
      console.log(`[activate] Connecting WS... (total so far: ${Math.round(performance.now() - t0)}ms)`);
      connectWs(projectId);
    } catch (e: any) {
      s.initializing = false;
      s.error = e.message || "Failed to connect";
      console.error(`[activate] Failed after ${Math.round(performance.now() - t0)}ms:`, e);
    }
  }

  /**
   * Tear down a project's connections and state.
   */
  function deactivate(projectId: string) {
    disconnectWs(projectId);
    delete state[projectId];
    delete connections[projectId];
    projectMessages.delete(projectId);
  }

  /**
   * Get reactive state for a project.
   */
  function project(projectId: string) {
    ensureState(projectId);

    const msgs = getMessages(projectId);

    return {
      state: computed(() => state[projectId]),
      messages: msgs,
      turns: computed(() => groupTurnsStable(msgs.value)),
      isWorking: computed(() => state[projectId]?.isWorking ?? false),
      connected: computed(() => state[projectId]?.connected ?? false),
      initializing: computed(() => state[projectId]?.initializing ?? false),
      modelName: computed(() => state[projectId]?.modelName ?? ""),
      pendingQuestions: computed(() => state[projectId]?.pendingQuestions ?? []),
      error: computed(() => state[projectId]?.error ?? null),
      port: computed(() => state[projectId]?.port ?? null),
      sessionId: computed(() => state[projectId]?.sessionId ?? null),
    };
  }

  /**
   * Send a prompt. If agent is busy, caller should handle queueing.
   */
  function sendPrompt(projectId: string, text: string, opts?: { agent?: string; model?: string }) {
    const s = ensureState(projectId);

    // Optimistic user message
    const msgs = getMessages(projectId);
    msgs.value = [
      ...msgs.value,
      {
        info: {
          role: "user",
          id: `optimistic-${Date.now()}`,
          sessionID: s.sessionId || "",
          time: { created: Date.now() },
        },
        parts: [{ type: "text", text }],
      },
    ];
    s.isWorking = true;

    wsSend(projectId, {
      type: "prompt",
      data: { message: text, ...opts },
    });
  }

  function abort(projectId: string) {
    wsSend(projectId, { type: "abort" });
  }

  function resolveSignal(projectId: string, signalId: string, answer: string) {
    wsSend(projectId, {
      type: "resolve_signal",
      data: { signalId, answer },
    });
    // Optimistic removal
    const s = state[projectId];
    if (s) {
      s.pendingQuestions = s.pendingQuestions.filter((q) => q.id !== signalId);
    }
  }

  return {
    activate,
    deactivate,
    project,
    sendPrompt,
    abort,
    resolveSignal,
  };
}
