<script setup lang="ts">
type Mode = "build" | "plan";

type Props = {
  projectId: string;
  placeholder?: string;
};

const { projectId, placeholder } = defineProps<Props>();

const store = useHiveStore();
const { turns, messages, isWorking, pendingQuestions, modelName, connected, initializing } = store.project(projectId);

const mode = ref<Mode>("build");
const scrollArea = ref<HTMLDivElement>();
const messageQueue = ref<string[]>([]);

// Auto-dequeue when agent finishes
watch(isWorking, (working, wasWorking) => {
  if (wasWorking && !working && messageQueue.value.length > 0) {
    const next = messageQueue.value.shift()!;
    store.sendPrompt(projectId, next, { agent: mode.value });
  }
});

function handleSend(text: string) {
  if (isWorking.value) {
    messageQueue.value.push(text);
  } else {
    store.sendPrompt(projectId, text, { agent: mode.value });
    stickToBottom.value = true;
    scrollToBottom();
  }
}

function removeFromQueue(index: number) {
  messageQueue.value.splice(index, 1);
}

function handleAbort() {
  store.abort(projectId);
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
        v-if="!turns.length && !isWorking"
        class="flex h-full items-center justify-center"
      >
        <p class="text-copy text-tertiary">
          {{ connected ? "Send a message to start." : "Connecting..." }}
        </p>
      </div>

      <div v-else class="mx-auto max-w-3xl">
        <OChatTurn
          v-for="(turn, i) in turns"
          :key="turn.userMessage.info.id"
          :user-message="turn.userMessage"
          :assistant-messages="turn.assistantMessages"
          :is-working="isWorking && i === turns.length - 1"
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

            <div class="bg-base-3 border-edge border">
            <OChatInput
              :disabled="!connected"
              :placeholder="placeholder || 'Send a message...'"
              :is-working
              :model-name="modelName"
              :mode
              @send="handleSend"
              @abort="handleAbort"
              @update:mode="mode = $event"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
