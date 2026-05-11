<template>
  <section class="card p-5">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 class="panel-title">{{ title }}</h2>
        <p v-if="subtitle" class="panel-subtitle">{{ subtitle }}</p>
      </div>
      <slot name="actions"></slot>
    </div>
    <div class="mt-4">
      <slot></slot>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>
