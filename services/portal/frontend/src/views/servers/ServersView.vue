<template>
  <AppLayout title="服务器与费用" subtitle="浏览可用云服务器、筛选规格、完成报价与下单">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载服务器商品目录...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>

      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div class="card p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-primary">{{ primaryRegionLabel }}</span>
                  <span class="badge" :class="readiness.realPriceReady ? 'badge-success' : 'badge-warning'">
                    {{ readiness.realPriceReady ? "实时价格就绪" : "价格待刷新" }}
                  </span>
                  <span class="badge" :class="readiness.exactBillReady ? 'badge-success' : 'badge-warning'">
                    {{ readiness.exactBillReady ? "真实账单就绪" : "账单待同步" }}
                  </span>
                </div>
                <h2 class="mt-3 text-xl font-semibold text-gray-950 dark:text-white">云服务器商品目录</h2>
                <p class="mt-2 max-w-3xl text-sm text-gray-600 dark:text-slate-300">
                  目录数据来自后台聚合服务，门户只展示可购买规格、预计价格和下单状态。不可售规格会禁用报价、冻结和下单。
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <a class="btn btn-primary" href="/portal/opl">进入工作台</a>
                <RouterLink class="btn btn-secondary" to="/billing">查看账单</RouterLink>
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
              <div v-if="opsSurfaceEnabled" class="muted-kv">
                <span class="muted-kv-label">节点池</span>
                <span class="muted-kv-value">{{ cloudSummary.nodePoolCount || 0 }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">云服务器</span>
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
          <MetricCard label="可售规格" :value="payload.summary.salableCount" hint="可执行下单" />
          <MetricCard label="已报价" :value="payload.summary.quotedCount" hint="实时价格" />
          <MetricCard label="最低小时价" :value="money(payload.summary.lowestHourlyPrice)" hint="按规格实时返回" />
          <MetricCard label="活跃订单" :value="activeOrderCount" hint="报价/冻结/开通/运行中" />
        </section>

        <section class="card p-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="panel-title">服务器商品目录</h2>
              <p class="panel-subtitle">
                来源：{{ payload.source }}，共 {{ catalogPagination.total }} 个规格，当前第 {{ catalogPagination.page }}/{{ catalogPagination.totalPages }} 页
              </p>
            </div>
            <div class="grid min-w-[280px] grid-cols-1 gap-2 sm:grid-cols-2">
              <label class="text-sm text-gray-600 dark:text-slate-300">
                <span class="mb-1 block">CPU</span>
                <select v-model="cpuFilter" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" @change="resetCatalogPage">
                  <option value="">全部</option>
                  <option v-for="value in filterOptions.cpu" :key="`cpu-${value}`" :value="String(value)">{{ value }} 核</option>
                </select>
              </label>
              <label class="text-sm text-gray-600 dark:text-slate-300">
                <span class="mb-1 block">内存</span>
                <select v-model="memoryFilter" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" @change="resetCatalogPage">
                  <option value="">全部</option>
                  <option v-for="value in filterOptions.memoryGb" :key="`memory-${value}`" :value="String(value)">{{ value }} GB</option>
                </select>
              </label>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-600 dark:border-slate-800 dark:text-slate-300">
            <span>筛选后 {{ filteredPlans.length }} 个规格，每页固定 4 个。</span>
            <span v-if="cpuFilter || memoryFilter">
              条件：
              <span v-if="cpuFilter">CPU {{ cpuFilter }} 核</span>
              <span v-if="cpuFilter && memoryFilter"> / </span>
              <span v-if="memoryFilter">内存 {{ memoryFilter }} GB</span>
            </span>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
            <article
              v-for="item in visiblePlans"
              :key="item.id"
              class="card p-5"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-base font-semibold text-gray-950 dark:text-white">{{ item.name || item.id }}</h3>
                  <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.instanceType || "云服务器" }}</p>
                </div>
                <span class="badge" :class="isOrderable(item) ? 'badge-success' : 'badge-warning'">
                  {{ isOrderable(item) ? "可下单" : "不可售" }}
                </span>
              </div>

              <div class="mt-4 space-y-2 text-sm">
                <div class="muted-kv">
                  <span class="muted-kv-label">配置</span>
                  <span class="muted-kv-value">{{ item.cpu }}C / {{ item.memoryGb }}GB</span>
                </div>
                <div class="muted-kv">
                  <span class="muted-kv-label">地域/可用区</span>
                  <span class="muted-kv-value">{{ item.region || "-" }} / {{ item.zone || "-" }}</span>
                </div>
                <div class="muted-kv">
                  <span class="muted-kv-label">库存状态</span>
                  <span class="muted-kv-value">{{ availabilityLabel(item) || "-" }}</span>
                </div>
                <div class="muted-kv">
                  <span class="muted-kv-label">小时价</span>
                  <span class="muted-kv-value">{{ money(hourlyPrice(item), item.currency) }}</span>
                </div>
                <div class="muted-kv">
                  <span class="muted-kv-label">冻结金额</span>
                  <span class="muted-kv-value">{{ money(freezeAmount(item), item.currency) }}</span>
                </div>
                <div class="muted-kv">
                  <span class="muted-kv-label">订单</span>
                  <span class="muted-kv-value">{{ orderStatusText(latestOrderByPlan(item.id)?.status) }}</span>
                </div>
              </div>

              <div class="mt-4 grid grid-cols-2 gap-2">
                <button class="btn btn-secondary" :disabled="!isOrderable(item) || selecting === item.id" @click="choosePlan(item)">
                  {{ isSelected(item) ? "已默认" : "设为默认" }}
                </button>
                <button class="btn btn-secondary" :disabled="!isOrderable(item) || quoting === item.id" @click="quotePlan(item)">
                  {{ quoting === item.id ? "报价中" : "报价" }}
                </button>
                <button class="btn btn-secondary" :disabled="!isOrderable(item) || freezing === item.id" @click="freezePlan(item)">
                  {{ freezing === item.id ? "冻结中" : "冻结" }}
                </button>
                <button class="btn btn-primary" :disabled="!isOrderable(item) || provisioning === item.id" @click="provisionPlan(item)">
                  {{ provisioning === item.id ? "开通中" : "下单" }}
                </button>
              </div>
              <p v-if="planDisabledReasonText(item)" class="mt-3 text-xs text-amber-700 dark:text-amber-300">{{ planDisabledReasonText(item) }}</p>
            </article>
          </div>

          <div v-if="!visiblePlans.length" class="empty-state mt-4">当前筛选条件下没有规格。</div>

          <div class="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button class="btn btn-secondary" :disabled="catalogPagination.page <= 1" @click="goToCatalogPage(catalogPagination.page - 1)">上一页</button>
            <span class="min-w-[88px] text-center text-sm text-gray-500 dark:text-slate-400">
              {{ catalogPagination.page }} / {{ catalogPagination.totalPages }}
            </span>
            <button class="btn btn-secondary" :disabled="catalogPagination.page >= catalogPagination.totalPages" @click="goToCatalogPage(catalogPagination.page + 1)">下一页</button>
          </div>
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
                  <div>冻结 {{ money(item.freezeAmount ?? item.frozenAmount, item.currency) }}</div>
                  <div>最终 {{ money(item.exactCost, item.currency) }}</div>
                  <div>服务器编号 {{ firstCloudResource(item) || "-" }}</div>
                  <div>{{ item.pricingSource || "-" }}</div>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button class="btn btn-secondary" :disabled="releasing === item.id" @click="releaseOrder(item, true)">缩容到 0</button>
                  <button v-if="opsSurfaceEnabled" class="btn btn-secondary" @click="openDeleteDialog(item)">删除节点池</button>
                </div>
              </div>
              <div v-if="!orders.length" class="empty-state">暂无资源订单</div>
            </div>
          </div>

          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">云资源清单</h2>
                <p class="panel-subtitle">云服务器编号与费用归因</p>
              </div>
              <button class="btn btn-secondary" @click="reloadCloudResources">刷新</button>
            </div>

            <div v-if="!cloudResources?.resources?.ok" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              {{ cloudResources?.resources?.reason || "云资源未接入" }}
            </div>

            <div class="mt-3 space-y-3">
              <div
                v-if="opsSurfaceEnabled"
                v-for="item in nodePools.slice(0, 5)"
                :key="resourceKey(item)"
                class="rounded-xl border border-gray-100 px-4 py-3 text-sm dark:border-slate-700"
              >
                <div class="flex items-center justify-between gap-3">
                  <span class="font-medium text-gray-950 dark:text-white">{{ stringFrom(item, "name", "nodePoolId", "id") }}</span>
                  <span class="badge badge-primary">服务器组</span>
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
              <div v-if="(!opsSurfaceEnabled || !nodePools.length) && !instances.length" class="empty-state">暂无可展示云资源</div>
            </div>
          </div>
        </section>

        <section class="card p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">结算规则</h2>
              <p class="panel-subtitle">冻结按报价，最终扣费按真实账单回补</p>
            </div>
            <span class="badge" :class="readiness.exactBillReady ? 'badge-success' : 'badge-warning'">
              {{ readiness.exactBillReady ? "已校准" : "待校准" }}
            </span>
          </div>
        </section>

        <div v-if="opsSurfaceEnabled && deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div class="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
            <h2 class="text-lg font-semibold text-gray-950 dark:text-white">删除节点池</h2>
            <p class="mt-3 text-sm leading-6 text-gray-600 dark:text-slate-300">
              删除服务器会释放对应运行资源，运行环境和节点本地数据不可恢复。保留实例时，删除服务器组后仍可能继续产生云资源费用。
            </p>
            <label class="mt-4 flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
              <input v-model="destroyCvmInstances" type="checkbox" />
              同时销毁云服务器实例
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
  fetchCurrentUser,
  fetchCloudResources,
  fetchResourceOrders,
  fetchServerPlans,
  freezeResourceOrder,
  provisionResourceOrder,
  quoteResourceOrder,
  releaseResourceOrder,
  selectServerPlan,
} from "@/api/portal";
import {
  SERVER_PLAN_PAGE_SIZE,
  collectServerPlanFilterOptions,
  filterServerPlans,
  paginateServerPlans,
  planAvailabilityLabel,
  planCanOrder,
  planDisabledReason,
  planHourlyPrice,
} from "./server-plan-catalog";

const loading = ref(true);
const error = ref("");
const payload = ref<ServerPlansPayload | null>(null);
const currentUser = ref<any>(null);
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
const cpuFilter = ref("");
const memoryFilter = ref("");
const catalogPage = ref(1);

const serverPlanItems = computed<ServerPlanItem[]>(() => payload.value?.items || []);
const cloudStatus = computed(() => payload.value?.cloudStatus || payload.value?.summary?.cloudStatus || null);
const opsSurfaceEnabled = computed(() => Boolean(currentUser.value?.productProfile?.opsSurfaceEnabled));
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
const primaryRegionLabel = computed(() => {
  const region = cloudStatus.value?.region || serverPlanItems.value[0]?.region || "na-siliconvalley";
  return region === "na-siliconvalley" ? "Silicon Valley" : region;
});
const filterOptions = computed(() => collectServerPlanFilterOptions(serverPlanItems.value));
const filteredPlans = computed(() => filterServerPlans(serverPlanItems.value, {
  cpu: cpuFilter.value,
  memoryGb: memoryFilter.value,
}));
const pagedCatalog = computed(() => paginateServerPlans(filteredPlans.value, catalogPage.value, SERVER_PLAN_PAGE_SIZE));
const visiblePlans = computed<ServerPlanItem[]>(() => pagedCatalog.value.items as ServerPlanItem[]);
const catalogPagination = computed(() => pagedCatalog.value.pagination);

function money(value: number | undefined | null, currency = "CNY") {
  return `${currency || "CNY"} ${Number(value || 0).toFixed(2)}`;
}

function hourlyPrice(item: ServerPlanItem) {
  return planHourlyPrice(item);
}

function freezeAmount(item: ServerPlanItem) {
  return Math.max(
    Number(item.reservationFloor || 0),
    hourlyPrice(item) * Math.max(1, Number(item.minBillableHours || 1)) * Math.max(1, Number(item.riskFactor || 1)),
  );
}

function isOrderable(item: ServerPlanItem) {
  return planCanOrder(item);
}

function availabilityLabel(item: ServerPlanItem) {
  return planAvailabilityLabel(item);
}

function planDisabledReasonText(item: ServerPlanItem) {
  return planDisabledReason(item);
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
    ? tags.map((tag) => `${(tag as Record<string, unknown>).Key || (tag as Record<string, unknown>).key || ""}:${(tag as Record<string, unknown>).Value || (tag as Record<string, unknown>).value || ""}`).join(",")
    : JSON.stringify(tags || {});
  return ["tenantid", "workspaceid", "runid", "resourceorderid", "serverplanid"].every((key) => tagText.includes(key));
}

function resetCatalogPage() {
  catalogPage.value = 1;
}

function goToCatalogPage(page: number) {
  const totalPages = catalogPagination.value.totalPages;
  catalogPage.value = Math.min(Math.max(1, page), totalPages);
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [plans, ordersData, cloudData, user] = await Promise.all([
      fetchServerPlans(),
      fetchResourceOrders({ limit: 20 }),
      fetchCloudResources().catch(() => null),
      fetchCurrentUser().catch(() => null),
    ]);
    payload.value = plans;
    ordersPayload.value = ordersData;
    cloudResources.value = cloudData;
    currentUser.value = user;
    goToCatalogPage(1);
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : "服务器与费用加载失败";
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
