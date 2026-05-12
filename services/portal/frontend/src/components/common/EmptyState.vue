<template>
  <div data-primitive-id="primitive.empty_state" class="empty-state">
    <p class="font-medium text-gray-700 dark:text-slate-200">{{ title }}</p>
    <p v-if="description" class="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>
