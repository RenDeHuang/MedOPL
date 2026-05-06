import {
  holdFreezeForOrder,
  normalizeLedgerEntries,
  releaseFreezeForOrder,
} from "./wallet-ledger.mjs";
import {
  normalizeResourceOrderEvent,
  normalizeResourceOrderFields,
} from "./resource-order-normalizers.mjs";
export { quoteResourceOrderFromPlan } from "./resource-order-quote.mjs";
import { transitionResourceOrderRecord } from "./resource-order-lifecycle.mjs";
export { resourceOrderPublicView } from "./resource-order-public-view.mjs";
export {
  RESOURCE_ORDER_PENDING_STOP_STATUSES,
  RESOURCE_ORDER_REUSABLE_STATUSES,
  RESOURCE_ORDER_STATUSES,
} from "./resource-order-statuses.mjs";
import {
  RESOURCE_ORDER_PENDING_STOP_STATUSES,
  RESOURCE_ORDER_REUSABLE_STATUSES,
  RESOURCE_ORDER_STATUSES,
} from "./resource-order-statuses.mjs";
import { resolvePreauthBufferRatio } from "./resource-order-quote.mjs";

export function ensureResourceOrderCollections(db) {
  if (!Array.isArray(db.resourceOrders)) db.resourceOrders = [];
  if (!Array.isArray(db.resourceOrderEvents)) db.resourceOrderEvents = [];
  db.resourceOrders = db.resourceOrders.map(normalizeResourceOrder).filter(Boolean);
  db.resourceOrderEvents = db.resourceOrderEvents.map(normalizeResourceOrderEvent).filter(Boolean);
  db.ledger = normalizeLedgerEntries(db.ledger);
  return db;
}

export function normalizeResourceOrder(order = {}) {
  if (!order || typeof order !== "object") return null;
  const status = String(order.status || "quoted").trim().toLowerCase();
  const now = new Date().toISOString();
  return normalizeResourceOrderFields({ now, order, status, statuses: RESOURCE_ORDER_STATUSES });
}

export function upsertQuotedResourceOrder(db, order) {
  ensureResourceOrderCollections(db);
  if (order.idempotencyKey) {
    const existing = db.resourceOrders.find((item) => item.idempotencyKey === order.idempotencyKey);
    if (existing) return { order: existing, created: false };
  }
  const reusable = findReusableResourceOrder(db, order);
  if (reusable) return { order: reusable, created: false, reusedBy: "business_key" };
  db.resourceOrders.push(order);
  appendResourceOrderEvent(db, {
    orderId: order.id,
    eventType: "quoted",
    eventPayload: {
      quoteAmount: order.quoteAmount,
      preauthAmount: order.freezeAmount,
      preauthBufferRatio: resolvePreauthBufferRatio({}, {}),
      serverPlanId: order.serverPlanId,
      estimatedHours: order.estimatedHours,
      pricingSource: order.pricingSource,
    },
    actorType: "portal",
    actorId: order.userId,
    idempotencyKey: `event:quoted:${order.id}`,
  });
  return { order, created: true };
}

export function freezeResourceOrder(db, { user, order, idempotencyKey = "" }) {
  const target = db.resourceOrders.find((item) => item.id === order.id);
  if (!target) return { ok: false, status: 404, error: "resource_order_not_found" };
  if (["frozen", "provisioning", "running"].includes(String(target.status || "").toLowerCase())) {
    return { ok: true, order: target, ledgerEntry: null, snapshot: null, reused: true };
  }
  if (["cancelled", "failed", "settled"].includes(target.status)) {
    return { ok: false, status: 409, error: "resource_order_not_freezable" };
  }
  const held = holdFreezeForOrder(db, {
    user,
    order: target,
    amount: target.freezeAmount,
    idempotencyKey: idempotencyKey || `preauth_hold:${target.id}`,
  });
  if (!held.ok) return held;
  target.status = "frozen";
  target.freezeId = held.entry.id;
  target.updatedAt = new Date().toISOString();
  appendResourceOrderEvent(db, {
    orderId: target.id,
    eventType: "frozen",
    eventPayload: {
      preauthAmount: target.freezeAmount,
      freezeAmount: target.freezeAmount,
      quoteAmount: target.quoteAmount,
      settlementMode: "preauth_then_t1_exact",
      ledgerEntryId: held.entry.id,
    },
    actorType: "portal",
    actorId: user.id,
    idempotencyKey: `event:frozen:${target.id}`,
  });
  return { ok: true, order: target, ledgerEntry: held.entry, snapshot: held.snapshot };
}

export function transitionResourceOrder(db, { orderId, status, actorType = "system", actorId = "", payload = {}, idempotencyKey = "" }) {
  ensureResourceOrderCollections(db);
  const target = db.resourceOrders.find((item) => item.id === orderId);
  if (!target) return { ok: false, status: 404, error: "resource_order_not_found" };
  const transitioned = transitionResourceOrderRecord(target, { status, payload });
  if (!transitioned.ok) return transitioned;
  appendResourceOrderEvent(db, {
    orderId: target.id,
    eventType: transitioned.nextStatus,
    eventPayload: payload,
    actorType,
    actorId,
    idempotencyKey: idempotencyKey || `event:${transitioned.nextStatus}:${target.id}:${payload.runId || ""}`,
  });
  return { ok: true, order: target };
}

export function releaseResourceOrder(db, { user, orderId, actorType = "runtime", actorId = "", payload = {}, idempotencyKey = "", releasePreauth = false }) {
  const target = db.resourceOrders.find((item) => item.id === orderId);
  if (!target) return { ok: false, status: 404, error: "resource_order_not_found" };
  const released = releasePreauth
    ? releaseFreezeForOrder(db, {
        user,
        order: target,
        amount: target.freezeAmount,
        idempotencyKey: idempotencyKey || `preauth_release:${target.id}`,
      })
    : { ok: true, releasedAmount: 0, skipped: true };
  const transitioned = transitionResourceOrder(db, {
    orderId,
    status: "released",
    actorType,
    actorId,
    payload: {
      ...payload,
      releasedAmount: released.releasedAmount,
      preauthReleaseDeferred: !releasePreauth,
      settlementMode: "preauth_then_t1_exact",
      pendingStoppedAt: payload.pendingStoppedAt || new Date().toISOString(),
    },
    idempotencyKey: `event:released:${target.id}`,
  });
  return { ...transitioned, releasedAmount: released.releasedAmount };
}

export function appendResourceOrderEvent(db, event) {
  ensureResourceOrderCollections(db);
  const normalized = normalizeResourceOrderEvent(event);
  if (!normalized) return null;
  if (normalized.idempotencyKey) {
    const existing = db.resourceOrderEvents.find((item) => item.idempotencyKey === normalized.idempotencyKey);
    if (existing) return existing;
  }
  db.resourceOrderEvents.push(normalized);
  return normalized;
}

export function resourceOrdersForUser(db, userId) {
  ensureResourceOrderCollections(db);
  return db.resourceOrders
    .filter((order) => order.userId === userId || order.tenantId === userId)
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

export function resourceOrderStopsPending(order = {}) {
  if (!order || typeof order !== "object") return false;
  if (String(order.pendingStoppedAt || "").trim()) return true;
  return RESOURCE_ORDER_PENDING_STOP_STATUSES.has(String(order.status || "").trim().toLowerCase());
}

export function findReusableResourceOrder(db, order = {}) {
  ensureResourceOrderCollections(db);
  const key = reusableResourceOrderKey(order);
  if (!key) return null;
  return db.resourceOrders
    .filter((item) => resourceOrderMatchesReusableKey(item, key))
    .sort(orderUpdatedDesc)[0] || null;
}

function reusableResourceOrderKey(order = {}) {
  const userId = String(order.userId || order.portalUserId || "").trim();
  const tenantId = String(order.tenantId || userId).trim();
  const workspaceId = String(order.workspaceId || "").trim();
  const runId = String(order.runId || "").trim();
  const serverPlanId = String(order.serverPlanId || "").trim();
  if (!workspaceId || !runId || !serverPlanId || (!userId && !tenantId)) return null;
  return { userId, tenantId, workspaceId, runId, serverPlanId };
}

function resourceOrderMatchesReusableKey(item = {}, key = {}) {
  return resourceOrderStatusReusable(item) &&
    !resourceOrderStopsPending(item) &&
    resourceOrderBusinessKeyMatches(item, key) &&
    resourceOrderOwnerMatches(item, key);
}

function resourceOrderStatusReusable(item = {}) {
  return RESOURCE_ORDER_REUSABLE_STATUSES.has(String(item.status || "").trim().toLowerCase());
}

function resourceOrderBusinessKeyMatches(item = {}, key = {}) {
  return String(item.workspaceId || "").trim() === key.workspaceId &&
    String(item.runId || "").trim() === key.runId &&
    String(item.serverPlanId || "").trim() === key.serverPlanId;
}

function resourceOrderOwnerMatches(item = {}, key = {}) {
  const itemUserId = String(item.userId || item.portalUserId || "").trim();
  const itemTenantId = String(item.tenantId || "").trim();
  return Boolean((key.userId && itemUserId === key.userId) || (key.tenantId && itemTenantId === key.tenantId));
}

function orderUpdatedDesc(a = {}, b = {}) {
  return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
}
