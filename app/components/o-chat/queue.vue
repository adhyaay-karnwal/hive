<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/16/solid";

type Props = {
  messages: string[];
};

type Emits = {
  remove: [index: number];
};

const { messages } = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div v-if="messages.length" class="flex flex-col gap-1 px-3 py-2.5">
    <div
      v-for="(msg, i) in messages"
      :key="i"
      class="group/q flex items-start gap-2"
    >
      <p class="text-copy-sm text-secondary min-w-0 flex-1 truncate py-0.5">
        {{ msg }}
      </p>
      <button
        type="button"
        class="text-tertiary hover:text-primary grid size-5 shrink-0 place-items-center opacity-0 transition-opacity outline-none group-hover/q:opacity-100"
        @click="emit('remove', i)"
      >
        <XMarkIcon class="size-3" />
      </button>
    </div>
  </div>
</template>
