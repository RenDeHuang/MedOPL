import { safePositiveNumber } from "./commercial-state.mjs";

export function normalizeStringMap(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return normalizeStringMap(JSON.parse(value));
    } catch {
      return {};
    }
  }
  if (typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [String(key || "").trim(), String(item ?? "").trim()])
      .filter(([key, item]) => key && item),
  );
}

export function normalizeTolerations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      key: String(item.key || "").trim(),
      operator: String(item.operator || "Equal").trim() || "Equal",
      value: String(item.value || "").trim(),
      effect: String(item.effect || "").trim(),
    }))
    .filter((item) => item.key);
}

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
    nodePool: String(value.nodePool || "").trim(),
    runtimeClass: String(value.runtimeClass || "").trim(),
    nodeSelector: normalizeStringMap(value.nodeSelector),
    tolerations: normalizeTolerations(value.tolerations),
    podNetworkingMode: String(value.podNetworkingMode || value.pod_networking_mode || "").trim(),
    requiresEniPod: value.requiresEniPod === true || value.requires_eni_pod === true,
    podAnnotations: normalizeStringMap(value.podAnnotations || value.pod_annotations),
    provisioningMode: String(value.provisioningMode || "schedule_to_node_pool").trim() || "schedule_to_node_pool",
    tkeClusterId: String(value.tkeClusterId || value.clusterId || "").trim(),
    nodePoolId: String(value.nodePoolId || "").trim(),
    nodePoolCreatePayload: value.nodePoolCreatePayload && typeof value.nodePoolCreatePayload === "object" ? value.nodePoolCreatePayload : null,
    nodePoolScalePayload: value.nodePoolScalePayload && typeof value.nodePoolScalePayload === "object" ? value.nodePoolScalePayload : null,
    provisionerPayload: value.provisionerPayload && typeof value.provisionerPayload === "object" ? value.provisionerPayload : null,
    canOrder: Boolean(value.canOrder),
    matrixKey: String(value.matrixKey || "").trim(),
    pricingSource: String(value.pricingSource || "").trim(),
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
    nodePool: plan.nodePool,
    runtimeClass: plan.runtimeClass,
    nodeSelector: plan.nodeSelector,
    tolerations: plan.tolerations,
    podNetworkingMode: plan.podNetworkingMode,
    requiresEniPod: plan.requiresEniPod,
    podAnnotations: plan.podAnnotations,
    originalPrice: plan.originalPrice,
    selectedAt: new Date().toISOString(),
    provisioningMode: plan.provisioningMode,
    tkeClusterId: plan.tkeClusterId,
    nodePoolId: plan.nodePoolId,
    nodePoolCreatePayload: plan.nodePoolCreatePayload,
    nodePoolScalePayload: plan.nodePoolScalePayload,
    provisionerPayload: plan.provisionerPayload,
    canOrder: plan.canOrder,
    matrixKey: plan.matrixKey,
    pricingSource: plan.pricingSource,
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
    source: "billing_aggregator",
    configured: false,
    priceEnabled: false,
    catalogCount: 0,
    candidateCount: 0,
    orderableCount: 0,
    availabilityBreakdown: {},
    items: [],
    note,
    cloudStatus: {
      provider: "tencent_cloud",
      credentialsConfigured: false,
      readiness: {
        cloudAccountConnected: false,
        realPriceReady: false,
        exactBillReady: false,
        catalogReady: false,
        serverPlansReady: false,
      },
    },
  };
}

export function buildServerPlansSummary(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const quoted = items.filter((item) => item.priceStatus === "quoted");
  const salable = items.filter((item) => item.salable || item.canOrder);
  const lowestHourlyPrice = quoted.reduce((min, item) => {
    const candidate = Number(item.hourlyPrice ?? item.discountPrice ?? item.unitPrice ?? 0);
    if (!Number.isFinite(candidate) || candidate <= 0) return min;
    return min === null || candidate < min ? candidate : min;
  }, null);
  return {
    source: String(payload?.source || "billing_aggregator"),
    configured: Boolean(payload?.configured),
    priceEnabled: Boolean(payload?.priceEnabled),
    discoveryEnabled: Boolean(payload?.discoveryEnabled),
    discoveredCount: Number(payload?.discoveredCount || 0),
    candidateCount: Number(payload?.candidateCount || items.length),
    catalogCount: Number(payload?.catalogCount || items.length),
    quotedCount: quoted.length,
    salableCount: salable.length,
    orderableCount: Number(payload?.orderableCount || salable.length),
    availabilityBreakdown: payload?.availabilityBreakdown || {},
    priceStatus: quoted.length ? "quoted" : (items.length ? "pending" : "unavailable"),
    lowestHourlyPrice: lowestHourlyPrice ?? 0,
    note: String(payload?.note || "").trim(),
    cloudStatus: payload?.cloudStatus || null,
  };
}

export function buildOverviewOnboarding({ commercial, workspaceCount, sessionCount, serverPlansSummary }) {
  const fundingReady = commercial.billingStatus === "wallet_available" || commercial.billingStatus === "trial_only";
  const serverReady = serverPlansSummary.salableCount > 0 || serverPlansSummary.quotedCount > 0;
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
          ? `已提供 ${serverPlansSummary.salableCount || serverPlansSummary.catalogCount} 个可售规格，展示腾讯云地域、规格、最小计费单元和冻结依据。`
          : "服务器价格等待腾讯云报价刷新，可先查看规格目录和报价状态。",
      },
      {
        id: "workspace",
        title: "创建任务空间",
        state: workspaceCount > 0 ? "done" : "ready",
        href: "/workspace",
        description: workspaceCount > 0 ? "已存在可用任务空间。" : "先创建任务空间，再进入实验室承载 session、trace 和文件存储。",
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
