<template>
  <section data-route-id="billing" data-component-id="billing.cost_breakdown" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    <MetricCard label="计算消费" :value="microMoney(payload.breakdown.cpuCost)" :hint="componentCostHint" />
    <MetricCard label="加速消费" :value="microMoney(payload.breakdown.gpuCost)" :hint="componentCostHint" />
    <MetricCard label="文件空间消费" :value="microMoney(payload.breakdown.storageCost)" :hint="componentCostHint" />
    <MetricCard label="网络服务消费" :value="sourceBackfilledValue(payload.breakdown.vpnCost)" :hint="sourceBackfillHint" />
    <MetricCard label="流量消费" :value="sourceBackfilledValue(payload.breakdown.trafficCost)" :hint="sourceBackfillHint" />
    <MetricCard label="其他服务消费" :value="sourceBackfilledValue(payload.breakdown.otherCloudCost)" :hint="sourceBackfillHint" />
  </section>
</template>

<script setup lang="ts">
import type { BillingPayload } from "@/api/portal/billing";
import MetricCard from "@/components/common/MetricCard.vue";

defineProps<{
  componentCostHint: string;
  microMoney: (value: number | undefined) => string;
  payload: BillingPayload;
  sourceBackfilledValue: (value: number | undefined) => string;
  sourceBackfillHint: string;
}>();
</script>
