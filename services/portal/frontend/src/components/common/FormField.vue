<template>
  <label data-primitive-id="primitive.form_field" class="text-sm text-gray-700 dark:text-slate-200">
    <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">{{ label }}</span>
    <slot />
    <span v-if="hint" class="mt-1 block text-xs text-gray-500 dark:text-slate-400">{{ hint }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  hint?: string;
}>();
</script>
