import { appendLedgerEntry, ensureWallet, moneyAmount } from "./wallet-ledger.mjs";
import { appendLabPackageEvent, ensureLabSubscriptionCollections, normalizeLabDailyCharge } from "./lab-subscriptions.mjs";

const GRACE_DAYS = 7;

function text(value = "") {
  return String(value ?? "").trim();
}

function cents(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

export function evaluateBillingRisk({
  balanceCents = 0,
  frozenWeeklyAmountCents = 0,
  nextPaidActionCents = 0,
  existingOutputs = false,
} = {}) {
  const balance = cents(balanceCents);
  const frozen = cents(frozenWeeklyAmountCents);
  const nextPaidAction = cents(nextPaidActionCents);
  const availableAfterFreeze = Math.max(0, balance - frozen);
  if (balance > frozen && (nextPaidAction <= 0 || availableAfterFreeze >= nextPaidAction)) {
    return {
      status: "healthy",
      severity: "ok",
      copy: "余额充足，可以继续运行任务。",
      requiredRechargeCents: 0,
      canStartNewPaidWork: true,
      canDownloadExistingOutputs: true,
    };
  }
  if (balance >= frozen && frozen > 0) {
    return {
      status: "low_available_balance_freeze_covers_current_week",
      severity: "warning",
      copy: "当前余额偏低，但本周服务还能继续。建议充值，避免下周无法继续运行或启动新任务。",
      requiredRechargeCents: Math.max(nextPaidAction, frozen),
      canStartNewPaidWork: false,
      canDownloadExistingOutputs: true,
    };
  }
  if (balance + frozen > 0 && balance + frozen < nextPaidAction) {
    return {
      status: "insufficient_for_next_paid_action",
      severity: "blocked",
      copy: "当前余额不足以启动新的付费任务，请先充值。已有结果仍可下载。",
      requiredRechargeCents: Math.max(0, nextPaidAction - balance - frozen),
      canStartNewPaidWork: false,
      canDownloadExistingOutputs: true,
    };
  }
  if (existingOutputs) {
    return {
      status: "grace_download_only",
      severity: "blocked",
      copy: "当前只能下载已有结果，不能启动新的付费任务。请充值后继续使用。",
      requiredRechargeCents: Math.max(nextPaidAction, frozen),
      canStartNewPaidWork: false,
      canDownloadExistingOutputs: true,
    };
  }
  return {
    status: "suspended",
    severity: "blocked",
    copy: "当前余额不足，服务已暂停。请充值后继续使用。",
    requiredRechargeCents: Math.max(nextPaidAction, frozen),
    canStartNewPaidWork: false,
    canDownloadExistingOutputs: false,
  };
}

function subscriptionContext(user, subscription = {}) {
  const userId = text(subscription.userId || user?.id);
  const tenantId = text(subscription.tenantId || user?.tenantId || userId) || userId;
  const resourceBindingId = text(subscription.resourceBindingId || subscription.resource_binding_id);
  const billingAttributionId = text(subscription.billingAttributionId || subscription.billing_attribution_id || resourceBindingId || subscription.id);
  const accountId = text(subscription.accountId || subscription.account_id || subscription.billingAccountId || subscription.billing_account_id || userId);
  const serverPlanId = text(subscription.serverPlanId || subscription.server_plan_id || subscription.packageId || subscription.package_id);
  return {
    tenantId,
    userId,
    accountId,
    workspaceId: subscription.workspaceId || "default",
    runId: "",
    resourceBindingId,
    billingAttributionId,
    legacyResourceOrderId: text(subscription.legacyResourceOrderId || subscription.legacy_resource_order_id),
    serverPlanId,
    billingAccountId: tenantId,
    currency: "CNY",
  };
}

function cleanupAfter(now) {
  return new Date(Date.parse(now) + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function labActiveFreezeAmount(db, subscriptionId = "") {
  const entries = Array.isArray(db.ledger) ? db.ledger : [];
  return moneyAmount(entries
    .filter((entry) => labFreezeEntryMatches(entry, subscriptionId))
    .reduce((sum, entry) => sum + labFreezeEntryDelta(entry), 0), 0);
}

function labFreezeEntryMatches(entry, subscriptionId = "") {
  return entry.sourceType === "lab_subscription" && (!subscriptionId || entry.sourceId === subscriptionId);
}

function labFreezeEntryDelta(entry) {
  const amount = Math.abs(Number(entry.amount || 0));
  const deltas = {
    subscription_weekly_freeze: amount,
    subscription_freeze_release: -amount,
    subscription_daily_charge: -amount,
  };
  return deltas[entry.type] || 0;
}

export function ensureLabWeeklyFreeze(db, {
  user,
  subscription,
  idempotencyKey = "",
  now = new Date().toISOString(),
} = {}) {
  ensureLabSubscriptionCollections(db);
  const amount = moneyAmount(subscription?.weeklyFreezeAmount, 0);
  if (!subscription?.id || amount <= 0) return { ok: false, status: 400, error: "invalid_lab_weekly_freeze" };
  const wallet = ensureWallet(db, subscription.userId || user?.id || "");
  const key = String(idempotencyKey || `subscription_weekly_freeze:${subscription.id}:${now.slice(0, 10)}`).trim();
  const existing = (Array.isArray(db.ledger) ? db.ledger : []).find((entry) => entry.idempotencyKey === key);
  if (existing) return { ok: true, created: false, entry: existing, wallet };
  if (Number(wallet.balance || 0) < amount) {
    return failLabBillingBalance(db, { user, subscription, now, amount, wallet, error: "insufficient_balance_for_weekly_freeze", reason: "weekly_freeze_insufficient_balance" });
  }
  const result = appendSubscriptionLedgerEntry(db, { user, subscription, amount, key, type: "subscription_weekly_freeze", reason: "lab_package_weekly_freeze", operatorId: user?.id || "system", now });
  subscription.currentFreezeId = result.entry.id;
  subscription.updatedAt = now;
  recordWeeklyFreezeEvent(db, { subscription, amount, ledgerEntryId: result.entry.id, key, now });
  return { ok: true, created: result.created, entry: result.entry, wallet };
}

function failLabBillingBalance(db, { user, subscription, now, amount, wallet, error, reason }) {
  markGracePeriod(db, { user, subscription, now, reason });
  return { ok: false, status: 402, error, requiredAmount: amount, balance: Number(wallet.balance || 0) };
}

function appendSubscriptionLedgerEntry(db, { user, subscription, amount, key, type, reason, operatorId, now }) {
  return appendLedgerEntry(db, {
    ...subscriptionContext(user, subscription),
    type,
    amount,
    sourceType: "lab_subscription",
    sourceId: subscription.id,
    idempotencyKey: key,
    reason,
    operatorId,
    createdAt: now,
  });
}

function recordWeeklyFreezeEvent(db, { subscription, amount, ledgerEntryId, key, now }) {
  appendLabPackageEvent(db, {
    subscriptionId: subscription.id,
    eventType: "weekly_freeze",
    eventPayload: { amount, ledgerEntryId },
    actorType: "system",
    actorId: "lab-billing-policy",
    idempotencyKey: `event:${key}`,
    createdAt: now,
  });
}

export function applyLabDailyCharge(db, {
  user,
  subscription,
  chargeDate = new Date().toISOString().slice(0, 10),
  now = new Date().toISOString(),
} = {}) {
  ensureLabSubscriptionCollections(db);
  const amount = moneyAmount(subscription?.dailyPrice, 0);
  if (!subscription?.id || amount <= 0) return { ok: false, status: 400, error: "invalid_lab_daily_charge" };
  const key = `subscription_daily_charge:${subscription.id}:${chargeDate}`;
  const existingRecord = db.labDailyCharges.find((item) => item.idempotencyKey === key);
  if (existingRecord) {
    const entry = (Array.isArray(db.ledger) ? db.ledger : []).find((item) => item.id === existingRecord.ledgerEntryId) || null;
    return { ok: true, created: false, charge: existingRecord, entry };
  }
  const wallet = ensureWallet(db, subscription.userId || user?.id || "");
  if (Number(wallet.balance || 0) < amount) {
    return failLabBillingBalance(db, { user, subscription, now, amount, wallet, error: "insufficient_balance_for_daily_charge", reason: "daily_charge_insufficient_balance" });
  }
  wallet.balance = moneyAmount(Number(wallet.balance || 0) - amount, 0);
  wallet.updatedAt = now;
  const result = appendSubscriptionLedgerEntry(db, { user, subscription, amount, key, type: "subscription_daily_charge", reason: "lab_package_daily_charge", operatorId: "lab-billing-policy", now });
  const charge = createLabDailyChargeRecord({ subscription, chargeDate, amount, ledgerEntryId: result.entry.id, key, now });
  db.labDailyCharges.push(charge);
  return { ok: true, created: true, charge, entry: result.entry, wallet };
}

function createLabDailyChargeRecord({ subscription, chargeDate, amount, ledgerEntryId, key, now }) {
  return normalizeLabDailyCharge({
    subscriptionId: subscription.id,
    chargeDate,
    amount,
    ledgerEntryId,
    idempotencyKey: key,
    createdAt: now,
  });
}

export function markGracePeriod(db, {
  user,
  subscription,
  now = new Date().toISOString(),
  reason = "balance_policy",
} = {}) {
  if (!subscription?.id) return null;
  subscription.status = "grace_period";
  subscription.graceStartedAt = subscription.graceStartedAt || now;
  subscription.cleanupAfterAt = subscription.cleanupAfterAt || cleanupAfter(now);
  subscription.updatedAt = now;
  appendLabPackageEvent(db, {
    subscriptionId: subscription.id,
    eventType: "grace_period_started",
    eventPayload: { reason, cleanupAfterAt: subscription.cleanupAfterAt },
    actorType: "system",
    actorId: user?.id || "lab-billing-policy",
    idempotencyKey: `event:grace_period_started:${subscription.id}:${subscription.graceStartedAt}`,
    createdAt: now,
  });
  return subscription;
}

export function evaluateLabBalanceStatus(db, {
  user,
  subscription,
  now = new Date().toISOString(),
} = {}) {
  const wallet = ensureWallet(db, subscription?.userId || user?.id || "");
  if (!subscription) {
    return { status: "disabled", canUpload: false, canRun: false, canDownload: true, walletBalance: Number(wallet.balance || 0) };
  }
  if (subscription.status === "cleanup_queued") {
    return { status: "cleanup_queued", canUpload: false, canRun: false, canDownload: false, cleanupAfterAt: subscription.cleanupAfterAt, walletBalance: Number(wallet.balance || 0) };
  }
  const requiredAmount = moneyAmount(subscription.weeklyFreezeAmount, 0);
  const walletBalance = Number(wallet.balance || 0);
  if (subscription.status === "grace_period" || walletBalance < requiredAmount) {
    return evaluateGraceState(db, { user, subscription, now, walletBalance, requiredAmount });
  }
  if (walletBalance < requiredAmount * 2) {
    return { status: "low_balance", canUpload: true, canRun: true, canDownload: true, walletBalance, requiredAmount };
  }
  return { status: "normal", canUpload: true, canRun: true, canDownload: true, walletBalance, requiredAmount };
}

function evaluateGraceState(db, { user, subscription, now, walletBalance, requiredAmount }) {
  markGracePeriod(db, { user, subscription, now, reason: "weekly_balance_not_covered" });
  if (Date.parse(subscription.cleanupAfterAt || "") <= Date.parse(now)) {
    subscription.status = "cleanup_queued";
    subscription.updatedAt = now;
    return { status: "cleanup_queued", canUpload: false, canRun: false, canDownload: false, cleanupAfterAt: subscription.cleanupAfterAt, walletBalance, requiredAmount };
  }
  return { status: "grace_period", canUpload: false, canRun: false, canDownload: true, graceStartedAt: subscription.graceStartedAt, cleanupAfterAt: subscription.cleanupAfterAt, walletBalance, requiredAmount };
}
