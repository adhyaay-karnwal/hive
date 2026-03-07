/**
 * Global Hive store.
 *
 * Manages all project chat instances via Vercel AI SDK's `Chat` class.
 * Each project gets its own Map of `Chat` instances (sessions).
 *
 * Usage:
 *   const store = useHiveStore()
 *   await store.activate(projectId)           // load project data + sessions
 *   const session = store.session(projectId, id) // reactive session state + chat
 *   store.setModel(projectId, 'opus')         // switch model preference
 *   store.deactivate(projectId)               // cleanup
 */

import { Chat } from "@ai-sdk/vue";
import { DefaultChatTransport } from "ai";
import type { UIMessage, FileUIPart } from "ai";
import type { Reactive } from "vue";

type Signal = {
  id: string;
  type: string;
  content: string;
  options?: string[] | null;
  resolved: boolean;
};

type SessionEntry = {
  id: string;
  title: Ref<string>;
  chat: Chat<UIMessage>;
  modelPreference: Ref<"opus" | "sonnet" | "gemini-3.1-pro" | "gemini-3-flash">;
  modePreference: Ref<"build" | "plan">;
  connected: Ref<boolean>;
  initializing: Ref<boolean>;
  pendingQuestions: Ref<Signal[]>;
};

type ProjectEntry = {
  projectName: Ref<string>;
  sessions: Map<string, SessionEntry>;
  sessionsList: Ref<Array<{ id: string, title: string }>>;
  activeSessionId: Ref<string | null>;
};

// Singleton state — survives across component mounts/unmounts
const projectMap = new Map<string, ProjectEntry>();

function createSession(projectId: string, sessionId: string, title: string = "New Chat", model: any = "sonnet"): SessionEntry {
  const modelPreference = ref(model);
  const modePreference = ref<"build" | "plan">("build");
  const connected = ref(false);
  const initializing = ref(false);
  const pendingQuestions = ref<Signal[]>([]);
  const titleRef = ref(title);

  const chat = new Chat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        projectId,
        sessionId,
        model: modelPreference.value,
        mode: modePreference.value,
      }),
    }),
    onError: (err) => {
      console.error(`[hive:chat:${projectId}:${sessionId}]`, err.message);
    },
  });

  return {
    id: sessionId,
    title: titleRef,
    chat,
    modelPreference,
    modePreference,
    connected,
    initializing,
    pendingQuestions,
  };
}

function ensureProject(projectId: string): ProjectEntry {
  let entry = projectMap.get(projectId);
  if (entry) return entry;

  entry = {
    projectName: ref(""),
    sessions: new Map(),
    sessionsList: ref([]),
    activeSessionId: ref(null),
  };

  projectMap.set(projectId, entry);
  return entry;
}

export function useHiveStore() {
  /**
   * Initialize a project: load project data + available sessions.
   */
  async function activate(projectId: string) {
    const entry = ensureProject(projectId);

    try {
      // Fetch project metadata and sessions
      const [data, sessionsData] = await Promise.all([
        $fetch<{ name: string }>(`/api/projects/${projectId}`),
        $fetch<Array<{ id: string, title: string, modelPreference: string }>>(`/api/projects/${projectId}/sessions`),
      ]);

      entry.projectName.value = data?.name ?? "";

      // Initialize sessions from DB
      for (const s of sessionsData) {
        if (!entry.sessions.has(s.id)) {
          entry.sessions.set(s.id, createSession(projectId, s.id, s.title, s.modelPreference));
        }
      }
      entry.sessionsList.value = Array.from(entry.sessions.values()).map(s => ({ id: s.id, title: s.title.value }));

      // If no sessions, create a default one
      if (entry.sessions.size === 0) {
        await createNewSession(projectId);
      } else if (!entry.activeSessionId.value) {
        // Find if we already have an active session for this project in projectMap?
        // Actually activate() is called when navigating to project.
        entry.activeSessionId.value = sessionsData[0].id;
      }

      // Activate the current active session if it's not connected
      if (entry.activeSessionId.value) {
        await activateSession(projectId, entry.activeSessionId.value);
      }

    } catch (e: any) {
      console.error(`[hive:activate:${projectId}]`, e.message);
    }
  }

  /**
   * Initialize a specific session: load message history.
   */
  async function activateSession(projectId: string, sessionId: string) {
    const entry = ensureProject(projectId);
    const session = entry.sessions.get(sessionId);
    if (!session || session.connected.value || session.initializing.value) return;

    session.initializing.value = true;
    try {
      const history = await $fetch<Array<{ id: string; role: string; content: unknown; createdAt: string }>>(
        `/api/projects/${projectId}/messages`,
        { query: { sessionId } }
      );

      const state = (session.chat as any).state;
      const messagesRef = state.messagesRef as Ref<UIMessage[]>;
      if (messagesRef.value.length === 0 && history && history.length > 0) {
        messagesRef.value = history.map((row) => ({
          id: row.id,
          role: row.role as UIMessage["role"],
          parts: Array.isArray(row.content) ? (row.content as UIMessage["parts"]) : [],
          content: typeof row.content === "string" ? row.content : "",
          createdAt: new Date(row.createdAt),
        }));
      }
      session.connected.value = true;
    } catch (e: any) {
      console.error(`[hive:activateSession:${projectId}:${sessionId}]`, e.message);
    } finally {
      session.initializing.value = false;
    }
  }

  async function createNewSession(projectId: string, title?: string) {
    const entry = ensureProject(projectId);
    try {
      const newSessionData = await $fetch<{ id: string, title: string, modelPreference: string }>(
        `/api/projects/${projectId}/sessions`,
        {
          method: "POST",
          body: { title }
        }
      );

      const session = createSession(projectId, newSessionData.id, newSessionData.title, newSessionData.modelPreference);
      entry.sessions.set(newSessionData.id, session);
      entry.sessionsList.value = Array.from(entry.sessions.values()).map(s => ({ id: s.id, title: s.title.value }));
      entry.activeSessionId.value = newSessionData.id;
      await activateSession(projectId, newSessionData.id);
      return session;
    } catch (e: any) {
      console.error(`[hive:createNewSession:${projectId}]`, e.message);
    }
  }

  async function deleteSession(projectId: string, sessionId: string) {
    const entry = projectMap.get(projectId);
    if (!entry) return;

    try {
      await $fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      const session = entry.sessions.get(sessionId);
      if (session) {
        session.chat.stop();
        entry.sessions.delete(sessionId);
        entry.sessionsList.value = Array.from(entry.sessions.values()).map(s => ({ id: s.id, title: s.title.value }));
      }

      if (entry.activeSessionId.value === sessionId) {
        const remaining = Array.from(entry.sessions.keys());
        if (remaining.length > 0) {
          entry.activeSessionId.value = remaining[0];
          await activateSession(projectId, entry.activeSessionId.value);
        } else {
          await createNewSession(projectId);
        }
      }
    } catch (e: any) {
      console.error(`[hive:deleteSession:${projectId}:${sessionId}]`, e.message);
    }
  }

  function switchSession(projectId: string, sessionId: string) {
    const entry = ensureProject(projectId);
    if (entry.sessions.has(sessionId)) {
      entry.activeSessionId.value = sessionId;
      activateSession(projectId, sessionId);
    }
  }

  /**
   * Tear down a project's state.
   */
  function deactivate(projectId: string) {
    const entry = projectMap.get(projectId);
    if (entry) {
      for (const session of entry.sessions.values()) {
        session.chat.stop();
      }
    }
    projectMap.delete(projectId);
  }

  /**
   * Get reactive state for a project's active session.
   */
  function project(projectId: string) {
    const entry = ensureProject(projectId);

    // We return a set of computed/refs that always point to the CURRENT active session
    const activeSession = computed(() => {
      if (!entry.activeSessionId.value) return null;
      return entry.sessions.get(entry.activeSessionId.value) || null;
    });

    const messages = computed(() => {
      if (!activeSession.value) return [];
      const state = (activeSession.value.chat as any).state;
      return (state.messagesRef.value as UIMessage[]);
    });

    const status = computed(() => activeSession.value?.chat.status || "idle");
    const error = computed(() => activeSession.value?.chat.error);
    const isLoading = computed(() => status.value === "streaming" || status.value === "submitted");

    return {
      // Session management
      sessions: entry.sessionsList,
      activeSessionId: entry.activeSessionId,
      createNewSession: (title?: string) => createNewSession(projectId, title),
      switchSession: (id: string) => switchSession(projectId, id),
      deleteSession: (id: string) => deleteSession(projectId, id),

      // Chat reactivity (proxied to active session)
      messages,
      status,
      isLoading,
      error,

      // Chat actions
      sendMessage: (text: string, files?: FileUIPart[]) => activeSession.value?.chat.sendMessage({ text, files }),
      stop: () => activeSession.value?.chat.stop(),
      clearChat: async () => {
        const sessionId = entry.activeSessionId.value;
        if (!sessionId) return;
        await $fetch(`/api/projects/${projectId}/messages`, {
          method: "DELETE",
          query: { sessionId }
        });
        const session = entry.sessions.get(sessionId);
        if (session) {
          (session.chat as any).state.messagesRef.value = [];
        }
      },

      // Custom state
      modelPreference: computed({
        get: () => activeSession.value?.modelPreference.value || "sonnet",
        set: (val) => { if (activeSession.value) activeSession.value.modelPreference.value = val; }
      }),
      modePreference: computed({
        get: () => activeSession.value?.modePreference.value || "build",
        set: (val) => { if (activeSession.value) activeSession.value.modePreference.value = val; }
      }),
      projectName: entry.projectName,
      connected: computed(() => activeSession.value?.connected.value || false),
      initializing: computed(() => activeSession.value?.initializing.value || false),
      pendingQuestions: computed(() => activeSession.value?.pendingQuestions.value || []),
    };
  }

  /**
   * Switch model preference for a project.
   */
  function setModel(projectId: string, model: "opus" | "sonnet" | "gemini-3.1-pro" | "gemini-3-flash") {
    const entry = ensureProject(projectId);
    if (entry.activeSessionId.value) {
      const session = entry.sessions.get(entry.activeSessionId.value);
      if (session) session.modelPreference.value = model;
    }
  }

  /**
   * Switch mode preference for a project.
   */
  function setMode(projectId: string, mode: "build" | "plan") {
    const entry = ensureProject(projectId);
    if (entry.activeSessionId.value) {
      const session = entry.sessions.get(entry.activeSessionId.value);
      if (session) session.modePreference.value = mode;
    }
  }

  /**
   * Resolve a pending signal/question.
   */
  async function resolveSignal(projectId: string, signalId: string, answer: string) {
    const entry = projectMap.get(projectId);
    if (!entry || !entry.activeSessionId.value) return;
    const session = entry.sessions.get(entry.activeSessionId.value);
    if (!session) return;

    try {
      await $fetch(`/api/signals/${signalId}`, {
        method: "POST",
        body: { answer },
      });
    } catch (e: any) {
      console.error(`[hive:resolveSignal:${projectId}]`, e.message);
    }

    // Optimistic removal
    session.pendingQuestions.value = session.pendingQuestions.value.filter(
      (q) => q.id !== signalId,
    );
  }

  return {
    activate,
    deactivate,
    project,
    setModel,
    setMode,
    resolveSignal,
  };
}
