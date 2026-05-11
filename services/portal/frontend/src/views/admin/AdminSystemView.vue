<template>
  <AppLayout title="站点设置" subtitle="站点信息、首页内容、注册开关与服务状态">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载系统摘要...</div>
      <template v-else>
        <ActionPanel title="站点设置" subtitle="配置首页展示、站点 logo 和注册入口。">
          <form class="grid gap-4 xl:grid-cols-2" @submit.prevent="submitSiteSettings">
            <div v-if="settingsMessage" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 xl:col-span-2">
              {{ settingsMessage }}
            </div>
            <div v-if="settingsError" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 xl:col-span-2">
              {{ settingsError }}
            </div>

            <label class="text-sm text-gray-700 dark:text-slate-200">
              <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">站点名称</span>
              <input v-model.trim="settingsForm.siteName" class="input" type="text" required />
            </label>
            <label class="text-sm text-gray-700 dark:text-slate-200">
              <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">站点副标题</span>
              <input v-model.trim="settingsForm.siteSubtitle" class="input" type="text" required />
            </label>
            <div class="xl:col-span-2">
              <SiteLogoField v-model="settingsForm.siteLogo" @clear="settingsForm.siteLogo = ''" />
            </div>
            <div class="xl:col-span-2">
              <HomeContentEditor v-model="settingsForm.homeContent" />
            </div>
            <label class="flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3 text-sm text-gray-700 dark:border-slate-700 dark:text-slate-200">
              <input v-model="settingsForm.allowRegistration" type="checkbox" />
              开放注册
            </label>
            <div class="flex justify-end gap-2 xl:col-span-2">
              <a class="btn btn-secondary" href="/home" target="_blank" rel="noreferrer">预览首页</a>
              <button class="btn btn-primary" type="submit" :disabled="settingsSaving">
                {{ settingsSaving ? "保存中..." : "保存设置" }}
              </button>
            </div>
          </form>
        </ActionPanel>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="服务数量" :value="payload.serviceStatuses?.length ?? 0" hint="当前纳管服务数量" />
          <MetricCard label="异常服务" :value="failedServices" hint="当前探测异常的服务" />
          <MetricCard label="安全缺口" :value="payload.summaries?.security?.failedCount ?? 0" hint="默认 secret / 默认口令 / 配置卫生问题" />
          <MetricCard label="MAS 首次回复" :value="masReplyLabel" hint="最近成功样本的平均近似值" />
        </section>

        <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div class="card p-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 class="panel-title">服务状态</h2>
                <p class="panel-subtitle">聚焦 Portal、OPL、Trace、Adapter 等主链路。</p>
              </div>
              <RouterLink v-if="opsSurfaceEnabled" class="btn btn-secondary" to="/admin/ops">服务状态</RouterLink>
            </div>

            <div class="mt-6 grid gap-3 md:grid-cols-2">
              <div v-for="item in serviceCards" :key="item.name" class="rounded-2xl border border-gray-100 p-4 dark:border-slate-700">
                <div class="flex items-center justify-between gap-4">
                  <div class="font-medium text-gray-950 dark:text-white">{{ item.name }}</div>
                  <span class="badge" :class="item.ok ? 'badge-success' : 'badge-danger'">{{ item.ok ? "可用" : "异常" }}</span>
                </div>
                <div class="mt-2 text-sm text-gray-500 dark:text-slate-400">状态：{{ item.status || "-" }}</div>
                <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">来源：{{ item.source }}</div>
                <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">类型：{{ item.kind }}</div>
                <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">响应：{{ responseLabel(item.responseMs) }}</div>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="card p-6">
              <h2 class="panel-title">宿主摘要</h2>
              <div class="mt-4 space-y-3 text-sm">
                <div class="muted-kv"><span class="muted-kv-label">主机名</span><span class="muted-kv-value">{{ payload.systemMetrics?.hostname || "-" }}</span></div>
                <div class="muted-kv"><span class="muted-kv-label">运行时长</span><span class="muted-kv-value">{{ payload.systemMetrics?.uptimeHours ?? '-' }} h</span></div>
                <div class="muted-kv"><span class="muted-kv-label">可用内存</span><span class="muted-kv-value">{{ payload.systemMetrics?.freeMemoryGb ?? '-' }} GB</span></div>
                <div class="muted-kv"><span class="muted-kv-label">存储模式</span><span class="muted-kv-value">{{ payload.systemMetrics?.dbMode || "-" }}</span></div>
              </div>
            </div>

            <div class="card p-6">
              <h2 class="panel-title">安全配置健康</h2>
              <div class="mt-4 space-y-3">
                <div v-for="item in payload.summaries?.security?.checks || []" :key="item.key" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
                  <div class="flex items-center justify-between gap-4">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.key }}</div>
                    <span class="badge" :class="item.healthy ? 'badge-success' : 'badge-danger'">{{ item.healthy ? '健康' : '待处理' }}</span>
                  </div>
                  <div class="mt-2 text-sm text-gray-500 dark:text-slate-400">{{ item.detail }}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import ActionPanel from "@/components/common/ActionPanel.vue";
import HomeContentEditor from "@/components/admin/HomeContentEditor.vue";
import SiteLogoField from "@/components/admin/SiteLogoField.vue";
import { fetchAdminSystem, updateAdminSiteSettings, type AdminSystemPayload } from "@/api/portal/admin";

const payload = ref<AdminSystemPayload | null>(null);
const settingsSaving = ref(false);
const settingsMessage = ref("");
const settingsError = ref("");
const settingsForm = reactive({
  siteName: "MedOPL",
  siteLogo: "",
  siteSubtitle: "托管 OPL 科研工作台",
  homeContent: "",
  allowRegistration: true,
});
const opsSurfaceEnabled = computed(() => Boolean(payload.value?.productProfile?.opsSurfaceEnabled));
const failedServices = computed(() => (payload.value?.serviceStatuses || []).filter((item: any) => !item.ok).length);
const masReplyLabel = computed(() => {
  const value = Number(payload.value?.summaries?.performance?.masFirstReplyApproxMs || 0);
  return value ? `${value} ms` : "-";
});

const productSystemNames = new Set(["Portal", "OPL", "Trace", "Adapter", "Runtime Bridge", "Gateway", "Portal OPL Adapter"]);
const serviceCards = computed(() => (payload.value?.serviceStatuses || [])
  .filter((item: any) => productSystemNames.has(String(item.name || "")))
  .map((item: any) => ({
    ...item,
    source: "内部诊断",
    kind: "主链路探测",
  })));

function responseLabel(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${Number(value)} ms`;
}

function syncSettingsForm(nextPayload: AdminSystemPayload) {
  settingsForm.siteName = nextPayload.publicSettings?.siteName || "MedOPL";
  settingsForm.siteLogo = nextPayload.publicSettings?.siteLogo || "";
  settingsForm.siteSubtitle = nextPayload.publicSettings?.siteSubtitle || "托管 OPL 科研工作台";
  settingsForm.homeContent = nextPayload.publicSettings?.homeContent || "";
  settingsForm.allowRegistration = nextPayload.allowRegistration !== false;
}

async function loadSystem() {
  payload.value = await fetchAdminSystem();
  syncSettingsForm(payload.value);
}

async function submitSiteSettings() {
  settingsSaving.value = true;
  settingsMessage.value = "";
  settingsError.value = "";
  try {
    await updateAdminSiteSettings({
      siteName: settingsForm.siteName,
      siteLogo: settingsForm.siteLogo,
      siteSubtitle: settingsForm.siteSubtitle,
      homeContent: settingsForm.homeContent,
      allowRegistration: settingsForm.allowRegistration,
    });
    await loadSystem();
    settingsMessage.value = "站点设置已保存。";
  } catch (error: any) {
    settingsError.value = error?.message || "站点设置保存失败。";
  } finally {
    settingsSaving.value = false;
  }
}

onMounted(async () => {
  await loadSystem();
});
</script>
