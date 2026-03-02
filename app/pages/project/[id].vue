<script setup lang="ts">
import { CommandLineIcon, TrashIcon } from "@heroicons/vue/16/solid";
import { ArrowPathIcon } from "@heroicons/vue/20/solid";

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { data: projectData } = await useFetch(`/api/projects/${projectId.value}`);

const store = useHiveStore();
const { connected, initializing, error, modelPreference, clearChat } = store.project(projectId.value);

// Activate on first visit - store handles dedup
onMounted(() => {
  store.activate(projectId.value);
});

function toggleModel() {
  const next = modelPreference.value === "opus" ? "sonnet" : "opus";
  store.setModel(projectId.value, next);
}

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
        <OButton
          variant="outline"
          :icon-left="TrashIcon"
          title="Clear chat history"
          @click="clearChat"
        />
        <OButton
          variant="outline"
          @click="toggleModel"
        >
          {{ modelPreference === "opus" ? "Opus" : "Sonnet" }}
        </OButton>
      </template>
    </OHeader>

    <div v-if="initializing" class="flex flex-1 items-center justify-center gap-2">
      <ArrowPathIcon class="text-tertiary size-4 shrink-0 animate-spin" />
      <span class="text-copy text-tertiary">Connecting...</span>
    </div>

    <div v-else-if="error" class="flex flex-1 items-center justify-center">
      <div class="text-center">
        <p class="text-copy text-danger">{{ error }}</p>
        <OButton
          variant="primary"
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
