<template>
  <aside class="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-gray-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:flex lg:flex-col">
    <div class="flex h-14 items-center gap-3 border-b border-gray-100 px-5 dark:border-slate-800">
      <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-xs font-bold text-white shadow-glow">
        M
      </div>
      <div>
        <div class="text-sm font-semibold text-gray-950 dark:text-white">MedOPL</div>
        <div class="text-[11px] text-gray-500 dark:text-slate-400">Portal 控制台</div>
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-3">
      <div class="mb-5">
        <div class="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">工作区</div>
        <RouterLink
          v-for="item in userItems"
          :key="item.to"
          :to="item.to"
          class="mb-1 flex items-center rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          active-class="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"
        >
          {{ item.label }}
        </RouterLink>
      </div>

      <div v-if="isAdmin">
        <div class="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">管理后台</div>
        <RouterLink
          v-for="item in adminItems"
          :key="item.to"
          :to="item.to"
          class="mb-1 flex items-center rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          active-class="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"
        >
          {{ item.label }}
        </RouterLink>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchCurrentUser, type CurrentUserPayload } from "@/api/portal";

const currentUser = ref<CurrentUserPayload | null>(null);
const isAdmin = computed(() => currentUser.value?.role === "admin");

const userItems = [
  { to: "/overview", label: "总览" },
  { to: "/workspace", label: "任务空间" },
  { to: "/billing", label: "账单" },
  { to: "/trace", label: "轨迹" },
];

const adminItems = [
  { to: "/admin/dashboard", label: "运行总台" },
  { to: "/admin/alerts", label: "公告与告警" },
  { to: "/admin/users", label: "用户管理" },
  { to: "/admin/trace", label: "Trace" },
  { to: "/admin/billing-ops", label: "计费运维" },
  { to: "/admin/sandboxes", label: "K8s 运维与分发" },
];

onMounted(async () => {
  try {
    currentUser.value = await fetchCurrentUser();
  } catch {
    currentUser.value = null;
  }
});
</script>
