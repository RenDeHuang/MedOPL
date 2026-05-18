import { randomUUID } from "node:crypto";
import { getLabPackage, normalizeLabPackageId } from "./lab-packages.mjs";
import { moneyAmount } from "./wallet-ledger.mjs";

export const LAB_SUBSCRIPTION_STATUSES = new Set(["active", "grace_period", "cleanup_queued", "cancelled"]);
const LAB_BUSINESS_MESSAGES = Object.freeze({
  invalid_lab_package_activation: "套餐开通失败：套餐不存在或用户无效。",
  lab_workspace_required: "套餐开通失败：缺少工作空间。",
  lab_subscription_not_found: "未找到已开通套餐，请先开通套餐。",
});

function ensureArrayProperty(target, key) {
  if (!Array.isArray(target[key])) target[key] = [];
}

function normalizeCollection(items, normalize) {
  return items.map(normalize).filter(Boolean);
}

export function ensureLabSubscriptionCollections(db) {
  ensureArrayProperty(db, "labSubscriptions");
  ensureArrayProperty(db, "labPackageEvents");
  ensureArrayProperty(db, "labStorageAddons");
  ensureArrayProperty(db, "labDailyCharges");
  db.labSubscriptions = normalizeCollection(db.labSubscriptions, normalizeLabSubscription);
  db.labPackageEvents = normalizeCollection(db.labPackageEvents, normalizeLabPackageEvent);
  db.labStorageAddons = normalizeCollection(db.labStorageAddons, normalizeLabStorageAddon);
  db.labDailyCharges = normalizeCollection(db.labDailyCharges, normalizeLabDailyCharge);
  return db;
}

export function normalizeLabSubscription(input = {}) {
  if (!input || typeof input !== "object") return null;
  const userId = String(input.userId || input.user_id || input.tenantId || input.tenant_id || "").trim();
  const workspaceId = String(input.workspaceId || input.workspace_id || "").trim();
  const packageId = normalizeLabPackageId(input.packageId || input.package_id || "");
  const labPackage = getLabPackage(packageId);
  if (!userId || !workspaceId || !labPackage) return null;
  const now = new Date().toISOString();
  const status = String(input.status || "active").trim().toLowerCase();
  return {
    id: String(input.id || randomUUID()).trim(),
    tenantId: String(input.tenantId || input.tenant_id || userId).trim() || userId,
    userId,
    workspaceId,
    packageId,
    status: LAB_SUBSCRIPTION_STATUSES.has(status) ? status : "active",
    computeTier: String(input.computeTier || input.compute_tier || labPackage.computeTier).trim() || labPackage.computeTier,
    includedStorageGb: Math.max(0, Number(input.includedStorageGb ?? input.included_storage_gb ?? labPackage.storage.includedGb)),
    dailyPrice: 0,
    weeklyFreezeAmount: 0,
    basePrice: null,
    pendingProductApproval: true,
    priceLabel: "正式售价未定价",
    currentFreezeId: String(input.currentFreezeId || input.current_freeze_id || "").trim(),
    graceStartedAt: String(input.graceStartedAt || input.grace_started_at || "").trim(),
    cleanupAfterAt: String(input.cleanupAfterAt || input.cleanup_after_at || "").trim(),
    backingServerPlanId: String(input.backingServerPlanId || input.backing_server_plan_id || labPackage.backingServerPlanId).trim() || labPackage.backingServerPlanId,
    idempotencyKey: String(input.idempotencyKey || input.idempotency_key || "").trim(),
    createdAt: String(input.createdAt || input.created_at || now).trim() || now,
    updatedAt: String(input.updatedAt || input.updated_at || input.createdAt || input.created_at || now).trim() || now,
  };
}

export function normalizeLabPackageEvent(input = {}) {
  if (!input || typeof input !== "object") return null;
  const subscriptionId = String(input.subscriptionId || input.subscription_id || "").trim();
  const eventType = String(input.eventType || input.event_type || "").trim();
  if (!subscriptionId || !eventType) return null;
  return {
    id: String(input.id || randomUUID()).trim(),
    subscriptionId,
    eventType,
    eventPayload: input.eventPayload || input.event_payload_json || {},
    actorType: String(input.actorType || input.actor_type || "system").trim() || "system",
    actorId: String(input.actorId || input.actor_id || "").trim(),
    idempotencyKey: String(input.idempotencyKey || input.idempotency_key || "").trim(),
    createdAt: String(input.createdAt || input.created_at || new Date().toISOString()).trim(),
  };
}

export function normalizeLabStorageAddon(input = {}) {
  if (!input || typeof input !== "object") return null;
  const subscriptionId = String(input.subscriptionId || input.subscription_id || "").trim();
  if (!subscriptionId) return null;
  const status = String(input.status || "active").trim().toLowerCase();
  return {
    id: String(input.id || randomUUID()).trim(),
    subscriptionId,
    storageGb: Math.max(0, Number(input.storageGb ?? input.storage_gb ?? 0)),
    dailyPrice: 0,
    basePrice: null,
    pendingProductApproval: true,
    priceLabel: "正式售价未定价",
    status: status === "cancelled" ? "cancelled" : "active",
    idempotencyKey: String(input.idempotencyKey || input.idempotency_key || "").trim(),
    createdAt: String(input.createdAt || input.created_at || new Date().toISOString()).trim(),
    updatedAt: String(input.updatedAt || input.updated_at || input.createdAt || input.created_at || new Date().toISOString()).trim(),
  };
}

export function normalizeLabDailyCharge(input = {}) {
  if (!input || typeof input !== "object") return null;
  const subscriptionId = String(input.subscriptionId || input.subscription_id || "").trim();
  const chargeDate = String(input.chargeDate || input.charge_date || "").trim();
  if (!subscriptionId || !chargeDate) return null;
  return {
    id: String(input.id || randomUUID()).trim(),
    subscriptionId,
    chargeDate,
    amount: moneyAmount(input.amount, 0),
    ledgerEntryId: String(input.ledgerEntryId || input.ledger_entry_id || "").trim(),
    idempotencyKey: String(input.idempotencyKey || input.idempotency_key || "").trim(),
    createdAt: String(input.createdAt || input.created_at || new Date().toISOString()).trim(),
  };
}

function activeSubscriptionForUser(db, userId, workspaceId = "") {
  ensureLabSubscriptionCollections(db);
  const eligible = db.labSubscriptions.filter((item) => subscriptionMatches(item, userId, workspaceId));
  return eligible
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0] || null;
}

function subscriptionMatches(item, userId, workspaceId = "") {
  const ownerMatches = item.userId === userId || item.tenantId === userId;
  const workspaceMatches = !workspaceId || item.workspaceId === workspaceId;
  return ownerMatches && workspaceMatches && item.status !== "cancelled";
}

export function currentLabSubscription(db, { user, workspaceId = "" } = {}) {
  return activeSubscriptionForUser(db, String(user?.id || ""), String(workspaceId || "").trim());
}

export function appendLabPackageEvent(db, event) {
  ensureLabSubscriptionCollections(db);
  const normalized = normalizeLabPackageEvent(event);
  if (!normalized) return null;
  if (normalized.idempotencyKey) {
    const existing = db.labPackageEvents.find((item) => item.idempotencyKey === normalized.idempotencyKey);
    if (existing) return existing;
  }
  db.labPackageEvents.push(normalized);
  return normalized;
}

export function activateLabSubscription(db, {
  user,
  workspaceId = "",
  packageId = "starter",
  idempotencyKey = "",
  now = new Date().toISOString(),
} = {}) {
  ensureLabSubscriptionCollections(db);
  const normalizedPackageId = normalizeLabPackageId(packageId);
  const labPackage = getLabPackage(normalizedPackageId);
  const userId = String(user?.id || "").trim();
  const targetWorkspaceId = String(workspaceId || "").trim();
  if (!targetWorkspaceId) return businessError("lab_workspace_required", 422);
  if (!userId || !labPackage) return businessError("invalid_lab_package_activation", 400);
  const key = String(idempotencyKey || `lab_subscription_activate:${userId}:${targetWorkspaceId}:${normalizedPackageId}`).trim();
  const idempotent = activationByEventKey(db, key);
  if (idempotent) return idempotent;
  const existing = activeSubscriptionForUser(db, userId, targetWorkspaceId);
  if (existing) {
    return activateExistingSubscription(db, { user, existing, packageId: normalizedPackageId, key, now, userId });
  }
  const subscription = createLabSubscriptionRecord({ user, userId, workspaceId: targetWorkspaceId, packageId: normalizedPackageId, key, now });
  db.labSubscriptions.push(subscription);
  const event = recordActivationEvent(db, { subscription, packageId: normalizedPackageId, workspaceId: targetWorkspaceId, key, now, userId });
  return { ok: true, created: true, subscription, event };
}

function activationByEventKey(db, key) {
  const event = db.labPackageEvents.find((item) => item.idempotencyKey === key);
  const subscription = event ? db.labSubscriptions.find((item) => item.id === event.subscriptionId) : null;
  return subscription ? { ok: true, created: false, subscription, event } : null;
}

function activateExistingSubscription(db, { user, existing, packageId, key, now, userId }) {
  if (existing.packageId === packageId) {
    const event = appendLabPackageEvent(db, {
      subscriptionId: existing.id,
      eventType: "activate_idempotent",
      eventPayload: { packageId },
      actorType: "user",
      actorId: userId,
      idempotencyKey: key,
      createdAt: now,
    });
    return { ok: true, created: false, subscription: existing, event };
  }
  return upgradeLabSubscription(db, {
    user,
    subscriptionId: existing.id,
    packageId,
    idempotencyKey: key,
    now,
    eventType: "activate_upgrade",
  });
}

function createLabSubscriptionRecord({ user, userId, workspaceId, packageId, key, now }) {
  return normalizeLabSubscription({
    tenantId: user.tenantId || userId,
    userId,
    workspaceId,
    packageId,
    idempotencyKey: key,
    createdAt: now,
    updatedAt: now,
  });
}

function recordActivationEvent(db, { subscription, packageId, workspaceId, key, now, userId }) {
  return appendLabPackageEvent(db, {
    subscriptionId: subscription.id,
    eventType: "activated",
    eventPayload: { packageId, workspaceId },
    actorType: "user",
    actorId: userId,
    idempotencyKey: key,
    createdAt: now,
  });
}

export function upgradeLabSubscription(db, {
  user,
  subscriptionId = "",
  packageId = "",
  idempotencyKey = "",
  now = new Date().toISOString(),
  eventType = "upgraded",
} = {}) {
  ensureLabSubscriptionCollections(db);
  const normalizedPackageId = normalizeLabPackageId(packageId);
  const labPackage = getLabPackage(normalizedPackageId);
  const userId = String(user?.id || "").trim();
  const target = db.labSubscriptions.find((item) => item.id === subscriptionId && item.userId === userId);
  if (!target || !labPackage) return businessError("lab_subscription_not_found", 404);
  const key = String(idempotencyKey || `lab_subscription_upgrade:${target.id}:${normalizedPackageId}`).trim();
  const existingEvent = db.labPackageEvents.find((item) => item.idempotencyKey === key);
  if (existingEvent) return { ok: true, created: false, subscription: target, event: existingEvent };
  const previousPackageId = target.packageId;
  applyPackageToSubscription(target, labPackage, now);
  const event = appendLabPackageEvent(db, {
    subscriptionId: target.id,
    eventType,
    eventPayload: { fromPackageId: previousPackageId, toPackageId: normalizedPackageId },
    actorType: "user",
    actorId: userId,
    idempotencyKey: key,
    createdAt: now,
  });
  return { ok: true, created: true, subscription: target, event };
}

function applyPackageToSubscription(target, labPackage, now) {
  target.packageId = labPackage.id;
  target.computeTier = labPackage.computeTier;
  target.includedStorageGb = labPackage.storage.includedGb;
  target.dailyPrice = 0;
  target.weeklyFreezeAmount = 0;
  target.basePrice = null;
  target.pendingProductApproval = true;
  target.priceLabel = "正式售价未定价";
  target.backingServerPlanId = labPackage.backingServerPlanId;
  target.status = "active";
  target.graceStartedAt = "";
  target.cleanupAfterAt = "";
  target.updatedAt = now;
}

export function labSubscriptionPublicView(subscription) {
  if (!subscription) return null;
  return {
    id: subscription.id,
    workspaceId: subscription.workspaceId,
    packageId: subscription.packageId,
    status: subscription.status,
    computeTier: subscription.computeTier,
    includedStorageGb: subscription.includedStorageGb,
    backingServerPlanId: subscription.backingServerPlanId,
    basePrice: null,
    pendingProductApproval: true,
    priceLabel: "正式售价未定价",
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

function businessError(error, status) {
  return {
    ok: false,
    status,
    error,
    businessMessage: LAB_BUSINESS_MESSAGES[error] || "套餐操作失败，请稍后重试。",
  };
}
