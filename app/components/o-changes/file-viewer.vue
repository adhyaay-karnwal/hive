<script lang="ts">
import type { SupportedLanguages } from "@pierre/diffs";

const extToLang: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  vue: "vue", svelte: "svelte", html: "html", css: "css", scss: "scss",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  md: "markdown", mdx: "mdx", py: "python", rs: "rust", go: "go",
  rb: "ruby", java: "java", c: "c", cpp: "cpp", h: "c", hpp: "cpp",
  sql: "sql", graphql: "graphql", sh: "bash", bash: "bash", zsh: "bash",
  dockerfile: "dockerfile", xml: "xml", svg: "xml",
};

function getLangFromPath(filePath: string): SupportedLanguages {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const name = filePath.split("/").pop()?.toLowerCase() || "";
  if (name === "dockerfile") return "dockerfile";
  return (extToLang[ext] as SupportedLanguages) || "text";
}
</script>

<script setup lang="ts">
type Props = {
  content: string;
  filePath: string;
};

const { content, filePath } = defineProps<Props>();

const isImage = computed(() => content.startsWith("data:image/"));

const containerRef = ref<HTMLDivElement>();
let fileInstance: any = null;

async function renderFile() {
  if (!containerRef.value || !content || isImage.value) return;

  if (fileInstance) {
    fileInstance.cleanUp();
    fileInstance = null;
  }
  containerRef.value.innerHTML = "";

  try {
    const { File: PierreFile } = await import("@pierre/diffs");
    const lang = getLangFromPath(filePath);

    fileInstance = new PierreFile({
      themeType: "dark",
      overflow: "scroll",
      disableFileHeader: true,
    });

    fileInstance.render({
      file: {
        name: filePath,
        contents: content,
        lang,
      },
      containerWrapper: containerRef.value,
    });
  } catch (e) {
    console.error("[file-viewer] Failed to render:", e);
  }
}

onMounted(() => renderFile());
watch(() => content, () => renderFile());
watch(() => filePath, () => renderFile());

onUnmounted(() => {
  if (fileInstance) {
    fileInstance.cleanUp();
    fileInstance = null;
  }
});
</script>

<template>
  <div v-if="isImage" class="flex h-full w-full items-center justify-center bg-black p-4">
    <img :src="content" :alt="filePath" class="max-w-full object-contain" />
  </div>
  <div v-else ref="containerRef" class="min-h-0" />
</template>
