import { randomUUID } from "node:crypto";

const LEDGER_TYPES = new Set([
  "topup",
  "preauth_hold",
  "pending_usage",
  "exact_resource_charge",
  "preauth_release",
  "refund",
  "makeup_charge",
  "manual_adjustment",
]);

const LEDGER_TYPE_ALIASES = new Map([
  ["freeze_hold", "preauth_hold"],
  ["freeze_release", "preauth_release"],
  ["resource_charge", "exact_resource_charge"],
  ["adjustment", "manual_adjustment"],
]);

function moneyAmount(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed * 100) / 100;
}

function firstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function orderLedgerContext(user = {}, order = {}) {
  const userId = firstString(order.userId, user.id);
  const tenantId = firstString(order.tenantId, user.id, userId);
  return {
    tenantId,
    userId,
    workspaceId: firstString(order.workspaceId),
    runId: firstString(order.runId),
    resourceOrderId: firstString(order.id, order.resourceOrderId, order.orderId),
    resourceBindingId: firstString(order.resourceBindingId, order.resource_binding_id),
    billingAccountId: firstString(order.billingAccountId, tenantId, userId),
    currency: firstString(order.currency, "CNY"),
  };
}

export function normalizeLedgerEntry(entry = {}) {
  const rawType = firstString(entry.type, "manual_adjustment");
  const type = LEDGER_TYPE_ALIASES.get(rawType) || rawType;
  const resourceOrderId = firstString(entry.resourceOrderId, entry.resource_order_id, entry.orderId, entry.order_id);
  const billingAccountId = firstString(
    entry.billingAccountId,
    entry.billing_account_id,
    entry.userId,
    entry.user_id,
    entry.tenantId,
    entry.tenant_id,
  );
  return {
    id: firstString(entry.id, randomUUID()),
    tenantId: firstString(entry.tenantId, entry.tenant_id, entry.userId, entry.user_id),
    userId: firstString(entry.userId, entry.user_id, entry.tenantId, entry.tenant_id),
    workspaceId: firstString(entry.workspaceId, entry.workspace_id),
    runId: firstString(entry.runId, entry.run_id),
    resourceOrderId,
    orderId: resourceOrderId,
    resourceBindingId: firstString(entry.resourceBindingId, entry.resource_binding_id),
    billingAccountId,
    type: LEDGER_TYPES.has(type) ? type : "manual_adjustment",
    amount: moneyAmount(entry.amount, 0),
    currency: firstString(entry.currency, "CNY"),
    sourceType: firstString(entry.sourceType, entry.source_type, entry.source),
    sourceId: firstString(entry.sourceId, entry.source_id),
    idempotencyKey: firstString(entry.idempotencyKey, entry.idempotency_key),
    reason: firstString(entry.reason),
    operatorId: firstString(entry.operatorId, entry.operator_id),
    createdAt: firstString(entry.createdAt, entry.created_at, new Date().toISOString()),
  };
}

export function normalizeLedgerEntries(entries = []) {
  return (Array.isArray(entries) ? entries : []).map(normalizeLedgerEntry);
}

export function normalizeResourceOrder(order = {}) {
  const id = firstString(order.id, order.resourceOrderId, order.resource_order_id, order.orderId, order.order_id);
  if (!id) return null;
  const tenantId = firstString(order.tenantId, order.tenant_id, order.portalUserId, order.portal_user_id, order.userId, order.user_id);
  const userId = firstString(order.userId, order.user_id, order.portalUserId, order.portal_user_id, tenantId);
  return {
    id,
    tenantId,
    userId,
    portalUserId: firstString(order.portalUserId, order.portal_user_id, userId),
    workspaceId: firstString(order.workspaceId, order.workspace_id),
    workspaceSessionId: firstString(order.workspaceSessionId, order.workspace_session_id),
    runId: firstString(order.runId, order.run_id),
    billingAccountId: firstString(order.billingAccountId, order.billing_account_id, tenantId, userId),
    status: firstString(order.status, "reconciling"),
    serverPlanId: firstString(order.serverPlanId, order.server_plan_id),
    currency: firstString(order.currency, "CNY"),
    pricingSource: firstString(order.pricingSource, order.pricing_source),
    priceUpdatedAt: firstString(order.priceUpdatedAt, order.price_updated_at),
    createdAt: firstString(order.createdAt, order.created_at, new Date().toISOString()),
    updatedAt: firstString(order.updatedAt, order.updated_at, new Date().toISOString()),
    settledAt: firstString(order.settledAt, order.settled_at),
  };
}

function ensureWallet(db, userId) {
  db.wallets = Array.isArray(db.wallets) ? db.wallets : [];
  let wallet = db.wallets.find((item) => item.userId === userId);
  if (!wallet) {
    wallet = { userId, balance: 0, updatedAt: new Date().toISOString() };
    db.wallets.push(wallet);
  }
  wallet.balance = moneyAmount(wallet.balance, 0);
  return wallet;
}

function appendLedgerEntry(db, entry) {
  db.ledger = normalizeLedgerEntries(db.ledger);
  const normalized = normalizeLedgerEntry(entry);
  if (normalized.idempotencyKey) {
    const existing = db.ledger.find((item) => item.idempotencyKey === normalized.idempotencyKey);
    if (existing) return { entry: existing, created: false };
  }
  db.ledger.push(normalized);
  return { entry: normalized, created: true };
}

export function applyExactChargeForOrder(db, { user = {}, order = {}, exactCost, sourceId, idempotencyKey = "" } = {}) {
  const chargeAmount = moneyAmount(exactCost, 0);
  if (!order?.id || chargeAmount < 0) {
    return { ok: false, error: "invalid_exact_charge", status: 400 };
  }
  const chargeIdempotencyKey = idempotencyKey || `exact_resource_charge:${order.id}:${sourceId || "exact"}`;
  db.ledger = normalizeLedgerEntries(db.ledger);
  const existing = db.ledger.find((entry) => entry.idempotencyKey === chargeIdempotencyKey);
  const userId = firstString(order.userId, user.id);
  if (existing) {
    return { ok: true, chargedAmount: chargeAmount, entry: existing, wallet: ensureWallet(db, userId), created: false };
  }
  const wallet = ensureWallet(db, userId);
  wallet.balance = moneyAmount(wallet.balance - chargeAmount, 0);
  wallet.updatedAt = new Date().toISOString();
  const result = appendLedgerEntry(db, {
    ...orderLedgerContext(user, order),
    type: "exact_resource_charge",
    amount: chargeAmount,
    sourceType: "tencent_bill",
    sourceId,
    idempotencyKey: chargeIdempotencyKey,
    reason: "resource_order_exact_bill_settlement",
    operatorId: "billing-aggregator",
  });
  return { ok: true, chargedAmount: chargeAmount, entry: result.entry, wallet, created: result.created };
}

export function applySettlementAdjustmentForOrder(db, {
  user = {},
  order = {},
  type,
  amount,
  sourceId = "",
  idempotencyKey = "",
  reason = "resource_order_exact_bill_delta",
} = {}) {
  const normalizedType = LEDGER_TYPE_ALIASES.get(firstString(type)) || firstString(type);
  const adjustmentAmount = moneyAmount(amount, 0);
  if (!order?.id || adjustmentAmount <= 0 || !["refund", "makeup_charge"].includes(normalizedType)) {
    return { ok: false, error: "invalid_settlement_adjustment", status: 400 };
  }
  const adjustmentIdempotencyKey = idempotencyKey || `${normalizedType}:${order.id}:${sourceId || "delta"}:${adjustmentAmount.toFixed(2)}`;
  db.ledger = normalizeLedgerEntries(db.ledger);
  const existing = db.ledger.find((entry) => entry.idempotencyKey === adjustmentIdempotencyKey);
  const userId = firstString(order.userId, user.id);
  if (existing) {
    return { ok: true, amount: adjustmentAmount, entry: existing, wallet: ensureWallet(db, userId), created: false };
  }
  const wallet = ensureWallet(db, userId);
  wallet.balance = normalizedType === "refund"
    ? moneyAmount(wallet.balance + adjustmentAmount, 0)
    : moneyAmount(wallet.balance - adjustmentAmount, 0);
  wallet.updatedAt = new Date().toISOString();
  const result = appendLedgerEntry(db, {
    ...orderLedgerContext(user, order),
    type: normalizedType,
    amount: adjustmentAmount,
    sourceType: "auto_reconcile",
    sourceId: sourceId || order.runId || order.id,
    idempotencyKey: adjustmentIdempotencyKey,
    reason,
    operatorId: "billing-aggregator",
  });
  return { ok: true, amount: adjustmentAmount, entry: result.entry, wallet, created: result.created };
}
