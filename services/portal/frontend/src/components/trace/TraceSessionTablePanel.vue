<template>
  <section data-route-id="trace" data-component-id="trace.session_table" class="card p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 class="panel-title">会话列表</h2>
        <p class="panel-subtitle">业务视角优先；运行轨迹信息默认折叠到详情。</p>
      </div>
      <span class="badge badge-primary">{{ traceCount }} 条</span>
    </div>

    <div class="mobile-card-list">
      <div v-for="(item, index) in items" :key="item.traceId || item.sessionId" class="mobile-only-card">
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
          <div><span class="block text-gray-400 dark:text-slate-500">输入文件</span>{{ item.files?.inputsCount || 0 }}</div>
          <div><span class="block text-gray-400 dark:text-slate-500">输出文件</span>{{ item.files?.outputsCount || 0 }}</div>
          <div><span class="block text-gray-400 dark:text-slate-500">资源用量</span>{{ item.resourceUsage?.tokenCount || item.observability?.usageSummary?.totalTokens || 0 }}</div>
        </div>
        <div class="mt-3 space-y-1 text-xs text-gray-500 dark:text-slate-400">
          <div>费用估算 {{ costEstimateText(item) }}</div>
          <div v-for="file in linkedOutputFiles(item)" :key="file.artifactRef || file.fileRef || file.name">
            输出文件 {{ file.name || "结果文件" }}
          </div>
        </div>
      </div>
      <div v-if="!items.length" class="empty-state">当前暂无会话轨迹</div>
    </div>

    <div class="desktop-table-shell">
      <table class="min-w-[980px] text-sm">
        <thead>
          <tr class="table-head">
            <th class="px-4 py-3">会话</th>
            <th class="px-4 py-3">工作空间</th>
            <th class="px-4 py-3">任务</th>
            <th class="px-4 py-3">输入文件</th>
            <th class="px-4 py-3">输出文件</th>
            <th class="px-4 py-3">资源用量</th>
            <th class="px-4 py-3">费用估算</th>
            <th class="px-4 py-3">状态</th>
            <th class="px-4 py-3">观测摘要</th>
            <th class="px-4 py-3">时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in items" :key="item.traceId || item.sessionId" class="table-row">
            <td class="px-4 py-3">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.traceName || item.sessionId || "会话" }}</div>
              <div class="mt-1 text-[11px] text-gray-500 dark:text-slate-400">会话 {{ displayIndex(index) }}</div>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-slate-300">工作空间 {{ displayIndex(index) }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-700 dark:text-slate-300">任务 {{ displayIndex(index) }}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.files?.inputsCount || 0 }}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">
              <div>{{ item.files?.outputsCount || 0 }}</div>
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
          <tr v-if="!items.length">
            <td colspan="10" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">当前暂无会话轨迹</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager-bar">
      <span>第 {{ pagination.page }} / {{ pagination.totalPages }} 页</span>
      <div class="flex gap-2">
        <RouterLink class="btn btn-secondary" :to="traceQuery({ page: previousPage(pagination.page) })">上一页</RouterLink>
        <RouterLink class="btn btn-secondary" :to="traceQuery({ page: nextPage(pagination.page, pagination.totalPages) })">下一页</RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import type { PortalPagination, PortalQueryValue } from "@/api/portal/common";
import type { SessionTracesPayload } from "@/api/portal/traces";

type SessionTraceItem = SessionTracesPayload["items"][number];

defineProps<{
  costEstimateText: (item: SessionTraceItem) => string;
  displayIndex: (index: number) => string;
  humanizeStatus: (status?: string) => string;
  items: SessionTraceItem[];
  linkedOutputFiles: (item: SessionTraceItem) => NonNullable<SessionTraceItem["linkedOutputFiles"]>;
  nextPage: (page: number, totalPages: number) => number;
  pagination: PortalPagination;
  previousPage: (page: number) => number;
  rechargeStatusText: (value?: string) => string;
  statusBadge: (status?: string) => string;
  traceCount: number;
  traceQuery: (updates: Record<string, PortalQueryValue>) => RouteLocationRaw;
}>();
</script>
