<script setup lang="ts">
import { ArrowUpIcon, StopIcon, PaperClipIcon, XMarkIcon } from "@heroicons/vue/16/solid";

type Mode = "build" | "plan";

type AttachedFile = { name: string; mime: string; url: string };

type Props = {
  disabled?: boolean;
  placeholder?: string;
  isWorking?: boolean;
  modelName?: string;
  mode?: Mode;
  supportsAttachment?: boolean;
};

type Emits = {
  send: [payload: { text: string; files: AttachedFile[] }];
  abort: [];
  "update:mode": [mode: Mode];
};

const {
  disabled = false,
  placeholder = "Send a message...",
  isWorking = false,
  modelName = "",
  mode = "build",
  supportsAttachment = false,
} = defineProps<Props>();

const emit = defineEmits<Emits>();

const message = ref("");
const inputRef = ref<HTMLTextAreaElement>();
const fileInputRef = ref<HTMLInputElement>();
const attachedFiles = ref<AttachedFile[]>([]);

function handleSend() {
  const trimmed = message.value.trim();
  if (!trimmed || disabled) return;
  emit("send", { text: trimmed, files: attachedFiles.value });
  message.value = "";
  attachedFiles.value = [];
  nextTick(() => {
    if (inputRef.value) inputRef.value.style.height = "auto";
  });
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
  if (e.key === "Tab") {
    e.preventDefault();
    toggleMode();
  }
  if (e.key === "Escape" && isWorking) {
    e.preventDefault();
    emit("abort");
  }
}

function autoResize(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = "auto";
  target.style.height = Math.min(target.scrollHeight, 200) + "px";
}

function toggleMode() {
  emit("update:mode", mode === "build" ? "plan" : "build");
}

function focusInput() {
  inputRef.value?.focus();
}

function openFilePicker() {
  fileInputRef.value?.click();
}

async function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;

  for (const file of Array.from(input.files)) {
    const url = await readFileAsDataUrl(file);
    attachedFiles.value.push({ name: file.name, mime: file.type, url });
  }

  // Reset so the same file can be picked again
  input.value = "";
}

function removeFile(index: number) {
  attachedFiles.value.splice(index, 1);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

defineExpose({ focus: focusInput });
</script>

<template>
  <div
    class="overflow-hidden"
    :class="disabled ? 'opacity-40' : ''"
  >
    <!-- Attached file previews -->
    <div v-if="attachedFiles.length" class="flex flex-wrap gap-1.5 px-3 pt-2">
      <div
        v-for="(file, i) in attachedFiles"
        :key="i"
        class="border-edge bg-surface-1 flex items-center gap-1 border px-2 py-0.5"
      >
        <span class="text-copy text-secondary max-w-32 truncate">{{ file.name }}</span>
        <OButton
          variant="transparent"
          :icon-left="XMarkIcon"
          class="text-tertiary"
          @click="removeFile(i)"
        />
      </div>
    </div>

    <textarea
      ref="inputRef"
      v-model="message"
      :placeholder
      :disabled
      rows="1"
      class="text-copy text-primary placeholder:text-tertiary block min-h-[2.25rem] w-full resize-none bg-transparent px-3 pt-2.5 pb-1.5 outline-none"
      @keydown="handleKeydown"
      @input="autoResize"
    />

    <div class="flex items-center justify-between px-2.5 pb-2">
      <div class="flex items-center gap-1">
        <OButton
          variant="transparent"
          :class="mode === 'plan' ? 'text-accent' : ''"
          @click="toggleMode"
        >
          {{ mode === "build" ? "Build" : "Plan" }}
        </OButton>

        <span v-if="modelName" class="text-copy text-tertiary font-mono">
          {{ modelName }}
        </span>
      </div>

      <div class="flex items-center gap-1.5">
        <OButton
          v-if="supportsAttachment"
          variant="transparent"
          :icon-left="PaperClipIcon"
          title="Attach file"
          @click="openFilePicker"
        />

        <OButton
          v-if="isWorking"
          variant="danger-solid"
          :icon-left="StopIcon"
          title="Stop generation (Escape)"
          @click="emit('abort')"
        />
        <OButton
          v-else
          variant="inverse"
          :icon-left="ArrowUpIcon"
          :class="!message.trim() || disabled ? 'opacity-20 scale-90' : ''"
          @click="handleSend"
        />
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      v-if="supportsAttachment"
      ref="fileInputRef"
      type="file"
      multiple
      accept="image/*,.pdf"
      class="hidden"
      @change="onFilesSelected"
    />
  </div>
</template>
