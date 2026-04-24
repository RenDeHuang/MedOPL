<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <div class="pointer-events-none fixed inset-0 bg-mesh-gradient opacity-70"></div>
    <AppSidebar />
    <div class="relative min-h-screen lg:ml-60">
      <AppHeader :title="title" :subtitle="subtitle" />
      <main class="p-4 md:p-4 lg:p-5 xl:p-5">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from "@/layouts/AppHeader.vue";
import AppSidebar from "@/layouts/AppSidebar.vue";

defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>
