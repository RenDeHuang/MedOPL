<template>
  <AppLayout title="平台总览" subtitle="账号、账单、资源、任务与待处理事项">
    <div class="space-y-4">
      <div v-if="!payload" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载平台总览...</div>
      <template v-else>
        <AdminDashboardSummaryPanel
          :alerts="payload.alerts || []"
          :kpis="payload.kpis || {}"
          :money="microMoney"
          :ops-surface-enabled="opsSurfaceEnabled"
          :response-label="responseLabel"
          :usage-rows="usageRows"
        />
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import AdminDashboardSummaryPanel from "@/components/admin/AdminDashboardSummaryPanel.vue";
import { fetchAdminOverview } from "@/api/portal/admin";

const payload = ref<any>(null);
const opsSurfaceEnabled = computed(() => Boolean(payload.value?.productProfile?.opsSurfaceEnabled));
const usageRows = computed(() => (payload.value?.usageRows || []).slice(0, 5));
const responseLabel = computed(() => {
  const value = Number(payload.value?.kpis?.averageResponseMs || 0);
  return value > 0 ? `${Math.round(value)} ms` : "未记录";
});

function microMoney(value: number | undefined) {
  return `¥${Number(value || 0).toFixed(5)}`;
}

onMounted(async () => {
  payload.value = await fetchAdminOverview();
});
</script>
