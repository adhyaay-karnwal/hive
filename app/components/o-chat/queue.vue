<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/16/solid";

type Props = {
  messages: { text: string; files: { type: string }[] }[];
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
      <p class="text-copy text-secondary min-w-0 flex-1 truncate py-0.5">
        {{ msg.text || (msg.files?.length ? `[${msg.files.length} image${msg.files.length > 1 ? "s" : ""}]` : "") }}
      </p>
      <OButton
        variant="transparent"
       
        :icon-left="XMarkIcon"
        class="shrink-0 opacity-0 transition-opacity group-hover/q:opacity-100"
        @click="emit('remove', i)"
      />
    </div>
  </div>
</template>
