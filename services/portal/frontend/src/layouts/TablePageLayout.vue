<template>
  <section class="space-y-4" :data-layout-id="layoutId">
    <div v-if="$slots.header || $slots.actions || title || subtitle" class="card p-5" data-layout-slot="header">
      <slot name="header">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 class="panel-title">{{ title }}</h2>
            <p v-if="subtitle" class="panel-subtitle">{{ subtitle }}</p>
          </div>
          <div v-if="$slots.actions" class="flex flex-wrap gap-2">
            <slot name="actions" />
          </div>
        </div>
      </slot>
    </div>

    <div v-if="$slots.filters" data-layout-slot="filters">
      <slot name="filters" />
    </div>

    <div data-layout-slot="table">
      <slot />
    </div>

    <div v-if="$slots.pagination" data-layout-slot="pagination">
      <slot name="pagination" />
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  layoutId?: string;
  title?: string;
  subtitle?: string;
}>(), {
  layoutId: "layout.table_page",
  title: "",
  subtitle: "",
});
</script>
