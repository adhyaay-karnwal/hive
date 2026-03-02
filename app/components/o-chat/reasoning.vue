<script setup lang="ts">
import { BrainIcon } from "lucide-vue-next";
import { ChevronRightIcon } from "@heroicons/vue/16/solid";

type Props = {
  text: string;
  state?: "streaming" | "done";
};

const { text, state = "done" } = defineProps<Props>();
const isStreaming = computed(() => state === "streaming");

// Auto-expand while streaming, collapse when done
const expanded = ref(true);

watch(() => state, (s) => {
  if (s === "done") expanded.value = false;
}, { immediate: false });
</script>

<template>
  <div class="my-1">
    <button
      type="button"
      class="group flex items-center gap-1.5 py-0.5 text-left outline-none"
      @click="expanded = !expanded"
    >
      <BrainIcon
        class="size-3.5 shrink-0"
        :class="isStreaming ? 'text-accent animate-pulse' : 'text-tertiary'"
      />
      <span class="text-copy text-tertiary font-mono">
        {{ isStreaming ? "Thinking…" : "Reasoned" }}
      </span>
      <ChevronRightIcon
        class="text-tertiary size-3.5 shrink-0 transition-transform"
        :class="expanded ? 'rotate-90' : ''"
      />
    </button>

    <div
      v-if="expanded && text"
      class="border-edge mt-1 border-l-2 pl-3"
    >
      <p class="text-copy text-tertiary whitespace-pre-wrap break-words leading-relaxed italic">{{ text }}</p>
    </div>
  </div>
</template>
