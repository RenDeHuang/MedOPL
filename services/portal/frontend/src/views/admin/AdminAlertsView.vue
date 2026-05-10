<template>
  <AppLayout title="告警中心" subtitle="系统告警与公告管理">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载告警与公告...</div>
      <template v-else>
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="余额风险" :value="balanceAlerts" hint="余额不足账户" />
          <MetricCard label="账单归因失败" :value="billingAlerts" hint="等待管理员核查" />
          <MetricCard label="资源释放失败" :value="resourceAlerts" hint="需要确认停止计费" />
          <MetricCard label="活动公告" :value="announcements.length" hint="当前对用户可见的公告" />
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">公告管理</h2>
                <p class="panel-subtitle">支持发布、置顶、下线和删除。</p>
              </div>
              <span class="badge badge-primary">{{ allAnnouncements.length }} 条</span>
            </div>

            <form class="grid gap-4 md:grid-cols-2" method="post" action="/portal/admin/announcements/save">
              <input type="hidden" name="redirectTo" value="/portal/app/admin/alerts" />
              <div class="space-y-2 md:col-span-2">
                <label class="text-sm font-medium text-gray-700 dark:text-slate-200">标题</label>
                <input class="input" name="title" type="text" placeholder="公告标题" required />
              </div>
              <div class="space-y-2 md:col-span-2">
                <label class="text-sm font-medium text-gray-700 dark:text-slate-200">内容</label>
                <textarea class="input min-h-[96px]" name="content" placeholder="公告内容" required></textarea>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700 dark:text-slate-200">展示范围</label>
                <select class="input" name="scope">
                  <option value="all">全部用户</option>
                  <option value="user">仅用户端</option>
                  <option value="admin">仅管理员端</option>
                </select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700 dark:text-slate-200">状态</label>
                <select class="input" name="status">
                  <option value="active">上线</option>
                  <option value="inactive">下线</option>
                </select>
              </div>
              <label class="flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3 text-sm text-gray-700 dark:border-slate-700 dark:text-slate-200">
                <input type="checkbox" name="pinned" value="1" />
                置顶公告
              </label>
              <div class="flex items-end justify-end">
                <button class="btn btn-primary" type="submit">发布公告</button>
              </div>
            </form>

            <div class="mt-4 space-y-2.5">
              <div v-for="item in allAnnouncements" :key="item.id" class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <div class="font-medium text-gray-950 dark:text-white">{{ item.title }}</div>
                      <span v-if="item.pinned" class="badge badge-primary">置顶</span>
                      <span class="badge" :class="item.status === 'active' ? 'badge-success' : 'badge-warning'">
                        {{ item.status === "active" ? "上线" : "下线" }}
                      </span>
                    </div>
                    <div class="mt-1 text-sm text-gray-600 dark:text-slate-300">{{ item.content }}</div>
                    <div class="mt-1 text-[11px] text-gray-500 dark:text-slate-400">{{ item.scope }} · {{ item.updatedAt || item.createdAt || "-" }}</div>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <form method="post" action="/portal/admin/announcements/toggle">
                      <input type="hidden" name="redirectTo" value="/portal/app/admin/alerts" />
                      <input type="hidden" name="id" :value="item.id" />
                      <input type="hidden" name="actionType" value="pin" />
                      <button class="btn btn-secondary" type="submit">置顶</button>
                    </form>
                    <form method="post" action="/portal/admin/announcements/toggle">
                      <input type="hidden" name="redirectTo" value="/portal/app/admin/alerts" />
                      <input type="hidden" name="id" :value="item.id" />
                      <input type="hidden" name="actionType" :value="item.status === 'active' ? 'deactivate' : 'activate'" />
                      <button class="btn btn-secondary" type="submit">{{ item.status === "active" ? "下线" : "上线" }}</button>
                    </form>
                    <form method="post" action="/portal/admin/announcements/delete">
                      <input type="hidden" name="redirectTo" value="/portal/app/admin/alerts" />
                      <input type="hidden" name="id" :value="item.id" />
                      <button class="btn btn-secondary" type="submit">删除</button>
                    </form>
                  </div>
                </div>
              </div>
              <div v-if="!allAnnouncements.length" class="empty-state">当前还没有公告。</div>
            </div>
          </div>

          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">告警列表</h2>
                <p class="panel-subtitle">只保留需要处理的提醒：低余额、账单归因失败、资源释放失败、OPL key 无效、精准账单导入失败。</p>
              </div>
            </div>
            <div class="space-y-2.5">
              <div v-for="item in alerts" :key="`${item.category}-${item.title}-${item.runId || ''}`" class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.title }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.detail }}</div>
                  </div>
                  <span class="badge" :class="item.severity === 'danger' ? 'badge-danger' : 'badge-warning'">
                    {{ item.severity === "danger" ? "严重" : "提醒" }}
                  </span>
                </div>
              </div>
              <div v-if="!alerts.length" class="empty-state">当前暂无告警。</div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import { fetchAdminAlerts } from "@/api/portal/admin";
import { fetchAnnouncements } from "@/api/portal/sessions";

const loading = ref(true);
const alertsPayload = ref<any>(null);
const announcementsPayload = ref<any>(null);

const alerts = computed(() => alertsPayload.value?.alerts || []);
const allAnnouncements = computed(() => announcementsPayload.value?.items || []);
const announcements = computed(() => allAnnouncements.value.filter((item: any) => item.status === "active"));
const balanceAlerts = computed(() => alerts.value.filter((item: any) => item.category === "balance").length);
const billingAlerts = computed(() => alerts.value.filter((item: any) => item.category === "billing" || item.kind === "billing_attribution_failed").length);
const resourceAlerts = computed(() => alerts.value.filter((item: any) => item.category === "resource" || item.kind === "resource_cleanup_failed").length);

onMounted(async () => {
  const [alertRows, announcementRows] = await Promise.all([
    fetchAdminAlerts(),
    fetchAnnouncements({ mode: "all" }),
  ]);
  alertsPayload.value = alertRows;
  announcementsPayload.value = announcementRows;
  loading.value = false;
});
</script>
