<template>
  <AppLayout title="套餐" subtitle="按套餐管理算力与套餐存储容量">
    <div class="space-y-4">
      <section class="card p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-950 dark:text-white">套餐状态</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-slate-300">按小白化流程选择套餐并完成扩容。</p>
          </div>
          <a class="btn btn-primary" href="/portal/opl">进入 OPL</a>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">余额</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ money(subscription?.balance) }}</div>
          </div>
          <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">运行中预扣</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ money(subscription?.frozenAmount) }}</div>
          </div>
          <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">已用容量</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ usedStorageGb }} GB</div>
          </div>
          <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">宽限期</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ currentGracePeriod }} 天</div>
          </div>
        </div>
      </section>

      <section v-if="recommendedPackage" class="card p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span class="badge badge-primary">推荐套餐</span>
            <h3 class="mt-3 text-xl font-semibold text-gray-950 dark:text-white">CPU 2C4G + 10GB 存储 + OPL 实验室</h3>
            <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">{{ recommendedPackage.headline }}</p>
          </div>
          <button class="btn btn-primary" :disabled="loadingAction || !recommendedPackage.backingServerPlanId" @click="activateRecommendedPackage">
            开通推荐套餐
          </button>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">费用说明</div>
            <div class="mt-2 text-sm font-medium text-gray-950 dark:text-white">{{ money(recommendedPackage.dailyDebit, recommendedPackage.currency) }} / 天</div>
          </div>
          <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">预扣金额</div>
            <div class="mt-2 text-sm font-medium text-gray-950 dark:text-white">{{ money(recommendedPackage.weeklyFreeze, recommendedPackage.currency) }}</div>
          </div>
          <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">删除停费</div>
            <div class="mt-2 text-sm font-medium text-gray-950 dark:text-white">在“我的资源”按订单删除后停止继续预扣</div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <div class="muted-kv">
            <span class="muted-kv-label">计算能力</span>
            <span class="muted-kv-value">{{ recommendedPackage.computePower }}</span>
          </div>
          <div class="muted-kv">
            <span class="muted-kv-label">套餐存储容量</span>
            <span class="muted-kv-value">{{ recommendedPackage.storageCapacityGb }} GB</span>
          </div>
        </div>
      </section>

      <section class="card p-5">
        <h3 class="text-base font-semibold text-gray-950 dark:text-white">自定义套餐</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">如果推荐套餐不满足需求，可再选择进阶配置或扩容存储。</p>
        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <button class="btn btn-secondary" :disabled="loadingAction" @click="expand">加 100GB 存储</button>
          <button class="btn btn-secondary" :disabled="loadingAction || !advancedPackage" @click="upgradeAdvancedPackage">选择进阶套餐</button>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import type { LabPackagePlan, LabSubscriptionPayload } from "@/api/portal";
import {
  activateLabPackage,
  freezeResourceOrder,
  fetchLabEntitlement,
  fetchLabPackages,
  fetchLabSubscription,
  provisionResourceOrder,
  purchaseLabStorageAddon,
  quoteResourceOrder,
  upgradeLabPackage,
} from "@/api/portal";

const packageItems = ref<LabPackagePlan[]>([]);
const subscription = ref<LabSubscriptionPayload | null>(null);
const loadingAction = ref(false);

const currentGracePeriod = computed(() => {
  const current = packageItems.value.find((item) => item.id === subscription.value?.currentPackageId);
  return current?.gracePeriodDays ?? 0;
});
const usedStorageGb = computed(() => {
  const source = subscription.value as any;
  return Number(source?.usedStorageGb ?? source?.storageUsedGb ?? 0);
});
const recommendedPackage = computed(() => packageItems.value.find((item) => item.id === "starter") || null);
const advancedPackage = computed(() => packageItems.value.find((item) => item.id === "pro") || null);

function money(value: number | undefined, currency = "CNY") {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

async function reloadAll() {
  const [packagesPayload, subscriptionPayload] = await Promise.all([
    fetchLabPackages(),
    fetchLabSubscription(),
    fetchLabEntitlement(),
  ]);
  packageItems.value = packagesPayload.items || [];
  subscription.value = subscriptionPayload;
}

async function activateRecommendedPackage() {
  const item = recommendedPackage.value;
  if (!item?.backingServerPlanId) return;
  loadingAction.value = true;
  try {
    await activateLabPackage({ packageId: item.id });
    const quoted = await quoteResourceOrder({ serverPlanId: item.backingServerPlanId, estimatedHours: 24 });
    if (!quoted.resourceOrderId && !quoted.quoteId) {
      throw new Error("推荐套餐创建失败：缺少报价标识");
    }
    const frozen = await freezeResourceOrder({
      resourceOrderId: quoted.resourceOrderId,
      quoteId: quoted.quoteId,
      serverPlanId: item.backingServerPlanId,
      estimatedHours: 24,
    });
    const resourceOrderId = frozen.resourceOrderId || quoted.resourceOrderId;
    if (!resourceOrderId) {
      throw new Error("推荐套餐预扣失败：缺少订单标识");
    }
    await provisionResourceOrder({ resourceOrderId });
    await reloadAll();
  } finally {
    loadingAction.value = false;
  }
}

async function expand() {
  loadingAction.value = true;
  try {
    await purchaseLabStorageAddon({ addStorageGb: 100 });
    await reloadAll();
  } finally {
    loadingAction.value = false;
  }
}

async function upgradeAdvancedPackage() {
  const item = advancedPackage.value;
  if (!item) return;
  loadingAction.value = true;
  try {
    await upgradeLabPackage({ packageId: item.id });
    await reloadAll();
  } finally {
    loadingAction.value = false;
  }
}

onMounted(async () => {
  await reloadAll();
});
</script>
