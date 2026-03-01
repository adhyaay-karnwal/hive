<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "reka-ui";

type Size = "md" | "lg";

interface Props {
  size?: Size;
}

const { size = "md" } = defineProps<Props>();
const open = defineModel<boolean>();

const maxWidthClasses: Record<Size, string> = {
  md: "max-w-[450px]",
  lg: "max-w-[550px]",
};
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-30 bg-overlay backdrop-blur-[2px]"
      />
      <DialogContent
        :class="[
          'bg-base-2 fixed top-[50%] left-[50%] z-100 max-h-[85vh] w-[90vw] translate-x-[-50%] translate-y-[-50%] p-0.5 shadow-2xl focus:outline-none',
          maxWidthClasses[size],
        ]"
      >
        <div class="bg-base-3 border-edge border">
          <DialogTitle
            class="text-primary border-edge border-b px-4 py-3 text-sm font-medium"
          >
            <slot name="title" />
          </DialogTitle>
          <DialogDescription class="text-secondary hidden">
            <slot name="description" />
          </DialogDescription>
          <div class="p-4">
            <slot name="content" />
          </div>
        </div>
        <div class="flex items-center justify-between p-2">
          <div>
            <slot name="footer-left" />
          </div>
          <div class="flex gap-2">
            <DialogClose as-child>
              <slot name="cancel" />
            </DialogClose>
            <slot name="submit" />
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
