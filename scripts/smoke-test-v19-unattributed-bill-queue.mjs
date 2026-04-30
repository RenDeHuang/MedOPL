import assert from "node:assert/strict";
import { appendPendingUsageForOrder, appendUnattributedBill } from "../services/portal/src/domain/wallet-ledger.mjs";
import { resourceOrderStopsPending, transitionResourceOrder } from "../services/portal/src/domain/resource-orders.mjs";

const order = { id: "ro-unattributed", tenantId: "tenant-unattributed", userId: "user-unattributed", workspaceId: "workspace-unattributed", runId: "run-unattributed", status: "running", billingAccountId: "billing-unattributed" };
const db = { wallets: [], ledger: [], resourceOrders: [order], resourceOrderEvents: [], unattributedBills: [] };

assert.equal(appendUnattributedBill(db, { sourceId: "cos-row-no-tags", amount: 12.34, reason: "missing_resourceorderid_tag" }).created, true);
assert.equal(appendUnattributedBill(db, { sourceId: "cos-row-no-tags", amount: 12.34, reason: "missing_resourceorderid_tag" }).created, false);
assert.equal(db.unattributedBills.length, 1);
assert.equal(appendPendingUsageForOrder(db, { order, pendingCost: 3.21, sourceId: "pending-before-release" }).created, true);
const released = transitionResourceOrder(db, { orderId: order.id, status: "released", payload: { pendingStoppedAt: "2026-04-30T00:00:00.000Z" } });
assert.equal(resourceOrderStopsPending(released.order), true);
assert.equal(appendPendingUsageForOrder(db, { order: released.order, pendingCost: 4.56, sourceId: "pending-after-release" }).skipped, true);
assert.equal(db.ledger.filter((item) => item.type === "pending_usage").length, 1);
console.log(JSON.stringify({ ok: true, unattributedCount: db.unattributedBills.length, pendingUsageCount: db.ledger.filter((item) => item.type === "pending_usage").length, pendingStoppedAt: released.order.pendingStoppedAt }, null, 2));
