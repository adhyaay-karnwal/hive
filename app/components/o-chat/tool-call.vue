<script setup lang="ts">
import {
  EyeIcon,
  CodeBracketIcon,
  CommandLineIcon,
  MagnifyingGlassIcon,
  DocumentPlusIcon,
  PencilSquareIcon,
  GlobeAltIcon,
  ListBulletIcon,
  ClipboardDocumentListIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
} from "@heroicons/vue/16/solid";
import { ArrowPathIcon } from "@heroicons/vue/16/solid";

type ToolPart = {
  type: string;
  tool: string;
  callID?: string;
  state: {
    status: "pending" | "running" | "completed" | "error";
    input?: any;
    output?: string;
    title?: string;
    metadata?: any;
    error?: string;
    time?: { start?: number; end?: number };
  };
};

type Props = {
  part: ToolPart;
};

const { part } = defineProps<Props>();
const expanded = ref(false);

type ToolDef = {
  icon: any;
  name: string;
  subtitle: (input: any) => string;
};

const toolDefs: Record<string, ToolDef> = {
  read: { icon: EyeIcon, name: "Read", subtitle: (i) => i?.filePath || i?.path || "" },
  edit: { icon: PencilSquareIcon, name: "Edit", subtitle: (i) => i?.filePath || i?.path || "" },
  write: { icon: DocumentPlusIcon, name: "Write", subtitle: (i) => i?.filePath || i?.path || "" },
  bash: { icon: CommandLineIcon, name: "Shell", subtitle: (i) => i?.description || (i?.command || "").slice(0, 80) },
  glob: { icon: MagnifyingGlassIcon, name: "Glob", subtitle: (i) => i?.pattern || "" },
  grep: { icon: MagnifyingGlassIcon, name: "Search", subtitle: (i) => i?.pattern || "" },
  webfetch: { icon: GlobeAltIcon, name: "Fetch", subtitle: (i) => i?.url || "" },
  websearch: { icon: GlobeAltIcon, name: "Web", subtitle: (i) => i?.query || "" },
  codesearch: { icon: MagnifyingGlassIcon, name: "Code Search", subtitle: (i) => i?.query || "" },
  list: { icon: ListBulletIcon, name: "List", subtitle: (i) => i?.path || "" },
  todowrite: { icon: ClipboardDocumentListIcon, name: "Todos", subtitle: () => "" },
  task: { icon: CpuChipIcon, name: "Agent", subtitle: (i) => i?.description || "" },
};

const def = computed(() => toolDefs[part.tool] || { icon: CodeBracketIcon, name: part.tool, subtitle: () => "" });
const subtitle = computed(() => def.value.subtitle(part.state?.input) || part.state?.title || "");

const duration = computed(() => {
  const t = part.state?.time;
  if (!t?.start || !t?.end) return null;
  const ms = t.end - t.start;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
});

const output = computed(() => {
  const o = part.state?.output;
  if (!o) return "";
  return o.length > 3000 ? o.slice(0, 3000) + "\n... (truncated)" : o;
});
</script>

<template>
  <button
    type="button"
    class="group/tc flex w-full items-center gap-2 px-2 py-1 text-left outline-none transition-colors hover:bg-surface-1/50"
    :class="expanded ? 'bg-surface-1' : ''"
    @click="expanded = !expanded"
  >
    <component
      :is="def.icon"
      class="size-4 shrink-0"
      :class="{
        'text-tertiary': part.state?.status === 'completed',
        'text-accent': part.state?.status === 'running' || part.state?.status === 'pending',
        'text-danger': part.state?.status === 'error',
      }"
    />
    <span class="text-copy text-secondary shrink-0">{{ def.name }}</span>
    <span class="text-copy text-tertiary min-w-0 flex-1 truncate font-mono">{{ subtitle }}</span>
    <span v-if="duration" class="text-copy text-tertiary shrink-0 font-mono">{{ duration }}</span>
    <ArrowPathIcon
      v-if="part.state?.status === 'running' || part.state?.status === 'pending'"
      class="text-accent size-4 shrink-0 animate-spin"
    />
    <CheckCircleIcon v-else-if="part.state?.status === 'completed'" class="text-success size-4 shrink-0" />
    <ExclamationCircleIcon v-else-if="part.state?.status === 'error'" class="text-danger size-4 shrink-0" />
    <ChevronRightIcon
      class="text-tertiary size-4 shrink-0 transition-transform"
      :class="expanded ? 'rotate-90' : ''"
    />
  </button>

  <div v-if="expanded" class="mb-1 ml-6 mr-2 mt-0.5">
    <div v-if="part.state?.status === 'error' && part.state?.error" class="text-copy text-danger bg-danger-subtle p-2">
      {{ part.state.error }}
    </div>
    <pre
      v-else-if="output || (part.tool === 'bash' && part.state?.input?.command)"
      class="bg-terminal text-terminal-text max-h-48 overflow-auto p-2.5 font-mono text-copy leading-relaxed"
    ><template v-if="part.tool === 'bash' && part.state?.input?.command"><span class="text-terminal-dim">$</span> {{ part.state.input.command }}
</template>{{ output }}</pre>
    <div v-else class="text-copy text-tertiary p-2 italic">No output</div>
  </div>
</template>
