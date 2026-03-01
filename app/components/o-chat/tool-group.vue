<script setup lang="ts">
import { ChevronDownIcon, StopIcon } from "@heroicons/vue/16/solid";

type Part = {
  type: string;
  tool?: string;
  callID?: string;
  state?: any;
  [key: string]: any;
};

type Props = {
  tools: Part[];
  isLast?: boolean;
  isWorking?: boolean;
  statusText?: string;
  formattedDuration?: string;
};

type Emits = {
  abort: [];
};

const { tools, isLast = false, isWorking = false, statusText = "", formattedDuration = "" } = defineProps<Props>();
const emit = defineEmits<Emits>();

const expanded = ref(false);
const hasRunning = computed(() => tools.some((t) => t.state?.status === "running" || t.state?.status === "pending"));

watch(hasRunning, (running) => {
  if (running) expanded.value = true;
});
</script>

<template>
  <div class="px-5 py-1">
    <button
      type="button"
      class="text-copy-sm text-tertiary hover:text-secondary flex items-center gap-1.5 outline-none"
      @click="expanded = !expanded"
    >
      <ChevronDownIcon
        class="size-3.5 transition-transform"
        :class="expanded ? '' : '-rotate-90'"
      />
      <span>{{ tools.length }} step{{ tools.length === 1 ? "" : "s" }}</span>
    </button>

    <div v-if="expanded" class="mt-1 flex flex-col">
      <OChatToolCall
        v-for="tool in tools"
        :key="tool.callID || tool.tool"
        :part="tool as any"
      />
    </div>
  </div>
</template>
