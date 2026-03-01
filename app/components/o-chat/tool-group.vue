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
    <OButton
      variant="transparent"
     
      :icon-left="ChevronDownIcon"
      class="[&_svg]:transition-transform"
      :class="expanded ? '' : '[&_svg]:-rotate-90'"
      @click="expanded = !expanded"
    >
      {{ tools.length }} step{{ tools.length === 1 ? "" : "s" }}
    </OButton>

    <div v-if="expanded" class="mt-1 flex flex-col">
      <OChatToolCall
        v-for="tool in tools"
        :key="tool.callID || tool.tool"
        :part="tool as any"
      />
    </div>
  </div>
</template>
