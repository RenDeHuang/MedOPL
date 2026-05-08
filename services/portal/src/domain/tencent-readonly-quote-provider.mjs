import { getCanonicalResourcePlan } from "./lab-packages.mjs";

function text(value = "") {
  return String(value ?? "").trim();
}

function numberValue(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundedMoney(value = 0) {
  return Number(numberValue(value).toFixed(5));
}

function planIdFromBinding(binding = {}) {
  return text(binding.planId || binding.serverPlanId || binding.packageId);
}

function regionLabel(region = "", zone = "") {
  if (text(region) === "na-siliconvalley" && text(zone || "").startsWith("na-siliconvalley")) return "硅谷一区";
  return text(region || "未设置");
}

function planSpec(plan = null, binding = {}) {
  const cpuCores = numberValue(plan?.compute?.cpuCores || binding.cpuCores);
  const memoryGb = numberValue(plan?.compute?.memoryGb || binding.memoryGb);
  const fileSpaceGb = numberValue(binding.fileSpaceGb || binding.storageCapacityGb || plan?.storage?.capacityGb);
  if (!cpuCores && !memoryGb && !fileSpaceGb) return "未设置";
  return `${cpuCores}核 / ${memoryGb}GB 内存 / ${fileSpaceGb}GB 文件空间`;
}

function quoteSnapshotIdFor(planId = "") {
  return `quote-snapshot-v22-${text(planId || "unknown").replace(/_/g, "-")}`;
}

function costView(snapshot = {}, fallbackSource = "contract_snapshot") {
  return {
    amount: roundedMoney(snapshot.amount),
    currency: text(snapshot.currency || "CNY"),
    source: text(snapshot.source || fallbackSource),
    status: text(snapshot.costStatus || snapshot.quoteStatus || "mock_snapshot"),
    billingTruth: false,
    chargeApplied: false,
  };
}

function mockQuoteFromSnapshot({ binding = {}, snapshot = {} } = {}) {
  const planId = planIdFromBinding(binding);
  const plan = getCanonicalResourcePlan(planId);
  return {
    regionLabel: text(snapshot.regionLabel) || regionLabel(binding.region || plan?.region, binding.zone || plan?.zone),
    planSpec: text(snapshot.planSpec) || planSpec(plan, binding),
    estimatedCost: costView(snapshot, snapshot.source || "contract_snapshot"),
    quoteSource: "mock/tencent-readonly-quote-provider",
    quoteStatus: text(snapshot.quoteStatus || "mock_snapshot"),
    quoteSnapshotId: text(snapshot.quoteSnapshotId || quoteSnapshotIdFor(planId)),
  };
}

export function createMockTencentReadonlyQuoteProvider({ snapshots = {} } = {}) {
  return Object.freeze({
    name: "mock/tencent-readonly-quote-provider",
    mode: "mock_snapshot",
    quoteManagedResourceBinding(input = {}) {
      const planId = planIdFromBinding(input.binding || {});
      return mockQuoteFromSnapshot({
        binding: input.binding,
        snapshot: snapshots[planId] || {},
      });
    },
  });
}

export const defaultTencentReadonlyQuoteProvider = createMockTencentReadonlyQuoteProvider();

export function quoteManagedResourceBindingPlan({ provider = defaultTencentReadonlyQuoteProvider, binding = {} } = {}) {
  if (!provider || typeof provider.quoteManagedResourceBinding !== "function") {
    throw new Error("readonly_tencent_quote_provider_required");
  }
  return provider.quoteManagedResourceBinding({ binding });
}
