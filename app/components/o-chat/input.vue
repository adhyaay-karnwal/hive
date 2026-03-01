<script setup lang="ts">
import { ArrowUpIcon, StopIcon, PlusIcon, XMarkIcon, DocumentIcon } from "@heroicons/vue/16/solid";
import { useFileDialog, useTextareaAutosize, useBase64, useEventListener } from "@vueuse/core";

type Mode = "build" | "plan";

type AttachedFile = { name: string; mime: string; url: string };

type Props = {
  disabled?: boolean;
  placeholder?: string;
  isWorking?: boolean;
  modelName?: string;
  mode?: Mode;
  supportsAttachment?: boolean;
  isDragging?: boolean;
};

type Emits = {
  send: [payload: { text: string; files: AttachedFile[] }];
  abort: [];
  "update:mode": [mode: Mode];
};

const emit = defineEmits<Emits>();

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: "Send a message...",
  isWorking: false,
  modelName: "",
  mode: "build",
  supportsAttachment: false,
  isDragging: false,
});
const attachedFiles = ref<AttachedFile[]>([]);

// Textarea with auto-resize — pass our own template ref in so useEventListener targets the same element
const textareaEl = useTemplateRef<HTMLTextAreaElement>("textarea");
const { input: message, triggerResize } = useTextareaAutosize({ element: textareaEl });

// File dialog (paperclip button)
const { open: openFilePicker, onChange: onFileDialogChange } = useFileDialog({
  accept: "image/*,.pdf",
  multiple: true,
  reset: true,
});

onFileDialogChange(async (fileList) => {
  if (!fileList) return;
  await attachFiles(Array.from(fileList));
});

async function attachFiles(files: File[]) {
  for (const file of files) {
    const { promise } = useBase64(file);
    const url = await promise.value;
    attachedFiles.value.push({ name: file.name, mime: file.type, url });
  }
}

function removeFile(index: number) {
  attachedFiles.value.splice(index, 1);
}

function handleSend() {
  const trimmed = message.value.trim();
  if (!trimmed || props.disabled) return;
  emit("send", { text: trimmed, files: attachedFiles.value });
  message.value = "";
  attachedFiles.value = [];
  triggerResize();
}

function toggleMode() {
  emit("update:mode", props.mode === "build" ? "plan" : "build");
}

useEventListener(textareaEl, "keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
  if (e.key === "Tab") {
    e.preventDefault();
    toggleMode();
  }
  if (e.key === "Escape" && props.isWorking) {
    e.preventDefault();
    emit("abort");
  }
});

useEventListener(textareaEl, "paste", async (e: ClipboardEvent) => {
  if (!props.supportsAttachment) return;
  const files = Array.from(e.clipboardData?.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((f): f is File => f !== null);
  if (files.length) {
    e.preventDefault();
    await attachFiles(files);
  }
});

defineExpose({ focus: () => textareaEl.value?.focus(), attachFiles });
</script>

<template>
  <div
    class="relative overflow-hidden transition-colors"
    :class="[props.disabled ? 'opacity-40' : '', props.isDragging ? 'bg-accent/5' : '']"
  >
    <!-- Drag overlay -->
    <div
      v-if="props.isDragging"
      class="border-accent text-accent pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed"
    >
      Drop files to attach
    </div>

    <!-- Attached file previews -->
    <div v-if="attachedFiles.length" class="flex flex-wrap gap-2 px-3 pt-2.5">
      <div
        v-for="(file, i) in attachedFiles"
        :key="i"
        class="border-edge bg-surface-2 group relative flex items-center gap-1.5 border px-2 py-1"
      >
        <!-- Image thumbnail -->
        <img
          v-if="file.mime.startsWith('image/')"
          :src="file.url"
          class="size-6 shrink-0 object-cover"
          alt=""
        />
        <!-- Non-image icon -->
        <DocumentIcon v-else class="text-tertiary size-4 shrink-0" />

        <span class="text-copy text-primary max-w-36 truncate">{{ file.name }}</span>

        <OButton
          variant="transparent"
          :icon-left="XMarkIcon"
          @click="removeFile(i)"
        />
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

    <div class="flex items-center justify-between px-2.5 pb-2">
      <div class="flex items-center gap-1">
        <OButton
          v-if="props.supportsAttachment"
          variant="transparent"
          :icon-left="PlusIcon"
          title="Attach file"
          @click="openFilePicker()"
        />

        <OButton
          variant="transparent"
          :class="props.mode === 'plan' ? 'text-accent' : ''"
          @click="toggleMode"
        >
          {{ props.mode === "build" ? "Build" : "Plan" }}
        </OButton>

        <span v-if="props.modelName" class="text-copy text-tertiary font-mono">
          {{ props.modelName }}
        </span>
      </div>

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
          :class="!message.trim() || props.disabled ? 'opacity-20 scale-90' : ''"
          @click="handleSend"
        />
      </div>
    </div>
  </div>
</template>
