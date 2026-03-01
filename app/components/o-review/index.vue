<script setup lang="ts">
import {
  CheckIcon,
  XIcon,
  MessageSquareIcon,
  SplitIcon,
  AlignJustifyIcon,
} from "lucide-vue-next";

interface Props {
  reviewId: string;
}

const { reviewId } = defineProps<Props>();

const { data: review, refresh } = await useFetch(
  `/api/reviews/${reviewId}`,
);

const activeFile = ref<string | null>(null);
const layout = ref<"unified" | "split">("unified");
const commitMessage = ref("");
const approving = ref(false);

async function approve() {
  approving.value = true;
  try {
    await $fetch(`/api/reviews/${reviewId}/approve`, {
      method: "POST",
      body: { commitMessage: commitMessage.value || undefined },
    });
    await refresh();
  } finally {
    approving.value = false;
  }
}

async function addComment(content: string) {
  if (!activeFile.value) return;
  await $fetch(`/api/reviews/${reviewId}/comments`, {
    method: "POST",
    body: {
      filePath: activeFile.value,
      author: "user",
      content,
    },
  });
  await refresh();
}
</script>

<template>
  <div v-if="review" class="flex h-full flex-col">
    <!-- Header -->
    <OHeader title="Review" :description="`Iteration ${review.iteration}`">
      <template #trailing>
        <div class="flex items-center gap-1">
          <OButton
            variant="transparent"
           
            :icon-left="AlignJustifyIcon"
            :class="layout === 'unified' ? 'text-primary' : ''"
            @click="layout = 'unified'"
          />
          <OButton
            variant="transparent"
           
            :icon-left="SplitIcon"
            :class="layout === 'split' ? 'text-primary' : ''"
            @click="layout = 'split'"
          />
        </div>

        <span
          class="text-copy px-2 py-0.5 font-medium"
          :class="{
            'bg-success-subtle text-success': review.status === 'approved',
            'bg-warn-subtle text-warn': review.status === 'user_review',
            'bg-surface-1 text-secondary': review.status === 'agent_review',
          }"
        >
          {{ review.status.replace(/_/g, " ") }}
        </span>
      </template>
    </OHeader>

    <div class="flex min-h-0 flex-1">
      <!-- File tree sidebar -->
      <div class="border-edge w-56 shrink-0 overflow-auto border-r p-1.5">
        <p class="text-copy text-tertiary mb-1 px-2 font-medium uppercase">
          Changed Files ({{ review.changedFiles?.length || 0 }})
        </p>
        <OReviewFileTree
          :files="review.changedFiles || []"
          :active-file="activeFile"
          @select="activeFile = $event"
        />
      </div>

      <!-- Diff viewer -->
      <div class="flex min-w-0 flex-1 flex-col">
        <div v-if="review.diff" class="flex-1 overflow-auto">
          <OReviewDiffViewer :diff="review.diff" :layout="layout" />
        </div>
        <div v-else class="flex flex-1 items-center justify-center">
          <p class="text-copy text-tertiary">No changes to review</p>
        </div>
      </div>
    </div>

    <!-- Comments + actions -->
    <div class="border-edge flex items-center justify-between border-t p-3">
      <div class="flex-1">
        <!-- Agent summary -->
        <p v-if="review.summary" class="text-copy text-secondary line-clamp-2">
          {{ review.summary }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <OInput
          v-if="review.status !== 'approved'"
          v-model="commitMessage"
          placeholder="Commit message (optional)"
          class="w-64"
        />
        <OButton
          v-if="review.status !== 'approved'"
          variant="primary"
         
          :icon-left="CheckIcon"
          :loading="approving"
          @click="approve"
        >
          Approve & Commit
        </OButton>
      </div>
    </div>
  </div>
</template>
