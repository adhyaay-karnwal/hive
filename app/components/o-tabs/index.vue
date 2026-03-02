<script setup lang="ts">
import { PlusIcon, XMarkIcon, RectangleStackIcon } from "@heroicons/vue/16/solid";

const route = useRoute();
const router = useRouter();

const openTabs = useState<string[]>("openTabs", () => []);

const { data: allProjects, refresh: refreshProjects } = useFetch("/api/projects");

const tabProjects = computed(() => {
  if (!allProjects.value) return [];
  return openTabs.value
    .map((id) => allProjects.value!.find((p) => p.id === id))
    .filter(Boolean);
});

const currentProjectId = computed(() => {
  if (route.params.id) return route.params.id as string;
  return null;
});

const isHome = computed(() => route.path === "/" || route.path === "");

watch(currentProjectId, (id) => {
  if (id && !openTabs.value.includes(id)) {
    openTabs.value.push(id);
  }
}, { immediate: true });

async function openProject() {
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

  // Refresh project list in background (non-blocking)
  refreshProjects();
}

const store = useHiveStore();

function closeTab(projectId: string, e: Event) {
  e.preventDefault();
  e.stopPropagation();

  // Clean up chat state for this project
  store.deactivate(projectId);

  openTabs.value = openTabs.value.filter((id) => id !== projectId);

  if (currentProjectId.value === projectId) {
    if (openTabs.value.length) {
      router.push(`/project/${openTabs.value[openTabs.value.length - 1]}`);
    } else {
      router.push("/");
    }
  }
}
</script>

<template>
  <div class="flex items-center gap-0.5">
    <OHover :active="isHome" class="cursor-default">
      <NuxtLink
        to="/"
        class="grid size-6 place-items-center outline-none"
        :class="isHome ? 'text-primary' : 'text-tertiary'"
      >
        <RectangleStackIcon class="size-4" />
      </NuxtLink>
    </OHover>

    <OTooltip
      v-for="proj in tabProjects"
      :key="proj!.id"
      :content="proj!.name"
      side="bottom"
    >
      <OHover
        :active="currentProjectId === proj!.id"
        class="cursor-default"
      >
        <div class="flex items-center">
          <NuxtLink
            :to="`/project/${proj!.id}`"
            class="text-copy max-w-32 truncate whitespace-nowrap py-1 pl-2.5 pr-1 outline-none"
            :class="
              currentProjectId === proj!.id ? 'text-primary' : 'text-tertiary'
            "
          >
            {{ proj!.name }}
          </NuxtLink>
          <OButton
            variant="transparent"
           
            :icon-left="XMarkIcon"
            class="opacity-0 transition-opacity group-hover/h:opacity-100"
            :class="currentProjectId === proj!.id ? 'opacity-60' : ''"
            @click="closeTab(proj!.id, $event)"
          />
        </div>
      </OHover>
    </OTooltip>

    <OButton
      variant="transparent"
     
      :icon-left="PlusIcon"
      @click="openProject"
    />
  </div>
</template>
