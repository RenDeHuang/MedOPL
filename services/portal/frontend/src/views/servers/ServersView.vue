<template>
  <AppLayout title="服务器与费用" subtitle="选择算力规格，运行时按该规格调度">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载服务器价格...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
          <div class="card p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="max-w-2xl">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-primary">腾讯云报价</span>
                  <span class="badge" :class="payload.summary.quotedCount > 0 ? 'badge-success' : 'badge-warning'">
                    {{ payload.summary.quotedCount > 0 ? "已有实时报价" : "等待报价刷新" }}
                  </span>
                  <span class="badge" :class="payload.configured ? 'badge-success' : 'badge-warning'">
                    {{ payload.configured ? "云账号已配置" : "云账号未配置" }}
                  </span>
                </div>
                <h2 class="mt-3 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">透明选择 CPU / GPU、地域和价格</h2>
                <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">价格来自腾讯云询价和账单，选择后会写入当前任务空间并进入运行调度。</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <RouterLink class="btn btn-secondary" to="/billing">查看账单</RouterLink>
                <a class="btn btn-primary" href="/portal/opl">进入实验室</a>
              </div>
            </div>
          </div>

          <div class="card p-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">当前选择</h2>
                <p class="panel-subtitle">任务空间 {{ payload.workspaceId || "default" }}</p>
              </div>
              <span class="badge" :class="payload.selectedServerPlan ? 'badge-success' : 'badge-warning'">
                {{ payload.selectedServerPlan ? "已选择" : "未选择" }}
              </span>
            </div>
            <div class="mt-4 space-y-2.5 text-sm">
              <div class="muted-kv">
                <span class="muted-kv-label">规格</span>
                <span class="muted-kv-value">{{ payload.selectedServerPlan?.name || "默认规格" }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">地域</span>
                <span class="muted-kv-value">{{ payload.selectedServerPlan?.region || "-" }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">预计小时价</span>
                <span class="muted-kv-value">{{ money(payload.selectedServerPlan?.discountPrice || payload.selectedServerPlan?.unitPrice || 0) }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="可售规格" :value="payload.summary.salableCount" hint="billing-aggregator 返回 salable=true 的规格" />
          <MetricCard label="报价规格" :value="payload.summary.quotedCount" hint="腾讯云实时询价成功的规格" />
          <MetricCard label="目录规格" :value="payload.summary.catalogCount" hint="平台维护的可售 SKU 目录" />
          <MetricCard label="最低小时价" :value="money(payload.summary.lowestHourlyPrice)" hint="已报价规格中的最低折后价" />
        </section>

        <section class="card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">可选服务器</h2>
              <p class="panel-subtitle">冻结金额按实时报价、最小计费单元和风险系数计算；真实扣费以腾讯云账单为准。</p>
            </div>
            <span class="badge badge-primary">{{ payload.items.length }} 个</span>
          </div>

          <div class="table-shell">
            <table class="text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">规格</th>
                  <th class="px-4 py-3">地域 / 可用区</th>
                  <th class="px-4 py-3">CPU / 内存 / GPU</th>
                  <th class="px-4 py-3">小时价</th>
                  <th class="px-4 py-3">预计冻结</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">调度</th>
                  <th class="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in payload.items" :key="item.id" class="table-row">
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.name || item.instanceType || item.id }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.instanceType || item.id }}</div>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">
                    <div>{{ item.region || "-" }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.zone || "-" }}</div>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">
                    {{ item.cpu || 0 }}C / {{ item.memoryGb || 0 }}GB / {{ item.gpu || 0 }} GPU
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ money(hourlyPrice(item)) }}</td>
                  <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ money(freezeAmount(item)) }}</td>
                  <td class="px-4 py-3">
                    <span class="badge" :class="item.salable ? 'badge-success' : 'badge-warning'">{{ planStatus(item) }}</span>
                    <div v-if="item.reason" class="mt-1 max-w-[220px] text-xs text-gray-500 dark:text-slate-400">{{ item.reason }}</div>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">
                    <div>{{ item.runtimeClass || "默认 Runtime" }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ scheduleText(item) }}</div>
                  </td>
                  <td class="px-4 py-3">
                    <button
                      class="btn"
                      :class="isSelected(item) ? 'btn-primary' : 'btn-secondary'"
                      :disabled="!item.salable || selecting === item.id"
                      @click="choosePlan(item)"
                    >
                      {{ isSelected(item) ? "已选择" : selecting === item.id ? "保存中" : "选择" }}
                    </button>
                  </td>
                </tr>
                <tr v-if="!payload.items.length">
                  <td colspan="8" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                    当前还没有可售服务器目录，请配置 SERVER_PLAN_CATALOG_JSON 并启用腾讯云询价。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div class="card p-5">
            <h2 class="panel-title">冻结依据</h2>
            <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">{{ payload.freezePolicy.basis }}</p>
          </div>
          <div class="card p-5">
            <h2 class="panel-title">最终账单</h2>
            <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">{{ payload.freezePolicy.finalBilling }}</p>
          </div>
          <div class="card p-5">
            <h2 class="panel-title">运行中观测</h2>
            <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">{{ payload.freezePolicy.opencostRole }}</p>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import type { ServerPlanItem, ServerPlansPayload } from "@/api/portal";
import { fetchServerPlans, selectServerPlan } from "@/api/portal";

const loading = ref(true);
const error = ref("");
const payload = ref<ServerPlansPayload | null>(null);
const selecting = ref("");

function money(value: number | undefined) {
  return `CNY ${Number(value || 0).toFixed(4)}`;
}

function hourlyPrice(item: ServerPlanItem) {
  return Number(item.discountPrice ?? item.unitPrice ?? item.originalPrice ?? 0);
}

function freezeAmount(item: ServerPlanItem) {
  const base = hourlyPrice(item) * Math.max(1, Number(item.minBillableHours || 1)) * Math.max(1, Number(item.riskFactor || 1));
  return Math.max(Number(item.reservationFloor || 0), base);
}

function planStatus(item: ServerPlanItem) {
  if (item.salable) return "可选择";
  if (item.priceStatus === "disabled") return "询价未启用";
  if (item.priceStatus === "not_configured") return "云账号未配置";
  if (item.priceStatus === "quote_failed") return "询价失败";
  return item.priceStatus || "待刷新";
}

function isSelected(item: ServerPlanItem) {
  return Boolean(item.id && payload.value?.selectedServerPlan?.id === item.id);
}

function scheduleText(item: ServerPlanItem) {
  const entries = Object.entries(item.nodeSelector || {}).filter(([key, value]) => key && value);
  if (entries.length) return entries.map(([key, value]) => `${key}=${value}`).join("，");
  if (item.nodePool) return `节点池 ${item.nodePool}`;
  return "集群默认调度";
}

async function choosePlan(item: ServerPlanItem) {
  if (!item.salable || !item.id) return;
  selecting.value = item.id;
  error.value = "";
  try {
    const result = await selectServerPlan({ planId: item.id, task: payload.value?.workspaceId || "default" });
    payload.value = {
      ...(payload.value as ServerPlansPayload),
      selectedServerPlan: result.selectedServerPlan,
      workspaceId: result.workspaceId,
    };
  } catch (err) {
    error.value = err instanceof Error ? err.message : "服务器选择保存失败";
  } finally {
    selecting.value = "";
  }
}

onMounted(async () => {
  loading.value = true;
  error.value = "";
  try {
    payload.value = await fetchServerPlans();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "服务器价格加载失败";
  } finally {
    loading.value = false;
  }
});
</script>
