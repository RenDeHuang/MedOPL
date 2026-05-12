<template>
  <section data-primitive-id="primitive.filter_toolbar" class="card p-5">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h2 class="panel-title">{{ title }}</h2>
        <p v-if="subtitle" class="panel-subtitle">{{ subtitle }}</p>
      </div>
      <div class="grid gap-3 md:grid-cols-4">
        <slot />
      </div>
    </div>
    <div v-if="$slots.actions" class="mt-3 flex flex-wrap gap-2">
      <slot name="actions" />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>
