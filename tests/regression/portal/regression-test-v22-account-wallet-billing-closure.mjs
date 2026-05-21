import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createBillingPayloadBuilders } from "../../../services/portal/src/app/portal-page-billing-payloads.mjs";
import { buildCommercialProfile } from "../../../services/portal/src/domain/commercial-state.mjs";
import { buildUserBillingSummary, ensureWallet } from "../../../services/portal/src/domain/wallet-ledger.mjs";
import { isSmokeClassifiedIn } from "../../../scripts/v22-test-classification.mjs";

const user = {
  id: "user-v22-account-wallet",
  tenantId: "tenant-v22-account-wallet",
  email: "wallet@example.test",
  role: "user",
  preferences: { commercial: { trialEntitlement: null } },
};

const otherUser = {
  id: "user-v22-other-wallet",
  tenantId: "tenant-v22-other-wallet",
  email: "other-wallet@example.test",
  role: "user",
  preferences: { commercial: { trialEntitlement: null } },
};

const workspaceId = "workspace-v22-wallet";
const resourceBindingId = "binding-v22-wallet";
const billingAttributionId = "billing-v22-wallet";
const now = "2026-05-22T06:00:00.000Z";

const db = {
  users: [user, otherUser],
  groups: [],
  wallets: [{ userId: user.id, balance: 50, updatedAt: now }],
  ledger: [
    {
      id: "ledger-topup-user",
      tenantId: user.tenantId,
      userId: user.id,
      accountId: user.id,
      billingAccountId: user.tenantId,
      workspaceId,
      type: "topup",
      amount: 50,
      reason: "initial_wallet_topup",
      createdAt: now,
    },
    {
      id: "ledger-hold-tenant-only",
      tenantId: user.tenantId,
      userId: "",
      accountId: "acct-v22-wallet",
      billingAccountId: user.tenantId,
      workspaceId,
      resourceBindingId,
      billingAttributionId,
      type: "preauth_hold",
      amount: 12.5,
      reason: "resource_binding_preauth_hold",
      createdAt: now,
    },
    {
      id: "ledger-pending-billing-account-only",
      tenantId: "",
      userId: "",
      accountId: "acct-v22-wallet",
      billingAccountId: user.id,
      workspaceId,
      runId: "run-v22-wallet",
      resourceBindingId,
      billingAttributionId,
      type: "pending_usage",
      amount: 3.25,
      reason: "resource_binding_pending_usage",
      createdAt: now,
    },
    {
      id: "ledger-exact-account-only",
      tenantId: "",
      userId: "",
      accountId: user.id,
      billingAccountId: "",
      workspaceId,
      runId: "run-v22-wallet",
      resourceBindingId,
      billingAttributionId,
      type: "exact_resource_charge",
      amount: 2,
      reason: "resource_binding_exact_bill_settlement",
      createdAt: now,
    },
    {
      id: "ledger-other-user",
      tenantId: otherUser.tenantId,
      userId: otherUser.id,
      accountId: otherUser.id,
      billingAccountId: otherUser.tenantId,
      workspaceId: "workspace-v22-other-wallet",
      type: "topup",
      amount: 999,
      reason: "other_user_topup",
      createdAt: now,
    },
  ],
  taskSpaces: [{
    slug: workspaceId,
    userId: user.id,
    title: "Wallet Owner Scope",
    status: "active",
    createdAt: now,
  }],
};

const { buildBillingPayload, buildBillingSummaryPayload } = createBillingPayloadBuilders({
  buildCommercialProfile,
  collectRunsForUser: async () => [{
    runId: "run-v22-wallet",
    workspaceId,
    status: "completed",
    createdAt: now,
  }],
  ensureWallet,
  fetchBillingSummary: async () => ({
    source: "portal_billing_ledger",
    totals: { cpuCost: 0.02, gpuCost: 0, pvCost: 0.01, totalCost: 2 },
    items: [{
      name: "run-v22-wallet",
      workspaceId,
      runId: "run-v22-wallet",
      totalCost: 2,
      cpuCost: 0.02,
      gpuCost: 0,
      pvCost: 0.01,
      properties: {
        run_id: "run-v22-wallet",
        workspace_id: workspaceId,
        pricing_source: "portal_billing_ledger",
      },
      createdAt: now,
    }],
  }),
  fetchPendingSummary: async () => ({
    source: "portal_billing_ledger",
    totals: { totalCost: 3.25 },
    runs: [],
  }),
  formatDateOnly: (value) => new Date(value).toISOString().slice(0, 10),
  isRunTerminal: () => true,
  listTaskSpacesForUser: () => db.taskSpaces,
});

const billingPayload = await buildBillingPayload(db, user, { from: "2026-05-22", to: "2026-05-22" });
const summaryPayload = await buildBillingSummaryPayload(db, user, { from: "2026-05-22", to: "2026-05-22" });
const userSummary = buildUserBillingSummary(db, { user, now });

assert.equal(billingPayload.wallet.balance, 50, "wallet_balance_mismatch");
assert.equal(billingPayload.wallet.activeFreeze, 10.5, "billing_payload_must_count_owner_scoped_tenant_freeze_net_of_exact_charge");
assert.equal(billingPayload.wallet.availableBalance, 39.5, "billing_payload_available_balance_must_subtract_owner_freeze");
assert.equal(summaryPayload.wallet.activeFreeze, 10.5, "summary_payload_must_count_owner_scoped_tenant_freeze_net_of_exact_charge");
assert.equal(summaryPayload.wallet.availableBalance, 39.5, "summary_payload_available_balance_must_subtract_owner_freeze");

assert.equal(userSummary.balanceCents, 5000, "user_summary_balance_cents_mismatch");
assert.equal(userSummary.pending.length, 1, "user_summary_must_include_billing_account_owned_pending_usage");
assert.equal(userSummary.pending[0].id, "ledger-pending-billing-account-only", "pending_usage_owner_scope_mismatch");
assert.equal(userSummary.exactSettlement.status, "waiting_t_plus_1", "pending_usage_must_drive_exact_settlement_window");

const ledgerIds = billingPayload.ledger.map((item) => item.id).sort();
assert.deepEqual(
  ledgerIds,
  [
    "ledger-exact-account-only",
    "ledger-hold-tenant-only",
    "ledger-pending-billing-account-only",
    "ledger-topup-user",
  ].sort(),
  "billing_payload_ledger_must_use_same_owner_scope_as_wallet_summary",
);
assert.equal(ledgerIds.includes("ledger-other-user"), false, "billing_payload_must_not_include_other_owner_ledger");
assert(
  billingPayload.ledger.some((item) => item.id === "ledger-hold-tenant-only" && item.ownerScope.includes("账务账户") && item.ownerScope.includes("资源绑定")),
  "billing_payload_must_expose_ui_safe_owner_scope_for_tenant_owned_freeze",
);

const billingApiTypes = await readFile("services/portal/frontend/src/api/portal/billing.ts", "utf8");
for (const requiredField of [
  "activeFreeze",
  "availableBalance",
  "pendingCost",
  "exactCost",
  "supportBoundary",
  "ownerScope",
]) {
  assert(billingApiTypes.includes(requiredField), `billing_api_types_missing:${requiredField}`);
}
for (const forbiddenField of [
  "tenantId",
  "billingAccountId",
  "resourceBindingId",
  "billingAttributionId",
  "accountId",
  "serverPlanId",
  "runId",
]) {
  assert.equal(billingApiTypes.includes(forbiddenField), false, `billing_api_types_must_not_expose_internal_field:${forbiddenField}`);
}

const billingAdapterSource = await readFile("services/portal/frontend/src/app/data/portalAdapters.ts", "utf8");
for (const requiredMapping of [
  "pendingCost",
  "exactCost",
  "supportBoundary",
  "ownerScope",
]) {
  assert(billingAdapterSource.includes(requiredMapping), `billing_adapter_missing:${requiredMapping}`);
}

const billingPageSource = await readFile("services/portal/frontend/src/app/pages/BillingAudit.tsx", "utf8");
for (const requiredCopy of [
  "待结算",
  "精确账单",
  "T+1",
  "账户归属",
  "审计状态",
]) {
  assert(billingPageSource.includes(requiredCopy), `billing_page_missing_slide03_copy:${requiredCopy}`);
}
for (const staleCopy of [
  "18 小时后解冻",
  "实时同步",
  "正常扣费",
  "显示最近 100 条流水",
  "保留 1 年",
]) {
  assert.equal(billingPageSource.includes(staleCopy), false, `billing_page_must_not_keep_static_demo_copy:${staleCopy}`);
}

assert.equal(
  isSmokeClassifiedIn("tests/regression/portal/regression-test-v22-account-wallet-billing-closure.mjs", "local-regression"),
  true,
  "account_wallet_billing_closure_test_must_be_registered_in_local_regression",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_account_wallet_billing_closure",
  ledgerIds,
}, null, 2));
