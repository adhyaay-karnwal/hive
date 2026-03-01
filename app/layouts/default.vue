<script setup lang="ts">
import { Cog6ToothIcon, MoonIcon, SunIcon } from "@heroicons/vue/16/solid";
import { TooltipProvider } from "reka-ui";

const route = useRoute();
const hasProjectOpen = computed(() => !!route.params.id);
const { selectedFile } = useChanges();
const isDiffOpen = computed(() => !!selectedFile.value);
const { isDark, toggleTheme } = useTheme();
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
      />

      <div class="flex shrink-0 items-center gap-1 pr-2">
        <OButton
          variant="transparent"
          size="xs"
          :icon-left="isDark ? SunIcon : MoonIcon"
          @click="toggleTheme()"
        />
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
        class="flex w-60 shrink-0 flex-col"
      >
        <OSidebar />
      </aside>

      <main
        class="bg-base-1 relative flex min-w-0 flex-1 flex-col overflow-hidden ring-1 ring-edge"
      >
        <slot />
      </main>

      <aside
        v-if="hasProjectOpen"
        class="flex w-52 shrink-0 flex-col"
      >
        <OChangesPanel />
      </aside>
    </div>
  </div>
  </TooltipProvider>
</template>
