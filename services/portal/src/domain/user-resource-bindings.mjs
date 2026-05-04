import { RESOURCE_ORDER_PENDING_STOP_STATUSES, ensureResourceOrderCollections, resourceOrdersForUser } from "./resource-orders.mjs";
import { ensureWorkspaceStorageCollections } from "./workspace-storage.mjs";

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

function ownerMatches(order = {}, storageOrder = {}) {
  if (stringValue(storageOrder.workspaceId) !== stringValue(order.workspaceId)) return false;
  return (
    stringValue(storageOrder.userId) === stringValue(order.userId) ||
    stringValue(storageOrder.tenantId) === stringValue(order.tenantId)
  );
}

function activeStorageOrdersForOrder(db = {}, order = {}) {
  return (db.storageOrders || [])
    .filter((item) => ownerMatches(order, item))
    .filter((item) => !["deleted", "cancelled"].includes(stringValue(item.status).toLowerCase()))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
}

function minutesBetween(startAt = "", endAt = "") {
  const startMs = Date.parse(String(startAt || ""));
  const endMs = Date.parse(String(endAt || ""));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return Math.floor((endMs - startMs) / 60000);
}

function buildResourceTiming(order = {}) {
  const createdAt = stringValue(order.createdAt);
  const updatedAt = stringValue(order.updatedAt);
  const billingStartedAt = stringValue(order.billingStartedAt || createdAt);
  const billingStoppedAt = stringValue(order.billingStoppedAt || order.pendingStoppedAt);
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

function resolveNodePoolId(order = {}) {
  const cloudResourceIds = order.cloudResourceIds;
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

function resolveCvmInstanceIds(order = {}) {
  const cloudResourceIds = order.cloudResourceIds;
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

export function buildBillingTags(order = {}) {
  return {
    resourceorderid: stringValue(order.id),
    runid: stringValue(order.runId),
    serverplanid: stringValue(order.serverPlanId),
    tenantid: stringValue(order.tenantId),
    workspaceid: stringValue(order.workspaceId),
  };
}

function buildDeleteState(order = {}, nodePoolId = "") {
  const normalizedStatus = stringValue(order.status).toLowerCase();
  if (!nodePoolId) {
    return { canDelete: false, deleteBlockedReason: "resource_order_node_pool_missing" };
  }
  if (RESOURCE_ORDER_PENDING_STOP_STATUSES.has(normalizedStatus)) {
    return { canDelete: false, deleteBlockedReason: `resource_order_status_${normalizedStatus}` };
  }
  return { canDelete: true, deleteBlockedReason: "" };
}

function buildBindingItem(db = {}, order = {}) {
  const [storageOrder] = activeStorageOrdersForOrder(db, order);
  const nodePoolId = resolveNodePoolId(order);
  const cvmInstanceIds = resolveCvmInstanceIds(order);
  const deleteState = buildDeleteState(order, nodePoolId);
  const resourceTiming = buildResourceTiming(order);
  const storageTiming = buildStorageTiming(storageOrder || {});
  return {
    tenantId: stringValue(order.tenantId),
    workspaceId: stringValue(order.workspaceId),
    runId: stringValue(order.runId),
    resourceOrderId: stringValue(order.id),
    serverPlanId: stringValue(order.serverPlanId),
    nodePoolId,
    cvmInstanceIds,
    storageOrderId: stringValue(storageOrder?.id),
    cosPrefix: stringValue(storageOrder?.cosPrefix),
    status: stringValue(order.status).toLowerCase(),
    canDelete: deleteState.canDelete,
    deleteBlockedReason: deleteState.deleteBlockedReason,
    billingTags: buildBillingTags(order),
    ...resourceTiming,
    ...storageTiming,
  };
}

export function buildUserResourceBindings(db = {}, user = {}) {
  ensureResourceOrderCollections(db);
  ensureWorkspaceStorageCollections(db);
  const items = resourceOrdersForUser(db, stringValue(user.id))
    .map((order) => buildBindingItem(db, order))
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
