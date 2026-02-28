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

// Singleton state — survives across component mounts
const files = ref<ChangedFile[]>([]);
const rawDiff = ref("");
const loading = ref(false);
const comments = ref<ChangeComment[]>([]);
const viewedFiles = ref(new Set<string>());
const selectedFile = ref<string | null>(null);
const selectedFileContent = ref<string | null>(null);
const loadingFileContent = ref(false);
let activeProjectId: string | null = null;

export function useChanges() {
  const route = useRoute();
  const projectId = computed(() => (route.params.id as string) || null);

  // Parsed diff metadata per file (keyed by file name)
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

  // Fetch changes from git
  async function fetchChanges() {
    const id = projectId.value;
    if (!id) return;
    loading.value = true;
    console.log(`[changes] Fetching changes for project ${id}...`);
    try {
      const data = await $fetch(`/api/projects/${id}/changes`);
      files.value = (data as any).files || [];
      rawDiff.value = (data as any).diff || "";
      console.log(`[changes] Got ${files.value.length} files, ${rawDiff.value.length} bytes diff`);
    } catch (e) {
      console.error("[changes] Failed to fetch:", e);
    } finally {
      loading.value = false;
    }
  }

  // Fetch comments from DB
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

  // Create a comment
  async function addComment(comment: {
    filePath: string;
    startLine: number;
    endLine: number;
    side?: "additions" | "deletions";
    content: string;
  }) {
    const id = projectId.value;
    if (!id) return;
    try {
      await $fetch(`/api/projects/${id}/change-comments`, {
        method: "POST",
        body: comment,
      });
      await fetchComments();
    } catch (e) {
      console.error("[changes] Failed to add comment:", e);
    }
  }

  // Delete a comment
  async function deleteComment(commentId: string) {
    const id = projectId.value;
    if (!id) return;
    try {
      await $fetch(`/api/projects/${id}/change-comments/${commentId}`, {
        method: "DELETE",
      });
      await fetchComments();
    } catch (e) {
      console.error("[changes] Failed to delete comment:", e);
    }
  }

  // Toggle viewed/staged state
  function toggleViewed(path: string) {
    const newSet = new Set(viewedFiles.value);
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }
    viewedFiles.value = newSet;
  }

  // Fetch file content for files without a diff (untracked/new)
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

  // Select a file to view its diff
  function selectFile(path: string) {
    if (selectedFile.value === path) {
      selectedFile.value = null;
      selectedFileContent.value = null;
      return;
    }
    selectedFile.value = path;
    selectedFileContent.value = null;

    // If no diff available for this file, fetch its content instead
    if (!parsedFiles.value.has(path)) {
      fetchFileContent(path);
    }
  }

  // Close the overlay
  function closeOverlay() {
    selectedFile.value = null;
    selectedFileContent.value = null;
  }

  // Request changes — assemble comments into prompt
  async function requestChanges() {
    const id = projectId.value;
    if (!id || !unresolvedComments.value.length) return;

    const store = useHiveStore();

    // Assemble the feedback prompt
    const lines = ["Please address the following review feedback:\n"];

    // Group by file
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

    const prompt = lines.join("\n");
    store.sendPrompt(id, prompt);

    // Resolve all comments
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

  // Generate a default commit message from the changed files
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

  // Commit all changes
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

      // Reset state after successful commit
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

  // Initialize when project changes
  function init() {
    const id = projectId.value;
    console.log(`[changes] init called, projectId=${id}, activeProjectId=${activeProjectId}`);
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
    // State
    files,
    rawDiff,
    loading,
    comments,
    viewedFiles,
    selectedFile,
    selectedFileContent,
    loadingFileContent,
    parsedFiles,
    selectedFileDiff,
    selectedFileComments,
    unresolvedComments,
    commitMessage,
    committing,
    commitError,

    // Actions
    fetchChanges,
    fetchComments,
    addComment,
    deleteComment,
    toggleViewed,
    selectFile,
    closeOverlay,
    requestChanges,
    commit,
    init,
  };
}
