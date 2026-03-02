<script setup lang="ts">
import { tokenizeLine, tokenizeLines, CONTEXT_LANGS, getLangFromPath, type Token } from "~/utils/diff-highlight";

type Comment = {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  resolved: boolean;
};

type Props = {
  content: string;
  filePath: string;
  comments?: Comment[];
};

type Emits = {
  "add-comment": [comment: { filePath: string; startLine: number; endLine: number; content: string }];
  "delete-comment": [commentId: string];
  "update-comment": [commentId: string, content: string];
};

const { content, filePath, comments = [] } = defineProps<Props>();
const emit = defineEmits<Emits>();

const isImage = computed(() => content.startsWith("data:image/"));

const lang = computed(() => getLangFromPath(filePath));

// ── Lines ────────────────────────────────────────────────────────────────

const lines = computed(() => {
  const raw = content.endsWith("\n") ? content.slice(0, -1) : content;
  return raw.split("\n").map((text, i) => ({
    key: `line-${i + 1}`,
    lineNumber: i + 1,
    text: text + "\n",
  }));
});

// ── Syntax highlighting ──────────────────────────────────────────────────

const tokenMap = ref(new Map<string, Token[]>());

async function highlightAll() {
  const updated = new Map(tokenMap.value);

  if (CONTEXT_LANGS.has(lang.value)) {
    // Tokenize all lines at once to preserve grammar context
    const allLines = lines.value.map((l) => l.text);
    const results = await tokenizeLines(allLines, lang.value);
    for (let i = 0; i < allLines.length; i++) {
      updated.set(allLines[i], results[i]);
    }
  } else {
    const unique = lines.value
      .map((l) => l.text)
      .filter((t) => t.trim() && !updated.has(t));

    if (!unique.length) return;

    const results = await Promise.all(unique.map((line) => tokenizeLine(line, lang.value)));
    for (let i = 0; i < unique.length; i++) {
      updated.set(unique[i], results[i]);
    }
  }

  tokenMap.value = updated;
}

function getTokens(text: string): Token[] {
  return tokenMap.value.get(text) ?? [{ content: text.replace(/\n$/, ""), dark: "#fbfbfb", light: "#24292e" }];
}

watch([() => content, () => filePath], () => {
  tokenMap.value = new Map();
  highlightAll();
}, { immediate: true });

// ── Line selection (drag to select range) ────────────────────────────────

const selecting = ref(false);
const selectionStart = ref<number | null>(null);
const selectionEnd = ref<number | null>(null);
const showCommentInput = ref(false);

const selectedRange = computed(() => {
  if (selectionStart.value == null || selectionEnd.value == null) return null;
  return {
    start: Math.min(selectionStart.value, selectionEnd.value),
    end: Math.max(selectionStart.value, selectionEnd.value),
  };
});

function isLineSelected(lineNumber: number): boolean {
  if (!selectedRange.value) return false;
  return lineNumber >= selectedRange.value.start && lineNumber <= selectedRange.value.end;
}

function onLineNumberMouseDown(lineNumber: number) {
  if (showCommentInput.value) return;
  selecting.value = true;
  selectionStart.value = lineNumber;
  selectionEnd.value = lineNumber;
}

function onLineNumberMouseEnter(lineNumber: number) {
  if (selecting.value) selectionEnd.value = lineNumber;
}

function onMouseUp() {
  if (selecting.value && selectedRange.value) {
    showCommentInput.value = true;
  }
  selecting.value = false;
}

// ── Hover ────────────────────────────────────────────────────────────────

const hoveredLine = ref<number | null>(null);

// ── Comments ─────────────────────────────────────────────────────────────

function commentsOnLine(lineNumber: number): Comment[] {
  return comments.filter((c) => !c.resolved && c.endLine === lineNumber);
}

function isCommentInputOnLine(lineNumber: number): boolean {
  if (!showCommentInput.value || !selectedRange.value) return false;
  return selectedRange.value.end === lineNumber;
}

function submitComment(content: string) {
  if (!selectedRange.value) return;
  emit("add-comment", {
    filePath,
    startLine: selectedRange.value.start,
    endLine: selectedRange.value.end,
    content,
  });
  clearSelection();
}

function clearSelection() {
  showCommentInput.value = false;
  selectionStart.value = null;
  selectionEnd.value = null;
}

// ── Lifecycle ────────────────────────────────────────────────────────────

onMounted(() => document.addEventListener("mouseup", onMouseUp));
onUnmounted(() => document.removeEventListener("mouseup", onMouseUp));
</script>

<template>
  <div v-if="isImage" class="flex h-full w-full items-center justify-center bg-black p-4">
    <img :src="content" :alt="filePath" class="max-w-full object-contain" />
  </div>

  <div
    v-else
    class="file-viewer-root"
    :style="{
      fontFamily: 'var(--diff-font)',
      fontSize: 'var(--diff-font-size)',
      lineHeight: 'var(--diff-line-height)',
      backgroundColor: 'var(--diff-bg)',
      color: 'var(--diff-fg)',
    }"
  >
    <div class="file-viewer-code">
      <template v-for="line in lines" :key="line.key">
        <ODiffLine
          :line-number="line.lineNumber"
          type="context"
          :tokens="getTokens(line.text)"
          :selected="isLineSelected(line.lineNumber)"
          :hovered="hoveredLine === line.lineNumber"
          @mousedown-number="onLineNumberMouseDown($event)"
          @mouseenter-number="onLineNumberMouseEnter($event)"
          @mouseenter-line="hoveredLine = $event"
          @mouseleave-line="hoveredLine = null"
        />

        <!-- Inline comments after line -->
        <div
          v-for="comment in commentsOnLine(line.lineNumber)"
          :key="comment.id"
          class="diff-annotation"
        >
          <div class="diff-annotation-content">
            <OChangesCommentBubble
              :content="comment.content"
              :resolved="comment.resolved"
              @edit="emit('update-comment', comment.id, $event)"
              @delete="emit('delete-comment', comment.id)"
            />
          </div>
        </div>

        <!-- Comment input after selected range end -->
        <div
          v-if="isCommentInputOnLine(line.lineNumber)"
          class="diff-annotation"
        >
          <div class="diff-annotation-content">
            <OChangesCommentInput
              :start-line="selectedRange!.start"
              :end-line="selectedRange!.end"
              @submit="submitComment"
              @cancel="clearSelection"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style>
.file-viewer-root {
  position: relative;
  overflow: hidden;
}

.file-viewer-code {
  display: grid;
  grid-auto-flow: dense;
  grid-template-columns: minmax(min-content, max-content) 1fr;
  overflow: scroll clip;
  overscroll-behavior-x: none;
  tab-size: 2;
  padding-top: 8px;
  padding-bottom: 8px;
}

.file-viewer-code::-webkit-scrollbar {
  width: 0;
  height: 6px;
}

.file-viewer-code::-webkit-scrollbar-track {
  background: transparent;
}

.file-viewer-code::-webkit-scrollbar-thumb {
  background-color: transparent;
}

.file-viewer-root:hover .file-viewer-code::-webkit-scrollbar-thumb {
  background-color: var(--diff-bg-context);
}
</style>
