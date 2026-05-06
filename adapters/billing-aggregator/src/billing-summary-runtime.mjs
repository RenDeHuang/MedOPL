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

  function normalizeDiagnostics(items = []) {
    return Array.isArray(items) ? items : [];
  }

  function errorDetails(code = "", error = null, detail = {}) {
    return {
      code,
      message: String(error?.message || error || code),
      ...detail,
    };
  }

  function finalizeSummary(summary = {}, fallback = {}) {
    return {
      ...summary,
      customerId: summary.customerId ?? fallback.customerId ?? null,
      workspaceId: summary.workspaceId ?? fallback.workspaceId ?? null,
      source: summary.source || fallback.source || "unavailable",
      cloudSource: summary.cloudSource || fallback.cloudSource || "not_connected",
      status: summary.status || fallback.status || "ready",
      warnings: normalizeDiagnostics(summary.warnings || fallback.warnings),
      errors: normalizeDiagnostics(summary.errors || fallback.errors),
    };
  }

  function buildUnavailableSummary(
    customerId = "",
    workspaceId = "",
    source = "unavailable",
    cloudSource = "not_connected",
    {
      status = "unavailable",
      warnings = [],
      errors = [],
    } = {},
  ) {
    return {
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      source,
      cloudSource,
      status,
      warnings: normalizeDiagnostics(warnings),
      errors: normalizeDiagnostics(errors),
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
    const exactIssues = exactSummary && ((exactSummary.errors || []).length > 0 || (exactSummary.warnings || []).length > 0 || exactSummary.status === "error");
    const pendingIssues = pendingSummary && ((pendingSummary.errors || []).length > 0 || (pendingSummary.warnings || []).length > 0 || pendingSummary.status === "error");
    const chargeBasis = exact ? "exact" : (pending ? "pending" : "unavailable");
    const primary = exact
      || pending
      || (pendingIssues ? pendingSummary : null)
      || (exactIssues ? exactSummary : null)
      || buildUnavailableSummary(customerId, workspaceId);
    const warnings = [
      ...normalizeDiagnostics(exactSummary?.warnings),
      ...normalizeDiagnostics(pendingSummary?.warnings),
      ...normalizeDiagnostics(unattributed?.warnings),
    ];
    const errors = [
      ...normalizeDiagnostics(exactSummary?.errors),
      ...normalizeDiagnostics(pendingSummary?.errors),
      ...normalizeDiagnostics(unattributed?.errors),
    ];

    return {
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      source: primary.source,
      cloudSource: primary.cloudSource,
      status: primary.status || (chargeBasis === "unavailable" ? "unavailable" : "ready"),
      warnings,
      errors,
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
      exact: finalizeSummary(
        exactSummary || buildUnavailableSummary(customerId, workspaceId, "exact_unavailable", TENCENT_BILLING_ENABLED ? "tencent_cloud_unmatched" : "not_connected"),
        { customerId, workspaceId },
      ),
      pending: finalizeSummary(
        pendingSummary || buildUnavailableSummary(customerId, workspaceId, "pending_unavailable", "local_metering_unmatched"),
        { customerId, workspaceId },
      ),
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
        const tencentSummary = finalizeSummary(
          await fetchTencentBillSummary(customerId, workspaceId, windowValue, normalizedTarget),
          {
            customerId,
            workspaceId,
            source: "tencent_cloud_bill",
            cloudSource: "tencent_cloud_bill",
            status: "ready",
          },
        );
        onExactBillSuccess(tencentSummary);
        if (tencentSummary.runs.length > 0 || tencentSummary.unattributed?.itemCount > 0 || TENCENT_BILLING_REQUIRED) {
          return tencentSummary;
        }
      } catch (error) {
        onExactBillError(error);
        if (TENCENT_BILLING_REQUIRED) {
          throw error;
        }
        return buildUnavailableSummary(
          customerId,
          workspaceId,
          "exact_error",
          "tencent_cloud_error",
          {
            status: "error",
            errors: [errorDetails("tencent_bill_summary_failed", error)],
          },
        );
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
    const requestedPending = await pendingRequestedRunCosts(customerId, workspaceId);
    if (requestedPending.length > 0) {
      const summary = finalizeSummary(
        summaryFromPendingRuns(requestedPending, customerId, workspaceId),
        {
          customerId,
          workspaceId,
          source: "local_metering_pending",
          cloudSource: "platform_provisioned_local_metering",
          status: "ready",
        },
      );
      summary.source = "local_metering_pending";
      summary.cloudSource = "platform_provisioned_local_metering";
      return summary;
    }

    const warnings = [];
    const errors = [];

    if (OPENCOST_BASE_URL) {
      try {
        const aggregated = await fetchAllocation(windowValue, "label:customer_id,label:workspace_id,label:run_id");
        const aggregatedSummary = finalizeSummary(
          summarize(asEntries(aggregated?.data), customerId, workspaceId),
          {
            customerId,
            workspaceId,
            source: "local_metering_pending",
            cloudSource: "platform_provisioned_local_metering",
          },
        );
        if (aggregatedSummary.runs.length > 0) {
          aggregatedSummary.source = "local_metering_pending";
          aggregatedSummary.cloudSource = "platform_provisioned_local_metering";
          aggregatedSummary.warnings = [...warnings, ...normalizeDiagnostics(aggregatedSummary.warnings)];
          aggregatedSummary.errors = [...errors, ...normalizeDiagnostics(aggregatedSummary.errors)];
          return aggregatedSummary;
        }
      } catch (error) {
        errors.push(errorDetails("opencost_aggregated_allocation_failed", error));
      }

      try {
        const raw = await fetchAllocation(windowValue);
        const rawSummary = finalizeSummary(
          summaryFromRawAllocations(asEntries(raw?.data), customerId, workspaceId),
          {
            customerId,
            workspaceId,
            source: "local_metering_pending",
            cloudSource: "platform_provisioned_local_metering",
          },
        );
        if (rawSummary.runs.length > 0 || rawSummary.unattributed?.itemCount > 0) {
          rawSummary.source = "local_metering_pending";
          rawSummary.cloudSource = "platform_provisioned_local_metering";
          rawSummary.warnings = [...warnings, ...normalizeDiagnostics(rawSummary.warnings)];
          rawSummary.errors = [...errors, ...normalizeDiagnostics(rawSummary.errors)];
          if (errors.length > 0 && rawSummary.status === "ready") {
            rawSummary.status = "partial";
          }
          return rawSummary;
        }
      } catch (error) {
        errors.push(errorDetails("opencost_raw_allocation_failed", error));
      }
    }

    if (errors.length > 0) {
      return buildUnavailableSummary(
        customerId,
        workspaceId,
        "pending_error",
        "platform_provisioned_local_metering",
        {
          status: "error",
          warnings,
          errors,
        },
      );
    }

    return buildUnavailableSummary(
      customerId,
      workspaceId,
      "pending_unavailable",
      "local_metering_unmatched",
    );
  }

  return {
    buildUnavailableSummary,
    buildBillingEnvelope,
    fetchExactSummary,
    fetchPendingSummary,
  };
}
