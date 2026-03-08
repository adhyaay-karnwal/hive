<script setup lang="ts">
import { ChevronDownIcon, TrashIcon, ChatBubbleLeftIcon } from "@heroicons/vue/16/solid";

interface Props {
  projectId: string;
}

const { projectId } = defineProps<Props>();

const store = useHiveStore();
const {
  availableChats,
  activeChatId,
  activeChatTitle,
  switchChat,
  deleteChat,
  createChat
} = store.project(projectId);

const isOpen = ref(false);

function toggle() {
  isOpen.value = !isOpen.value;
}

function close() {
  isOpen.value = false;
}

async function handleSelectChat(chatId: string | null) {
  await switchChat(chatId);
  close();
}

// Delete confirmation state
const showDeleteConfirm = ref(false);
const chatToDelete = ref<{ id: string; title: string } | null>(null);

function promptDeleteChat(chat: { id: string; title: string }, e: Event) {
  e.stopPropagation();
  chatToDelete.value = chat;
  showDeleteConfirm.value = true;
}

async function handleDeleteChat() {
  if (chatToDelete.value) {
    await deleteChat(chatToDelete.value.id);
    showDeleteConfirm.value = false;
    chatToDelete.value = null;
  }
}

// Close dropdown when clicking outside
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.chat-history-dropdown')) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="chat-history-dropdown relative">
    <!-- Toggle Button -->
    <OButton
      variant="outline"
      :icon-left="ChevronDownIcon"
      class="!h-7"
      title="Chat history"
      @click="toggle"
    />

    <!-- Dropdown Panel -->
    <Transition
      enter-active-class="transition ease-out duration-150"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 top-full mt-1 z-50 w-72 overflow-hidden rounded-lg border border-edge bg-base-2 shadow-xl"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-edge px-3 py-2">
          <span class="text-xs font-medium text-tertiary uppercase tracking-wide">Chat History</span>
          <OButton
            variant="transparent"
            :icon-left="ChevronDownIcon"
            class="!h-6 !w-6 rotate-180"
            title="Close"
            @click="close"
          />
        </div>

        <!-- Chat List -->
        <div class="max-h-64 overflow-y-auto py-1">
          <!-- Main Chat (null) -->
          <div
            class="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-base-1"
            :class="{ 'bg-base-1': activeChatId === null }"
            @click="handleSelectChat(null)"
          >
            <ChatBubbleLeftIcon class="size-4 shrink-0 text-tertiary" />
            <span class="flex-1 truncate text-sm text-secondary">Main Chat</span>
          </div>

          <!-- Individual Chats -->
          <div
            v-for="chat in availableChats"
            :key="chat.id"
            class="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-base-1 group/chat"
            :class="{ 'bg-base-1': activeChatId === chat.id }"
            @click="handleSelectChat(chat.id)"
          >
            <ChatBubbleLeftIcon 
              class="size-4 shrink-0" 
              :class="activeChatId === chat.id ? 'text-primary' : 'text-tertiary'" 
            />
            <span 
              class="flex-1 truncate text-sm"
              :class="activeChatId === chat.id ? 'text-primary font-medium' : 'text-secondary'"
            >
              {{ chat.title }}
            </span>
            <button
              class="opacity-0 group-hover/chat:opacity-100 p-1 rounded hover:bg-surface-2 transition-opacity"
              title="Delete chat"
              @click="promptDeleteChat(chat, $event)"
            >
              <TrashIcon class="size-3.5 text-tertiary hover:text-danger" />
            </button>
          </div>

          <!-- Empty state -->
          <div
            v-if="!availableChats.length"
            class="px-3 py-4 text-center text-xs text-tertiary"
          >
            No saved chats yet
          </div>
        </div>

        <!-- Footer with New Chat button -->
        <div class="border-t border-edge px-3 py-2">
          <OButton
            variant="primary"
            class="w-full justify-center"
            @click="createChat()"
          >
            New Chat
          </OButton>
        </div>
      </div>
    </Transition>

    <!-- Delete confirmation dialog -->
    <ODialog v-model="showDeleteConfirm" size="md">
      <template #title>Delete Chat</template>
      <template #content>
        <p class="text-secondary">
          Are you sure you want to delete "<strong>{{ chatToDelete?.title }}</strong>"? This action cannot be undone.
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
  </div>
</template>
