import { getCanonicalResourcePlan } from "./lab-packages.mjs";
import {
  defaultTencentReadonlyQuoteProvider,
  quoteManagedResourceBindingPlan,
} from "./tencent-readonly-quote-provider.mjs";

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

function ownerTenantId(user = {}) {
  return text(user.tenantId || user.tenant_id || user.id);
}

function bindingOwnerMatches(binding = {}, user = {}) {
  return text(binding.ownerUserId || binding.userId || binding.user_id) === text(user.id)
    && text(binding.ownerTenantId || binding.tenantId || binding.tenant_id) === ownerTenantId(user);
}

function regionLabel(region = "", zone = "") {
  if (text(region) === "na-siliconvalley" && text(zone || "").startsWith("na-siliconvalley")) return "硅谷一区";
  if (text(region)) return text(region);
  return "未设置";
}

function planIdFor(binding = {}, taskSpace = {}) {
  return text(binding.planId || binding.serverPlanId || binding.packageId || taskSpace.serverPlanId || taskSpace.packageId || "");
}

function planSpec(plan = null, binding = {}) {
  const cpuCores = numberValue(plan?.compute?.cpuCores || binding.cpuCores);
  const memoryGb = numberValue(plan?.compute?.memoryGb || binding.memoryGb);
  const fileSpaceGb = numberValue(binding.fileSpaceGb || binding.storageCapacityGb || plan?.storage?.capacityGb);
  if (!cpuCores && !memoryGb && !fileSpaceGb) return "未设置";
  return `${cpuCores}核 / ${memoryGb}GB 内存 / ${fileSpaceGb}GB 文件空间`;
}

function bindingCostItems(items = [], binding = {}) {
  const resourceBindingId = text(binding.resourceBindingId || binding.id);
  const workspaceId = text(binding.workspaceId);
  return items.filter((item) => {
    const props = item.properties && typeof item.properties === "object" ? item.properties : {};
    const itemBindingId = text(item.resourceBindingId || item.resource_binding_id || props.resourceBindingId || props.resource_binding_id || props["label:resource_binding_id"]);
    const itemWorkspaceId = text(item.workspaceId || item.workspace_id || props.workspaceId || props.workspace_id || props["label:workspace_id"]);
    if (itemBindingId) return itemBindingId === resourceBindingId;
    return workspaceId && itemWorkspaceId === workspaceId;
  });
}

function estimatedCost(billing = {}, binding = {}) {
  const items = bindingCostItems(Array.isArray(billing?.items) ? billing.items : [], binding);
  const amount = roundedMoney(items.reduce((sum, item) => sum + numberValue(item.totalCost), 0));
  return {
    amount,
    currency: text(billing?.currency || "CNY"),
    source: text(billing?.source || "contract_snapshot"),
    status: amount > 0 ? "estimated" : "pending_product_approval",
    billingTruth: false,
    chargeApplied: false,
  };
}

function releasePolicy(binding = {}) {
  const releasedAt = text(binding.releasedAt);
  return {
    status: releasedAt ? "release_requested" : "not_released",
    releasedAt,
    billingStopConfirmBy: text(binding.billingStopConfirmBy),
    stopBillingConfirmWithinMinutes: 120,
    protection: "文件和输出进入保护/审计边界",
  };
}

function auditStatus(binding = {}) {
  return {
    status: text(binding.auditStatus || (text(binding.releasedAt) ? "audit_pending" : "not_started")),
    auditReadyAt: text(binding.auditReadyAt),
    policy: "T+1",
  };
}

function snapshotView() {
  return {
    source: "mock_snapshot_provider",
    label: "managed resource binding plan / mock snapshot",
    realResourceCreated: false,
    providerAdapterStage: "mock_snapshot_provider",
  };
}

export function findManagedResourceBinding(db = {}, user = {}, workspaceId = "") {
  const targetWorkspaceId = text(workspaceId);
  return (Array.isArray(db.workspaceResourceBindings) ? db.workspaceResourceBindings : [])
    .filter((binding) => bindingOwnerMatches(binding, user))
    .filter((binding) => !targetWorkspaceId || text(binding.workspaceId) === targetWorkspaceId)
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
}

export function managedResourceBindingPlanView({ binding = null, taskSpace = {}, billing = {} } = {}) {
  if (!binding) return null;
  const plan = getCanonicalResourcePlan(planIdFor(binding, taskSpace));
  const region = text(binding.region || plan?.region);
  const zone = text(binding.zone || plan?.zone);
  const quote = quoteManagedResourceBindingPlan({
    provider: defaultTencentReadonlyQuoteProvider,
    binding,
  });
  return {
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    managedEnvironment: "托管运行环境",
    regionLabel: quote.regionLabel || regionLabel(region, zone),
    planSpec: quote.planSpec || planSpec(plan, binding),
    status: text(binding.status || "active"),
    estimatedCost: estimatedCost(billing, binding),
    quoteSource: text(quote.quoteSource || "mock/tencent-readonly-quote-provider"),
    quoteStatus: text(quote.quoteStatus || "mock_snapshot"),
    quoteSnapshotId: text(quote.quoteSnapshotId),
    releasePolicy: releasePolicy(binding),
    auditStatus: auditStatus(binding),
    snapshot: snapshotView(),
  };
}
