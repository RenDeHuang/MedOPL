<template>
  <header class="glass sticky top-0 z-30 border-b border-gray-200/70 dark:border-slate-700/70">
    <div class="flex min-h-[60px] items-center justify-between px-4 md:px-5">
      <div class="min-w-0">
        <h1 class="text-lg font-semibold tracking-tight text-gray-950 dark:text-white">{{ title }}</h1>
        <p v-if="subtitle" class="mt-0.5 max-w-[520px] truncate text-xs leading-5 text-gray-500 dark:text-slate-400">{{ subtitle }}</p>
      </div>

      <div class="flex items-center gap-2">
        <span class="badge badge-success hidden sm:inline-flex">MedOPL</span>

        <button type="button" class="btn btn-secondary min-w-[72px]" @click="helpOpen = true">
          帮助
        </button>

        <button type="button" class="btn btn-secondary min-w-[72px]" @click="announcementOpen = true">
          公告
          <span
            v-if="activeAnnouncementCount"
            class="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-100 px-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
          >
            {{ activeAnnouncementCount }}
          </span>
        </button>

        <button id="theme-toggle" type="button" class="btn btn-secondary min-w-[92px]" @click="toggleTheme">
          {{ themeLabel }}
        </button>

        <div ref="userMenuRef" class="relative">
          <button
            type="button"
            class="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-1.5 text-left shadow-sm transition hover:border-primary-200 dark:border-slate-700 dark:bg-slate-800"
            @click="menuOpen = !menuOpen"
          >
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-[11px] font-semibold text-white">
              {{ currentUser.initials }}
            </span>
            <span class="hidden min-w-0 sm:block">
              <span class="block truncate text-sm font-medium text-gray-950 dark:text-white">{{ currentUser.name }}</span>
              <span class="block truncate text-[11px] text-gray-500 dark:text-slate-400">{{ currentUser.email }}</span>
            </span>
          </button>

          <div
            v-if="menuOpen"
            class="absolute right-0 top-[calc(100%+10px)] w-64 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
              <div class="text-sm font-medium text-gray-950 dark:text-white">{{ currentUser.name }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ currentUser.email }}</div>
              <div class="mt-2 text-xs text-gray-400 dark:text-slate-500">
                {{ currentUser.roleLabel }} · {{ userStatusLabel }}
              </div>
            </div>
            <a
              class="mt-3 flex min-h-[38px] items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-primary-200 hover:text-primary-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:hover:border-primary-500/40 dark:hover:text-primary-300"
              href="/logout?force_login=1"
            >
              退出登录
            </a>
          </div>
        </div>
      </div>
    </div>
  </header>

  <AnnouncementDialog
    v-model="helpOpen"
    v-model:page="helpPage"
    title="帮助"
    description="账户、工作空间、托管运行环境消费和账单。"
    :pages="helpPages"
  />

  <BaseDialog
    v-model="announcementOpen"
    title="平台公告"
    :description="activeAnnouncementCount ? `当前有 ${activeAnnouncementCount} 条公告。` : '当前暂无公告。'"
  >
    <div class="space-y-3">
      <div
        v-for="item in announcements"
        :key="item.id"
        class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold text-gray-950 dark:text-white">{{ item.title }}</h3>
              <span v-if="item.pinned" class="badge badge-primary">置顶</span>
            </div>
            <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">{{ item.content }}</p>
          </div>
          <span class="text-[11px] text-gray-400 dark:text-slate-500">{{ item.updatedAt || item.createdAt || "-" }}</span>
        </div>
      </div>
      <div v-if="!announcements.length" class="empty-state">当前暂无公告。</div>
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AnnouncementDialog from "@/components/common/AnnouncementDialog.vue";
import BaseDialog from "@/components/common/BaseDialog.vue";
import { fetchAnnouncements } from "@/api/portal";

defineProps<{
  title: string;
  subtitle?: string;
}>();

interface CurrentUserState {
  name: string;
  email: string;
  initials: string;
  role: string;
  roleLabel: string;
  status: string;
}

const initialTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const theme = ref<"dark" | "light">(initialTheme);
const menuOpen = ref(false);
const userMenuRef = ref<HTMLElement | null>(null);
const helpOpen = ref(false);
const helpPage = ref(0);
const announcementOpen = ref(false);
const announcements = ref<any[]>([]);
const currentUser = ref<CurrentUserState>({
  name: "当前用户",
  email: "",
  initials: "U",
  role: "user",
  roleLabel: "用户",
  status: "active",
});

document.documentElement.dataset.theme = theme.value;

const themeLabel = computed(() => theme.value === "dark" ? "浅色" : "深色");
const activeAnnouncementCount = computed(() => announcements.value.length);
const userStatusLabel = computed(() => {
  const status = String(currentUser.value.status || "active").toLowerCase();
  if (status === "disabled") return "已禁用";
  if (status === "deleted") return "已删除";
  return "正常";
});

const helpPages = [
  {
    title: "开始使用",
    summary: "进入 OPL 科研工作台，选择工作空间，开始一次任务。",
    sections: [
      { title: "科研工作台", items: ["从总览或工作空间进入 OPL。", "输出文件会回到当前工作空间。"] },
      { title: "工作空间", items: ["保存输入文件、输出文件、运行轨迹和任务记录。", "不同工作空间可以选择不同套餐和文件空间。"] },
    ],
  },
  {
    title: "费用",
    summary: "余额、消费、预扣费和账单核对集中展示。",
    sections: [
      { title: "托管运行环境", items: ["在套餐和文件空间中选择需要的运行能力。", "运行前显示预扣费和冻结金额。"] },
      { title: "账单", items: ["运行中显示预扣费。", "账单日内核对后展示最终消费。"] },
    ],
  },
  {
    title: "账户",
    summary: "账号、余额和权限分开管理。",
    sections: [
      { title: "登录", items: ["MedOPL 账号可进入 Portal 和 OPL Web。", "Portal 只展示 gflabtoken 模型调用密钥已绑定/未绑定状态，不提供输入入口。"] },
      { title: "余额", items: ["余额不足不影响查看工作台。", "收费任务会检查余额或试用额度。"] },
    ],
  },
];

function roleLabel(role: string) {
  return role === "admin" ? "管理员" : "用户";
}

async function loadCurrentUser() {
  try {
    const response = await fetch("/portal/api/me", { credentials: "same-origin" });
    if (!response.ok) return;
    const payload = await response.json();
    currentUser.value = {
      name: String(payload.name || "当前用户"),
      email: String(payload.email || ""),
      initials: String(payload.initials || "U"),
      role: String(payload.role || "user"),
      roleLabel: roleLabel(String(payload.role || "user")),
      status: String(payload.status || "active"),
    };
  } catch {
    // Header should not block the app if this small request fails.
  }
}

async function loadAnnouncements() {
  try {
    const payload = await fetchAnnouncements();
    announcements.value = Array.isArray(payload.items) ? payload.items : [];
  } catch {
    announcements.value = [];
  }
}

function onDocumentClick(event: MouseEvent) {
  if (!menuOpen.value) return;
  const target = event.target as Node | null;
  if (target && userMenuRef.value?.contains(target)) return;
  menuOpen.value = false;
}

async function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme.value;
  try {
    await fetch("/portal/api/theme", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ theme: theme.value }),
      credentials: "same-origin",
    });
  } catch {
    // Theme persistence is non-critical.
  }
}

onMounted(() => {
  void loadCurrentUser();
  void loadAnnouncements();
  document.addEventListener("click", onDocumentClick, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick, true);
});
</script>
