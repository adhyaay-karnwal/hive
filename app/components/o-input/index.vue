<script setup lang="ts">
interface Props {
  name?: string;
  type?: "text" | "password" | "email" | "number" | "url";
  required?: boolean;
  placeholder?: string;
  autocomplete?: string;
  disabled?: boolean;
  leading?: string;
  trailing?: string;
}

const {
  name,
  type = "text",
  required = false,
  placeholder = "",
  autocomplete = "",
  disabled = false,
  leading = "",
  trailing = "",
} = defineProps<Props>();

const model = defineModel<string | number>();

const inputElement = useTemplateRef<HTMLInputElement>("input-element");

defineExpose({
  focus: () => {
    inputElement.value?.focus();
  },
});

const slots = useSlots();
const hasLeading = computed(() => !!leading || !!slots.leading);
const hasTrailing = computed(() => !!trailing || !!slots.trailing);
</script>

<template>
  <div
    class="bg-surface-1 border-edge text-primary text-copy has-[:focus]:bg-base has-[:focus]:border-edge-strong flex h-8 overflow-hidden border leading-none transition-all outline-none"
    :class="[
      disabled
        ? 'bg-surface-2 cursor-not-allowed opacity-50'
        : 'hover:border-edge-strong',
    ]"
  >
    <div
      v-if="$slots.leading || leading"
      class="border-edge flex items-center px-2"
    >
      <template v-if="leading">{{ leading }}</template>
      <template v-else><slot name="leading" /></template>
    </div>
    <input
      ref="input-element"
      :id="name"
      :name="name"
      :type="type"
      :required="required"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :disabled="disabled"
      v-model="model"
      class="text-copy h-full w-full outline-none"
      :class="[
        hasLeading ? 'pl-0' : 'pl-2.5',
        hasTrailing ? 'pr-0' : 'pr-2.5',
      ]"
    />
    <div
      v-if="$slots.trailing || trailing"
      class="border-edge flex items-center px-2"
    >
      <template v-if="trailing">{{ trailing }}</template>
      <template v-else><slot name="trailing" /></template>
    </div>
  </div>
</template>
