<template>
  <div
    v-if="mobileOpen"
    class="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
    aria-hidden="true"
    @click="closeMobileNav"
  ></div>
  <aside
    class="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-gray-200 bg-white/95 backdrop-blur transition-transform duration-200 dark:border-slate-800 dark:bg-slate-950/95 lg:z-40 lg:translate-x-0"
    :class="mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
  >
    <div class="flex h-14 items-center gap-3 border-b border-gray-100 px-5 dark:border-slate-800">
      <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-xs font-bold text-white shadow-glow">
        M
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-gray-950 dark:text-white">MedOPL</div>
        <div class="text-[11px] text-gray-500 dark:text-slate-400">工作台</div>
      </div>
      <button type="button" class="btn btn-secondary lg:hidden" aria-label="关闭导航" @click="closeMobileNav">关闭</button>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-3">
      <div class="mb-5">
        <div class="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">工作台</div>
        <RouterLink
          v-for="item in userItems"
          :key="item.to"
          :to="item.to"
          class="mb-1 flex items-center rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          active-class="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"
          @click="closeMobileNav"
        >
          {{ item.label }}
        </RouterLink>
      </div>

      <div v-if="isAdmin">
        <div class="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">管理台</div>
        <RouterLink
          v-for="item in adminItems"
          :key="item.to"
          :to="item.to"
          class="mb-1 flex items-center rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          active-class="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"
          @click="closeMobileNav"
        >
          {{ item.label }}
        </RouterLink>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchCurrentUser, type CurrentUserPayload } from "@/api/portal/commercial";

defineProps<{
  mobileOpen?: boolean;
}>();

const emit = defineEmits<{
  closeMobile: [];
}>();

const currentUser = ref<CurrentUserPayload | null>(null);
const isAdmin = computed(() => currentUser.value?.role === "admin");
const opsSurfaceEnabled = computed(() => Boolean(currentUser.value?.productProfile?.opsSurfaceEnabled));

const userItems = [
  { to: "/overview", label: "总览" },
  { to: "/resources", label: "计算资源" },
  { to: "/trace", label: "任务执行" },
  { to: "/workspace", label: "文件空间" },
  { to: "/billing", label: "账务" },
];

const adminItemsBase = [
  { to: "/admin/dashboard", label: "平台总览" },
  { to: "/admin/users", label: "客户账户" },
  { to: "/admin/sandboxes", label: "资源管理" },
  { to: "/admin/usage", label: "任务记录" },
  { to: "/admin/billing-ops", label: "账务管理" },
  { to: "/admin/audit", label: "审计记录" },
  { to: "/admin/system", label: "站点设置" },
];
const adminItems = computed(() => (opsSurfaceEnabled.value
  ? [...adminItemsBase, { to: "/admin/ops", label: "服务状态" }]
  : adminItemsBase));

function closeMobileNav() {
  emit("closeMobile");
}

onMounted(async () => {
  try {
    currentUser.value = await fetchCurrentUser();
  } catch {
    currentUser.value = null;
  }
});
</script>
