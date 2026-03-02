<script setup lang="ts">
import { ChevronDownIcon } from "@heroicons/vue/16/solid";

type DynamicToolPart = {
  type: "dynamic-tool" | string;
  toolName: string;
  toolCallId: string;
  state: string;
  input?: any;
  output?: any;
  errorText?: string;
};

type Props = {
  tools: DynamicToolPart[];
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
const hasRunning = computed(() =>
  tools.some((t) => t.state === "input-streaming" || t.state === "input-available"),
);

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
        v-for="t in tools"
        :key="t.toolCallId"
        :tool="t"
      />
    </div>
  </div>
</template>
