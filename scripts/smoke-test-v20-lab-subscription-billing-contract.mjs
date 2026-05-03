import assert from "node:assert/strict";

const {
  activateLabSubscription,
  upgradeLabSubscription,
} = await import("../services/portal/src/domain/lab-subscriptions.mjs");
const {
  applyLabDailyCharge,
  ensureLabWeeklyFreeze,
  evaluateLabBalanceStatus,
} = await import("../services/portal/src/domain/lab-billing-policy.mjs");

const db = {
  wallets: [{ userId: "user-v20-a", balance: 1000, updatedAt: "2026-05-03T00:00:00.000Z" }],
  ledger: [],
  labSubscriptions: [],
  labPackageEvents: [],
  labStorageAddons: [],
  labDailyCharges: [],
};
const user = { id: "user-v20-a", tenantId: "tenant-v20-a" };

const activated = activateLabSubscription(db, {
  user,
  workspaceId: "default",
  packageId: "starter",
  idempotencyKey: "activate-starter-once",
  now: "2026-05-03T00:00:00.000Z",
});
assert.equal(activated.ok, true, `activation_failed:${activated.error}`);
assert.equal(activated.created, true);
assert.equal(activated.subscription.packageId, "starter");
assert.equal(activated.subscription.includedStorageGb, 10);
assert.equal(activated.subscription.computeTier, "starter");

const activatedAgain = activateLabSubscription(db, {
  user,
  workspaceId: "default",
  packageId: "starter",
  idempotencyKey: "activate-starter-once",
  now: "2026-05-03T00:00:00.000Z",
});
assert.equal(activatedAgain.ok, true);
assert.equal(activatedAgain.created, false);
assert.equal(db.labSubscriptions.length, 1, "activation_should_be_idempotent");

const freeze = ensureLabWeeklyFreeze(db, {
  user,
  subscription: activated.subscription,
  idempotencyKey: "weekly-freeze-2026-05-03",
  now: "2026-05-03T00:05:00.000Z",
});
assert.equal(freeze.ok, true, `weekly_freeze_failed:${freeze.error}`);
assert.equal(freeze.created, true);
assert.equal(freeze.entry.type, "subscription_weekly_freeze");
assert.equal(freeze.entry.amount, activated.subscription.weeklyFreezeAmount);
assert.equal(db.wallets[0].balance, 1000, "weekly_freeze_must_not_deduct_wallet_balance");

const freezeAgain = ensureLabWeeklyFreeze(db, {
  user,
  subscription: activated.subscription,
  idempotencyKey: "weekly-freeze-2026-05-03",
  now: "2026-05-03T00:05:00.000Z",
});
assert.equal(freezeAgain.created, false, "weekly_freeze_should_be_idempotent");

const charge = applyLabDailyCharge(db, {
  user,
  subscription: activated.subscription,
  chargeDate: "2026-05-03",
});
assert.equal(charge.ok, true, `daily_charge_failed:${charge.error}`);
assert.equal(charge.created, true);
assert.equal(charge.entry.type, "subscription_daily_charge");
assert.equal(db.wallets[0].balance, Number((1000 - activated.subscription.dailyPrice).toFixed(2)));

const chargeAgain = applyLabDailyCharge(db, {
  user,
  subscription: activated.subscription,
  chargeDate: "2026-05-03",
});
assert.equal(chargeAgain.created, false, "daily_charge_should_be_idempotent");
assert.equal(db.labDailyCharges.length, 1, "daily_charge_record_should_be_idempotent");

const upgraded = upgradeLabSubscription(db, {
  user,
  subscriptionId: activated.subscription.id,
  packageId: "pro",
  idempotencyKey: "upgrade-pro-once",
  now: "2026-05-03T01:00:00.000Z",
});
assert.equal(upgraded.ok, true, `upgrade_failed:${upgraded.error}`);
assert.equal(upgraded.subscription.packageId, "pro");
assert.equal(upgraded.subscription.includedStorageGb, 100);
assert.equal(upgraded.subscription.computeTier, "pro");

db.wallets[0].balance = 0;
const lowBalance = evaluateLabBalanceStatus(db, {
  user,
  subscription: upgraded.subscription,
  now: "2026-05-03T02:00:00.000Z",
});
assert.equal(lowBalance.status, "grace_period");
assert.equal(lowBalance.canUpload, false);
assert.equal(lowBalance.canRun, false);
assert.equal(lowBalance.canDownload, true);
assert.match(lowBalance.cleanupAfterAt, /^2026-05-10T02:00:00\.000Z$/);

console.log(JSON.stringify({
  ok: true,
  contract: "v20_lab_subscription_billing",
  ledgerTypes: db.ledger.map((item) => item.type),
  finalPackageId: upgraded.subscription.packageId,
  balanceStatus: lowBalance.status,
}, null, 2));
