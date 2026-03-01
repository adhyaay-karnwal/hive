<script setup lang="ts">
type Props = {
  startLine: number;
  endLine: number;
};

type Emits = {
  submit: [content: string];
  cancel: [];
};

const { startLine, endLine } = defineProps<Props>();
const emit = defineEmits<Emits>();

const text = ref("");
const textareaRef = ref<HTMLTextAreaElement>();

const lineLabel = computed(() =>
  startLine === endLine ? `Line ${startLine}` : `Lines ${startLine}–${endLine}`,
);

function submit() {
  if (text.value.trim()) {
    emit("submit", text.value.trim());
  }
}

onMounted(() => nextTick(() => textareaRef.value?.focus()));
</script>

<template>
  <div class="bg-base-1 border-edge-strong my-1 mx-1.5 rounded-md border p-2.5 text-sm">
    <p class="text-tertiary mb-2 text-xs">{{ lineLabel }}</p>
    <textarea
      ref="textareaRef"
      v-model="text"
      rows="3"
      placeholder="Add review feedback..."
      class="text-primary bg-base-0 border-edge w-full resize-none rounded-md border p-2 text-sm outline-none focus:border-edge-strong"
      @keydown.enter.meta.prevent="submit"
      @keydown.escape.stop.prevent="emit('cancel')"
    />
    <div class="mt-2 flex justify-end gap-2">
      <button
        class="text-tertiary hover:text-primary text-xs outline-none"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        class="text-primary bg-surface-1 border-edge rounded-md border px-2.5 py-1 text-xs font-medium outline-none"
        :disabled="!text.trim()"
        :class="text.trim() ? 'hover:bg-surface-2' : 'opacity-40'"
        @click="submit"
      >
        Comment
      </button>
    </div>
  </div>
</template>
