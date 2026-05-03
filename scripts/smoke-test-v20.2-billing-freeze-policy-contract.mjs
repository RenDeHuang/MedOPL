import assert from "node:assert/strict";

const {
  evaluateBillingRisk,
} = await import("../services/portal/src/domain/lab-billing-policy.mjs");

function risk(input) {
  return evaluateBillingRisk({
    balanceCents: 0,
    frozenWeeklyAmountCents: 0,
    nextPaidActionCents: 0,
    existingOutputs: false,
    ...input,
  });
}

assert.equal(risk({
  balanceCents: 10000,
  frozenWeeklyAmountCents: 2800,
  nextPaidActionCents: 500,
}).status, "healthy");

const lowButCovered = risk({
  balanceCents: 2800,
  frozenWeeklyAmountCents: 2800,
  nextPaidActionCents: 500,
});
assert.equal(lowButCovered.status, "low_available_balance_freeze_covers_current_week");
assert.equal(lowButCovered.severity, "warning");
assert.equal(lowButCovered.canStartNewPaidWork, false);
assert.equal(lowButCovered.canDownloadExistingOutputs, true);
assert.match(lowButCovered.copy, /本周|继续|充值/);

const insufficient = risk({
  balanceCents: 100,
  frozenWeeklyAmountCents: 200,
  nextPaidActionCents: 500,
});
assert.equal(insufficient.status, "insufficient_for_next_paid_action");
assert.equal(insufficient.canStartNewPaidWork, false);
assert.equal(insufficient.canDownloadExistingOutputs, true);
assert.equal(insufficient.requiredRechargeCents, 200);

const downloadOnly = risk({
  balanceCents: 0,
  frozenWeeklyAmountCents: 0,
  existingOutputs: true,
});
assert.equal(downloadOnly.status, "grace_download_only");
assert.equal(downloadOnly.canDownloadExistingOutputs, true);
assert.equal(downloadOnly.canStartNewPaidWork, false);

const suspended = risk({
  balanceCents: 0,
  frozenWeeklyAmountCents: 0,
  existingOutputs: false,
});
assert.equal(suspended.status, "suspended");
assert.equal(suspended.canDownloadExistingOutputs, false);
assert.equal(suspended.canStartNewPaidWork, false);

console.log(JSON.stringify({
  ok: true,
  contract: "v20.2_billing_freeze_policy",
  statuses: [lowButCovered.status, insufficient.status, downloadOnly.status, suspended.status],
}, null, 2));
