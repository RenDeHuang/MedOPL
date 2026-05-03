import assert from "node:assert/strict";

const {
  buildAdminCustomerAccountingPayload,
  buildAdminCustomerAccountingDetailPayload,
} = await import("../services/portal/src/app/portal-admin-api-payloads.mjs");

const db = {
  users: [
    { id: "admin", role: "admin", name: "管理员", email: "admin@example.com" },
    { id: "user-v202-admin", tenantId: "tenant-v202-admin", role: "user", name: "客户 A", email: "a@example.com" },
  ],
  wallets: [{ userId: "user-v202-admin", balance: 100 }],
  ledger: [
    { id: "l1", userId: "user-v202-admin", tenantId: "tenant-v202-admin", type: "topup", amount: 200, createdAt: "2026-05-03T01:00:00.000Z" },
    { id: "l2", userId: "user-v202-admin", tenantId: "tenant-v202-admin", type: "subscription_weekly_freeze", amount: 28, sourceType: "lab_subscription", sourceId: "sub-admin", createdAt: "2026-05-03T01:01:00.000Z" },
    { id: "l3", userId: "user-v202-admin", tenantId: "tenant-v202-admin", type: "subscription_daily_charge", amount: 12, sourceType: "lab_subscription", sourceId: "sub-admin", createdAt: "2026-05-03T02:00:00.000Z" },
    { id: "l4", userId: "user-v202-admin", tenantId: "tenant-v202-admin", type: "pending_usage", amount: 3, resourceOrderId: "order-admin", runId: "run-admin", createdAt: "2026-05-03T03:00:00.000Z" },
  ],
  labSubscriptions: [{ id: "sub-admin", userId: "user-v202-admin", tenantId: "tenant-v202-admin", packageId: "starter", status: "active", weeklyFreezeAmount: 28 }],
  resourceOrders: [{ id: "order-admin", userId: "user-v202-admin", tenantId: "tenant-v202-admin", runId: "run-admin", status: "running" }],
  workspaceFiles: [{ id: "file-admin", userId: "user-v202-admin", tenantId: "tenant-v202-admin", workspaceId: "default", name: "result.txt" }],
  workspaceSessions: [{ id: "session-admin", userId: "user-v202-admin", tenantId: "tenant-v202-admin", workspaceId: "default" }],
};

const payload = buildAdminCustomerAccountingPayload(db, { now: "2026-05-03T12:00:00.000Z" });
assert.equal(payload.customers.length, 1);
const customer = payload.customers[0];
for (const key of [
  "tenantId",
  "displayName",
  "balanceCents",
  "availableBalanceCents",
  "frozenAmountCents",
  "todaySpendCents",
  "monthSpendCents",
  "totalSpendCents",
  "rechargeTotalCents",
  "runningResourceCount",
  "billingRiskStatus",
]) {
  assert.ok(key in customer, `missing_customer_key:${key}`);
}

assert.equal(customer.tenantId, "tenant-v202-admin");
assert.equal(customer.displayName, "客户 A");
assert.equal(customer.balanceCents, 10000);
assert.equal(customer.rechargeTotalCents, 20000);
assert.equal(customer.todaySpendCents, 1500);
assert.equal(customer.runningResourceCount, 1);
assert.ok(["healthy", "warning", "blocked", "suspended"].includes(customer.billingRiskStatus));
assert.equal(payload.summary.customerCount, 1);
assert.equal(payload.summary.todaySpendCents, 1500);
assert.equal(payload.summary.pendingExactCents, 300);

const detail = buildAdminCustomerAccountingDetailPayload(db, "tenant-v202-admin", { now: "2026-05-03T12:00:00.000Z" });
assert.equal(detail.tenantId, "tenant-v202-admin");
assert.equal(detail.wallet.balanceCents, 10000);
assert.equal(detail.recharges.length, 1);
assert.equal(detail.ledger.length, 4);
assert.equal(detail.activeResourceOrders.length, 1);
assert.equal(detail.workspaceFiles.length, 1);
assert.equal(detail.sessionTraces.length, 1);

console.log(JSON.stringify({
  ok: true,
  contract: "v20.2_admin_customer_accounting",
  customerCount: payload.summary.customerCount,
  todaySpendCents: payload.summary.todaySpendCents,
}, null, 2));
