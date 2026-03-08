<script setup lang="ts">
import { PlusIcon, XMarkIcon, ChatBubbleLeftIcon } from "@heroicons/vue/16/solid";

interface Props {
  projectId: string;
}

const { projectId } = defineProps<Props>();

const store = useHiveStore();
const {
  availableChats,
  activeChatId,
  switchChat,
  createChat,
  deleteChat
} = store.project(projectId);

async function handleCreateChat() {
  await createChat();
}

function handleSwitchChat(chatId: string | null) {
  switchChat(chatId);
}

function handleDeleteChat(chatId: string, e: Event) {
  e.stopPropagation();
  deleteChat(chatId);
}
</script>

<template>
  <div class="flex items-center gap-1 overflow-x-auto px-4 py-2 border-b border-edge bg-base-1 no-scrollbar">
    <!-- Default/History Chat Tab (Legacy/Null Chat) -->
    <OHover
      :active="activeChatId === null"
      class="cursor-default shrink-0"
    >
      <div
        class="flex items-center gap-2 px-3 py-1 rounded-md transition-colors"
        @click="handleSwitchChat(null)"
      >
        <ChatBubbleLeftIcon class="size-3.5" :class="activeChatId === null ? 'text-primary' : 'text-tertiary'" />
        <span
          class="text-copy text-xs font-medium truncate max-w-[100px]"
          :class="activeChatId === null ? 'text-primary' : 'text-tertiary'"
        >
          Main Chat
        </span>
      </div>
    </OHover>

    <!-- Project Chats -->
    <OHover
      v-for="chat in availableChats"
      :key="chat.id"
      :active="activeChatId === chat.id"
      class="cursor-default shrink-0 group/tab"
    >
      <div
        class="flex items-center gap-2 px-3 py-1 rounded-md transition-colors"
        @click="handleSwitchChat(chat.id)"
      >
        <ChatBubbleLeftIcon class="size-3.5" :class="activeChatId === chat.id ? 'text-primary' : 'text-tertiary'" />
        <span
          class="text-copy text-xs font-medium truncate max-w-[120px]"
          :class="activeChatId === chat.id ? 'text-primary' : 'text-tertiary'"
        >
          {{ chat.title }}
        </span>
        <button
          class="p-0.5 rounded-full hover:bg-surface-2 opacity-0 group-hover/tab:opacity-100 transition-opacity"
          @click="handleDeleteChat(chat.id, $event)"
        >
          <XMarkIcon class="size-3 text-tertiary hover:text-danger" />
        </button>
      </div>
    </OHover>

    <!-- New Chat Button -->
    <OButton
      variant="transparent"
      :icon-left="PlusIcon"
      class="!h-7 !w-7 shrink-0"
      title="New Chat"
      @click="handleCreateChat"
    />
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
