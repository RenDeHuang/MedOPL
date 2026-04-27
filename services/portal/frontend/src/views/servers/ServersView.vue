<template>
  <AppLayout title="服务器与费用" subtitle="选择规格、开通资源、追踪账单">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载服务器资源...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>

      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div class="card p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-primary">Silicon Valley</span>
                  <span class="badge" :class="readiness.realPriceReady ? 'badge-success' : 'badge-warning'">
                    {{ readiness.realPriceReady ? "真实报价" : "报价未就绪" }}
                  </span>
                  <span class="badge" :class="readiness.exactBillReady ? 'badge-success' : 'badge-warning'">
                    {{ readiness.exactBillReady ? "真实账单" : "账单等待中" }}
                  </span>
                </div>
                <h2 class="mt-3 text-xl font-semibold text-gray-950 dark:text-white">按订单开通独立节点池</h2>
                <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">
                  每个订单独享节点池，最大 2 个节点，支持缩容到 0。
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <a class="btn btn-primary" href="/portal/opl">进入工作台</a>
                <RouterLink class="btn btn-secondary" to="/billing">账单</RouterLink>
              </div>
            </div>
          </div>

          <div class="card p-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">云接入</h2>
                <p class="panel-subtitle">{{ cloudStatus?.region || "na-siliconvalley" }}</p>
              </div>
              <span class="badge" :class="readiness.cloudAccountConnected ? 'badge-success' : 'badge-warning'">
                {{ readiness.cloudAccountConnected ? "已接入" : "未接入" }}
              </span>
            </div>
            <div class="mt-4 space-y-2.5 text-sm">
              <div class="muted-kv">
                <span class="muted-kv-label">集群</span>
                <span class="muted-kv-value">{{ clusterId }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">节点池</span>
                <span class="muted-kv-value">{{ cloudSummary.nodePoolCount || 0 }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">CVM</span>
                <span class="muted-kv-value">{{ cloudSummary.instanceCount || 0 }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">标签完整</span>
                <span class="muted-kv-value">{{ cloudSummary.taggedInstanceCount || 0 }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="可售规格" :value="payload.summary.salableCount" hint="CPU 白名单" />
          <MetricCard label="已报价" :value="payload.summary.quotedCount" hint="腾讯云询价" />
          <MetricCard label="最低小时价" :value="money(payload.summary.lowestHourlyPrice)" hint="实时价" />
          <MetricCard label="活跃订单" :value="activeOrderCount" hint="冻结/开通/运行" />
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <article
            v-for="item in payload.items"
            :key="item.id"
            class="card p-5"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-base font-semibold text-gray-950 dark:text-white">{{ item.name || item.id }}</h3>
                <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.instanceType || "Tencent CVM" }}</p>
              </div>
              <span class="badge" :class="item.salable ? 'badge-success' : 'badge-warning'">
                {{ item.salable ? "可售" : "不可售" }}
              </span>
            </div>

            <div class="mt-4 space-y-2 text-sm">
              <div class="muted-kv">
                <span class="muted-kv-label">配置</span>
                <span class="muted-kv-value">{{ item.cpu }}C / {{ item.memoryGb }}GB</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">地域</span>
                <span class="muted-kv-value">{{ item.region || "-" }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">小时价</span>
                <span class="muted-kv-value">{{ money(hourlyPrice(item)) }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">冻结</span>
                <span class="muted-kv-value">{{ money(freezeAmount(item)) }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">订单</span>
                <span class="muted-kv-value">{{ orderStatusText(latestOrderByPlan(item.id)?.status) }}</span>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-2">
              <button class="btn btn-secondary" :disabled="!item.salable || selecting === item.id" @click="choosePlan(item)">
                {{ isSelected(item) ? "已默认" : "设默认" }}
              </button>
              <button class="btn btn-secondary" :disabled="!item.salable || quoting === item.id" @click="quotePlan(item)">
                {{ quoting === item.id ? "报价中" : "报价" }}
              </button>
              <button class="btn btn-secondary" :disabled="!item.salable || freezing === item.id" @click="freezePlan(item)">
                {{ freezing === item.id ? "冻结中" : "冻结" }}
              </button>
              <button class="btn btn-primary" :disabled="!item.salable || provisioning === item.id" @click="provisionPlan(item)">
                {{ provisioning === item.id ? "开通中" : "开通" }}
              </button>
            </div>
            <p v-if="item.reason" class="mt-3 text-xs text-amber-700 dark:text-amber-300">{{ item.reason }}</p>
          </article>
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">资源订单</h2>
                <p class="panel-subtitle">报价、冻结、开通、释放</p>
              </div>
              <span class="badge badge-primary">{{ orders.length }}</span>
            </div>

            <div class="space-y-2.5">
              <div
                v-for="item in orders.slice(0, 6)"
                :key="item.id"
                class="rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-700"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.serverPlanName || item.serverPlanId || item.id }}</div>
                    <div class="mt-1 font-mono text-xs text-gray-500 dark:text-slate-400">{{ item.id }}</div>
                  </div>
                  <span class="badge" :class="orderStatusBadge(item.status)">{{ orderStatusText(item.status) }}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-slate-400">
                  <div>冻结 {{ money(item.freezeAmount ?? item.frozenAmount) }}</div>
                  <div>Exact {{ money(item.exactCost) }}</div>
                  <div>节点池 {{ firstCloudResource(item) || "-" }}</div>
                  <div>{{ item.pricingSource || "-" }}</div>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button class="btn btn-secondary" :disabled="releasing === item.id" @click="releaseOrder(item, true)">缩容到 0</button>
                  <button class="btn btn-secondary" @click="openDeleteDialog(item)">删除节点池</button>
                </div>
              </div>
              <div v-if="!orders.length" class="empty-state">暂无资源订单</div>
            </div>
          </div>

          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">云资源清单</h2>
                <p class="panel-subtitle">TKE 节点池与 CVM 标签归因</p>
              </div>
              <button class="btn btn-secondary" @click="reloadCloudResources">刷新</button>
            </div>

            <div v-if="!cloudResources?.resources?.ok" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              {{ cloudResources?.resources?.reason || "云资源未接入" }}
            </div>

            <div class="mt-3 space-y-3">
              <div
                v-for="item in nodePools.slice(0, 5)"
                :key="resourceKey(item)"
                class="rounded-xl border border-gray-100 px-4 py-3 text-sm dark:border-slate-700"
              >
                <div class="flex items-center justify-between gap-3">
                  <span class="font-medium text-gray-950 dark:text-white">{{ stringFrom(item, "name", "nodePoolId", "id") }}</span>
                  <span class="badge badge-primary">NodePool</span>
                </div>
                <div class="mt-2 text-xs text-gray-500 dark:text-slate-400">{{ stringFrom(item, "status", "state") }}</div>
              </div>
              <div
                v-for="item in instances.slice(0, 5)"
                :key="resourceKey(item)"
                class="rounded-xl border border-gray-100 px-4 py-3 text-sm dark:border-slate-700"
              >
                <div class="flex items-center justify-between gap-3">
                  <span class="font-medium text-gray-950 dark:text-white">{{ stringFrom(item, "instanceName", "name", "instanceId", "id") }}</span>
                  <span class="badge" :class="tagComplete(item) ? 'badge-success' : 'badge-warning'">
                    {{ tagComplete(item) ? "标签完整" : "缺标签" }}
                  </span>
                </div>
                <div class="mt-2 text-xs text-gray-500 dark:text-slate-400">{{ stringFrom(item, "instanceType", "status", "state") }}</div>
              </div>
              <div v-if="!nodePools.length && !instances.length" class="empty-state">暂无可展示云资源</div>
            </div>
          </div>
        </section>

        <section class="card p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">结算规则</h2>
              <p class="panel-subtitle">冻结按报价，最终扣费按腾讯云真实账单</p>
            </div>
            <span class="badge" :class="readiness.exactBillReady ? 'badge-success' : 'badge-warning'">
              {{ readiness.exactBillReady ? "exact ready" : "exact pending" }}
            </span>
          </div>
        </section>

        <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div class="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 class="text-lg font-semibold text-gray-950 dark:text-white">删除节点池</h2>
            <p class="mt-3 text-sm leading-6 text-gray-600 dark:text-slate-300">
              销毁 CVM 会释放节点池内实例，运行环境和节点本地数据不可恢复。保留 CVM 则节点池删除后实例仍可能继续产生云资源费用。
            </p>
            <label class="mt-4 flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
              <input v-model="destroyCvmInstances" type="checkbox" />
              同时销毁 CVM 实例
            </label>
            <div class="mt-5 flex justify-end gap-2">
              <button class="btn btn-secondary" @click="closeDeleteDialog">取消</button>
              <button class="btn btn-primary" :disabled="deleting === deleteTarget.id" @click="confirmDeleteNodePool">
                {{ deleting === deleteTarget.id ? "删除中" : "确认删除" }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import type {
  CloudResourcesPayload,
  ResourceOrderItem,
  ResourceOrdersPayload,
  ServerPlanItem,
  ServerPlansPayload,
} from "@/api/portal";
import {
  deleteResourceOrderNodePool,
  fetchCloudResources,
  fetchResourceOrders,
  fetchServerPlans,
  freezeResourceOrder,
  provisionResourceOrder,
  quoteResourceOrder,
  releaseResourceOrder,
  selectServerPlan,
} from "@/api/portal";

const loading = ref(true);
const error = ref("");
const payload = ref<ServerPlansPayload | null>(null);
const ordersPayload = ref<ResourceOrdersPayload | null>(null);
const cloudResources = ref<CloudResourcesPayload | null>(null);
const selecting = ref("");
const quoting = ref("");
const freezing = ref("");
const provisioning = ref("");
const releasing = ref("");
const deleting = ref("");
const deleteTarget = ref<ResourceOrderItem | null>(null);
const destroyCvmInstances = ref(false);

const cloudStatus = computed(() => payload.value?.cloudStatus || payload.value?.summary?.cloudStatus || null);
const readiness = computed(() => ({
  cloudAccountConnected: Boolean(cloudStatus.value?.readiness?.cloudAccountConnected ?? payload.value?.configured),
  realPriceReady: Boolean(cloudStatus.value?.readiness?.realPriceReady ?? (payload.value?.summary.quotedCount || 0) > 0),
  exactBillReady: Boolean(cloudStatus.value?.readiness?.exactBillReady),
}));
const orders = computed<ResourceOrderItem[]>(() => ordersPayload.value?.items || []);
const activeOrderCount = computed(() => orders.value.filter((item) => ["quoted", "frozen", "provisioning", "running", "reconciling"].includes(String(item.status || "").toLowerCase())).length);
const cloudSummary = computed(() => cloudResources.value?.resources?.summary || {});
const nodePools = computed(() => cloudResources.value?.resources?.nodePools || []);
const instances = computed(() => cloudResources.value?.resources?.instances || []);
const clusterId = computed(() => stringFrom(cloudResources.value?.resources?.cluster || {}, "clusterId", "id") || "cls-ngiq693i");

function money(value: number | undefined | null) {
  return `CNY ${Number(value || 0).toFixed(2)}`;
}

function hourlyPrice(item: ServerPlanItem) {
  return Number(item.discountPrice ?? item.unitPrice ?? item.originalPrice ?? 0);
}

function freezeAmount(item: ServerPlanItem) {
  return Math.max(Number(item.reservationFloor || 0), hourlyPrice(item) * Math.max(1, Number(item.minBillableHours || 1)) * Math.max(1, Number(item.riskFactor || 1)));
}

function isSelected(item: ServerPlanItem) {
  return payload.value?.selectedServerPlan?.id === item.id;
}

function latestOrderByPlan(planId?: string) {
  return orders.value.find((item) => item.serverPlanId === planId);
}

function orderStatusBadge(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["running", "provisioning"].includes(normalized)) return "badge-primary";
  if (["settled", "released"].includes(normalized)) return "badge-success";
  if (["failed", "cancelled"].includes(normalized)) return "badge-danger";
  return "badge-warning";
}

function orderStatusText(status?: string) {
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
  return labels[String(status || "").toLowerCase()] || status || "无订单";
}

function firstCloudResource(item: ResourceOrderItem) {
  return Array.isArray(item.cloudResourceIds) ? item.cloudResourceIds[0] : "";
}

function stringFrom(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function resourceKey(item: Record<string, unknown>) {
  return stringFrom(item, "nodePoolId", "instanceId", "id", "name") || JSON.stringify(item).slice(0, 80);
}

function tagComplete(item: Record<string, unknown>) {
  const tags = item.tags;
  const tagText = Array.isArray(tags)
    ? tags.map((tag) => `${(tag as any).Key || (tag as any).key || ""}:${(tag as any).Value || (tag as any).value || ""}`).join(",")
    : JSON.stringify(tags || {});
  return ["tenant_id", "workspace_id", "run_id", "resource_order_id", "server_plan_id"].every((key) => tagText.includes(key));
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [plans, ordersData, cloudData] = await Promise.all([
      fetchServerPlans(),
      fetchResourceOrders({ limit: 20 }),
      fetchCloudResources().catch(() => null),
    ]);
    payload.value = plans;
    ordersPayload.value = ordersData;
    cloudResources.value = cloudData;
  } catch (err: any) {
    error.value = err?.message || "服务器与费用加载失败";
  } finally {
    loading.value = false;
  }
}

async function reloadCloudResources() {
  cloudResources.value = await fetchCloudResources();
}

async function choosePlan(item: ServerPlanItem) {
  selecting.value = item.id;
  try {
    await selectServerPlan({ planId: item.id });
    await load();
  } finally {
    selecting.value = "";
  }
}

async function quotePlan(item: ServerPlanItem) {
  quoting.value = item.id;
  try {
    await quoteResourceOrder({ serverPlanId: item.id, estimatedHours: 1 });
    ordersPayload.value = await fetchResourceOrders({ limit: 20 });
  } finally {
    quoting.value = "";
  }
}

async function freezePlan(item: ServerPlanItem) {
  freezing.value = item.id;
  try {
    await freezeResourceOrder({ serverPlanId: item.id, estimatedHours: 1 });
    ordersPayload.value = await fetchResourceOrders({ limit: 20 });
  } finally {
    freezing.value = "";
  }
}

async function provisionPlan(item: ServerPlanItem) {
  provisioning.value = item.id;
  try {
    let order = latestOrderByPlan(item.id);
    if (!order || String(order.status || "").toLowerCase() === "quoted") {
      const frozen = await freezeResourceOrder({ resourceOrderId: order?.id, serverPlanId: item.id, estimatedHours: 1 });
      order = frozen.order || order;
    }
    if (order?.id) {
      await provisionResourceOrder({ resourceOrderId: order.id });
    }
    await load();
  } finally {
    provisioning.value = "";
  }
}

async function releaseOrder(item: ResourceOrderItem, scaleToZero: boolean) {
  releasing.value = item.id;
  try {
    await releaseResourceOrder({ resourceOrderId: item.id, scaleToZero });
    await load();
  } finally {
    releasing.value = "";
  }
}

function openDeleteDialog(item: ResourceOrderItem) {
  deleteTarget.value = item;
  destroyCvmInstances.value = false;
}

function closeDeleteDialog() {
  deleteTarget.value = null;
  destroyCvmInstances.value = false;
}

async function confirmDeleteNodePool() {
  if (!deleteTarget.value) return;
  deleting.value = deleteTarget.value.id;
  try {
    await deleteResourceOrderNodePool({
      resourceOrderId: deleteTarget.value.id,
      nodePoolId: firstCloudResource(deleteTarget.value),
      destroyCvmInstances: destroyCvmInstances.value,
      confirmDeleteNodePool: true,
    });
    closeDeleteDialog();
    await load();
  } finally {
    deleting.value = "";
  }
}

onMounted(() => {
  void load();
});
</script>
