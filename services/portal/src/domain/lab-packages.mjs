const FREEZE_DAYS = 7;

const PACKAGE_DEFINITIONS = [
  {
    id: "starter_2c4g_10gb",
    name: "入门套餐",
    audience: "regular",
    currency: "CNY",
    computeTier: "starter",
    headline: "适合小型文件分析和轻量任务",
    compute: {
      tier: "starter",
      label: "标准计算能力",
      cores: 2,
      memoryGb: 4,
      maxConcurrentRuns: 1,
    },
    storage: {
      includedGb: 10,
      warningRatio: 0.8,
    },
    billing: {
      dailyPrice: 12,
      freezeDays: FREEZE_DAYS,
      weeklyFreezeAmount: 84,
    },
    plainIncluded: ["10GB 套餐存储", "可上传文件", "可运行小型任务", "可下载结果"],
    plainLimits: ["不适合长时间大规模任务", "余额不足时会先提醒，再限制新任务"],
    overageCopy: "超过套餐容量后需要扩容或清理旧文件",
    backingServerPlanId: "starter_2c4g_10gb",
  },
  {
    id: "pro_8c16g_100gb",
    name: "进阶套餐",
    audience: "regular",
    currency: "CNY",
    computeTier: "pro",
    headline: "适合更大的文件分析和多任务处理",
    compute: {
      tier: "pro",
      label: "更快计算能力",
      cores: 8,
      memoryGb: 16,
      maxConcurrentRuns: 3,
    },
    storage: {
      includedGb: 100,
      warningRatio: 0.8,
    },
    billing: {
      dailyPrice: 48,
      freezeDays: FREEZE_DAYS,
      weeklyFreezeAmount: 336,
    },
    plainIncluded: ["100GB 套餐存储", "可上传文件", "可运行多个任务", "可下载结果"],
    plainLimits: ["长时间大规模任务会产生更多运行费用", "余额不足时会先提醒，再限制新任务"],
    overageCopy: "超过套餐容量后需要扩容或清理旧文件",
    backingServerPlanId: "pro_8c16g_100gb",
  },
];

function freezePackage(item) {
  return Object.freeze({
    ...item,
    compute: Object.freeze({ ...item.compute }),
    storage: Object.freeze({ ...item.storage }),
    billing: Object.freeze({ ...item.billing }),
  });
}

const PACKAGES = Object.freeze(PACKAGE_DEFINITIONS.map(freezePackage));
const PACKAGE_BY_ID = new Map(PACKAGES.map((item) => [item.id, item]));
const CUSTOM_OPTIONS = Object.freeze({
  computeCores: Object.freeze([2, 4, 8]),
  memoryGb: Object.freeze([4, 8, 16, 32]),
  storageIncludedGb: Object.freeze([10, 100, 500]),
  storageAddonSizesGb: Object.freeze([100, 500, 1024]),
  notes: Object.freeze(["自定义可选择计算核心、内存和套餐存储", "已开通套餐后可继续单独扩容存储"]),
});

const CANONICAL_RESOURCE_PLAN_DEFAULTS = Object.freeze({
  basePrice: null,
  pendingProductApproval: true,
  storageBackend: "cos_standard_workspace_quota",
  region: "na-siliconvalley",
  zone: "na-siliconvalley-1",
  os: "ubuntu_22_04",
  cloudBillingMode: "pay_as_you_go",
});

const CANONICAL_RESOURCE_PLAN_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "starter_2c4g_10gb",
    name: "starter_2c4g_10gb",
    tier: "starter",
    compute: Object.freeze({ cpuCores: 2, memoryGb: 4 }),
    storage: Object.freeze({ capacityGb: 10 }),
    ...CANONICAL_RESOURCE_PLAN_DEFAULTS,
  }),
  Object.freeze({
    id: "pro_8c16g_100gb",
    name: "pro_8c16g_100gb",
    tier: "pro",
    compute: Object.freeze({ cpuCores: 8, memoryGb: 16 }),
    storage: Object.freeze({ capacityGb: 100 }),
    ...CANONICAL_RESOURCE_PLAN_DEFAULTS,
  }),
]);

const CANONICAL_RESOURCE_PLAN_ALIASES = Object.freeze({
  starter: "starter_2c4g_10gb",
  "starter-2c": "starter_2c4g_10gb",
  "starter-2c4g-10gb": "starter_2c4g_10gb",
  "default-2c4gb-10gb": "starter_2c4g_10gb",
  starter_2c4gb_10gb: "starter_2c4g_10gb",
  pro: "pro_8c16g_100gb",
  "pro-8c": "pro_8c16g_100gb",
  "pro-8c16g-100gb": "pro_8c16g_100gb",
  "default-8c16gb-100gb": "pro_8c16g_100gb",
  pro_8c16gb_100gb: "pro_8c16g_100gb",
});

const CANONICAL_RESOURCE_PLAN_BY_ID = new Map(CANONICAL_RESOURCE_PLAN_DEFINITIONS.map((item) => [item.id, item]));

export function canonicalResourcePlanId(value = "") {
  const id = String(value || "").trim();
  return CANONICAL_RESOURCE_PLAN_ALIASES[id] || id;
}

export function normalizeLabPackageId(packageId = "") {
  const id = String(packageId || "").trim();
  if (id === "custom") return id;
  const plan = getCanonicalResourcePlan(id);
  return plan?.id || id;
}

export function listCanonicalResourcePlans() {
  return CANONICAL_RESOURCE_PLAN_DEFINITIONS;
}

export function getCanonicalResourcePlan(planId = "") {
  return CANONICAL_RESOURCE_PLAN_BY_ID.get(canonicalResourcePlanId(planId)) || null;
}

export function canonicalResourcePlanPublicView(plan = null) {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    tier: plan.tier,
    compute: { ...plan.compute },
    storage: { ...plan.storage },
    storageBackend: plan.storageBackend,
    region: plan.region,
    zone: plan.zone,
    os: plan.os,
    cloudBillingMode: plan.cloudBillingMode,
    basePrice: null,
    pendingProductApproval: true,
  };
}

export function listLabPackages() {
  return PACKAGES;
}

export function normalizeCustomLabPackageSpec(input = {}) {
  const computeCores = Number(input.computeCores ?? input.compute_cores ?? input.cpuCores ?? input.cpu_cores ?? 0);
  const memoryGb = Number(input.memoryGb ?? input.memory_gb ?? 0);
  const storageIncludedGb = Number(input.storageIncludedGb ?? input.storage_included_gb ?? input.storageGb ?? input.storage_gb ?? 0);
  const spec = { computeCores, memoryGb, storageIncludedGb };
  return customSpecAllowed(spec) ? spec : null;
}

function customSpecAllowed(spec) {
  return CUSTOM_OPTIONS.computeCores.includes(spec.computeCores)
    && CUSTOM_OPTIONS.memoryGb.includes(spec.memoryGb)
    && CUSTOM_OPTIONS.storageIncludedGb.includes(spec.storageIncludedGb);
}

export function customLabPackageFromSpec(input = {}) {
  const spec = normalizeCustomLabPackageSpec(input);
  if (!spec) return null;
  const dailyPrice = Number((spec.computeCores * 9 + spec.memoryGb * 0.75 + spec.storageIncludedGb * 0.08).toFixed(2));
  return {
    id: "custom",
    name: "自定义套餐",
    audience: "regular",
    currency: "CNY",
    computeTier: "custom",
    headline: "按业务规模选择算力、内存和套餐存储",
    compute: {
      tier: "custom",
      label: `${spec.computeCores} 核 / ${spec.memoryGb}GB 内存`,
      cores: spec.computeCores,
      memoryGb: spec.memoryGb,
      maxConcurrentRuns: Math.max(1, Math.floor(spec.computeCores / 2)),
    },
    storage: {
      includedGb: spec.storageIncludedGb,
      warningRatio: 0.8,
    },
    billing: {
      dailyPrice,
      freezeDays: FREEZE_DAYS,
      weeklyFreezeAmount: Number((dailyPrice * FREEZE_DAYS).toFixed(2)),
    },
    plainIncluded: [`${spec.storageIncludedGb}GB 套餐存储`, `${spec.computeCores} 核计算`, `${spec.memoryGb}GB 内存`, "可上传文件", "可下载结果"],
    plainLimits: ["自定义套餐按所选规格计费", "余额不足时会先提醒，再限制新任务"],
    overageCopy: "超过套餐容量后需要扩容或清理旧文件",
    backingServerPlanId: `custom-${spec.computeCores}c-${spec.memoryGb}g-${spec.storageIncludedGb}gb`,
    customSpec: spec,
  };
}

export function getLabPackage(packageId = "", customSpec = {}) {
  const id = normalizeLabPackageId(packageId);
  if (id === "custom") return customLabPackageFromSpec(customSpec);
  return PACKAGE_BY_ID.get(id) || null;
}

export function packagePublicView(item) {
  if (!item) return null;
  return {
    id: item.id,
    name: item.name,
    audience: item.audience,
    currency: item.currency,
    computeTier: item.computeTier,
    headline: item.headline,
    compute: { ...item.compute },
    storage: { ...item.storage },
    billing: { ...item.billing },
    backingServerPlanId: item.backingServerPlanId,
    packageId: item.id,
    includedStorageGb: item.storage.includedGb,
    weeklyFreezeAmountCents: Math.round(Number(item.billing.weeklyFreezeAmount || 0) * 100),
    plainIncluded: [...(item.plainIncluded || [])],
    plainLimits: [...(item.plainLimits || [])],
    overageCopy: item.overageCopy || "",
    computePower: `${item.compute.cores} 核计算能力`,
    memoryGb: Number(item.compute.memoryGb || 0),
    storageCapacityGb: item.storage.includedGb,
    dailyDebit: item.billing.dailyPrice,
    weeklyFreeze: item.billing.weeklyFreezeAmount,
    gracePeriodDays: 7,
    customSpec: item.customSpec ? { ...item.customSpec } : null,
    planSummary: item.compute.memoryGb
      ? `${item.compute.cores}C / ${item.compute.memoryGb}GB 内存 / ${item.storage.includedGb}GB`
      : `${item.compute.cores}C / ${item.storage.includedGb}GB`,
  };
}

export function labPackageCatalogPublicView() {
  const starter = packagePublicView(getLabPackage("starter_2c4g_10gb"));
  const pro = packagePublicView(getLabPackage("pro_8c16g_100gb"));
  return {
    starter,
    pro,
    customOptions: {
      ...CUSTOM_OPTIONS,
      upgradeTargets: [pro?.id].filter(Boolean),
    },
  };
}
