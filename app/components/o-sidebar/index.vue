<script setup lang="ts">
import {
  CodeBracketIcon,
  BellAlertIcon,
  PlusIcon,
  PlayIcon,
  StopIcon,
} from "@heroicons/vue/16/solid";

const route = useRoute();
const projectId = computed(() => {
  if (route.params.id) return route.params.id as string;
  return null;
});

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

async function toggleDevServer(wt: any) {
  if (wt.devServerActive) {
    await $fetch(`/api/worktrees/${wt.id}/dev-server`, { method: "DELETE" });
  } else {
    await $fetch(`/api/worktrees/${wt.id}/dev-server`, { method: "POST" });
  }
  await refreshWorktrees();
}
</script>

<template>
  <div class="flex h-full flex-col">
    <OHeader :icon="CodeBracketIcon" title="Worktrees" borderless>
      <template #trailing>
        <OButton
          variant="transparent"
          size="xs"
          :icon-left="PlusIcon"
          :disabled="!projectId"
          @click="showNewBranch = !showNewBranch"
        />
      </template>
    </OHeader>

    <div class="flex-1 overflow-auto p-1.5">
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
            size="md"
            :loading="creating"
            :disabled="!newBranchName"
          >
            Go
          </OButton>
        </form>
      </div>

      <div
        v-if="!projectId"
        class="text-copy-sm text-tertiary px-2 py-4 text-center"
      >
        Open a project first
      </div>

      <div v-else-if="!worktreeList?.length" class="text-copy-sm text-tertiary px-2 py-4 text-center">
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
              <CodeBracketIcon class="text-tertiary size-3.5 shrink-0" />
              <span class="text-copy-sm text-primary truncate">
                {{ wt.branchName }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="text-tertiary hover:text-primary grid size-5 place-items-center rounded"
                :title="
                  wt.devServerActive
                    ? 'Stop dev server'
                    : 'Start dev server on :3000'
                "
                @click.stop="toggleDevServer(wt)"
              >
                <component
                  :is="wt.devServerActive ? StopIcon : PlayIcon"
                  class="size-3"
                  :class="wt.devServerActive ? 'text-success' : ''"
                />
              </button>
              <span
                v-if="wt.opencodePort"
                class="text-copy-xs text-tertiary"
              >
                :{{ wt.opencodePort }}
              </span>
            </div>
          </div>
        </OHover>
      </div>
    </div>

    <div>
      <OHeader :icon="BellAlertIcon" title="Signals" borderless>
        <template #trailing>
          <span
            v-if="pendingSignals?.length"
            class="bg-warn text-warn-on text-copy-xs grid size-4 place-items-center rounded-full font-medium"
          >
            {{ pendingSignals.length }}
          </span>
        </template>
      </OHeader>

      <div class="max-h-64 overflow-auto p-1.5">
        <div
          v-if="!pendingSignals?.length"
          class="text-copy-sm text-tertiary px-2 py-4 text-center"
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
  </div>
</template>
