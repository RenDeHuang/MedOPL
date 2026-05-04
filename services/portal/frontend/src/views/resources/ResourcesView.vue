<template>
  <AppLayout title="我的资源" subtitle="查看订单绑定资源并按订单释放资源">
    <div class="space-y-4">
      <section class="card p-5">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-gray-950 dark:text-white">资源绑定</h2>
          <button class="btn btn-secondary" :disabled="resourcesLoading" @click="reload">刷新</button>
        </div>
        <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">删除操作严格按订单执行，只提交订单标识与确认字段。</p>
        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricCard label="绑定总数" :value="resourceSummary.total" hint="当前订单资源绑定" />
          <MetricCard label="可删除" :value="resourceSummary.deletable" hint="可释放的资源绑定" />
          <MetricCard label="CVM 数量" :value="resourceSummary.cvmCount" hint="绑定中的云服务器" />
        </div>
      </section>

      <section v-if="errorMessage" class="card p-4">
        <div class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</div>
      </section>

      <section v-if="resourcesLoading" class="card p-5">
        <div class="text-sm text-gray-600 dark:text-slate-300">正在加载资源绑定...</div>
      </section>

      <section v-if="!resourcesLoading && items.length === 0" class="card p-5">
        <div class="text-sm text-gray-600 dark:text-slate-300">暂无资源绑定记录。</div>
      </section>

      <section v-for="item in items" :key="item.resourceOrderId" class="card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="text-base font-semibold text-gray-950 dark:text-white">订单 {{ item.resourceOrderId }}</div>
          <span class="badge" :class="item.canDelete ? 'badge-success' : 'badge-warning'">{{ item.status }}</span>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="muted-kv"><span class="muted-kv-label">工作空间</span><span class="muted-kv-value">{{ item.workspaceId || "-" }}</span></div>
          <div class="muted-kv"><span class="muted-kv-label">运行 ID</span><span class="muted-kv-value">{{ item.runId || "-" }}</span></div>
          <div class="muted-kv"><span class="muted-kv-label">套餐计划</span><span class="muted-kv-value">{{ item.serverPlanId || "-" }}</span></div>
          <div class="muted-kv"><span class="muted-kv-label">节点池</span><span class="muted-kv-value">{{ item.nodePoolId || "-" }}</span></div>
          <div class="muted-kv"><span class="muted-kv-label">CVM 数量</span><span class="muted-kv-value">{{ item.cvmInstanceIds?.length || 0 }}</span></div>
          <div class="muted-kv"><span class="muted-kv-label">存储订单</span><span class="muted-kv-value">{{ item.storageOrderId || "-" }}</span></div>
          <div class="muted-kv md:col-span-2"><span class="muted-kv-label">COS 前缀</span><span class="muted-kv-value break-all">{{ item.cosPrefix || "-" }}</span></div>
        </div>

        <div class="mt-4 rounded-xl border border-gray-100 p-3 dark:border-slate-700">
          <div class="text-xs font-semibold text-gray-500 dark:text-slate-400">billingTags</div>
          <div class="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
            <div class="muted-kv"><span class="muted-kv-label">resourceorderid</span><span class="muted-kv-value">{{ item.billingTags.resourceorderid }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">runid</span><span class="muted-kv-value">{{ item.billingTags.runid }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">serverplanid</span><span class="muted-kv-value">{{ item.billingTags.serverplanid }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">tenantid</span><span class="muted-kv-value">{{ item.billingTags.tenantid }}</span></div>
            <div class="muted-kv md:col-span-2"><span class="muted-kv-label">workspaceid</span><span class="muted-kv-value">{{ item.billingTags.workspaceid }}</span></div>
          </div>
        </div>

        <div class="mt-4">
          <button class="btn btn-danger" :disabled="deletingId === item.resourceOrderId || !item.canDelete" @click="remove(item.resourceOrderId)">
            删除节点池绑定
          </button>
          <div v-if="!item.canDelete && item.deleteBlockedReason" class="mt-2 text-xs text-amber-700 dark:text-amber-300">{{ item.deleteBlockedReason }}</div>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import { deleteResourceOrderNodePool, fetchMyResources, type MyResourceBindingItem } from "@/api/portal";

const resourcesLoading = ref(false);
const deletingId = ref("");
const errorMessage = ref("");
const items = ref<MyResourceBindingItem[]>([]);
const resourceSummary = computed(() => ({
  total: items.value.length,
  deletable: items.value.filter((item) => item.canDelete).length,
  cvmCount: items.value.reduce((sum, item) => sum + (item.cvmInstanceIds?.length || 0), 0),
}));

async function reload() {
  resourcesLoading.value = true;
  errorMessage.value = "";
  try {
    const payload = await fetchMyResources();
    items.value = payload.items || [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "加载失败";
    errorMessage.value = message;
  } finally {
    resourcesLoading.value = false;
  }
}

async function remove(resourceOrderId: string) {
  deletingId.value = resourceOrderId;
  errorMessage.value = "";
  try {
    await deleteResourceOrderNodePool({
      resourceOrderId,
      confirmDeleteNodePool: true,
      destroyCvmInstances: true,
    });
    await reload();
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    errorMessage.value = message;
  } finally {
    deletingId.value = "";
  }
}

onMounted(async () => {
  await reload();
});
</script>
