import assert from "node:assert/strict";

const { quoteResourceOrderFromPlan, resourceOrdersForUser } = await import("../services/portal/src/domain/resource-orders.mjs");

const user = { id: "user-v20.34", tenantId: "tenant-v20.34", role: "user" };
const workspace = { slug: "workspace-v20.34" };
const serverPlan = {
  id: "starter-2c",
  cpu: 2,
  memoryGb: 4,
  discountPrice: 1,
  minBillableHours: 1,
};
const order = quoteResourceOrderFromPlan({ user, workspace, serverPlan, input: { runId: "run-v20.34" } });

assert.equal(order.userId, user.id, "resource_order_user_id_must_be_user_id");
assert.equal(order.portalUserId, user.id, "resource_order_portal_user_id_must_be_user_id");
assert.equal(order.tenantId, user.tenantId, "resource_order_tenant_id_must_preserve_tenant_id");
assert.equal(order.billingAccountId, user.tenantId, "resource_order_billing_account_must_default_to_tenant_id");

const db = {
  resourceOrders: [
    order,
    { ...order, id: "other-user", userId: "other-user", tenantId: user.tenantId },
    { ...order, id: "other-tenant", userId: "other-user", tenantId: "tenant-other" },
  ],
  resourceOrderEvents: [],
  ledger: [],
};

assert.deepEqual(
  resourceOrdersForUser(db, user.id).map((item) => item.id),
  [order.id],
  "resource_orders_for_user_must_not_return_same_tenant_other_user_orders"
);

console.log(JSON.stringify({
  ok: true,
  contract: "v20.34_tenant_isolation_contract",
  order: {
    userId: order.userId,
    tenantId: order.tenantId,
    billingAccountId: order.billingAccountId,
  },
}, null, 2));
