<template>
  <header class="glass sticky top-0 z-30 border-b border-gray-200/70 dark:border-slate-700/70">
    <div class="flex min-h-[60px] items-center justify-between px-4 md:px-5">
      <div class="min-w-0">
        <h1 class="text-lg font-semibold tracking-tight text-gray-950 dark:text-white">{{ title }}</h1>
        <p v-if="subtitle" class="mt-0.5 max-w-[520px] truncate text-xs leading-5 text-gray-500 dark:text-slate-400">{{ subtitle }}</p>
      </div>

      <div class="flex items-center gap-2">
        <span class="badge badge-success hidden sm:inline-flex">MedOPL</span>

        <button
          type="button"
          class="btn btn-secondary min-w-[84px]"
          @click="helpOpen = true"
        >
          使用说明
        </button>

        <button
          type="button"
          class="btn btn-secondary min-w-[84px]"
          @click="announcementOpen = true"
        >
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
    title="Portal 使用说明"
    description="先区分 Portal 与工作台，再看任务空间、账单和轨迹。"
    :pages="helpPages"
  />

  <BaseDialog
    v-model="announcementOpen"
    title="平台公告"
    :description="activeAnnouncementCount ? `当前有 ${activeAnnouncementCount} 条活动公告。` : '当前暂无活动公告。'"
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
      <div v-if="!announcements.length" class="empty-state">当前暂无活动公告。</div>
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

const themeLabel = computed(() => theme.value === "dark" ? "切换浅色" : "切换深色");
const activeAnnouncementCount = computed(() => announcements.value.length);
const userStatusLabel = computed(() => {
  const status = String(currentUser.value.status || "active").toLowerCase();
  if (status === "disabled") return "已禁用";
  if (status === "deleted") return "已删除";
  return "正常";
});

const helpPages = [
  {
    title: "入口分工",
    summary: "Portal 是后台控制面，AionUI 是工作台入口。",
    sections: [
      { title: "Portal", items: ["查看账户、任务空间、账单、轨迹。", "查看管理员总台、用户管理、Trace。"] },
      { title: "AionUI", items: ["进入会话和工作流。", "在 workspace 内持续执行任务。"] },
    ],
  },
  {
    title: "任务空间与会话",
    summary: "workspace 是资产容器，session 是执行轨迹。",
    sections: [
      { title: "任务空间", items: ["管理输入文件、输出文件和 run。", "归档后不再继续新执行。"] },
      { title: "轨迹", items: ["查看 session、模型、时间、状态和延迟。", "管理员可在全局 Trace 中继续下钻。"] },
    ],
  },
  {
    title: "账单口径",
    summary: "当前 Portal 先展示真实资源账单与未接入状态。",
    sections: [
      { title: "已展示", items: ["CPU、GPU、存储。", "账户流水与 workspace/run 明细。"] },
      { title: "未完全接入", items: ["VPN、流量、其他云成本。", "若未接云账单，会明确显示未接入状态。"] },
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
    // Ignore user-info fetch failures in header.
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
    // Ignore theme persistence errors.
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
