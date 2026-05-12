<template>
  <section class="space-y-4" :data-layout-id="layoutId">
    <div data-layout-slot="hero">
      <slot name="hero" />
    </div>

    <div v-if="$slots.metrics" data-layout-slot="metrics">
      <slot name="metrics" />
    </div>

    <div v-if="$slots.primary" data-layout-slot="primary">
      <slot name="primary" />
    </div>

    <div v-if="$slots.secondary" data-layout-slot="secondary">
      <slot name="secondary" />
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  layoutId?: string;
}>(), {
  layoutId: "layout.dashboard_page",
});
</script>
