<script setup lang="ts">
import { ChevronDownIcon, CheckIcon } from "@heroicons/vue/16/solid";
import type { FileUIPart } from "ai";

type Props = {
  projectId: string;
  placeholder?: string;
};

const { projectId, placeholder } = defineProps<Props>();

const store = useHiveStore();
const {
  messages,
  isLoading,
  pendingQuestions,
  connected,
  initializing,
  sendMessage,
  stop,
  modelPreference,
} = store.project(projectId);

const scrollArea = useTemplateRef("scrollArea");
const messageQueue = ref<{ text: string; files: FileUIPart[] }[]>([]);
const chatInput = useTemplateRef<{ focus: () => void }>("chatInput");

// Model selector state
const modelSelectorOpen = ref(false);
const models = [
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
] as const;

function setModel(model: "sonnet" | "opus") {
  store.setModel(projectId, model);
  modelSelectorOpen.value = false;
}

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
          :key="msg.id"
          :message="msg"
          :is-working="isLoading && msg === messages[messages.length - 1] && msg.role === 'assistant'"
          @abort="handleAbort"
        />
      </div>
    </div>

    <div class="shrink-0">
      <div class="mx-auto max-w-3xl px-4 pb-3">
        <div class="bg-base-2 p-0.5">
          <!-- Model Selector -->
          <div class="border-edge flex items-center justify-between border-b px-3 py-2">
            <span class="text-copy text-tertiary text-sm"></span>
            <OPopover v-model:open="modelSelectorOpen">
              <template #trigger>
                <button
                  class="text-primary hover:bg-base-2 flex items-center gap-1 rounded px-2 py-1 text-sm transition-colors"
                >
                  {{ modelPreference === "opus" ? "Opus" : "Sonnet" }}
                  <ChevronDownIcon class="size-4" />
                </button>
              </template>
              <div class="flex flex-col py-1">
                <button
                  v-for="model in models"
                  :key="model.value"
                  class="text-primary hover:bg-base-2 flex w-full items-center justify-between px-3 py-1.5 text-left text-sm"
                  @click="setModel(model.value)"
                >
                  <span>{{ model.label }}</span>
                  <CheckIcon v-if="modelPreference === model.value" class="size-4 text-primary" />
                </button>
              </div>
            </OPopover>
          </div>

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
              @send="(text, files) => handleSend(text, files)"
              @abort="handleAbort"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
