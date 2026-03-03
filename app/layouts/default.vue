<script setup lang="ts">
import { Cog6ToothIcon, MoonIcon, SunIcon, MinusIcon, XMarkIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from "@heroicons/vue/16/solid";
import { TooltipProvider } from "reka-ui";

const route = useRoute();
const hasProjectOpen = computed(() => !!route.params.id);
const { selectedFile } = useChanges();
const isDiffOpen = computed(() => !!selectedFile.value);
const { isDark, toggleTheme } = useTheme();

// Window controls
const isMaximized = ref(false);

async function checkMaximized() {
  if (window.electronAPI) {
    isMaximized.value = await window.electronAPI.isMaximized();
  }
}

onMounted(() => {
  checkMaximized();
});

function minimize() {
  window.electronAPI?.minimize();
}

function toggleMaximize() {
  window.electronAPI?.maximize();
  checkMaximized();
}

function close() {
  window.electronAPI?.close();
}

// Only show window controls on non-Mac platforms
const isMac = typeof navigator !== 'undefined' && (
  navigator.platform.toLowerCase().includes('mac') || 
  navigator.userAgent.toLowerCase().includes('mac')
);
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
         
          :icon-left="isDark ? SunIcon : MoonIcon"
          @click="toggleTheme()"
        />
        <OButton
          variant="transparent"
         
          :icon-left="Cog6ToothIcon"
          to="/settings"
        />
        
        <!-- Window controls (only show on non-Mac) -->
        <template v-if="!isMac">
          <div class="w-2" />
          <OButton
            variant="transparent"
            :icon-left="MinusIcon"
            title="Minimize"
            @click="minimize"
          />
          <OButton
            variant="transparent"
            :icon-left="isMaximized ? ArrowsPointingInIcon : ArrowsPointingOutIcon"
            :title="isMaximized ? 'Restore' : 'Maximize'"
            @click="toggleMaximize"
          />
          <OButton
            variant="transparent"
            :icon-left="XMarkIcon"
            title="Close"
            @click="close"
          />
        </template>
      </div>
    </header>

    <div class="flex min-h-0 flex-1 gap-1 px-1 pb-1">
      <aside
        v-show="hasProjectOpen && !isDiffOpen"
        class="bg-base-1 flex w-60 shrink-0 flex-col overflow-hidden ring-1 ring-edge"
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
        class="bg-base-1 flex w-52 shrink-0 flex-col overflow-hidden ring-1 ring-edge"
      >
        <OChangesPanel />
      </aside>
    </div>
  </div>
  </TooltipProvider>
</template>
