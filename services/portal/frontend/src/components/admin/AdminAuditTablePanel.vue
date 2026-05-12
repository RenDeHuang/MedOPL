<template>
  <section data-route-id="admin.audit" data-component-id="admin.audit.table" class="space-y-6">
    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="审计条数" :value="payload.pagination?.total ?? 0" hint="当前总记录数" />
      <MetricCard label="配置变更" :value="settingsCount" hint="站点设置相关" />
      <MetricCard label="工作空间事件" :value="workspaceCount" hint="工作空间生命周期" />
      <MetricCard label="运行事件" :value="runCount" hint="任务运行相关" />
    </section>

    <PageSection title="审计记录" subtitle="当前页面展示 Portal 的关键审计事件。">
      <template #actions>
        <ActionToolbar>
          <input :value="keyword" class="input w-[220px]" type="text" placeholder="按事件关键词筛选" @input="$emit('update:keyword', ($event.target as HTMLInputElement).value)" />
          <select :value="pageSize" class="input w-[120px]" @change="$emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))">
            <option :value="10">10 行</option>
            <option :value="20">20 行</option>
            <option :value="50">50 行</option>
          </select>
        </ActionToolbar>
      </template>
      <DataTable :empty="!items.length" empty-text="暂无审计记录" :columns="7">
        <template #head>
          <th class="px-4 py-3">事件</th>
          <th class="px-4 py-3">来源</th>
          <th class="px-4 py-3">用户</th>
          <th class="px-4 py-3">操作人</th>
          <th class="px-4 py-3">工作空间</th>
          <th class="px-4 py-3">时间</th>
          <th class="px-4 py-3">详情</th>
        </template>
        <tr v-for="item in items" :key="`${item.type}-${item.occurredAt}-${item.userId}`" class="table-row">
          <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ auditTypeLabel(item.type) }}</td>
          <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ sourceLabel(item.type) }}</td>
          <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.userId || "-" }}</td>
          <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.operatorId || "-" }}</td>
          <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId || "-" }}</td>
          <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.occurredAt || "-" }}</td>
          <td class="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{{ shortDetail(item.detail) }}</td>
        </tr>
      </DataTable>
      <PaginationBar
        :label="`第 ${currentPage} 页，共 ${totalPages} 页`"
        :next-disabled="currentPage === totalPages"
        :previous-disabled="currentPage === 1"
        @next="$emit('nextPage')"
        @previous="$emit('previousPage')"
      />
    </PageSection>
  </section>
</template>

<script setup lang="ts">
import ActionToolbar from "@/components/common/ActionToolbar.vue";
import DataTable from "@/components/common/DataTable.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import PageSection from "@/components/common/PageSection.vue";
import PaginationBar from "@/components/common/PaginationBar.vue";

defineProps<{
  auditTypeLabel: (value?: string) => string;
  currentPage: number;
  items: Array<Record<string, any>>;
  keyword: string;
  pageSize: number;
  payload: Record<string, any>;
  runCount: number;
  settingsCount: number;
  shortDetail: (value?: string) => string;
  sourceLabel: (value?: string) => string;
  totalPages: number;
  workspaceCount: number;
}>();

defineEmits<{
  nextPage: [];
  previousPage: [];
  "update:keyword": [value: string];
  "update:pageSize": [value: number];
}>();
</script>
