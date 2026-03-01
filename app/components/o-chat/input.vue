<script setup lang="ts">
import { ArrowUpIcon, StopIcon } from "@heroicons/vue/16/solid";

type Mode = "build" | "plan";

type Props = {
  disabled?: boolean;
  placeholder?: string;
  isWorking?: boolean;
  modelName?: string;
  mode?: Mode;
};

type Emits = {
  send: [message: string];
  abort: [];
  "update:mode": [mode: Mode];
};

const {
  disabled = false,
  placeholder = "Send a message...",
  isWorking = false,
  modelName = "",
  mode = "build",
} = defineProps<Props>();

const emit = defineEmits<Emits>();

const message = ref("");
const inputRef = ref<HTMLTextAreaElement>();

function handleSend() {
  const trimmed = message.value.trim();
  if (!trimmed || disabled) return;
  emit("send", trimmed);
  message.value = "";
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

defineExpose({ focus: focusInput });
</script>

<template>
  <div
    class="overflow-hidden"
    :class="disabled ? 'opacity-40' : ''"
  >
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
        <button
          type="button"
          class="text-copy-xs hover:bg-surface-3 flex items-center gap-1 px-1.5 py-0.5 transition-colors outline-none"
          :class="mode === 'plan' ? 'text-accent' : 'text-tertiary'"
          @click="toggleMode"
        >
          {{ mode === "build" ? "Build" : "Plan" }}
        </button>

        <span v-if="modelName" class="text-copy-xs text-tertiary font-mono">
          {{ modelName }}
        </span>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          v-if="isWorking"
          type="button"
          class="bg-danger text-danger-on grid size-6 place-items-center transition-all hover:opacity-80"
          title="Stop generation (Escape)"
          @click="emit('abort')"
        >
          <StopIcon class="size-3" />
        </button>
        <button
          v-else
          type="button"
          class="bg-inverse text-inverse grid size-6 place-items-center transition-all"
          :class="!message.trim() || disabled ? 'opacity-20 scale-90' : 'hover:opacity-80'"
          @click="handleSend"
        >
          <ArrowUpIcon class="size-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
