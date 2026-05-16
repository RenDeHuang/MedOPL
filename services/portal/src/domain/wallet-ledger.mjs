import { randomUUID } from "node:crypto";

export const LEDGER_TYPES = new Set([
  "topup",
  "preauth_hold",
  "pending_usage",
  "exact_resource_charge",
  "preauth_release",
  "subscription_weekly_freeze",
  "subscription_daily_charge",
  "subscription_freeze_release",
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

const PREAUTH_HOLD_TYPES = new Set(["preauth_hold"]);
const PREAUTH_RELEASE_TYPES = new Set(["preauth_release"]);
const PREAUTH_SETTLEMENT_TYPES = new Set(["exact_resource_charge", "makeup_charge"]);

function text(value = "") {
  return String(value ?? "").trim();
}

function resourceBindingIdFrom(record = {}) {
  return text(record.resourceBindingId || record.resource_binding_id || record.bindingId || record.binding_id);
}

function billingAttributionIdFrom(record = {}, resourceBindingId = "") {
  return text(record.billingAttributionId || record.billing_attribution_id || resourceBindingId);
}

function accountIdFrom(record = {}, user = {}) {
  return text(record.accountId || record.account_id || record.billingAccountId || record.billing_account_id || record.userId || record.user_id || user?.id);
}

function serverPlanIdFrom(record = {}) {
  return text(record.serverPlanId || record.server_plan_id || record.planId || record.plan_id || record.packageId || record.package_id);
}

function orderLedgerContext(user, order = {}) {
  const userId = text(order.userId || user?.id);
  const tenantId = text(order.tenantId || user?.tenantId || userId) || userId;
  const resourceBindingId = resourceBindingIdFrom(order);
  const billingAttributionId = billingAttributionIdFrom(order, resourceBindingId);
  const accountId = accountIdFrom(order, user) || tenantId || userId;
  return {
    tenantId,
    userId,
    accountId,
    workspaceId: text(order.workspaceId || order.workspace_id),
    runId: text(order.runId || order.run_id),
    resourceBindingId,
    billingAttributionId,
    billingAccountId: text(order.billingAccountId || order.billing_account_id || accountId || tenantId || userId),
    serverPlanId: serverPlanIdFrom(order),
    currency: order.currency || "CNY",
  };
}

export function moneyAmount(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed * 100) / 100;
}

function toCents(value = 0) {
  return Math.round(moneyAmount(value, 0) * 100);
}

function ledgerBelongsToUser(entry, user = {}) {
  const userId = String(user?.id || "").trim();
  const tenantId = String(user?.tenantId || userId).trim();
  return entry.userId === userId || entry.tenantId === tenantId || entry.billingAccountId === tenantId || entry.billingAccountId === userId;
}

function isSameMonth(iso = "", now = new Date().toISOString()) {
  return String(iso || "").slice(0, 7) === String(now || "").slice(0, 7);
}

function isSameDay(iso = "", now = new Date().toISOString()) {
  return String(iso || "").slice(0, 10) === String(now || "").slice(0, 10);
}

const SPEND_TYPES = new Set(["subscription_daily_charge", "pending_usage", "exact_resource_charge", "makeup_charge"]);
const RECHARGE_TYPES = new Set(["topup"]);
const SUBSCRIPTION_FREEZE_TYPES = new Set(["subscription_weekly_freeze", "subscription_daily_charge", "subscription_freeze_release"]);

function activeSubscriptionFreezeCents(entries = []) {
  return toCents(entries
    .filter((entry) => SUBSCRIPTION_FREEZE_TYPES.has(entry.type))
    .reduce((sum, entry) => {
      const amount = Math.abs(Number(entry.amount || 0));
      if (entry.type === "subscription_weekly_freeze") return sum + amount;
      return sum - amount;
    }, 0));
}

function walletRiskContext({ balanceCents, frozenWeeklyAmountCents, nextPaidActionCents = 0, existingOutputs = false }) {
  return {
    balanceCents,
    frozenWeeklyAmountCents,
    nextPaidActionCents,
    existingOutputs,
    availableAfterFreeze: Math.max(0, balanceCents - frozenWeeklyAmountCents),
    coverageCents: balanceCents + frozenWeeklyAmountCents,
  };
}

function isHealthyWalletRisk(context) {
  return context.balanceCents > context.frozenWeeklyAmountCents
    && (context.nextPaidActionCents <= 0 || context.availableAfterFreeze >= context.nextPaidActionCents);
}

function isLowBalanceFreezeCovered(context) {
  return context.balanceCents >= context.frozenWeeklyAmountCents && context.frozenWeeklyAmountCents > 0;
}

function isInsufficientForNextAction(context) {
  return context.coverageCents > 0 && context.coverageCents < context.nextPaidActionCents;
}

function walletRechargeFloor(context) {
  return Math.max(context.nextPaidActionCents, context.frozenWeeklyAmountCents);
}

function healthyWalletRisk() {
  return {
    status: "healthy",
    severity: "ok",
    copy: "余额充足，可以继续运行任务。",
    requiredRechargeCents: 0,
    canStartNewPaidWork: true,
    canDownloadExistingOutputs: true,
  };
}

function lowBalanceWalletRisk(context) {
  return {
    status: "low_available_balance_freeze_covers_current_week",
    severity: "warning",
    copy: "当前余额偏低，但本周服务还能继续。建议充值，避免下周无法继续运行或启动新任务。",
    requiredRechargeCents: walletRechargeFloor(context),
    canStartNewPaidWork: false,
    canDownloadExistingOutputs: true,
  };
}

function insufficientWalletRisk(context) {
  return {
    status: "insufficient_for_next_paid_action",
    severity: "blocked",
    copy: "当前余额不足以启动新的付费任务，请先充值。已有结果仍可下载。",
    requiredRechargeCents: Math.max(0, context.nextPaidActionCents - context.coverageCents),
    canStartNewPaidWork: false,
    canDownloadExistingOutputs: true,
  };
}

function downloadOnlyWalletRisk(context) {
  return {
    status: "grace_download_only",
    severity: "blocked",
    copy: "当前只能下载已有结果，不能启动新的付费任务。请充值后继续使用。",
    requiredRechargeCents: walletRechargeFloor(context),
    canStartNewPaidWork: false,
    canDownloadExistingOutputs: true,
  };
}

function suspendedWalletRisk(context) {
  return {
    status: "suspended",
    severity: "blocked",
    copy: "当前余额不足，服务已暂停。请充值后继续使用。",
    requiredRechargeCents: walletRechargeFloor(context),
    canStartNewPaidWork: false,
    canDownloadExistingOutputs: false,
  };
}

const WALLET_RISK_CASES = [
  [isHealthyWalletRisk, healthyWalletRisk],
  [isLowBalanceFreezeCovered, lowBalanceWalletRisk],
  [isInsufficientForNextAction, insufficientWalletRisk],
  [(context) => context.existingOutputs, downloadOnlyWalletRisk],
];

function evaluateWalletRisk(input) {
  const context = walletRiskContext(input);
  const [, buildRisk = suspendedWalletRisk] = WALLET_RISK_CASES.find(([matches]) => matches(context)) || [];
  return buildRisk(context);
}

function ledgerEntriesForUser(db, user) {
  return normalizeLedgerEntries(db?.ledger || []).filter((entry) => ledgerBelongsToUser(entry, user));
}

function entriesOfTypes(entries = [], types = new Set()) {
  return entries.filter((entry) => types.has(entry.type));
}

function sumEntryCents(entries = []) {
  return entries.reduce((sum, entry) => sum + toCents(entry.amount), 0);
}

function pendingUsageSummary(entry = {}) {
  return {
    id: entry.id,
    resourceBindingId: entry.resourceBindingId,
    billingAttributionId: entry.billingAttributionId,
    workspaceId: entry.workspaceId,
    accountId: entry.accountId,
    serverPlanId: entry.serverPlanId,
    runId: entry.runId,
    plainType: "运行中预扣",
    copy: "这次任务正在按运行中费用预扣，最终金额会在 T+1 账单回来后校准。",
    amountCents: toCents(entry.amount),
    status: "waiting_exact_bill",
    createdAt: entry.createdAt,
  };
}

function exactSettlementSummary(pending = []) {
  return {
    status: pending.length > 0 ? "waiting_t_plus_1" : "settled_or_no_pending",
    copy: pending.length > 0 ? "最终金额会在腾讯云 T+1 账单回来后校准。" : "当前没有等待 T+1 校准的运行费用。",
  };
}

export function buildUserBillingSummary(db, {
  user,
  now = new Date().toISOString(),
  nextPaidActionCents = 0,
} = {}) {
  const normalizedEntries = ledgerEntriesForUser(db, user);
  const wallet = ensureWallet(db, user?.id || "");
  const balanceCents = toCents(wallet.balance);
  const frozenWeeklyAmountCents = Math.max(0, activeSubscriptionFreezeCents(normalizedEntries));
  const spendEntries = entriesOfTypes(normalizedEntries, SPEND_TYPES);
  const rechargeEntries = entriesOfTypes(normalizedEntries, RECHARGE_TYPES);
  const todaySpendCents = sumEntryCents(spendEntries.filter((entry) => isSameDay(entry.createdAt, now)));
  const monthSpendCents = sumEntryCents(spendEntries.filter((entry) => isSameMonth(entry.createdAt, now)));
  const totalSpendCents = sumEntryCents(spendEntries);
  const rechargeTotalCents = sumEntryCents(rechargeEntries);
  const pending = entriesOfTypes(normalizedEntries, new Set(["pending_usage"])).map(pendingUsageSummary);
  return {
    balanceCents,
    availableBalanceCents: Math.max(0, balanceCents - frozenWeeklyAmountCents),
    frozenWeeklyAmountCents,
    todaySpendCents,
    monthSpendCents,
    totalSpendCents,
    rechargeTotalCents,
    risk: evaluateWalletRisk({
      balanceCents,
      frozenWeeklyAmountCents,
      nextPaidActionCents,
      existingOutputs: pending.length > 0,
    }),
    pending,
    exactSettlement: exactSettlementSummary(pending),
  };
}

export function normalizeLedgerEntry(entry = {}) {
  const createdAt = String(entry.createdAt || entry.created_at || "").trim() || new Date().toISOString();
  const rawType = String(entry.type || "").trim() || "manual_adjustment";
  const type = LEDGER_TYPE_ALIASES.get(rawType) || rawType;
  const resourceBindingId = resourceBindingIdFrom(entry);
  const billingAttributionId = billingAttributionIdFrom(entry, resourceBindingId);
  const accountId = accountIdFrom(entry);
  const serverPlanId = serverPlanIdFrom(entry);
  const billingAccountId = String(
    entry.billingAccountId
    || entry.billing_account_id
    || accountId
    || entry.userId
    || entry.user_id
    || entry.tenantId
    || entry.tenant_id
    || ""
  ).trim();
  const sourceType = String(entry.sourceType || entry.source_type || entry.source || "").trim();
  return {
    id: String(entry.id || randomUUID()),
    tenantId: String(entry.tenantId || entry.tenant_id || entry.userId || entry.user_id || "").trim(),
    userId: String(entry.userId || entry.user_id || entry.tenantId || entry.tenant_id || "").trim(),
    workspaceId: String(entry.workspaceId || entry.workspace_id || "").trim(),
    runId: String(entry.runId || entry.run_id || "").trim(),
    resourceBindingId,
    billingAttributionId,
    accountId,
    serverPlanId,
    billingAccountId,
    type: LEDGER_TYPES.has(type) ? type : "manual_adjustment",
    amount: moneyAmount(entry.amount, 0),
    currency: String(entry.currency || "CNY").trim() || "CNY",
    sourceType,
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

export function appendUnattributedBill(db, bill = {}) {
  db.unattributedBills = Array.isArray(db.unattributedBills) ? db.unattributedBills : [];
  const idempotencyKey = String(bill.idempotencyKey || bill.idempotency_key || bill.billId || bill.bill_id || bill.sourceId || bill.source_id || randomUUID()).trim();
  const existing = db.unattributedBills.find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) return { bill: existing, created: false };
  const queued = normalizeBillQueueRecord({
    ...bill,
    id: String(bill.id || randomUUID()),
    idempotencyKey,
  });
  db.unattributedBills.push(queued);
  return { bill: queued, created: true };
}

function normalizeBillQueueRecord(bill = {}) {
  const resourceBindingId = resourceBindingIdFrom(bill);
  const billingAttributionId = billingAttributionIdFrom(bill, resourceBindingId);
  const accountId = accountIdFrom(bill);
  return {
    id: String(bill.id || randomUUID()),
    idempotencyKey: String(bill.idempotencyKey || bill.idempotency_key || "").trim(),
    sourceType: String(bill.sourceType || bill.source_type || "cos_daily_bill").trim() || "cos_daily_bill",
    sourceId: String(bill.sourceId || bill.source_id || bill.billId || bill.bill_id || "").trim(),
    reason: String(bill.reason || "missing_required_cost_tags").trim(),
    tenantId: String(bill.tenantId || bill.tenant_id || "").trim(),
    workspaceId: String(bill.workspaceId || bill.workspace_id || "").trim(),
    resourceBindingId,
    billingAttributionId,
    accountId,
    runId: String(bill.runId || bill.run_id || "").trim(),
    serverPlanId: serverPlanIdFrom(bill),
    amount: moneyAmount(bill.amount, 0),
    currency: String(bill.currency || "CNY").trim() || "CNY",
    raw: bill.raw && typeof bill.raw === "object" ? bill.raw : {},
    createdAt: String(bill.createdAt || bill.created_at || "").trim() || new Date().toISOString(),
  };
}

export function trialRemainingForUser(user) {
  const entitlement = user?.preferences?.commercial?.trialEntitlement;
  if (!entitlement || entitlement.status !== "trial_active") return 0;
  if (entitlement.expiresAt && Date.parse(entitlement.expiresAt) <= Date.now()) return 0;
  return moneyAmount(entitlement.remainingCredit, 0);
}

export function activeFreezeByBinding(db, userId = "") {
  const entries = normalizeLedgerEntries(db?.ledger || [])
    .filter((entry) => !userId || entry.userId === userId || entry.tenantId === userId);
  const byBinding = new Map();
  for (const entry of entries) {
    if (!entry.resourceBindingId) continue;
    const current = byBinding.get(entry.resourceBindingId) || 0;
    if (PREAUTH_HOLD_TYPES.has(entry.type)) {
      byBinding.set(entry.resourceBindingId, moneyAmount(current + Math.abs(entry.amount)));
    } else if (PREAUTH_RELEASE_TYPES.has(entry.type) || PREAUTH_SETTLEMENT_TYPES.has(entry.type)) {
      byBinding.set(entry.resourceBindingId, moneyAmount(current - Math.abs(entry.amount)));
    }
  }
  for (const [resourceBindingId, amount] of byBinding.entries()) {
    byBinding.set(resourceBindingId, Math.max(0, moneyAmount(amount)));
  }
  return byBinding;
}

export function activeFreezeAmount(db, userId = "") {
  const byBinding = activeFreezeByBinding(db, userId);
  let total = 0;
  for (const amount of byBinding.values()) total += amount;
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

export function holdFreezeForOrder(db, { user, order, amount, idempotencyKey = "", reason = "resource_binding_preauth_hold" }) {
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
    ...orderLedgerContext(user, order),
    type: "preauth_hold",
    amount: freezeAmount,
    sourceType: "quote",
    sourceId: order.quoteId || order.id,
    idempotencyKey: idempotencyKey || `preauth_hold:${order.id}`,
    reason,
    operatorId: user.id,
  });
  return { ok: true, entry: result.entry, created: result.created, snapshot: walletCommercialSnapshot(db, user) };
}

export function releaseFreezeForOrder(db, { user, order, amount, idempotencyKey = "", reason = "resource_binding_preauth_release" }) {
  const bindingId = resourceBindingIdFrom(order);
  const byBinding = activeFreezeByBinding(db, user?.id || order?.tenantId || order?.userId || "");
  const activeAmount = byBinding.get(bindingId) || 0;
  const releaseAmount = moneyAmount(Math.min(activeAmount, moneyAmount(amount, activeAmount)), 0);
  if (!order?.id || releaseAmount <= 0) {
    return { ok: true, releasedAmount: 0, skipped: true };
  }
  const result = appendLedgerEntry(db, {
    ...orderLedgerContext(user, order),
    type: "preauth_release",
    amount: releaseAmount,
    sourceType: "resource_binding",
    sourceId: order.id,
    idempotencyKey: idempotencyKey || `preauth_release:${order.id}`,
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
  const chargeIdempotencyKey = idempotencyKey || `exact_resource_charge:${order.id}:${sourceId || "exact"}`;
  db.ledger = normalizeLedgerEntries(db.ledger);
  const existing = db.ledger.find((entry) => entry.idempotencyKey === chargeIdempotencyKey);
  if (existing) {
    return { ok: true, chargedAmount: chargeAmount, entry: existing, wallet: ensureWallet(db, order.userId || user?.id || ""), created: false };
  }
  const wallet = ensureWallet(db, order.userId || user?.id || "");
  wallet.balance = moneyAmount(wallet.balance - chargeAmount, 0);
  wallet.updatedAt = new Date().toISOString();
  const result = appendLedgerEntry(db, {
    ...orderLedgerContext(user, order),
    type: "exact_resource_charge",
    amount: chargeAmount,
    sourceType: "tencent_bill",
    sourceId,
    idempotencyKey: chargeIdempotencyKey,
    reason: "resource_binding_exact_bill_settlement",
    operatorId: "portal-billing-ledger",
  });
  return { ok: true, chargedAmount: chargeAmount, entry: result.entry, wallet, created: result.created };
}

export function appendPendingUsageForOrder(db, {
  user,
  order,
  pendingCost,
  sourceId = "",
  idempotencyKey = "",
  sourceType = "pending_metering",
  reason = "resource_binding_pending_usage",
}) {
  const amount = moneyAmount(pendingCost, 0);
  if (order?.pendingStoppedAt || ["released", "settled", "failed", "cancelled"].includes(String(order?.status || "").toLowerCase())) {
    return { ok: true, skipped: true, reason: "pending_stopped", amount: 0 };
  }
  if (!order?.id || amount <= 0) {
    return { ok: false, error: "invalid_pending_usage", status: 400 };
  }
  const result = appendLedgerEntry(db, {
    ...orderLedgerContext(user, order),
    type: "pending_usage",
    amount,
    sourceType,
    sourceId: sourceId || order.runId || order.id,
    idempotencyKey: idempotencyKey || `pending_usage:${order.id}:${sourceId || order.runId || "pending"}:${amount.toFixed(2)}`,
    reason,
    operatorId: "portal-billing-ledger",
  });
  return { ok: true, amount, entry: result.entry, created: result.created };
}

export function applySettlementAdjustmentForOrder(db, {
  user,
  order,
  type,
  amount,
  sourceId = "",
  idempotencyKey = "",
  reason = "resource_binding_exact_bill_delta",
}) {
  const normalizedType = LEDGER_TYPE_ALIASES.get(String(type || "").trim()) || String(type || "").trim();
  const adjustmentAmount = moneyAmount(amount, 0);
  if (!order?.id || adjustmentAmount <= 0 || !["refund", "makeup_charge"].includes(normalizedType)) {
    return { ok: false, error: "invalid_settlement_adjustment", status: 400 };
  }
  const adjustmentIdempotencyKey = idempotencyKey || `${normalizedType}:${order.id}:${sourceId || "delta"}:${adjustmentAmount.toFixed(2)}`;
  db.ledger = normalizeLedgerEntries(db.ledger);
  const existing = db.ledger.find((entry) => entry.idempotencyKey === adjustmentIdempotencyKey);
  if (existing) {
    return { ok: true, amount: adjustmentAmount, entry: existing, wallet: ensureWallet(db, order.userId || user?.id || ""), created: false };
  }
  const wallet = ensureWallet(db, order.userId || user?.id || "");
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
    operatorId: "portal-billing-ledger",
  });
  return { ok: true, amount: adjustmentAmount, entry: result.entry, wallet, created: result.created };
}
