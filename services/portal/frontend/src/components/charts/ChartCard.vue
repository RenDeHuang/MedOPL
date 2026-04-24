<template>
  <div class="card p-6">
    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 class="panel-title">{{ title }}</h2>
        <p v-if="subtitle" class="panel-subtitle">{{ subtitle }}</p>
      </div>
      <span v-if="badge" class="badge badge-primary">{{ badge }}</span>
    </div>
    <div class="min-h-[280px]">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
  badge?: string;
}>();
</script>
