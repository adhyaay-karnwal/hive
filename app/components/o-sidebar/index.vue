<script setup lang="ts">
import {
  CodeBracketIcon,
  FolderIcon,
  BellAlertIcon,
  PlusIcon,
} from "@heroicons/vue/16/solid";

const route = useRoute();
const projectId = computed(() => {
  if (route.params.id) return route.params.id as string;
  return null;
});

type SidebarView = "worktrees" | "files";
const activeView = useLocalStorage<SidebarView>("hive:sidebar-view", "worktrees");

const { tree, collapsedPaths, toggleFolder, initCollapsed } = useFileTree();
const { selectedFile, selectFile } = useChanges();

watch(tree, (nodes) => {
  if (nodes.length) initCollapsed(nodes);
}, { immediate: true });

const { data: worktreeList, refresh: refreshWorktrees } = await useFetch(
  "/api/worktrees",
  {
    query: { projectId },
    watch: [projectId],
    default: () => [],
  },
);

const { data: pendingSignals, refresh: refreshSignals } = await useFetch(
  "/api/signals",
  {
    query: { pending: "true" },
    default: () => [],
  },
);

let signalPoll: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  signalPoll = setInterval(() => refreshSignals(), 3000);
});
onUnmounted(() => {
  if (signalPoll) clearInterval(signalPoll);
});

async function resolveSignal(signalId: string, answer: string) {
  await $fetch(`/api/signals/${signalId}`, {
    method: "POST",
    body: { answer },
  });
  await refreshSignals();
}

const showNewBranch = ref(false);
const newBranchName = ref("");
const creating = ref(false);

async function createNewWorktree() {
  if (!newBranchName.value || !projectId.value) return;

  creating.value = true;
  try {
    await $fetch("/api/worktrees", {
      method: "POST",
      body: {
        projectId: projectId.value,
        branchName: newBranchName.value,
      },
    });
    newBranchName.value = "";
    showNewBranch.value = false;
    await refreshWorktrees();
  } catch (e: any) {
    console.error("Failed to create worktree:", e);
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <OHeader>
      <template #leading>
        <div class="flex items-center gap-0.5">
          <OButton
            variant="transparent"
            :icon-left="CodeBracketIcon"
            title="Worktrees"
            :class="activeView === 'worktrees' ? 'text-primary' : 'text-tertiary'"
            @click="activeView = 'worktrees'"
          />
          <OButton
            variant="transparent"
            :icon-left="FolderIcon"
            title="File tree"
            :class="activeView === 'files' ? 'text-primary' : 'text-tertiary'"
            @click="activeView = 'files'"
          />
        </div>
      </template>
      <template #trailing>
        <OButton
          v-if="activeView === 'worktrees'"
          variant="transparent"
         
          :icon-left="PlusIcon"
          :disabled="!projectId"
          @click="showNewBranch = !showNewBranch"
        />
      </template>
    </OHeader>

    <!-- Worktrees view -->
    <div v-if="activeView === 'worktrees'" class="flex-1 overflow-auto p-1.5">
      <div v-if="showNewBranch" class="mb-1.5 px-1">
        <form @submit.prevent="createNewWorktree" class="flex gap-1">
          <OInput
            v-model="newBranchName"
            placeholder="feature/my-branch"
            name="branch"
            :disabled="creating"
            class="flex-1"
          />
          <OButton
            type="submit"
            variant="primary"
           
            :loading="creating"
            :disabled="!newBranchName"
          >
            Go
          </OButton>
        </form>
      </div>

      <div
        v-if="!projectId"
        class="text-copy text-tertiary px-2 py-4 text-center"
      >
        Open a project first
      </div>

      <div v-else-if="!worktreeList?.length" class="text-copy text-tertiary px-2 py-4 text-center">
        No worktrees yet
      </div>

      <div v-else class="flex flex-col gap-0.5">
        <OHover
          v-for="wt in worktreeList"
          :key="wt.id"
          full-width
          class="cursor-default"
        >
          <div class="flex w-full items-center justify-between px-2 py-1.5">
            <div class="flex min-w-0 items-center gap-2">
              <CodeBracketIcon class="text-tertiary size-4 shrink-0" />
              <span class="text-copy text-primary truncate">
                {{ wt.branchName }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
            </div>
          </div>
        </OHover>
      </div>
    </div>

    <!-- File tree view -->
    <div v-else class="flex-1 overflow-auto p-1.5">
      <div
        v-if="!projectId"
        class="text-copy text-tertiary px-2 py-4 text-center"
      >
        Open a project first
      </div>
      <div v-else-if="!tree?.length" class="text-copy text-tertiary px-2 py-4 text-center">
        No files
      </div>
      <OSidebarFileTree
        v-else
        :nodes="tree"
        :selected-file="selectedFile"
        :collapsed="collapsedPaths"
        @select="selectFile"
        @toggle="toggleFolder"
      />
    </div>

    <!-- Signals section hidden for now
    <div>
      <OHeader :icon="BellAlertIcon" title="Signals" borderless>
        <template #trailing>
          <span
            v-if="pendingSignals?.length"
            class="bg-warn text-warn-on text-copy grid size-4 place-items-center font-medium"
          >
            {{ pendingSignals.length }}
          </span>
        </template>
      </OHeader>

      <div class="max-h-64 overflow-auto p-1.5">
        <div
          v-if="!pendingSignals?.length"
          class="text-copy text-tertiary px-2 py-4 text-center"
        >
          No signals
        </div>
        <div v-else class="flex flex-col gap-1.5">
          <OSidebarSignalCard
            v-for="sig in pendingSignals"
            :key="sig.id"
            :signal="sig"
            @resolve="resolveSignal"
          />
        </div>
      </div>
    </div>
    -->
  </div>
</template>
