<script setup lang="ts">
import {
  ClipboardIcon,
  CheckIcon,
  StopIcon,
} from "@heroicons/vue/16/solid";
import { ArrowPathIcon } from "@heroicons/vue/20/solid";
import type { UIMessage, FileUIPart } from "ai";

type DynamicToolPart = {
  type: "dynamic-tool";
  toolName: string;
  toolCallId: string;
  state: string;
  input?: any;
  output?: any;
  errorText?: string;
};

type ReasoningPart = {
  type: "reasoning";
  text: string;
  state?: "streaming" | "done";
};

type RenderBlock =
  | { kind: "text"; text: string; id: string }
  | { kind: "reasoning"; text: string; state?: "streaming" | "done"; id: string }
  | { kind: "tools"; tools: DynamicToolPart[]; id: string };

type Props = {
  message: UIMessage;
  isWorking?: boolean;
};

type Emits = {
  abort: [];
};

const { message, isWorking = false } = defineProps<Props>();
const emit = defineEmits<Emits>();

const isUser = computed(() => message.role === "user");

const userText = computed(() => {
  if (!isUser.value) return "";
  // User messages have text parts, or fall back to joining all text
  const textParts = (message.parts ?? []).filter((p) => p.type === "text");
  if (textParts.length) {
    return textParts.map((p) => (p as any).text).join("\n");
  }
  return "";
});

const imageAttachments = computed<FileUIPart[]>(() => {
  if (!isUser.value) return [];
  return (message.parts ?? []).filter(
    (p): p is FileUIPart => p.type === "file" && (p as FileUIPart).mediaType?.startsWith("image/"),
  );
});

// Build sequential render blocks from assistant message parts.
// Consecutive tool calls are grouped into a single collapsible block.
// Text parts are individual blocks between tool groups.
const blocks = computed<RenderBlock[]>(() => {
  if (isUser.value) return [];

  const result: RenderBlock[] = [];

  for (const part of message.parts ?? []) {
    if (part.type === "reasoning") {
      const rp = part as unknown as ReasoningPart;
      result.push({
        kind: "reasoning",
        text: rp.text,
        state: rp.state,
        id: `reasoning-${message.id}-${result.length}`,
      });
    } else if (part.type === "text" && (part as any).text) {
      result.push({
        kind: "text",
        text: (part as any).text,
        id: `text-${message.id}-${result.length}`,
      });
    } else if (part.type === "dynamic-tool" || (part.type as string).startsWith("tool-")) {
      const toolPart = part as unknown as DynamicToolPart;
      const last = result[result.length - 1];
      if (last?.kind === "tools") {
        last.tools.push(toolPart);
      } else {
        result.push({
          kind: "tools",
          tools: [toolPart],
          id: toolPart.toolCallId || `tools-${message.id}-${result.length}`,
        });
      }
    }
  }

  return result;
});

const allText = computed(() =>
  blocks.value
    .filter((b): b is RenderBlock & { kind: "text" } => b.kind === "text")
    .map((b) => b.text)
    .join("\n\n"),
);

const statusText = computed(() => {
  if (!isWorking) return "";

  // Check the last tool part for a status hint
  for (let i = (message.parts ?? []).length - 1; i >= 0; i--) {
    const part = message.parts[i] as any;
    if (part.type === "dynamic-tool" || (part.type as string)?.startsWith("tool-")) {
      const toolName = part.toolName;
      switch (toolName) {
        case "read": return "Gathering context";
        case "glob": case "grep": case "codesearch": return "Searching codebase";
        case "str_replace_based_edit_tool": case "write": return "Making edits";
        case "bash": return "Running command";
        case "web_fetch": case "web_search": return "Searching the web";
        case "spawn_agent": return "Delegating work";
        case "code_execution": return "Running code";
        default: return "Working";
      }
    }
  }
  return "Thinking";
});

// Duration timer
const startTime = ref<number | null>(null);
const elapsed = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

watch(() => isWorking, (working) => {
  if (working && !startTime.value) {
    startTime.value = Date.now();
    timer = setInterval(() => {
      elapsed.value = Math.floor((Date.now() - startTime.value!) / 1000);
    }, 1000);
  } else if (!working && timer) {
    clearInterval(timer);
    timer = null;
  }
}, { immediate: true });

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const formattedDuration = computed(() => {
  if (!elapsed.value) return "";
  const m = Math.floor(elapsed.value / 60);
  const s = elapsed.value % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
});

const copied = ref(false);
async function copyResponse() {
  if (!allText.value) return;
  await navigator.clipboard.writeText(allText.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}
</script>

<template>
  <!-- User message -->
  <div v-if="isUser" class="border-edge border-b py-5 last:border-b-0">
    <div class="px-5 pb-3">
      <div class="bg-surface-1 inline-block max-w-full px-4 py-2.5">
        <!-- Image attachments -->
        <div v-if="imageAttachments.length" class="mb-2.5 flex flex-wrap gap-2">
          <img
            v-for="(img, i) in imageAttachments"
            :key="i"
            :src="img.data"
            class="max-h-48 max-w-full object-contain"
            :alt="img.filename ?? 'attachment'"
          />
        </div>
        <p v-if="userText" class="text-copy text-primary whitespace-pre-wrap break-words">{{ userText }}</p>
      </div>
    </div>
  </div>

  <!-- Assistant message -->
  <div v-else class="border-edge border-b py-5 last:border-b-0">
    <!-- Working indicator when no blocks yet -->
    <div v-if="isWorking && !blocks.length" class="px-5 py-1">
      <div class="flex items-center gap-1.5">
        <ArrowPathIcon class="text-accent size-4 animate-spin" />
        <span class="text-copy text-secondary">{{ statusText }}</span>
        <span v-if="formattedDuration" class="text-copy text-tertiary font-mono">
          · {{ formattedDuration }}
        </span>
        <OButton
          variant="transparent"
          :icon-left="StopIcon"
          class="ml-auto hover:text-danger"
          title="Stop (Escape)"
          @click.stop="emit('abort')"
        />
      </div>
    </div>

    <!-- Sequential blocks: text and tool groups interleaved -->
    <template v-for="(block, blockIdx) in blocks" :key="block.id">
      <!-- Reasoning block -->
      <div v-if="block.kind === 'reasoning'" class="px-5 py-0.5">
        <OChatReasoning :text="block.text" :state="block.state" />
      </div>

      <!-- Text block -->
      <div v-else-if="block.kind === 'text'" class="group/resp flex items-start gap-1 px-5 py-1">
        <OChatMarkdown class="min-w-0 flex-1" :content="block.text" />
        <OButton
          variant="transparent"
          :icon-left="copied ? CheckIcon : ClipboardIcon"
          class="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover/resp:opacity-100"
          :class="copied ? 'text-accent' : ''"
          @click="copyResponse"
        />
      </div>

      <!-- Tool call group (collapsible) -->
      <OChatToolGroup
        v-else-if="block.kind === 'tools'"
        :tools="block.tools"
        :is-last="blockIdx === blocks.length - 1"
        :is-working="isWorking"
        :status-text="statusText"
        :formatted-duration="formattedDuration"
        @abort="emit('abort')"
      />
    </template>

    <!-- Working indicator when actively streaming after existing blocks -->
    <div v-if="isWorking && blocks.length" class="px-5 py-1">
      <div class="flex items-center gap-1.5">
        <ArrowPathIcon class="text-accent size-4 animate-spin" />
        <span class="text-copy text-secondary">{{ statusText }}</span>
        <span v-if="formattedDuration" class="text-copy text-tertiary font-mono">
          · {{ formattedDuration }}
        </span>
        <OButton
          variant="transparent"
          :icon-left="StopIcon"
          class="ml-auto hover:text-danger"
          title="Stop (Escape)"
          @click.stop="emit('abort')"
        />
      </div>
    </div>
  </div>
</template>
