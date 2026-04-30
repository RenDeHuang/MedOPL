import assert from "node:assert/strict";

const {
  activeFreezeAmount,
  applyExactChargeForOrder,
  applySettlementAdjustmentForOrder,
  ensureWallet,
  holdFreezeForOrder,
} = await import(new URL(["..", "services", "portal", "src", "domain", "wallet-ledger.mjs"].join("/"), import.meta.url));

const db = { wallets: [{ userId: "user-makeup", balance: 500 }], ledger: [] };
const user = { id: "user-makeup" };
const order = { id: "ro-makeup", tenantId: "tenant-makeup", userId: user.id, workspaceId: "workspace-makeup", runId: "run-makeup", billingAccountId: "billing-makeup", quoteId: "quote-makeup" };

assert.equal(holdFreezeForOrder(db, { user, order, amount: 100 }).created, true);
assert.equal(applyExactChargeForOrder(db, { user, order, exactCost: 100, sourceId: "cos-daily-makeup" }).created, true);
assert.equal(activeFreezeAmount(db, user.id), 0);
assert.equal(applySettlementAdjustmentForOrder(db, { user, order, type: "makeup_charge", amount: 30, sourceId: "cos-daily-makeup-extra" }).created, true);
assert.equal(applySettlementAdjustmentForOrder(db, { user, order, type: "makeup_charge", amount: 30, sourceId: "cos-daily-makeup-extra" }).created, false);
assert.equal(ensureWallet(db, user.id).balance, 370);
console.log(JSON.stringify({ ok: true, walletBalance: ensureWallet(db, user.id).balance, ledgerTypes: db.ledger.map((item) => item.type) }, null, 2));
