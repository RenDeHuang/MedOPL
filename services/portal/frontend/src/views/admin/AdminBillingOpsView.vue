<template>
  <AppLayout title="账单对账与调整" subtitle="腾讯云真实账单、待补记录与账单调整">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载账单对账数据...</div>
      <template v-else>
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="腾讯云账单" :value="payload.billingSync?.tencentBillingLinked ? '已接入' : '待接入'" hint="最终扣费来源" />
          <MetricCard label="自动对账" :value="payload.billingSync?.autoReconcileEnabled ? '开启' : '关闭'" hint="自动补齐开关" />
          <MetricCard label="待处理记录" :value="payload.pending?.count ?? 0" hint="待补齐或待人工确认" />
          <MetricCard label="最近调整" :value="payload.adjustments?.length ?? 0" hint="最近账单调整条数" />
        </section>

        <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div class="card p-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 class="panel-title">待处理记录</h2>
                <p class="panel-subtitle">用于识别哪些运行还没有完成成本对账。</p>
              </div>
              <div class="flex flex-wrap gap-3">
                <RouterLink class="btn btn-secondary" to="/admin/alerts">告警中心</RouterLink>
                <RouterLink class="btn btn-secondary" to="/admin/users">用户管理</RouterLink>
              </div>
            </div>

            <div class="mt-6 table-shell">
              <table class="text-sm">
                <thead>
                  <tr class="table-head">
                    <th class="px-4 py-3">运行编号</th>
                    <th class="px-4 py-3">用户</th>
                    <th class="px-4 py-3">任务空间</th>
                    <th class="px-4 py-3">待补时长(小时)</th>
                    <th class="px-4 py-3">来源</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in payload.pendingRuns || []" :key="item.runId" class="table-row">
                    <td class="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white">{{ item.runId || "-" }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.customerId || item.userId || "-" }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId || "-" }}</td>
                    <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ Number(item.pendingHours || 0).toFixed(2) }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.pricingSource || "metering pending" }}</td>
                  </tr>
                  <tr v-if="!(payload.pendingRuns || []).length">
                    <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">暂无待处理记录</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="space-y-6">
            <div v-if="opsSurfaceEnabled" class="card p-6">
              <h2 class="panel-title">当前状态</h2>
              <div class="mt-4 space-y-3 text-sm">
                <div class="muted-kv"><span class="muted-kv-label">腾讯云账单</span><span class="muted-kv-value">{{ payload.billingSync?.tencentBillingLinked ? "已接入" : "待接入" }}</span></div>
                <div class="muted-kv"><span class="muted-kv-label">最近对账</span><span class="muted-kv-value">{{ payload.billingSync?.lastRunAt || "暂无" }}</span></div>
                <div class="muted-kv"><span class="muted-kv-label">最近错误</span><span class="muted-kv-value">{{ payload.billingSync?.lastError || "无" }}</span></div>
                <div class="muted-kv"><span class="muted-kv-label">最近调整数</span><span class="muted-kv-value">{{ payload.billingSync?.lastAdjustmentCount ?? 0 }}</span></div>
              </div>
              <p class="mt-4 text-sm leading-6 text-gray-500 dark:text-slate-400">
                这里的“对账”是指把腾讯云真实账单、运行记录和账单条目做一致性校验；OpenCost 只用于待回补期间的近实时参考。
              </p>
            </div>

            <div class="card p-6">
              <h2 class="panel-title">成本构成</h2>
              <div class="mt-4 space-y-3 text-sm">
                <div class="muted-kv"><span class="muted-kv-label">CPU</span><span class="muted-kv-value">{{ microMoney(payload.summaries?.opencost?.cpuCost) }}</span></div>
                <div class="muted-kv"><span class="muted-kv-label">GPU</span><span class="muted-kv-value">{{ microMoney(payload.summaries?.opencost?.gpuCost) }}</span></div>
                <div class="muted-kv"><span class="muted-kv-label">存储</span><span class="muted-kv-value">{{ microMoney(payload.summaries?.opencost?.storageCost) }}</span></div>
                <div class="muted-kv"><span class="muted-kv-label">总成本</span><span class="muted-kv-value">{{ microMoney(payload.summaries?.opencost?.totalCost) }}</span></div>
              </div>
            </div>

            <div class="card p-6">
              <h2 class="panel-title">最近调整</h2>
              <div class="mt-4 space-y-3">
                <div v-for="item in payload.adjustments || []" :key="`${item.type}-${item.createdAt}-${item.userId}`" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="font-medium text-gray-950 dark:text-white">{{ humanizeAdjustmentType(item.type) }}</div>
                      <div class="mt-1 text-sm text-gray-500 dark:text-slate-400">{{ item.userName || item.userId }}</div>
                      <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.createdAt || "-" }}</div>
                    </div>
                    <div class="text-right">
                      <div class="font-medium text-gray-950 dark:text-white">CNY {{ Number(item.amount || 0).toFixed(2) }}</div>
                      <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.workspaceId || "-" }}</div>
                    </div>
                  </div>
                </div>
                <div v-if="!(payload.adjustments || []).length" class="empty-state">暂无调整记录</div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import MetricCard from "@/components/common/MetricCard.vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { fetchAdminBillingOps } from "@/api/portal";

const payload = ref<any>(null);
const opsSurfaceEnabled = computed(() => Boolean(payload.value?.productProfile?.opsSurfaceEnabled));

function microMoney(value: number | undefined) {
  return `CNY ${Number(value || 0).toFixed(5)}`;
}

function humanizeAdjustmentType(value = "") {
  if (value === "refund") return "退款";
  if (value === "makeup_charge") return "补扣";
  return value || "-";
}

onMounted(async () => {
  payload.value = await fetchAdminBillingOps();
});
</script>
