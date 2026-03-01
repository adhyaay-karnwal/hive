<script setup lang="ts">
import {
  ChevronDownIcon,
  ClipboardIcon,
  CheckIcon,
  StopIcon,
} from "@heroicons/vue/16/solid";
import { ArrowPathIcon } from "@heroicons/vue/20/solid";

type Part = {
  type: string;
  id?: string;
  text?: string;
  tool?: string;
  callID?: string;
  state?: any;
  [key: string]: any;
};

type Message = {
  info: {
    role: "user" | "assistant";
    id: string;
    sessionID: string;
    time?: { created: number };
    modelID?: string;
    providerID?: string;
    agent?: string;
    [key: string]: any;
  };
  parts: Part[];
};

type Props = {
  userMessage: Message;
  assistantMessages: Message[];
  isWorking?: boolean;
};

type Emits = {
  abort: [];
};

type RenderBlock =
  | { kind: "text"; text: string; id: string }
  | { kind: "tools"; tools: Part[]; id: string };

const { userMessage, assistantMessages, isWorking = false } = defineProps<Props>();
const emit = defineEmits<Emits>();

const userText = computed(() => {
  return userMessage.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("\n");
});

// Build sequential render blocks from all assistant messages.
// Consecutive tool calls are grouped into a single collapsible block.
// Text parts are individual blocks between tool groups.
const blocks = computed<RenderBlock[]>(() => {
  const result: RenderBlock[] = [];

  for (const msg of assistantMessages) {
    for (const part of msg.parts) {
      if (part.type === "text" && part.text) {
        result.push({ kind: "text", text: part.text, id: part.id || `text-${msg.info.id}-${result.length}` });
      } else if (part.type === "tool") {
        const last = result[result.length - 1];
        if (last?.kind === "tools") {
          last.tools.push(part);
        } else {
          result.push({ kind: "tools", tools: [part], id: part.callID || `tools-${msg.info.id}-${result.length}` });
        }
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

const totalToolCount = computed(() =>
  blocks.value.reduce((n, b) => n + (b.kind === "tools" ? b.tools.length : 0), 0),
);

const statusText = computed(() => {
  if (!isWorking) return "";
  for (let i = assistantMessages.length - 1; i >= 0; i--) {
    for (let j = assistantMessages[i].parts.length - 1; j >= 0; j--) {
      const part = assistantMessages[i].parts[j];
      if (part.type === "tool") {
        switch (part.tool) {
          case "read": return "Gathering context";
          case "glob": case "grep": case "codesearch": return "Searching codebase";
          case "edit": case "write": return "Making edits";
          case "bash": return "Running command";
          case "webfetch": case "websearch": return "Searching the web";
          case "task": return "Delegating work";
          case "todowrite": return "Planning";
          default: return "Working";
        }
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
  <div class="border-edge border-b py-5 last:border-b-0">
    <!-- User message -->
    <div class="px-5 pb-3">
        <div class="bg-surface-1 inline-block max-w-full px-4 py-2.5">
        <p class="text-copy text-primary whitespace-pre-wrap break-words">{{ userText }}</p>
      </div>
    </div>

    <!-- Working indicator -->
    <div v-if="isWorking && !blocks.length" class="px-5 py-1">
      <div class="flex items-center gap-1.5">
        <ArrowPathIcon class="text-accent size-3.5 animate-spin" />
        <span class="text-copy-sm text-secondary">{{ statusText }}</span>
        <span v-if="formattedDuration" class="text-copy-sm text-tertiary font-mono">
          · {{ formattedDuration }}
        </span>
        <button
          type="button"
          class="text-tertiary hover:text-danger ml-auto grid size-5 place-items-center transition-colors"
          title="Stop (Escape)"
          @click.stop="emit('abort')"
        >
          <StopIcon class="size-3" />
        </button>
      </div>
    </div>

    <!-- Sequential blocks: text and tool groups interleaved -->
    <template v-for="(block, blockIdx) in blocks" :key="block.id">
      <!-- Text block -->
      <div v-if="block.kind === 'text'" class="group/resp relative px-5 py-1">
        <button
          type="button"
          class="absolute top-1 right-5 grid size-6 place-items-center opacity-0 transition-opacity outline-none group-hover/resp:opacity-100"
          :class="copied ? 'text-accent' : 'text-tertiary hover:text-secondary'"
          @click="copyResponse"
        >
          <component :is="copied ? CheckIcon : ClipboardIcon" class="size-3.5" />
        </button>
        <OChatMarkdown :content="block.text" />
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
        <ArrowPathIcon class="text-accent size-3.5 animate-spin" />
        <span class="text-copy-sm text-secondary">{{ statusText }}</span>
        <span v-if="formattedDuration" class="text-copy-sm text-tertiary font-mono">
          · {{ formattedDuration }}
        </span>
        <button
          type="button"
          class="text-tertiary hover:text-danger ml-auto grid size-5 place-items-center transition-colors"
          title="Stop (Escape)"
          @click.stop="emit('abort')"
        >
          <StopIcon class="size-3" />
        </button>
      </div>
    </div>
  </div>
</template>
