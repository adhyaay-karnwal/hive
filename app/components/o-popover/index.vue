<script setup lang="ts">
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
} from "reka-ui";

type Props = {
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
};

const { side = "bottom", align = "start", sideOffset = 4 } = defineProps<Props>();
const open = defineModel<boolean>();
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        class="bg-base-3 border-edge data-[state=open]:animate-fade-in-from-top data-[state=closed]:animate-fade-out z-50 min-w-[8rem] overflow-hidden border shadow-lg outline-none"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
