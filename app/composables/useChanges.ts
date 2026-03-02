import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs";

type ChangedFile = {
  path: string;
  status: string;
};

type ChangeComment = {
  id: string;
  projectId: string;
  sessionId: string | null;
  filePath: string;
  startLine: number;
  endLine: number;
  side: "additions" | "deletions" | null;
  content: string;
  resolved: boolean;
  createdAt: string;
};

const files = ref<ChangedFile[]>([]);
const rawDiff = ref("");
const loading = ref(false);
const comments = ref<ChangeComment[]>([]);
const viewedFiles = ref(new Set<string>());
const selectedFile = ref<string | null>(null);
const selectedFileContent = ref<string | null>(null);
const loadingFileContent = ref(false);
const commentInputActive = ref(false);
const branch = ref("");
const repoName = ref("");
const unpushedCount = ref(0);
const pushing = ref(false);
let activeProjectId: string | null = null;

export function useChanges() {
  const route = useRoute();
  const projectId = computed(() => (route.params.id as string) || null);

  const parsedFiles = computed(() => {
    if (!rawDiff.value) return new Map<string, FileDiffMetadata>();
    try {
      const parsed = parsePatchFiles(rawDiff.value);
      const map = new Map<string, FileDiffMetadata>();
      for (const patch of parsed) {
        for (const file of patch.files) {
          map.set(file.name, file);
        }
      }
      return map;
    } catch {
      return new Map<string, FileDiffMetadata>();
    }
  });

  const selectedFileDiff = computed(() => {
    if (!selectedFile.value) return null;
    return parsedFiles.value.get(selectedFile.value) || null;
  });

  const unresolvedComments = computed(() =>
    comments.value.filter((c) => !c.resolved),
  );

  const selectedFileComments = computed(() =>
    comments.value.filter((c) => c.filePath === selectedFile.value),
  );

  async function fetchChanges() {
    const id = projectId.value;
    if (!id) return;
    loading.value = true;
    try {
      const data = await $fetch(`/api/projects/${id}/changes`);
      files.value = (data as any).files || [];
      rawDiff.value = (data as any).diff || "";
      branch.value = (data as any).branch || "";
      repoName.value = (data as any).repoName || "";
      unpushedCount.value = (data as any).unpushedCount || 0;
    } catch (e) {
      console.error("[changes] Failed to fetch:", e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchComments() {
    const id = projectId.value;
    if (!id) return;
    try {
      const data = await $fetch(`/api/projects/${id}/change-comments`);
      comments.value = data as ChangeComment[];
    } catch (e) {
      console.error("[changes] Failed to fetch comments:", e);
    }
  }

  async function addComment(comment: {
    filePath: string;
    startLine: number;
    endLine: number;
    side?: "additions" | "deletions";
    content: string;
  }) {
    const id = projectId.value;
    if (!id) return;

    const optimisticId = `temp-${Date.now()}`;
    comments.value = [
      ...comments.value,
      {
        id: optimisticId,
        projectId: id,
        sessionId: null,
        filePath: comment.filePath,
        startLine: comment.startLine,
        endLine: comment.endLine,
        side: comment.side || null,
        content: comment.content,
        resolved: false,
        createdAt: new Date().toISOString(),
      },
    ];

    try {
      await $fetch(`/api/projects/${id}/change-comments`, {
        method: "POST",
        body: comment,
      });
      await fetchComments();
    } catch (e) {
      comments.value = comments.value.filter((c) => c.id !== optimisticId);
      console.error("[changes] Failed to add comment:", e);
    }
  }

  async function deleteComment(commentId: string) {
    const id = projectId.value;
    if (!id) return;

    const prev = comments.value;
    comments.value = comments.value.filter((c) => c.id !== commentId);

    try {
      await $fetch(`/api/projects/${id}/change-comments/${commentId}`, {
        method: "DELETE",
      });
    } catch (e) {
      comments.value = prev;
      console.error("[changes] Failed to delete comment:", e);
    }
  }

  async function updateComment(commentId: string, content: string) {
    const id = projectId.value;
    if (!id || !content.trim()) return;

    const prev = comments.value;
    comments.value = comments.value.map((c) =>
      c.id === commentId ? { ...c, content: content.trim() } : c,
    );

    try {
      await $fetch(`/api/projects/${id}/change-comments/${commentId}`, {
        method: "PATCH",
        body: { content: content.trim() },
      });
    } catch (e) {
      comments.value = prev;
      console.error("[changes] Failed to update comment:", e);
    }
  }

  function toggleViewed(path: string) {
    const newSet = new Set(viewedFiles.value);
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }
    viewedFiles.value = newSet;
  }

  function markViewedAndNext(path: string) {
    const newSet = new Set(viewedFiles.value);
    const wasViewed = newSet.has(path);
    if (wasViewed) {
      newSet.delete(path);
      viewedFiles.value = newSet;
      return;
    }

    newSet.add(path);
    viewedFiles.value = newSet;

    const currentIndex = files.value.findIndex((f) => f.path === path);
    for (let i = 1; i <= files.value.length; i++) {
      const nextIndex = (currentIndex + i) % files.value.length;
      const nextFile = files.value[nextIndex];
      if (!newSet.has(nextFile.path)) {
        selectFile(nextFile.path);
        return;
      }
    }

    closeOverlay();
  }

  async function fetchFileContent(filePath: string) {
    const id = projectId.value;
    if (!id) return;
    loadingFileContent.value = true;
    try {
      const data = await $fetch(`/api/projects/${id}/file-content`, {
        query: { path: filePath },
      });
      selectedFileContent.value = (data as any).content || "";
    } catch (e) {
      console.error("[changes] Failed to fetch file content:", e);
      selectedFileContent.value = null;
    } finally {
      loadingFileContent.value = false;
    }
  }

  function selectFile(path: string) {
    if (selectedFile.value === path) {
      selectedFile.value = null;
      selectedFileContent.value = null;
      return;
    }
    selectedFile.value = path;
    selectedFileContent.value = null;

    if (!parsedFiles.value.has(path)) {
      fetchFileContent(path);
    }
  }

  function closeOverlay() {
    selectedFile.value = null;
    selectedFileContent.value = null;
  }

  async function requestChanges() {
    const id = projectId.value;
    if (!id || !unresolvedComments.value.length) return;

    const store = useHiveStore();
    const { sendMessage } = store.project(id);

    const lines = ["Please address the following review feedback:\n"];

    const byFile = new Map<string, ChangeComment[]>();
    for (const c of unresolvedComments.value) {
      const existing = byFile.get(c.filePath) || [];
      existing.push(c);
      byFile.set(c.filePath, existing);
    }

    for (const [filePath, fileComments] of byFile) {
      for (const c of fileComments) {
        const lineRange =
          c.startLine === c.endLine
            ? `line ${c.startLine}`
            : `lines ${c.startLine}-${c.endLine}`;
        lines.push(`## ${filePath} (${lineRange})`);
        lines.push(c.content);
        lines.push("");
      }
    }

    lines.push(
      "---\nAfter making changes, let me know when you're ready for another review.",
    );

    sendMessage(lines.join("\n"));

    const ids = unresolvedComments.value.map((c) => c.id);
    try {
      await $fetch(`/api/projects/${id}/change-comments/resolve`, {
        method: "PATCH",
        body: { ids },
      });
      await fetchComments();
    } catch (e) {
      console.error("[changes] Failed to resolve comments:", e);
    }

    closeOverlay();
  }

  const commitMessage = computed(() => {
    const modified = files.value.filter((f) => f.status === "M").map((f) => f.path.split("/").pop());
    const added = files.value.filter((f) => f.status === "A" || f.status === "?").map((f) => f.path.split("/").pop());
    const deleted = files.value.filter((f) => f.status === "D").map((f) => f.path.split("/").pop());

    const total = files.value.length;
    if (total === 0) return "";

    const lines = [`Update ${total} file${total !== 1 ? "s" : ""}`];
    if (modified.length) lines.push(`\nModified: ${modified.join(", ")}`);
    if (added.length) lines.push(`Added: ${added.join(", ")}`);
    if (deleted.length) lines.push(`Deleted: ${deleted.join(", ")}`);

    return lines.join("\n");
  });

  const committing = ref(false);
  const commitError = ref<string | null>(null);

  async function commit(message: string) {
    const id = projectId.value;
    if (!id || !message.trim()) return false;

    committing.value = true;
    commitError.value = null;

    try {
      await $fetch(`/api/projects/${id}/commit`, {
        method: "POST",
        body: { message: message.trim() },
      });

      viewedFiles.value = new Set();
      selectedFile.value = null;
      selectedFileContent.value = null;
      await fetchChanges();

      return true;
    } catch (e: any) {
      console.error("[changes] Commit failed:", e);
      commitError.value = e.data?.message || e.message || "Failed to commit";
      return false;
    } finally {
      committing.value = false;
    }
  }

  async function push() {
    const id = projectId.value;
    if (!id || pushing.value) return false;

    pushing.value = true;
    try {
      await $fetch(`/api/projects/${id}/push`, { method: "POST" });
      await fetchChanges();
      return true;
    } catch (e: any) {
      console.error("[changes] Push failed:", e);
      return false;
    } finally {
      pushing.value = false;
    }
  }

  function init() {
    const id = projectId.value;
    if (id && id !== activeProjectId) {
      activeProjectId = id;
      files.value = [];
      rawDiff.value = "";
      comments.value = [];
      viewedFiles.value = new Set();
      selectedFile.value = null;
      fetchChanges();
      fetchComments();
    }
  }

  return {
    files,
    rawDiff,
    loading,
    comments,
    viewedFiles,
    selectedFile,
    selectedFileContent,
    loadingFileContent,
    commentInputActive,
    parsedFiles,
    selectedFileDiff,
    selectedFileComments,
    unresolvedComments,
    commitMessage,
    committing,
    commitError,
    branch,
    repoName,
    unpushedCount,
    pushing,

    fetchChanges,
    fetchComments,
    addComment,
    deleteComment,
    updateComment,
    toggleViewed,
    markViewedAndNext,
    selectFile,
    closeOverlay,
    requestChanges,
    commit,
    push,
    init,
  };
}
