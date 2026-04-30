import assert from "node:assert/strict";

const {
  activeFreezeAmount,
  appendLedgerEntry,
  holdFreezeForOrder,
  normalizeLedgerEntry,
} = await import(new URL(["..", "services", "portal", "src", "domain", "wallet-ledger.mjs"].join("/"), import.meta.url));

const db = { wallets: [{ userId: "user-ledger-a", balance: 500 }], ledger: [] };
const user = { id: "user-ledger-a" };
const order = { id: "ro-ledger-a", tenantId: "tenant-ledger-a", userId: user.id, workspaceId: "workspace-ledger-a", runId: "run-ledger-a", billingAccountId: "billing-ledger-a", quoteId: "quote-ledger-a" };

assert.equal(holdFreezeForOrder(db, { user, order, amount: 120 }).created, true);
assert.equal(holdFreezeForOrder(db, { user, order, amount: 120 }).created, false);
assert.equal(db.ledger.length, 1);
assert.equal(activeFreezeAmount(db, user.id), 120);
assert.equal(["tenantId", "workspaceId", "resourceOrderId", "billingAccountId", "idempotencyKey"].every((key) => Boolean(db.ledger[0][key])), true);
assert.equal(normalizeLedgerEntry({ type: "resource_charge", amount: 9, tenantId: order.tenantId, userId: user.id, workspaceId: order.workspaceId, orderId: order.id, billingAccountId: order.billingAccountId, idempotencyKey: "legacy" }).type, "exact_resource_charge");

const topup = appendLedgerEntry(db, { type: "topup", amount: 200, tenantId: order.tenantId, userId: user.id, workspaceId: order.workspaceId, resourceOrderId: order.id, billingAccountId: order.billingAccountId, idempotencyKey: "topup-once" });
assert.equal(topup.created, true);
assert.equal(appendLedgerEntry(db, { ...topup.entry, id: "different-id" }).created, false);
console.log(JSON.stringify({ ok: true, ledgerTypes: db.ledger.map((item) => item.type), activeFreeze: activeFreezeAmount(db, user.id) }, null, 2));
