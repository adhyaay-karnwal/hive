<script setup lang="ts">
import { XMarkIcon, CheckIcon } from "@heroicons/vue/16/solid";
import { ArrowPathIcon } from "@heroicons/vue/20/solid";

type Props = {
  filePath: string;
  fileDiff: any | null;
  fileContent: string | null;
  loadingContent: boolean;
  comments: any[];
  viewed: boolean;
};

type Emits = {
  close: [];
  "toggle-viewed": [];
  "add-comment": [comment: {
    filePath: string;
    startLine: number;
    endLine: number;
    side?: "additions" | "deletions";
    content: string;
  }];
  "delete-comment": [commentId: string];
  "update-comment": [commentId: string, content: string];
};

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const hasDiff = computed(() => !!props.fileDiff);
const hasContent = computed(() => props.fileContent !== null);

const totalAdditions = computed(() => {
  if (!props.fileDiff?.hunks) return 0;
  return props.fileDiff.hunks.reduce((n: number, h: any) => n + (h.additionLines ?? 0), 0);
});
const totalDeletions = computed(() => {
  if (!props.fileDiff?.hunks) return 0;
  return props.fileDiff.hunks.reduce((n: number, h: any) => n + (h.deletionLines ?? 0), 0);
});
</script>

<template>
  <div class="bg-base-1 absolute inset-0 z-10 flex flex-col overflow-hidden">
    <!-- File header -->
    <div class="border-edge flex h-10 shrink-0 items-center justify-between border-b px-3">
      <div class="flex min-w-0 items-center gap-2">
        <span class="text-copy-sm text-primary truncate font-mono">
          {{ props.filePath }}
        </span>
        <span
          v-if="!hasDiff && hasContent"
          class="text-copy-xs text-tertiary shrink-0 rounded bg-surface-1 px-1.5 py-0.5"
        >
          new file
        </span>
        <span v-if="totalDeletions" class="text-copy-xs shrink-0 font-mono" style="color: var(--diff-deletion-base, #ff2e3f)">
          -{{ totalDeletions }}
        </span>
        <span v-if="totalAdditions" class="text-copy-xs shrink-0 font-mono" style="color: var(--diff-addition-base, #00cab1)">
          +{{ totalAdditions }}
        </span>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <!-- Viewed toggle -->
        <button
          type="button"
          class="bg-surface-1 text-primary hover:bg-surface-2 border-edge flex h-7 items-center gap-2 rounded-md border px-3 text-sm shadow-xs outline-none active:bg-surface-3"
          @click="emit('toggle-viewed')"
        >
           <div
            class="grid size-3.5 shrink-0 place-items-center rounded border"
            :class="props.viewed ? 'bg-accent border-accent' : 'border-edge-strong'"
          >
            <CheckIcon v-if="props.viewed" class="size-2.5 text-white" />
          </div>
          Viewed
        </button>

        <!-- Close button -->
        <button
          type="button"
          class="text-tertiary hover:text-primary grid size-6 place-items-center rounded outline-none"
          title="Close (Escape)"
          @click="emit('close')"
        >
          <XMarkIcon class="size-4" />
        </button>
      </div>
    </div>

    <!-- Content area -->
    <div class="flex-1 overflow-auto">
      <OChangesDiffViewer
        v-if="hasDiff"
        :file-diff="props.fileDiff"
        :file-path="props.filePath"
        :comments="props.comments"
        @add-comment="emit('add-comment', $event)"
        @delete-comment="emit('delete-comment', $event)"
        @update-comment="(id: string, content: string) => emit('update-comment', id, content)"
      />

      <OChangesFileViewer
        v-else-if="hasContent"
        :content="props.fileContent!"
        :file-path="props.filePath"
      />

      <div
        v-else-if="props.loadingContent"
        class="flex h-full items-center justify-center gap-2"
      >
        <ArrowPathIcon class="text-tertiary size-4 animate-spin" />
        <span class="text-copy-sm text-tertiary">Loading file...</span>
      </div>

      <div v-else class="text-copy-sm text-tertiary flex h-full items-center justify-center">
        No content available
      </div>
    </div>
  </div>
</template>
