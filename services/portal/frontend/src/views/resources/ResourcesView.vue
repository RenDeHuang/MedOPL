<template>
  <AppLayout title="我的资源" subtitle="查看已开通资源、运行状态与停费状态">
    <div class="space-y-4">
      <section class="card p-5">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-gray-950 dark:text-white">我的运行资源</h2>
          <button class="btn btn-secondary" :disabled="resourcesLoading" @click="reload">刷新</button>
        </div>
        <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">这里展示已开通资源、是否仍在计费，以及删除停费进度。</p>
        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricCard label="绑定总数" :value="resourceSummary.total" hint="当前订单资源绑定" />
          <MetricCard label="可删除" :value="resourceSummary.deletable" hint="可释放的资源绑定" />
          <MetricCard label="云主机数量" :value="resourceSummary.cloudHostCount" hint="绑定中的计算资源" />
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
          <div class="text-base font-semibold text-gray-950 dark:text-white">{{ resourceTitle(item) }}</div>
          <span class="badge" :class="item.canDelete ? 'badge-success' : 'badge-warning'">{{ resourceStatus(item) }}</span>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="muted-kv"><span class="muted-kv-label">计算资源</span><span class="muted-kv-value">{{ computeResourceState(item) }}</span></div>
          <div class="muted-kv"><span class="muted-kv-label">云主机数量</span><span class="muted-kv-value">{{ item.cvmInstanceIds?.length || 0 }}</span></div>
          <div class="muted-kv"><span class="muted-kv-label">存储</span><span class="muted-kv-value">{{ storageState(item) }}</span></div>
          <div class="muted-kv md:col-span-2"><span class="muted-kv-label">删除停费状态</span><span class="muted-kv-value">{{ deleteBillingStopState(item) }}</span></div>
        </div>

        <details class="mt-4 rounded-xl border border-gray-100 p-3 dark:border-slate-700">
          <summary class="cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-200">高级信息</summary>
          <div class="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
            <div class="muted-kv"><span class="muted-kv-label">资源编号</span><span class="muted-kv-value">{{ shortId(item.resourceOrderId) }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">工作空间编号</span><span class="muted-kv-value">{{ shortId(item.workspaceId) }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">任务编号</span><span class="muted-kv-value">{{ shortId(item.runId) }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">套餐编号</span><span class="muted-kv-value">{{ shortId(item.serverPlanId) }}</span></div>
          </div>
        </details>

        <div class="mt-4">
          <button class="btn btn-danger" :disabled="deletingId === item.resourceOrderId || !item.canDelete" @click="confirmRemove(item.resourceOrderId)">
            {{ deletingId === item.resourceOrderId ? "正在删除..." : "删除资源并停费" }}
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
  cloudHostCount: items.value.reduce((sum, item) => sum + (item.cvmInstanceIds?.length || 0), 0),
}));

function computeResourceState(item: MyResourceBindingItem) {
  if (item.status === "released") return "已删除";
  if (item.canDelete) return "运行中";
  return item.status || "未知";
}

function resourceStatus(item: MyResourceBindingItem) {
  if (item.status === "released") return "已释放";
  if (item.status === "provisioned") return "运行中";
  if (item.status === "frozen") return "已预留";
  if (item.status === "failed") return "异常";
  return item.status || "未知";
}

function shortId(value?: string) {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > 12 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

function resourceTitle(item: MyResourceBindingItem) {
  const plan = String(item.serverPlanId || "").trim();
  return plan ? `运行资源 ${shortId(plan)}` : `运行资源 ${shortId(item.resourceOrderId)}`;
}

function storageState(item: MyResourceBindingItem) {
  const size = Number((item as any).storageSizeGb || 0);
  const status = String((item as any).storageStatus || "").trim();
  if (size > 0 && status) return `${size} GB，${status}`;
  if (size > 0) return `${size} GB`;
  return status || "未绑定";
}

function deleteBillingStopState(item: MyResourceBindingItem) {
  const stoppedAt = String((item as any).billingStoppedAt || (item as any).storageBillingStoppedAt || "").trim();
  if (stoppedAt) return `已停费：${stoppedAt}`;
  if (item.status === "released") return "已提交删除，等待停费确认";
  return item.canDelete ? "删除后停止继续预扣" : "当前不可删除";
}

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

function confirmRemove(resourceOrderId: string) {
  if (!window.confirm("确认删除这组资源并停止继续计费？删除后运行环境和节点本地数据不可恢复。")) return;
  void remove(resourceOrderId);
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
