import type { FileTreeNode } from "~/../../server/api/projects/[id]/file-tree.get";

type FileComment = {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  resolved: boolean;
  createdAt: string;
};

// Module-level singleton — shared across sidebar + overlay
const selectedFile = ref<string | null>(null);
const selectedFileContent = ref<string | null>(null);
const loadingFileContent = ref(false);
const comments = ref<FileComment[]>([]);

// Collapsed folder paths keyed by project ID, persisted via localStorage
const collapsedByProject = useLocalStorage<Record<string, string[]>>("hive:collapsed-folders", {});

export function useFileTree() {
  const route = useRoute();
  const projectId = computed(() => route.params.id as string | null);

  const collapsedPaths = computed({
    get(): Set<string> {
      const id = projectId.value;
      if (!id) return new Set();
      return new Set(collapsedByProject.value[id] ?? []);
    },
    set(next: Set<string>) {
      const id = projectId.value;
      if (!id) return;
      collapsedByProject.value = { ...collapsedByProject.value, [id]: [...next] };
    },
  });

  function toggleFolder(path: string) {
    const next = new Set(collapsedPaths.value);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    collapsedPaths.value = next;
  }

  function initCollapsed(nodes: FileTreeNode[]) {
    const id = projectId.value;
    if (!id || collapsedByProject.value[id] !== undefined) return;
    function collect(nodes: FileTreeNode[]): string[] {
      const paths: string[] = [];
      for (const node of nodes) {
        if (node.type === "dir") {
          paths.push(node.path);
          paths.push(...collect(node.children));
        }
      }
      return paths;
    }
    collapsedByProject.value = { ...collapsedByProject.value, [id]: collect(nodes) };
  }

  // ── Tree ────────────────────────────────────────────────────────────────
  const { data: treeData, refresh: refreshTree } = useFetch(
    () => `/api/projects/${projectId.value}/file-tree`,
    { watch: [projectId], immediate: true },
  );

  // Refresh the tree whenever the server emits an update event via SSE
  const { data: sseData } = useEventSource("/api/events");
  watch(sseData, () => {
    if (projectId.value) refreshTree();
  });

  const tree = computed<FileTreeNode[]>(() => (treeData.value as any)?.tree ?? []);

  // ── File content ────────────────────────────────────────────────────────
  async function selectFile(path: string) {
    if (selectedFile.value === path) {
      selectedFile.value = null;
      selectedFileContent.value = null;
      return;
    }
    selectedFile.value = path;
    selectedFileContent.value = null;
    loadingFileContent.value = true;
    try {
      const data = await $fetch(`/api/projects/${projectId.value}/file-content`, {
        query: { path },
      });
      selectedFileContent.value = (data as any).content ?? null;
    } catch {
      selectedFileContent.value = null;
    } finally {
      loadingFileContent.value = false;
    }
  }

  function closeFile() {
    selectedFile.value = null;
    selectedFileContent.value = null;
  }

  // ── Comments ────────────────────────────────────────────────────────────
  const selectedFileComments = computed(() =>
    comments.value.filter((c) => c.filePath === selectedFile.value),
  );

  async function fetchComments() {
    const id = projectId.value;
    if (!id) return;
    try {
      const data = await $fetch(`/api/projects/${id}/change-comments`);
      comments.value = data as FileComment[];
    } catch {}
  }

  async function addComment(comment: {
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
  }) {
    const id = projectId.value;
    if (!id) return;
    const tempId = `temp-${Date.now()}`;
    comments.value = [
      ...comments.value,
      {
        id: tempId,
        filePath: comment.filePath,
        startLine: comment.startLine,
        endLine: comment.endLine,
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
    } catch {
      comments.value = comments.value.filter((c) => c.id !== tempId);
    }
  }

  async function deleteComment(commentId: string) {
    const id = projectId.value;
    if (!id) return;
    const prev = comments.value;
    comments.value = comments.value.filter((c) => c.id !== commentId);
    try {
      await $fetch(`/api/projects/${id}/change-comments/${commentId}`, { method: "DELETE" });
    } catch {
      comments.value = prev;
    }
  }

  async function updateComment(commentId: string, content: string) {
    const id = projectId.value;
    if (!id) return;
    const prev = comments.value;
    comments.value = comments.value.map((c) =>
      c.id === commentId ? { ...c, content } : c,
    );
    try {
      await $fetch(`/api/projects/${id}/change-comments/${commentId}`, {
        method: "PATCH",
        body: { content },
      });
    } catch {
      comments.value = prev;
    }
  }

  return {
    tree,
    refreshTree,
    selectedFile,
    selectedFileContent,
    loadingFileContent,
    selectedFileComments,
    comments,
    selectFile,
    closeFile,
    fetchComments,
    addComment,
    deleteComment,
    updateComment,
    collapsedPaths,
    toggleFolder,
    initCollapsed,
  };
}
