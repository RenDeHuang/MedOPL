<template>
  <section data-route-id="admin.users" data-component-id="admin.users.table" class="space-y-4">
    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="用户总数" :value="payload.pagination.total" hint="当前筛选命中的用户数" />
      <MetricCard label="开放注册" :value="payload.allowRegistration ? '开启' : '关闭'" hint="统一门户注册开关" />
      <MetricCard label="可用分组" :value="payload.groups.length" hint="当前配置的资源分组" />
      <MetricCard label="最近资金动作" :value="payload.financeRows.length" hint="充值、退款和补扣记录" />
    </section>

    <FilterToolbar title="用户搜索" subtitle="支持工作空间、用户编号、用户名、邮箱筛选。">
      <input :value="filters.workspace" class="input" type="text" placeholder="工作空间" @input="emitFilter('workspace', $event)" />
      <input :value="filters.userId" class="input" type="text" placeholder="用户编号" @input="emitFilter('userId', $event)" />
      <input :value="filters.username" class="input" type="text" placeholder="用户名" @input="emitFilter('username', $event)" />
      <input :value="filters.email" class="input" type="text" placeholder="邮箱" @input="emitFilter('email', $event)" />
      <template #actions>
        <button class="btn btn-primary" type="button" @click="$emit('applyFilters')">应用筛选</button>
        <button class="btn btn-secondary" type="button" @click="$emit('resetFilters')">重置</button>
        <button class="btn btn-primary" type="button" @click="$emit('openCreate')">开通账号</button>
        <button class="btn btn-secondary" type="button" @click="$emit('openSettings')">注册设置</button>
        <span v-if="refreshing" class="self-center text-xs text-gray-500 dark:text-slate-400">刷新中...</span>
      </template>
    </FilterToolbar>

    <PageSection title="用户列表" subtitle="操作分为编辑、禁用、恢复、充值、退款与删除。">
      <template #actions>
        <StatusBadge tone="primary" :label="`${payload.pagination.total} 人`" />
      </template>
      <DataTable :empty="!payload.items.length" empty-text="暂无用户" :columns="8">
        <template #head>
          <th class="px-4 py-3">用户</th>
          <th class="px-4 py-3">用户名</th>
          <th class="px-4 py-3">余额</th>
          <th class="px-4 py-3">状态</th>
          <th class="px-4 py-3">最后活跃</th>
          <th class="px-4 py-3">最后使用</th>
          <th class="px-4 py-3">创建时间</th>
          <th class="px-4 py-3">操作</th>
        </template>
        <tr v-for="item in payload.items" :key="item.id" class="table-row">
          <td class="px-4 py-3">
            <div class="font-medium text-gray-950 dark:text-white">{{ item.email }}</div>
            <div v-if="item.name" class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.name }}</div>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
              <span>内部编号：{{ item.id }}</span>
              <button class="btn btn-secondary !px-2 !py-1 text-xs" type="button" @click="$emit('copyInternalId', item.id)">
                {{ copiedUserId === item.id ? "已复制" : "复制排障编号" }}
              </button>
            </div>
          </td>
          <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.name || "-" }}</td>
          <td class="px-4 py-3 text-gray-700 dark:text-slate-300">￥{{ Number(item.balance || 0).toFixed(2) }}</td>
          <td class="px-4 py-3">
            <StatusBadge :tone="item.status === 'disabled' ? 'danger' : 'success'" :label="item.status === 'disabled' ? '已禁用' : '正常'" />
          </td>
          <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.lastActiveAt || "-" }}</td>
          <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.lastUsedAt || "-" }}</td>
          <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.createdAt || "-" }}</td>
          <td class="px-4 py-3">
            <ActionToolbar>
              <button class="btn btn-secondary" type="button" @click="$emit('openEdit', item)">编辑</button>
              <button class="btn btn-secondary" type="button" :disabled="submittingAction === `toggle:${item.id}`" @click="$emit('toggleUser', item)">
                {{ submittingAction === `toggle:${item.id}` ? "处理中..." : item.status === "disabled" ? "恢复" : "禁用" }}
              </button>
              <button class="btn btn-secondary" type="button" @click="$emit('openMore', item)">更多</button>
            </ActionToolbar>
          </td>
        </tr>
      </DataTable>
      <PaginationBar :label="`第 ${payload.pagination.page} 页，共 ${payload.pagination.totalPages} 页`">
        <RouterLink class="btn btn-secondary" :to="usersQuery({ page: previousPage(payload.pagination.page) })">上一页</RouterLink>
        <RouterLink class="btn btn-secondary" :to="usersQuery({ page: nextPage(payload.pagination.page, payload.pagination.totalPages) })">下一页</RouterLink>
      </PaginationBar>
    </PageSection>
  </section>
</template>

<script setup lang="ts">
import ActionToolbar from "@/components/common/ActionToolbar.vue";
import DataTable from "@/components/common/DataTable.vue";
import FilterToolbar from "@/components/common/FilterToolbar.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import PageSection from "@/components/common/PageSection.vue";
import PaginationBar from "@/components/common/PaginationBar.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
import type { AdminUserListItem, AdminUsersPayload } from "@/api/portal/admin";

defineProps<{
  copiedUserId: string;
  filters: Record<string, string>;
  nextPage: (page: number, totalPages: number) => number;
  payload: AdminUsersPayload;
  previousPage: (page: number) => number;
  refreshing: boolean;
  submittingAction: string;
  usersQuery: (overrides: Record<string, string | number | undefined>) => any;
}>();

const emit = defineEmits<{
  applyFilters: [];
  copyInternalId: [id: string];
  openCreate: [];
  openEdit: [item: AdminUserListItem];
  openMore: [item: AdminUserListItem];
  openSettings: [];
  resetFilters: [];
  toggleUser: [item: AdminUserListItem];
  updateFilter: [key: string, value: string];
}>();

function emitFilter(key: string, event: Event) {
  emit("updateFilter", key, (event.target as HTMLInputElement).value);
}
</script>
