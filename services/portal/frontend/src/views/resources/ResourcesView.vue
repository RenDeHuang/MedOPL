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
          <MetricCard label="余额状态" :value="balanceFreezeStatus" hint="系统自动计算冻结金额" />
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
              <h2 class="panel-title">套餐选择</h2>
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
            <h2 class="panel-title">释放审计</h2>
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
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import { useResourcesSurface } from "@/composables/useResourcesSurface";

const {
  actionFeedback,
  auditStatusText,
  balanceFreezeStatus,
  computeSpecText,
  concurrencyText,
  currentConcurrencyText,
  currentComputeSpec,
  currentFileSpaceText,
  currentPlanId,
  currentPlanName,
  currentProtection,
  currentStatus,
  errorMessage,
  estimatedCost,
  items,
  money,
  planCards,
  planLabel,
  protectionEstimateText,
  releasePolicyText,
  reload,
  resourcesLoading,
  setAdjustmentPlan,
  statusBadge,
  statusText,
  stopBillingText,
  storageCapacityText,
  workspaceDisplayName,
} = useResourcesSurface();
</script>
