<script lang="ts">
import type {
  FileDiffMetadata,
  DiffLineAnnotation,
  SelectedLineRange,
} from "@pierre/diffs";

type CommentMeta = {
  type: "comment" | "input";
  id?: string;
  content?: string;
  resolved?: boolean;
};
</script>

<script setup lang="ts">
type ChangeComment = {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  side: "additions" | "deletions" | null;
  content: string;
  resolved: boolean;
};

type Props = {
  fileDiff: FileDiffMetadata;
  filePath: string;
  comments: ChangeComment[];
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
};

const { fileDiff, filePath, comments } = defineProps<Props>();
const emit = defineEmits<Emits>();

const containerRef = ref<HTMLDivElement>();
let diffInstance: any = null;
const ready = ref(false);
let cachedHoverBtn: HTMLElement | null = null;

// Comment input state
const showCommentInput = ref(false);
const selectedRange = ref<{ start: number; end: number; side: string } | null>(null);

function buildAnnotations(): DiffLineAnnotation<CommentMeta>[] {
  const annotations: DiffLineAnnotation<CommentMeta>[] = [];

  // Existing comments
  for (const c of comments) {
    annotations.push({
      side: (c.side as "additions" | "deletions") || "additions",
      lineNumber: c.endLine,
      metadata: {
        type: "comment",
        id: c.id,
        content: c.content,
        resolved: c.resolved,
      },
    });
  }

  // Active comment input annotation
  if (showCommentInput.value && selectedRange.value) {
    annotations.push({
      side: (selectedRange.value.side as "additions" | "deletions") || "additions",
      lineNumber: selectedRange.value.end,
      metadata: {
        type: "input",
      },
    });
  }

  return annotations;
}

function createCommentBubble(meta: CommentMeta): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    padding: 8px 10px;
    margin: 4px 6px;
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.5;
    background: var(--color-base-1);
    border: 1px solid var(--border-color-edge);
    color: var(--text-color-primary);
    font-family: var(--font-sans);
  `;

  if (meta.resolved) {
    wrapper.style.opacity = "0.35";
  }

  const text = document.createElement("p");
  text.textContent = meta.content || "";
  text.style.margin = "0";
  wrapper.appendChild(text);

  if (!meta.resolved && meta.id) {
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.style.cssText = `
      margin-top: 4px; font-size: 11px; cursor: pointer;
      border: none; background: none; padding: 0;
      color: var(--text-color-tertiary);
    `;
    deleteBtn.addEventListener("mouseenter", () => {
      deleteBtn.style.color = "var(--text-color-primary)";
    });
    deleteBtn.addEventListener("mouseleave", () => {
      deleteBtn.style.color = "var(--text-color-tertiary)";
    });
    deleteBtn.addEventListener("click", () => emit("delete-comment", meta.id!));
    wrapper.appendChild(deleteBtn);
  }

  return wrapper;
}

function createCommentInput(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    padding: 8px 10px;
    margin: 4px 6px;
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.5;
    background: var(--color-base-1);
    border: 1px solid var(--border-color-edge-strong);
    color: var(--text-color-primary);
    font-family: var(--font-sans);
  `;

  const label = document.createElement("div");
  const range = selectedRange.value;
  const lineText = range?.start === range?.end
    ? `Line ${range?.start}`
    : `Lines ${range?.start}–${range?.end}`;
  label.textContent = lineText;
  label.style.cssText = `
    font-size: 11px; margin-bottom: 6px;
    color: var(--text-color-tertiary);
  `;
  wrapper.appendChild(label);

  const textarea = document.createElement("textarea");
  textarea.placeholder = "Add review feedback...";
  textarea.rows = 3;
  textarea.style.cssText = `
    width: 100%; resize: none; border-radius: 6px;
    border: 1px solid var(--border-color-edge);
    background: var(--color-base-0);
    color: var(--text-color-primary);
    padding: 8px; font-size: 13px;
    font-family: var(--font-sans);
    outline: none; line-height: 1.5;
    box-sizing: border-box;
  `;
  textarea.addEventListener("focus", () => {
    textarea.style.borderColor = "var(--border-color-edge-strong)";
  });
  textarea.addEventListener("blur", () => {
    textarea.style.borderColor = "var(--border-color-edge)";
  });
  wrapper.appendChild(textarea);

  const actions = document.createElement("div");
  actions.style.cssText = `
    margin-top: 6px; display: flex; justify-content: flex-end; gap: 6px;
  `;

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.cssText = `
    padding: 3px 10px; border-radius: 6px; font-size: 12px; height: 28px;
    cursor: pointer; border: 1px solid transparent;
    background: transparent;
    color: var(--text-color-secondary);
    font-family: var(--font-sans);
  `;
  cancelBtn.addEventListener("mouseenter", () => {
    cancelBtn.style.background = "var(--color-base-2)";
  });
  cancelBtn.addEventListener("mouseleave", () => {
    cancelBtn.style.background = "transparent";
  });
  cancelBtn.addEventListener("click", () => cancelComment());
  actions.appendChild(cancelBtn);

  const submitBtn = document.createElement("button");
  submitBtn.textContent = "Comment";
  submitBtn.style.cssText = `
    padding: 3px 10px; border-radius: 6px; font-size: 12px; height: 28px;
    cursor: pointer; border: 1px solid var(--border-color-edge);
    background: var(--color-base-2);
    color: var(--text-color-primary);
    font-family: var(--font-sans);
  `;
  submitBtn.addEventListener("mouseenter", () => {
    submitBtn.style.background = "var(--color-base-3)";
  });
  submitBtn.addEventListener("mouseleave", () => {
    submitBtn.style.background = "var(--color-base-2)";
  });
  submitBtn.addEventListener("click", () => {
    const text = textarea.value.trim();
    if (text) submitComment(text);
  });
  actions.appendChild(submitBtn);

  wrapper.appendChild(actions);

  // Focus textarea after it's in the DOM
  requestAnimationFrame(() => textarea.focus());

  // Keyboard shortcuts
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      const text = textarea.value.trim();
      if (text) submitComment(text);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelComment();
    }
  });

  return wrapper;
}

function openCommentInput(start: number, end: number, side: string) {
  selectedRange.value = { start, end, side };
  showCommentInput.value = true;
  updateAnnotations();
}

function submitComment(text: string) {
  if (!selectedRange.value) return;

  emit("add-comment", {
    filePath,
    startLine: selectedRange.value.start,
    endLine: selectedRange.value.end,
    side: (selectedRange.value.side as "additions" | "deletions") || undefined,
    content: text,
  });

  showCommentInput.value = false;
  selectedRange.value = null;
  if (diffInstance) {
    diffInstance.setSelectedLines(null);
  }
  updateAnnotations();
}

function cancelComment() {
  showCommentInput.value = false;
  selectedRange.value = null;
  if (diffInstance) {
    diffInstance.setSelectedLines(null);
  }
  updateAnnotations();
}

function updateAnnotations() {
  if (!diffInstance) return;
  diffInstance.setLineAnnotations(buildAnnotations());
  // Re-render with the same fileDiff — pierre will skip the expensive
  // highlight/AST rebuild (same reference) but update annotations
  diffInstance.render({
    fileDiff,
    containerWrapper: containerRef.value,
    lineAnnotations: buildAnnotations(),
  });
}

async function renderDiff() {
  if (!containerRef.value || !fileDiff) return;

  if (diffInstance) {
    diffInstance.cleanUp();
    diffInstance = null;
  }
  containerRef.value.innerHTML = "";

  try {
    const { FileDiff } = await import("@pierre/diffs");

    ready.value = false;

    const instance = new FileDiff<CommentMeta>({
      diffStyle: "split",
      diffIndicators: "bars",
      lineDiffType: "word-alt",
      themeType: "dark",
      disableFileHeader: true,
      enableLineSelection: true,
      enableHoverUtility: true,
      overflow: "scroll",

      // Line selection via click+drag on line numbers
      onLineSelected(range: SelectedLineRange | null) {
        if (range) {
          openCommentInput(
            range.start,
            range.end,
            range.side || "additions",
          );
        }
      },

      // + button on line number hover for adding comments (cached — created once)
      renderHoverUtility(getHoveredLine: any) {
        if (cachedHoverBtn) return cachedHoverBtn;

        const btn = document.createElement("button");
        btn.textContent = "+";
        btn.style.cssText = `
          width: 18px; height: 18px; border-radius: 4px;
          background: var(--color-accent);
          color: var(--color-accent-on);
          border: none; cursor: pointer;
          font-size: 13px; font-weight: 600;
          display: flex; align-items: center; justify-content: center;
          line-height: 1; opacity: 0.7;
        `;
        btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
        btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.7"; });

        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const line = getHoveredLine();
          if (line) {
            openCommentInput(line.lineNumber, line.lineNumber, line.side);
          }
        });

        cachedHoverBtn = btn;
        return btn;
      },

      // Render inline annotations (comments + comment input)
      renderAnnotation(annotation: DiffLineAnnotation<CommentMeta>) {
        if (!annotation.metadata) return undefined;

        if (annotation.metadata.type === "input") {
          return createCommentInput();
        }

        return createCommentBubble(annotation.metadata);
      },
    });

    // Intercept the highlight completion to show the diff only when ready
    const originalHandleHighlight = instance.handleHighlightRender;
    instance.handleHighlightRender = () => {
      originalHandleHighlight.call(instance);
      ready.value = true;
    };

    instance.render({
      fileDiff,
      containerWrapper: containerRef.value,
      lineAnnotations: buildAnnotations(),
    });

    // If Shiki was already loaded (cached), highlighting happens synchronously
    // and handleHighlightRender won't fire again — so check immediately
    if (!ready.value) {
      requestAnimationFrame(() => {
        if (containerRef.value && containerRef.value.innerHTML.length > 100) {
          ready.value = true;
        }
      });
    }

    diffInstance = instance;
  } catch (e) {
    console.error("[diff-viewer] Failed:", e);
  }
}

onMounted(() => renderDiff());
watch(() => fileDiff, () => renderDiff());
watch(() => comments, () => updateAnnotations());

onUnmounted(() => {
  if (diffInstance) {
    diffInstance.cleanUp();
    diffInstance = null;
  }
  cachedHoverBtn = null;
});
</script>

<template>
  <div class="relative min-h-0">
    <!-- Loading placeholder while Shiki highlights -->
    <div
      v-if="!ready"
      class="flex items-center justify-center py-12"
    >
      <span class="text-copy-sm text-tertiary">Loading diff...</span>
    </div>
    <!-- Diff container — hidden until highlighting is complete -->
    <div
      ref="containerRef"
      :style="{ visibility: ready ? 'visible' : 'hidden', position: ready ? 'relative' : 'absolute' }"
    />
  </div>
</template>
