<script setup lang="ts">
import { ChevronDownIcon } from "@heroicons/vue/16/solid";

type Props = {
  collapsedLines?: number;
  isFirst?: boolean;
  isLast?: boolean;
  expanded?: boolean;
};

type Emits = {
  expand: [];
};

const { collapsedLines = 0, isFirst = false, isLast = false, expanded = false } = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div
    v-if="!expanded"
    class="diff-separator"
    :class="{
      'diff-separator-first': isFirst,
      'diff-separator-last': isLast,
    }"
  >
    <div class="diff-separator-wrapper">
      <button
        v-if="collapsedLines > 0"
        type="button"
        class="diff-separator-expand"
        title="Expand collapsed lines"
        @click="emit('expand')"
      >
        <ChevronDownIcon class="size-4" />
      </button>
      <div class="diff-separator-content">
        <span v-if="collapsedLines > 0" class="diff-separator-label">
          {{ collapsedLines }} unmodified line{{ collapsedLines !== 1 ? 's' : '' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style>
.diff-separator {
  grid-column: 1 / 3;
  min-height: 4px;
  background-color: var(--diff-bg-separator);
  display: grid;
  grid-template-columns: subgrid;
  margin-block: 8px;
}

.diff-separator-first {
  margin-top: 0;
}

.diff-separator-last {
  margin-bottom: 0;
}

.diff-separator-wrapper {
  grid-column: 1 / 3;
  display: flex;
  align-items: center;
  gap: 2px;
  user-select: none;
  border-radius: 6px;
  overflow: hidden;
}

.diff-separator-expand {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  opacity: 0.65;
  cursor: pointer;
  background-color: var(--diff-bg-separator);
  color: var(--diff-fg);
  border: none;
  outline: none;
}

.diff-separator-expand:hover {
  opacity: 1;
}

.diff-separator-content {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 1ch;
  height: 32px;
  opacity: 0.65;
  overflow: hidden;
  background-color: var(--diff-bg-separator);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: var(--diff-font-size);
}

.diff-separator-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--diff-fg);
}
</style>
