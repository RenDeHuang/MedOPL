import { randomUUID } from "node:crypto";
import {
  holdFreezeForOrder,
  moneyAmount,
  normalizeLedgerEntries,
  releaseFreezeForOrder,
} from "./wallet-ledger.mjs";

const DEFAULT_PREAUTH_BUFFER_RATIO = 0.2;

export const RESOURCE_ORDER_STATUSES = new Set([
  "quoted",
  "frozen",
  "provisioning",
  "running",
  "released",
  "reconciling",
  "settled",
  "failed",
  "cancelled",
]);

export const RESOURCE_ORDER_PENDING_STOP_STATUSES = new Set([
  "released",
  "settled",
  "failed",
  "cancelled",
]);

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
  const id = String(order.id || randomUUID()).trim();
  const userId = String(order.userId || order.portalUserId || order.portal_user_id || order.tenantId || "").trim();
  const workspaceId = String(order.workspaceId || order.workspace_id || "").trim();
  const status = String(order.status || "quoted").trim().toLowerCase();
  const now = new Date().toISOString();
  if (!id || !userId || !workspaceId) return null;
  return {
    id,
    tenantId: String(order.tenantId || order.tenant_id || userId).trim() || userId,
    userId,
    portalUserId: String(order.portalUserId || order.portal_user_id || userId).trim() || userId,
    workspaceId,
    workspaceSessionId: String(order.workspaceSessionId || order.workspace_session_id || "").trim(),
    runId: String(order.runId || order.run_id || "").trim(),
    billingAccountId: String(order.billingAccountId || order.billing_account_id || userId).trim() || userId,
    status: RESOURCE_ORDER_STATUSES.has(status) ? status : "quoted",
    serverPlanId: String(order.serverPlanId || order.server_plan_id || "").trim(),
    region: String(order.region || "").trim(),
    zone: String(order.zone || "").trim(),
    cpu: Number(order.cpu || 0),
    memoryGb: Number(order.memoryGb || order.memory_gb || 0),
    gpuType: String(order.gpuType || order.gpu_type || "").trim(),
    gpuCount: Number(order.gpuCount || order.gpu_count || order.gpu || 0),
    storagePlanId: String(order.storagePlanId || order.storage_plan_id || "workspace-default").trim() || "workspace-default",
    storageSizeGb: Number(order.storageSizeGb ?? order.storage_size_gb ?? 0),
    retentionPolicy: String(order.retentionPolicy || order.retention_policy || "retain").trim() || "retain",
    estimatedHours: Number(order.estimatedHours || order.estimated_hours || 1),
    autoStopAt: String(order.autoStopAt || order.auto_stop_at || "").trim(),
    quoteId: String(order.quoteId || order.quote_id || "").trim(),
    freezeId: String(order.freezeId || order.freeze_id || "").trim(),
    provisionRequestId: String(order.provisionRequestId || order.provision_request_id || "").trim(),
    cloudResourceIds: normalizeCloudResourceIds(order.cloudResourceIds || order.cloud_resource_ids_json),
    currency: String(order.currency || "CNY").trim() || "CNY",
    unitPrice: moneyAmount(order.unitPrice ?? order.unit_price ?? 0, 0),
    minBillableHours: Number(order.minBillableHours || order.min_billable_hours || 1),
    riskFactor: Number(order.riskFactor || order.risk_factor || 1),
    quoteAmount: moneyAmount(order.quoteAmount ?? order.quote_amount ?? 0, 0),
    freezeAmount: moneyAmount(order.freezeAmount ?? order.freeze_amount ?? order.quoteAmount ?? order.quote_amount ?? 0, 0),
    exactCost: order.exactCost === undefined && order.exact_cost === undefined ? null : moneyAmount(order.exactCost ?? order.exact_cost, 0),
    pricingSource: String(order.pricingSource || order.pricing_source || "").trim(),
    priceUpdatedAt: String(order.priceUpdatedAt || order.price_updated_at || "").trim(),
    idempotencyKey: String(order.idempotencyKey || order.idempotency_key || "").trim(),
    createdAt: String(order.createdAt || order.created_at || now).trim() || now,
    updatedAt: String(order.updatedAt || order.updated_at || now).trim() || now,
    settledAt: String(order.settledAt || order.settled_at || "").trim(),
    pendingStoppedAt: String(order.pendingStoppedAt || order.pending_stopped_at || "").trim(),
    failedReason: String(order.failedReason || order.failed_reason || "").trim(),
  };
}

export function normalizeResourceOrderEvent(event = {}) {
  if (!event || typeof event !== "object") return null;
  const orderId = String(event.orderId || event.order_id || "").trim();
  const eventType = String(event.eventType || event.event_type || "").trim();
  if (!orderId || !eventType) return null;
  return {
    id: String(event.id || randomUUID()).trim(),
    orderId,
    eventType,
    eventPayload: normalizeObject(event.eventPayload || event.event_payload_json),
    actorType: String(event.actorType || event.actor_type || "system").trim() || "system",
    actorId: String(event.actorId || event.actor_id || "").trim(),
    idempotencyKey: String(event.idempotencyKey || event.idempotency_key || "").trim(),
    createdAt: String(event.createdAt || event.created_at || new Date().toISOString()).trim(),
  };
}

export function quoteResourceOrderFromPlan({ user, workspace, serverPlan, input = {}, idempotencyKey = "" }) {
  const estimatedHours = Math.max(1, Number(input.estimatedHours || input.estimated_hours || 1));
  const minBillableHours = Math.max(1, Number(serverPlan?.minBillableHours || serverPlan?.min_billable_hours || 1));
  const billableHours = Math.max(estimatedHours, minBillableHours);
  const unitPrice = moneyAmount(serverPlan?.discountPrice ?? serverPlan?.unitPrice ?? serverPlan?.hourlyPrice ?? 0, 0);
  const riskFactor = Math.max(1, Number(serverPlan?.riskFactor || 1));
  const preauthBufferRatio = resolvePreauthBufferRatio(serverPlan, input);
  const reservationFloor = moneyAmount(serverPlan?.reservationFloor || 0, 0);
  const quoteAmount = moneyAmount(Math.max(reservationFloor, unitPrice * billableHours * riskFactor), 0);
  const preauthAmount = moneyAmount(Math.max(quoteAmount, quoteAmount * (1 + preauthBufferRatio)), 0);
  const now = new Date().toISOString();
  const quoteId = `quote_${randomUUID()}`;
  return normalizeResourceOrder({
    id: String(input.orderId || randomUUID()),
    tenantId: user.id,
    userId: user.id,
    portalUserId: user.id,
    workspaceId: workspace.slug,
    workspaceSessionId: input.workspaceSessionId || "",
    runId: input.runId || "",
    billingAccountId: input.billingAccountId || user.id,
    status: "quoted",
    serverPlanId: serverPlan?.id || input.serverPlanId || "",
    region: serverPlan?.region || "",
    zone: serverPlan?.zone || "",
    cpu: serverPlan?.cpu || 0,
    memoryGb: serverPlan?.memoryGb || 0,
    gpuType: serverPlan?.gpuType || serverPlan?.gpuModel || "",
    gpuCount: serverPlan?.gpuCount ?? serverPlan?.gpu ?? 0,
    storagePlanId: input.storagePlanId || "workspace-default",
    storageSizeGb: Math.max(10, Number(input.storageSizeGb || parseStorageGi(serverPlan?.storageRequest || serverPlan?.storageLimit || "10Gi"))),
    retentionPolicy: input.retentionPolicy || "retain",
    estimatedHours,
    autoStopAt: input.autoStopAt || "",
    quoteId,
    currency: serverPlan?.currency || "CNY",
    unitPrice,
    minBillableHours,
    riskFactor,
    quoteAmount,
    freezeAmount: preauthAmount,
    pricingSource: serverPlan?.pricingSource || serverPlan?.source || serverPlan?.priceStatus || "billing_aggregator_quote",
    priceUpdatedAt: serverPlan?.priceUpdatedAt || serverPlan?.updatedAt || now,
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
  });
}

export function upsertQuotedResourceOrder(db, order) {
  ensureResourceOrderCollections(db);
  if (order.idempotencyKey) {
    const existing = db.resourceOrders.find((item) => item.idempotencyKey === order.idempotencyKey);
    if (existing) return { order: existing, created: false };
  }
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
  const nextStatus = String(status || "").trim().toLowerCase();
  if (!RESOURCE_ORDER_STATUSES.has(nextStatus)) {
    return { ok: false, status: 400, error: "invalid_resource_order_status" };
  }
  target.status = nextStatus;
  if (payload.runId) target.runId = String(payload.runId);
  if (payload.workspaceSessionId) target.workspaceSessionId = String(payload.workspaceSessionId);
  if (payload.billingAccountId) target.billingAccountId = String(payload.billingAccountId);
  if (payload.cloudResourceIds) target.cloudResourceIds = normalizeCloudResourceIds(payload.cloudResourceIds);
  if (nextStatus === "settled") target.settledAt = new Date().toISOString();
  if (RESOURCE_ORDER_PENDING_STOP_STATUSES.has(nextStatus)) {
    target.pendingStoppedAt = String(payload.pendingStoppedAt || payload.pending_stopped_at || new Date().toISOString());
  }
  if (nextStatus === "failed") target.failedReason = String(payload.reason || payload.error || "");
  target.updatedAt = new Date().toISOString();
  appendResourceOrderEvent(db, {
    orderId: target.id,
    eventType: nextStatus,
    eventPayload: payload,
    actorType,
    actorId,
    idempotencyKey: idempotencyKey || `event:${nextStatus}:${target.id}:${payload.runId || ""}`,
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

export function resourceOrderPublicView(order, events = []) {
  return {
    id: order.id,
    status: order.status,
    tenantId: order.tenantId,
    userId: order.userId,
    billingAccountId: order.billingAccountId,
    resourceOrderId: order.id,
    workspaceId: order.workspaceId,
    workspaceSessionId: order.workspaceSessionId,
    runId: order.runId,
    serverPlanId: order.serverPlanId,
    region: order.region,
    zone: order.zone,
    cpu: order.cpu,
    memoryGb: order.memoryGb,
    gpuType: order.gpuType,
    gpuCount: order.gpuCount,
    storagePlanId: order.storagePlanId,
    storageSizeGb: order.storageSizeGb,
    retentionPolicy: order.retentionPolicy,
    estimatedHours: order.estimatedHours,
    quoteId: order.quoteId,
    freezeId: order.freezeId,
    provisionRequestId: order.provisionRequestId,
    cloudResourceIds: order.cloudResourceIds,
    currency: order.currency,
    unitPrice: order.unitPrice,
    quotedAmount: order.quoteAmount,
    frozenAmount: order.freezeAmount,
    quoteAmount: order.quoteAmount,
    freezeAmount: order.freezeAmount,
    preauthAmount: order.freezeAmount,
    settlementMode: "preauth_then_t1_exact",
    settlementPolicy: {
      mode: "preauth_then_t1_exact",
      exactSource: "tencent_bill_detail_or_cos_daily_bill",
      pendingSource: "opencost_or_local_metering",
      releasePolicy: "release_unused_preauth_after_exact_bill",
    },
    exactCost: order.exactCost,
    pricingSource: order.pricingSource,
    priceUpdatedAt: order.priceUpdatedAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    settledAt: order.settledAt,
    pendingStoppedAt: order.pendingStoppedAt,
    failedReason: order.failedReason,
    events: events
      .filter((event) => event.orderId === order.id)
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || ""))),
  };
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

function normalizeObject(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return normalizeObject(JSON.parse(value));
    } catch {
      return {};
    }
  }
  if (typeof value !== "object" || Array.isArray(value)) return {};
  return { ...value };
}

function normalizeCloudResourceIds(value) {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      return normalizeCloudResourceIds(JSON.parse(value));
    } catch {
      return value ? [value] : [];
    }
  }
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).map((item) => String(item || "").trim()).filter(Boolean);
  return [];
}

function parseStorageGi(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/^([0-9.]+)\s*(gi|gib|gb|mi|mib|mb)?$/);
  if (!match) return 10;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return 10;
  const unit = match[2] || "gi";
  if (unit.startsWith("m")) return Math.max(10, Math.ceil(amount / 1024));
  return Math.max(10, Math.ceil(amount));
}

function resolvePreauthBufferRatio(serverPlan = {}, input = {}) {
  const candidates = [
    input.preauthBufferRatio,
    input.preauth_buffer_ratio,
    serverPlan.preauthBufferRatio,
    serverPlan.preauth_buffer_ratio,
    process.env.PORTAL_PREAUTH_BUFFER_RATIO,
    DEFAULT_PREAUTH_BUFFER_RATIO,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") continue;
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_PREAUTH_BUFFER_RATIO;
}
