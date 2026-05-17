<template>
  <div data-layout-id="layout.app_shell" class="min-h-screen bg-slate-50 text-gray-950 dark:bg-slate-950 dark:text-white">
    <AppSidebar :mobile-open="mobileNavOpen" @close-mobile="mobileNavOpen = false" />
    <div class="min-h-screen lg:ml-64">
      <AppHeader :title="title" :subtitle="subtitle" @toggle-mobile-nav="mobileNavOpen = !mobileNavOpen" />
      <main data-component-id="app-shell.main" class="mx-auto w-full max-w-[1500px] p-3 sm:p-4 lg:p-5">
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
