<script setup lang="ts">
import { CommandLineIcon, TrashIcon, XMarkIcon, PencilIcon } from "@heroicons/vue/16/solid";
import { ArrowPathIcon } from "@heroicons/vue/20/solid";

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { data: projectData } = await useFetch(`/api/projects/${projectId.value}`);

const store = useHiveStore();
const { connected, initializing, error, clearChat, closeChat, activeChatTitle, activeChatId, deleteChat, availableChats } = store.project(projectId.value);

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

// Chat name editing
const isEditingName = ref(false);
const editedName = ref("");
const inputRef = useTemplateRef<HTMLInputElement>("nameInput");

function startEditing() {
  if (activeChatTitle.value) {
    editedName.value = activeChatTitle.value;
    isEditingName.value = true;
    nextTick(() => {
      inputRef.value?.focus();
      inputRef.value?.select();
    });
  }
}

function cancelEditing() {
  isEditingName.value = false;
  editedName.value = "";
}

async function saveName() {
  if (editedName.value.trim() && activeChatId.value) {
    // Update the chat title in the availableChats array
    const chatIndex = availableChats.value.findIndex(c => c.id === activeChatId.value);
    if (chatIndex !== -1) {
      availableChats.value[chatIndex] = {
        ...availableChats.value[chatIndex],
        title: editedName.value.trim()
      };
      // Persist to server
      await $fetch(`/api/chats/${activeChatId.value}`, {
        method: "PATCH",
        body: { title: editedName.value.trim() }
      });
    }
  }
  isEditingName.value = false;
}

function handleNameKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    saveName();
  } else if (e.key === "Escape") {
    cancelEditing();
  }
}

// Delete confirmation
const showDeleteConfirm = ref(false);

function confirmDelete() {
  showDeleteConfirm.value = true;
}

async function handleDeleteChat() {
  if (activeChatId.value) {
    await deleteChat(activeChatId.value);
    showDeleteConfirm.value = false;
  }
}
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden">
    <OHeader
      :icon="CommandLineIcon"
      :title="projectData?.name ?? 'Project'"
    >
      <template #leading>
        <div v-if="activeChatTitle" class="flex items-center gap-2">
          <span class="text-tertiary">/</span>
          <div v-if="isEditingName" class="flex items-center gap-1">
            <input
              ref="nameInput"
              v-model="editedName"
              type="text"
              class="h-6 w-[150px] rounded border border-edge bg-base-2 px-2 text-sm text-primary focus:border-primary focus:outline-none"
              @blur="saveName"
              @keydown="handleNameKeydown"
            />
          </div>
          <div v-else class="flex items-center gap-1">
            <span class="truncate text-primary">{{ activeChatTitle }}</span>
            <button
              class="text-tertiary hover:text-primary cursor-pointer"
              title="Rename chat"
              @click="startEditing"
            >
              <PencilIcon class="size-3.5" />
            </button>
          </div>
        </div>
      </template>
      <template #trailing>
        <div v-if="activeChatTitle" class="flex items-center gap-2">
          <OButton
            variant="outline"
            :icon-left="TrashIcon"
            title="Delete current chat"
            class="!h-7"
            @click="confirmDelete"
          />
          <OChatHistory v-if="!initializing && !error" :project-id="projectId" />
        </div>
        <div v-else class="flex items-center gap-2">
          <OChatHistory v-if="!initializing && !error" :project-id="projectId" class="mr-2" />
          <OButton
            variant="outline"
            :icon-left="TrashIcon"
            title="Clear current chat"
            class="!h-7"
            @click="clearChat"
          />
        </div>
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

    <!-- Delete confirmation dialog -->
    <ODialog v-model="showDeleteConfirm" size="md">
      <template #title>Delete Chat</template>
      <template #content>
        <p class="text-secondary">
          Are you sure you want to delete "<strong>{{ activeChatTitle }}</strong>"? This action cannot be undone.
        </p>
      </template>
      <template #cancel>
        <OButton variant="outline" @click="showDeleteConfirm = false">
          Cancel
        </OButton>
      </template>
      <template #submit>
        <OButton variant="danger" @click="handleDeleteChat">
          Delete
        </OButton>
      </template>
    </ODialog>

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
