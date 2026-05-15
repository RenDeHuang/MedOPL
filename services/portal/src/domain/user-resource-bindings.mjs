import { ensureWorkspaceStorageCollections } from "./workspace-storage.mjs";

const BINDING_PENDING_STOP_STATUSES = new Set(["release_requested", "billing_stop_confirming", "deleting"]);
const ACTIVE_BINDING_STATUSES = new Set(["active", "release_requested", "billing_stop_confirming", "billing_stopped", "audit_pending", "audit_ready", "audited"]);

function stringValue(value) {
  return String(value ?? "").trim();
}

function normalizeStringList(...values) {
  const seen = new Set();
  const result = [];
  for (const value of values.flat(Infinity)) {
    const text = stringValue(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function bindingId(binding = {}) {
  return stringValue(binding.resourceBindingId || binding.id);
}

function accountId(binding = {}) {
  return stringValue(binding.accountId || binding.account_id || binding.userId || binding.user_id || binding.ownerUserId || binding.tenantId || binding.tenant_id || binding.ownerTenantId);
}

function billingAttributionId(binding = {}) {
  return stringValue(binding.billingAttributionId || binding.billing_attribution_id || binding.cloudOperationId || binding.cloud_operation_id || binding.costAllocationTag || bindingId(binding));
}

function serverPlanId(binding = {}) {
  return stringValue(binding.serverPlanId || binding.server_plan_id || binding.planId || binding.plan_id || binding.packageId || binding.package_id);
}

function ownerMatches(binding = {}, storageOrder = {}) {
  if (stringValue(storageOrder.workspaceId) !== stringValue(binding.workspaceId)) return false;
  return (
    stringValue(storageOrder.userId) === stringValue(binding.userId || binding.ownerUserId) ||
    stringValue(storageOrder.tenantId) === stringValue(binding.tenantId || binding.ownerTenantId)
  );
}

function activeStorageOrdersForBinding(db = {}, binding = {}) {
  return (db.storageOrders || [])
    .filter((item) => ownerMatches(binding, item))
    .filter((item) => !["deleted", "cancelled"].includes(stringValue(item.status).toLowerCase()))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
}

function minutesBetween(startAt = "", endAt = "") {
  const startMs = Date.parse(String(startAt || ""));
  const endMs = Date.parse(String(endAt || ""));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return Math.floor((endMs - startMs) / 60000);
}

function buildResourceTiming(binding = {}) {
  const createdAt = stringValue(binding.createdAt);
  const updatedAt = stringValue(binding.updatedAt);
  const billingStartedAt = stringValue(binding.billingStartedAt || binding.createdAt);
  const billingStoppedAt = stringValue(binding.billingStoppedAt || binding.releasedAt);
  const usageEndAt = billingStoppedAt || updatedAt || createdAt;
  const usageMinutes = minutesBetween(billingStartedAt, usageEndAt);
  return {
    createdAt,
    updatedAt,
    resourceCreatedAt: createdAt,
    resourceUpdatedAt: updatedAt,
    billingStartedAt,
    billingStoppedAt,
    usageMinutes,
    runtimeMinutes: usageMinutes,
  };
}

function buildStorageTiming(storageOrder = {}) {
  return {
    storageCreatedAt: stringValue(storageOrder.createdAt),
    storageUpdatedAt: stringValue(storageOrder.updatedAt),
    storageDeletedAt: stringValue(storageOrder.deletedAt),
    storageBillingStartedAt: stringValue(storageOrder.billingStartedAt || storageOrder.createdAt),
    storageBillingStoppedAt: stringValue(storageOrder.billingStoppedAt || storageOrder.deletedAt),
    storageSizeGb: Number(storageOrder.storageSizeGb || 0),
    storageStatus: stringValue(storageOrder.status),
    retentionCleanupAfterAt: stringValue(storageOrder.retentionCleanupAfterAt),
  };
}

function resolveNodePoolId(binding = {}) {
  const cloudResourceIds = binding.cloudResourceIds || binding.cloud_resource_ids;
  const explicitRef = stringValue(binding.nodePoolRef || binding.node_pool_ref);
  if (explicitRef) return explicitRef;
  if (Array.isArray(cloudResourceIds)) return stringValue(cloudResourceIds[0]);
  if (!cloudResourceIds || typeof cloudResourceIds !== "object") return "";
  const explicit = stringValue(cloudResourceIds.nodePoolId || cloudResourceIds.node_pool_id);
  if (explicit) return explicit;
  for (const value of Object.values(cloudResourceIds)) {
    const text = stringValue(value);
    if (text) return text;
  }
  return "";
}

function resolveCvmInstanceIds(binding = {}) {
  const cloudResourceIds = binding.cloudResourceIds || binding.cloud_resource_ids;
  if (Array.isArray(cloudResourceIds)) {
    return normalizeStringList(cloudResourceIds.slice(1).filter((item) => /^ins-[a-z0-9-]+$/i.test(stringValue(item))));
  }
  if (!cloudResourceIds || typeof cloudResourceIds !== "object") return [];
  return normalizeStringList(
    cloudResourceIds.cvmInstanceIds,
    cloudResourceIds.cvm_instance_ids,
    cloudResourceIds.instanceIds,
    cloudResourceIds.instance_ids,
  );
}

export function buildBillingTags(binding = {}) {
  return {
    resourcebindingid: bindingId(binding),
    billingattributionid: billingAttributionId(binding),
    workspaceid: stringValue(binding.workspaceId),
    accountid: accountId(binding),
    serverplanid: serverPlanId(binding),
    runid: stringValue(binding.runId),
    tenantid: stringValue(binding.tenantId || binding.ownerTenantId),
  };
}

function buildDeleteState(binding = {}, nodePoolId = "") {
  const normalizedStatus = stringValue(binding.status).toLowerCase();
  if (!nodePoolId) {
    return { canDelete: false, deleteBlockedReason: "resource_binding_node_pool_missing" };
  }
  if (BINDING_PENDING_STOP_STATUSES.has(normalizedStatus)) {
    return { canDelete: false, deleteBlockedReason: `resource_binding_status_${normalizedStatus}` };
  }
  return { canDelete: true, deleteBlockedReason: "" };
}

function buildBindingItem(db = {}, binding = {}) {
  const [storageOrder] = activeStorageOrdersForBinding(db, binding);
  const nodePoolId = resolveNodePoolId(binding);
  const cvmInstanceIds = resolveCvmInstanceIds(binding);
  const deleteState = buildDeleteState(binding, nodePoolId);
  const resourceTiming = buildResourceTiming(binding);
  const storageTiming = buildStorageTiming(storageOrder || {});
  return {
    tenantId: stringValue(binding.tenantId || binding.ownerTenantId),
    workspaceId: stringValue(binding.workspaceId),
    runId: stringValue(binding.runId),
    resourceBindingId: bindingId(binding),
    billingAttributionId: billingAttributionId(binding),
    accountId: accountId(binding),
    serverPlanId: serverPlanId(binding),
    nodePoolId,
    cvmInstanceIds,
    storageOrderId: stringValue(storageOrder?.id),
    cosPrefix: stringValue(storageOrder?.cosPrefix),
    status: stringValue(binding.status).toLowerCase(),
    canDelete: deleteState.canDelete,
    deleteBlockedReason: deleteState.deleteBlockedReason,
    billingTags: buildBillingTags(binding),
    ...resourceTiming,
    ...storageTiming,
  };
}

export function buildUserResourceBindings(db = {}, user = {}) {
  ensureWorkspaceStorageCollections(db);
  const userId = stringValue(user.id);
  const tenantId = stringValue(user.tenantId || user.tenant_id || userId);
  const items = (Array.isArray(db.workspaceResourceBindings) ? db.workspaceResourceBindings : [])
    .filter((binding) => stringValue(binding.userId || binding.ownerUserId) === userId)
    .filter((binding) => !tenantId || stringValue(binding.tenantId || binding.ownerTenantId) === tenantId)
    .filter((binding) => ACTIVE_BINDING_STATUSES.has(stringValue(binding.status).toLowerCase()))
    .map((binding) => buildBindingItem(db, binding))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
  const summary = {
    total: items.length,
    deletable: items.filter((item) => item.canDelete).length,
    running: items.filter((item) => item.status === "running").length,
  };
  return {
    ok: true,
    source: "portal_user_resource_bindings",
    items,
    summary,
  };
}
