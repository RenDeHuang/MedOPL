<template>
  <AppLayout title="会话轨迹" subtitle="查看会话、任务状态、文件结果与审计轨迹">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载会话轨迹...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <section class="card p-5">
          <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 class="panel-title">运行轨迹</h2>
              <p class="panel-subtitle">
                运行记录为准，观测摘要只作补充。
              </p>
            </div>
            <div v-if="payload.summary.businessFactSource && payload.customerDefaultLangfuseUi === false" class="text-right text-xs text-gray-500 dark:text-slate-400">
              默认在 Portal 查看，不跳转外部观测台
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="会话数" :value="payload.pagination.total" hint="当前筛选命中总数" />
          <MetricCard label="任务数" :value="runCount" hint="关联任务的会话" />
          <MetricCard label="输出文件" :value="outputCount" hint="可在工作空间下载" />
          <MetricCard label="费用估算" :value="money(totalEstimatedCost)" hint="只关联余额展示，不做真实扣费" />
        </section>

        <section class="card p-5">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 class="panel-title">运行轨迹</h2>
              <p class="panel-subtitle">
                运行轨迹只展示会话、工作空间、任务、输出文件引用、状态、观测摘要和时间；不会展示不适合普通用户查看的内部信息。
              </p>
              <p class="panel-subtitle">
                余额和充值状态只用于查看费用估算关联，当前页面不会执行真实扣费。
              </p>
            </div>
            <RouterLink class="btn btn-secondary" to="/workspace">查看文件空间</RouterLink>
          </div>
        </section>

        <section class="card p-5">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 class="panel-title">筛选</h2>
              <p class="panel-subtitle">用户侧只返回当前账号可见的运行轨迹。</p>
            </div>
            <div class="grid gap-3 md:grid-cols-3">
              <input v-model.trim="filters.workspaceId" class="input" type="text" placeholder="工作空间" />
              <input v-model.trim="filters.sessionId" class="input" type="text" placeholder="会话" />
              <select v-model="filters.status" class="input">
                <option value="">全部状态</option>
                <option value="active">运行中</option>
                <option value="running">运行中</option>
                <option value="completed">已完成</option>
                <option value="failed">失败</option>
                <option value="released">已释放</option>
                <option value="settled">已结算</option>
              </select>
            </div>
          </div>
          <div class="mt-3 flex gap-2">
            <button class="btn btn-primary" type="button" @click="applyFilters">应用筛选</button>
            <button class="btn btn-secondary" type="button" @click="resetFilters">重置</button>
          </div>
        </section>

        <section class="card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">会话列表</h2>
              <p class="panel-subtitle">业务视角优先；运行轨迹信息默认折叠到详情。</p>
            </div>
            <span class="badge badge-primary">{{ payload.summary.traceCount || 0 }} 条</span>
          </div>

          <div class="mobile-card-list">
            <div v-for="(item, index) in payload.items" :key="item.traceId || item.sessionId" class="mobile-only-card">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.traceName || item.sessionId || "会话" }}</div>
                  <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">会话 {{ displayIndex(index) }}</div>
                </div>
                <span class="badge shrink-0" :class="statusBadge(item.businessStatus || item.status)">{{ humanizeStatus(item.businessStatus || item.status) }}</span>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
                <div><span class="block text-gray-400 dark:text-slate-500">工作空间</span>工作空间 {{ displayIndex(index) }}</div>
                <div><span class="block text-gray-400 dark:text-slate-500">任务</span>任务 {{ displayIndex(index) }}</div>
                <div><span class="block text-gray-400 dark:text-slate-500">文件</span>{{ item.files?.inputsCount || 0 }} 入 / {{ item.files?.outputsCount || 0 }} 出</div>
                <div><span class="block text-gray-400 dark:text-slate-500">资源用量</span>{{ item.resourceUsage?.tokenCount || item.observability?.usageSummary?.totalTokens || 0 }}</div>
              </div>
              <div class="mt-3 space-y-1 text-xs text-gray-500 dark:text-slate-400">
                <div>费用估算 {{ costEstimateText(item) }}</div>
                <div v-for="file in linkedOutputFiles(item)" :key="file.artifactRef || file.fileRef || file.name">
                  输出文件 {{ file.name || "结果文件" }}
                </div>
              </div>
            </div>
            <div v-if="!payload.items.length" class="empty-state">当前暂无会话轨迹</div>
          </div>

          <div class="desktop-table-shell">
            <table class="min-w-[980px] text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">会话</th>
                  <th class="px-4 py-3">工作空间</th>
                  <th class="px-4 py-3">任务</th>
                  <th class="px-4 py-3">文件</th>
                  <th class="px-4 py-3">资源用量</th>
                  <th class="px-4 py-3">费用估算</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">观测摘要</th>
                  <th class="px-4 py-3">时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in payload.items" :key="item.traceId || item.sessionId" class="table-row">
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.traceName || item.sessionId || "会话" }}</div>
                    <div class="mt-1 text-[11px] text-gray-500 dark:text-slate-400">会话 {{ displayIndex(index) }}</div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-slate-300">工作空间 {{ displayIndex(index) }}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-700 dark:text-slate-300">任务 {{ displayIndex(index) }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">
                    <div>{{ item.files?.inputsCount || 0 }} 入 / {{ item.files?.outputsCount || 0 }} 出</div>
                    <div class="mt-2 space-y-1">
                      <div v-for="file in linkedOutputFiles(item)" :key="file.artifactRef || file.fileRef || file.name" class="text-xs text-gray-500 dark:text-slate-400">
                        输出文件 {{ file.name || "结果文件" }}
                      </div>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-700 dark:text-slate-300">
                    <div>资源用量 {{ item.resourceUsage?.tokenCount || item.observability?.usageSummary?.totalTokens || 0 }}</div>
                    <div class="mt-1 text-gray-500 dark:text-slate-400">输出文件 {{ item.resourceUsage?.outputFileCount || linkedOutputFiles(item).length }}</div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-700 dark:text-slate-300">
                    <div>费用估算 {{ costEstimateText(item) }}</div>
                    <div class="mt-1 text-gray-500 dark:text-slate-400">
                      余额关联 {{ item.balanceLink?.linkedToBalance ? "已关联" : "待估算" }}，充值状态 {{ rechargeStatusText(item.balanceLink?.rechargeStatus) }}
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">
                    <span class="badge" :class="statusBadge(item.businessStatus || item.status)">{{ humanizeStatus(item.businessStatus || item.status) }}</span>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">
                    <div class="font-medium text-gray-950 dark:text-white">观测摘要</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      用量 {{ item.observability?.usageSummary?.totalTokens || 0 }}，
                      费用估算 {{ item.observability?.costEstimate?.amount || 0 }} {{ item.observability?.costEstimate?.currency || "USD" }}，
                      延迟 {{ item.observability?.latencyMs || 0 }} ms
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.startedAt || "-" }}</td>
                </tr>
                <tr v-if="!payload.items.length">
                  <td colspan="9" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">当前暂无会话轨迹</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager-bar">
            <span>第 {{ payload.pagination.page }} / {{ payload.pagination.totalPages }} 页</span>
            <div class="flex gap-2">
              <RouterLink class="btn btn-secondary" :to="traceQuery({ page: previousPage(payload.pagination.page) })">上一页</RouterLink>
              <RouterLink class="btn btn-secondary" :to="traceQuery({ page: nextPage(payload.pagination.page, payload.pagination.totalPages) })">下一页</RouterLink>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import { useTraceSurface } from "@/composables/useTraceSurface";

const route = useRoute();
const router = useRouter();
const {
  applyFilters,
  costEstimateText,
  displayIndex,
  error,
  filters,
  humanizeStatus,
  linkedOutputFiles,
  loading,
  money,
  nextPage,
  outputCount,
  payload,
  previousPage,
  rechargeStatusText,
  resetFilters,
  runCount,
  statusBadge,
  totalEstimatedCost,
  traceQuery,
} = useTraceSurface(route, router);
</script>
