<script setup lang="ts">
import { QuestionMarkCircleIcon, CheckCircleIcon } from "@heroicons/vue/16/solid";

type Props = {
  signal: {
    id: string;
    type: string;
    content: string;
    options?: string[] | null;
    resolved: boolean;
  };
};

type Emits = {
  resolve: [signalId: string, answer: string];
};

const { signal } = defineProps<Props>();
const emit = defineEmits<Emits>();

const answer = ref("");
const resolving = ref(false);

async function submitAnswer() {
  if (!answer.value.trim()) return;
  resolving.value = true;
  emit("resolve", signal.id, answer.value.trim());
}

function selectOption(option: string) {
  resolving.value = true;
  emit("resolve", signal.id, option);
}
</script>

<template>
  <div class="border-edge border p-2">
    <div class="flex items-start gap-2">
      <QuestionMarkCircleIcon
        v-if="!signal.resolved"
        class="text-warn mt-0.5 size-3.5 shrink-0"
      />
      <CheckCircleIcon
        v-else
        class="text-success mt-0.5 size-3.5 shrink-0"
      />
      <div class="min-w-0 flex-1">
        <p class="text-copy-sm text-primary line-clamp-3">
          {{ signal.content }}
        </p>

        <div
          v-if="signal.options?.length && !signal.resolved"
          class="mt-2 flex flex-col gap-1"
        >
          <button
            v-for="opt in (signal.options as string[])"
            :key="opt"
            type="button"
            class="bg-surface-1 hover:bg-surface-2 text-copy-sm text-primary px-2 py-1 text-left"
            :disabled="resolving"
            @click="selectOption(opt)"
          >
            {{ opt }}
          </button>
        </div>

        <div v-if="!signal.options?.length && !signal.resolved" class="mt-2">
          <form @submit.prevent="submitAnswer" class="flex gap-1">
            <input
              v-model="answer"
              class="bg-surface-1 border-edge text-copy-sm text-primary h-6 flex-1 border px-2 outline-none"
              placeholder="Your answer..."
              :disabled="resolving"
            />
            <OButton
              type="submit"
              variant="primary"
              size="xs"
              :loading="resolving"
              :disabled="!answer.trim()"
            >
              Send
            </OButton>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
