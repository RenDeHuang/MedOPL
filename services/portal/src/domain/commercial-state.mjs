import { PORTAL_TRIAL_CREDIT_AMOUNT, PORTAL_TRIAL_VALID_DAYS } from "../config/portal-config.mjs";
import { ensureWallet, walletCommercialSnapshot } from "./wallet-ledger.mjs";

export function activeUserStatus(status = "active") {
  const normalized = String(status || "active").toLowerCase();
  return ["disabled", "deleted"].includes(normalized) ? normalized : "active";
}

export function isBlockedUserStatus(status = "active") {
  return ["disabled", "deleted"].includes(activeUserStatus(status));
}

export function addDaysIso(base, days) {
  const date = new Date(base || Date.now());
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString();
}

export function safePositiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function buildDefaultTrialEntitlement(createdAt = new Date().toISOString()) {
  const amount = safePositiveNumber(PORTAL_TRIAL_CREDIT_AMOUNT, 50);
  return {
    kind: "trial_credit",
    status: amount > 0 ? "trial_active" : "none",
    source: "portal_signup_trial",
    currency: "CNY",
    totalCredit: amount,
    remainingCredit: amount,
    createdAt,
    expiresAt: addDaysIso(createdAt, PORTAL_TRIAL_VALID_DAYS),
    note: "新注册用户默认获得试用额度，可先进入实验室并完成首轮体验。",
  };
}

export function normalizeTrialEntitlement(value, { createdAt = "" } = {}) {
  if (!value || typeof value !== "object") return null;
  const status = String(value.status || "none").trim().toLowerCase();
  const totalCredit = safePositiveNumber(value.totalCredit, 0);
  const remainingCredit = safePositiveNumber(value.remainingCredit, totalCredit);
  const expiresAt = String(value.expiresAt || "").trim();
  const expired = expiresAt ? Date.parse(expiresAt) <= Date.now() : false;
  return {
    kind: String(value.kind || "trial_credit").trim() || "trial_credit",
    status: expired && status === "trial_active" ? "trial_expired" : status,
    source: String(value.source || "portal").trim() || "portal",
    currency: String(value.currency || "CNY").trim() || "CNY",
    totalCredit,
    remainingCredit,
    createdAt: String(value.createdAt || createdAt || "").trim() || createdAt || new Date().toISOString(),
    expiresAt,
    note: String(value.note || "").trim(),
  };
}

export function ensureUserCommercialState(user, { grantTrial = false } = {}) {
  user.preferences = user.preferences && typeof user.preferences === "object" ? user.preferences : { theme: "light" };
  user.preferences.commercial = user.preferences.commercial && typeof user.preferences.commercial === "object"
    ? user.preferences.commercial
    : {};
  if (!("trialEntitlement" in user.preferences.commercial)) {
    user.preferences.commercial.trialEntitlement = grantTrial ? buildDefaultTrialEntitlement(user.createdAt) : null;
    return true;
  }
  const normalized = normalizeTrialEntitlement(user.preferences.commercial.trialEntitlement, { createdAt: user.createdAt });
  if (JSON.stringify(normalized) !== JSON.stringify(user.preferences.commercial.trialEntitlement)) {
    user.preferences.commercial.trialEntitlement = normalized;
    return true;
  }
  return false;
}

export function activeGroupForUser(db, user) {
  return db.groups.find((item) =>
    item.id === user.groupId &&
    String(item.status || "active").toLowerCase() === "active",
  ) || null;
}

export function buildCommercialProfile(db, user, options = {}) {
  const group = options.group ?? activeGroupForUser(db, user);
  const wallet = options.wallet || ensureWallet(db, user.id);
  const policy = options.policy || null;
  const trialEntitlement = normalizeTrialEntitlement(user.preferences?.commercial?.trialEntitlement, { createdAt: user.createdAt });
  const trialActive = Boolean(
    trialEntitlement &&
    trialEntitlement.status === "trial_active" &&
    trialEntitlement.remainingCredit > 0 &&
    (!trialEntitlement.expiresAt || Date.parse(trialEntitlement.expiresAt) > Date.now())
  );
  const accountStatus = activeUserStatus(user.status);
  const freezeSnapshot = walletCommercialSnapshot(db, user);
  const balance = Number(wallet.balance || 0);
  const availableBalance = freezeSnapshot.availableBalance;
  const balanceFloor = Number(group?.balanceFloor || 0);
  const policyBlocks = Array.isArray(policy?.blocks) ? policy.blocks : [];
  const nonBillingBlocks = policyBlocks.filter((item) => !String(item).includes("余额低于分组门槛"));
  let billingStatus = "wallet_available";
  if (accountStatus !== "active") {
    billingStatus = "account_blocked";
  } else if (balanceFloor > 0 && balance < balanceFloor) {
    billingStatus = trialActive ? "trial_only" : "below_balance_floor";
  } else if (balance - freezeSnapshot.activeFreeze > 0) {
    billingStatus = "wallet_available";
  } else if (trialActive) {
    billingStatus = "trial_only";
  } else {
    billingStatus = "payment_required";
  }
  return {
    accountStatus,
    billingStatus,
    entitlementStatus: trialActive ? "trial_active" : (trialEntitlement?.status || "none"),
    walletBalance: balance,
    activeFreeze: freezeSnapshot.activeFreeze,
    trialRemaining: freezeSnapshot.trialRemaining,
    availableBalance,
    balanceFloor,
    canEnterWorkbench: accountStatus === "active",
    canStartChargeableRun: accountStatus === "active" && nonBillingBlocks.length === 0 && availableBalance > 0,
    chargeBlockedReasons: [
      ...nonBillingBlocks,
      ...(availableBalance > 0 ? [] : ["收费运行前需要充值或试用额度"]),
      ...(balanceFloor > 0 && balance < balanceFloor && !trialActive ? [`当前余额低于分组门槛（${balanceFloor.toFixed(2)}）`] : []),
    ],
    priceTransparency: "服务器价格来自腾讯云 CVM 实时报价；最终扣费以腾讯云账单明细回补为准。",
    trialEntitlement,
    group: group
      ? {
          id: group.id,
          name: group.name,
          balanceFloor,
          maxConcurrentRuns: Number(group.maxConcurrentRuns || 0),
        }
      : null,
  };
}
