/**
 * Global Hive store.
 *
 * Manages all project chat instances via Vercel AI SDK's `Chat` class.
 * Each project gets its own Map of Chat instances (one per chat session).
 */

import { Chat } from "@ai-sdk/vue";
import { DefaultChatTransport } from "ai";
import type { UIMessage, FileUIPart } from "ai";

type Signal = {
  id: string;
  type: string;
  content: string;
  options?: string[] | null;
  resolved: boolean;
};

type ChatEntry = {
  chat: Chat<UIMessage>;
  messages: Ref<UIMessage[]>;
  status: Ref<string>;
  error: Ref<Error | undefined>;
  initialized: boolean;
};

type ProjectEntry = {
  projectName: Ref<string>;
  connected: Ref<boolean>;
  initializing: Ref<boolean>;
  pendingQuestions: Ref<Signal[]>;
  modelPreference: Ref<"opus" | "sonnet" | "gemini-3.1-pro" | "gemini-3-flash">;
  modePreference: Ref<"build" | "plan">;
  availableChats: Ref<Array<{ id: string; title: string; createdAt: string }>>;
  activeChatId: Ref<string | null>;
  chatInstances: Map<string | "null", ChatEntry>;
};

// Singleton state — survives across component mounts/unmounts
const projectMap = new Map<string, ProjectEntry>();

function createChatInstance(
  projectId: string,
  chatId: string | null,
  modelPreference: Ref<"opus" | "sonnet" | "gemini-3.1-pro" | "gemini-3-flash">,
  modePreference: Ref<"build" | "plan">
): ChatEntry {
  const chat = new Chat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        projectId,
        chatId: chatId || undefined,
        model: modelPreference.value,
        mode: modePreference.value,
      }),
    }),
    onError: (err) => {
      console.error(`[hive:chat:${projectId}:${chatId}]`, err.message);
    },
  });

  const state = (chat as any).state;
  return {
    chat,
    messages: state.messagesRef as Ref<UIMessage[]>,
    status: state.statusRef as Ref<string>,
    error: state.errorRef as Ref<Error | undefined>,
    initialized: false,
  };
}

function ensureProject(projectId: string): ProjectEntry {
  let entry = projectMap.get(projectId);
  if (entry) return entry;

  const modelPreference = ref<"opus" | "sonnet" | "gemini-3.1-pro" | "gemini-3-flash">("sonnet");
  const modePreference = ref<"build" | "plan">("build");
  const projectName = ref("");
  const connected = ref(false);
  const initializing = ref(false);
  const pendingQuestions = ref<Signal[]>([]);
  const availableChats = ref<Array<{ id: string; title: string; createdAt: string }>>([]);
  const activeChatId = ref<string | null>(null);
  const chatInstances = new Map<string | "null", ChatEntry>();

  entry = {
    projectName,
    connected,
    initializing,
    pendingQuestions,
    modelPreference,
    modePreference,
    availableChats,
    activeChatId,
    chatInstances,
  };

  projectMap.set(projectId, entry);
  return entry;
}

export function useHiveStore() {
  /**
   * Initialize a project: load project data + chat list, then mark as connected.
   */
  async function activate(projectId: string) {
    const entry = ensureProject(projectId);

    // Already connected or initializing
    if (entry.connected.value || entry.initializing.value) return;

    entry.initializing.value = true;

    try {
      // Fetch project metadata and chats list in parallel
      const [data, chatsList] = await Promise.all([
        $fetch<{ name: string }>(`/api/projects/${projectId}`),
        $fetch<Array<{ id: string; title: string; createdAt: string }>>(`/api/projects/${projectId}/chats`),
      ]);

      entry.projectName.value = data?.name ?? "";
      entry.availableChats.value = chatsList;

      // Pick the most recent chat as active, or default to null if none
      if (chatsList.length > 0) {
        await switchChat(projectId, chatsList[0].id);
      } else {
        await switchChat(projectId, null);
      }

      entry.connected.value = true;
    } catch (e: any) {
      console.error(`[hive:activate:${projectId}]`, e.message);
    } finally {
      entry.initializing.value = false;
    }
  }

  /**
   * Switch active chat for a project.
   */
  async function switchChat(projectId: string, chatId: string | null) {
    const entry = ensureProject(projectId);

    // Stop current chat if it's working
    const currentIdKey = entry.activeChatId.value || "null";
    const currentChat = entry.chatInstances.get(currentIdKey);
    if (currentChat && (currentChat.status.value === "streaming" || currentChat.status.value === "submitted")) {
      currentChat.chat.stop();
    }

    entry.activeChatId.value = chatId;
    const idKey = chatId || "null";

    let chatEntry = entry.chatInstances.get(idKey);
    if (!chatEntry) {
      chatEntry = createChatInstance(projectId, chatId, entry.modelPreference, entry.modePreference);
      entry.chatInstances.set(idKey, chatEntry);
    }

    if (!chatEntry.initialized) {
      try {
        const history = await $fetch<Array<{ id: string; role: string; content: unknown; createdAt: string }>>(
          `/api/projects/${projectId}/messages`,
          { query: { chatId: chatId || undefined } },
        );

        chatEntry.messages.value = history.map((row) => ({
          id: row.id,
          role: row.role as UIMessage["role"],
          parts: Array.isArray(row.content) ? (row.content as UIMessage["parts"]) : [],
          content: typeof row.content === "string" ? row.content : "",
          createdAt: new Date(row.createdAt),
        }));
        chatEntry.initialized = true;
      } catch (e: any) {
        console.error(`[hive:switchChat:${projectId}:${chatId}]`, e.message);
      }
    }
  }

  /**
   * Tear down a project's state.
   */
  function deactivate(projectId: string) {
    const entry = projectMap.get(projectId);
    if (entry) {
      for (const ce of entry.chatInstances.values()) {
        ce.chat.stop();
      }
    }
    projectMap.delete(projectId);
  }

  /**
   * Get reactive state for a project.
   */
  function project(projectId: string) {
    const entry = ensureProject(projectId);

    const getActiveChatEntry = () => {
      const idKey = entry.activeChatId.value || "null";
      let ce = entry.chatInstances.get(idKey);
      if (!ce) {
        ce = createChatInstance(projectId, entry.activeChatId.value, entry.modelPreference, entry.modePreference);
        entry.chatInstances.set(idKey, ce);
      }
      return ce;
    };

    // Proxied computed properties for the active chat
    const messages = computed({
      get: () => getActiveChatEntry().messages.value,
      set: (val) => { getActiveChatEntry().messages.value = val; }
    });
    const status = computed(() => getActiveChatEntry().status.value);
    const error = computed(() => getActiveChatEntry().error.value);

    const isLoading = computed(() => status.value === "streaming" || status.value === "submitted");

    return {
      // Chat reactivity (delegated to active chat)
      messages,
      status,
      isLoading,
      error,

      // Project-level chat state
      activeChatId: entry.activeChatId,
      availableChats: entry.availableChats,

      // Chat actions
      sendMessage: (text: string, files?: FileUIPart[]) => getActiveChatEntry().chat.sendMessage({ text, files }),
      stop: () => getActiveChatEntry().chat.stop(),

      createChat: async (title?: string) => {
        const newChat = await $fetch<{ id: string; title: string; createdAt: string }>(`/api/projects/${projectId}/chats`, {
          method: "POST",
          body: { title: title || `Chat ${entry.availableChats.value.length + 1}` }
        });
        entry.availableChats.value.unshift(newChat);
        await switchChat(projectId, newChat.id);
        return newChat;
      },

      deleteChat: async (chatId: string) => {
        await $fetch(`/api/chats/${chatId}`, { method: "DELETE" });
        entry.availableChats.value = entry.availableChats.value.filter((c) => c.id !== chatId);
        entry.chatInstances.delete(chatId);
        if (entry.activeChatId.value === chatId) {
          await switchChat(projectId, entry.availableChats.value[0]?.id || null);
        }
      },

      switchChat: (chatId: string | null) => switchChat(projectId, chatId),

      clearChat: async () => {
        const chatId = entry.activeChatId.value;
        await $fetch(`/api/projects/${projectId}/messages`, {
          method: "DELETE",
          query: { chatId: chatId || undefined },
        });
        getActiveChatEntry().messages.value = [];
      },

      // Global project preferences
      modelPreference: entry.modelPreference,
      modePreference: entry.modePreference,
      projectName: entry.projectName,
      connected: entry.connected,
      initializing: entry.initializing,
      pendingQuestions: entry.pendingQuestions,
    };
  }

  /**
   * Switch model preference for a project.
   */
  function setModel(projectId: string, model: "opus" | "sonnet" | "gemini-3.1-pro" | "gemini-3-flash") {
    const entry = ensureProject(projectId);
    entry.modelPreference.value = model;
  }

  /**
   * Switch mode preference for a project.
   */
  function setMode(projectId: string, mode: "build" | "plan") {
    const entry = ensureProject(projectId);
    entry.modePreference.value = mode;
  }

  /**
   * Resolve a pending signal/question.
   */
  async function resolveSignal(projectId: string, signalId: string, answer: string) {
    const entry = projectMap.get(projectId);
    if (!entry) return;

    try {
      await $fetch(`/api/signals/${signalId}`, {
        method: "POST",
        body: { answer },
      });
    } catch (e: any) {
      console.error(`[hive:resolveSignal:${projectId}]`, e.message);
    }

    // Optimistic removal
    entry.pendingQuestions.value = entry.pendingQuestions.value.filter(
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
