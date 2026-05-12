<template>
  <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]" :data-layout-id="layoutId">
    <div class="space-y-4" data-layout-slot="primary">
      <slot name="primary" />
    </div>

    <div class="space-y-4" data-layout-slot="secondary">
      <slot name="secondary" />
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  layoutId?: string;
}>(), {
  layoutId: "layout.detail_page",
});
</script>
