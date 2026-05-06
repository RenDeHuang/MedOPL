import { readFile } from "node:fs/promises";
import assertNode from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createBillingAllocationSummaryRuntime } from "../adapters/billing-aggregator/src/billing-metering-allocation-summary.mjs";
import { createBillingHttpHandler } from "../adapters/billing-aggregator/src/http-routes.mjs";
import { createBillingSummaryRuntime } from "../adapters/billing-aggregator/src/billing-summary-runtime.mjs";
import { createCosBillingRuntime } from "../adapters/billing-aggregator/src/cos-billing-runtime.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readSource(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function main() {
  const [
    httpRoutesSource,
    summaryRuntimeSource,
    localCostsSource,
    allocationSummarySource,
    cosBillingRuntimeSource,
  ] = await Promise.all([
    readSource("adapters/billing-aggregator/src/http-routes.mjs"),
    readSource("adapters/billing-aggregator/src/billing-summary-runtime.mjs"),
    readSource("adapters/billing-aggregator/src/billing-metering-local-costs.mjs"),
    readSource("adapters/billing-aggregator/src/billing-metering-allocation-summary.mjs"),
    readSource("adapters/billing-aggregator/src/cos-billing-runtime.mjs"),
  ]);

  assert(httpRoutesSource.includes('pendingSources: ["local_metering_pending"]'), "contract_failed:http_status_must_only_publish_local_metering_pending_default");
  assert(!httpRoutesSource.includes("opencost_pending"), "contract_failed:http_status_must_not_publish_opencost_pending_default");
  assert(summaryRuntimeSource.includes('summary.source = "local_metering_pending"'), "contract_failed:pending_summary_must_use_local_metering_source");
  assert(summaryRuntimeSource.includes('aggregatedSummary.source = "local_metering_pending"'), "contract_failed:aggregated_pending_summary_must_use_local_metering_source");
  assert(summaryRuntimeSource.includes('rawSummary.source = "local_metering_pending"'), "contract_failed:raw_pending_summary_must_use_local_metering_source");
  assert(!summaryRuntimeSource.includes("user_owned_local_metering"), "contract_failed:summary_must_not_publish_user_owned_local_metering");
  assert(!summaryRuntimeSource.includes("catch {}"), "contract_failed:pending_summary_must_not_swallow_read_failures");
  assert(!httpRoutesSource.includes("collectAttributionItems(url).catch"), "contract_failed:attribution_route_must_not_swallow_collection_failures");
  assert(localCostsSource.includes('pricingSource: "platform_provisioned_local_metering"'), "contract_failed:local_metering_costs_must_use_platform_provisioned_pricing_source");
  assert(!localCostsSource.includes("user_owned_local_metering"), "contract_failed:local_costs_must_not_publish_user_owned_local_metering");
  assert(allocationSummarySource.includes('source: "local_metering_pending"'), "contract_failed:allocation_summary_pending_source_must_be_local_metering_pending");
  assert(allocationSummarySource.includes('cloudSource: "platform_provisioned_local_metering"'), "contract_failed:allocation_summary_pending_cloud_source_must_be_platform_provisioned_local_metering");
  assert(!allocationSummarySource.includes("user_owned_local_metering"), "contract_failed:allocation_summary_must_not_publish_user_owned_local_metering");
  assert(!allocationSummarySource.includes("OpenCost raw allocation"), "contract_failed:allocation_summary_must_not_label_pending_as_opencost_raw_allocation");
  assert(!allocationSummarySource.includes("entry?.name?.includes(customerId)"), "contract_failed:allocation_summary_must_not_use_name_contains_customer_id");
  assert(!allocationSummarySource.includes("entry?.name?.includes(workspaceId)"), "contract_failed:allocation_summary_must_not_use_name_contains_workspace_id");
  assert(!cosBillingRuntimeSource.includes("fetchProvisionResourceMappings();"), "contract_failed:cos_exact_attribution_must_not_default_to_resource_provisioner_mapping");
  assert(!cosBillingRuntimeSource.includes("JSON.stringify(item"), "contract_failed:cos_attribution_must_not_scan_item_json");

  const cosAttributionRuntime = createCosBillingRuntime({
    cosBillReader: {
      configured: () => true,
      listFiles: async () => [],
      parseLatestFile: async () => ({ rows: [], latest: null }),
    },
    buildCosBillReader: () => ({
      parseLatestFile: async () => ({ rows: [], latest: null }),
      parseFile: async () => ({ rows: [], latest: null }),
    }),
    cosConfig: { bucket: "bucket-a", region: "ap-shanghai", prefix: "daily/" },
    firstNonEmpty: (...values) => values.map((value) => String(value ?? "").trim()).find(Boolean) || "",
    normalizeCosBillRow: (row) => row,
    summaryFromTencentBillRows: () => ({ runs: [], items: [], unattributed: { items: [] } }),
    applyResourceAttributionToRows: (rows) => rows,
    requiredCostTags: ["resource_order_id", "run_id", "server_plan_id", "tenant_id", "workspace_id"],
    fetchExactSummary: async () => ({ runs: [], items: [], unattributed: { items: [] } }),
  });
  const attributionPayload = cosAttributionRuntime.buildAttributionPayload([
    {
      name: "contains-order-strict-only-in-name",
      totalCost: 1.25,
    },
    {
      totalCost: 4.5,
      metadata: {
        resource_order_id: "order-strict",
        run_id: "run-strict",
        server_plan_id: "plan-strict",
        tenant_id: "tenant-fixed",
        workspace_id: "workspace-fixed",
      },
    },
    {
      totalCost: 3.75,
      properties: {
        tags: {
          resource_order_id: "order-other",
          run_id: "run-other",
          server_plan_id: "plan-other",
          tenant_id: "tenant-fixed",
          workspace_id: "workspace-fixed",
        },
      },
    },
    {
      totalCost: 2.5,
      labels: {
        resource_order_id: "order-strict",
        tenant_id: "tenant-fixed",
        workspace_id: "workspace-fixed",
      },
    },
  ], "order-strict");
  assertNode.equal(attributionPayload.relatedCount, 1, "only_explicit_metadata_match_must_count_as_related");
  assertNode.equal(attributionPayload.totalCost, 4.5, "only_strictly_matched_cost_must_contribute_to_total");
  assertNode.equal(attributionPayload.items.length, 1, "only_strict_match_must_appear_in_related_items");
  assertNode.equal(attributionPayload.unattributedCount, 3, "non_strict_matches_must_be_reported_as_unattributed");
  assertNode.ok(
    attributionPayload.unattributed.some((item) => item.reasons.includes("missing_resource_order_id")),
    "name_contains_must_not_count_as_explicit_resource_order_match",
  );
  assertNode.ok(
    attributionPayload.unattributed.some((item) => item.reasons.includes("resource_order_id_mismatch")),
    "mismatched_explicit_resource_order_id_must_be_reported",
  );
  assertNode.ok(
    attributionPayload.unattributed.some((item) => item.reasons.includes("missing_run_id")),
    "missing_required_explicit_fields_must_be_reported",
  );

  const allocationRuntime = createBillingAllocationSummaryRuntime();
  const heuristicSummary = allocationRuntime.summaryFromRawAllocations([
    {
      name: "tenant-fixed-workspace-fixed-run-fixed",
      totalCost: 9.5,
      properties: {},
    },
  ], "tenant-fixed", "workspace-fixed");
  assertNode.equal(heuristicSummary.itemCount, 0, "name_contains_must_not_count_as_attribution");
  assertNode.equal(heuristicSummary.unattributed.itemCount, 1, "missing_explicit_labels_must_be_reported_as_unattributed");
  assertNode.ok(
    heuristicSummary.unattributed.items[0].reasons.includes("missing_customer_id"),
    "unattributed_reason_must_include_missing_customer_id",
  );
  assertNode.ok(
    heuristicSummary.unattributed.items[0].reasons.includes("missing_workspace_id"),
    "unattributed_reason_must_include_missing_workspace_id",
  );
  assertNode.ok(
    heuristicSummary.unattributed.items[0].reasons.includes("missing_run_id"),
    "unattributed_reason_must_include_missing_run_id",
  );

  const explicitSummary = allocationRuntime.summaryFromRawAllocations([
    {
      name: "opaque-allocation-name",
      totalCost: 2.25,
      cpuCost: 1,
      gpuCost: 0.5,
      pvCost: 0.75,
      start: "2026-05-01T00:00:00.000Z",
      end: "2026-05-01T01:00:00.000Z",
      properties: {
        labels: {
          customer_id: "tenant-fixed",
          workspace_id: "workspace-fixed",
          run_id: "run-fixed",
        },
      },
    },
  ], "tenant-fixed", "workspace-fixed");
  assertNode.equal(explicitSummary.itemCount, 1, "explicit_labels_must_enable_attribution");
  assertNode.equal(explicitSummary.unattributed.itemCount, 0, "explicit_labels_must_not_be_marked_unattributed");

  let fetchAllocationCalled = false;
  const runtimePreferLocal = createBillingSummaryRuntime({
    env: {
      TENCENT_BILLING_ENABLED: false,
      TENCENT_BILLING_REQUIRED: false,
      OPENCOST_BASE_URL: "http://opencost.local",
    },
    deps: {
      buildUnattributedSummary: (items = [], customerId = "", workspaceId = "") => ({ itemCount: items.length, items, customerId, workspaceId }),
      zeroTotals: () => ({ cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 }),
      fetchAllocation: async () => {
        fetchAllocationCalled = true;
        throw new Error("fetch_allocation_must_not_run_when_local_pending_exists");
      },
      fetchTencentBillSummary: async () => ({ runs: [], unattributed: { itemCount: 0, items: [] } }),
      fetchCosExactSummary: async () => ({ runs: [], items: [], unattributed: { itemCount: 0, items: [] } }),
      normalizeCosTarget: () => ({ objectKey: "", prefix: "" }),
      summarize: () => ({ runs: [], items: [], itemCount: 0, totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 } }),
      asEntries: (value) => value,
      summaryFromRawAllocations: () => ({ runs: [], items: [], itemCount: 0, totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 } }),
      pendingRequestedRunCosts: async () => [{ runId: "run-local", totalCost: 1.2, workspaceId: "workspace-fixed", customerId: "tenant-fixed", breakdown: {} }],
      summaryFromPendingRuns: (runs = [], customerId = "", workspaceId = "") => ({
        customerId,
        workspaceId,
        runs,
        items: runs,
        itemCount: runs.length,
        totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 1.2 },
      }),
    },
  });
  const preferredLocalSummary = await runtimePreferLocal.fetchPendingSummary("tenant-fixed", "workspace-fixed", "24h");
  assertNode.equal(fetchAllocationCalled, false, "local_metering_must_remain_default_hot_path");
  assertNode.equal(preferredLocalSummary.source, "local_metering_pending", "local_pending_must_keep_local_source");

  const runtimeErrorPayload = createBillingSummaryRuntime({
    env: {
      TENCENT_BILLING_ENABLED: false,
      TENCENT_BILLING_REQUIRED: false,
      OPENCOST_BASE_URL: "http://opencost.local",
    },
    deps: {
      buildUnattributedSummary: (items = [], customerId = "", workspaceId = "") => ({ itemCount: items.length, items, customerId, workspaceId }),
      zeroTotals: () => ({ cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 }),
      fetchAllocation: async () => {
        throw new Error("opencost_unreachable");
      },
      fetchTencentBillSummary: async () => ({ runs: [], unattributed: { itemCount: 0, items: [] } }),
      fetchCosExactSummary: async () => ({ runs: [], items: [], unattributed: { itemCount: 0, items: [] } }),
      normalizeCosTarget: () => ({ objectKey: "", prefix: "" }),
      summarize: () => ({ runs: [], items: [], itemCount: 0, totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 } }),
      asEntries: (value) => value,
      summaryFromRawAllocations: () => ({ runs: [], items: [], itemCount: 0, totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 } }),
      pendingRequestedRunCosts: async () => [],
      summaryFromPendingRuns: (runs = [], customerId = "", workspaceId = "") => ({
        customerId,
        workspaceId,
        runs,
        items: runs,
        itemCount: runs.length,
        totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
      }),
    },
  });
  const pendingErrorSummary = await runtimeErrorPayload.fetchPendingSummary("tenant-fixed", "workspace-fixed", "24h");
  assertNode.equal(pendingErrorSummary.status, "error", "opencost_failure_must_surface_error_status");
  assertNode.ok(Array.isArray(pendingErrorSummary.errors) && pendingErrorSummary.errors.length > 0, "opencost_failure_must_surface_errors");
  assertNode.notEqual(pendingErrorSummary.source, "pending_unavailable", "opencost_failure_must_not_look_like_no_data");

  const sentResponses = [];
  const attributionRoute = createBillingHttpHandler({
    deps: {
      sendJson: (_res, status, payload) => sentResponses.push({ status, payload }),
      buildTencentCloudStatus: () => ({}),
      serverPlanCatalog: () => [],
      tencentCloudConfigured: () => false,
      buildCosBillStatus: () => ({}),
      cosBillReader: { configured: () => false, listFiles: async () => [] },
      buildCosBillFilesPayload: async () => ({}),
      buildCosBillReconcilePayload: async () => ({}),
      normalizeCosTarget: () => ({}),
      collectAttributionItems: async () => {
        throw new Error("exact_bill_unavailable");
      },
      buildAttributionPayload: () => ({ ok: true, items: [] }),
      listServerPlans: async () => [],
      cloudErrorMessage: (error) => String(error?.message || error),
      reconcileCharges: async () => ({}),
      getReconcileState: () => ({}),
      listPendingRuns: async () => ({}),
    },
  });
  const handledAttributionError = await attributionRoute(
    { method: "GET", url: "/billing/attribution?resourceOrderId=order-strict", [Symbol.asyncIterator]: async function* emptyBody() {} },
    {},
  );
  assertNode.equal(handledAttributionError, true, "attribution_route_must_handle_attribution_path");
  assertNode.equal(sentResponses[0].status, 502, "attribution_collection_error_must_surface_502");
  assertNode.equal(sentResponses[0].payload.ok, false, "attribution_collection_error_must_not_look_successful");
  assertNode.match(sentResponses[0].payload.error, /exact_bill_unavailable/, "attribution_collection_error_must_include_cause");

  console.log(JSON.stringify({
    ok: true,
    contract: "v21_billing_platform_provisioned_runtime",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error.message || error),
  }, null, 2));
  process.exit(1);
});
