<script setup lang="ts">
import type { FileDiffMetadata } from "@pierre/diffs";
import { diffWordsWithSpace } from "diff";
import { tokenizeLine, getLangFromPath, type Token } from "~/utils/diff-highlight";

type ChangeComment = {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  side: "additions" | "deletions" | null;
  content: string;
  resolved: boolean;
};

type LineData = {
  key: string;
  lineNumber: number | null;
  type: "addition" | "deletion" | "context";
  text: string;
  getTokens: Token[];
  wordSpans?: { text: string; emphasis: boolean }[];
};

type RowItem =
  | { kind: "separator"; key: string; content: string }
  | { kind: "line"; key: string; data: LineData }
  | { kind: "buffer"; key: string };

type Props = {
  fileDiff: FileDiffMetadata;
  filePath: string;
  comments?: ChangeComment[];
};

type Emits = {
  "add-comment": [comment: {
    filePath: string;
    startLine: number;
    endLine: number;
    side?: "additions" | "deletions";
    content: string;
  }];
  "delete-comment": [commentId: string];
  "update-comment": [commentId: string, content: string];
};

const {
  fileDiff,
  filePath,
  comments = [],
} = defineProps<Props>();
const emit = defineEmits<Emits>();

const lang = computed(() => getLangFromPath(filePath));

// ── Expand collapsed context lines ──

const expandedHunks = ref(new Set<number>());
const fileLines = ref<string[] | null>(null);
const loadingFile = ref(false);

async function fetchFileLines() {
  if (fileLines.value || loadingFile.value) return;
  loadingFile.value = true;
  try {
    const route = useRoute();
    const projectId = route.params.id as string;
    const data = await $fetch(`/api/projects/${projectId}/file-content`, {
      query: { path: filePath },
    });
    fileLines.value = ((data as any).content || "").split("\n");
  } catch (e) {
    console.error("[diff] Failed to fetch file content:", e);
  } finally {
    loadingFile.value = false;
  }
}

async function expandHunk(hunkIndex: number) {
  await fetchFileLines();
  const newSet = new Set(expandedHunks.value);
  newSet.add(hunkIndex);
  expandedHunks.value = newSet;
  highlightAll();
}

// ── Build left/right line arrays from hunks ──

type SplitLine = {
  key: string;
  lineNumber: number | null;
  type: "addition" | "deletion" | "context";
  text: string;
  pairedText?: string;
};

type SplitRow =
  | { kind: "separator"; key: string; hunkIndex: number; collapsedLines: number; isFirst: boolean; isLast: boolean; expanded: boolean; startLine: number; endLine: number }
  | { kind: "line"; left: SplitLine; right: SplitLine }
  | { kind: "buffer-left"; key: string; right: SplitLine }
  | { kind: "buffer-right"; key: string; left: SplitLine };

const splitRows = computed<SplitRow[]>(() => {
  const rows: SplitRow[] = [];
  if (!fileDiff?.hunks) return rows;

  let oldLine = fileDiff.hunks[0]?.deletionStart ?? 1;
  let newLine = fileDiff.hunks[0]?.additionStart ?? 1;

  for (let h = 0; h < fileDiff.hunks.length; h++) {
    const hunk = fileDiff.hunks[h];

    if (h === 0) {
      oldLine = hunk.deletionStart;
      newLine = hunk.additionStart;
    }

    // Calculate collapsed line range before this hunk
    let startLine = 1;
    let endLine = hunk.deletionStart - 1;

    if (h > 0) {
      const prevHunk = fileDiff.hunks[h - 1];
      startLine = prevHunk.deletionStart + prevHunk.deletionCount;
      endLine = hunk.deletionStart - 1;
    }

    let collapsedLines = hunk.collapsedBefore ?? Math.max(0, endLine - startLine + 1);
    const isExpanded = expandedHunks.value.has(h);

    if (isExpanded && fileLines.value && collapsedLines > 0) {
      // Insert the actual context lines instead of a separator
      for (let ln = startLine; ln <= endLine; ln++) {
        const text = (fileLines.value[ln - 1] ?? "") + "\n";
        rows.push({
          kind: "line",
          left: { key: `ctx-l-${ln}`, lineNumber: ln, type: "context", text },
          right: { key: `ctx-r-${ln}`, lineNumber: ln, type: "context", text },
        });
      }
    } else {
      rows.push({
        kind: "separator",
        key: `sep-${h}`,
        hunkIndex: h,
        collapsedLines,
        isFirst: h === 0,
        isLast: h === fileDiff.hunks.length - 1,
        expanded: isExpanded,
        startLine,
        endLine,
      });
    }

    for (const chunk of hunk.hunkContent) {
      if (chunk.type === "context") {
        for (const line of chunk.lines) {
          rows.push({
            kind: "line",
            left: { key: `l-${oldLine}`, lineNumber: oldLine, type: "context", text: line },
            right: { key: `r-${newLine}`, lineNumber: newLine, type: "context", text: line },
          });
          oldLine++;
          newLine++;
        }
      } else if (chunk.type === "change") {
        const dels = chunk.deletions || [];
        const adds = chunk.additions || [];
        const maxLen = Math.max(dels.length, adds.length);

        for (let i = 0; i < maxLen; i++) {
          const del = dels[i];
          const add = adds[i];

          if (del && add) {
            rows.push({
              kind: "line",
              left: {
                key: `l-${oldLine}`,
                lineNumber: oldLine,
                type: "deletion",
                text: del,
                pairedText: add,
              },
              right: {
                key: `r-${newLine}`,
                lineNumber: newLine,
                type: "addition",
                text: add,
                pairedText: del,
              },
            });
            oldLine++;
            newLine++;
          } else if (del) {
            rows.push({
              kind: "buffer-right",
              key: `buf-r-${oldLine}`,
              left: { key: `l-${oldLine}`, lineNumber: oldLine, type: "deletion", text: del },
            });
            oldLine++;
          } else if (add) {
            rows.push({
              kind: "buffer-left",
              key: `buf-l-${newLine}`,
              right: { key: `r-${newLine}`, lineNumber: newLine, type: "addition", text: add },
            });
            newLine++;
          }
        }
      }
    }
  }

  return rows;
});

// ── Syntax highlighting (async) ──

const tokenMap = ref(new Map<string, Token[]>());

async function highlightAll() {
  const lines = new Set<string>();
  for (const row of splitRows.value) {
    if (row.kind === "line") {
      lines.add(row.left.text);
      lines.add(row.right.text);
    } else if (row.kind === "buffer-left") {
      lines.add(row.right.text);
    } else if (row.kind === "buffer-right") {
      lines.add(row.left.text);
    }
  }

  const current = tokenMap.value;
  const unique = [...lines].filter((l) => l.trim() && !current.has(l));
  if (!unique.length) return;

  const results = await Promise.all(
    unique.map((line) => tokenizeLine(line, lang.value)),
  );

  const updated = new Map(current);
  for (let i = 0; i < unique.length; i++) {
    updated.set(unique[i], results[i]);
  }
  tokenMap.value = updated;

  // Debug: check if the first line can be found
  const firstRow = splitRows.value.find(r => r.kind === "line");
  if (firstRow && firstRow.kind === "line") {
    const key = firstRow.left.text;
    const found = updated.has(key);
    console.log("[diff] after highlight: map.size=", updated.size, "firstKey found=", found, "key repr=", JSON.stringify(key).slice(0, 60));
    if (!found) {
      const mapKeys = [...updated.keys()].slice(0, 3);
      console.log("[diff] sample map keys:", mapKeys.map(k => JSON.stringify(k).slice(0, 60)));
    }
  }
}

function getTokens(text: string): Token[] {
  return tokenMap.value.get(text) ?? [{ content: text.replace(/\n$/, ""), color: "#fbfbfb" }];
}

// ── Word-level diff ──

function getWordSpans(text: string, pairedText: string | undefined, type: "addition" | "deletion"): { text: string; emphasis: boolean }[] | undefined {
  if (!pairedText) return undefined;
  const oldText = type === "deletion" ? text : pairedText;
  const newText = type === "addition" ? text : pairedText;
  const changes = diffWordsWithSpace(
    oldText.replace(/\n$/, ""),
    newText.replace(/\n$/, ""),
  );

  const spans: { text: string; emphasis: boolean }[] = [];
  for (const c of changes) {
    if (type === "deletion" && c.added) continue;
    if (type === "addition" && c.removed) continue;
    spans.push({
      text: c.value,
      emphasis: type === "deletion" ? !!c.removed : !!c.added,
    });
  }
  return spans.length ? spans : undefined;
}

// ── Line selection ──

const selecting = ref(false);
const selectionSide = ref<"left" | "right" | null>(null);
const selectionStart = ref<number | null>(null);
const selectionEnd = ref<number | null>(null);

const selectedRange = computed(() => {
  if (selectionStart.value == null || selectionEnd.value == null) return null;
  return {
    start: Math.min(selectionStart.value, selectionEnd.value),
    end: Math.max(selectionStart.value, selectionEnd.value),
    side: selectionSide.value,
  };
});

function isLineSelected(lineNumber: number | null, side: "left" | "right"): boolean {
  if (lineNumber == null || !selectedRange.value || selectionSide.value !== side) return false;
  return lineNumber >= selectedRange.value.start && lineNumber <= selectedRange.value.end;
}

function onLineNumberMouseDown(lineNumber: number, side: "left" | "right") {
  if (showCommentInput.value) {
    // Don't allow new selection while comment input is open
    // User must cancel or submit first
    return;
  }
  selecting.value = true;
  selectionSide.value = side;
  selectionStart.value = lineNumber;
  selectionEnd.value = lineNumber;
}

function onLineNumberMouseEnter(lineNumber: number, side: "left" | "right") {
  if (selecting.value && selectionSide.value === side) {
    selectionEnd.value = lineNumber;
  }
}

function onMouseUp() {
  if (selecting.value && selectedRange.value) {
    showCommentInput.value = true;
  }
  selecting.value = false;
}

// ── Hover ──

const hoveredLine = ref<number | null>(null);
const hoveredSide = ref<"left" | "right" | null>(null);

function onLineHover(lineNumber: number, side: "left" | "right") {
  hoveredLine.value = lineNumber;
  hoveredSide.value = side;
}

function onLineLeave() {
  hoveredLine.value = null;
  hoveredSide.value = null;
}

// ── Comment input ──

const { commentInputActive: showCommentInput } = useChanges();

function submitComment(content: string) {
  if (!selectedRange.value) return;
  emit("add-comment", {
    filePath,
    startLine: selectedRange.value.start,
    endLine: selectedRange.value.end,
    side: selectedRange.value.side === "left" ? "deletions" : "additions",
    content,
  });
  clearSelection();
}

function clearSelection() {
  showCommentInput.value = false;
  selectionStart.value = null;
  selectionEnd.value = null;
  selectionSide.value = null;
}

// ── Comments lookup ──

function commentsOnLine(lineNumber: number, side: "left" | "right"): ChangeComment[] {
  const diffSide = side === "left" ? "deletions" : "additions";
  return comments.filter(
    (c) => !c.resolved && c.endLine === lineNumber && (c.side === diffSide || (!c.side && side === "right")),
  );
}

function isCommentInputOnLine(lineNumber: number, side: "left" | "right"): boolean {
  if (!showCommentInput.value || !selectedRange.value) return false;
  return selectedRange.value.end === lineNumber && selectionSide.value === side;
}

// ── Hover + button ──

function onPlusClick(lineNumber: number, side: "left" | "right") {
  selectionSide.value = side;
  selectionStart.value = lineNumber;
  selectionEnd.value = lineNumber;
  showCommentInput.value = true;
}

// ── Scroll sync ──

const leftScrollRef = ref<HTMLElement>();
const rightScrollRef = ref<HTMLElement>();
let syncing = false;

function syncScroll(source: "left" | "right") {
  if (syncing) return;
  syncing = true;
  const from = source === "left" ? leftScrollRef.value : rightScrollRef.value;
  const to = source === "left" ? rightScrollRef.value : leftScrollRef.value;
  if (from && to) {
    to.scrollTop = from.scrollTop;
  }
  requestAnimationFrame(() => { syncing = false; });
}

// ── Lifecycle ──

watch(() => fileDiff, () => {
  tokenMap.value = new Map();
  expandedHunks.value = new Set();
  fileLines.value = null;
  highlightAll();
}, { immediate: true });

onMounted(() => {
  document.addEventListener("mouseup", onMouseUp);
});

onUnmounted(() => {
  document.removeEventListener("mouseup", onMouseUp);
});
</script>

<template>
  <div
    class="diff-root"
    :style="{
      fontFamily: 'var(--diff-font)',
      fontSize: 'var(--diff-font-size)',
      lineHeight: 'var(--diff-line-height)',
      backgroundColor: 'var(--diff-bg)',
      color: 'var(--diff-fg)',
    }"
  >
    <div class="diff-split">
      <!-- Left column (deletions / old) -->
      <div
        ref="leftScrollRef"
        class="diff-code"
        @scroll="syncScroll('left')"
      >
        <template v-for="row in splitRows" :key="row.kind === 'separator' ? row.key : row.kind === 'line' ? row.left.key : row.kind === 'buffer-right' ? row.left.key : row.key">
          <ODiffSeparator
            v-if="row.kind === 'separator'"
            :collapsed-lines="row.collapsedLines"
            :is-first="row.isFirst"
            :is-last="row.isLast"
            :expanded="row.expanded"
            @expand="expandHunk(row.hunkIndex)"
          />

          <ODiffLine
            v-else-if="row.kind === 'line'"
            :line-number="row.left.lineNumber"
            :type="row.left.type"
            :tokens="getTokens(row.left.text)"
            :word-spans="row.left.type === 'deletion' ? getWordSpans(row.left.text, row.left.pairedText, 'deletion') : undefined"
            :selected="isLineSelected(row.left.lineNumber, 'left')"
            :hovered="hoveredLine === row.left.lineNumber && hoveredSide === 'left'"
            @mousedown-number="onLineNumberMouseDown($event, 'left')"
            @mouseenter-number="onLineNumberMouseEnter($event, 'left')"
            @mouseenter-line="onLineHover($event, 'left')"
            @mouseleave-line="onLineLeave"
          />

          <ODiffLine
            v-else-if="row.kind === 'buffer-right'"
            :line-number="row.left.lineNumber"
            :type="row.left.type"
            :tokens="getTokens(row.left.text)"
            :selected="isLineSelected(row.left.lineNumber, 'left')"
            :hovered="hoveredLine === row.left.lineNumber && hoveredSide === 'left'"
            @mousedown-number="onLineNumberMouseDown($event, 'left')"
            @mouseenter-number="onLineNumberMouseEnter($event, 'left')"
            @mouseenter-line="onLineHover($event, 'left')"
            @mouseleave-line="onLineLeave"
          />

          <div v-else-if="row.kind === 'buffer-left'" class="diff-buffer" />

          <!-- Comments on left side -->
          <template v-if="row.kind === 'line' || row.kind === 'buffer-right'">
            <div
              v-for="comment in commentsOnLine((row.kind === 'line' ? row.left : row.left).lineNumber!, 'left')"
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

            <div
              v-if="isCommentInputOnLine((row.kind === 'line' ? row.left : row.left).lineNumber!, 'left')"
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
        </template>
      </div>

      <!-- Right column (additions / new) -->
      <div
        ref="rightScrollRef"
        class="diff-code"
        @scroll="syncScroll('right')"
      >
        <template v-for="row in splitRows" :key="row.kind === 'separator' ? row.key + '-r' : row.kind === 'line' ? row.right.key : row.kind === 'buffer-left' ? row.right.key : row.key + '-r'">
          <ODiffSeparator
            v-if="row.kind === 'separator'"
            :collapsed-lines="row.collapsedLines"
            :is-first="row.isFirst"
            :is-last="row.isLast"
            :expanded="row.expanded"
            @expand="expandHunk(row.hunkIndex)"
          />

          <ODiffLine
            v-else-if="row.kind === 'line'"
            :line-number="row.right.lineNumber"
            :type="row.right.type"
            :tokens="getTokens(row.right.text)"
            :word-spans="row.right.type === 'addition' ? getWordSpans(row.right.text, row.right.pairedText, 'addition') : undefined"
            :selected="isLineSelected(row.right.lineNumber, 'right')"
            :hovered="hoveredLine === row.right.lineNumber && hoveredSide === 'right'"
            @mousedown-number="onLineNumberMouseDown($event, 'right')"
            @mouseenter-number="onLineNumberMouseEnter($event, 'right')"
            @mouseenter-line="onLineHover($event, 'right')"
            @mouseleave-line="onLineLeave"
          />

          <ODiffLine
            v-else-if="row.kind === 'buffer-left'"
            :line-number="row.right.lineNumber"
            :type="row.right.type"
            :tokens="getTokens(row.right.text)"
            :selected="isLineSelected(row.right.lineNumber, 'right')"
            :hovered="hoveredLine === row.right.lineNumber && hoveredSide === 'right'"
            @mousedown-number="onLineNumberMouseDown($event, 'right')"
            @mouseenter-number="onLineNumberMouseEnter($event, 'right')"
            @mouseenter-line="onLineHover($event, 'right')"
            @mouseleave-line="onLineLeave"
          />

          <div v-else-if="row.kind === 'buffer-right'" class="diff-buffer" />

          <!-- Comments on right side -->
          <template v-if="row.kind === 'line' || row.kind === 'buffer-left'">
            <div
              v-for="comment in commentsOnLine((row.kind === 'line' ? row.right : row.right).lineNumber!, 'right')"
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

            <div
              v-if="isCommentInputOnLine((row.kind === 'line' ? row.right : row.right).lineNumber!, 'right')"
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
        </template>
      </div>
    </div>

    <!-- Hover + button -->
    <Teleport to="body">
      <div
        v-if="hoveredLine != null && !showCommentInput && !selecting"
        class="pointer-events-none fixed z-50"
        :style="{
          top: '0',
          left: '0',
          display: 'none',
        }"
      />
    </Teleport>
  </div>
</template>

<style>
.diff-root {
  position: relative;
  overflow: hidden;
}

.diff-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
}

.diff-code {
  display: grid;
  grid-auto-flow: dense;
  grid-template-columns: minmax(min-content, max-content) 1fr;
  overflow: scroll clip;
  overscroll-behavior-x: none;
  tab-size: 2;
  padding-top: 8px;
  padding-bottom: 8px;
}

.diff-code::-webkit-scrollbar {
  width: 0;
  height: 6px;
}

.diff-code::-webkit-scrollbar-track {
  background: transparent;
}

.diff-code::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 3px;
}

.diff-root:hover .diff-code::-webkit-scrollbar-thumb {
  background-color: var(--diff-bg-context);
}

.diff-buffer {
  display: grid;
  grid-column: 1 / 3;
  grid-template-columns: subgrid;
  min-height: var(--diff-line-height);
  background-image: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent calc(3px * 1.414),
    var(--diff-bg-buffer) calc(3px * 1.414),
    var(--diff-bg-buffer) calc(4px * 1.414)
  );
  background-attachment: fixed;
  user-select: none;
}

.diff-annotation {
  grid-column: 1 / 3;
  background-color: var(--diff-bg-context);
  z-index: 3;
}

.diff-annotation-content {
  grid-column: 2 / -1;
  padding: 2px 0;
}

</style>
