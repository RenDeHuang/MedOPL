<template>
  <section data-route-id="overview" data-component-id="overview.managed_environment" class="card p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 class="panel-title">托管运行环境</h2>
        <p class="panel-subtitle">查看托管运行环境、文件空间和冻结金额</p>
      </div>
      <RouterLink class="btn btn-secondary" to="/resources">查看计算资源</RouterLink>
    </div>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <MetricCard label="托管运行环境状态" :value="managedEnvironmentStatus" hint="托管运行环境是否可用" />
      <MetricCard label="文件空间状态" :value="fileSpaceStatus" hint="输入文件和输出文件空间" />
    </div>
    <div class="mt-4 space-y-2.5">
      <div v-if="loading" class="empty-state">正在加载资源绑定...</div>
      <div
        v-for="(item, index) in bindings"
        :key="item.id"
        class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-medium text-gray-950 dark:text-white">工作空间 {{ index + 1 }}</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">
              当前套餐 {{ displayPlan(item) }}，托管运行环境 {{ humanizeStatus(item.status) }}
            </div>
          </div>
          <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-slate-400">
          <div>冻结金额 {{ money(item.protection?.frozenAmount) }}</div>
          <div>消费 {{ money(item.protection?.consumedAmount) }}</div>
          <div>审计状态 {{ auditStatusText(item.protection?.tPlus1AuditStatus) }}</div>
          <div>文件空间 {{ displayFileSpace(item) }}</div>
        </div>
      </div>
      <div v-if="!loading && !bindings.length" class="empty-state">暂无运行环境，仍可使用 OPL Lite。</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import MetricCard from "@/components/common/MetricCard.vue";
import type { WorkspaceResourceBinding } from "@/api/portal/resources";

defineProps<{
  auditStatusText: (status?: string) => string;
  bindings: WorkspaceResourceBinding[];
  displayFileSpace: (item: WorkspaceResourceBinding) => string;
  displayPlan: (item: WorkspaceResourceBinding) => string;
  fileSpaceStatus: string;
  humanizeStatus: (status?: string) => string;
  loading: boolean;
  managedEnvironmentStatus: string;
  money: (value: number | undefined) => string;
  statusBadge: (status?: string) => string;
}>();
</script>
