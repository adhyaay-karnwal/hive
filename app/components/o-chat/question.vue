<script setup lang="ts">
import { QuestionMarkCircleIcon } from "@heroicons/vue/16/solid";
import { ArrowUpIcon } from "@heroicons/vue/16/solid";

type Signal = {
  id: string;
  type: string;
  content: string;
  options?: string[] | null;
  resolved: boolean;
};

type Props = {
  signal: Signal;
};

type Emits = {
  resolve: [signalId: string, answer: string];
};

const { signal } = defineProps<Props>();
const emit = defineEmits<Emits>();

const answer = ref("");

function submit() {
  const trimmed = answer.value.trim();
  if (!trimmed) return;
  emit("resolve", signal.id, trimmed);
  answer.value = "";
}

function selectOption(opt: string) {
  emit("resolve", signal.id, opt);
}
</script>

<template>
  <div class="px-3 py-2.5">
    <div class="flex items-start gap-2">
      <QuestionMarkCircleIcon class="text-warn mt-0.5 size-4 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="text-copy-sm text-primary">{{ signal.content }}</p>

        <div v-if="signal.options?.length" class="mt-2 flex flex-wrap gap-1">
          <button
            v-for="opt in (signal.options as string[])"
            :key="opt"
            type="button"
            class="bg-base-3 border-edge text-copy-sm text-primary hover:bg-surface-1 border px-2.5 py-1 transition-colors"
            @click="selectOption(opt)"
          >
            {{ opt }}
          </button>
        </div>

        <div v-else class="mt-2 flex gap-1.5">
          <input
            v-model="answer"
            class="text-copy-sm text-primary placeholder:text-tertiary bg-base-3 border-edge h-7 min-w-0 flex-1 border px-2.5 outline-none"
            placeholder="Type your answer..."
            @keydown.enter.prevent="submit"
          />
          <button
            type="button"
            class="bg-inverse text-inverse grid size-7 shrink-0 place-items-center transition-all"
            :class="!answer.trim() ? 'opacity-20 scale-90' : 'hover:opacity-80'"
            @click="submit"
          >
            <ArrowUpIcon class="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
