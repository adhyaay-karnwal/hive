<script setup lang="ts">
import { FileIcon, FilePlusIcon, FileMinusIcon, FileEditIcon } from "lucide-vue-next";

interface Props {
  files: string[];
  activeFile?: string | null;
}

const { files, activeFile } = defineProps<Props>();
const emit = defineEmits<{
  select: [file: string];
}>();

function getIcon(file: string) {
  // Simple heuristic based on git status prefixes
  if (file.startsWith("+")) return FilePlusIcon;
  if (file.startsWith("-")) return FileMinusIcon;
  return FileEditIcon;
}

function getFileName(file: string) {
  // Strip git status prefix if present
  return file.replace(/^[+-] /, "");
}
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <OHover
      v-for="file in files"
      :key="file"
      :active="activeFile === file"
      full-width
      class="cursor-default"
    >
      <OButton
        variant="transparent"
       
        class="w-full justify-start px-2"
        :icon-left="getIcon(file)"
        :class="file.startsWith('+') ? 'text-success' : file.startsWith('-') ? 'text-danger' : ''"
        @click="emit('select', file)"
      >
        {{ getFileName(file) }}
      </OButton>
    </OHover>
  </div>
</template>
