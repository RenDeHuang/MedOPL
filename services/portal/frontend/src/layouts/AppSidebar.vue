<template>
  <div
    v-if="mobileOpen"
    class="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
    aria-hidden="true"
    @click="closeMobileNav"
  ></div>
  <aside
    data-component-id="app-shell.sidebar"
    class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-950 lg:z-40 lg:translate-x-0"
    :class="mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
  >
    <div class="flex h-[58px] items-center gap-3 border-b border-gray-100 px-4 dark:border-slate-800">
      <div class="flex h-8 w-8 items-center justify-center rounded-md bg-primary-600 text-xs font-bold text-white">
        M
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-gray-950 dark:text-white">MedOPL</div>
        <div class="text-[11px] text-gray-500 dark:text-slate-400">托管科研工作台</div>
      </div>
      <button type="button" class="btn btn-secondary lg:hidden" aria-label="关闭导航" @click="closeMobileNav">关闭</button>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-3" aria-label="Portal 导航">
      <div class="mb-5">
        <div class="mb-2 px-3 text-[11px] font-semibold text-gray-400 dark:text-slate-500">普通用户</div>
        <RouterLink
          v-for="item in userItems"
          :key="item.to"
          :to="item.to"
          class="mb-1 flex min-h-[38px] items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
          active-class="bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
          @click="closeMobileNav"
        >
          <span>{{ item.label }}</span>
          <span v-if="item.emphasis" class="badge badge-primary">入口</span>
        </RouterLink>
      </div>

      <div v-if="isAdmin">
        <div class="mb-2 px-3 text-[11px] font-semibold text-gray-400 dark:text-slate-500">管理台</div>
        <RouterLink
          v-for="item in adminItems"
          :key="item.to"
          :to="item.to"
          class="mb-1 flex min-h-[38px] items-center rounded-lg border-l-2 border-transparent px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
          active-class="border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          @click="closeMobileNav"
        >
          {{ item.label }}
        </RouterLink>
      </div>
    </nav>

    <div class="border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-slate-800 dark:text-slate-400">
      平台托管开通、计费、审计和释放；科研执行进入 OPL。
    </div>
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
  { to: "/resources", label: "运行环境" },
  { to: "/workspace", label: "工作空间" },
  { to: "/trace", label: "任务与结果" },
  { to: "/billing", label: "账单与审计" },
  { to: "/opl-launch", label: "进入 OPL", emphasis: true },
];

const adminItemsBase = [
  { to: "/admin/dashboard", label: "管理总览" },
  { to: "/admin/users", label: "客户账户" },
  { to: "/admin/sandboxes", label: "运行环境管理" },
  { to: "/admin/usage", label: "任务记录" },
  { to: "/admin/billing-ops", label: "账单处理" },
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
