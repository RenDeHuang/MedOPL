<template>
  <AppLayout title="工作台资源" subtitle="查看套餐、文件空间、费用估算与释放策略">
    <div class="space-y-4">
      <section class="card p-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 class="panel-title">工作台资源</h2>
            <p class="panel-subtitle">用于科研工作台的套餐、计算规格和文件空间。</p>
          </div>
          <button class="btn btn-secondary" :disabled="resourcesLoading" @click="reload">刷新</button>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="当前套餐" :value="currentPlanName" hint="工作台资源套餐" />
          <MetricCard label="计算规格" :value="currentComputeSpec" hint="托管运行环境" />
          <MetricCard label="文件空间" :value="currentFileSpaceText" hint="输入文件和输出文件" />
          <MetricCard label="并发数" :value="currentConcurrencyText" hint="可同时运行的任务" />
          <MetricCard label="预计费用" :value="money(estimatedCost)" hint="只作估算展示" />
          <MetricCard label="余额/冻结金额状态" :value="balanceFreezeStatus" hint="系统自动计算" />
        </div>
      </section>

      <section v-if="actionFeedback" class="card p-4">
        <div class="text-sm text-emerald-700 dark:text-emerald-300">{{ actionFeedback }}</div>
      </section>

      <section v-if="errorMessage" class="card p-4">
        <div class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</div>
      </section>

      <section v-if="resourcesLoading" class="card p-5">
        <div class="text-sm text-gray-600 dark:text-slate-300">正在加载工作台资源...</div>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div class="card p-5">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 class="panel-title">选择套餐 / 工作台资源计划</h2>
              <p class="panel-subtitle">选择套餐后生成 dry-run 调整计划，不会真实开通资源。</p>
            </div>
            <span class="badge badge-primary">dry-run</span>
          </div>
          <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <article
              v-for="plan in planCards"
              :key="plan.id"
              class="rounded-2xl border border-gray-100 p-4 dark:border-slate-700"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-base font-semibold text-gray-950 dark:text-white">{{ plan.name }}</h3>
                  <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ plan.description }}</p>
                </div>
                <span class="badge" :class="plan.id === currentPlanId ? 'badge-success' : 'badge-primary'">
                  {{ plan.id === currentPlanId ? "当前套餐" : "可选套餐" }}
                </span>
              </div>
              <dl class="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div class="muted-kv">
                  <dt class="muted-kv-label">计算规格</dt>
                  <dd class="muted-kv-value">{{ plan.computeSpec }}</dd>
                </div>
                <div class="muted-kv">
                  <dt class="muted-kv-label">文件空间</dt>
                  <dd class="muted-kv-value">{{ plan.fileSpace }}</dd>
                </div>
                <div class="muted-kv">
                  <dt class="muted-kv-label">并发数</dt>
                  <dd class="muted-kv-value">{{ plan.concurrency }}</dd>
                </div>
                <div class="muted-kv">
                  <dt class="muted-kv-label">预计费用</dt>
                  <dd class="muted-kv-value">{{ plan.estimatedCost }}</dd>
                </div>
              </dl>
              <button class="btn btn-secondary mt-4 w-full" type="button" @click="setAdjustmentPlan(plan.name)">
                生成套餐调整计划
              </button>
            </article>
          </div>
        </div>

        <div class="card p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="panel-title">调整计划</h2>
              <p class="panel-subtitle">增加资源只生成 dry-run 计划，不会真实开通。</p>
            </div>
            <span class="badge badge-warning shrink-0 whitespace-nowrap">需确认</span>
          </div>
          <div class="mt-4 grid grid-cols-1 gap-3">
            <button class="btn btn-secondary justify-between" type="button" @click="setAdjustmentPlan('增加计算资源')">
              <span>增加计算资源</span>
              <span class="text-xs text-gray-500 dark:text-slate-400">dry-run 调整计划</span>
            </button>
            <button class="btn btn-secondary justify-between" type="button" @click="setAdjustmentPlan('增加存储资源')">
              <span>增加存储资源</span>
              <span class="text-xs text-gray-500 dark:text-slate-400">dry-run 调整计划</span>
            </button>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div class="card p-5">
          <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 class="panel-title">当前工作台资源</h2>
              <p class="panel-subtitle">普通用户只查看可用状态和费用估算。</p>
            </div>
            <span class="badge" :class="statusBadge(currentStatus)">{{ statusText(currentStatus) }}</span>
          </div>
          <div v-if="!items.length" class="empty-state mt-4">当前还没有工作台资源。</div>
          <div v-else class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div
              v-for="item in items"
              :key="item.id"
              class="rounded-2xl border border-gray-100 p-4 dark:border-slate-700"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-sm font-semibold text-gray-950 dark:text-white">{{ workspaceDisplayName(item.workspaceId) }}</h3>
                  <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ planLabel(item.computeInstance?.serverPlanId) }}</p>
                </div>
                <span class="badge" :class="statusBadge(item.status)">{{ statusText(item.status) }}</span>
              </div>
              <dl class="mt-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                <div class="muted-kv">
                  <dt class="muted-kv-label">计算规格</dt>
                  <dd class="muted-kv-value">{{ computeSpecText(item.computeInstance) }}</dd>
                </div>
                <div class="muted-kv">
                  <dt class="muted-kv-label">文件空间</dt>
                  <dd class="muted-kv-value">{{ storageCapacityText(item.storageBucket) }}</dd>
                </div>
                <div class="muted-kv">
                  <dt class="muted-kv-label">并发数</dt>
                  <dd class="muted-kv-value">{{ concurrencyText(item.computeInstance?.serverPlanId) }}</dd>
                </div>
                <div class="muted-kv">
                  <dt class="muted-kv-label">预计费用</dt>
                  <dd class="muted-kv-value">{{ protectionEstimateText(item.protection) }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div class="card p-5">
          <div>
            <h2 class="panel-title">释放策略 / 审计状态</h2>
            <p class="panel-subtitle">停止计费和审计由平台自动核对。</p>
          </div>
          <div class="mt-4 space-y-3">
            <div class="muted-kv">
              <span class="muted-kv-label">释放策略</span>
              <span class="muted-kv-value">{{ releasePolicyText }}</span>
            </div>
            <div class="muted-kv">
              <span class="muted-kv-label">审计状态</span>
              <span class="muted-kv-value">{{ auditStatusText(currentProtection?.tPlus1AuditStatus) }}</span>
            </div>
            <div class="muted-kv">
              <span class="muted-kv-label">停止计费</span>
              <span class="muted-kv-value">{{ stopBillingText }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import {
  fetchMyResources,
  type CustomerComputeResource,
  type CustomerStorageResource,
  type PlatformProvisionedResourcesPayload,
  type WeeklyProtectionFreeze,
  type WorkspaceResourceBinding,
} from "@/api/portal";

const resourcesLoading = ref(false);
const errorMessage = ref("");
const actionFeedback = ref("");
const payload = ref<PlatformProvisionedResourcesPayload | null>(null);

const planCards = [
  {
    id: "starter_2c4g_10gb",
    name: "基础套餐",
    description: "适合轻量会话和小型任务。",
    computeSpec: "2 核 / 4GB",
    fileSpace: "10GB 文件空间",
    concurrency: "1 个任务",
    estimatedCost: "¥3.20 / 小时",
  },
  {
    id: "pro_8c16g_100gb",
    name: "Pro 套餐",
    description: "适合较大任务和更多输出文件。",
    computeSpec: "8 核 / 16GB",
    fileSpace: "100GB 文件空间",
    concurrency: "2 个任务",
    estimatedCost: "¥9.60 / 小时",
  },
];

const items = computed<WorkspaceResourceBinding[]>(() => payload.value?.items || []);
const protectionRows = computed<WeeklyProtectionFreeze[]>(() => payload.value?.protectionFreezes || []);
const currentBinding = computed(() => items.value.find((item) => item.status === "active") || items.value[0] || null);
const currentProtection = computed(() => currentBinding.value?.protection || protectionRows.value[0] || null);
const currentCompute = computed(() => currentBinding.value?.computeInstance || payload.value?.computeInstances?.[0] || null);
const currentStorage = computed(() => currentBinding.value?.storageBucket || payload.value?.storageBuckets?.[0] || null);
const currentStatus = computed(() => currentBinding.value?.status || "pending");
const currentPlanId = computed(() => currentCompute.value?.serverPlanId || planCards[0].id);
const currentPlanName = computed(() => planLabel(currentPlanId.value));
const currentComputeSpec = computed(() => computeSpecText(currentCompute.value));
const currentFileSpaceText = computed(() => storageCapacityText(currentStorage.value));
const currentConcurrencyText = computed(() => concurrencyText(currentPlanId.value));
const estimatedCost = computed(() => currentProtection.value?.weeklyAmount || currentProtection.value?.frozenAmount || 0);
const balanceFreezeStatus = computed(() => {
  const remaining = Number(currentProtection.value?.remainingAmount ?? 0);
  if (!currentProtection.value) return "待估算";
  return remaining > 0 ? "冻结金额充足" : "待核对";
});
const releasePolicyText = computed(() => (currentBinding.value?.status === "released" ? "已释放" : "按需释放后停止计费"));
const stopBillingText = computed(() => {
  const releasedAmount = Number(currentProtection.value?.releasedAmount ?? 0);
  return releasedAmount > 0 ? `已确认 ${money(releasedAmount)}` : "待释放";
});

function money(value: number | undefined) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function displayOrdinalFromId(value?: string) {
  const text = String(value || "").trim();
  const match = /(\d+)(?!.*\d)/.exec(text);
  return match ? match[1] : "";
}

function workspaceDisplayName(value?: string) {
  const ordinal = displayOrdinalFromId(value);
  return ordinal ? `工作空间 ${ordinal}` : "工作空间";
}

function statusBadge(status?: string) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["active", "done", "matched", "released"].includes(normalized)) return "badge-success";
  if (["pending", "inactive"].includes(normalized)) return "badge-warning";
  if (["failed", "error", "deleted"].includes(normalized)) return "badge-danger";
  return "badge-primary";
}

function statusText(status?: string) {
  const normalized = String(status || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    active: "可用",
    inactive: "已停用",
    deleted: "已删除",
    released: "已释放",
    pending: "待处理",
    done: "已完成",
    matched: "已核对",
    skipped: "已跳过",
  };
  return labels[normalized] || status || "-";
}

function auditStatusText(status?: string) {
  const normalized = String(status || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    pending: "待处理",
    done: "已完成",
    matched: "已核对",
    released: "已释放",
    skipped: "已跳过",
  };
  return labels[normalized] || "待处理";
}

function planLabel(planId?: string) {
  const normalized = String(planId || "").trim();
  const labels: Record<string, string> = {
    starter_2c4g_10gb: "基础套餐",
    pro_8c16g_100gb: "Pro 套餐",
  };
  return labels[normalized] || "基础套餐";
}

function computeSpecText(row?: Partial<CustomerComputeResource> | null) {
  const planId = String(row?.serverPlanId || "").trim();
  if (planId === "pro_8c16g_100gb") return "8 核 / 16GB";
  if (planId === "starter_2c4g_10gb") return "2 核 / 4GB";
  return String(row?.instanceType || "").trim() || "2 核 / 4GB";
}

function storageCapacityText(row?: Partial<CustomerStorageResource> | null) {
  const value = Number(row?.storageCapacityGb || 0);
  if (value >= 100) return "100GB 文件空间";
  if (value > 0) return `${value}GB 文件空间`;
  return "10GB 文件空间";
}

function concurrencyText(planId?: string) {
  return String(planId || "").trim() === "pro_8c16g_100gb" ? "2 个任务" : "1 个任务";
}

function protectionEstimateText(protection?: WeeklyProtectionFreeze | null) {
  return money(protection?.weeklyAmount || protection?.frozenAmount || 0);
}

function setAdjustmentPlan(label: string) {
  actionFeedback.value = `${label} 已生成 dry-run 调整计划，不会真实开通资源。`;
}

async function reload() {
  resourcesLoading.value = true;
  errorMessage.value = "";
  try {
    payload.value = await fetchMyResources();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "加载工作台资源失败";
  } finally {
    resourcesLoading.value = false;
  }
}

onMounted(async () => {
  await reload();
});
</script>
