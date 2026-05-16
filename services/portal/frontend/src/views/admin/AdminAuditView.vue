<template>
  <AppLayout title="审计日志" subtitle="管理动作、配置变更与关键链路留痕">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载审计日志...</div>
      <template v-else>
        <AdminAuditTablePanel
          v-model:keyword="keyword"
          v-model:page-size="pageSize"
          :audit-type-label="humanizeAuditType"
          :current-page="currentPage"
          :items="pagedItems"
          :payload="payload"
          :run-count="runCount"
          :settings-count="settingsCount"
          :short-detail="shortDetail"
          :source-label="sourceLabel"
          :total-pages="totalPages"
          :workspace-count="workspaceCount"
          @next-page="currentPage += 1"
          @previous-page="currentPage -= 1"
        />
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import AdminAuditTablePanel from "@/components/admin/AdminAuditTablePanel.vue";
import { fetchAdminAudit } from "@/api/portal/admin";

const payload = ref<any>(null);
const keyword = ref("");
const pageSize = ref(10);
const currentPage = ref(1);

const settingsCount = computed(() => (payload.value?.items || []).filter((item: any) => /settings|theme/i.test(String(item.type || ""))).length);
const workspaceCount = computed(() => (payload.value?.items || []).filter((item: any) => /workspace/i.test(String(item.type || ""))).length);
const runCount = computed(() => (payload.value?.items || []).filter((item: any) => /run|runtime/i.test(String(item.type || ""))).length);

const filteredItems = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  if (!query) return payload.value?.items || [];
  return (payload.value?.items || []).filter((item: any) => {
    const haystack = `${item.type || ""} ${item.userId || ""} ${item.operatorId || ""} ${item.workspaceId || ""} ${item.detail || ""}`.toLowerCase();
    return haystack.includes(query);
  });
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / pageSize.value)));
const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredItems.value.slice(start, start + pageSize.value);
});

watch([filteredItems, pageSize], () => {
  currentPage.value = 1;
});

function shortDetail(value = "") {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > 84 ? `${text.slice(0, 84)}...` : text;
}

function sourceLabel(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("theme") || normalized.includes("settings")) return "Portal 配置";
  if (normalized.includes("workspace")) return "工作空间";
  if (normalized.includes("run")) return "运行时";
  if (normalized.includes("user")) return "账户";
  return "Portal";
}

function humanizeAuditType(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("theme")) return "主题变更";
  if (normalized.includes("settings")) return "配置变更";
  if (normalized.includes("workspace_created")) return "工作空间创建";
  if (normalized.includes("workspace_archived")) return "工作空间归档";
  if (normalized.includes("workspace_deleted")) return "工作空间删除";
  if (normalized.includes("workspace")) return "工作空间事件";
  if (normalized.includes("run")) return "运行事件";
  return value || "事件";
}

async function load() {
  payload.value = await fetchAdminAudit();
}

onMounted(async () => {
  await load();
});
</script>
