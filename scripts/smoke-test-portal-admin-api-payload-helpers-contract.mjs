import assert from "node:assert/strict";

const {
  buildAdminAlerts,
  buildAdminAuditRows,
  buildAdminGroups,
  buildAdminLedgerSummary,
  buildAdminRecentUsage,
  buildAdminTopUsers,
  buildAdminUsageRows,
  buildAdminUsersRows,
} = await import("../services/portal/src/app/portal-admin-api-payload-helpers.mjs");

const now = "2026-05-01T00:00:00.000Z";
const users = [{ id: "user-1", name: "Alice", email: "alice@example.test", status: "active", groupId: "group-1", createdAt: now }];
const items = [{
  name: "run-1",
  totalCost: 6,
  cpuCost: 1,
  gpuCost: 2,
  pvCost: 3,
  start: now,
  end: now,
  properties: {
    "label:customer_id": "user-1",
    "label:run_id": "run-1",
  },
}];
const allRuns = [{ runId: "run-1", userId: "user-1", userName: "Alice", workspaceId: "analysis", status: "completed", createdAt: now }];

assert.equal(buildAdminTopUsers({ users, items, wallets: [{ userId: "user-1", balance: 42 }] })[0].totalCost, 6);
assert.equal(buildAdminRecentUsage({ allRuns, isRunTerminal: (run) => run.status === "completed", formatDateTime: (value) => `fmt:${value}` })[0].status, "completed");
assert.equal(buildAdminUsageRows({ allRuns, items, isRunTerminal: (run) => run.status === "completed", formatDateTime: (value) => `fmt:${value}` })[0].storageCost, 3);
assert.equal(buildAdminAlerts({
  securitySummary: { checks: [] },
  performanceSummary: { warmupTimeoutCount: 0, masFirstReplyApproxMs: 0 },
  unavailableServices: [],
  traceMissingAlerts: [],
  failedRuns: [],
  pendingRuns: [],
  lowBalanceUsers: [{ userId: "user-1", name: "Alice", balance: 0 }],
  formatDateTime: (value) => `fmt:${value}`,
  money: (value) => Number(value || 0).toFixed(2),
}).length, 1);
assert.equal(buildAdminGroups({ groups: [{ id: "group-1", name: "Research" }], users })[0].memberCount, 1);
assert.equal(buildAdminLedgerSummary([{ type: "refund", amount: 3 }, { type: "topup", amount: 4 }]).refund, 3);
assert.equal(buildAdminAuditRows([{ type: "billing_warning", occurredAt: now }], (value) => `fmt:${value}`)[0].occurredAt, `fmt:${now}`);
assert.equal(buildAdminUsersRows({
  users,
  wallets: [{ userId: "user-1", balance: 42 }],
  taskSpaces: [{ userId: "user-1", slug: "analysis", status: "active", updatedAt: now }],
  workspaceSessions: [{ userId: "user-1", lastUsedAt: now }],
  sessions: [{ userId: "user-1", createdAt: now }],
  activeUserStatus: (status) => status,
  formatDateTime: (value) => `fmt:${value}`,
  groupNameById: () => "Research",
})[0].balance, 42);

console.log(JSON.stringify({ ok: true, contract: "portal_admin_api_payload_helpers" }, null, 2));
