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
  branch,
  repoName,
  unpushedCount,
  pushing,
  selectFile,
  toggleViewed,
  requestChanges,
  commit,
  push,
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

// Auto-refresh: poll every 5s while a project is open
const projectId = computed(() => (route.params.id as string) || null);

const { pause, resume } = useIntervalFn(() => {
  if (projectId.value && !loading.value) {
    fetchChanges();
  }
}, 5000, { immediate: false });

watch(projectId, (id) => {
  if (id) resume();
  else pause();
}, { immediate: true });

onUnmounted(() => pause());

onKeyStroke("Escape", () => {
  const { commentInputActive } = useChanges();
  if (commentInputActive.value) return;
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
    :branch="branch"
    :repo-name="repoName"
    :unpushed-count="unpushedCount"
    :pushing="pushing"
    @select-file="selectFile"
    @toggle-viewed="toggleViewed"
    @stage-all="stageAll"
    @request-changes="requestChanges"
    @commit="commit($event)"
    @push="push"
    @refresh="fetchChanges"
  />
</template>
