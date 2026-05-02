import assert from "node:assert/strict";

const { createBillingSummaryRuntime } = await import("../adapters/billing-aggregator/src/billing-summary-runtime.mjs");

const runtime = createBillingSummaryRuntime({
  env: {
    TENCENT_BILLING_ENABLED: false,
    TENCENT_BILLING_REQUIRED: false,
    OPENCOST_BASE_URL: "",
  },
  deps: {
    buildUnattributedSummary: (items = [], customerId = "", workspaceId = "") => ({
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      itemCount: items.length,
      items,
      source: "unattributed_stub",
    }),
    summaryFromTencentBillRows: (rows = [], customerId = "", workspaceId = "") => ({
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      runs: rows,
      items: rows,
      unattributed: { itemCount: 0, items: [] },
      source: "tencent_cloud_bill",
      cloudSource: "tencent_cloud_bill",
      totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
      itemCount: rows.length,
    }),
    zeroTotals: () => ({ cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 }),
    fetchAllocation: async () => {
      throw new Error("fetchAllocation should not be called");
    },
    fetchTencentBillSummary: async () => {
      throw new Error("fetchTencentBillSummary should not be called");
    },
    fetchCosExactSummary: async () => ({
      customerId: "tenant-cos",
      workspaceId: "ws-cos",
      runs: [{ runId: "run-cos", totalCost: 9.9 }],
      items: [{ name: "run-cos", totalCost: 9.9 }],
      unattributed: { itemCount: 1, items: [{ reason: "missing_tag" }] },
      source: "tencent_cos_daily_bill",
      cloudSource: "tencent_cloud_cos_bill_delivery",
      totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 9.9 },
      itemCount: 1,
    }),
    normalizeCosTarget: (target = {}) => ({
      objectKey: String(target.objectKey || "").trim(),
      prefix: String(target.prefix || "").trim(),
    }),
    summarize: () => ({
      customerId: "tenant-agg",
      workspaceId: "ws-agg",
      runs: [{ runId: "run-pending-agg", totalCost: 3.2 }],
      items: [{ name: "run-pending-agg", totalCost: 3.2 }],
      totals: { cpuCost: 1, gpuCost: 1, pvCost: 1.2, totalCost: 3.2 },
      itemCount: 1,
    }),
    asEntries: (value) => value?.items || [],
    summaryFromRawAllocations: () => ({
      customerId: "tenant-raw",
      workspaceId: "ws-raw",
      runs: [{ runId: "run-pending-raw", totalCost: 1.5 }],
      items: [{ name: "run-pending-raw", totalCost: 1.5 }],
      totals: { cpuCost: 0.5, gpuCost: 0, pvCost: 1, totalCost: 1.5 },
      itemCount: 1,
    }),
    pendingRequestedRunCosts: async () => [{ runId: "run-pending-local", totalCost: 2.4 }],
    summaryFromPendingRuns: (runs = [], customerId = "", workspaceId = "") => ({
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      runs,
      items: runs,
      totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
      itemCount: runs.length,
    }),
    now: () => "2026-05-02T00:00:00.000Z",
  },
});

const unavailable = runtime.buildUnavailableSummary("tenant-none", "ws-none");
assert.equal(unavailable.source, "unavailable");
assert.equal(unavailable.cloudSource, "not_connected");
assert.equal(unavailable.itemCount, 0);

const pendingEnvelope = runtime.buildBillingEnvelope({
  customerId: "tenant-a",
  workspaceId: "ws-a",
  exactSummary: runtime.buildUnavailableSummary("tenant-a", "ws-a", "exact_unavailable", "not_connected"),
  pendingSummary: {
    customerId: "tenant-a",
    workspaceId: "ws-a",
    source: "metering_pending",
    cloudSource: "local_requested_resources",
    runs: [{ runId: "run-pending" }],
    items: [{ name: "run-pending" }],
    totals: { cpuCost: 1, gpuCost: 0, pvCost: 0, totalCost: 1 },
    itemCount: 1,
  },
});
assert.equal(pendingEnvelope.chargeBasis, "pending");
assert.equal(pendingEnvelope.exactAvailable, false);
assert.equal(pendingEnvelope.pending.source, "metering_pending");
assert.equal(pendingEnvelope.unattributed.source, "unattributed_stub");

const exactSummary = await runtime.fetchExactSummary("tenant-cos", "ws-cos", "7d", { objectKey: "daily/2026-05-01.csv" });
assert.equal(exactSummary.source, "tencent_cos_daily_bill");
assert.equal(exactSummary.runs[0].runId, "run-cos");

const exactEnvelope = runtime.buildBillingEnvelope({
  customerId: "tenant-cos",
  workspaceId: "ws-cos",
  exactSummary,
  pendingSummary: runtime.buildUnavailableSummary("tenant-cos", "ws-cos", "pending_unavailable", "local_metering_unmatched"),
  unattributedSummary: exactSummary.unattributed,
});
assert.equal(exactEnvelope.chargeBasis, "exact");
assert.equal(exactEnvelope.exactAvailable, true);
assert.equal(exactEnvelope.settlement.ready, true);
assert.equal(exactEnvelope.unattributed.itemCount, 1);

const pendingSummary = await runtime.fetchPendingSummary("tenant-pending", "ws-pending", "24h");
assert.equal(pendingSummary.source, "metering_pending");
assert.equal(pendingSummary.cloudSource, "local_requested_resources");
assert.equal(pendingSummary.runs[0].runId, "run-pending-local");

{
  let forwardedTarget = null;
  const tencentRuntime = createBillingSummaryRuntime({
    env: {
      TENCENT_BILLING_ENABLED: true,
      TENCENT_BILLING_REQUIRED: true,
      OPENCOST_BASE_URL: "",
    },
    deps: {
      buildUnattributedSummary: (items = []) => ({ itemCount: items.length, items }),
      zeroTotals: () => ({ cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 }),
      fetchAllocation: async () => ({}),
      fetchTencentBillSummary: async (_customerId, _workspaceId, _windowValue, target) => {
        forwardedTarget = target;
        return {
          runs: [{ runId: target.runId, resourceOrderId: target.resourceOrderId, totalCost: 0 }],
          items: [],
          totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
          unattributed: { itemCount: 0, items: [] },
        };
      },
      fetchCosExactSummary: async () => {
        throw new Error("must_not_call_cos_for_l3_target");
      },
      normalizeCosTarget: (target = {}) => ({
        objectKey: String(target.objectKey || "").trim(),
        prefix: String(target.prefix || "").trim(),
      }),
      summarize: () => ({ runs: [], items: [] }),
      asEntries: (value) => value?.items || [],
      summaryFromRawAllocations: () => ({ runs: [], items: [] }),
      pendingRequestedRunCosts: async () => [],
      summaryFromPendingRuns: (runs = []) => ({ runs, items: runs }),
    },
  });

  await tencentRuntime.fetchExactSummary("tenant-l3", "ws-l3", "7d", {
    resourceOrderId: "order-l3",
    runId: "run-l3",
    queryBeginTime: "2026-05-02 16:56:14",
    queryEndTime: "2026-05-02 19:00:43",
  });

  assert.equal(forwardedTarget.resourceOrderId, "order-l3", "l3_target_must_preserve_resource_order_id");
  assert.equal(forwardedTarget.runId, "run-l3", "l3_target_must_preserve_run_id");
  assert.equal(forwardedTarget.queryBeginTime, "2026-05-02 16:56:14", "l3_target_must_preserve_query_begin_time");
  assert.equal(forwardedTarget.queryEndTime, "2026-05-02 19:00:43", "l3_target_must_preserve_query_end_time");
}

console.log(JSON.stringify({ ok: true, contract: "billing_summary_runtime" }, null, 2));
