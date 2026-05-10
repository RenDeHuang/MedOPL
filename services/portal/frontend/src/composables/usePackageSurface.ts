import { computed, ref } from "vue";
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

type FeedbackType = "success" | "error" | "loading" | "";
type CustomOptions = NonNullable<NonNullable<Awaited<ReturnType<typeof fetchLabPackages>>["catalog"]>["customOptions"]>;

function errorMessage(error: unknown, fallback: string) {
  const source = error as {
    businessMessage?: unknown;
    message?: unknown;
    response?: {
      data?: {
        businessMessage?: unknown;
        message?: unknown;
        error?: unknown;
      };
    };
  };
  const value = source?.businessMessage
    || source?.response?.data?.businessMessage
    || source?.response?.data?.message
    || source?.response?.data?.error
    || source?.message;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function pickDisabledReason(rules: Array<[boolean, string]>) {
  return rules.find((rule) => rule[0])?.[1] || "";
}

function packageById(items: LabPackagePlan[], packageId: string) {
  return items.find((item) => item.id === packageId) || null;
}

function packageFromCatalog(
  catalog: Awaited<ReturnType<typeof fetchLabPackages>>["catalog"] | undefined,
  items: LabPackagePlan[],
  packageId: "starter" | "pro",
) {
  return catalog?.[packageId] || packageById(items, packageId);
}

export function usePackageSurface() {
  const packageItems = ref<LabPackagePlan[]>([]);
  const subscription = ref<LabSubscriptionPayload | null>(null);
  const loadingAction = ref(false);
  const currentAction = ref("");
  const feedbackType = ref<FeedbackType>("");
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
  const packageCatalog = ref<Awaited<ReturnType<typeof fetchLabPackages>>["catalog"]>({});

  const currentGracePeriod = computed(() => (
    packageById(packageItems.value, subscription.value?.currentPackageId || "")?.gracePeriodDays ?? 0
  ));
  const usedStorageGb = computed(() => {
    const source = subscription.value as (LabSubscriptionPayload & { usedStorageGb?: number; storageUsedGb?: number }) | null;
    return Number(source?.usedStorageGb ?? 0) || Number(source?.storageUsedGb ?? 0);
  });
  const starterPackage = computed(() => packageFromCatalog(packageCatalog.value, packageItems.value, "starter"));
  const proPackage = computed(() => packageFromCatalog(packageCatalog.value, packageItems.value, "pro"));
  const customOptions = computed<CustomOptions>(() => packageCatalog.value?.customOptions || {});
  const addonOptions = computed(() => customOptions.value.storageAddonSizesGb || [100]);
  const customCpuOptions = computed(() => customOptions.value.computeCores || [2, 4, 8]);
  const customMemoryOptions = computed(() => customOptions.value.memoryGb || [4, 8, 16, 32]);
  const customStorageOptions = computed(() => customOptions.value.storageIncludedGb || [10, 100, 500]);
  const addonOptionsText = computed(() => addonOptions.value.map((item) => `${item}GB`).join(" / "));
  const customSummaryText = computed(() => `${selectedCustomCpuCores.value} 核 / ${selectedCustomMemoryGb.value}GB 内存 / ${selectedCustomStorageGb.value}GB 存储`);
  const customNotesText = computed(() => (customOptions.value.notes || []).join("；"));
  const hasSubscription = computed(() => Boolean(subscription.value?.currentPackageId));
  const starterDisabledReason = computed(() => pickDisabledReason([
    [loadingAction.value, "当前有操作进行中，请稍候。"],
    [!starterPackage.value?.id, "入门套餐不可用。"],
    [subscription.value?.currentPackageId === "starter", "你已开通入门套餐。"],
  ]));
  const proDisabledReason = computed(() => pickDisabledReason([
    [loadingAction.value, "当前有操作进行中，请稍候。"],
    [!proPackage.value?.id, "进阶套餐不可用。"],
    [!hasSubscription.value, "请先开通套餐，再进行升级。"],
    [subscription.value?.currentPackageId === "pro", "你已是进阶套餐。"],
  ]));
  const customDisabledReason = computed(() => pickDisabledReason([
    [loadingAction.value, "当前有操作进行中，请稍候。"],
    [!hasSubscription.value, "未订阅时不能扩容，请先开通套餐。"],
    [!addonOptions.value.includes(selectedAddonGb.value), "请选择有效扩容规格。"],
  ]));
  const customPackageDisabledReason = computed(() => pickDisabledReason([
    [loadingAction.value, "当前有操作进行中，请稍候。"],
    [!customCpuOptions.value.includes(selectedCustomCpuCores.value), "请选择有效 CPU 规格。"],
    [!customMemoryOptions.value.includes(selectedCustomMemoryGb.value), "请选择有效内存规格。"],
    [!customStorageOptions.value.includes(selectedCustomStorageGb.value), "请选择有效套餐存储规格。"],
  ]));
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

  return {
    actionFeedback,
    actionText,
    activateStarterPackage,
    addonOptions,
    addonOptionsText,
    catalogError,
    catalogLoading,
    customCpuOptions,
    customDisabled,
    customDisabledReason,
    customMemoryOptions,
    customNotesText,
    customPackageDisabled,
    customPackageDisabledReason,
    customStorageOptions,
    customSummaryText,
    currentGracePeriod,
    entitlementError,
    entitlementLoading,
    expandSelected,
    feedbackClass,
    loadPackageSurface,
    loadingAction,
    money,
    proDisabled,
    proDisabledReason,
    proPackage,
    selectedAddonGb,
    selectedCustomCpuCores,
    selectedCustomMemoryGb,
    selectedCustomStorageGb,
    starterDisabled,
    starterDisabledReason,
    starterPackage,
    submitCustomPackage,
    subscription,
    subscriptionError,
    subscriptionLoading,
    upgradeAdvancedPackage,
    usedStorageGb,
  };
}
