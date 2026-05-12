<template>
  <AppLayout title="账单对账与调整" subtitle="腾讯云真实账单、待补记录与账单调整">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载账单对账数据...</div>
      <template v-else>
        <AdminBillingOpsSummaryPanel
          :adjustment-label="humanizeAdjustmentType"
          :money="microMoney"
          :ops-surface-enabled="opsSurfaceEnabled"
          :payload="payload"
          :source-label="pricingSourceLabel"
        />
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AdminBillingOpsSummaryPanel from "@/components/admin/AdminBillingOpsSummaryPanel.vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { fetchAdminBillingOps } from "@/api/portal/admin";

const payload = ref<any>(null);
const opsSurfaceEnabled = computed(() => Boolean(payload.value?.productProfile?.opsSurfaceEnabled));

function microMoney(value: number | undefined, digits = 5) {
  return `¥${Number(value || 0).toFixed(digits)}`;
}

function humanizeAdjustmentType(value = "") {
  if (value === "refund") return "退款";
  if (value === "makeup_charge") return "补扣";
  return value || "-";
}

function pricingSourceLabel(value = "") {
  if (!value || value === "metering pending") return "计量待回补";
  return value;
}

onMounted(async () => {
  payload.value = await fetchAdminBillingOps();
});
</script>
