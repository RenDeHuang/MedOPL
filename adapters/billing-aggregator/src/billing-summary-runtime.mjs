export function createBillingSummaryRuntime({
  env = {},
  deps = {},
} = {}) {
  const {
    TENCENT_BILLING_ENABLED = false,
    TENCENT_BILLING_REQUIRED = false,
    OPENCOST_BASE_URL = "",
  } = env;
  const {
    buildUnattributedSummary,
    zeroTotals,
    fetchAllocation,
    fetchTencentBillSummary,
    fetchCosExactSummary,
    normalizeCosTarget,
    summarize,
    asEntries,
    summaryFromRawAllocations,
    pendingRequestedRunCosts,
    summaryFromPendingRuns,
    onExactBillSuccess = () => {},
    onExactBillError = () => {},
  } = deps;

  if (typeof buildUnattributedSummary !== "function") throw new Error("buildUnattributedSummary is required");
  if (typeof zeroTotals !== "function") throw new Error("zeroTotals is required");
  if (typeof fetchCosExactSummary !== "function") throw new Error("fetchCosExactSummary is required");
  if (typeof normalizeCosTarget !== "function") throw new Error("normalizeCosTarget is required");
  if (typeof summarize !== "function") throw new Error("summarize is required");
  if (typeof asEntries !== "function") throw new Error("asEntries is required");
  if (typeof summaryFromRawAllocations !== "function") throw new Error("summaryFromRawAllocations is required");
  if (typeof pendingRequestedRunCosts !== "function") throw new Error("pendingRequestedRunCosts is required");
  if (typeof summaryFromPendingRuns !== "function") throw new Error("summaryFromPendingRuns is required");

  function buildUnavailableSummary(customerId = "", workspaceId = "", source = "unavailable", cloudSource = "not_connected") {
    return {
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      source,
      cloudSource,
      itemCount: 0,
      totals: zeroTotals(),
      runs: [],
      items: [],
    };
  }

  function buildBillingEnvelope({ customerId = "", workspaceId = "", exactSummary = null, pendingSummary = null, unattributedSummary = null }) {
    const exact = exactSummary && Array.isArray(exactSummary.runs) && exactSummary.runs.length > 0
      ? exactSummary
      : null;
    const pending = pendingSummary && Array.isArray(pendingSummary.runs) && pendingSummary.runs.length > 0
      ? pendingSummary
      : null;
    const unattributed = unattributedSummary || buildUnattributedSummary([], customerId, workspaceId);
    const chargeBasis = exact ? "exact" : (pending ? "pending" : "unavailable");
    const primary = exact || pending || buildUnavailableSummary(customerId, workspaceId);

    return {
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      source: primary.source,
      cloudSource: primary.cloudSource,
      chargeBasis,
      exactAvailable: Boolean(exact),
      settlement: {
        ready: Boolean(exact),
        mode: "exact_only",
        reason: exact ? "tencent_cloud_bill" : "pending_exact_bill",
      },
      itemCount: primary.itemCount || 0,
      totals: primary.totals || zeroTotals(),
      runs: primary.runs || [],
      items: primary.items || [],
      exact: exact || buildUnavailableSummary(customerId, workspaceId, "exact_unavailable", TENCENT_BILLING_ENABLED ? "tencent_cloud_unmatched" : "not_connected"),
      pending: pending || buildUnavailableSummary(customerId, workspaceId, "pending_unavailable", OPENCOST_BASE_URL ? "opencost_unmatched" : "local_metering_unmatched"),
      unattributed,
    };
  }

  async function fetchExactSummary(customerId = "", workspaceId = "", windowValue = "7d", target = {}) {
    const cosTarget = normalizeCosTarget(target);
    if (cosTarget.objectKey || cosTarget.prefix) {
      return fetchCosExactSummary(customerId, workspaceId, cosTarget);
    }
    if (TENCENT_BILLING_ENABLED) {
      try {
        const normalizedTarget = {
          ...(target && typeof target === "object" && !Array.isArray(target) ? target : {}),
          ...cosTarget,
        };
        const tencentSummary = await fetchTencentBillSummary(customerId, workspaceId, windowValue, normalizedTarget);
        onExactBillSuccess(tencentSummary);
        if (tencentSummary.runs.length > 0 || tencentSummary.unattributed?.itemCount > 0 || TENCENT_BILLING_REQUIRED) {
          return tencentSummary;
        }
      } catch (error) {
        onExactBillError(error);
        if (TENCENT_BILLING_REQUIRED) {
          throw error;
        }
      }
    }

    return buildUnavailableSummary(
      customerId,
      workspaceId,
      "exact_unavailable",
      TENCENT_BILLING_ENABLED ? "tencent_cloud_unmatched" : "not_connected",
    );
  }

  async function fetchPendingSummary(customerId = "", workspaceId = "", windowValue = "7d") {
    if (OPENCOST_BASE_URL) {
      try {
        const aggregated = await fetchAllocation(windowValue, "label:customer_id,label:workspace_id,label:run_id");
        const aggregatedSummary = summarize(asEntries(aggregated?.data), customerId, workspaceId);
        if (aggregatedSummary.runs.length > 0) {
          aggregatedSummary.source = "opencost_pending";
          aggregatedSummary.cloudSource = "opencost";
          return aggregatedSummary;
        }

        const raw = await fetchAllocation(windowValue);
        const rawSummary = summaryFromRawAllocations(asEntries(raw?.data), customerId, workspaceId);
        if (rawSummary.runs.length > 0) {
          rawSummary.source = "opencost_pending";
          rawSummary.cloudSource = "opencost";
          return rawSummary;
        }
      } catch {}
    }

    const requestedPending = await pendingRequestedRunCosts(customerId, workspaceId);
    if (requestedPending.length > 0) {
      const summary = summaryFromPendingRuns(requestedPending, customerId, workspaceId);
      summary.source = "metering_pending";
      summary.cloudSource = "local_requested_resources";
      return summary;
    }

    return buildUnavailableSummary(
      customerId,
      workspaceId,
      "pending_unavailable",
      OPENCOST_BASE_URL ? "opencost_unmatched" : "local_metering_unmatched",
    );
  }

  return {
    buildUnavailableSummary,
    buildBillingEnvelope,
    fetchExactSummary,
    fetchPendingSummary,
  };
}
