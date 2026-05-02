export function createBillingServerRuntime({
  env = {},
  deps = {},
  state = {},
} = {}) {
  const {
    AUTO_RECONCILE_ENABLED = false,
    AUTO_RECONCILE_INTERVAL_MS = 0,
    AUTO_RECONCILE_WINDOW = "168h",
  } = env;
  const {
    buildUnavailableSummary,
    buildUnattributedSummary,
    completionTimestamp,
    fetchExactSummary,
    fetchPendingSummary,
    isCompletedRun,
    logRuntimeEvent,
    readPortalDb,
    readRuns,
    runReconcileCharges,
    systemLedgerEntriesForRun,
  } = deps;

  if (typeof buildUnavailableSummary !== "function") throw new Error("buildUnavailableSummary is required");
  if (typeof buildUnattributedSummary !== "function") throw new Error("buildUnattributedSummary is required");
  if (typeof completionTimestamp !== "function") throw new Error("completionTimestamp is required");
  if (typeof fetchExactSummary !== "function") throw new Error("fetchExactSummary is required");
  if (typeof fetchPendingSummary !== "function") throw new Error("fetchPendingSummary is required");
  if (typeof isCompletedRun !== "function") throw new Error("isCompletedRun is required");
  if (typeof logRuntimeEvent !== "function") throw new Error("logRuntimeEvent is required");
  if (typeof readPortalDb !== "function") throw new Error("readPortalDb is required");
  if (typeof readRuns !== "function") throw new Error("readRuns is required");
  if (typeof runReconcileCharges !== "function") throw new Error("runReconcileCharges is required");
  if (typeof systemLedgerEntriesForRun !== "function") throw new Error("systemLedgerEntriesForRun is required");

  let reconcileState = state.reconcileState || {
    lastRunAt: "",
    lastWindow: "",
    lastScope: "all",
    lastReconciledCount: 0,
    lastExactCount: 0,
    lastEstimatedCount: 0,
    lastAdjustmentCount: 0,
    lastError: "",
  };
  let reconcileLoopRunning = false;

  function getReconcileState() {
    return reconcileState;
  }

  async function reconcileCharges(customerId, workspaceId, windowValue, target = {}) {
    const { state: nextState, result } = await runReconcileCharges(customerId, workspaceId, windowValue, target);
    reconcileState = nextState;
    return result;
  }

  async function listPendingRuns(customerId = "", workspaceId = "", windowValue = "7d") {
    const summary = await fetchExactSummary(customerId || "", workspaceId || "", windowValue || "7d");
    let pendingSummary = buildUnavailableSummary(customerId || "", workspaceId || "", "pending_unavailable", "local_metering_unmatched");
    try {
      pendingSummary = await fetchPendingSummary(customerId || "", workspaceId || "", windowValue || "7d");
    } catch {}

    const runs = await readRuns();
    const exactRunIds = new Set((summary.runs || []).map((item) => item.runId));
    const db = await readPortalDb();
    const ledger = db?.ledger || [];
    const pending = runs
      .filter((run) => isCompletedRun(run))
      .filter((run) => !customerId || run.customerId === customerId || run.userId === customerId)
      .filter((run) => !workspaceId || run.workspaceId === workspaceId)
      .filter((run) => !exactRunIds.has(run.runId))
      .map((run) => ({
        runId: run.runId,
        customerId: run.customerId || run.userId || "",
        workspaceId: run.workspaceId || "",
        createdAt: run.createdAt || null,
        completedAt: completionTimestamp(run),
        status: run.status || (isCompletedRun(run) ? "completed" : "unknown"),
        pendingHours: Math.max(0, ((Date.now()) - Date.parse(completionTimestamp(run) || run.createdAt || Date.now())) / 3600000),
        pricingSource: "metering pending",
        chargeState: systemLedgerEntriesForRun({ ledger }, run.runId).some((entry) => entry.type === "exact_resource_charge") ? "charged_from_exact_bill" : "unbilled",
      }))
      .sort((a, b) => Number(b.pendingHours || 0) - Number(a.pendingHours || 0));

    const riskByUserMap = new Map();
    const riskByWorkspaceMap = new Map();
    for (const item of pending) {
      const currentUser = riskByUserMap.get(item.customerId) || {
        customerId: item.customerId,
        pendingCount: 0,
        oldestPendingHours: 0,
        chargedFromExactBillCount: 0,
      };
      currentUser.pendingCount += 1;
      currentUser.oldestPendingHours = Math.max(currentUser.oldestPendingHours, Number(item.pendingHours || 0));
      if (item.chargeState === "charged_from_exact_bill") currentUser.chargedFromExactBillCount += 1;
      riskByUserMap.set(item.customerId, currentUser);

      const workspaceKey = `${item.customerId}:${item.workspaceId}`;
      const currentWorkspace = riskByWorkspaceMap.get(workspaceKey) || {
        customerId: item.customerId,
        workspaceId: item.workspaceId,
        pendingCount: 0,
        oldestPendingHours: 0,
        chargedFromExactBillCount: 0,
      };
      currentWorkspace.pendingCount += 1;
      currentWorkspace.oldestPendingHours = Math.max(currentWorkspace.oldestPendingHours, Number(item.pendingHours || 0));
      if (item.chargeState === "charged_from_exact_bill") currentWorkspace.chargedFromExactBillCount += 1;
      riskByWorkspaceMap.set(workspaceKey, currentWorkspace);
    }

    const riskByUser = [...riskByUserMap.values()]
      .sort((a, b) => b.pendingCount - a.pendingCount || b.oldestPendingHours - a.oldestPendingHours)
      .slice(0, 10);

    const riskByWorkspace = [...riskByWorkspaceMap.values()]
      .sort((a, b) => b.pendingCount - a.pendingCount || b.oldestPendingHours - a.oldestPendingHours)
      .slice(0, 10);

    return {
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      pendingCount: pending.length,
      oldestPendingHours: pending[0] ? Number(pending[0].pendingHours.toFixed(2)) : 0,
      runs: pending,
      pendingSummary,
      exactSummary: summary,
      unattributedSummary: summary.unattributed || buildUnattributedSummary([], customerId, workspaceId),
      riskByUser,
      riskByWorkspace,
    };
  }

  function printCliUsage() {
    console.log([
      "Usage:",
      "  node src/server.mjs",
      "  node src/server.mjs reconcile [--customer-id <id>] [--workspace-id <id>] [--window <range>]",
    ].join("\n"));
  }

  async function runSingleReconcile({ customerId = "", workspaceId = "", windowValue = AUTO_RECONCILE_WINDOW, target = {} } = {}) {
    try {
      return await reconcileCharges(customerId, workspaceId, windowValue, target);
    } catch (error) {
      reconcileState = {
        ...reconcileState,
        lastRunAt: new Date().toISOString(),
        lastWindow: windowValue || AUTO_RECONCILE_WINDOW,
        lastScope: workspaceId ? `workspace:${workspaceId}` : (customerId || "all"),
        lastError: String(error),
      };
      await logRuntimeEvent({ type: "billing_reconcile_failed", error: String(error), ...reconcileState });
      throw error;
    }
  }

  async function runAutoReconcileLoop() {
    if (!AUTO_RECONCILE_ENABLED || reconcileLoopRunning) {
      return;
    }
    reconcileLoopRunning = true;
    try {
      await runSingleReconcile({ windowValue: AUTO_RECONCILE_WINDOW });
    } finally {
      reconcileLoopRunning = false;
    }
  }

  function scheduleAutoReconcileLoop({
    setTimeoutFn = setTimeout,
    setIntervalFn = setInterval,
    initialDelayMs = 1500,
  } = {}) {
    if (!AUTO_RECONCILE_ENABLED) return false;
    setTimeoutFn(() => {
      runAutoReconcileLoop().catch(() => {});
    }, initialDelayMs);
    setIntervalFn(() => {
      runAutoReconcileLoop().catch(() => {});
    }, AUTO_RECONCILE_INTERVAL_MS);
    return true;
  }

  return {
    getReconcileState,
    listPendingRuns,
    printCliUsage,
    reconcileCharges,
    runAutoReconcileLoop,
    runSingleReconcile,
    scheduleAutoReconcileLoop,
  };
}
