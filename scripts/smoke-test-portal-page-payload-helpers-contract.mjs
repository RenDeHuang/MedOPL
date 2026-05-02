import assert from "node:assert/strict";

const {
  buildBillingRunCosts,
  buildBillingTaskCosts,
  buildBillingTotals,
  buildOverviewCollections,
  buildOverviewKpis,
  buildWorkspaceTaskCards,
  sumFileSizes,
} = await import("../services/portal/src/app/portal-page-payload-helpers.mjs");

const now = "2026-05-01T00:00:00.000Z";
const tasks = [{ slug: "analysis", title: "Analysis", status: "active", updatedAt: now, createdAt: now, path: "/workspace/user-1/analysis" }];
const runs = [{ runId: "run-1", workspaceId: "analysis", status: "completed", createdAt: now }];
const items = [{ name: "run-1", totalCost: 1.5, cpuCost: 1, gpuCost: 0, pvCost: 0.5, start: now, end: now, properties: { "label:run_id": "run-1", pricing_source: "fixture" } }];

const overview = buildOverviewCollections({
  tasks,
  runs,
  options: {},
  paginateRows: (rows) => ({ rows, page: 1, pageSize: 5, total: rows.length, totalPages: 1 }),
  formatDateTime: (value) => `fmt:${value}`,
  isRunTerminal: (run) => run.status === "completed",
});
assert.equal(overview.taskRows[0].runCount, 1);
assert.equal(buildOverviewKpis({
  commercial: { accountStatus: "active", billingStatus: "funded", entitlementStatus: "active", activeFreeze: 1, availableBalance: 24 },
  wallet: { balance: 25 },
  todayCost: 1.5,
  pendingTotal: 0.25,
  exactTotal: 1.5,
  historicalCost: 1.5,
  tasks,
  workspaceCount: 1,
  runs,
  resourceOrderCount: 1,
}).balance, 25);
assert.equal(buildBillingTotals(items).totalCost, 1.5);
assert.equal(buildBillingTaskCosts({ tasks, filteredRuns: runs, filteredItems: items })[0].slug, "analysis");
assert.equal(buildBillingRunCosts({ filteredRuns: runs, filteredItems: items, isRunTerminal: (run) => run.status === "completed" })[0].pricingSource, "fixture");
assert.equal(await sumFileSizes([{ fullPath: "a" }, { fullPath: "bb" }], async (file) => ({ size: file.length })), 3);
assert.equal((await buildWorkspaceTaskCards({
  pagedTasks: tasks,
  pathApi: { join: (...parts) => parts.join("/") },
  listFilesRecursive: async (dir) => dir.endsWith("/inputs") ? [{ name: "input.csv" }] : [{ name: "result.json" }],
  userRuns: runs,
  billingItems: items,
  formatDateTime: (value) => `fmt:${value}`,
}))[0].totalCost, 1.5);

console.log(JSON.stringify({ ok: true, contract: "portal_page_payload_helpers" }, null, 2));
