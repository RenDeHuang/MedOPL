<template>
  <AppLayout title="用户管理" subtitle="搜索用户、编辑账户、禁用登录、充值退款与注册设置">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载用户列表...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="用户总数" :value="payload.pagination?.total ?? 0" hint="当前筛选命中的用户数" />
          <MetricCard label="开放注册" :value="payload.allowRegistration ? '开启' : '关闭'" hint="统一身份注册开关" />
          <MetricCard label="可用分组" :value="payload.groups?.length ?? 0" hint="当前配置的资源分组" />
          <MetricCard label="最近资金动作" :value="payload.financeRows?.length ?? 0" hint="充值 / 退款 / 补扣记录" />
        </section>

        <section class="card p-5">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 class="panel-title">用户搜索</h2>
              <p class="panel-subtitle">支持 workspace、用户 ID、用户名、邮箱。</p>
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
            <button class="btn btn-primary" type="button" @click="showCreateModal = true">开通账号</button>
            <button class="btn btn-secondary" type="button" @click="showSettingsModal = true">注册设置</button>
          </div>
        </section>

        <section class="card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">用户列表</h2>
              <p class="panel-subtitle">操作列分为编辑、禁用、更多。</p>
            </div>
            <span class="badge badge-primary">{{ payload.pagination?.total ?? 0 }} 人</span>
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
                <tr v-for="item in payload.items || []" :key="item.id" class="table-row">
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.id }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.email }}</div>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.name }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">¥{{ Number(item.balance || 0).toFixed(2) }}</td>
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
                      <form method="post" action="/portal/admin/toggle-user">
                        <input type="hidden" name="userId" :value="item.id" />
                        <input type="hidden" name="redirectTo" value="/portal/app/admin/users" />
                        <button class="btn btn-secondary" type="submit">{{ item.status === "disabled" ? "恢复" : "禁用" }}</button>
                      </form>
                      <button class="btn btn-secondary" type="button" @click="openMoreModal(item)">更多</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!(payload.items || []).length">
                  <td colspan="8" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">暂无用户</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager-bar">
            <span>第 {{ payload.pagination?.page || 1 }} / {{ payload.pagination?.totalPages || 1 }} 页</span>
            <div class="flex gap-2">
              <RouterLink class="btn btn-secondary" :to="usersQuery({ page: previousPage(payload.pagination?.page || 1) })">上一页</RouterLink>
              <RouterLink class="btn btn-secondary" :to="usersQuery({ page: nextPage(payload.pagination?.page || 1, payload.pagination?.totalPages || 1) })">下一页</RouterLink>
            </div>
          </div>
        </section>
      </template>
    </div>

    <BaseDialog v-model="showCreateModal" title="开通账号" description="创建 Portal 账户并同步统一身份。">
      <form class="grid gap-4 md:grid-cols-2" method="post" action="/portal/admin/create-user">
        <input type="hidden" name="redirectTo" value="/portal/app/admin/users" />
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">用户名</label>
          <input class="input" name="name" type="text" required />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">邮箱</label>
          <input class="input" name="email" type="email" required />
        </div>
        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">初始密码</label>
          <input class="input" name="password" type="text" required />
        </div>
        <div class="md:col-span-2 flex justify-end gap-2">
          <button class="btn btn-secondary" type="button" @click="showCreateModal = false">取消</button>
          <button class="btn btn-primary" type="submit">创建</button>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog v-model="showSettingsModal" title="注册设置" description="控制是否开放注册。">
      <form class="space-y-4" method="post" action="/portal/admin/settings">
        <input type="hidden" name="redirectTo" value="/portal/app/admin/users" />
        <label class="flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3 text-sm text-gray-700 dark:border-slate-700 dark:text-slate-200">
          <input type="checkbox" name="allowRegistration" value="1" :checked="payload?.allowRegistration" />
          开放注册
        </label>
        <div class="flex justify-end gap-2">
          <button class="btn btn-secondary" type="button" @click="showSettingsModal = false">取消</button>
          <button class="btn btn-primary" type="submit">保存</button>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog
      v-model="showEditModal"
      title="编辑用户"
      :description="selectedUser ? `修改 ${selectedUser.name} 的邮箱、密码和用户名。` : '请选择用户。'"
    >
      <form v-if="selectedUser" class="space-y-4" method="post" action="/portal/admin/update-user">
        <input type="hidden" name="redirectTo" value="/portal/app/admin/users" />
        <input type="hidden" name="userId" :value="selectedUser.id" />
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">用户名</label>
          <input class="input" name="name" type="text" :value="selectedUser.name" required />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">邮箱</label>
          <input class="input" name="email" type="email" :value="selectedUser.email" required />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">新密码</label>
          <input class="input" name="password" type="text" placeholder="不修改可留空" />
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn btn-secondary" type="button" @click="showEditModal = false">取消</button>
          <button class="btn btn-primary" type="submit">保存</button>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog
      v-model="showMoreModal"
      title="更多操作"
      :description="selectedUser ? `为 ${selectedUser.name} 进行资金和删除操作。` : '请选择用户。'"
    >
      <div v-if="selectedUser" class="space-y-5">
        <div class="grid gap-4 md:grid-cols-2">
          <form class="space-y-3 rounded-2xl border border-gray-100 p-4 dark:border-slate-700" method="post" action="/portal/admin/recharge">
            <input type="hidden" name="redirectTo" value="/portal/app/admin/users" />
            <input type="hidden" name="userId" :value="selectedUser.id" />
            <div class="text-sm font-medium text-gray-950 dark:text-white">充值</div>
            <input class="input" name="amount" type="number" min="1" step="1" placeholder="金额" required />
            <button class="btn btn-primary w-full justify-center" type="submit">确认充值</button>
          </form>

          <form class="space-y-3 rounded-2xl border border-gray-100 p-4 dark:border-slate-700" method="post" action="/portal/admin/ledger-adjust">
            <input type="hidden" name="redirectTo" value="/portal/app/admin/users" />
            <input type="hidden" name="userId" :value="selectedUser.id" />
            <input type="hidden" name="actionType" value="refund" />
            <div class="text-sm font-medium text-gray-950 dark:text-white">退款</div>
            <input class="input" name="amount" type="number" min="1" step="1" placeholder="金额" required />
            <input class="input" name="reason" type="text" placeholder="退款原因" required />
            <button class="btn btn-secondary w-full justify-center" type="submit">确认退款</button>
          </form>
        </div>

        <div class="rounded-2xl border border-gray-100 p-4 dark:border-slate-700">
          <div class="mb-3 text-sm font-medium text-gray-950 dark:text-white">充值记录</div>
          <div class="space-y-2.5">
            <div v-for="item in selectedFinanceRows" :key="item.id" class="rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/70">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="font-medium text-gray-950 dark:text-white">{{ financeTypeLabel(item.type) }}</div>
                  <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.createdAt || "-" }}</div>
                </div>
                <div class="text-right">
                  <div class="font-medium text-gray-950 dark:text-white">¥{{ Number(item.amount || 0).toFixed(2) }}</div>
                  <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.reason || "-" }}</div>
                </div>
              </div>
            </div>
            <div v-if="!selectedFinanceRows.length" class="empty-state">当前没有资金记录。</div>
          </div>
        </div>

        <form method="post" action="/portal/admin/delete-user">
          <input type="hidden" name="redirectTo" value="/portal/app/admin/users" />
          <input type="hidden" name="userId" :value="selectedUser.id" />
          <button class="btn btn-secondary w-full justify-center" type="submit">删除用户</button>
        </form>
      </div>
    </BaseDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import BaseDialog from "@/components/common/BaseDialog.vue";
import { fetchAdminUsers } from "@/api/portal";

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref("");
const payload = ref<any>(null);
const filters = reactive({ workspace: "", userId: "", username: "", email: "" });
const showCreateModal = ref(false);
const showSettingsModal = ref(false);
const showEditModal = ref(false);
const showMoreModal = ref(false);
const selectedUser = ref<any>(null);

const selectedFinanceRows = computed(() => {
  const userId = selectedUser.value?.id;
  if (!userId) return [];
  return (payload.value?.financeRows || []).filter((item: any) => item.userId === userId).slice(0, 5);
});

function routeQueryObject() {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(route.query)) {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (normalized != null) query[key] = String(normalized);
  }
  return query;
}

function readQueryValue(key: string) {
  const value = route.query[key];
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized ?? undefined;
}

function usersQuery(updates: Record<string, string | number | undefined>) {
  const query = routeQueryObject();
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === "") delete query[key];
    else query[key] = String(value);
  }
  return { path: route.path, query };
}

function previousPage(page: number) {
  return Math.max(1, Number(page || 1) - 1);
}

function nextPage(page: number, totalPages: number) {
  return Math.min(Number(totalPages || 1), Number(page || 1) + 1);
}

function openEditModal(user: any) {
  selectedUser.value = user;
  showEditModal.value = true;
}

function openMoreModal(user: any) {
  selectedUser.value = user;
  showMoreModal.value = true;
}

function financeTypeLabel(type = "") {
  if (type === "topup") return "充值";
  if (type === "refund") return "退款";
  if (type === "makeup_charge") return "补扣";
  return type || "-";
}

function applyFilters() {
  router.push({
    path: route.path,
    query: {
      workspace: filters.workspace || undefined,
      userId: filters.userId || undefined,
      username: filters.username || undefined,
      email: filters.email || undefined,
      page: undefined,
    },
  });
}

function resetFilters() {
  filters.workspace = "";
  filters.userId = "";
  filters.username = "";
  filters.email = "";
  router.push({ path: route.path, query: {} });
}

let requestId = 0;

async function load() {
  const current = ++requestId;
  loading.value = true;
  error.value = "";
  try {
    const data = await fetchAdminUsers({
      page: readQueryValue("page"),
      page_size: 5,
      workspace: readQueryValue("workspace"),
      userId: readQueryValue("userId"),
      username: readQueryValue("username"),
      email: readQueryValue("email"),
    });
    if (current !== requestId) return;
    payload.value = data;
    filters.workspace = String(readQueryValue("workspace") || "");
    filters.userId = String(readQueryValue("userId") || "");
    filters.username = String(readQueryValue("username") || "");
    filters.email = String(readQueryValue("email") || "");
  } catch (err: any) {
    if (current !== requestId) return;
    error.value = err?.message || "用户列表加载失败";
  } finally {
    if (current === requestId) loading.value = false;
  }
}

watch(() => route.fullPath, () => {
  void load();
}, { immediate: true });
</script>
