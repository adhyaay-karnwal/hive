<script setup lang="ts">
import type { Token } from "~/utils/diff-highlight";

type WordSpan = {
  text: string;
  emphasis: boolean;
};

type Props = {
  lineNumber: number | null;
  type: "addition" | "deletion" | "context";
  tokens: Token[];
  wordSpans?: WordSpan[];
  selected?: boolean;
  hovered?: boolean;
};

const {
  lineNumber,
  type,
  tokens,
  wordSpans,
  selected = false,
  hovered = false,
} = defineProps<Props>();

const emit = defineEmits<{
  "mousedown-number": [lineNumber: number];
  "mouseenter-number": [lineNumber: number];
  "mouseenter-line": [lineNumber: number];
  "mouseleave-line": [];
}>();

const lineClass = computed(() => {
  const base = "diff-line";
  const classes = [base];
  if (type === "addition") classes.push("diff-line-addition");
  else if (type === "deletion") classes.push("diff-line-deletion");
  else classes.push("diff-line-context");
  if (selected) classes.push("diff-line-selected");
  if (hovered) classes.push("diff-line-hovered");
  return classes.join(" ");
});

const emphasisClass = computed(() => {
  if (type === "addition") return "diff-word-addition";
  if (type === "deletion") return "diff-word-deletion";
  return "";
});
</script>

<template>
  <div
    :class="lineClass"
    @mouseenter="lineNumber != null && emit('mouseenter-line', lineNumber)"
    @mouseleave="emit('mouseleave-line')"
  >
    <div
      class="diff-line-number"
      @mousedown.prevent="lineNumber != null && emit('mousedown-number', lineNumber)"
      @mouseenter="lineNumber != null && emit('mouseenter-number', lineNumber)"
    >
      <span v-if="lineNumber != null">{{ lineNumber }}</span>
    </div>
    <div class="diff-line-content">
      <template v-if="wordSpans?.length">
        <template v-for="(span, i) in wordSpans" :key="i">
          <span v-if="span.emphasis" :class="emphasisClass">{{ span.text }}</span>
          <template v-else>
            <!-- Render with syntax coloring from tokens, mapped to word span offsets -->
            <span>{{ span.text }}</span>
          </template>
        </template>
      </template>
      <template v-else>
        <span
          v-for="(token, i) in tokens"
          :key="i"
          :style="{ '--token-dark': token.dark, '--token-light': token.light }"
          class="diff-token"
        >{{ token.content }}</span>
      </template>
    </div>
  </div>
</template>

<style>
.diff-line {
  position: relative;
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / 3;
}

.diff-line-number {
  grid-column: 1 / 2;
  box-sizing: content-box;
  text-align: right;
  position: sticky;
  left: 0;
  user-select: none;
  background-color: var(--diff-bg);
  color: var(--diff-fg-number);
  z-index: 1;
  min-width: 3ch;
  padding-left: 2ch;
  padding-right: 1ch;
  border-right: 1px solid var(--diff-bg);
  cursor: pointer;
  line-height: var(--diff-line-height);
  font-size: var(--diff-font-size);
  font-family: var(--diff-font);
}

.diff-line-content {
  grid-column: 2 / 3;
  padding-inline: 1ch;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: var(--diff-line-height);
  line-height: var(--diff-line-height);
  font-size: var(--diff-font-size);
  font-family: var(--diff-font);
}

/* ── Line type backgrounds ── */

.diff-line-addition .diff-line-content {
  background-color: var(--diff-bg-addition);
}

.diff-line-addition .diff-line-number {
  background-color: var(--diff-bg-addition-number);
  color: var(--diff-addition-base);
}

.diff-line-deletion .diff-line-content {
  background-color: var(--diff-bg-deletion);
}

.diff-line-deletion .diff-line-number {
  background-color: var(--diff-bg-deletion-number);
  color: var(--diff-deletion-base);
}

/* ── Indicator bars ── */

.diff-line-addition .diff-line-number::before {
  content: '';
  display: block;
  width: 4px;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background-color: var(--diff-addition-base);
}

.diff-line-deletion .diff-line-number::before {
  content: '';
  display: block;
  width: 4px;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  user-select: none;
  background-image: linear-gradient(
    0deg,
    var(--diff-bg-deletion) 50%,
    var(--diff-deletion-base) 50%
  );
  background-repeat: repeat;
  background-size: 2px 2px;
}

/* ── Hover ── */

@media (pointer: fine) {
  .diff-line-hovered:not(.diff-line-selected).diff-line-context .diff-line-number,
  .diff-line-hovered:not(.diff-line-selected).diff-line-context .diff-line-content {
    background-color: var(--diff-bg-hover);
  }

  .diff-line-hovered:not(.diff-line-selected).diff-line-addition .diff-line-number,
  .diff-line-hovered:not(.diff-line-selected).diff-line-addition .diff-line-content {
    background-color: var(--diff-bg-addition-hover);
  }

  .diff-line-hovered:not(.diff-line-selected).diff-line-deletion .diff-line-number,
  .diff-line-hovered:not(.diff-line-selected).diff-line-deletion .diff-line-content {
    background-color: var(--diff-bg-deletion-hover);
  }
}

/* ── Selection ── */

.diff-line-selected.diff-line-context .diff-line-number {
  color: var(--diff-selection-number-fg);
  background-color: var(--diff-bg-selection-number);
}

.diff-line-selected.diff-line-context .diff-line-content {
  background-color: var(--diff-bg-selection);
}

.diff-line-selected.diff-line-addition .diff-line-content,
.diff-line-selected.diff-line-deletion .diff-line-content {
  background-color: color-mix(
    in lab,
    var(--diff-bg-selection) 50%,
    var(--diff-bg)
  );
}

.diff-line-selected.diff-line-addition .diff-line-number,
.diff-line-selected.diff-line-deletion .diff-line-number {
  color: var(--diff-selection-number-fg);
  background-color: var(--diff-bg-selection-number);
}

/* ── Syntax token colors ── */

.diff-token {
  color: var(--token-dark);
}

:root.light .diff-token {
  color: var(--token-light);
}

/* ── Word-level emphasis ── */

.diff-word-addition {
  background-color: var(--diff-bg-addition-emphasis);
  border-radius: 3px;
  box-decoration-break: clone;
}

.diff-word-deletion {
  background-color: var(--diff-bg-deletion-emphasis);
  border-radius: 3px;
  box-decoration-break: clone;
}
</style>
