<script setup lang="ts">
import type { FileUIPart } from "ai";

type Props = {
  projectId: string;
  placeholder?: string;
};

const { projectId, placeholder } = defineProps<Props>();

const store = useHiveStore();
const {
  messages,
  activeChatId,
  isLoading,
  pendingQuestions,
  connected,
  initializing,
  sendMessage,
  stop,
  modelPreference,
  modePreference,
} = store.project(projectId);

// Computed model name for display
const modelName = computed(() => {
  switch (modelPreference.value) {
    case "opus": return "claude-opus-4-6";
    case "sonnet": return "claude-sonnet-4-6";
    case "gemini-3.1-pro": return "gemini-3.1-pro";
    case "gemini-3-flash": return "gemini-3-flash";
    default: return "claude-sonnet-4-6";
  }
});

// Handle mode changes from input component
function handleModeUpdate(mode: "build" | "plan") {
  store.setMode(projectId, mode);
}

// Handle model changes from input component
function handleModelUpdate(model: string) {
  let internalModel: "opus" | "sonnet" | "gemini-3.1-pro" | "gemini-3-flash" = "sonnet";
  if (model === "claude-opus-4-6") internalModel = "opus";
  else if (model === "gemini-3.1-pro") internalModel = "gemini-3.1-pro";
  else if (model === "gemini-3-flash") internalModel = "gemini-3-flash";

  store.setModel(projectId, internalModel);
}

const scrollArea = useTemplateRef("scrollArea");
const messageQueue = ref<{ text: string; files: FileUIPart[] }[]>([]);
const chatInput = useTemplateRef<{ focus: () => void }>("chatInput");

// Auto-dequeue when agent finishes
watch(isLoading, (loading, wasLoading) => {
  if (wasLoading && !loading && messageQueue.value.length > 0) {
    const next = messageQueue.value.shift()!;
    sendMessage(next.text, next.files);
  }
});

function handleSend(text: string, files: FileUIPart[] = []) {
  if (isLoading.value) {
    messageQueue.value.push({ text, files });
  } else {
    sendMessage(text, files);
    stickToBottom.value = true;
    scrollToBottom();
  }
}

function removeFromQueue(index: number) {
  messageQueue.value.splice(index, 1);
}

function handleAbort() {
  stop();
}

function handleResolveQuestion(signalId: string, answer: string) {
  store.resolveSignal(projectId, signalId, answer);
}

// ── Scroll management via MutationObserver + ResizeObserver ──

const stickToBottom = ref(true);
let mutationObs: MutationObserver | null = null;
let resizeObs: ResizeObserver | null = null;

function scrollToBottom() {
  if (!scrollArea.value || !stickToBottom.value) return;
  scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
}

function onScroll() {
  if (!scrollArea.value) return;
  const { scrollTop, scrollHeight, clientHeight } = scrollArea.value;
  stickToBottom.value = scrollTop + clientHeight >= scrollHeight - 40;
}

onMounted(() => {
  const el = scrollArea.value;
  if (!el) return;

  // Observe DOM mutations (new message elements added)
  mutationObs = new MutationObserver(() => scrollToBottom());
  mutationObs.observe(el, { childList: true, subtree: true });

  // Observe content size changes (markdown rendering, code blocks expanding)
  resizeObs = new ResizeObserver(() => scrollToBottom());
  for (const child of el.children) {
    resizeObs.observe(child);
  }

  // Auto-focus the chat input on load
  chatInput.value?.focus();
});

onUnmounted(() => {
  mutationObs?.disconnect();
  resizeObs?.disconnect();
});

// Force scroll on initial load
watch(initializing, (val, old) => {
  if (old && !val) {
    stickToBottom.value = true;
    nextTick(() => scrollToBottom());
  }
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div ref="scrollArea" class="min-h-0 flex-1 overflow-y-auto" @scroll="onScroll">
      <div
        v-if="!messages.length && !isLoading"
        class="flex h-full items-center justify-center"
      >
        <p class="text-copy text-tertiary">
          {{ connected ? "Send a message to start." : "Connecting..." }}
        </p>
      </div>

      <div v-else class="mx-auto max-w-3xl">
        <OChatTurn
          v-for="msg in messages"
          :key="`${activeChatId}-${msg.id}`"
          :message="msg"
          :is-working="isLoading && msg === messages[messages.length - 1] && msg.role === 'assistant'"
          @abort="handleAbort"
        />
      </div>
    </div>

    <div class="shrink-0">
      <div class="mx-auto max-w-3xl px-4 pb-3">
        <div class="bg-base-2 p-0.5">
          <OChatQuestion
            v-for="q in pendingQuestions"
            :key="q.id"
            :signal="q"
            @resolve="handleResolveQuestion"
          />

          <div
            v-if="pendingQuestions.length && messageQueue.length"
            class="border-edge mx-3 border-t"
          />

          <OChatQueue
            :messages="messageQueue"
            @remove="removeFromQueue"
          />

          <div class="bg-base-3">
            <OChatInput
              ref="chatInput"
              :disabled="!connected"
              :placeholder="placeholder || 'Send a message...'"
              :is-working="isLoading"
              :model-name="modelName"
              :mode="modePreference"
              @send="(text, files) => handleSend(text, files)"
              @abort="handleAbort"
              @update:mode="handleModeUpdate"
              @update:model="handleModelUpdate"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
