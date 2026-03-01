<script setup lang="ts">
import { FolderOpenIcon, PlusIcon, FolderIcon } from "@heroicons/vue/16/solid";

const router = useRouter();
const openTabs = useState<string[]>("openTabs", () => []);

const { data: projects } = await useFetch("/api/projects");

function openExisting(projectId: string) {
  if (!openTabs.value.includes(projectId)) {
    openTabs.value.push(projectId);
  }
  router.push(`/project/${projectId}`);
}

async function openNew() {
  let selectedPath: string | null = null;

  if (window.electronAPI) {
    selectedPath = await window.electronAPI.openDirectory();
  } else {
    selectedPath = prompt("Enter the project path:");
  }

  if (!selectedPath) return;

  const project = await $fetch("/api/projects", {
    method: "POST",
    body: { path: selectedPath },
  });

  if (!openTabs.value.includes(project.id)) {
    openTabs.value.push(project.id);
  }
  router.push(`/project/${project.id}`);
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center p-8">
    <div v-if="projects?.length" class="mb-8 w-full max-w-sm">
      <p class="text-copy-sm text-tertiary mb-2 px-1 font-medium uppercase">
        Recent projects
      </p>
      <div class="flex flex-col gap-0.5">
        <OHover
          v-for="proj in projects"
          :key="proj.id"
          full-width
          class="cursor-default"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 px-3 py-2 text-left outline-none"
            @click="openExisting(proj.id)"
          >
            <FolderIcon class="text-tertiary size-4 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="text-copy text-primary truncate">{{ proj.name }}</p>
              <p class="text-copy-xs text-tertiary truncate">{{ proj.path }}</p>
            </div>
            <span
              v-if="proj.pkgManager"
              class="text-copy-xs text-tertiary shrink-0"
            >
              {{ proj.pkgManager }}
            </span>
          </button>
        </OHover>
      </div>
    </div>

    <div class="flex flex-col items-center gap-4">
      <div
        v-if="!projects?.length"
        class="bg-surface-1 grid size-16 place-items-center"
      >
        <FolderOpenIcon class="text-tertiary size-8" />
      </div>
      <div v-if="!projects?.length" class="text-center">
        <h1 class="text-title-sm text-primary">Welcome to Hive</h1>
        <p class="text-copy text-secondary mt-1">
          Open a project to start orchestrating agents.
        </p>
      </div>
      <OButton
        variant="primary"
        size="md"
        :icon-left="PlusIcon"
        @click="openNew"
      >
        Open Project
      </OButton>
    </div>
  </div>
</template>
