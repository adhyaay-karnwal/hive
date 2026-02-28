<script setup lang="ts">
import { Cog6ToothIcon } from "@heroicons/vue/16/solid";
import { TooltipProvider } from "reka-ui";

const route = useRoute();
const hasProjectOpen = computed(() => !!route.params.id);
const { selectedFile } = useChanges();
const isDiffOpen = computed(() => !!selectedFile.value);
</script>

<template>
  <TooltipProvider :delay-duration="400">
  <div class="bg-base-0 flex h-screen flex-col overflow-hidden">
    <header class="flex h-9 shrink-0 items-center">
      <div class="w-20 shrink-0" />

      <OTabs />

      <div
        class="flex-1 self-stretch"
        style="-webkit-app-region: drag"
        data-tauri-drag-region
      />

      <div class="flex shrink-0 items-center gap-1 pr-2">
        <OButton
          variant="transparent"
          size="xs"
          :icon-left="Cog6ToothIcon"
          to="/settings"
        />
      </div>
    </header>

    <div class="flex min-h-0 flex-1 gap-1 px-1 pb-1">
      <aside
        v-show="!isDiffOpen"
        class="bg-base-1 flex w-60 shrink-0 flex-col rounded-lg ring-1 ring-edge"
      >
        <OSidebar />
      </aside>

      <main
        class="bg-base-1 relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-edge"
      >
        <slot />
      </main>

      <aside
        v-if="hasProjectOpen"
        class="bg-base-1 flex w-52 shrink-0 flex-col rounded-lg ring-1 ring-edge"
      >
        <OChangesPanel />
      </aside>
    </div>
  </div>
  </TooltipProvider>
</template>
