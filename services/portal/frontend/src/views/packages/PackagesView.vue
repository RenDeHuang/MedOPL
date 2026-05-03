<template>
  <AppLayout title="套餐" subtitle="按套餐管理算力与套餐存储容量">
    <div class="space-y-4">
      <section class="card p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-950 dark:text-white">套餐状态</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-slate-300">支持查看余额、运行中预扣与套餐存储容量，按需扩容。</p>
          </div>
          <a class="btn btn-primary" href="/portal/opl">进入实验室</a>
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

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article v-for="item in packageItems" :key="item.id" class="card p-5">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-base font-semibold text-gray-950 dark:text-white">{{ packageDisplayName(item) }}</h3>
            <span v-if="subscription?.currentPackageId === item.id" class="badge badge-success">当前套餐</span>
          </div>

          <div class="mt-4 space-y-2 text-sm">
            <div class="muted-kv">
              <span class="muted-kv-label">计算能力</span>
              <span class="muted-kv-value">{{ item.computePower }}</span>
            </div>
            <div class="muted-kv">
              <span class="muted-kv-label">套餐存储容量</span>
              <span class="muted-kv-value">{{ item.storageCapacityGb }} GB</span>
            </div>
            <div class="muted-kv">
              <span class="muted-kv-label">每日扣款</span>
              <span class="muted-kv-value">{{ money(item.dailyDebit, item.currency) }}</span>
            </div>
            <div class="muted-kv">
              <span class="muted-kv-label">周冻结</span>
              <span class="muted-kv-value">{{ money(item.weeklyFreeze, item.currency) }}</span>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-2">
            <button class="btn btn-secondary" :disabled="loadingAction" @click="activate(item.id)">开通</button>
            <button class="btn btn-secondary" :disabled="loadingAction" @click="upgrade(item.id)">升级</button>
            <button class="btn btn-primary" :disabled="loadingAction" @click="expand">扩容</button>
          </div>
        </article>
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
  fetchLabEntitlement,
  fetchLabPackages,
  fetchLabSubscription,
  purchaseLabStorageAddon,
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

function money(value: number | undefined, currency = "CNY") {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function packageDisplayName(item: LabPackagePlan) {
  const names: Record<string, string> = {
    starter: "入门套餐",
    pro: "进阶套餐",
  };
  return names[item.id] || item.name;
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

async function activate(packageId: string) {
  loadingAction.value = true;
  try {
    await activateLabPackage({ packageId });
    await reloadAll();
  } finally {
    loadingAction.value = false;
  }
}

async function upgrade(packageId: string) {
  loadingAction.value = true;
  try {
    await upgradeLabPackage({ packageId });
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

onMounted(async () => {
  await reloadAll();
});
</script>
