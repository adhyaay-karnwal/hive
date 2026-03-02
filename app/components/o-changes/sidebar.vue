<script setup lang="ts">
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
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
  branch: string;
  repoName: string;
  unpushedCount: number;
  pushing: boolean;
};

type Emits = {
  "select-file": [path: string];
  "toggle-viewed": [path: string];
  "stage-all": [];
  "request-changes": [];
  "commit": [message: string];
  "push": [];
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
  branch = "",
  repoName = "",
  unpushedCount = 0,
  pushing = false,
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
    <OHeader title="Changes">
      <template #trailing>
        <span
          v-if="files.length"
          class="text-copy text-tertiary"
        >
          {{ stagedFiles.length }}/{{ files.length }}
        </span>
        <OButton
          variant="transparent"
         
          :icon-left="ArrowPathIcon"
          :class="loading ? '[&_svg]:animate-spin' : ''"
          title="Refresh"
          @click="emit('refresh')"
        />
      </template>
    </OHeader>

    <div class="flex-1 overflow-auto p-1.5">
      <div
        v-if="!files.length && !loading"
        class="text-copy text-tertiary px-2 py-4 text-center"
        >
          No changes
        </div>

      <div
        v-if="loading && !files.length"
        class="text-copy text-tertiary flex items-center justify-center gap-2 px-2 py-4"
      >
        <ArrowPathIcon class="size-4 animate-spin" />
        Loading...
      </div>

      <template v-if="files.length">
        <!-- Unstaged files -->
        <div v-if="unstagedFiles.length">
          <div class="mb-1 flex items-center justify-between px-2">
            <p class="text-copy text-tertiary">
              Unstaged ({{ unstagedFiles.length }})
            </p>
            <OButton
              variant="transparent"
              :icon-left="CheckIcon"
              title="Stage all"
              class="-mr-2"
              @click="emit('stage-all')"
            >
              All
            </OButton>
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
                  class="grid size-6 shrink-0 place-items-center outline-none"
                  title="Mark as viewed"
                  @click.stop="emit('toggle-viewed', file.path)"
                >
                  <DocumentIcon class="text-tertiary size-4 group-hover/file:text-accent" />
                </button>
                <button
                  type="button"
                  class="text-copy text-primary min-w-0 flex-1 truncate text-left outline-none"
                  @click="emit('select-file', file.path)"
                >
                  {{ file.path.split("/").pop() }}
                </button>
                <ChatBubbleLeftIcon
                  v-if="commentsByFile.get(file.path)"
                  class="text-accent size-4 shrink-0"
                  :title="`${commentsByFile.get(file.path)} comment${commentsByFile.get(file.path)! > 1 ? 's' : ''}`"
                />
                <span
                  class="text-copy shrink-0 font-mono"
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
          <p class="text-copy text-tertiary mb-1 px-2">
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
                  class="grid size-6 shrink-0 place-items-center outline-none"
                  title="Mark as unviewed"
                  @click.stop="emit('toggle-viewed', file.path)"
                >
                  <CheckIcon class="text-accent size-4 hover:text-primary" />
                </button>
                <button
                  type="button"
                  class="text-copy text-tertiary min-w-0 flex-1 truncate text-left outline-none"
                  @click="emit('select-file', file.path)"
                >
                  {{ file.path.split("/").pop() }}
                </button>
                <ChatBubbleLeftIcon
                  v-if="commentsByFile.get(file.path)"
                  class="text-accent size-4 shrink-0 opacity-50"
                  :title="`${commentsByFile.get(file.path)} comment${commentsByFile.get(file.path)! > 1 ? 's' : ''}`"
                />
                <span
                  class="text-copy shrink-0 font-mono opacity-50"
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
    <div v-if="files.length || commentCount" class="border-edge flex flex-col gap-1.5 border-t p-2">
      <!-- Comment count + request changes -->
      <div v-if="commentCount && !showCommitForm" class="text-copy text-tertiary flex items-center gap-1 px-0.5">
        <ChatBubbleLeftIcon class="size-4" />
        {{ commentCount }} comment{{ commentCount !== 1 ? "s" : "" }} pending
      </div>
      <OButton
        v-if="commentCount && !showCommitForm"
        variant="primary"
       
        class="w-full"
        @click="emit('request-changes')"
      >
        Request Changes
      </OButton>

      <!-- Approve & Commit button (shows commit form on click) -->
      <OButton
        v-if="!showCommitForm"
        variant="transparent"
       
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
          class="text-copy text-primary bg-surface-1 border-edge w-full resize-none border p-2 outline-none focus:border-edge-strong"
          rows="4"
          placeholder="Commit message..."
          :disabled="committing"
          @keydown.enter.meta.prevent="handleCommit"
          @keydown.escape.prevent="cancelCommit"
        />
        <p v-if="commitError" class="text-copy text-danger px-0.5">
          {{ commitError }}
        </p>
        <div class="flex gap-1.5">
          <OButton
            variant="transparent"
           
            class="flex-1"
            :disabled="committing"
            @click="cancelCommit"
          >
            Cancel
          </OButton>
          <OButton
            variant="primary"
           
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
    <!-- Push button -->
    <div v-if="unpushedCount > 0" class="border-edge border-t p-2">
      <OButton
        variant="transparent"
        class="w-full"
        :icon-left="ArrowUpTrayIcon"
        :loading="pushing"
        :disabled="pushing"
        @click="emit('push')"
      >
        Push {{ unpushedCount }} commit{{ unpushedCount !== 1 ? "s" : "" }}
      </OButton>
    </div>
    <!-- Repo + branch status bar -->
    <div v-if="repoName || branch" class="border-edge text-copy text-tertiary break-all border-t px-3 py-1.5 font-mono">
      <span v-if="repoName" class="text-primary">{{ repoName }}</span><span v-if="repoName && branch" class="opacity-40"> / </span><span v-if="branch" class="font-medium">{{ branch }}</span>
    </div>
  </div>
</template>
