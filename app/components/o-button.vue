<script setup lang="ts">
import { ArrowPathIcon } from "@heroicons/vue/16/solid";
import { NuxtLink } from "#components";
import { refDebounced } from "@vueuse/core";

const slots = useSlots();

type Variant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "danger"
  | "danger-light"
  | "transparent"
  | "outline";

type Size = "xs" | "sm" | "md";

type Props = {
  variant?: Variant;
  iconLeft?: Component;
  to?: any;
  size?: Size;
  type?: "submit" | "button";
  loading?: boolean;
  disabled?: boolean;
};

const props = defineProps<Props>();
const {
  variant = "primary",
  size = "md",
  type = "button",
  loading = false,
} = props;

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-surface-1 text-primary hover:bg-surface-2 border border-edge shadow-xs active:bg-surface-3",
  secondary:
    "bg-surface-1 text-primary hover:bg-surface-2 active:bg-base border border-transparent",
  tertiary:
    "text-secondary hover:text-primary border border-transparent",
  transparent:
    "text-secondary hover:bg-surface-1 active:bg-inverse/10 border !border-transparent",
  danger:
    "bg-danger text-danger-on hover:bg-danger-strong border border-transparent active:bg-danger-strong",
  "danger-light":
    "text-danger bg-danger-subtle hover:bg-danger/30 active:bg-danger/50 border border-transparent",
  outline:
    "text-secondary border border-edge-subtle hover:bg-inverse/5 active:bg-inverse/10",
};

const paddingClasses: Record<Size, string> = {
  xs: "px-2",
  sm: "px-3",
  md: "px-3",
};

const heightClasses: Record<Size, string> = {
  xs: "h-6",
  sm: "h-7",
  md: "h-8",
};

const widthClasses: Record<Size, string> = {
  xs: "w-5",
  sm: "w-7",
  md: "w-8",
};

const sizeClass = computed(() => {
  if (slots.default) {
    return [paddingClasses[size], heightClasses[size], "w-fit"];
  }
  return [heightClasses[size], widthClasses[size]];
});

const isLoading = refDebounced(toRef(props, "loading"), 100);
</script>

<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :type
    :to
    class="relative flex min-w-fit cursor-default items-center justify-center gap-2 text-sm whitespace-pre ring-focus outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2"
    :class="[
      sizeClass,
      variantClasses[variant],
      disabled ? 'pointer-events-none opacity-50' : '',
    ]"
    :disabled
  >
    <component
      v-if="iconLeft"
      :is="iconLeft"
      class="size-4"
      :class="{ 'opacity-0': isLoading }"
    />
    <slot name="leading" />
    <div
      v-if="$slots.default"
      class="inline"
      :class="{ 'opacity-0': isLoading }"
    >
      <slot />
    </div>
    <slot name="trailing" />
    <div
      v-if="isLoading"
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform"
    >
      <ArrowPathIcon class="size-4 animate-spin" />
    </div>
  </component>
</template>
