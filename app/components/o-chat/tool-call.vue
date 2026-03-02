<script setup lang="ts">
import {
  EyeIcon,
  CodeBracketIcon,
  CommandLineIcon,
  MagnifyingGlassIcon,
  DocumentPlusIcon,
  PencilSquareIcon,
  GlobeAltIcon,
  ClipboardDocumentListIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  PlusCircleIcon,
} from "@heroicons/vue/16/solid";

type DynamicToolPart = {
  type: string;
  toolCallId: string;
  state: string;
  input?: any;
  output?: any;
  errorText?: string;
};

type Props = {
  tool: DynamicToolPart;
};

const { tool } = defineProps<Props>();
const expanded = ref(false);

function shortPath(p: string): string {
  if (!p) return "";
  const parts = p.replace(/^\/+/, "").split("/");
  return parts.slice(-2).join("/");
}

/** Shorten a URL to just its hostname + first path segment */
function shortUrl(u: string): string {
  try {
    const parsed = new URL(u);
    const seg = parsed.pathname.split("/").filter(Boolean)[0];
    return seg ? `${parsed.hostname}/${seg}` : parsed.hostname;
  } catch {
    return u.slice(0, 60);
  }
}

type ToolDef = {
  icon: any;
  kind: string;
  /** Returns { label, icon? } — label is the full human-readable description */
  describe: (input: any) => { label: string; icon?: any };
};

const toolDefs: Record<string, ToolDef> = {
  bash: {
    icon: CommandLineIcon,
    kind: "Bash",
    describe: (a) => ({
      label: a?.description || (a?.command || "").split("\n")[0].slice(0, 72) || "Run command",
    }),
  },
  textEditor: {
    icon: PencilSquareIcon,
    kind: "Text Editor",
    describe: (a) => {
      const file = shortPath(a?.path || "");
      switch (a?.command) {
        case "view":   return { label: file ? `View ${file}`   : "View file",   icon: EyeIcon };
        case "create": return { label: file ? `Create ${file}` : "Create file", icon: PlusCircleIcon };
        case "str_replace": return { label: file ? `Edit ${file}`   : "Edit file",   icon: PencilSquareIcon };
        case "insert": return { label: file ? `Insert into ${file}` : "Insert into file", icon: DocumentTextIcon };
        default:       return { label: file ? `Edit ${file}`   : "Edit file" };
      }
    },
  },
  // Anthropic hosted tools use snake_case names
  str_replace_based_edit_tool: {
    icon: PencilSquareIcon,
    kind: "Text Editor",
    describe: (a) => {
      const file = shortPath(a?.path || a?.file_path || "");
      switch (a?.command) {
        case "view":   return { label: file ? `View ${file}`   : "View file",   icon: EyeIcon };
        case "create": return { label: file ? `Create ${file}` : "Create file", icon: PlusCircleIcon };
        case "str_replace": return { label: file ? `Edit ${file}`   : "Edit file" };
        case "insert": return { label: file ? `Insert into ${file}` : "Insert", icon: DocumentTextIcon };
        default:       return { label: file ? `Edit ${file}`   : "Edit file" };
      }
    },
  },
  webSearch: {
    icon: GlobeAltIcon,
    kind: "Web Search",
    describe: (a) => ({ label: a?.query ? `Search: ${a.query}` : "Web search", icon: MagnifyingGlassIcon }),
  },
  webFetch: {
    icon: GlobeAltIcon,
    kind: "Web Fetch",
    describe: (a) => ({ label: a?.url ? `Fetch ${shortUrl(a.url)}` : "Web fetch" }),
  },
  codeExecution: {
    icon: CpuChipIcon,
    kind: "Code",
    describe: () => ({ label: "Run code" }),
  },
  spawnAgent: {
    icon: CpuChipIcon,
    kind: "Agent",
    describe: (a) => ({
      label: a?.description || a?.task
        ? (a.description || a.task).slice(0, 72)
        : "Spawn sub-agent",
    }),
  },
  todowrite: {
    icon: ClipboardDocumentListIcon,
    kind: "Todos",
    describe: () => ({ label: "Update todos" }),
  },
};

// Derive the lookup key by stripping the "tool-" prefix from the type field
// e.g. "tool-bash" → "bash", "tool-textEditor" → "textEditor"
const toolName = computed(() => tool.type.replace(/^tool-/, ""));

const def = computed(() => toolDefs[toolName.value] || {
  icon: CodeBracketIcon,
  // For unknown tools, use the derived name as the kind badge and no label.
  kind: toolName.value,
  describe: () => ({ label: "" }),
});

const described = computed(() => def.value.describe(tool.input));
const activeIcon = computed(() => described.value.icon || def.value.icon);
const kind = computed(() => def.value.kind);
const label = computed(() => described.value.label || "");

const isDone   = computed(() => tool.state === "output-available");
const hasError = computed(() => tool.state === "output-error");
const isPending = computed(() =>
  tool.state === "input-streaming" ||
  tool.state === "input-available" ||
  tool.state === "approval-requested",
);

const output = computed(() => {
  if (!isDone.value) return "";
  const r = tool.output;
  if (!r) return "";
  const text = typeof r === "string" ? r : JSON.stringify(r, null, 2);
  return text.length > 3000 ? text.slice(0, 3000) + "\n... (truncated)" : text;
});
</script>

<template>
  <button
    type="button"
    class="group/tc flex w-full items-center gap-2 px-2 py-1 text-left outline-none transition-colors hover:bg-surface-1/50"
    :class="expanded ? 'bg-surface-1' : ''"
    @click="expanded = !expanded"
  >
    <!-- Tool icon, colour-coded by state -->
    <component
      :is="activeIcon"
      class="size-4 shrink-0"
      :class="{
        'text-tertiary': isDone && !hasError,
        'text-accent':   isPending,
        'text-danger':   hasError,
      }"
    />

    <!-- Tool kind badge -->
    <span class="text-tertiary shrink-0 font-mono text-copy">{{ kind }}</span>

    <!-- Separator + descriptive label (only when label adds info beyond the kind badge) -->
    <template v-if="label">
      <span class="text-tertiary shrink-0 text-copy">·</span>
      <span
        class="text-copy min-w-0 flex-1 truncate"
        :class="{
          'text-secondary': isDone && !hasError,
          'text-primary':   isPending,
          'text-danger':    hasError,
        }"
      >{{ label }}</span>
    </template>
    <span v-else class="flex-1" />

    <!-- Right-side status indicator -->
    <ArrowPathIcon v-if="isPending"            class="text-accent   size-4 shrink-0 animate-spin" />
    <CheckCircleIcon v-else-if="isDone && !hasError" class="text-success size-4 shrink-0" />
    <ExclamationCircleIcon v-else-if="hasError"      class="text-danger  size-4 shrink-0" />

    <ChevronRightIcon
      class="text-tertiary size-4 shrink-0 transition-transform"
      :class="expanded ? 'rotate-90' : ''"
    />
  </button>

  <!-- Expanded detail panel -->
  <div v-if="expanded" class="mb-1 ml-6 mr-2 mt-0.5">
    <div v-if="hasError && tool.errorText" class="text-copy text-danger bg-danger-subtle p-2">
      {{ tool.errorText }}
    </div>
    <pre
      v-else-if="output || (toolName === 'bash' && tool.input?.command)"
      class="bg-terminal text-terminal-text max-h-48 overflow-auto p-2.5 font-mono text-copy leading-relaxed"
    ><template v-if="toolName === 'bash' && tool.input?.command"><span class="text-terminal-dim">$</span> {{ tool.input.command }}
</template>{{ output }}</pre>
    <div v-else-if="isPending" class="text-copy text-tertiary p-2 italic">Running…</div>
    <div v-else class="text-copy text-tertiary p-2 italic">No output</div>
  </div>
</template>
