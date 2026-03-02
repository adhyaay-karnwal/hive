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
  <div class="bg-base-1 border-edge-strong my-1 mx-1.5 border p-2.5 text-copy">
    <p class="text-tertiary mb-2 text-copy">{{ lineLabel }}</p>
    <textarea
      ref="textareaRef"
      v-model="text"
      rows="3"
      placeholder="Add review feedback..."
      class="text-primary bg-base-0 border-edge w-full resize-none border p-2 text-copy outline-none focus:border-edge-strong"
      @keydown.enter.meta.prevent="submit"
      @keydown.escape.stop.prevent="emit('cancel')"
    />
    <div class="mt-2 flex justify-end gap-1">
      <OButton variant="transparent" @click="emit('cancel')">Cancel</OButton>
      <OButton variant="primary" :disabled="!text.trim()" @click="submit">Comment</OButton>
    </div>
  </div>
</template>
