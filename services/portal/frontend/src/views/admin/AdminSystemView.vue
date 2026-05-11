<template>
  <AppLayout title="站点设置" subtitle="站点信息、首页内容、注册开关与服务状态">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载系统摘要...</div>
      <template v-else>
        <AdminSiteSettingsPanel
          :error="settingsError"
          :message="settingsMessage"
          :model="settingsForm"
          :saving="settingsSaving"
          @submit="submitSiteSettings"
        />

        <AdminServiceStatusPanel
          :failed-services="failedServices"
          :mas-reply-label="masReplyLabel"
          :ops-surface-enabled="opsSurfaceEnabled"
          :response-label="responseLabel"
          :security-checks="payload.summaries?.security?.checks || []"
          :security-gap-count="payload.summaries?.security?.failedCount ?? 0"
          :service-cards="serviceCards"
          :service-count="payload.serviceStatuses?.length ?? 0"
          :system-metrics="payload.systemMetrics || {}"
        />
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import AdminServiceStatusPanel from "@/components/admin/AdminServiceStatusPanel.vue";
import AdminSiteSettingsPanel from "@/components/admin/AdminSiteSettingsPanel.vue";
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
