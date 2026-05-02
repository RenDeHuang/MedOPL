import {
  applyExactChargeForOrder,
  applySettlementAdjustmentForOrder,
  normalizeLedgerEntries,
  normalizeResourceOrder,
} from "./ledger-contract.mjs";
import { formatTencentTime } from "./tencent-billing-runtime.mjs";

export const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "cancelled", "canceled", "timed_out", "completed"]);

export function isCompletedRun(run) {
  const status = String(run?.status || "").toLowerCase();
  if (TERMINAL_RUN_STATUSES.has(status)) {
    return true;
  }
  return Boolean(
    run?.k8sStatus?.succeeded ||
      run?.k8sStatus?.conditions?.some?.((item) => ["Complete", "Failed"].includes(item.type) && item.status === "True")
  );
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
  return `tencent_l3_bill:${String(runCost.resourceOrderId || runCost.runId || "unknown").trim()}`;
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

export function resolveResourceOrderForReconcile(db, run, runCost) {
  const orders = Array.isArray(db?.resourceOrders) ? db.resourceOrders : [];
  const resourceOrderId = String(runCost?.resourceOrderId || "").trim();
  if (resourceOrderId) {
    const direct = orders.find((item) => item.id === resourceOrderId);
    if (direct) return direct;
  }

  const runId = String(runCost?.runId || run?.runId || "").trim();
  const workspaceId = String(runCost?.workspaceId || run?.workspaceId || "").trim();
  const customerId = String(runCost?.customerId || run?.customerId || run?.userId || "").trim();
  const matchByRun = orders.filter((item) => item.runId === runId && item.workspaceId === workspaceId && [item.userId, item.portalUserId, item.tenantId].includes(customerId));
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
    const startedAtRaw = String(target.billingStartedAt || run.billingStartedAt || "").trim();
    const stoppedAtRaw = String(target.billingStoppedAt || run.billingStoppedAt || "").trim();
    const waitMinutes = Number(target.l3ExactWaitMinutes ?? l3ExactWaitMinutes);
    if (!startedAtRaw || !stoppedAtRaw || !Number.isFinite(waitMinutes) || waitMinutes < 0) {
      return { ok: false, reason: "missing_l3_settlement_window" };
    }
    const startedAt = Date.parse(startedAtRaw);
    const stoppedAt = Date.parse(stoppedAtRaw);
    if (!Number.isFinite(startedAt) || !Number.isFinite(stoppedAt) || stoppedAt < startedAt) {
      return { ok: false, reason: "invalid_l3_settlement_window" };
    }
    const nowMs = Date.parse(now());
    const earliestExactWriteAt = stoppedAt + waitMinutes * 60_000;
    if (!Number.isFinite(nowMs) || nowMs < earliestExactWriteAt) {
      return {
        ok: false,
        reason: "pending_l3_settlement_window",
        billingStartedAt: startedAtRaw,
        billingStoppedAt: stoppedAtRaw,
        earliestExactWriteAt: new Date(earliestExactWriteAt).toISOString(),
        l3ExactWaitMinutes: waitMinutes,
      };
    }
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
    };
  }

  function exactMapKey(value = {}) {
    return [
      String(value.resourceOrderId || "").trim(),
      String(value.runId || "").trim(),
    ].join("\u0000");
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
    const candidateRuns = runs.filter((run) => {
      if (!isCompletedRun(run)) return false;
      if (customerId && run.customerId !== customerId && run.userId !== customerId) return false;
      if (workspaceId && run.workspaceId !== workspaceId) return false;
      return true;
    });

    for (const run of candidateRuns) {
      const gate = l3WindowGate(run, target);
      if (!gate.ok) {
        estimatedCount += 1;
        results.push({
          runId: run.runId,
          workspaceId: run.workspaceId || "",
          action: gate.reason,
          pricingSource: "exact_unavailable",
          billingStartedAt: gate.billingStartedAt || null,
          billingStoppedAt: gate.billingStoppedAt || null,
          earliestExactWriteAt: gate.earliestExactWriteAt || null,
          l3ExactWaitMinutes: gate.l3ExactWaitMinutes || null,
        });
        continue;
      }

      const runTarget = reconcileTargetForRun(run, gate, target);
      const summary = await fetchExactSummary(
        customerId || runTarget.customerId || "",
        workspaceId || runTarget.workspaceId || "",
        windowValue || "7d",
        runTarget,
      );
      unattributedItems.push(...(summary.unattributed?.items || []));
      const exactMap = new Map((summary.runs || []).map((item) => [exactMapKey(item), item]));
      const runCost = exactMap.get(exactMapKey(runTarget));
      if (!runCost || !runCost.customerId) {
        estimatedCount += 1;
        results.push({
          runId: run.runId,
          workspaceId: run.workspaceId || "",
          action: "pending_exact_bill",
          pricingSource: "exact_unavailable",
        });
        continue;
      }
      if (!isCompletedRun(run)) continue;

      const wallet = db.wallets?.find((item) => item.userId === runCost.customerId);
      if (!wallet) {
        results.push({
          runId: run.runId,
          workspaceId: run.workspaceId || "",
          action: "wallet_missing",
          pricingSource: runCost.pricingSource,
        });
        continue;
      }

      const order = resolveResourceOrderForReconcile(db, run, runCost);
      if (!order) {
        results.push({
          runId: run.runId,
          workspaceId: run.workspaceId || "",
          action: "resource_order_missing",
          pricingSource: runCost.pricingSource,
        });
        continue;
      }

      const systemEntries = systemLedgerEntriesForOrderRun(db, {
        resourceOrderId: order.id,
        runId: runCost.runId,
      });
      const baseCharge = systemEntries.find((entry) => entry.type === "exact_resource_charge");
      const targetNetCharge = Number(runCost.totalCost || 0);

      if (targetNetCharge <= 0 && !baseCharge) {
        exactCount += 1;
        results.push({
          runId: runCost.runId,
          workspaceId: runCost.workspaceId,
          action: "unattributed",
          reason: "exact_bill_zero_cost",
          targetTotalCost: targetNetCharge,
          pricingSource: runCost.pricingSource,
          matchedResourceId: runCost.properties?.matched_resource_id || runCost.sources?.[0] || "",
          resourceMappingId: runCost.properties?.resource_mapping_id || "",
        });
        continue;
      }

      if (!baseCharge) {
        applyExactChargeForOrder(db, {
          user: { id: runCost.customerId },
          order,
          exactCost: Number(runCost.totalCost || 0),
          sourceId: exactSettlementSourceId(runCost),
        });

        exactCount += 1;

        results.push({
          runId: runCost.runId,
          workspaceId: runCost.workspaceId,
          action: "charged",
          charged: Number(runCost.totalCost || 0),
          newBalance: wallet.balance,
          pricingSource: runCost.pricingSource
        });

        continue;
      }

      const currentNetCharge = systemLedgerNetCharge(systemEntries);
      const delta = Number((targetNetCharge - currentNetCharge).toFixed(6));

      if (Math.abs(delta) < 0.000001) {
        exactCount += 1;
        continue;
      }

      const adjustmentType = delta > 0 ? "makeup_charge" : "refund";
      applySettlementAdjustmentForOrder(db, {
        user: { id: runCost.customerId },
        order,
        type: adjustmentType,
        amount: Math.abs(delta),
        sourceId: `${exactSettlementSourceId(runCost)}:${targetNetCharge.toFixed(2)}`,
        reason: "auto_reconcile_tencent_bill_delta",
      });
      exactCount += 1;
      adjustmentCount += 1;

      results.push({
        runId: runCost.runId,
        workspaceId: runCost.workspaceId,
        action: adjustmentType,
        adjustment: Math.abs(delta),
        targetTotalCost: targetNetCharge,
        previousNetCharge: currentNetCharge,
        newBalance: wallet.balance,
        pricingSource: runCost.pricingSource
      });
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
