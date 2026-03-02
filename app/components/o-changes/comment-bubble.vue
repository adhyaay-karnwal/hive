<script setup lang="ts">
type Props = {
  content: string;
  resolved?: boolean;
};

type Emits = {
  edit: [content: string];
  delete: [];
};

const { content, resolved = false } = defineProps<Props>();
const emit = defineEmits<Emits>();

const editing = ref(false);
const editText = ref("");
const textareaRef = ref<HTMLTextAreaElement>();

function startEdit() {
  editText.value = content;
  editing.value = true;
  nextTick(() => textareaRef.value?.focus());
}

function saveEdit() {
  const trimmed = editText.value.trim();
  if (trimmed && trimmed !== content) {
    emit("edit", trimmed);
  }
  editing.value = false;
}
</script>

<template>
  <div
    class="my-1 mx-1.5 border p-2.5 text-copy"
    :class="resolved ? 'border-edge/50 opacity-40' : 'bg-base-1 border-edge'"
  >
    <template v-if="!editing">
      <p class="text-primary m-0 whitespace-pre-wrap">{{ content }}</p>
      <div v-if="!resolved" class="mt-2 flex gap-1">
        <OButton variant="transparent" @click="startEdit">Edit</OButton>
        <OButton variant="transparent" @click="emit('delete')">Delete</OButton>
      </div>
    </template>
    <template v-else>
      <textarea
        ref="textareaRef"
        v-model="editText"
        rows="3"
        class="text-primary bg-base-0 border-edge w-full resize-none border p-2 text-copy outline-none focus:border-edge-strong"
        @keydown.enter.meta.prevent="saveEdit"
        @keydown.escape.prevent="editing = false"
      />
      <div class="mt-2 flex justify-end gap-1">
        <OButton variant="transparent" @click="editing = false">Cancel</OButton>
        <OButton variant="primary" @click="saveEdit">Save</OButton>
      </div>
    </template>
  </div>
</template>
