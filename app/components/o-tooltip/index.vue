<script setup lang="ts">
import {
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
} from "reka-ui";

type Props = {
  content?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  delayDuration?: number;
  disabled?: boolean;
};

const {
  side = "bottom",
  align = "center",
  sideOffset = 6,
  delayDuration = 400,
  disabled = false,
} = defineProps<Props>();
</script>

<template>
  <TooltipRoot :delay-duration="delayDuration" :disabled="disabled">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        class="bg-base-3 text-copy text-primary border-edge z-50 border px-2 py-1 shadow-sm data-[state=delayed-open]:animate-[contentShow_150ms_ease-out] data-[state=closed]:animate-[fade-out_100ms_ease-in]"
      >
        <slot name="content">
          {{ content }}
        </slot>
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
