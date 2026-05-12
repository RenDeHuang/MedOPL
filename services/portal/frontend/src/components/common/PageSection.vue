<template>
  <section data-primitive-id="primitive.page_section" class="card p-5">
    <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="panel-title">{{ title }}</h2>
        <p v-if="subtitle" class="panel-subtitle">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </div>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>
