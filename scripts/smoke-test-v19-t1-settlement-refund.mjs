import assert from "node:assert/strict";

const {
  activeFreezeAmount,
  applyExactChargeForOrder,
  applySettlementAdjustmentForOrder,
  ensureWallet,
  holdFreezeForOrder,
  releaseFreezeForOrder,
} = await import(new URL(["..", "services", "portal", "src", "domain", "wallet-ledger.mjs"].join("/"), import.meta.url));

const db = { wallets: [{ userId: "user-refund", balance: 500 }], ledger: [] };
const user = { id: "user-refund" };
const order = { id: "ro-refund", tenantId: "tenant-refund", userId: user.id, workspaceId: "workspace-refund", runId: "run-refund", billingAccountId: "billing-refund", quoteId: "quote-refund" };

assert.equal(holdFreezeForOrder(db, { user, order, amount: 120 }).created, true);
assert.equal(applyExactChargeForOrder(db, { user, order, exactCost: 80, sourceId: "cos-daily-refund" }).created, true);
assert.equal(releaseFreezeForOrder(db, { user, order }).releasedAmount, 40);
assert.equal(activeFreezeAmount(db, user.id), 0);
assert.equal(ensureWallet(db, user.id).balance, 420);
assert.equal(applySettlementAdjustmentForOrder(db, { user, order, type: "refund", amount: 5, sourceId: "manual-refund-proof" }).created, true);
assert.equal(applySettlementAdjustmentForOrder(db, { user, order, type: "refund", amount: 5, sourceId: "manual-refund-proof" }).created, false);
assert.equal(ensureWallet(db, user.id).balance, 425);
console.log(JSON.stringify({ ok: true, walletBalance: ensureWallet(db, user.id).balance, ledgerTypes: db.ledger.map((item) => item.type) }, null, 2));
