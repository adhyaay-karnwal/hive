<script setup lang="ts">
import { ArrowUpIcon, StopIcon, PaperClipIcon, XMarkIcon } from "@heroicons/vue/16/solid";
import { useTextareaAutosize, useEventListener } from "@vueuse/core";
import type { FileUIPart } from "ai";

type Props = {
  disabled?: boolean;
  placeholder?: string;
  isWorking?: boolean;
};

type Emits = {
  send: [text: string, files: FileUIPart[]];
  abort: [];
};

const emit = defineEmits<Emits>();

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: "Send a message...",
  isWorking: false,
});

// Textarea with auto-resize
const textareaEl = useTemplateRef<HTMLTextAreaElement>("textarea");
const { input: message, triggerResize } = useTextareaAutosize({ element: textareaEl });

// Attached images
const attachments = ref<FileUIPart[]>([]);
const fileInputEl = useTemplateRef<HTMLInputElement>("fileInput");

async function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;

  for (const file of Array.from(input.files)) {
    if (!file.type.startsWith("image/")) continue;
    const dataUrl = await readFileAsDataUrl(file);
    attachments.value.push({
      type: "file",
      mediaType: file.type as FileUIPart["mediaType"],
      url: dataUrl,
      filename: file.name,
    });
  }

  // Reset so same file can be selected again
  input.value = "";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1);
}

function handleSend() {
  const trimmed = message.value.trim();
  if ((!trimmed && !attachments.value.length) || props.disabled) return;
  emit("send", trimmed, [...attachments.value]);
  message.value = "";
  attachments.value = [];
  triggerResize();
}

useEventListener(textareaEl, "keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
  if (e.key === "Escape" && props.isWorking) {
    e.preventDefault();
    emit("abort");
  }
});

// Paste images from clipboard
useEventListener(textareaEl, "paste", async (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of Array.from(items)) {
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (!file) continue;
    const dataUrl = await readFileAsDataUrl(file);
    attachments.value.push({
      type: "file",
      mediaType: file.type as FileUIPart["mediaType"],
      url: dataUrl,
    });
  }
});

defineExpose({ focus: () => textareaEl.value?.focus() });
</script>

<template>
  <div
    class="relative overflow-hidden transition-colors"
    :class="props.disabled ? 'opacity-40' : ''"
  >
    <!-- Image previews -->
    <div v-if="attachments.length" class="flex flex-wrap gap-2 px-3 pt-2.5">
      <div
        v-for="(att, i) in attachments"
        :key="i"
        class="group/thumb relative size-16 shrink-0 overflow-hidden"
      >
        <img
          :src="att.url"
          class="size-full object-cover"
          :alt="att.filename ?? 'attachment'"
        />
        <button
          class="bg-base-1/80 absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/thumb:opacity-100"
          @click="removeAttachment(i)"
        >
          <XMarkIcon class="text-primary size-4" />
        </button>
      </div>
    </div>

    <textarea
      ref="textarea"
      v-model="message"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      rows="1"
      class="text-copy text-primary placeholder:text-tertiary block min-h-[2.25rem] w-full resize-none bg-transparent px-3 pt-2.5 pb-1.5 outline-none"
    />

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="onFilesSelected"
    />

    <div class="flex items-center justify-between px-2.5 pb-2">
      <!-- Attach button -->
      <OButton
        variant="transparent"
        :icon-left="PaperClipIcon"
        :disabled="props.disabled"
        title="Attach image"
        @click="fileInputEl?.click()"
      />

      <div class="flex items-center gap-1.5">
        <OButton
          v-if="props.isWorking"
          variant="danger-solid"
          :icon-left="StopIcon"
          title="Stop generation (Escape)"
          @click="emit('abort')"
        />
        <OButton
          v-else
          variant="inverse"
          :icon-left="ArrowUpIcon"
          :class="(!message.trim() && !attachments.length) || props.disabled ? 'opacity-20 scale-90' : ''"
          @click="handleSend"
        />
      </div>
    </div>
  </div>
</template>
