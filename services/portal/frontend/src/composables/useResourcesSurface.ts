import { computed, onMounted, ref } from "vue";
import {
  fetchMyResources,
  type PlatformProvisionedResourcesPayload,
  type WeeklyProtectionFreeze,
  type WorkspaceResourceBinding,
} from "@/api/portal/resources";
import {
  auditStatusText,
  computeSpecText,
  concurrencyText,
  money,
  planLabel,
  protectionEstimateText,
  resourceStatusBadge,
  resourceStatusText,
  storageCapacityText,
  workspaceDisplayName,
} from "@/composables/resourceFormatters";

export function useResourcesSurface() {
  const resourcesLoading = ref(false);
  const errorMessage = ref("");
  const actionFeedback = ref("");
  const payload = ref<PlatformProvisionedResourcesPayload | null>(null);

  const planCards = [
    {
      id: "starter_2c4g_10gb",
      name: "基础套餐",
      description: "适合轻量会话和小型任务。",
      computeSpec: "2 核 4GB",
      fileSpace: "10GB 文件空间",
      concurrency: "1 个任务",
      estimatedCost: "每小时 ¥3.20",
    },
    {
      id: "pro_8c16g_100gb",
      name: "Pro 套餐",
      description: "适合较大任务和更多输出文件。",
      computeSpec: "8 核 16GB",
      fileSpace: "100GB 文件空间",
      concurrency: "2 个任务",
      estimatedCost: "每小时 ¥9.60",
    },
  ];

  const items = computed<WorkspaceResourceBinding[]>(() => payload.value?.items || []);
  const protectionRows = computed<WeeklyProtectionFreeze[]>(() => payload.value?.protectionFreezes || []);
  const currentBinding = computed(() => items.value.find((item) => item.status === "active") || items.value[0] || null);
  const currentProtection = computed(() => currentBinding.value?.protection || protectionRows.value[0] || null);
  const currentCompute = computed(() => currentBinding.value?.computeInstance || payload.value?.computeInstances?.[0] || null);
  const currentStorage = computed(() => currentBinding.value?.storageBucket || payload.value?.storageBuckets?.[0] || null);
  const currentStatus = computed(() => currentBinding.value?.status || "pending");
  const currentPlanId = computed(() => currentCompute.value?.serverPlanId || planCards[0].id);
  const currentPlanName = computed(() => planLabel(currentPlanId.value));
  const currentComputeSpec = computed(() => computeSpecText(currentCompute.value));
  const currentFileSpaceText = computed(() => storageCapacityText(currentStorage.value));
  const currentConcurrencyText = computed(() => concurrencyText(currentPlanId.value));
  const estimatedCost = computed(() => currentProtection.value?.weeklyAmount || currentProtection.value?.frozenAmount || 0);
  const balanceFreezeStatus = computed(() => {
    const remaining = Number(currentProtection.value?.remainingAmount ?? 0);
    if (!currentProtection.value) return "待估算";
    return remaining > 0 ? "冻结金额充足" : "待核对";
  });
  const releasePolicyText = computed(() => (currentBinding.value?.status === "released" ? "已释放" : "按需释放后停止计费"));
  const stopBillingText = computed(() => {
    const releasedAmount = Number(currentProtection.value?.releasedAmount ?? 0);
    return releasedAmount > 0 ? `已确认 ${money(releasedAmount)}` : "待释放";
  });

  function setAdjustmentPlan(label: string) {
    actionFeedback.value = `${label} 已生成 dry-run 调整计划，不会真实开通资源。`;
  }

  async function reload() {
    resourcesLoading.value = true;
    errorMessage.value = "";
    try {
      payload.value = await fetchMyResources();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "加载工作台资源失败";
    } finally {
      resourcesLoading.value = false;
    }
  }

  onMounted(async () => {
    await reload();
  });

  return {
    actionFeedback,
    auditStatusText,
    balanceFreezeStatus,
    computeSpecText,
    concurrencyText,
    currentConcurrencyText,
    currentComputeSpec,
    currentFileSpaceText,
    currentPlanId,
    currentPlanName,
    currentProtection,
    currentStatus,
    errorMessage,
    estimatedCost,
    items,
    money,
    planCards,
    planLabel,
    protectionEstimateText,
    releasePolicyText,
    reload,
    resourcesLoading,
    setAdjustmentPlan,
    statusBadge: resourceStatusBadge,
    statusText: resourceStatusText,
    stopBillingText,
    storageCapacityText,
    workspaceDisplayName,
  };
}
