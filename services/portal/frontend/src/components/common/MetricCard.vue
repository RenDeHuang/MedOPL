<template>
  <div data-primitive-id="primitive.metric_card" class="card p-4">
    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-slate-500">{{ label }}</p>
    <p class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ value }}</p>
    <p v-if="hint" class="mt-1.5 text-xs text-gray-500 dark:text-slate-400">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  hint?: string;
}>();
</script>
