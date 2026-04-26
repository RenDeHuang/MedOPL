import { randomUUID } from "node:crypto";

export const LEDGER_TYPES = new Set([
  "topup",
  "freeze_hold",
  "freeze_release",
  "resource_charge",
  "refund",
  "makeup_charge",
  "adjustment",
]);

export function moneyAmount(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed * 100) / 100;
}

export function normalizeLedgerEntry(entry = {}) {
  const createdAt = String(entry.createdAt || entry.created_at || "").trim() || new Date().toISOString();
  const type = String(entry.type || "").trim() || "adjustment";
  return {
    id: String(entry.id || randomUUID()),
    tenantId: String(entry.tenantId || entry.tenant_id || entry.userId || entry.user_id || "").trim(),
    userId: String(entry.userId || entry.user_id || entry.tenantId || entry.tenant_id || "").trim(),
    workspaceId: String(entry.workspaceId || entry.workspace_id || "").trim(),
    runId: String(entry.runId || entry.run_id || "").trim(),
    orderId: String(entry.orderId || entry.order_id || "").trim(),
    type: LEDGER_TYPES.has(type) ? type : type,
    amount: moneyAmount(entry.amount, 0),
    currency: String(entry.currency || "CNY").trim() || "CNY",
    sourceType: String(entry.sourceType || entry.source_type || "").trim(),
    sourceId: String(entry.sourceId || entry.source_id || "").trim(),
    idempotencyKey: String(entry.idempotencyKey || entry.idempotency_key || "").trim(),
    reason: String(entry.reason || "").trim(),
    operatorId: String(entry.operatorId || entry.operator_id || "").trim(),
    createdAt,
  };
}

export function normalizeLedgerEntries(entries = []) {
  return (Array.isArray(entries) ? entries : []).map(normalizeLedgerEntry);
}

export function ensureWallet(db, userId) {
  db.wallets = Array.isArray(db.wallets) ? db.wallets : [];
  let wallet = db.wallets.find((item) => item.userId === userId);
  if (!wallet) {
    wallet = { userId, balance: 0, updatedAt: new Date().toISOString() };
    db.wallets.push(wallet);
  }
  wallet.balance = moneyAmount(wallet.balance, 0);
  return wallet;
}

export function appendLedgerEntry(db, entry) {
  db.ledger = normalizeLedgerEntries(db.ledger);
  const normalized = normalizeLedgerEntry(entry);
  if (normalized.idempotencyKey) {
    const existing = db.ledger.find((item) => item.idempotencyKey === normalized.idempotencyKey);
    if (existing) return { entry: existing, created: false };
  }
  db.ledger.push(normalized);
  return { entry: normalized, created: true };
}

export function trialRemainingForUser(user) {
  const entitlement = user?.preferences?.commercial?.trialEntitlement;
  if (!entitlement || entitlement.status !== "trial_active") return 0;
  if (entitlement.expiresAt && Date.parse(entitlement.expiresAt) <= Date.now()) return 0;
  return moneyAmount(entitlement.remainingCredit, 0);
}

export function activeFreezeByOrder(db, userId = "") {
  const entries = normalizeLedgerEntries(db?.ledger || [])
    .filter((entry) => !userId || entry.userId === userId || entry.tenantId === userId);
  const byOrder = new Map();
  for (const entry of entries) {
    if (!entry.orderId) continue;
    const current = byOrder.get(entry.orderId) || 0;
    if (entry.type === "freeze_hold") {
      byOrder.set(entry.orderId, moneyAmount(current + Math.abs(entry.amount)));
    } else if (entry.type === "freeze_release" || entry.type === "resource_charge") {
      byOrder.set(entry.orderId, moneyAmount(current - Math.abs(entry.amount)));
    }
  }
  for (const [orderId, amount] of byOrder.entries()) {
    byOrder.set(orderId, Math.max(0, moneyAmount(amount)));
  }
  return byOrder;
}

export function activeFreezeAmount(db, userId = "") {
  const byOrder = activeFreezeByOrder(db, userId);
  let total = 0;
  for (const amount of byOrder.values()) total += amount;
  return moneyAmount(total);
}

export function walletCommercialSnapshot(db, user) {
  const wallet = ensureWallet(db, user.id);
  const activeFreeze = activeFreezeAmount(db, user.id);
  const trialRemaining = trialRemainingForUser(user);
  return {
    wallet,
    walletBalance: moneyAmount(wallet.balance, 0),
    activeFreeze,
    trialRemaining,
    availableBalance: moneyAmount(wallet.balance - activeFreeze + trialRemaining, 0),
  };
}

export function holdFreezeForOrder(db, { user, order, amount, idempotencyKey = "", reason = "resource_order_freeze" }) {
  const freezeAmount = moneyAmount(amount, 0);
  if (!user?.id || !order?.id || freezeAmount <= 0) {
    return { ok: false, error: "invalid_freeze_request", status: 400 };
  }
  const snapshot = walletCommercialSnapshot(db, user);
  if (snapshot.availableBalance < freezeAmount) {
    return {
      ok: false,
      error: "insufficient_available_balance",
      status: 402,
      availableBalance: snapshot.availableBalance,
      freezeAmount,
    };
  }
  const result = appendLedgerEntry(db, {
    tenantId: user.id,
    userId: user.id,
    workspaceId: order.workspaceId,
    runId: order.runId || "",
    orderId: order.id,
    type: "freeze_hold",
    amount: freezeAmount,
    currency: order.currency || "CNY",
    sourceType: "quote",
    sourceId: order.quoteId || order.id,
    idempotencyKey: idempotencyKey || `freeze_hold:${order.id}`,
    reason,
    operatorId: user.id,
  });
  return { ok: true, entry: result.entry, created: result.created, snapshot: walletCommercialSnapshot(db, user) };
}

export function releaseFreezeForOrder(db, { user, order, amount, idempotencyKey = "", reason = "resource_order_release" }) {
  const byOrder = activeFreezeByOrder(db, user?.id || order?.tenantId || order?.userId || "");
  const activeAmount = byOrder.get(order.id) || 0;
  const releaseAmount = moneyAmount(Math.min(activeAmount, moneyAmount(amount, activeAmount)), 0);
  if (!order?.id || releaseAmount <= 0) {
    return { ok: true, releasedAmount: 0, skipped: true };
  }
  const result = appendLedgerEntry(db, {
    tenantId: order.tenantId || user?.id || order.userId || "",
    userId: order.userId || user?.id || "",
    workspaceId: order.workspaceId,
    runId: order.runId || "",
    orderId: order.id,
    type: "freeze_release",
    amount: releaseAmount,
    currency: order.currency || "CNY",
    sourceType: "resource_order",
    sourceId: order.id,
    idempotencyKey: idempotencyKey || `freeze_release:${order.id}`,
    reason,
    operatorId: user?.id || "system",
  });
  return { ok: true, releasedAmount: releaseAmount, entry: result.entry, created: result.created };
}

export function applyExactChargeForOrder(db, { user, order, exactCost, sourceId, idempotencyKey = "" }) {
  const chargeAmount = moneyAmount(exactCost, 0);
  if (!order?.id || chargeAmount < 0) {
    return { ok: false, error: "invalid_exact_charge", status: 400 };
  }
  const wallet = ensureWallet(db, order.userId || user?.id || "");
  wallet.balance = moneyAmount(wallet.balance - chargeAmount, 0);
  wallet.updatedAt = new Date().toISOString();
  const result = appendLedgerEntry(db, {
    tenantId: order.tenantId || user?.id || order.userId || "",
    userId: order.userId || user?.id || "",
    workspaceId: order.workspaceId,
    runId: order.runId || "",
    orderId: order.id,
    type: "resource_charge",
    amount: chargeAmount,
    currency: order.currency || "CNY",
    sourceType: "tencent_bill",
    sourceId,
    idempotencyKey: idempotencyKey || `resource_charge:${order.id}:${sourceId || "exact"}`,
    reason: "resource_order_exact_bill_settlement",
    operatorId: "billing-aggregator",
  });
  return { ok: true, chargedAmount: chargeAmount, entry: result.entry, wallet };
}
