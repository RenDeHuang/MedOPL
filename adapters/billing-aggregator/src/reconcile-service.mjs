import {
  applyExactChargeForOrder,
  applySettlementAdjustmentForOrder,
  normalizeLedgerEntries,
  normalizeResourceOrder,
} from "./ledger-contract.mjs";
import { formatTencentTime } from "./tencent-billing-runtime.mjs";

export const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "cancelled", "canceled", "timed_out", "completed"]);
const TERMINAL_K8S_CONDITIONS = new Set(["Complete", "Failed"]);

function hasTerminalK8sCondition(run) {
  return run?.k8sStatus?.conditions?.some?.((item) =>
    TERMINAL_K8S_CONDITIONS.has(item.type) &&
    item.status === "True"
  );
}

export function isCompletedRun(run) {
  const status = String(run?.status || "").toLowerCase();
  if (TERMINAL_RUN_STATUSES.has(status)) {
    return true;
  }
  return Boolean(run?.k8sStatus?.succeeded || hasTerminalK8sCondition(run));
}

export function systemLedgerEntriesForRun(db, runId) {
  return normalizeLedgerEntries(db?.ledger || []).filter((entry) => {
    if (entry.runId !== runId) return false;
    if (entry.type === "exact_resource_charge") return true;
    return entry.sourceType === "auto_reconcile" && (entry.type === "refund" || entry.type === "makeup_charge");
  });
}

export function systemLedgerEntriesForOrderRun(db, { resourceOrderId = "", runId = "" } = {}) {
  const normalizedResourceOrderId = String(resourceOrderId || "").trim();
  const normalizedRunId = String(runId || "").trim();
  return normalizeLedgerEntries(db?.ledger || []).filter((entry) => {
    if (normalizedResourceOrderId && entry.resourceOrderId !== normalizedResourceOrderId) return false;
    if (normalizedRunId && entry.runId !== normalizedRunId) return false;
    if (entry.type === "exact_resource_charge") return true;
    return entry.sourceType === "auto_reconcile" && (entry.type === "refund" || entry.type === "makeup_charge");
  });
}

export function systemLedgerNetCharge(entries = []) {
  return Number(entries.reduce((sum, entry) => {
    const amount = Math.abs(Number(entry.amount || 0));
    if (entry.type === "exact_resource_charge" || entry.type === "makeup_charge") {
      return sum + amount;
    }
    if (entry.type === "refund") {
      return sum - amount;
    }
    return sum;
  }, 0).toFixed(6));
}

export function exactSettlementSourceId(runCost = {}) {
  const objectKey = firstString(runCost.objectKey, runCost.billObjectKey);
  const tenantId = firstString(runCost.tenantId, runCost.customerId);
  const resourceOrderId = firstString(runCost.resourceOrderId);
  const runId = firstString(runCost.runId);
  return [
    "tencent_exact_bill",
    objectKey || "no-object",
    resourceOrderId || "no-order",
    runId || "no-run",
    tenantId || "no-tenant",
  ].join(":");
}

export function formatL3QueryTime(date) {
  return formatTencentTime(date);
}

function firstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function exactBillWindowGate(run = {}, target = {}, waitMinutes = 120) {
  const exactBillObjectKey = firstString(target.objectKey, target.billObjectKey);
  if (!exactBillObjectKey) return null;
  return {
    ok: true,
    billingStartedAt: firstString(target.billingStartedAt, run.billingStartedAt),
    billingStoppedAt: firstString(target.billingStoppedAt, run.billingStoppedAt),
    queryBeginTime: firstString(target.queryBeginTime),
    queryEndTime: firstString(target.queryEndTime),
    earliestExactWriteAt: "",
    l3ExactWaitMinutes: Number(target.l3ExactWaitMinutes ?? waitMinutes),
  };
}

function l3WindowInputs(run = {}, target = {}, defaultWaitMinutes = 120) {
  return {
    startedAtRaw: firstString(target.billingStartedAt, run.billingStartedAt),
    stoppedAtRaw: firstString(target.billingStoppedAt, run.billingStoppedAt),
    waitMinutes: Number(target.l3ExactWaitMinutes ?? defaultWaitMinutes),
  };
}

function validateL3WindowInput({ startedAtRaw, stoppedAtRaw, waitMinutes }) {
  if (!startedAtRaw || !stoppedAtRaw || !Number.isFinite(waitMinutes) || waitMinutes < 0) {
    return { ok: false, reason: "missing_l3_settlement_window" };
  }
  const startedAt = Date.parse(startedAtRaw);
  const stoppedAt = Date.parse(stoppedAtRaw);
  if (!Number.isFinite(startedAt) || !Number.isFinite(stoppedAt) || stoppedAt < startedAt) {
    return { ok: false, reason: "invalid_l3_settlement_window" };
  }
  return { ok: true, startedAt, stoppedAt };
}

function pendingL3Window({ startedAtRaw, stoppedAtRaw, waitMinutes, earliestExactWriteAt }) {
  return {
    ok: false,
    reason: "pending_l3_settlement_window",
    billingStartedAt: startedAtRaw,
    billingStoppedAt: stoppedAtRaw,
    earliestExactWriteAt: new Date(earliestExactWriteAt).toISOString(),
    l3ExactWaitMinutes: waitMinutes,
  };
}

function settledL3Window({ startedAtRaw, stoppedAtRaw, startedAt, waitMinutes, earliestExactWriteAt }) {
  return {
    ok: true,
    billingStartedAt: startedAtRaw,
    billingStoppedAt: stoppedAtRaw,
    queryBeginTime: formatL3QueryTime(new Date(startedAt)),
    queryEndTime: formatL3QueryTime(new Date(earliestExactWriteAt)),
    earliestExactWriteAt: new Date(earliestExactWriteAt).toISOString(),
    l3ExactWaitMinutes: waitMinutes,
  };
}

function unreconciledGateResult(run = {}, gate = {}) {
  return {
    runId: run.runId,
    workspaceId: run.workspaceId || "",
    action: gate.reason,
    pricingSource: "exact_unavailable",
    billingStartedAt: gate.billingStartedAt || null,
    billingStoppedAt: gate.billingStoppedAt || null,
    earliestExactWriteAt: gate.earliestExactWriteAt || null,
    l3ExactWaitMinutes: gate.l3ExactWaitMinutes || null,
  };
}

function pendingExactBillResult(run = {}) {
  return {
    runId: run.runId,
    workspaceId: run.workspaceId || "",
    action: "pending_exact_bill",
    pricingSource: "exact_unavailable",
  };
}

function walletMissingResult(run = {}, runCost = {}) {
  return {
    runId: run.runId,
    workspaceId: run.workspaceId || "",
    action: "wallet_missing",
    pricingSource: runCost.pricingSource,
  };
}

function orderMissingResult(run = {}, runCost = {}) {
  return {
    runId: run.runId,
    workspaceId: run.workspaceId || "",
    action: "resource_order_missing",
    pricingSource: runCost.pricingSource,
  };
}

function zeroCostUnattributedResult(runCost = {}, targetNetCharge = 0) {
  return {
    runId: runCost.runId,
    workspaceId: runCost.workspaceId,
    action: "unattributed",
    reason: "exact_bill_zero_cost",
    targetTotalCost: targetNetCharge,
    pricingSource: runCost.pricingSource,
    matchedResourceId: runCost.properties?.matched_resource_id || runCost.sources?.[0] || "",
    resourceMappingId: runCost.properties?.resource_mapping_id || "",
  };
}

function chargedResult(runCost = {}, wallet = {}) {
  return {
    runId: runCost.runId,
    workspaceId: runCost.workspaceId,
    action: "charged",
    charged: Number(runCost.totalCost || 0),
    newBalance: wallet.balance,
    pricingSource: runCost.pricingSource,
  };
}

function adjustmentResult({ runCost = {}, adjustmentType = "", delta = 0, targetNetCharge = 0, currentNetCharge = 0, wallet = {} }) {
  return {
    runId: runCost.runId,
    workspaceId: runCost.workspaceId,
    action: adjustmentType,
    adjustment: Math.abs(delta),
    targetTotalCost: targetNetCharge,
    previousNetCharge: currentNetCharge,
    newBalance: wallet.balance,
    pricingSource: runCost.pricingSource,
  };
}

export function resolveResourceOrderForReconcile(db, run, runCost) {
  const orders = Array.isArray(db?.resourceOrders) ? db.resourceOrders : [];
  const resourceOrderId = String(runCost?.resourceOrderId || "").trim();
  const direct = findDirectResourceOrder(orders, resourceOrderId);
  if (direct) return direct;

  const runId = String(runCost?.runId || run?.runId || "").trim();
  const workspaceId = String(runCost?.workspaceId || run?.workspaceId || "").trim();
  const customerId = String(runCost?.customerId || run?.customerId || run?.userId || "").trim();
  const matchByRun = orders.filter((item) => resourceOrderMatchesRun(item, { runId, workspaceId, customerId }));
  if (matchByRun.length === 1) {
    return matchByRun[0];
  }

  if (!resourceOrderId || !runId || !workspaceId || !customerId) {
    return null;
  }

  return normalizeResourceOrder({
    id: resourceOrderId,
    tenantId: String(runCost?.tenantId || customerId).trim() || customerId,
    userId: customerId,
    portalUserId: customerId,
    workspaceId,
    runId,
    billingAccountId: customerId,
    status: "reconciling",
    serverPlanId: String(runCost?.serverPlanId || "").trim(),
    currency: "CNY",
    pricingSource: String(runCost?.pricingSource || "tencent_cloud_bill").trim(),
    priceUpdatedAt: new Date().toISOString(),
    createdAt: String(run?.createdAt || new Date().toISOString()).trim(),
    updatedAt: new Date().toISOString(),
  });
}

function findDirectResourceOrder(orders, resourceOrderId) {
  return resourceOrderId
    ? orders.find((item) => item.id === resourceOrderId) || null
    : null;
}

function resourceOrderMatchesRun(order, { runId = "", workspaceId = "", customerId = "" } = {}) {
  return order.runId === runId &&
    order.workspaceId === workspaceId &&
    [order.userId, order.portalUserId, order.tenantId].includes(customerId);
}

export function createReconcileService({
  buildUnattributedSummary,
  fetchExactSummary,
  l3ExactWaitMinutes = 120,
  logRuntimeEvent,
  now = () => new Date().toISOString(),
  readPortalDb,
  readRuns,
  writePortalDb,
}) {
  function l3WindowGate(run = {}, target = {}) {
    const exactGate = exactBillWindowGate(run, target, l3ExactWaitMinutes);
    if (exactGate) return exactGate;
    const input = l3WindowInputs(run, target, l3ExactWaitMinutes);
    const validation = validateL3WindowInput(input);
    if (!validation.ok) return validation;
    const nowMs = Date.parse(now());
    const earliestExactWriteAt = validation.stoppedAt + input.waitMinutes * 60_000;
    if (!Number.isFinite(nowMs) || nowMs < earliestExactWriteAt) {
      return pendingL3Window({ ...input, earliestExactWriteAt });
    }
    return settledL3Window({ ...input, startedAt: validation.startedAt, earliestExactWriteAt });
  }

  function reconcileTargetForRun(run = {}, gate = {}, target = {}) {
    return {
      ...target,
      tenantId: firstString(target.tenantId, run.tenantId, run.customerId, run.userId),
      customerId: firstString(target.customerId, run.customerId, run.userId, run.tenantId),
      workspaceId: firstString(target.workspaceId, run.workspaceId),
      resourceOrderId: firstString(target.resourceOrderId, run.resourceOrderId, run.resource_order_id, run.orderId, run.order_id),
      runId: firstString(target.runId, run.runId),
      billingStartedAt: gate.billingStartedAt,
      billingStoppedAt: gate.billingStoppedAt,
      queryBeginTime: gate.queryBeginTime,
      queryEndTime: gate.queryEndTime,
      l3ExactWaitMinutes: gate.l3ExactWaitMinutes,
      objectKey: firstString(target.objectKey, target.billObjectKey),
      billObjectKey: firstString(target.billObjectKey, target.objectKey),
    };
  }

  function exactMapKey(value = {}) {
    return [
      String(value.resourceOrderId || "").trim(),
      String(value.runId || "").trim(),
    ].join("\u0000");
  }

  function exactRunFallbackKey(value = {}) {
    return [
      String(value.runId || "").trim(),
      String(value.workspaceId || "").trim(),
    ].join("\u0000");
  }

  function candidateRunsForReconcile(runs = [], customerId = "", workspaceId = "") {
    return runs.filter((run) => {
      if (!isCompletedRun(run)) return false;
      if (customerId && run.customerId !== customerId && run.userId !== customerId) return false;
      if (workspaceId && run.workspaceId !== workspaceId) return false;
      return true;
    });
  }

  function exactFallbackMap(runs = []) {
    const fallbackMap = new Map();
    for (const item of runs) {
      const key = exactRunFallbackKey(item);
      const current = fallbackMap.get(key) || [];
      current.push(item);
      fallbackMap.set(key, current);
    }
    return fallbackMap;
  }

  function resolveRunCost(summary = {}, runTarget = {}) {
    const exactMap = new Map((summary.runs || []).map((item) => [exactMapKey(item), item]));
    const direct = exactMap.get(exactMapKey(runTarget));
    if (direct) return direct;
    const fallback = exactFallbackMap(summary.runs || []).get(exactRunFallbackKey(runTarget)) || [];
    return fallback.length === 1 ? fallback[0] : null;
  }

  async function exactSummaryForRun({ customerId, workspaceId, windowValue, runTarget }) {
    return fetchExactSummary(
      customerId || runTarget.customerId || "",
      workspaceId || runTarget.workspaceId || "",
      windowValue || "7d",
      runTarget,
    );
  }

  function exactSourceIdForRun(runCost = {}, runTarget = {}, target = {}) {
    return exactSettlementSourceId({
      ...runCost,
      objectKey: firstString(runTarget.objectKey, target.objectKey),
      billObjectKey: firstString(runTarget.billObjectKey, target.billObjectKey),
    });
  }

  function resolveSettlementContext(db, run = {}, runCost = {}, runTarget = {}, target = {}) {
    const wallet = db.wallets?.find((item) => item.userId === runCost.customerId);
    if (!wallet) return { ok: false, result: walletMissingResult(run, runCost), estimated: false };
    const order = resolveResourceOrderForReconcile(db, run, runCost);
    if (!order) return { ok: false, result: orderMissingResult(run, runCost), estimated: false };
    const systemEntries = systemLedgerEntriesForOrderRun(db, {
      resourceOrderId: order.id,
      runId: runCost.runId,
    });
    return {
      ok: true,
      wallet,
      order,
      systemEntries,
      baseCharge: systemEntries.find((entry) => entry.type === "exact_resource_charge"),
      targetNetCharge: Number(runCost.totalCost || 0),
      exactSourceId: exactSourceIdForRun(runCost, runTarget, target),
    };
  }

  function settleRunCost(db, { runCost, wallet, order, systemEntries, baseCharge, targetNetCharge, exactSourceId }) {
    if (targetNetCharge <= 0 && !baseCharge) {
      return { exact: 1, adjustment: 0, result: zeroCostUnattributedResult(runCost, targetNetCharge) };
    }
    if (!baseCharge) {
      applyExactChargeForOrder(db, {
        user: { id: runCost.customerId },
        order,
        exactCost: Number(runCost.totalCost || 0),
        sourceId: exactSourceId,
      });
      return { exact: 1, adjustment: 0, result: chargedResult(runCost, wallet) };
    }

    const currentNetCharge = systemLedgerNetCharge(systemEntries);
    const delta = Number((targetNetCharge - currentNetCharge).toFixed(6));
    if (Math.abs(delta) < 0.000001) return { exact: 1, adjustment: 0, result: null };

    const adjustmentType = delta > 0 ? "makeup_charge" : "refund";
    applySettlementAdjustmentForOrder(db, {
      user: { id: runCost.customerId },
      order,
      type: adjustmentType,
      amount: Math.abs(delta),
      sourceId: `${exactSourceId}:${targetNetCharge.toFixed(2)}`,
      reason: "auto_reconcile_tencent_bill_delta",
    });
    return {
      exact: 1,
      adjustment: 1,
      result: adjustmentResult({ runCost, adjustmentType, delta, targetNetCharge, currentNetCharge, wallet }),
    };
  }

  async function reconcileSingleRun(db, { run, customerId, workspaceId, windowValue, target }) {
    const gate = l3WindowGate(run, target);
    if (!gate.ok) return { estimated: 1, exact: 0, adjustment: 0, result: unreconciledGateResult(run, gate), unattributedItems: [] };

    const runTarget = reconcileTargetForRun(run, gate, target);
    const summary = await exactSummaryForRun({ customerId, workspaceId, windowValue, runTarget });
    const runCost = resolveRunCost(summary, runTarget);
    const unattributedItems = summary.unattributed?.items || [];
    if (!runCost || !runCost.customerId) {
      return { estimated: 1, exact: 0, adjustment: 0, result: pendingExactBillResult(run), unattributedItems };
    }

    const settlement = resolveSettlementContext(db, run, runCost, runTarget, target);
    if (!settlement.ok) return { estimated: 0, exact: 0, adjustment: 0, result: settlement.result, unattributedItems };

    return {
      ...settleRunCost(db, { runCost, ...settlement }),
      estimated: 0,
      unattributedItems,
    };
  }

  return async function reconcileCharges(customerId, workspaceId, windowValue, target = {}) {
    const db = await readPortalDb();
    if (!db) throw new Error("Missing portal DB");

    const runs = await readRuns();

    const results = [];
    let exactCount = 0;
    let estimatedCount = 0;
    let adjustmentCount = 0;
    const unattributedItems = [];
    const candidateRuns = candidateRunsForReconcile(runs, customerId, workspaceId);

    for (const run of candidateRuns) {
      const item = await reconcileSingleRun(db, { run, customerId, workspaceId, windowValue, target });
      estimatedCount += item.estimated;
      exactCount += item.exact;
      adjustmentCount += item.adjustment;
      unattributedItems.push(...item.unattributedItems);
      if (item.result) results.push(item.result);
    }

    await writePortalDb(db);
    const reconcileState = {
      lastRunAt: new Date().toISOString(),
      lastWindow: windowValue || "7d",
      lastScope: workspaceId ? `workspace:${workspaceId}` : (customerId || "all"),
      lastReconciledCount: results.length,
      lastExactCount: exactCount,
      lastEstimatedCount: estimatedCount,
      lastAdjustmentCount: adjustmentCount,
      lastError: "",
    };
    await logRuntimeEvent({ type: "billing_reconcile_completed", ...reconcileState });
    return {
      state: reconcileState,
      result: {
        customerId: customerId || null,
        workspaceId: workspaceId || null,
        reconciledCount: results.length,
        exactCount,
        estimatedCount,
        adjustmentCount,
        settlementMode: "exact_only",
        unattributedSummary: buildUnattributedSummary(unattributedItems, customerId || "", workspaceId || ""),
        results
      },
    };
  };
}
