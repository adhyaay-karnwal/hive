<script setup lang="ts">
type Status = "idle" | "working" | "question" | "done" | "error";

interface Props {
  status: Status;
}

const { status } = defineProps<Props>();

const statusClasses: Record<Status, string> = {
  idle: "bg-inverse/30",
  working: "bg-accent",
  question: "bg-warn",
  done: "bg-success",
  error: "bg-danger",
};

const statusLabels: Record<Status, string> = {
  idle: "Idle",
  working: "Working",
  question: "Waiting",
  done: "Done",
  error: "Error",
};
</script>

<template>
  <div class="flex items-center gap-1.5">
    <span
      class="inline-block size-2"
      :class="[
        statusClasses[status],
        status === 'working' ? 'animate-pulse' : '',
      ]"
    />
    <span class="text-copy text-tertiary">{{ statusLabels[status] }}</span>
  </div>
</template>
