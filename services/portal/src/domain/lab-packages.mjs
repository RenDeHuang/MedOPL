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
      basePrice: null,
      pendingProductApproval: true,
      priceLabel: "正式售价未定价",
      freezeDays: FREEZE_DAYS,
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
      basePrice: null,
      pendingProductApproval: true,
      priceLabel: "正式售价未定价",
      freezeDays: FREEZE_DAYS,
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

export function getLabPackage(packageId = "") {
  const id = normalizeLabPackageId(packageId);
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
    plainIncluded: [...(item.plainIncluded || [])],
    plainLimits: [...(item.plainLimits || [])],
    overageCopy: item.overageCopy || "",
    computePower: `${item.compute.cores} 核计算能力`,
    memoryGb: Number(item.compute.memoryGb || 0),
    storageCapacityGb: item.storage.includedGb,
    basePrice: null,
    pendingProductApproval: true,
    priceLabel: "正式售价未定价",
    gracePeriodDays: 7,
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
  };
}
