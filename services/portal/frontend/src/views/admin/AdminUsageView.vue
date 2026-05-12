<template>
  <AppLayout title="使用记录" subtitle="运行记录、成本线索与下钻入口">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载使用记录...</div>
      <template v-else>
        <AdminUsageTablePanel
          :average-cost="averageCost"
          :failed-count="failedCount"
          :money="money"
          :ops-surface-enabled="opsSurfaceEnabled"
          :payload="payload"
          :status-label="humanizeStatus"
          :status-tone="statusTone"
          :success-count="successCount"
        />
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AdminUsageTablePanel from "@/components/admin/AdminUsageTablePanel.vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { fetchAdminUsage } from "@/api/portal/admin";

const payload = ref<any>(null);
const opsSurfaceEnabled = computed(() => Boolean(payload.value?.productProfile?.opsSurfaceEnabled));
const failedCount = computed(() => (payload.value?.items || []).filter((item: any) => /fail|error/i.test(String(item.status || ""))).length);
const successCount = computed(() => (payload.value?.items || []).filter((item: any) => /complete|success|finish/i.test(String(item.status || ""))).length);
const averageCost = computed(() => {
  const rows = payload.value?.items || [];
  if (!rows.length) return 0;
  return rows.reduce((sum: number, item: any) => sum + Number(item.totalCost || 0), 0) / rows.length;
});

function statusTone(status?: string): "success" | "warning" | "danger" | "primary" {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "finished"].includes(normalized)) return "success";
  if (["failed", "error"].includes(normalized)) return "danger";
  if (["running", "active"].includes(normalized)) return "primary";
  return "warning";
}

function humanizeStatus(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "finished"].includes(normalized)) return "已完成";
  if (normalized === "running") return "运行中";
  if (normalized === "active") return "活跃";
  if (["failed", "error"].includes(normalized)) return "失败";
  return status || "未知";
}

function money(value: number | undefined) {
  return `¥${Number(value || 0).toFixed(5)}`;
}

onMounted(async () => {
  payload.value = await fetchAdminUsage();
});
</script>
