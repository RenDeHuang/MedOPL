import assert from "node:assert/strict";

const {
  summaryFromTencentBillRows,
} = await import(new URL("../adapters/billing-aggregator/src/tencent-bill-summary.mjs", import.meta.url).href);

const rows = [
  {
    RunId: "run-exact-1",
    ResourceOrderId: "order-exact-1",
    ServerPlanId: "plan-exact-1",
    WorkspaceId: "workspace-a",
    TenantId: "tenant-a",
    RealTotalCost: "12.34",
    FeeBeginTime: "2026-05-01 00:00:00",
    FeeEndTime: "2026-05-01 01:00:00",
    ResourceId: "ins-1",
    ProductName: "CVM",
    Tags: {
      resource_order_id: "order-exact-1",
      run_id: "run-exact-1",
      server_plan_id: "plan-exact-1",
      tenant_id: "tenant-a",
      workspace_id: "workspace-a",
    },
  },
  {
    RunId: "run-exact-1",
    ResourceOrderId: "order-exact-1",
    ServerPlanId: "plan-exact-1",
    WorkspaceId: "workspace-a",
    TenantId: "tenant-a",
    RealTotalCost: "0.66",
    FeeBeginTime: "2026-05-01 00:30:00",
    FeeEndTime: "2026-05-01 02:00:00",
    ResourceId: "disk-1",
    ProductName: "CBS",
    Tags: {
      resource_order_id: "order-exact-1",
      run_id: "run-exact-1",
      server_plan_id: "plan-exact-1",
      tenant_id: "tenant-a",
      workspace_id: "workspace-a",
    },
  },
  {
    ResourceId: "lhins-unattributed-1",
    ProductName: "Lighthouse",
    RealTotalCost: "3.21",
    Tags: {
      tenant_id: "tenant-a",
      workspace_id: "workspace-a",
    },
  },
  {
    ResourceId: "ins-other-tenant",
    ProductName: "CVM",
    RealTotalCost: "99.99",
    Tags: {
      resource_order_id: "order-other",
      run_id: "run-other",
      server_plan_id: "plan-other",
      tenant_id: "tenant-b",
      workspace_id: "workspace-b",
    },
  },
];

const summary = summaryFromTencentBillRows(rows, "tenant-a", "workspace-a");

assert.equal(summary.customerId, "tenant-a");
assert.equal(summary.workspaceId, "workspace-a");
assert.equal(summary.source, "tencent_cloud_bill");
assert.equal(summary.itemCount, 1);
assert.equal(summary.exactRunCount, 1);
assert.equal(summary.unattributedRunCount, 1);
assert.equal(summary.totals.totalCost, 13);
assert.equal(summary.runs.length, 1);
assert.equal(summary.runs[0].runId, "run-exact-1");
assert.equal(summary.runs[0].totalCost, 13);
assert.equal(summary.runs[0].start, "2026-05-01 00:00:00");
assert.equal(summary.runs[0].end, "2026-05-01 02:00:00");
assert.deepEqual(summary.runs[0].sources, ["ins-1", "disk-1"]);
assert.equal(summary.items[0].properties.pricing_source, "tencent_cloud_bill");
assert.equal(summary.unattributed.itemCount, 1);
assert.equal(summary.unattributed.runs[0].runId, "lhins-unattributed-1");
assert.equal(summary.unattributed.runs[0].totalCost, 3.21);
assert.equal(summary.unattributed.items[0].properties.attribution_state, "unattributed");

const sameRunDifferentOrders = summaryFromTencentBillRows([
  {
    RunId: "run-reused",
    ResourceOrderId: "order-reused-a",
    ServerPlanId: "plan-a",
    WorkspaceId: "workspace-a",
    TenantId: "tenant-a",
    RealTotalCost: "4.00",
    ResourceId: "ins-reused-a",
    Tags: {
      resource_order_id: "order-reused-a",
      run_id: "run-reused",
      server_plan_id: "plan-a",
      tenant_id: "tenant-a",
      workspace_id: "workspace-a",
    },
  },
  {
    RunId: "run-reused",
    ResourceOrderId: "order-reused-b",
    ServerPlanId: "plan-b",
    WorkspaceId: "workspace-a",
    TenantId: "tenant-a",
    RealTotalCost: "5.00",
    ResourceId: "ins-reused-b",
    Tags: {
      resource_order_id: "order-reused-b",
      run_id: "run-reused",
      server_plan_id: "plan-b",
      tenant_id: "tenant-a",
      workspace_id: "workspace-a",
    },
  },
], "tenant-a", "workspace-a");

assert.equal(sameRunDifferentOrders.exactRunCount, 2, "same_run_different_resource_orders_must_not_be_merged");
assert.deepEqual(
  sameRunDifferentOrders.runs.map((item) => item.resourceOrderId).sort(),
  ["order-reused-a", "order-reused-b"],
);

console.log(JSON.stringify({
  ok: true,
  exactRunCount: summary.exactRunCount,
  unattributedRunCount: summary.unattributedRunCount,
  totalCost: summary.totals.totalCost,
}, null, 2));
