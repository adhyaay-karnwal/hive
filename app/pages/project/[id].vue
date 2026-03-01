<script setup lang="ts">
import { CommandLineIcon } from "@heroicons/vue/16/solid";
import { ArrowPathIcon } from "@heroicons/vue/20/solid";

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { data: projectData } = useFetch(`/api/projects/${projectId.value}`);

const store = useHiveStore();
const { connected, initializing, error, port } = store.project(projectId.value);

// Activate on first visit - store handles dedup
onMounted(() => {
  store.activate(projectId.value);
});

// Changes overlay state (shared with OChangesPanel via composable)
const {
  selectedFile,
  selectedFileDiff,
  selectedFileContent,
  loadingFileContent,
  selectedFileComments,
  viewedFiles,
  closeOverlay,
  addComment,
  deleteComment,
  updateComment,
  markViewedAndNext,
} = useChanges();

const isSelectedFileViewed = computed(() =>
  selectedFile.value ? viewedFiles.value.has(selectedFile.value) : false,
);
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden">
    <OHeader
      :icon="CommandLineIcon"
      :title="projectData?.name ?? 'Project'"
    >
      <template #trailing>
        <span
          v-if="projectData?.pkgManager"
          class="bg-surface-1 border-edge text-copy-sm text-secondary border px-2 py-0.5"
        >
          {{ projectData.pkgManager }}
        </span>
        <span v-if="port" class="text-copy-xs text-tertiary font-mono">
          :{{ port }}
        </span>
      </template>
    </OHeader>

    <div v-if="initializing" class="flex flex-1 items-center justify-center gap-2">
      <ArrowPathIcon class="text-tertiary size-4 animate-spin" />
      <span class="text-copy text-tertiary">Starting agent...</span>
    </div>

    <div v-else-if="error" class="flex flex-1 items-center justify-center">
      <div class="text-center">
        <p class="text-copy text-danger">{{ error }}</p>
        <OButton
          variant="primary"
          size="md"
          class="mt-3"
          @click="store.activate(projectId)"
        >
          Retry
        </OButton>
      </div>
    </div>

    <OChat
      v-else
      :project-id="projectId"
      placeholder="Chat with the main agent..."
    />

    <!-- Diff overlay — covers the main content area when a file is selected -->
    <OChangesOverlay
      v-if="selectedFile"
      :file-path="selectedFile"
      :file-diff="selectedFileDiff"
      :file-content="selectedFileContent"
      :loading-content="loadingFileContent"
      :comments="selectedFileComments"
      :viewed="isSelectedFileViewed"
      @close="closeOverlay"
      @toggle-viewed="markViewedAndNext(selectedFile!)"
      @add-comment="addComment($event)"
      @delete-comment="deleteComment($event)"
      @update-comment="(id: string, content: string) => updateComment(id, content)"
    />
  </div>
</template>
