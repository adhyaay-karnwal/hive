<script setup lang="ts">
import { CommandLineIcon, TrashIcon, PlusIcon, XMarkIcon } from "@heroicons/vue/16/solid";
import { ArrowPathIcon } from "@heroicons/vue/20/solid";

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { data: projectData } = await useFetch(`/api/projects/${projectId.value}`);

const store = useHiveStore();
const {
  connected,
  initializing,
  error,
  clearChat,
  sessions,
  activeSessionId,
  switchSession,
  deleteSession,
  createNewSession
} = store.project(projectId.value);

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
      borderless
    >
      <template #leading>
        <div class="ml-4 flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          <div
            v-for="session in sessions"
            :key="session.id"
            class="group relative flex shrink-0 items-center"
          >
            <OHover
              :active="activeSessionId === session.id"
              class="cursor-default"
            >
              <button
                class="text-copy max-w-32 truncate whitespace-nowrap py-1 pl-2.5 pr-2 outline-none"
                :class="activeSessionId === session.id ? 'text-primary' : 'text-tertiary'"
                @click="switchSession(session.id)"
              >
                {{ session.title }}
              </button>
            </OHover>
            <button
              v-if="sessions.length > 1"
              class="absolute -right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hover:text-danger"
              @click.stop="deleteSession(session.id)"
            >
              <XMarkIcon class="size-3" />
            </button>
            <div class="w-3" v-if="sessions.length > 1" />
          </div>
          <OButton
            variant="transparent"
            :icon-left="PlusIcon"
            title="New chat"
            @click="createNewSession()"
          />
        </div>
      </template>
      <template #trailing>
        <OButton
          variant="outline"
          :icon-left="TrashIcon"
          title="Clear chat history"
          @click="clearChat"
        />
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
