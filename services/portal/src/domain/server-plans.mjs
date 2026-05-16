import { safePositiveNumber } from "./commercial-state.mjs";

export function normalizeServerPlanSelection(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || value.serverPlanId || "").trim();
  if (!id) return null;
  return {
    id,
    name: String(value.name || id).trim() || id,
    provider: String(value.provider || "tencent").trim() || "tencent",
    region: String(value.region || "").trim(),
    zone: String(value.zone || "").trim(),
    instanceType: String(value.instanceType || "").trim(),
    currency: String(value.currency || "CNY").trim() || "CNY",
    priceStatus: String(value.priceStatus || "").trim(),
    availabilityStatus: String(value.availabilityStatus || "").trim(),
    statusCategory: String(value.statusCategory || "").trim(),
    soldOutReason: String(value.soldOutReason || value.reason || "").trim(),
    originalPrice: safePositiveNumber(value.originalPrice, 0),
    discountPrice: safePositiveNumber(value.discountPrice, 0),
    unitPrice: safePositiveNumber(value.unitPrice, 0),
    hourlyPrice: safePositiveNumber(value.hourlyPrice ?? value.discountPrice ?? value.unitPrice, 0),
    quoteAmount: safePositiveNumber(value.quoteAmount, 0),
    preauthAmount: safePositiveNumber(value.preauthAmount, 0),
    minBillableHours: Math.max(1, Number(value.minBillableHours || 1)),
    riskFactor: safePositiveNumber(value.riskFactor, 1),
    reservationFloor: safePositiveNumber(value.reservationFloor, 0),
    cpu: safePositiveNumber(value.cpu, 0),
    memoryGb: safePositiveNumber(value.memoryGb || value.memory, 0),
    gpu: safePositiveNumber(value.gpu, 0),
    cpuRequest: String(value.cpuRequest || "").trim(),
    cpuLimit: String(value.cpuLimit || "").trim(),
    memoryRequest: String(value.memoryRequest || "").trim(),
    memoryLimit: String(value.memoryLimit || "").trim(),
    gpuCount: Number(value.gpuCount ?? value.gpu ?? 0),
    storageRequest: String(value.storageRequest || "").trim(),
    storageLimit: String(value.storageLimit || "").trim(),
    isSelectable: Boolean(value.isSelectable),
    matrixKey: String(value.matrixKey || "").trim(),
    priceOrigin: String(value.priceOrigin || "").trim(),
    priceUpdatedAt: String(value.priceUpdatedAt || "").trim(),
    selectedAt: String(value.selectedAt || "").trim(),
    selectionNote: String(value.selectionNote || "").trim(),
  };
}

export function buildTaskSpaceServerPlanSelection(plan) {
  return normalizeServerPlanSelection({
    id: plan.id,
    name: plan.name,
    provider: plan.provider,
    region: plan.region,
    zone: plan.zone,
    instanceType: plan.instanceType,
    currency: plan.currency,
    priceStatus: plan.priceStatus,
    availabilityStatus: plan.availabilityStatus,
    statusCategory: plan.statusCategory,
    soldOutReason: plan.soldOutReason,
    discountPrice: plan.discountPrice,
    unitPrice: plan.unitPrice,
    hourlyPrice: plan.hourlyPrice,
    quoteAmount: plan.quoteAmount,
    preauthAmount: plan.preauthAmount,
    minBillableHours: plan.minBillableHours,
    riskFactor: plan.riskFactor,
    reservationFloor: plan.reservationFloor,
    cpuRequest: plan.cpuRequest,
    cpuLimit: plan.cpuLimit,
    memoryRequest: plan.memoryRequest,
    memoryLimit: plan.memoryLimit,
    cpu: plan.cpu,
    memoryGb: plan.memoryGb,
    gpu: plan.gpu,
    gpuCount: plan.gpuCount ?? plan.gpu,
    storageRequest: plan.storageRequest,
    storageLimit: plan.storageLimit,
    originalPrice: plan.originalPrice,
    selectedAt: new Date().toISOString(),
    isSelectable: plan.isSelectable,
    matrixKey: plan.matrixKey,
    priceOrigin: plan.priceOrigin,
    priceUpdatedAt: plan.priceUpdatedAt,
    selectionNote: plan.selectionNote,
  });
}

export function currentServerPlanSelection(taskSpace) {
  return normalizeServerPlanSelection(taskSpace?.serverPlanSnapshot || {
    id: taskSpace?.serverPlanId,
    region: taskSpace?.serverPlanRegion,
  });
}

export function buildServerPlansFallback(note = "账单聚合服务暂不可用，服务器价格稍后刷新。") {
  return {
    ok: false,
    catalogSource: "platform_catalog",
    configured: false,
    priceEnabled: false,
    catalogCount: 0,
    candidateCount: 0,
    selectableCount: 0,
    availabilityBreakdown: {},
    items: [],
    note,
    catalogRuntimeStatus: {
      status: "unavailable",
      catalogSource: "provider_catalog_snapshot",
      catalogCount: 0,
      candidateCount: 0,
    },
    pricingSourceStatus: {
      status: "unavailable",
      priceOrigin: "catalog_price",
      quotedCount: 0,
      pendingSource: "platform_provisioned_local_metering",
    },
  };
}

export function buildServerPlansSummary(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const quoted = items.filter((item) => item.priceStatus === "quoted");
  const purchasableItems = items.filter((item) => item.isPurchasable);
  const selectableItems = items.filter((item) => item.isSelectable ?? item.isPurchasable);
  const lowestHourlyPrice = quoted.reduce((min, item) => {
    const candidate = Number(item.hourlyPrice ?? item.discountPrice ?? item.unitPrice ?? 0);
    if (!Number.isFinite(candidate) || candidate <= 0) return min;
    return min === null || candidate < min ? candidate : min;
  }, null);
  return {
    catalogSource: String(payload?.catalogSource || "platform_catalog"),
    configured: Boolean(payload?.configured),
    priceEnabled: Boolean(payload?.priceEnabled),
    availabilitySyncEnabled: Boolean(payload?.availabilitySyncEnabled),
    availabilitySnapshotCount: Number(payload?.availabilitySnapshotCount ?? 0),
    candidateCount: Number(payload?.candidateCount || items.length),
    catalogCount: Number(payload?.catalogCount || items.length),
    quotedCount: quoted.length,
    purchasableCount: Number(payload?.purchasableCount ?? purchasableItems.length),
    selectableCount: Number(payload?.selectableCount ?? selectableItems.length),
    availabilityBreakdown: payload?.availabilityBreakdown || {},
    priceStatus: quoted.length ? "quoted" : (items.length ? "pending" : "unavailable"),
    lowestHourlyPrice: lowestHourlyPrice ?? 0,
    note: String(payload?.note || "").trim(),
    catalogRuntimeStatus: payload?.catalogRuntimeStatus || null,
    pricingSourceStatus: payload?.pricingSourceStatus || null,
  };
}

export function buildOverviewOnboarding({ commercial, workspaceCount, sessionCount, serverPlansSummary }) {
  const fundingReady = commercial.billingStatus === "wallet_available" || commercial.billingStatus === "trial_only";
  const serverReady = serverPlansSummary.purchasableCount > 0 || serverPlansSummary.quotedCount > 0;
  return {
    nextStepId: !fundingReady
      ? "funding"
      : workspaceCount <= 0
        ? "workspace"
        : sessionCount <= 0
          ? "launch"
          : "server_plans",
    items: [
      {
        id: "configure_key",
        title: "配置模型 API Key",
        state: "ready",
        href: "",
        description: "模型 API key 由用户自己的中转站承担；Portal 只负责平台资源、服务费和云账单透明化。",
      },
      {
        id: "server_plans",
        title: "查看服务器与费用",
        state: serverReady ? "ready" : "attention",
        href: "/servers",
        description: serverReady
          ? `已提供 ${serverPlansSummary.purchasableCount || serverPlansSummary.catalogCount} 个可选套餐，展示平台套餐容量、计费单元和保护金依据。`
          : "套餐价格等待平台同步，可先查看套餐目录和开通状态。",
      },
      {
        id: "workspace",
        title: "创建工作空间",
        state: workspaceCount > 0 ? "done" : "ready",
        href: "/workspace",
        description: workspaceCount > 0 ? "已存在可用工作空间。" : "先创建工作空间，再进入实验室承载 session、trace 和文件存储。",
      },
      {
        id: "launch",
        title: "进入实验室",
        state: sessionCount > 0 ? "done" : "ready",
        href: "/portal/opl",
        description: "余额不足不再阻止进入工作台；真正触发收费运行时，再按钱包或试用额度校验。",
      },
      {
        id: "funding",
        title: "充值或使用试用额度",
        state: fundingReady ? "done" : "attention",
        href: "/billing",
        description: fundingReady
          ? commercial.entitlementStatus === "trial_active"
            ? "当前已有试用额度，可先体验再充值。"
            : "当前钱包可用于收费运行。"
          : "收费运行前需充值，或等待管理员发放试用权益。",
      },
    ],
  };
}
