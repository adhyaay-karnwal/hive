<script setup lang="ts">
/**
 * Vue wrapper around @pierre/diffs vanilla JS API.
 * Renders a unified or split diff view using the FileDiff component.
 */

interface Props {
  diff: string;
  layout?: "unified" | "split";
}

const { diff, layout = "unified" } = defineProps<Props>();

const containerRef = ref<HTMLDivElement>();
let diffInstance: any = null;

async function renderDiff() {
  if (!containerRef.value || !diff) return;

  // Clear previous
  containerRef.value.innerHTML = "";

  try {
    const { FileDiff, parsePatch } = await import("@pierre/diffs");

    const files = parsePatch(diff);
    if (!files.length) return;

    for (const file of files) {
      const el = document.createElement("div");
      el.className = "mb-2";
      containerRef.value!.appendChild(el);

      diffInstance = new FileDiff(el, {
        file,
        layout,
        renderGutterNumbers: true,
        enableLineSelection: true,
      });
    }
  } catch (e) {
    console.error("Failed to render diff:", e);
    // Fallback: render raw diff
    const pre = document.createElement("pre");
    pre.className = "text-copy font-mono p-4 overflow-auto";
    pre.textContent = diff;
    containerRef.value!.appendChild(pre);
  }
}

onMounted(() => renderDiff());

watch(() => diff, () => renderDiff());
watch(() => layout, () => renderDiff());

onUnmounted(() => {
  diffInstance = null;
});
</script>

<template>
  <div ref="containerRef" class="min-h-0 overflow-auto" />
</template>
