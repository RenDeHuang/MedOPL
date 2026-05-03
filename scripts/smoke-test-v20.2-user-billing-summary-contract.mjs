import assert from "node:assert/strict";

const {
  buildUserBillingSummary,
} = await import("../services/portal/src/domain/wallet-ledger.mjs");

const db = {
  wallets: [{ userId: "user-v202-billing", balance: 100 }],
  ledger: [
    { userId: "user-v202-billing", tenantId: "tenant-v202-billing", type: "topup", amount: 150, createdAt: "2026-05-03T01:00:00.000Z" },
    { userId: "user-v202-billing", tenantId: "tenant-v202-billing", type: "subscription_weekly_freeze", amount: 28, sourceType: "lab_subscription", sourceId: "sub-v202", createdAt: "2026-05-03T01:01:00.000Z" },
    { userId: "user-v202-billing", tenantId: "tenant-v202-billing", type: "subscription_daily_charge", amount: 12, sourceType: "lab_subscription", sourceId: "sub-v202", createdAt: "2026-05-03T02:00:00.000Z" },
    { userId: "user-v202-billing", tenantId: "tenant-v202-billing", type: "pending_usage", amount: 1.2, resourceOrderId: "order-v202", runId: "run-v202", createdAt: "2026-05-03T03:00:00.000Z" },
    { userId: "user-v202-billing", tenantId: "tenant-v202-billing", type: "exact_resource_charge", amount: 4, resourceOrderId: "order-v201", createdAt: "2026-05-01T03:00:00.000Z" },
  ],
  labSubscriptions: [{ id: "sub-v202", userId: "user-v202-billing", tenantId: "tenant-v202-billing", packageId: "starter", weeklyFreezeAmount: 28, status: "active" }],
  resourceOrders: [],
};
const user = { id: "user-v202-billing", tenantId: "tenant-v202-billing" };

const summary = buildUserBillingSummary(db, {
  user,
  now: "2026-05-03T12:00:00.000Z",
  nextPaidActionCents: 500,
});

for (const key of [
  "balanceCents",
  "availableBalanceCents",
  "frozenWeeklyAmountCents",
  "todaySpendCents",
  "monthSpendCents",
  "totalSpendCents",
  "rechargeTotalCents",
  "risk",
  "pending",
  "exactSettlement",
]) {
  assert.ok(key in summary, `missing_summary_key:${key}`);
}

assert.equal(summary.balanceCents, 10000);
assert.equal(summary.frozenWeeklyAmountCents, 1600);
assert.equal(summary.rechargeTotalCents, 15000);
assert.equal(summary.todaySpendCents, 1320);
assert.equal(summary.monthSpendCents, 1720);
assert.equal(summary.totalSpendCents, 1720);
assert.equal(summary.pending.length, 1);
assert.equal(summary.pending[0].plainType, "运行中预扣");
assert.match(summary.pending[0].copy, /预扣|T\+1|校准/);
assert.match(summary.risk.copy, /余额|充值|本周|继续|任务/);
assert.match(summary.exactSettlement.copy, /T\+1|校准/);

console.log(JSON.stringify({
  ok: true,
  contract: "v20.2_user_billing_summary",
  todaySpendCents: summary.todaySpendCents,
  pendingCount: summary.pending.length,
}, null, 2));
