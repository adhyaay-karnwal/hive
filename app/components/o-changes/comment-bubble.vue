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
    class="my-1 mx-1.5 rounded-md border p-2.5 text-sm"
    :class="resolved ? 'border-edge/50 opacity-40' : 'bg-base-1 border-edge'"
  >
    <template v-if="!editing">
      <p class="text-primary m-0 whitespace-pre-wrap">{{ content }}</p>
      <div v-if="!resolved" class="mt-2 flex gap-3">
        <button
          class="text-tertiary hover:text-primary text-xs outline-none"
          @click="startEdit"
        >
          Edit
        </button>
        <button
          class="text-tertiary hover:text-primary text-xs outline-none"
          @click="emit('delete')"
        >
          Delete
        </button>
      </div>
    </template>
    <template v-else>
      <textarea
        ref="textareaRef"
        v-model="editText"
        rows="3"
        class="text-primary bg-base-0 border-edge w-full resize-none rounded-md border p-2 text-sm outline-none focus:border-edge-strong"
        @keydown.enter.meta.prevent="saveEdit"
        @keydown.escape.prevent="editing = false"
      />
      <div class="mt-2 flex justify-end gap-2">
        <button
          class="text-tertiary hover:text-primary text-xs outline-none"
          @click="editing = false"
        >
          Cancel
        </button>
        <button
          class="text-primary text-xs font-medium outline-none"
          @click="saveEdit"
        >
          Save
        </button>
      </div>
    </template>
  </div>
</template>
