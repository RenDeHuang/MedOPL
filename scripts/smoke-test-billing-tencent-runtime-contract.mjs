import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverSource = await readFile("adapters/billing-aggregator/src/server.mjs", "utf8");
const runtimeSource = await readFile("adapters/billing-aggregator/src/tencent-billing-runtime.mjs", "utf8");

assert.match(serverSource, /from "\.\/tencent-billing-runtime\.mjs"/, "server_must_import_tencent_billing_runtime");
assert.match(serverSource, /createTencentBillingRuntime\(/, "server_must_create_tencent_billing_runtime");
assert.doesNotMatch(serverSource, /function parseWindowHours\b/, "server_must_not_inline_tencent_window_parser");
assert.doesNotMatch(serverSource, /function tencentMonthlyWindowRanges\b/, "server_must_not_inline_tencent_window_ranges");
assert.doesNotMatch(serverSource, /function tencentBillRows\b/, "server_must_not_inline_tencent_bill_row_extractor");
assert.doesNotMatch(serverSource, /async function fetchTencentBillSummary\b/, "server_must_not_inline_tencent_bill_fetcher");

assert.match(runtimeSource, /export function parseWindowHours\(/, "runtime_must_export_window_parser");
assert.match(runtimeSource, /export function tencentMonthlyWindowRanges\(/, "runtime_must_export_monthly_ranges");
assert.match(runtimeSource, /export function createTencentBillingRuntime\(/, "runtime_must_export_factory");
assert.match(runtimeSource, /DescribeBillDetail/, "runtime_must_call_describe_bill_detail");

const {
  formatTencentTime,
  parseWindowHours,
  tencentMonthlyWindowRanges,
  tencentBillRows,
  createTencentBillingRuntime,
} = await import("../adapters/billing-aggregator/src/tencent-billing-runtime.mjs");

assert.equal(parseWindowHours("24h"), 24, "hour_window_must_parse");
assert.equal(parseWindowHours("2d"), 48, "day_window_must_parse");
assert.equal(parseWindowHours("bad"), 168, "invalid_window_must_default");
assert.equal(
  formatTencentTime(new Date("2026-05-02T08:56:14.055Z")),
  "2026-05-02 16:56:14",
  "tencent_bill_query_time_must_use_billing_timezone",
);

const ranges = tencentMonthlyWindowRanges("48h", new Date("2026-05-02T01:00:00.000Z"));
assert.equal(ranges.length, 2, "window_crossing_month_must_split_ranges");
assert.equal(ranges[0].beginTime, "2026-04-30 09:00:00");
assert.equal(ranges[0].endTime, "2026-04-30 23:59:59");
assert.equal(ranges[1].beginTime, "2026-05-01 00:00:00");
assert.equal(ranges[1].endTime, "2026-05-02 09:00:00");

assert.deepEqual(tencentBillRows({ Response: { DetailSet: [{ id: 1 }] } }), [{ id: 1 }], "row_extractor_must_read_response_detail_set");

const calls = [];
const runtime = createTencentBillingRuntime({
  env: {
    TENCENT_BILLING_ENABLED: true,
    TENCENT_BILLING_ENDPOINT: "billing.tencentcloudapi.com",
    TENCENT_BILLING_MAX_PAGES: 1,
    TENCENT_BILLING_PAGE_SIZE: 10,
    TENCENT_BILLING_VERSION: "2018-07-09",
    TENCENT_CLOUD_REGION: "na-siliconvalley",
    L3_EXACT_WAIT_MINUTES: 120,
  },
  deps: {
    async callTencentCloud(input) {
      calls.push(input);
      return { DetailSet: [{ RunId: "run-1", RealTotalCost: 3 }] };
    },
    normalizeTencentBillRow(row = {}) {
      return {
        hasExactRunAttribution: false,
        properties: { resource_id: String(row.ResourceId || row.InstanceId || "") },
      };
    },
    applyResourceAttributionToRows(rows = []) {
      return rows.map((row) => ({
        ...row,
        attributed: true,
        resourceOrderId: "order-fallback-1",
        runId: "run-fallback-1",
        serverPlanId: "plan-fallback-1",
        tenantId: "tenant-1",
        workspaceId: "ws-1",
      }));
    },
    fetchProvisionResourceMappings: async () => ([{ id: "map-1", cvmInstanceIds: ["ins-1"] }]),
    summaryFromTencentBillRows(rows, customerId, workspaceId, metadata) {
      return { rows, customerId, workspaceId, metadata };
    },
  },
});
const summary = await runtime.fetchTencentBillSummary("tenant-1", "ws-1", "1h", {
  queryBeginTime: "2026-05-01 00:00:00",
  queryEndTime: "2026-05-01 23:59:59",
});
assert.equal(summary.customerId, "tenant-1");
assert.equal(calls[0].action, "DescribeBillDetail");
assert.equal(calls[0].payload.Limit, 10);
assert.equal(calls[0].payload.BeginTime, "2026-05-01 00:00:00");
assert.equal(summary.metadata.l3ExactWaitMinutes, 120);
assert.equal(summary.rows[0].Tags.resource_order_id, "order-fallback-1");

const pagedCalls = [];
const pagedRuntime = createTencentBillingRuntime({
  env: {
    TENCENT_BILLING_ENABLED: true,
    TENCENT_BILLING_ENDPOINT: "billing.tencentcloudapi.com",
    TENCENT_BILLING_MAX_PAGES: 4,
    TENCENT_BILLING_PAGE_SIZE: 2,
    TENCENT_BILLING_VERSION: "2018-07-09",
    TENCENT_CLOUD_REGION: "na-siliconvalley",
  },
  deps: {
    async callTencentCloud(input) {
      pagedCalls.push(input);
      if (input.payload.Offset === 0) {
        return { Total: 0, DetailSet: [{ ResourceId: "page-0-a" }, { ResourceId: "page-0-b" }] };
      }
      if (input.payload.Offset === 2) {
        return { Total: 0, DetailSet: [{ ResourceId: "page-1-a" }, { ResourceId: "page-1-b" }] };
      }
      return { Total: 0, DetailSet: [{ ResourceId: "target-resource" }] };
    },
    normalizeTencentBillRow(row = {}) {
      return {
        hasExactRunAttribution: false,
        properties: { resource_id: String(row.ResourceId || "") },
      };
    },
    applyResourceAttributionToRows(rows = []) {
      return rows;
    },
    fetchProvisionResourceMappings: async () => [],
    summaryFromTencentBillRows(rows = []) {
      return { rows };
    },
  },
});
const pagedSummary = await pagedRuntime.fetchTencentBillSummary("tenant-page", "ws-page", "1h", {
  queryBeginTime: "2026-05-02 00:00:00",
  queryEndTime: "2026-05-02 23:59:59",
});
assert.equal(pagedCalls.length, 3, "must_continue_when_total_is_zero_but_page_is_full");
assert.deepEqual(
  pagedCalls.map((call) => call.payload.Offset),
  [0, 2, 4],
  "must_advance_offsets_until_short_page_when_total_is_zero",
);
assert.equal(
  pagedSummary.rows.some((row) => row.ResourceId === "target-resource"),
  true,
  "must_include_rows_after_zero_total_full_pages",
);

console.log(JSON.stringify({
  ok: true,
  contract: "billing_tencent_runtime",
}, null, 2));
