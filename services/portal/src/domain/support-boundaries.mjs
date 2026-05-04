const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GRACE_DAYS = 7;
const DEFAULT_FILE_RETENTION_DAYS = 30;

function normalizeMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function toDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function iso(value) {
  return toDate(value).toISOString();
}

function maxNumber(...values) {
  return Math.max(...values.map((value) => normalizeMoney(value)));
}

function nonEmptyText(...values) {
  return values.map((value) => String(value ?? "").trim()).find(Boolean) || "";
}

function runEnteredPaidRuntime(run = {}) {
  const paidStatuses = new Set(["submitted", "running", "completed", "success", "finished", "failed_after_running"]);
  return [run.status, run.runStatus, run.previousStatus, run.stageStatus].some(
    (value) => paidStatuses.has(String(value || "").trim().toLowerCase()),
  );
}

function runFailedBeforeRuntime(run = {}) {
  const status = nonEmptyText(run.status, run.runStatus).toLowerCase();
  if (!["failed", "error", "cancelled"].includes(status)) return false;
  return !runEnteredPaidRuntime({ ...run, status: nonEmptyText(run.previousStatus, run.stageStatus) });
}

function resolveFundingState({ walletBalance, activeFreeze, minRequiredBalance }) {
  const availableBalance = normalizeMoney(walletBalance - activeFreeze);
  if (availableBalance >= minRequiredBalance) {
    return {
      fundingStatus: "available_balance_sufficient",
      canStartPaidRun: true,
      userCopy: "余额充足，可以继续启动新的付费任务。",
      adminActionCode: "none",
    };
  }
  if (activeFreeze >= minRequiredBalance) {
    return {
      fundingStatus: "freeze_covers_current_week",
      canStartPaidRun: false,
      userCopy: "余额不足，请充值；已冻结的本周服务费会继续保障当前已购买服务。",
      adminActionCode: "notify_recharge_freeze_covers_current_week",
    };
  }
  return {
    fundingStatus: "insufficient_balance_and_freeze",
    canStartPaidRun: false,
    userCopy: "余额不足，当前不能启动新的付费任务；充值后可继续使用。",
    adminActionCode: "block_new_paid_run_until_recharged",
  };
}

function resolveGraceState({ now, overdueAt, gracePeriodDays }) {
  if (!overdueAt) {
    return { graceStatus: "not_overdue", inGracePeriod: false, graceEndsAt: "" };
  }
  const endsAt = new Date(toDate(overdueAt, now).getTime() + gracePeriodDays * DAY_MS);
  const active = now.getTime() <= endsAt.getTime();
  return {
    graceStatus: active ? "grace_active" : "grace_ended",
    inGracePeriod: active,
    graceEndsAt: endsAt.toISOString(),
  };
}

function resolveFileRetention({ now, file = {}, fileRetentionDays }) {
  const deletedAt = String(file.deletedAt || file.deleted_at || "").trim();
  if (!deletedAt) {
    return {
      fileRetentionStatus: "retention_active",
      canDownloadExistingOutput: true,
      retentionCleanupAt: "",
    };
  }
  const cleanupAt = new Date(toDate(deletedAt, now).getTime() + fileRetentionDays * DAY_MS);
  const expired = now.getTime() > cleanupAt.getTime();
  return {
    fileRetentionStatus: expired ? "retention_expired" : "retention_active",
    canDownloadExistingOutput: !expired,
    retentionCleanupAt: cleanupAt.toISOString(),
  };
}

function resolveRunBilling(run = {}) {
  if (runFailedBeforeRuntime(run)) {
    return {
      failedRunBillingStatus: "failed_before_runtime_no_charge",
      chargeMultiplierOnFailedRun: 0,
      userCopy: "任务服务器启动失败，未开始计算，不会继续扣运行费。",
      adminActionCode: "inspect_failed_run_no_charge",
    };
  }
  const status = nonEmptyText(run.status, run.runStatus).toLowerCase();
  if (["failed", "error", "failed_after_running"].includes(status) && runEnteredPaidRuntime(run)) {
    return {
      failedRunBillingStatus: "failed_after_running_pending_t1",
      chargeMultiplierOnFailedRun: 1,
      userCopy: "任务运行后失败，费用先进入待校准，T+1 账单回来后按实际用量退款或补扣。",
      adminActionCode: "wait_t1_exact_reconcile",
    };
  }
  return {
    failedRunBillingStatus: "normal_billing_path",
    chargeMultiplierOnFailedRun: 1,
    userCopy: "费用按实际运行和存储使用记录计算。",
    adminActionCode: "none",
  };
}

function resolveBoundaryInput(input = {}) {
  const wallet = input.wallet || {};
  const freeze = input.freeze || {};
  return {
    now: toDate(input.now, new Date()),
    wallet,
    freeze,
    run: input.run || {},
    file: input.file || {},
    walletBalance: normalizeMoney(input.balance ?? wallet.balance),
    activeFreeze: maxNumber(input.frozenAmount, input.activeFreeze, freeze.amount, freeze.activeFreeze),
    minRequiredBalance: normalizeMoney(input.minRequiredBalance ?? input.nextPaidRunEstimate ?? 0),
    gracePeriodDays: Math.max(0, Number(input.gracePeriodDays ?? DEFAULT_GRACE_DAYS)),
    fileRetentionDays: Math.max(0, Number(input.fileRetentionDays ?? DEFAULT_FILE_RETENTION_DAYS)),
    overdueAt: nonEmptyText(input.overdueAt, freeze.overdueAt),
  };
}

function supportStatusFor({ canStartPaidRun, grace, funding }) {
  if (canStartPaidRun) return "ready";
  if (grace.inGracePeriod) return "download_only_grace";
  return funding.fundingStatus;
}

function actionCodeItems({ funding, grace, retention, billing }) {
  return [
    funding.adminActionCode,
    grace.inGracePeriod ? "grace_period_download_only" : "",
    retention.fileRetentionStatus === "retention_expired" ? "cleanup_retained_files" : "",
    billing.adminActionCode,
  ];
}

function normalizeActionCodes(items = []) {
  return items.filter((item) => item && item !== "none");
}

function boundaryPolicy({ canStartPaidRun, canDownloadExistingOutput, retention, billing }) {
  return {
    canStartNewPaidRun: canStartPaidRun,
    canDownloadExistingFiles: canDownloadExistingOutput,
    shouldCleanupRetainedFiles: retention.fileRetentionStatus === "retention_expired",
    chargeMultiplierOnFailedRun: billing.chargeMultiplierOnFailedRun,
  };
}

function boundaryTimeline({ now, overdueAt, grace, retention }) {
  return {
    now: now.toISOString(),
    overdueAt: overdueAt ? iso(overdueAt) : "",
    graceEndsAt: grace.graceEndsAt,
    retentionCleanupAt: retention.retentionCleanupAt,
  };
}

function legacyRunInput(input = {}) {
  return {
    status: input.failedRunCount > 0 ? "failed" : "idle",
    previousStatus: input.hasChargeableRunFailure ? "created" : "submitted",
  };
}

function legacyFreezeStatus(input = {}) {
  return input.frozenAmount > 0 && Number(input.balance || 0) <= Number(input.frozenAmount || 0)
    ? "frozen_blocking_new_runs"
    : "freeze_not_blocking";
}

function legacyFailedRunBillingStatus(input = {}, boundary = {}) {
  return input.failedRunCount > 0 && input.hasChargeableRunFailure
    ? "failed_run_no_charge"
    : boundary.failedRunBillingStatus;
}

export function resolveSupportBoundary(input = {}) {
  const {
    now,
    run,
    file,
    walletBalance,
    activeFreeze,
    minRequiredBalance,
    gracePeriodDays,
    fileRetentionDays,
    overdueAt,
  } = resolveBoundaryInput(input);
  const funding = resolveFundingState({ walletBalance, activeFreeze, minRequiredBalance });
  const grace = resolveGraceState({ now, overdueAt, gracePeriodDays });
  const retention = resolveFileRetention({ now, file, fileRetentionDays });
  const billing = resolveRunBilling(run);
  const canStartPaidRun = funding.canStartPaidRun && !grace.inGracePeriod;
  const canDownloadExistingOutput = grace.inGracePeriod || retention.canDownloadExistingOutput;
  const actionRequired = normalizeActionCodes(actionCodeItems({ funding, grace, retention, billing }));

  return {
    supportStatus: supportStatusFor({ canStartPaidRun, grace, funding }),
    balanceStatus: walletBalance >= minRequiredBalance ? "sufficient_balance" : "insufficient_balance",
    freezeStatus: activeFreeze > 0 ? "active_freeze" : "no_active_freeze",
    fundingStatus: funding.fundingStatus,
    graceStatus: grace.graceStatus,
    fileRetentionStatus: retention.fileRetentionStatus,
    failedRunBillingStatus: billing.failedRunBillingStatus,
    canStartPaidRun,
    canDownloadExistingOutput,
    billingCopy: billing.userCopy,
    userCopy: funding.userCopy,
    actionRequired,
    adminActionCode: actionRequired[0] || "none",
    policy: boundaryPolicy({ canStartPaidRun, canDownloadExistingOutput, retention, billing }),
    amounts: {
      walletBalance,
      activeFreeze,
      availableBalance: normalizeMoney(walletBalance - activeFreeze),
      minRequiredBalance,
    },
    timeline: boundaryTimeline({ now, overdueAt, grace, retention }),
  };
}

export function evaluateSupportBoundaryState(input = {}) {
  const now = toDate(input.now, new Date());
  const overdueAt = toDate(input.overdueAt, now);
  const gracePeriodDays = Math.max(0, Number(input.gracePeriodDays || 0));
  const legacyRetentionAnchor = new Date(overdueAt.getTime() + gracePeriodDays * DAY_MS).toISOString();
  const boundary = resolveSupportBoundary({
    ...input,
    wallet: { balance: input.balance },
    freeze: { activeFreeze: input.frozenAmount },
    run: legacyRunInput(input),
    file: { deletedAt: input.deletedAt || legacyRetentionAnchor },
  });
  return {
    ...boundary,
    freezeStatus: legacyFreezeStatus(input),
    failedRunBillingStatus: legacyFailedRunBillingStatus(input, boundary),
  };
}
