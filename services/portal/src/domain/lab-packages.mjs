const FREEZE_DAYS = 7;

const PACKAGE_DEFINITIONS = [
  {
    id: "starter",
    name: "入门套餐",
    audience: "regular",
    currency: "CNY",
    computeTier: "starter",
    headline: "适合小型文件分析和轻量任务",
    compute: {
      tier: "starter",
      label: "标准计算能力",
      cores: 2,
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
    backingServerPlanId: "starter-2c",
  },
  {
    id: "pro",
    name: "进阶套餐",
    audience: "regular",
    currency: "CNY",
    computeTier: "pro",
    headline: "适合更大的文件分析和多任务处理",
    compute: {
      tier: "pro",
      label: "更快计算能力",
      cores: 8,
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
    backingServerPlanId: "pro-8c",
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

export function listLabPackages() {
  return PACKAGES;
}

export function getLabPackage(packageId = "") {
  return PACKAGE_BY_ID.get(String(packageId || "").trim()) || null;
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
    storageCapacityGb: item.storage.includedGb,
    dailyDebit: item.billing.dailyPrice,
    weeklyFreeze: item.billing.weeklyFreezeAmount,
    gracePeriodDays: 7,
  };
}
