<script setup lang="ts">
import {
  ArrowPathIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  PlusIcon,
  DocumentIcon,
  ChevronDoubleDownIcon,
} from "@heroicons/vue/16/solid";

type ChangedFile = {
  path: string;
  status: string;
};

type ChangeComment = {
  id: string;
  filePath: string;
  resolved: boolean;
};

type Props = {
  files: ChangedFile[];
  viewedFiles: Set<string>;
  selectedFile: string | null;
  commentCount: number;
  comments: ChangeComment[];
  loading: boolean;
  defaultCommitMessage: string;
  committing: boolean;
  commitError: string | null;
};

type Emits = {
  "select-file": [path: string];
  "toggle-viewed": [path: string];
  "stage-all": [];
  "request-changes": [];
  "commit": [message: string];
  refresh: [];
};

const {
  files,
  viewedFiles,
  selectedFile = null,
  commentCount = 0,
  comments = [],
  loading = false,
  defaultCommitMessage = "",
  committing = false,
  commitError = null,
} = defineProps<Props>();

const emit = defineEmits<Emits>();

// Count unresolved comments per file
const commentsByFile = computed(() => {
  const map = new Map<string, number>();
  for (const c of comments) {
    if (!c.resolved) {
      map.set(c.filePath, (map.get(c.filePath) || 0) + 1);
    }
  }
  return map;
});

const showCommitForm = ref(false);
const commitMessageInput = ref("");

function openCommitForm() {
  commitMessageInput.value = defaultCommitMessage;
  showCommitForm.value = true;
}

function cancelCommit() {
  showCommitForm.value = false;
  commitMessageInput.value = "";
}

function handleCommit() {
  if (!commitMessageInput.value.trim()) return;
  emit("commit", commitMessageInput.value.trim());
}

// Close form after successful commit (files list becomes empty)
watch(() => files.length, (len, prevLen) => {
  if (prevLen > 0 && len === 0 && showCommitForm.value) {
    showCommitForm.value = false;
    commitMessageInput.value = "";
  }
});

const unstagedFiles = computed(() =>
  files.filter((f) => !viewedFiles.has(f.path)),
);

const stagedFiles = computed(() =>
  files.filter((f) => viewedFiles.has(f.path)),
);

const allViewed = computed(
  () => files.length > 0 && stagedFiles.value.length === files.length,
);

const statusLabels: Record<string, string> = {
  M: "Modified",
  A: "Added",
  D: "Deleted",
  R: "Renamed",
  "?": "Untracked",
};

const statusColors: Record<string, string> = {
  M: "text-accent",
  A: "text-success",
  D: "text-danger",
  R: "text-warn",
  "?": "text-tertiary",
};
</script>

<template>
  <div class="flex h-full flex-col">
    <OHeader title="Changes" borderless>
      <template #trailing>
        <span
          v-if="files.length"
          class="text-copy-xs text-tertiary"
        >
          {{ stagedFiles.length }}/{{ files.length }}
        </span>
        <button
          type="button"
           class="text-tertiary hover:text-primary grid size-6 place-items-center outline-none"
          title="Refresh"
          @click="emit('refresh')"
        >
          <ArrowPathIcon class="size-3.5" :class="loading ? 'animate-spin' : ''" />
        </button>
      </template>
    </OHeader>

    <div class="flex-1 overflow-auto p-1.5">
      <div
        v-if="!files.length && !loading"
        class="text-copy-sm text-tertiary px-2 py-4 text-center"
      >
        No changes
      </div>

      <div
        v-if="loading && !files.length"
        class="text-copy-sm text-tertiary flex items-center justify-center gap-2 px-2 py-4"
      >
        <ArrowPathIcon class="size-3.5 animate-spin" />
        Loading...
      </div>

      <template v-if="files.length">
        <!-- Unstaged files -->
        <div v-if="unstagedFiles.length">
          <div class="mb-1 flex items-center justify-between px-2">
            <p class="text-copy-xs text-tertiary font-medium uppercase">
              Unstaged ({{ unstagedFiles.length }})
            </p>
            <button
              type="button"
              class="text-tertiary hover:text-accent flex items-center gap-0.5 outline-none"
              title="Stage all"
              @click="emit('stage-all')"
            >
              <CheckIcon class="size-3" />
              <span class="text-copy-xs">All</span>
            </button>
          </div>
          <div class="flex flex-col gap-0.5">
            <OHover
              v-for="file in unstagedFiles"
              :key="file.path"
              :active="selectedFile === file.path"
              full-width
              class="group/file cursor-default"
            >
              <div class="flex w-full items-center gap-1 px-1.5 py-1">
                <button
                  type="button"
                  class="grid size-4 shrink-0 place-items-center outline-none"
                  title="Mark as viewed"
                  @click.stop="emit('toggle-viewed', file.path)"
                >
                  <DocumentIcon class="text-tertiary size-3 group-hover/file:hidden" />
                  <PlusIcon class="text-accent size-3 hidden group-hover/file:block" />
                </button>
                <button
                  type="button"
                  class="text-copy-sm text-primary min-w-0 flex-1 truncate text-left outline-none"
                  @click="emit('select-file', file.path)"
                >
                  {{ file.path.split("/").pop() }}
                </button>
                <ChatBubbleLeftIcon
                  v-if="commentsByFile.get(file.path)"
                  class="text-accent size-3 shrink-0"
                  :title="`${commentsByFile.get(file.path)} comment${commentsByFile.get(file.path)! > 1 ? 's' : ''}`"
                />
                <span
                  class="text-copy-xs shrink-0 font-mono"
                  :class="statusColors[file.status] || 'text-tertiary'"
                  :title="statusLabels[file.status] || file.status"
                >
                  {{ file.status }}
                </span>
              </div>
            </OHover>
          </div>
        </div>

        <!-- Staged / Viewed files -->
        <div v-if="stagedFiles.length" :class="unstagedFiles.length ? 'mt-3' : ''">
          <p class="text-copy-xs text-tertiary mb-1 px-2 font-medium uppercase">
            Viewed ({{ stagedFiles.length }})
          </p>
          <div class="flex flex-col gap-0.5">
            <OHover
              v-for="file in stagedFiles"
              :key="file.path"
              :active="selectedFile === file.path"
              full-width
              class="cursor-default"
            >
              <div class="flex w-full items-center gap-1 px-1.5 py-1">
                <button
                  type="button"
                  class="text-accent hover:text-primary grid size-4 shrink-0 place-items-center outline-none"
                  title="Mark as unviewed"
                  @click.stop="emit('toggle-viewed', file.path)"
                >
                  <CheckIcon class="size-3" />
                </button>
                <button
                  type="button"
                  class="text-copy-sm text-tertiary min-w-0 flex-1 truncate text-left outline-none"
                  @click="emit('select-file', file.path)"
                >
                  {{ file.path.split("/").pop() }}
                </button>
                <ChatBubbleLeftIcon
                  v-if="commentsByFile.get(file.path)"
                  class="text-accent size-3 shrink-0 opacity-50"
                  :title="`${commentsByFile.get(file.path)} comment${commentsByFile.get(file.path)! > 1 ? 's' : ''}`"
                />
                <span
                  class="text-copy-xs shrink-0 font-mono opacity-50"
                  :class="statusColors[file.status] || 'text-tertiary'"
                >
                  {{ file.status }}
                </span>
              </div>
            </OHover>
          </div>
        </div>
      </template>
    </div>

    <!-- Review actions -->
    <div v-if="files.length" class="border-edge flex flex-col gap-1.5 border-t p-2">
      <!-- Comment count + request changes -->
      <div v-if="commentCount && !showCommitForm" class="text-copy-xs text-tertiary flex items-center gap-1 px-0.5">
        <ChatBubbleLeftIcon class="size-3" />
        {{ commentCount }} comment{{ commentCount !== 1 ? "s" : "" }} pending
      </div>
      <OButton
        v-if="commentCount && !showCommitForm"
        variant="primary"
        size="md"
        class="w-full"
        @click="emit('request-changes')"
      >
        Request Changes
      </OButton>

      <!-- Approve & Commit button (shows commit form on click) -->
      <OButton
        v-if="!showCommitForm"
        variant="transparent"
        size="md"
        class="w-full"
        :icon-left="CheckCircleIcon"
        :disabled="!allViewed"
        :title="allViewed ? 'Approve & commit changes' : 'Review all files first'"
        @click="openCommitForm"
      >
        Approve & Commit
      </OButton>

      <!-- Inline commit form -->
      <div v-if="showCommitForm" class="flex flex-col gap-1.5">
        <textarea
          v-model="commitMessageInput"
          class="text-copy-sm text-primary bg-surface-1 border-edge w-full resize-none border p-2 outline-none focus:border-edge-strong"
          rows="4"
          placeholder="Commit message..."
          :disabled="committing"
          @keydown.enter.meta.prevent="handleCommit"
          @keydown.escape.prevent="cancelCommit"
        />
        <p v-if="commitError" class="text-copy-xs text-danger px-0.5">
          {{ commitError }}
        </p>
        <div class="flex gap-1.5">
          <OButton
            variant="transparent"
            size="sm"
            class="flex-1"
            :disabled="committing"
            @click="cancelCommit"
          >
            Cancel
          </OButton>
          <OButton
            variant="primary"
            size="sm"
            class="flex-1"
            :disabled="!commitMessageInput.trim() || committing"
            :loading="committing"
            @click="handleCommit"
          >
            Commit
          </OButton>
        </div>
      </div>
    </div>
  </div>
</template>
