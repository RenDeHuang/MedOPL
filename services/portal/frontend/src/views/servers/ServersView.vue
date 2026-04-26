<template>
  <AppLayout title="服务器与费用" subtitle="客户可选规格、腾讯云价格、资源订单">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载服务器与费用...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>

      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.85fr]">
          <div class="card p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="max-w-2xl">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-primary">腾讯云价格透明</span>
                  <span class="badge" :class="payload.summary.quotedCount > 0 ? 'badge-success' : 'badge-warning'">
                    {{ payload.summary.quotedCount > 0 ? "报价已同步" : "等待报价同步" }}
                  </span>
                  <span class="badge" :class="payload.configured ? 'badge-success' : 'badge-warning'">
                    {{ payload.configured ? "云账号已接入" : "云账号未接入" }}
                  </span>
                </div>
                <h2 class="mt-3 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">客户先选规格，再冻结，再运行</h2>
                <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
                  这里展示地域、CPU/GPU/内存/存储、小时价、冻结金额和价格来源。运行时会按资源订单链路进入冻结和结算。
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <RouterLink class="btn btn-secondary" to="/billing">账单</RouterLink>
                <a class="btn btn-primary" href="/portal/opl">进入实验室</a>
              </div>
            </div>
          </div>

          <div class="card p-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">当前任务空间</h2>
                <p class="panel-subtitle">{{ payload.workspaceId || "default" }}</p>
              </div>
              <span class="badge" :class="payload.selectedServerPlan ? 'badge-success' : 'badge-warning'">
                {{ payload.selectedServerPlan ? "已有默认规格" : "等待选择" }}
              </span>
            </div>
            <div class="mt-4 space-y-2.5 text-sm">
              <div class="muted-kv">
                <span class="muted-kv-label">默认规格</span>
                <span class="muted-kv-value">{{ payload.selectedServerPlan?.name || "未选择" }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">地域</span>
                <span class="muted-kv-value">{{ payload.selectedServerPlan?.region || "-" }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">最低小时价</span>
                <span class="muted-kv-value">{{ money(payload.summary.lowestHourlyPrice) }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">价格来源</span>
                <span class="muted-kv-value">{{ priceSourceLabel }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="可售规格" :value="payload.summary.salableCount" hint="允许客户直接选择" />
          <MetricCard label="实时报价" :value="payload.summary.quotedCount" hint="腾讯云询价成功" />
          <MetricCard label="最低小时价" :value="money(payload.summary.lowestHourlyPrice)" hint="已报价规格中的最低价" />
          <MetricCard label="活跃订单" :value="activeOrderCount" hint="已报价 / 已冻结 / 运行中" />
        </section>

        <section class="card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">可选服务器</h2>
              <p class="panel-subtitle">选择后写入任务空间，报价与冻结进入资源订单</p>
            </div>
            <span class="badge badge-primary">{{ payload.items.length }} 个</span>
          </div>

          <div v-if="!payload.items.length" class="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-slate-700 dark:text-slate-400">
            当前没有可售规格。接入腾讯云可售 SKU 后，这里会展示真实小时价、冻结金额和开通方式。
          </div>

          <div v-else class="table-shell">
            <table class="text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">服务器</th>
                  <th class="px-4 py-3">地域</th>
                  <th class="px-4 py-3">配置</th>
                  <th class="px-4 py-3">存储</th>
                  <th class="px-4 py-3">小时价</th>
                  <th class="px-4 py-3">冻结金额</th>
                  <th class="px-4 py-3">价格来源</th>
                  <th class="px-4 py-3">订单</th>
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
                    {{ item.cpu || 0 }}C / {{ item.memoryGb || 0 }}GB / {{ gpuLabel(item) }}
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">
                    {{ item.storageLimit || item.storageRequest || "-" }}
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ money(hourlyPrice(item)) }}</td>
                  <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ money(freezeAmount(item)) }}</td>
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-950 dark:text-white">{{ sourceText(item) }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.reason || payload.note || "-" }}</div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="badge" :class="orderStatusBadge(latestOrderByPlan(item.id)?.status)">{{ orderStatusText(latestOrderByPlan(item.id)?.status) }}</span>
                    <div v-if="latestOrderByPlan(item.id)?.id" class="mt-1 font-mono text-xs text-gray-500 dark:text-slate-400">
                      {{ latestOrderByPlan(item.id)?.id }}
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-col gap-2">
                      <button
                        class="btn"
                        :class="isSelected(item) ? 'btn-primary' : 'btn-secondary'"
                        :disabled="!item.salable || selecting === item.id"
                        @click="choosePlan(item)"
                      >
                        {{ isSelected(item) ? "默认规格" : selecting === item.id ? "保存中" : "设为默认" }}
                      </button>
                      <button
                        class="btn btn-secondary"
                        :disabled="!item.salable || quoting === item.id"
                        @click="quotePlan(item)"
                      >
                        {{ quoting === item.id ? "报价中" : "报价" }}
                      </button>
                      <button
                        class="btn btn-secondary"
                        :disabled="!item.salable || freezing === item.id"
                        @click="freezePlan(item)"
                      >
                        {{ freezing === item.id ? "冻结中" : "冻结" }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">最近订单</h2>
                <p class="panel-subtitle">资源订单状态入口</p>
              </div>
              <span class="badge badge-primary">{{ orders.length }} 条</span>
            </div>
            <div class="space-y-2.5">
              <div
                v-for="item in orders.slice(0, 4)"
                :key="item.id"
                class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.serverPlanName || item.serverPlanId || item.id }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.workspaceTitle || item.workspaceId || "-" }}</div>
                  </div>
                  <span class="badge" :class="orderStatusBadge(item.status)">{{ orderStatusText(item.status) }}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-slate-400">
                  <div>冻结 {{ money(item.frozenAmount) }}</div>
                  <div>Exact {{ money(item.exactCost) }}</div>
                </div>
              </div>
              <div v-if="!orders.length" class="empty-state">暂无资源订单</div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4">
            <div class="card p-5">
              <h2 class="panel-title">冻结依据</h2>
              <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">{{ payload.freezePolicy.basis }}</p>
            </div>
            <div class="card p-5">
              <h2 class="panel-title">最终结算</h2>
              <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">{{ payload.freezePolicy.finalBilling }}</p>
            </div>
            <div class="card p-5">
              <h2 class="panel-title">运行中成本</h2>
              <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">{{ payload.freezePolicy.opencostRole }}</p>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import type {
  ResourceOrderItem,
  ResourceOrdersPayload,
  ServerPlanItem,
  ServerPlansPayload,
} from "@/api/portal";
import {
  fetchResourceOrders,
  fetchServerPlans,
  freezeResourceOrder,
  quoteResourceOrder,
  selectServerPlan,
} from "@/api/portal";

const loading = ref(true);
const error = ref("");
const payload = ref<ServerPlansPayload | null>(null);
const ordersPayload = ref<ResourceOrdersPayload | null>(null);
const selecting = ref("");
const quoting = ref("");
const freezing = ref("");

const priceSourceLabel = computed(() => {
  if (!payload.value) return "-";
  if (payload.value.source) return payload.value.source;
  if (payload.value.configured && payload.value.priceEnabled) return "腾讯云实时报价";
  if (payload.value.configured) return "云账号已接入";
  return "未接入";
});

const orders = computed<ResourceOrderItem[]>(() => ordersPayload.value?.items || []);
const activeOrderCount = computed(() => orders.value.filter((item) => ["quoted", "frozen", "provisioning", "running", "reconciling"].includes(String(item.status || "").toLowerCase())).length);

function money(value: number | undefined) {
  return `CNY ${Number(value || 0).toFixed(2)}`;
}

function hourlyPrice(item: ServerPlanItem) {
  return Number(item.discountPrice ?? item.unitPrice ?? item.originalPrice ?? 0);
}

function freezeAmount(item: ServerPlanItem) {
  const base = hourlyPrice(item) * Math.max(1, Number(item.minBillableHours || 1)) * Math.max(1, Number(item.riskFactor || 1));
  return Math.max(Number(item.reservationFloor || 0), base);
}

function gpuLabel(item: ServerPlanItem) {
  const count = Number(item.gpuCount ?? item.gpu ?? 0);
  return count > 0 ? `${count} GPU` : "CPU";
}

function sourceText(item: ServerPlanItem) {
  const source = String(item.source || payload.value?.source || "").toLowerCase();
  if (source.includes("tencent")) return "腾讯云报价";
  if (source.includes("catalog")) return "平台规格目录";
  return item.priceStatus === "quoted" ? "账单聚合服务" : "等待同步";
}

function orderStatusBadge(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["running", "provisioning"].includes(normalized)) return "badge-primary";
  if (["settled", "released"].includes(normalized)) return "badge-success";
  if (["failed", "cancelled"].includes(normalized)) return "badge-danger";
  return "badge-warning";
}

function orderStatusText(status?: string) {
  const normalized = String(status || "").toLowerCase();
  const labels: Record<string, string> = {
    quoted: "已报价",
    frozen: "已冻结",
    provisioning: "开通中",
    running: "运行中",
    released: "已释放",
    reconciling: "对账中",
    settled: "已结算",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[normalized] || "未下单";
}

function provisioningText(item: ServerPlanItem) {
  const mode = String(item.provisioningMode || "schedule_to_node_pool").toLowerCase();
  if (mode === "tke_node_pool") return "自动开通节点池";
  if (mode === "tke_node_pool_scale") return "自动扩容节点池";
  if (mode === "cvm_instance") return "自动开通云主机";
  return "调度到现有节点池";
}

function latestOrderByPlan(planId?: string) {
  return orders.value.find((item) => item.serverPlanId === planId);
}

function isSelected(item: ServerPlanItem) {
  return Boolean(item.id && payload.value?.selectedServerPlan?.id === item.id);
}

async function loadOrders() {
  try {
    ordersPayload.value = await fetchResourceOrders({ limit: 8, workspaceId: payload.value?.workspaceId || "default" });
  } catch {
    ordersPayload.value = { items: [] };
  }
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

async function quotePlan(item: ServerPlanItem) {
  if (!item.salable || !item.id) return;
  quoting.value = item.id;
  error.value = "";
  try {
    await quoteResourceOrder({
      workspaceId: payload.value?.workspaceId || "default",
      serverPlanId: item.id,
      estimatedHours: Math.max(1, Number(item.minBillableHours || 1)),
    });
    await loadOrders();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "资源报价失败";
  } finally {
    quoting.value = "";
  }
}

async function freezePlan(item: ServerPlanItem) {
  if (!item.salable || !item.id) return;
  freezing.value = item.id;
  error.value = "";
  try {
    await freezeResourceOrder({
      workspaceId: payload.value?.workspaceId || "default",
      serverPlanId: item.id,
      estimatedHours: Math.max(1, Number(item.minBillableHours || 1)),
    });
    await loadOrders();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "冻结资源订单失败";
  } finally {
    freezing.value = "";
  }
}

onMounted(async () => {
  loading.value = true;
  error.value = "";
  try {
    payload.value = await fetchServerPlans();
    await loadOrders();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "服务器价格加载失败";
  } finally {
    loading.value = false;
  }
});
</script>
