import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminRoutes = await readFile("services/portal/src/routes/admin-api.routes.mjs", "utf8");
const adminPayloads = await readFile("services/portal/src/app/portal-admin-api-payloads.mjs", "utf8");
const workspaceStorageRoutes = await readFile("services/portal/src/routes/workspace-storage.routes.mjs", "utf8");
const resourceRoutes = await readFile("services/portal/src/routes/resource-order-public.routes.mjs", "utf8");
const { buildAdminCustomerAccountingPayload, createPortalAdminApiPayloads } = await import("../services/portal/src/app/portal-admin-api-payloads.mjs");

assert.match(adminRoutes, /if \(user\.role === "admin"\) return true;/, "admin_api_must_require_admin_role");
assert.match(adminRoutes, /sendJson\(res, \{ error: "forbidden" \}, 403\)/, "admin_api_must_return_403_for_non_admin");
assert.match(adminRoutes, /customer-accounting\/detail/, "admin_customer_accounting_detail_route_must_exist");
assert.match(adminPayloads, /ledger: entries/, "customer_accounting_detail_must_include_ledger");
assert.match(adminPayloads, /activeResourceOrders: activeResourceOrdersForUser/, "customer_accounting_detail_must_include_scoped_resource_orders");
assert.match(adminPayloads, /workspaceFiles: userScopedRows/, "customer_accounting_detail_must_include_scoped_workspace_files");
assert.match(adminPayloads, /sessionTraces: userScopedRows/, "customer_accounting_detail_must_include_scoped_session_traces");

assert.match(workspaceStorageRoutes, /metadata: listWorkspaceFiles\(db, \{ tenantId: user\.tenantId \|\| user\.id, userId: user\.id, workspaceId: taskSpace\.slug \}\)/, "workspace_storage_metadata_must_filter_by_tenant_user_workspace");
assert.match(workspaceStorageRoutes, /tokenPayload\.userId !== user\.id[\s\S]*invalid_or_expired_transfer_token[\s\S]*403/, "signed_upload_must_reject_cross_user_token");
assert.match(workspaceStorageRoutes, /handleSignedDownload[\s\S]*tokenPayload\.userId !== user\.id[\s\S]*invalid_or_expired_transfer_token[\s\S]*403/, "signed_download_must_reject_cross_user_token");

assert.match(resourceRoutes, /isAdminUser\(user\)[\s\S]*forbidden_admin_scope_required[\s\S]*403/, "cloud_resources_must_require_admin_scope");
assert.match(resourceRoutes, /resourceOrdersForUser\(db, user\.id\)/, "resource_order_list_must_filter_current_user");

const db = {
  settings: {},
  users: [
    { id: "real-user", tenantId: "tenant-real", email: "buyer@customer.cn", name: "真实客户", role: "user", status: "active" },
    { id: "test-user", tenantId: "tenant-test", email: "test-buyer@example.test", name: "test-fixture", role: "user", status: "active" },
    { id: "admin-user", tenantId: "tenant-admin", email: "admin@medopl.cn", name: "Admin", role: "admin", status: "active" },
  ],
  wallets: [],
  ledger: [],
  resourceOrders: [
    { id: "order-real", userId: "real-user", tenantId: "tenant-real", status: "running", serverPlanId: "starter", updatedAt: "2026-05-05T00:00:00.000Z" },
    { id: "order-test", userId: "test-user", tenantId: "tenant-test", status: "running", serverPlanId: "starter", updatedAt: "2026-05-05T00:00:01.000Z" },
  ],
  taskSpaces: [],
  workspaceSessions: [],
  sessions: [],
  groups: [],
  labSubscriptions: [],
  userSandboxes: [],
};

const accounting = buildAdminCustomerAccountingPayload(db, { now: "2026-05-05T00:00:00.000Z" });
assert.deepEqual(accounting.customers.map((item) => item.userId), ["real-user"], "admin_customer_accounting_must_default_exclude_test_fixtures");
assert.deepEqual(accounting.segmentPolicy.excludedByDefault, ["internal", "test_fixture"], "admin_payload_must_report_test_fixture_exclusion_policy");

const payloads = createPortalAdminApiPayloads({
  activeUserStatus: (status) => status || "active",
  buildAdminSecuritySummary: () => ({ checks: [] }),
  collectRunsForTask: async () => [],
  collectRunsForUser: async () => [],
  fetchBillingStatus: async () => ({}),
  fetchBillingSummary: async () => ({ items: [], totals: {} }),
  fetchHarborSummary: async () => ({}),
  fetchLangfuseSummary: async () => ({}),
  fetchMinioSummary: async () => ({}),
  fetchPendingSummary: async () => ({}),
  fetchTraceRows: async () => ({ rows: [] }),
  fetchWorkspaceMinioState: async () => ({}),
  fetchWorkspaceStorageSnapshot: async () => ({}),
  formatDateTime: (value) => value || "",
  groupBillingByDay: () => [],
  humanizeStatus: (value) => value,
  isRunTerminal: () => true,
  latestActiveWorkspaceSession: () => null,
  listTaskSpacesForUser: () => [],
  money: (value) => String(value || 0),
  normalizePageSize: (value) => Number(value || 10),
  paginateRows: (rows) => ({ items: rows, pagination: { page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 } }),
  probe: async () => ({ ok: true, status: "ok", responseMs: 1 }),
  rangeBounds: () => ({ from: "2026-05-05", to: "2026-05-06" }),
  readPortalEvents: async () => [],
  readWorkspaceSession: () => null,
  runtimePerformanceSummary: async () => ({}),
  sanitizeTaskTitle: (value) => value,
  storageMode: () => "json",
  urls: { portalOplAdapterUrl: "http://127.0.0.1:1" },
  withinDateRange: () => false,
  workspaceChatSessionsForUser: () => [],
});
const overview = await payloads.buildAdminOverviewPayload(db);
assert.deepEqual(overview.cloudResourceRows.map((item) => item.resourceOrderId), ["order-real"], "admin_cloud_resource_rows_must_default_exclude_test_fixtures");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.34_test_data_isolation_contract",
}, null, 2));
