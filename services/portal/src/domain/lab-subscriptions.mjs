import { randomUUID } from "node:crypto";
import { getLabPackage, normalizeCustomLabPackageSpec, normalizeLabPackageId } from "./lab-packages.mjs";
import { moneyAmount } from "./wallet-ledger.mjs";

export const LAB_SUBSCRIPTION_STATUSES = new Set(["active", "grace_period", "cleanup_queued", "cancelled"]);
export const LAB_STORAGE_ADDON_SIZES_GB = new Set([100, 500, 1024]);
const LAB_BUSINESS_MESSAGES = Object.freeze({
  invalid_lab_package_activation: "套餐开通失败：套餐不存在或用户无效。",
  invalid_custom_lab_package_spec: "自定义套餐失败：请选择有效的 CPU、内存和存储规格。",
  lab_subscription_not_found: "未找到已开通套餐，请先开通套餐。",
  unsupported_lab_storage_addon_size: "扩容失败：仅支持 100GB、500GB、1024GB 规格。",
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
  const workspaceId = String(input.workspaceId || input.workspace_id || "default").trim() || "default";
  const packageId = normalizeLabPackageId(input.packageId || input.package_id || "");
  const customSpec = packageId === "custom" ? normalizeCustomLabPackageSpec(input.customSpec || input.custom_spec || input.custom_spec_json || {}) : null;
  const labPackage = getLabPackage(packageId, customSpec || {});
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
    dailyPrice: moneyAmount(input.dailyPrice ?? input.daily_price ?? labPackage.billing.dailyPrice, labPackage.billing.dailyPrice),
    weeklyFreezeAmount: moneyAmount(input.weeklyFreezeAmount ?? input.weekly_freeze_amount ?? labPackage.billing.weeklyFreezeAmount, labPackage.billing.weeklyFreezeAmount),
    currentFreezeId: String(input.currentFreezeId || input.current_freeze_id || "").trim(),
    graceStartedAt: String(input.graceStartedAt || input.grace_started_at || "").trim(),
    cleanupAfterAt: String(input.cleanupAfterAt || input.cleanup_after_at || "").trim(),
    backingServerPlanId: String(input.backingServerPlanId || input.backing_server_plan_id || labPackage.backingServerPlanId).trim() || labPackage.backingServerPlanId,
    customSpec,
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
    dailyPrice: moneyAmount(input.dailyPrice ?? input.daily_price ?? 0, 0),
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
  workspaceId = "default",
  packageId = "starter",
  customSpec = null,
  idempotencyKey = "",
  now = new Date().toISOString(),
} = {}) {
  ensureLabSubscriptionCollections(db);
  const normalizedPackageId = normalizeLabPackageId(packageId);
  const normalizedCustomSpec = normalizedPackageId === "custom" ? normalizeCustomLabPackageSpec(customSpec || {}) : null;
  if (normalizedPackageId === "custom" && !normalizedCustomSpec) return businessError("invalid_custom_lab_package_spec", 400);
  const labPackage = getLabPackage(normalizedPackageId, normalizedCustomSpec || {});
  const userId = String(user?.id || "").trim();
  if (!userId || !labPackage) return businessError("invalid_lab_package_activation", 400);
  const key = String(idempotencyKey || `lab_subscription_activate:${userId}:${workspaceId}:${normalizedPackageId}`).trim();
  const idempotent = activationByEventKey(db, key);
  if (idempotent) return idempotent;
  const existing = activeSubscriptionForUser(db, userId, workspaceId);
  if (existing) {
    return activateExistingSubscription(db, { user, existing, packageId: normalizedPackageId, customSpec: normalizedCustomSpec, key, now, userId });
  }
  const subscription = createLabSubscriptionRecord({ user, userId, workspaceId, packageId: normalizedPackageId, customSpec: normalizedCustomSpec, key, now });
  db.labSubscriptions.push(subscription);
  const event = recordActivationEvent(db, { subscription, packageId: normalizedPackageId, customSpec: normalizedCustomSpec, workspaceId, key, now, userId });
  return { ok: true, created: true, subscription, event };
}

function activationByEventKey(db, key) {
  const event = db.labPackageEvents.find((item) => item.idempotencyKey === key);
  const subscription = event ? db.labSubscriptions.find((item) => item.id === event.subscriptionId) : null;
  return subscription ? { ok: true, created: false, subscription, event } : null;
}

function activateExistingSubscription(db, { user, existing, packageId, customSpec = null, key, now, userId }) {
  if (existing.packageId === packageId) {
    const event = appendLabPackageEvent(db, {
      subscriptionId: existing.id,
      eventType: "activate_idempotent",
      eventPayload: { packageId, customSpec },
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
    customSpec,
    idempotencyKey: key,
    now,
    eventType: "activate_upgrade",
  });
}

function createLabSubscriptionRecord({ user, userId, workspaceId, packageId, customSpec = null, key, now }) {
  return normalizeLabSubscription({
    tenantId: user.tenantId || userId,
    userId,
    workspaceId,
    packageId,
    customSpec,
    idempotencyKey: key,
    createdAt: now,
    updatedAt: now,
  });
}

function recordActivationEvent(db, { subscription, packageId, customSpec = null, workspaceId, key, now, userId }) {
  return appendLabPackageEvent(db, {
    subscriptionId: subscription.id,
    eventType: "activated",
    eventPayload: { packageId, customSpec, workspaceId },
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
  customSpec = null,
  idempotencyKey = "",
  now = new Date().toISOString(),
  eventType = "upgraded",
} = {}) {
  ensureLabSubscriptionCollections(db);
  const normalizedPackageId = normalizeLabPackageId(packageId);
  const normalizedCustomSpec = normalizedPackageId === "custom" ? normalizeCustomLabPackageSpec(customSpec || {}) : null;
  if (normalizedPackageId === "custom" && !normalizedCustomSpec) return businessError("invalid_custom_lab_package_spec", 400);
  const labPackage = getLabPackage(normalizedPackageId, normalizedCustomSpec || {});
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
    eventPayload: { fromPackageId: previousPackageId, toPackageId: normalizedPackageId, customSpec: normalizedCustomSpec },
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
  target.dailyPrice = labPackage.billing.dailyPrice;
  target.weeklyFreezeAmount = labPackage.billing.weeklyFreezeAmount;
  target.backingServerPlanId = labPackage.backingServerPlanId;
  target.customSpec = labPackage.customSpec ? { ...labPackage.customSpec } : null;
  target.status = "active";
  target.graceStartedAt = "";
  target.cleanupAfterAt = "";
  target.updatedAt = now;
}

export function purchaseLabStorageAddon(db, {
  user,
  subscriptionId = "",
  storageGb = 100,
  idempotencyKey = "",
  now = new Date().toISOString(),
} = {}) {
  ensureLabSubscriptionCollections(db);
  const userId = String(user?.id || "").trim();
  const target = db.labSubscriptions.find((item) => item.id === subscriptionId && item.userId === userId);
  const size = Number(storageGb || 0);
  if (!target) return businessError("lab_subscription_not_found", 404);
  if (!LAB_STORAGE_ADDON_SIZES_GB.has(size)) return businessError("unsupported_lab_storage_addon_size", 400);
  const key = String(idempotencyKey || `lab_storage_addon:${target.id}:${size}`).trim();
  const existing = db.labStorageAddons.find((item) => item.idempotencyKey === key);
  if (existing) return { ok: true, created: false, addon: existing, subscription: target };
  const addon = normalizeLabStorageAddon({
    subscriptionId: target.id,
    storageGb: size,
    dailyPrice: storageAddonDailyPrice(size),
    idempotencyKey: key,
    createdAt: now,
    updatedAt: now,
  });
  db.labStorageAddons.push(addon);
  appendLabPackageEvent(db, {
    subscriptionId: target.id,
    eventType: "storage_addon_purchased",
    eventPayload: { storageGb: size, dailyPrice: addon.dailyPrice },
    actorType: "user",
    actorId: userId,
    idempotencyKey: `event:${key}`,
    createdAt: now,
  });
  return { ok: true, created: true, addon, subscription: target };
}

export function storageAddonDailyPrice(storageGb) {
  return new Map([[100, 3], [500, 12], [1024, 20]]).get(Number(storageGb)) || 0;
}

export function labSubscriptionPublicView(subscription) {
  if (!subscription) return null;
  return { ...subscription };
}

function businessError(error, status) {
  return {
    ok: false,
    status,
    error,
    businessMessage: LAB_BUSINESS_MESSAGES[error] || "套餐操作失败，请稍后重试。",
  };
}
