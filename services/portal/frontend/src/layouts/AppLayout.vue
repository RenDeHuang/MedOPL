<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <div class="pointer-events-none fixed inset-0 bg-mesh-gradient opacity-70"></div>
    <AppSidebar :mobile-open="mobileNavOpen" @close-mobile="mobileNavOpen = false" />
    <div class="relative min-h-screen lg:ml-60">
      <AppHeader :title="title" :subtitle="subtitle" @toggle-mobile-nav="mobileNavOpen = !mobileNavOpen" />
      <main class="p-4 md:p-4 lg:p-5 xl:p-5">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import AppHeader from "@/layouts/AppHeader.vue";
import AppSidebar from "@/layouts/AppSidebar.vue";

defineProps<{
  title: string;
  subtitle?: string;
}>();

const mobileNavOpen = ref(false);
</script>
