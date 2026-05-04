import assert from "node:assert/strict";
import {
  evaluateSupportBoundaryState,
  resolveSupportBoundary,
} from "../services/portal/src/domain/support-boundaries.mjs";

const insufficient = evaluateSupportBoundaryState({
  now: "2026-05-03T08:00:00.000Z",
  overdueAt: "2026-05-01T08:00:00.000Z",
  balance: 10,
  minRequiredBalance: 50,
  frozenAmount: 0,
  gracePeriodDays: 7,
  fileRetentionDays: 30,
});
assert.equal(insufficient.balanceStatus, "insufficient_balance", "insufficient_balance_must_be_detected");
assert.equal(insufficient.graceStatus, "grace_active", "grace_period_must_be_active_before_deadline");

const frozen = evaluateSupportBoundaryState({
  now: "2026-05-03T08:00:00.000Z",
  overdueAt: "2026-04-20T08:00:00.000Z",
  balance: 20,
  minRequiredBalance: 10,
  frozenAmount: 20,
  gracePeriodDays: 7,
  fileRetentionDays: 30,
});
assert.equal(frozen.freezeStatus, "frozen_blocking_new_runs", "frozen_amount_must_block_new_runs");
assert.equal(frozen.policy.canStartNewPaidRun, false, "frozen_amount_must_disable_new_paid_run");

const retention = evaluateSupportBoundaryState({
  now: "2026-06-30T08:00:00.000Z",
  overdueAt: "2026-05-01T08:00:00.000Z",
  balance: 0,
  minRequiredBalance: 100,
  frozenAmount: 0,
  gracePeriodDays: 7,
  fileRetentionDays: 30,
});
assert.equal(retention.fileRetentionStatus, "retention_expired", "retention_window_must_expire_after_deadline");
assert.equal(retention.policy.shouldCleanupRetainedFiles, true, "retention_cleanup_must_be_enabled");

const failedRun = evaluateSupportBoundaryState({
  now: "2026-05-03T08:00:00.000Z",
  overdueAt: "2026-05-01T08:00:00.000Z",
  balance: 100,
  minRequiredBalance: 10,
  frozenAmount: 0,
  gracePeriodDays: 7,
  fileRetentionDays: 30,
  failedRunCount: 1,
  hasChargeableRunFailure: true,
});
assert.equal(failedRun.failedRunBillingStatus, "failed_run_no_charge", "failed_run_must_not_charge");
assert.equal(failedRun.policy.chargeMultiplierOnFailedRun, 0, "failed_run_charge_multiplier_must_be_zero");

const ready = resolveSupportBoundary({
  now: "2026-05-03T08:00:00.000Z",
  wallet: { balance: 200 },
  freeze: { activeFreeze: 40 },
  minRequiredBalance: 50,
});
assert.equal(ready.canStartPaidRun, true, "sufficient_available_balance_must_allow_paid_run");
assert.equal(ready.supportStatus, "ready", "ready_support_status_expected");

const freezeCovered = resolveSupportBoundary({
  now: "2026-05-03T08:00:00.000Z",
  wallet: { balance: 55 },
  freeze: { activeFreeze: 50 },
  minRequiredBalance: 20,
});
assert.equal(freezeCovered.canStartPaidRun, false, "freeze_covering_week_must_block_new_paid_run");
assert.equal(freezeCovered.fundingStatus, "freeze_covers_current_week", "freeze_covers_current_week_status_expected");
assert.match(freezeCovered.userCopy, /已冻结的本周服务费/, "freeze_boundary_copy_must_be_novice_readable");

const graceDownloadOnly = resolveSupportBoundary({
  now: "2026-05-03T08:00:00.000Z",
  overdueAt: "2026-05-01T08:00:00.000Z",
  wallet: { balance: 0 },
  freeze: { activeFreeze: 0 },
  minRequiredBalance: 10,
  gracePeriodDays: 7,
});
assert.equal(graceDownloadOnly.canStartPaidRun, false, "grace_period_must_block_new_paid_run");
assert.equal(graceDownloadOnly.canDownloadExistingOutput, true, "grace_period_must_allow_existing_download");
assert(graceDownloadOnly.actionRequired.includes("grace_period_download_only"), "grace_period_must_expose_admin_action");

const failedBeforeRuntime = resolveSupportBoundary({
  run: { status: "failed", previousStatus: "created" },
});
assert.equal(failedBeforeRuntime.failedRunBillingStatus, "failed_before_runtime_no_charge", "pre_runtime_failure_must_not_charge");
assert.equal(failedBeforeRuntime.policy.chargeMultiplierOnFailedRun, 0, "pre_runtime_failure_charge_multiplier_must_be_zero");
assert.match(failedBeforeRuntime.billingCopy, /不会继续扣运行费/, "pre_runtime_failure_copy_must_be_novice_readable");

const failedAfterRuntime = resolveSupportBoundary({
  run: { status: "failed", previousStatus: "running" },
});
assert.equal(failedAfterRuntime.failedRunBillingStatus, "failed_after_running_pending_t1", "post_runtime_failure_must_wait_t1");
assert.equal(failedAfterRuntime.policy.chargeMultiplierOnFailedRun, 1, "post_runtime_failure_must_pending_actual_usage");

console.log(JSON.stringify({
  ok: true,
  suite: "v20.3_support_boundary_contract",
}, null, 2));
