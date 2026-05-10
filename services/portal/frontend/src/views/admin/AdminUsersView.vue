<template>
  <AppLayout title="用户管理" subtitle="搜索用户、编辑账户、禁用登录、充值退款与注册设置">
    <div class="space-y-4">
      <div v-if="showInitialLoading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载用户列表...</div>

      <template v-else>
        <div v-if="error" class="card p-4 text-sm text-red-600 dark:text-red-400">{{ error }}</div>

        <template v-if="payload">
          <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="用户总数" :value="payload.pagination.total" hint="当前筛选命中的用户数" />
            <MetricCard label="开放注册" :value="payload.allowRegistration ? '开启' : '关闭'" hint="统一门户注册开关" />
            <MetricCard label="可用分组" :value="payload.groups.length" hint="当前配置的资源分组" />
            <MetricCard label="最近资金动作" :value="payload.financeRows.length" hint="充值 / 退款 / 补扣记录" />
          </section>

          <section class="card p-5">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="panel-title">用户搜索</h2>
                  <span v-if="isRefreshing" class="text-xs text-gray-500 dark:text-slate-400">刷新中...</span>
                </div>
                <p class="panel-subtitle">支持 workspace、用户 ID、用户名、邮箱筛选。</p>
              </div>
              <div class="grid gap-3 md:grid-cols-4">
                <input v-model.trim="filters.workspace" class="input" type="text" placeholder="workspace" />
                <input v-model.trim="filters.userId" class="input" type="text" placeholder="用户 ID" />
                <input v-model.trim="filters.username" class="input" type="text" placeholder="用户名" />
                <input v-model.trim="filters.email" class="input" type="text" placeholder="邮箱" />
              </div>
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
              <button class="btn btn-primary" type="button" @click="applyFilters">应用筛选</button>
              <button class="btn btn-secondary" type="button" @click="resetFilters">重置</button>
              <button class="btn btn-primary" type="button" @click="openCreateModal">开通账号</button>
              <button class="btn btn-secondary" type="button" @click="openSettingsModal">注册设置</button>
            </div>
          </section>

          <section class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">用户列表</h2>
                <p class="panel-subtitle">操作分为编辑、禁用/恢复、充值、退款与删除。</p>
              </div>
              <span class="badge badge-primary">{{ payload.pagination.total }} 人</span>
            </div>

            <div class="table-shell">
              <table class="text-sm">
                <thead>
                  <tr class="table-head">
                    <th class="px-4 py-3">用户</th>
                    <th class="px-4 py-3">用户名</th>
                    <th class="px-4 py-3">余额</th>
                    <th class="px-4 py-3">状态</th>
                    <th class="px-4 py-3">最后活跃</th>
                    <th class="px-4 py-3">最后使用</th>
                    <th class="px-4 py-3">创建时间</th>
                    <th class="px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in payload.items" :key="item.id" class="table-row">
                    <td class="px-4 py-3">
                      <div class="font-medium text-gray-950 dark:text-white">{{ item.email }}</div>
                      <div v-if="item.name" class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.name }}</div>
                      <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
                        <span>内部 ID: {{ item.id }}</span>
                        <button class="btn btn-secondary !px-2 !py-1 text-xs" type="button" @click="copyInternalId(item.id)">
                          {{ copiedUserId === item.id ? "已复制" : "复制排障" }}
                        </button>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.name || "-" }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">￥{{ Number(item.balance || 0).toFixed(2) }}</td>
                    <td class="px-4 py-3">
                      <span class="badge" :class="item.status === 'disabled' ? 'badge-danger' : 'badge-success'">
                        {{ item.status === "disabled" ? "已禁用" : "正常" }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.lastActiveAt || "-" }}</td>
                    <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.lastUsedAt || "-" }}</td>
                    <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.createdAt || "-" }}</td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="btn btn-secondary" type="button" @click="openEditModal(item)">编辑</button>
                        <form @submit.prevent="submitToggleUser(item)">
                          <button class="btn btn-secondary" type="submit" :disabled="submittingAction === `toggle:${item.id}`">
                            {{ submittingAction === `toggle:${item.id}` ? "处理中..." : item.status === "disabled" ? "恢复" : "禁用" }}
                          </button>
                        </form>
                        <button class="btn btn-secondary" type="button" @click="openMoreModal(item)">更多</button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!payload.items.length">
                    <td colspan="8" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">暂无用户</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="pager-bar">
              <span>第 {{ payload.pagination.page }} / {{ payload.pagination.totalPages }} 页</span>
              <div class="flex gap-2">
                <RouterLink class="btn btn-secondary" :to="usersQuery({ page: previousPage(payload.pagination.page) })">上一页</RouterLink>
                <RouterLink class="btn btn-secondary" :to="usersQuery({ page: nextPage(payload.pagination.page, payload.pagination.totalPages) })">下一页</RouterLink>
              </div>
            </div>
          </section>
        </template>
      </template>
    </div>

    <BaseDialog v-model="showCreateModal" title="开通账号" description="创建 Portal 账户并同步统一身份。">
      <form class="grid gap-4 md:grid-cols-2" @submit.prevent="submitCreateUser">
        <div v-if="createError" class="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {{ createError }}
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">用户名</label>
          <input v-model.trim="createForm.name" class="input" name="name" type="text" required />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">邮箱</label>
          <input v-model.trim="createForm.email" class="input" name="email" type="email" required />
        </div>
        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">初始密码</label>
          <input v-model="createForm.password" class="input" name="password" type="text" required />
        </div>
        <div class="md:col-span-2 flex justify-end gap-2">
          <button class="btn btn-secondary" type="button" @click="closeCreateModal">取消</button>
          <button class="btn btn-primary" type="submit" :disabled="submittingAction === 'create'">
            {{ submittingAction === "create" ? "创建中..." : "创建" }}
          </button>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog v-model="showSettingsModal" title="注册设置" description="控制是否开放注册。">
      <form class="space-y-4" @submit.prevent="submitSettings">
        <div v-if="settingsError" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {{ settingsError }}
        </div>
        <label class="flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3 text-sm text-gray-700 dark:border-slate-700 dark:text-slate-200">
          <input v-model="settingsForm.allowRegistration" type="checkbox" />
          开放注册
        </label>
        <div class="flex justify-end gap-2">
          <button class="btn btn-secondary" type="button" @click="closeSettingsModal">取消</button>
          <button class="btn btn-primary" type="submit" :disabled="submittingAction === 'settings'">
            {{ submittingAction === "settings" ? "保存中..." : "保存" }}
          </button>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog
      v-model="showEditModal"
      title="编辑用户"
      :description="selectedUser ? `修改 ${selectedUser.name || selectedUser.email} 的邮箱、密码和用户名。` : '请选择用户。'"
    >
      <form v-if="selectedUser" class="space-y-4" @submit.prevent="submitEditUser">
        <div v-if="editError" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {{ editError }}
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">用户名</label>
          <input v-model.trim="editForm.name" class="input" name="name" type="text" required />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">邮箱</label>
          <input v-model.trim="editForm.email" class="input" name="email" type="email" required />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">新密码</label>
          <input v-model="editForm.password" class="input" name="password" type="text" placeholder="留空表示不修改" />
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn btn-secondary" type="button" @click="closeEditModal">取消</button>
          <button class="btn btn-primary" type="submit" :disabled="submittingAction === 'edit'">
            {{ submittingAction === "edit" ? "保存中..." : "保存" }}
          </button>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog
      v-model="showMoreModal"
      title="更多操作"
      :description="selectedUser ? `对 ${selectedUser.name || selectedUser.email} 进行资金和删除操作。` : '请选择用户。'"
    >
      <div v-if="selectedUser" class="space-y-5">
        <div v-if="moreError" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {{ moreError }}
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <form class="space-y-3 rounded-2xl border border-gray-100 p-4 dark:border-slate-700" @submit.prevent="submitRecharge">
            <div class="text-sm font-medium text-gray-950 dark:text-white">充值</div>
            <input v-model="moreForm.rechargeAmount" class="input" name="amount" type="number" min="0.01" step="0.01" placeholder="金额" required />
            <button class="btn btn-primary w-full justify-center" type="submit" :disabled="submittingAction === 'recharge'">
              {{ submittingAction === "recharge" ? "充值中..." : "确认充值" }}
            </button>
          </form>

          <form class="space-y-3 rounded-2xl border border-gray-100 p-4 dark:border-slate-700" @submit.prevent="submitRefund">
            <div class="text-sm font-medium text-gray-950 dark:text-white">退款</div>
            <input v-model="moreForm.refundAmount" class="input" name="amount" type="number" min="0.01" step="0.01" placeholder="金额" required />
            <input v-model.trim="moreForm.refundReason" class="input" name="reason" type="text" placeholder="退款原因" required />
            <button class="btn btn-secondary w-full justify-center" type="submit" :disabled="submittingAction === 'refund'">
              {{ submittingAction === "refund" ? "退款中..." : "确认退款" }}
            </button>
          </form>
        </div>

        <div class="rounded-2xl border border-gray-100 p-4 dark:border-slate-700">
          <div class="mb-3 text-sm font-medium text-gray-950 dark:text-white">资金记录</div>
          <div class="space-y-2.5">
            <div v-for="item in selectedFinanceRows" :key="item.id" class="rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/70">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="font-medium text-gray-950 dark:text-white">{{ financeTypeLabel(item.type) }}</div>
                  <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.createdAt || "-" }}</div>
                </div>
                <div class="text-right">
                  <div class="font-medium text-gray-950 dark:text-white">￥{{ Number(item.amount || 0).toFixed(2) }}</div>
                  <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.reason || "-" }}</div>
                </div>
              </div>
            </div>
            <div v-if="!selectedFinanceRows.length" class="empty-state">当前没有资金记录。</div>
          </div>
        </div>

        <form @submit.prevent="submitDeleteUser">
          <button class="btn btn-secondary w-full justify-center" type="submit" :disabled="submittingAction === 'delete'">
            {{ submittingAction === "delete" ? "删除中..." : "删除用户" }}
          </button>
        </form>
      </div>
    </BaseDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import BaseDialog from "@/components/common/BaseDialog.vue";
import { useAdminUsersSurface } from "@/composables/useAdminUsersSurface";

const route = useRoute();
const router = useRouter();
const {
  applyFilters,
  closeCreateModal,
  closeEditModal,
  closeMoreModal,
  closeSettingsModal,
  copiedUserId,
  copyInternalId,
  createError,
  createForm,
  editError,
  editForm,
  error,
  filters,
  financeTypeLabel,
  isRefreshing,
  moreError,
  moreForm,
  nextPage,
  openCreateModal,
  openEditModal,
  openMoreModal,
  openSettingsModal,
  payload,
  previousPage,
  resetFilters,
  selectedFinanceRows,
  selectedUser,
  settingsError,
  settingsForm,
  showCreateModal,
  showEditModal,
  showInitialLoading,
  showMoreModal,
  showSettingsModal,
  submittingAction,
  submitCreateUser,
  submitDeleteUser,
  submitEditUser,
  submitRecharge,
  submitRefund,
  submitSettings,
  submitToggleUser,
  usersQuery,
} = useAdminUsersSurface(route, router);
</script>
