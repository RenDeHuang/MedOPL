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

      <section class="card p-5">
        <h3 class="text-base font-semibold text-gray-950 dark:text-white">套餐目录</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">入门、进阶与自定义能力并列展示，按业务阶段选择。</p>
        <div v-if="catalogLoading" class="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">套餐目录加载中...</div>
        <div v-if="catalogError" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{{ catalogError }}</div>
        <div v-if="subscriptionLoading" class="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">订阅状态加载中...</div>
        <div v-if="subscriptionError" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{{ subscriptionError }}</div>
        <div v-if="entitlementLoading" class="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">套餐权益加载中...</div>
        <div v-if="entitlementError" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{{ entitlementError }}</div>

        <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">入门套餐</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ starterPackage?.name || "入门套餐" }}</div>
            <div class="mt-1 text-sm text-gray-600 dark:text-slate-300">{{ starterPackage?.planSummary || "--" }}</div>
            <div class="mt-2 text-sm text-gray-600 dark:text-slate-300">{{ starterPackage?.headline || "" }}</div>
            <div class="mt-3 text-xs text-gray-500 dark:text-slate-400">费用：{{ money(starterPackage?.dailyDebit, starterPackage?.currency) }}/天</div>
            <button class="btn btn-primary mt-3 w-full" :disabled="starterDisabled" @click="activateStarterPackage">
              {{ actionText("activate_starter", "开通入门套餐") }}
            </button>
            <div v-if="starterDisabledReason" class="mt-2 text-xs text-amber-600 dark:text-amber-400">{{ starterDisabledReason }}</div>
          </article>

          <article class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">进阶套餐</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ proPackage?.name || "进阶套餐" }}</div>
            <div class="mt-1 text-sm text-gray-600 dark:text-slate-300">{{ proPackage?.planSummary || "--" }}</div>
            <div class="mt-2 text-sm text-gray-600 dark:text-slate-300">{{ proPackage?.headline || "" }}</div>
            <div class="mt-3 text-xs text-gray-500 dark:text-slate-400">费用：{{ money(proPackage?.dailyDebit, proPackage?.currency) }}/天</div>
            <button class="btn btn-secondary mt-3 w-full" :disabled="proDisabled" @click="upgradeAdvancedPackage">
              {{ actionText("upgrade_pro", "升级到进阶套餐") }}
            </button>
            <div v-if="proDisabledReason" class="mt-2 text-xs text-amber-600 dark:text-amber-400">{{ proDisabledReason }}</div>
          </article>

          <article class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">自定义</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">自定义套餐</div>
            <div class="mt-1 text-sm text-gray-600 dark:text-slate-300">{{ customSummaryText }}</div>
            <div class="mt-2 text-xs text-gray-500 dark:text-slate-400">{{ customNotesText }}</div>
            <div class="mt-4 space-y-3">
              <label class="block text-xs font-medium text-gray-600 dark:text-slate-300">
                CPU
                <select v-model.number="selectedCustomCpuCores" class="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                  <option v-for="cores in customCpuOptions" :key="cores" :value="cores">{{ cores }} 核</option>
                </select>
              </label>
              <label class="block text-xs font-medium text-gray-600 dark:text-slate-300">
                内存
                <select v-model.number="selectedCustomMemoryGb" class="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                  <option v-for="memory in customMemoryOptions" :key="memory" :value="memory">{{ memory }}GB</option>
                </select>
              </label>
              <label class="block text-xs font-medium text-gray-600 dark:text-slate-300">
                套餐存储
                <select v-model.number="selectedCustomStorageGb" class="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                  <option v-for="size in customStorageOptions" :key="size" :value="size">{{ size }}GB</option>
                </select>
              </label>
            </div>
            <button class="btn btn-secondary mt-3 w-full" :disabled="customPackageDisabled" @click="submitCustomPackage">
              {{ actionText("custom_package", "提交自定义套餐") }}
            </button>
            <div class="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-slate-700 dark:text-slate-400">已开通套餐后还可以单独扩容：{{ addonOptionsText }}</div>
            <button class="btn btn-ghost mt-2 w-full" :disabled="customDisabled" @click="expandSelected">
              {{ actionText("expand_custom", `扩容 ${selectedAddonGb}GB`) }}
            </button>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-for="size in addonOptions"
                :key="size"
                class="btn btn-ghost"
                :class="{ 'ring-1 ring-blue-500': selectedAddonGb === size }"
                :disabled="loadingAction"
                @click="selectedAddonGb = size"
              >
                {{ size }}GB
              </button>
            </div>
            <div v-if="customPackageDisabledReason" class="mt-2 text-xs text-amber-600 dark:text-amber-400">{{ customPackageDisabledReason }}</div>
            <div v-if="customDisabledReason" class="mt-2 text-xs text-amber-600 dark:text-amber-400">{{ customDisabledReason }}</div>
          </article>
        </div>

        <div
          v-if="actionFeedback"
          class="mt-4 rounded-lg border p-3 text-sm"
          :class="feedbackClass"
        >
          {{ actionFeedback }}
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import type { LabPackagePlan, LabSubscriptionPayload } from "@/api/portal/lab";
import {
  activateCustomLabPackage,
  activateLabPackage,
  fetchLabEntitlement,
  fetchLabPackages,
  fetchLabSubscription,
  purchaseLabStorageAddon,
  upgradeLabPackage,
} from "@/api/portal/lab";

const packageItems = ref<LabPackagePlan[]>([]);
const subscription = ref<LabSubscriptionPayload | null>(null);
const loadingAction = ref(false);
const currentAction = ref("");
const feedbackType = ref<"success" | "error" | "loading" | "">("");
const actionFeedback = ref("");
const catalogLoading = ref(false);
const catalogError = ref("");
const subscriptionLoading = ref(false);
const subscriptionError = ref("");
const entitlementLoading = ref(false);
const entitlementError = ref("");
const selectedAddonGb = ref(100);
const selectedCustomCpuCores = ref(4);
const selectedCustomMemoryGb = ref(8);
const selectedCustomStorageGb = ref(100);
const packageCatalog = ref<any>({});

function packageById(packageId: string) {
  return packageItems.value.find((item) => item.id === packageId) || null;
}
function catalogPackage(packageId: "starter" | "pro") {
  return packageCatalog.value?.[packageId] || packageById(packageId);
}
function subscriptionNumber(key: "usedStorageGb" | "storageUsedGb") {
  return Number((subscription.value as any)?.[key] ?? 0);
}

const currentGracePeriod = computed(() => packageById(subscription.value?.currentPackageId || "")?.gracePeriodDays ?? 0);
const usedStorageGb = computed(() => subscriptionNumber("usedStorageGb") || subscriptionNumber("storageUsedGb"));
const starterPackage = computed(() => catalogPackage("starter"));
const proPackage = computed(() => catalogPackage("pro"));
const addonOptions = computed(() => packageCatalog.value?.customOptions?.storageAddonSizesGb || [100]);
const customCpuOptions = computed(() => packageCatalog.value?.customOptions?.computeCores || [2, 4, 8]);
const customMemoryOptions = computed(() => packageCatalog.value?.customOptions?.memoryGb || [4, 8, 16, 32]);
const customStorageOptions = computed(() => packageCatalog.value?.customOptions?.storageIncludedGb || [10, 100, 500]);
const addonOptionsText = computed(() => addonOptions.value.map((item: number) => `${item}GB`).join(" / "));
const customSummaryText = computed(() => `${selectedCustomCpuCores.value} 核 / ${selectedCustomMemoryGb.value}GB 内存 / ${selectedCustomStorageGb.value}GB 存储`);
const customNotesText = computed(() => (packageCatalog.value?.customOptions?.notes || []).join("；"));
const hasSubscription = computed(() => Boolean(subscription.value?.currentPackageId));
function pickDisabledReason(rules: Array<[boolean, string]>) {
  return rules.find((rule) => rule[0])?.[1] || "";
}
const starterDisabledReason = computed(() => {
  return pickDisabledReason([
    [loadingAction.value, "当前有操作进行中，请稍候。"],
    [!starterPackage.value?.id, "入门套餐不可用。"],
    [subscription.value?.currentPackageId === "starter", "你已开通入门套餐。"],
  ]);
});
const proDisabledReason = computed(() => {
  return pickDisabledReason([
    [loadingAction.value, "当前有操作进行中，请稍候。"],
    [!proPackage.value?.id, "进阶套餐不可用。"],
    [!hasSubscription.value, "请先开通套餐，再进行升级。"],
    [subscription.value?.currentPackageId === "pro", "你已是进阶套餐。"],
  ]);
});
const customDisabledReason = computed(() => {
  return pickDisabledReason([
    [loadingAction.value, "当前有操作进行中，请稍候。"],
    [!hasSubscription.value, "未订阅时不能扩容，请先开通套餐。"],
    [!addonOptions.value.includes(selectedAddonGb.value), "请选择有效扩容规格。"],
  ]);
});
const customPackageDisabledReason = computed(() => {
  return pickDisabledReason([
    [loadingAction.value, "当前有操作进行中，请稍候。"],
    [!customCpuOptions.value.includes(selectedCustomCpuCores.value), "请选择有效 CPU 规格。"],
    [!customMemoryOptions.value.includes(selectedCustomMemoryGb.value), "请选择有效内存规格。"],
    [!customStorageOptions.value.includes(selectedCustomStorageGb.value), "请选择有效套餐存储规格。"],
  ]);
});
const starterDisabled = computed(() => Boolean(starterDisabledReason.value));
const proDisabled = computed(() => Boolean(proDisabledReason.value));
const customDisabled = computed(() => Boolean(customDisabledReason.value));
const customPackageDisabled = computed(() => Boolean(customPackageDisabledReason.value));
const feedbackClass = computed(() => {
  if (feedbackType.value === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (feedbackType.value === "error") return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300";
  return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300";
});

function money(value: number | undefined, currency = "CNY") {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

async function loadPackageCatalog() {
  catalogLoading.value = true;
  catalogError.value = "";
  try {
    const packagesPayload = await fetchLabPackages();
    packageItems.value = packagesPayload.items || [];
    packageCatalog.value = packagesPayload.catalog || {};
  } catch (error) {
    catalogError.value = errorMessage(error, "套餐目录加载失败，请稍后重试。");
  } finally {
    catalogLoading.value = false;
  }
}

async function loadSubscription() {
  subscriptionLoading.value = true;
  subscriptionError.value = "";
  try {
    subscription.value = await fetchLabSubscription();
  } catch (error) {
    subscriptionError.value = errorMessage(error, "订阅状态加载失败，请稍后重试。");
  } finally {
    subscriptionLoading.value = false;
  }
}

async function loadEntitlement() {
  entitlementLoading.value = true;
  entitlementError.value = "";
  try {
    await fetchLabEntitlement();
  } catch (error) {
    entitlementError.value = errorMessage(error, "套餐权益加载失败，请稍后重试。");
  } finally {
    entitlementLoading.value = false;
  }
}

async function reloadAll() {
  await loadPackageCatalog();
  await loadSubscription();
  await loadEntitlement();
}

function loadPackageSurface() {
  void loadPackageCatalog();
  void loadSubscription();
  void loadEntitlement();
}

function actionText(key: string, fallback: string) {
  return loadingAction.value && currentAction.value === key ? "处理中..." : fallback;
}

function beginAction(action: string, message: string) {
  loadingAction.value = true;
  currentAction.value = action;
  feedbackType.value = "loading";
  actionFeedback.value = message;
}

function finishSuccess(message: string) {
  feedbackType.value = "success";
  actionFeedback.value = message;
}

function finishError(message: string) {
  feedbackType.value = "error";
  actionFeedback.value = message;
}

function endAction() {
  loadingAction.value = false;
  currentAction.value = "";
}

function errorMessage(error: unknown, fallback: string) {
  const value = (error as any)?.businessMessage || (error as any)?.message;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function activateStarterPackage() {
  const item = starterPackage.value;
  await runPackageAction({
    action: "activate_starter",
    loadingText: "正在开通入门套餐...",
    successText: "已成功开通入门套餐。",
    fallbackError: "开通失败，请稍后重试。",
    disabledReason: !item ? "入门套餐不可用。" : starterDisabledReason.value,
    run: () => activateLabPackage({ packageId: item?.id || "" }),
  });
}

async function expandSelected() {
  await runPackageAction({
    action: "expand_custom",
    loadingText: `正在扩容 ${selectedAddonGb.value}GB...`,
    successText: `已成功扩容 ${selectedAddonGb.value}GB。`,
    fallbackError: "扩容失败，请稍后重试。",
    disabledReason: customDisabledReason.value,
    run: () => purchaseLabStorageAddon({ addStorageGb: selectedAddonGb.value }),
  });
}

async function submitCustomPackage() {
  await runPackageAction({
    action: "custom_package",
    loadingText: "正在提交自定义套餐...",
    successText: "已成功提交自定义套餐。",
    fallbackError: "自定义套餐提交失败，请检查规格后重试。",
    disabledReason: customPackageDisabledReason.value,
    run: () => activateCustomLabPackage({
      customSpec: {
        computeCores: selectedCustomCpuCores.value,
        memoryGb: selectedCustomMemoryGb.value,
        storageIncludedGb: selectedCustomStorageGb.value,
      },
    }),
  });
}

async function upgradeAdvancedPackage() {
  const item = proPackage.value;
  await runPackageAction({
    action: "upgrade_pro",
    loadingText: "正在升级到进阶套餐...",
    successText: "已成功升级到进阶套餐。",
    fallbackError: "升级失败，请稍后重试。",
    disabledReason: !item ? "进阶套餐不可用。" : proDisabledReason.value,
    run: () => upgradeLabPackage({ packageId: item?.id || "" }),
  });
}

async function runPackageAction(input: {
  action: string;
  loadingText: string;
  successText: string;
  fallbackError: string;
  disabledReason: string;
  run: () => Promise<unknown>;
}) {
  if (input.disabledReason) {
    finishError(input.disabledReason);
    return;
  }
  beginAction(input.action, input.loadingText);
  try {
    await input.run();
    await reloadAll();
    finishSuccess(input.successText);
  } catch (error) {
    finishError(errorMessage(error, input.fallbackError));
  } finally {
    endAction();
  }
}

onMounted(async () => {
  loadPackageSurface();
});
</script>
