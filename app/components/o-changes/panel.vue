<script setup lang="ts">
const {
  files,
  viewedFiles,
  selectedFile,
  comments,
  unresolvedComments,
  loading,
  commitMessage,
  committing,
  commitError,
  selectFile,
  toggleViewed,
  requestChanges,
  commit,
  fetchChanges,
  init,
} = useChanges();

function stageAll() {
  const newSet = new Set(viewedFiles.value);
  for (const f of files.value) {
    newSet.add(f.path);
  }
  viewedFiles.value = newSet;
}

// Initialize on mount
onMounted(() => init());

// Re-initialize when route changes
const route = useRoute();
watch(() => route.params.id, () => init());

// Auto-refresh when agent goes idle
const projectId = computed(() => (route.params.id as string) || null);
const store = useHiveStore();

const agentWorking = computed(() => {
  if (!projectId.value) return false;
  const { isWorking } = store.project(projectId.value);
  return isWorking.value;
});

watch(agentWorking, (working, wasWorking) => {
  if (wasWorking && !working) {
    fetchChanges();
  }
});

// Escape key closes overlay
onKeyStroke("Escape", () => {
  if (selectedFile.value) {
    selectedFile.value = null;
  }
});
</script>

<template>
  <OChangesSidebar
    :files="files"
    :viewed-files="viewedFiles"
    :selected-file="selectedFile"
    :comment-count="unresolvedComments.length"
    :comments="comments"
    :loading="loading"
    :default-commit-message="commitMessage"
    :committing="committing"
    :commit-error="commitError"
    @select-file="selectFile"
    @toggle-viewed="toggleViewed"
    @stage-all="stageAll"
    @request-changes="requestChanges"
    @commit="commit($event)"
    @refresh="fetchChanges"
  />
</template>
