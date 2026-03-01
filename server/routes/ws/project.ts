import type { Peer, Message } from "crossws";
import { db } from "../../database";
import { projects, signals } from "../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../utils/parse-config";
import { getProjectEvents, emitProjectEvent } from "../../services/opencode-events";

/**
 * WebSocket endpoint for real-time project communication.
 *
 * Status is driven entirely by OpenCode's session.status SSE events.
 * No fallback polling - SSE handles everything with auto-reconnect.
 */

const peerInfo = new Map<
  string,
  {
    projectId: string;
    sessionId: string;
    port: number;
  }
>();

export default defineWebSocketHandler({
  async open(peer: Peer) {
    const t0 = Date.now();
    const url = new URL(peer.request?.url || "", "http://localhost");
    const projectId = url.searchParams.get("projectId");
    const sessionId = url.searchParams.get("sessionId");

    if (!projectId || !sessionId) {
      peer.send(JSON.stringify({ type: "error", data: { message: "projectId and sessionId required" } }));
      peer.close(1008, "Missing parameters");
      return;
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    console.log(`[ws:open] DB lookup: ${Date.now() - t0}ms`);

    if (!project) {
      peer.send(JSON.stringify({ type: "error", data: { message: "Project not found" } }));
      peer.close(1008, "Project not found");
      return;
    }

    const config = parseConfig(project.configOverride);
    const port = config.opencodePort;

    if (!port) {
      peer.send(JSON.stringify({ type: "error", data: { message: "OpenCode server not running" } }));
      peer.close(1008, "No server");
      return;
    }

    peerInfo.set(peer.id, { projectId, sessionId, port });

    peer.send(JSON.stringify({
      type: "connected",
      data: { sessionId, port },
    }));
    console.log(`[ws:open] Sent connected event: ${Date.now() - t0}ms`);

    // Subscribe to OpenCode SSE events
    const emitter = getProjectEvents(projectId, port);

    const handleEvent = (event: { type: string; properties: any }) => {
      try {
        const eventType = event.type;

        if (eventType === "message.updated") {
          peer.send(JSON.stringify({ type: "message:updated", data: event.properties }));
        } else if (eventType === "message.part.updated") {
          peer.send(JSON.stringify({ type: "message:part.updated", data: event.properties }));
        } else if (eventType === "message.removed") {
          peer.send(JSON.stringify({ type: "message:removed", data: event.properties }));
        } else if (eventType === "message.part.delta") {
          peer.send(JSON.stringify({ type: "message:part.delta", data: event.properties }));
        } else if (eventType === "message.part.removed") {
          peer.send(JSON.stringify({ type: "message:part.removed", data: event.properties }));
        } else if (eventType === "session.status") {
          const eventSessionId = event.properties?.sessionID;
          if (eventSessionId && eventSessionId !== sessionId) return;
          const status = event.properties?.status;
          if (status) {
            peer.send(JSON.stringify({ type: "status", data: status }));
          }
        } else if (eventType === "session.idle") {
          const eventSessionId = event.properties?.sessionID;
          if (eventSessionId && eventSessionId !== sessionId) return;
          peer.send(JSON.stringify({ type: "status", data: { type: "idle" } }));
        } else if (eventType === "signal") {
          peer.send(JSON.stringify({ type: "signal", data: event.properties }));
        } else if (eventType === "signal.resolved") {
          peer.send(JSON.stringify({ type: "signal.resolved", data: event.properties }));
        }
      } catch {
        // peer might be closed
      }
    };

    emitter.on("event", handleEvent);

    (peer as any)._cleanup = () => {
      emitter.off("event", handleEvent);
    };

    // Fetch initial data (non-blocking, parallel)
    const t1 = Date.now();
    Promise.all([
      fetchAndSendStatus(peer, port, sessionId),
      fetchAndSendMessages(peer, port, sessionId),
      fetchAndSendSignals(peer),
    ]).then(() => {
      console.log(`[ws:open] Initial data fetched: ${Date.now() - t1}ms (total: ${Date.now() - t0}ms)`);
    }).catch(() => {});
  },

  async message(peer: Peer, message: Message) {
    const info = peerInfo.get(peer.id);
    if (!info) return;

    let msg: { type: string; data?: any };
    try {
      msg = JSON.parse(message.text());
    } catch {
      return;
    }

    const { port, sessionId } = info;

    switch (msg.type) {
      case "prompt": {
        const { message: text, agent, model } = msg.data || {};
        if (!text) return;

        try {
          await fetch(
            `http://localhost:${port}/session/${sessionId}/prompt_async`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                parts: [{ type: "text", text }],
                ...(agent && { agent }),
                ...(model && { model }),
              }),
            },
          );
        } catch (e: any) {
          peer.send(JSON.stringify({
            type: "error",
            data: { message: `Failed to send prompt: ${e.message}` },
          }));
        }
        break;
      }

      case "abort": {
        try {
          await fetch(
            `http://localhost:${port}/session/${sessionId}/abort`,
            { method: "POST" },
          );
          // Don't send local status - wait for SSE session.status event
        } catch (e: any) {
          peer.send(JSON.stringify({
            type: "error",
            data: { message: `Failed to abort: ${e.message}` },
          }));
        }
        break;
      }

      case "resolve_signal": {
        const { signalId, answer } = msg.data || {};
        if (!signalId || !answer) return;

        try {
          await db
            .update(signals)
            .set({ resolved: true, resolvedContent: answer })
            .where(eq(signals.id, signalId));

          emitProjectEvent(info.projectId, {
            type: "signal.resolved",
            properties: { signalId },
          });
        } catch (e: any) {
          peer.send(JSON.stringify({
            type: "error",
            data: { message: `Failed to resolve signal: ${e.message}` },
          }));
        }
        break;
      }

      case "ping":
        break;
    }
  },

  close(peer: Peer) {
    (peer as any)?._cleanup?.();
    peerInfo.delete(peer.id);
  },

  error(peer: Peer, error: Error) {
    console.error(`[ws:project] Error:`, error.message);
    (peer as any)?._cleanup?.();
    peerInfo.delete(peer.id);
  },
});

async function fetchAndSendStatus(peer: Peer, port: number, sessionId: string) {
  try {
    const res = await fetch(`http://localhost:${port}/session/status`);
    const statusMap = await res.json();
    const status = statusMap[sessionId] || { type: "idle" };
    peer.send(JSON.stringify({ type: "status", data: status }));
  } catch {
    peer.send(JSON.stringify({ type: "status", data: { type: "idle" } }));
  }
}

async function fetchAndSendMessages(peer: Peer, port: number, sessionId: string) {
  try {
    const res = await fetch(`http://localhost:${port}/session/${sessionId}/message`);
    const messages = await res.json();
    if (Array.isArray(messages)) {
      peer.send(JSON.stringify({ type: "messages", data: messages }));
    }
  } catch {
    // server might not be ready
  }
}

async function fetchAndSendSignals(peer: Peer) {
  try {
    const pending = await db
      .select()
      .from(signals)
      .where(eq(signals.resolved, false));

    for (const q of pending.filter((s) => s.type === "question")) {
      peer.send(JSON.stringify({ type: "signal", data: q }));
    }
  } catch {
    // ignore
  }
}
