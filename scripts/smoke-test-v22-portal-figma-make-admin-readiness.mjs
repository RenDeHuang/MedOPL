import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const appRoot = "services/portal/frontend/src/app";
const figmaRoot = "/tmp/medopl-figma-make-source-admin/src/app";

const adminRoutes = {
  "/admin/dashboard": "AdminDashboard",
  "/admin/users": "AdminUsers",
  "/admin/alerts": "AdminAlerts",
  "/admin/billing-ops": "AdminBillingOps",
  "/admin/audit": "AdminAudit",
  "/admin/system": "AdminSystem",
  "/admin/ops": "AdminOps",
};

const adminLoaders = {
  AdminDashboard: {
    loader: "loadAdminDashboardModel",
    api: "fetchAdminOverview",
  },
  AdminUsers: {
    loader: "loadAdminUsersModel",
    api: "fetchAdminUsers",
  },
  AdminAlerts: {
    loader: "loadAdminAlertsModel",
    api: "fetchAdminAlerts",
  },
  AdminBillingOps: {
    loader: "loadAdminBillingOpsModel",
    api: "fetchAdminBillingOps",
  },
  AdminAudit: {
    loader: "loadAdminAuditModel",
    api: "fetchAdminAudit",
  },
  AdminSystem: {
    loader: "loadAdminSystemModel",
    api: "fetchAdminSystem",
  },
  AdminOps: {
    loader: "loadAdminOpsModel",
    api: "fetchAdminOps",
    disabledProductState: "ops_surface_disabled",
  },
};

async function source(filePath) {
  return readFile(filePath, "utf8");
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function sliceBetween(text, start, end, label) {
  const startIndex = text.indexOf(start);
  assert.notEqual(startIndex, -1, `${label}_start_missing:${start}`);
  const endIndex = text.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `${label}_end_missing:${end}`);
  return text.slice(startIndex, endIndex);
}

const [
  routesSource,
  layoutSource,
  appSource,
  roleContextSource,
  adapterSource,
  adminApiSource,
  currentUserApiSource,
] = await Promise.all([
  source(`${appRoot}/routes.tsx`),
  source(`${appRoot}/components/Layout.tsx`),
  source(`${appRoot}/App.tsx`),
  source(`${appRoot}/contexts/RoleContext.tsx`),
  source(`${appRoot}/data/portalAdapters.ts`),
  source("services/portal/frontend/src/api/portal/admin.ts"),
  source("services/portal/frontend/src/api/portal/commercial.ts"),
]);

assert.equal(await exists(`${figmaRoot}/pages/admin/AdminDashboard.tsx`), true, "figma_admin_source_missing");
assert.equal(await exists(`${appRoot}/pages/AdminConsole.tsx`), false, "old_admin_console_residue_must_be_removed");
assert.equal(await exists("services/portal/frontend/src/imports"), false, "figma_imports_prompt_residue_must_not_be_active_frontend");
assertIncludes(appSource, "RoleProvider", "app_must_wrap_router_with_role_provider");
assertIncludes(roleContextSource, "fetchCurrentUser", "role_context_must_fetch_current_user");
assertIncludes(currentUserApiSource, 'apiClient.get<CurrentUserPayload>("/me")', "current_user_api_must_use_portal_me");
assertExcludes(roleContextSource, "setRole", "role_context_must_not_expose_frontend_role_mutation");
assertExcludes(roleContextSource, "useState<UserRole>(\"user\")", "role_context_must_not_use_static_user_default");

for (const [route, component] of Object.entries(adminRoutes)) {
  assertIncludes(routesSource, `path: "${route.slice(1)}"`, `admin_route_missing:${route}`);
  assertIncludes(routesSource, component, `admin_route_component_missing:${component}`);
  assertIncludes(layoutSource, `path: "${route}"`, `admin_nav_route_missing:${route}`);
  assert.equal(await exists(`${appRoot}/pages/admin/${component}.tsx`), true, `admin_page_missing:${component}`);
}

for (const [component, { loader, api }] of Object.entries(adminLoaders)) {
  assertIncludes(adapterSource, loader, `admin_loader_missing:${loader}`);
  assertIncludes(adapterSource, api, `admin_loader_api_call_missing:${api}`);
  assertIncludes(adminApiSource, api, `admin_api_module_missing:${api}`);
  const pageSource = await source(`${appRoot}/pages/admin/${component}.tsx`);
  assertIncludes(pageSource, loader, `admin_page_loader_missing:${component}`);
  assertIncludes(pageSource, "usePortalQuery", `admin_page_query_missing:${component}`);
  assertExcludes(pageSource, "Mock data", `admin_page_mock_data_forbidden:${component}`);
  assertExcludes(pageSource, "Math.random", `admin_page_random_success_forbidden:${component}`);
  assertExcludes(pageSource, "Simulate API", `admin_page_simulated_api_forbidden:${component}`);
  assertExcludes(pageSource, "setTimeout", `admin_page_fake_delay_forbidden:${component}`);
}

for (const emptyActionPattern of [
  "<Button size=\"sm\" className=\"gap-2\">\n                  <Plus",
  "<Button variant=\"ghost\" size=\"sm\">处理</Button>",
  "<Button variant=\"ghost\" size=\"sm\" className=\"text-green-600\">",
  "<Button variant=\"ghost\" size=\"sm\" className=\"text-red-600\">",
  "请访问对应的云控制台或运维系统",
]) {
  const adminSource = (await Promise.all(Object.keys(adminLoaders).map((component) => source(`${appRoot}/pages/admin/${component}.tsx`)))).join("\n");
  assertExcludes(adminSource, emptyActionPattern, "admin_action_must_not_be_empty_or_cloud_console_copy");
}

assertIncludes(adapterSource, "adminReadOnlyMessage", "admin_adapter_must_define_readonly_boundary_message");
assertIncludes(adapterSource, "管理员操作需要后端授权接口", "admin_actions_without_api_must_be_readonly_product_state");
assertIncludes(adapterSource, "ops_surface_disabled", "admin_ops_loader_must_recognize_disabled_product_state");
assertIncludes(adapterSource, "opsSurfaceEnabled", "admin_ops_loader_must_expose_ops_surface_state");
assertIncludes(adapterSource, "平台托管运维入口未启用", "admin_ops_disabled_state_must_be_product_copy");
assertIncludes(layoutSource, 'userRole === "admin"', "admin_nav_must_be_role_gated");
assertIncludes(layoutSource, "RoleContext 不是安全边界", "layout_must_record_role_boundary_comment");

const billingLoaderSource = sliceBetween(
  adapterSource,
  "export async function loadAdminBillingOpsModel()",
  "export async function loadAdminAuditModel()",
  "admin_billing_loader_source",
);
const auditLoaderSource = sliceBetween(
  adapterSource,
  "export async function loadAdminAuditModel()",
  "export async function loadAdminSystemModel()",
  "admin_audit_loader_source",
);
const adminBillingSource = await source(`${appRoot}/pages/admin/AdminBillingOps.tsx`);
const adminAuditSource = await source(`${appRoot}/pages/admin/AdminAudit.tsx`);

assertIncludes(billingLoaderSource, "rowKey:", "admin_billing_rows_must_expose_ui_row_key");
assertIncludes(billingLoaderSource, "billingRowKey(", "admin_billing_rows_must_use_stable_source_aware_row_key");
assertIncludes(adapterSource, 'return `billing:${source}:${type}:${event}:${primary}:${index}`;', "admin_billing_row_key_must_include_source_type_event_primary_index");
for (const sourceCollection of ['source: "pendingRuns"', 'source: "warningEvents"', 'source: "adjustments"']) {
  assertIncludes(billingLoaderSource, sourceCollection, `admin_billing_row_key_source_collection_missing:${sourceCollection}`);
}
assertIncludes(auditLoaderSource, "rowKey:", "admin_audit_rows_must_expose_ui_row_key");
assertIncludes(auditLoaderSource, "auditRowKey(", "admin_audit_rows_must_use_stable_event_aware_row_key");
assertIncludes(adapterSource, 'return `audit:items:${type}:${detail}:${primary}:${index}`;', "admin_audit_row_key_must_include_source_type_detail_primary_index");
assertIncludes(adminBillingSource, "key={item.rowKey}", "admin_billing_table_must_use_ui_row_key");
assertIncludes(adminAuditSource, "key={event.rowKey}", "admin_audit_table_must_use_ui_row_key");
assertExcludes(adminBillingSource, "key={item.id}", "admin_billing_table_must_not_key_by_business_id");
assertExcludes(adminAuditSource, "key={event.id}", "admin_audit_table_must_not_key_by_business_id");

const adminOpsSource = await source(`${appRoot}/pages/admin/AdminOps.tsx`);
assertIncludes(adminOpsSource, "opsSurfaceEnabled", "admin_ops_page_must_branch_on_disabled_product_state");
assertIncludes(adminOpsSource, "平台托管运维入口未启用", "admin_ops_page_must_show_disabled_product_state");
assertExcludes(adminOpsSource, "Portal 数据暂时不可用", "admin_ops_page_must_not_show_generic_error_for_disabled_surface");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_figma_make_admin_readiness",
  checked: [
    "new_zip_admin_routes",
    "admin_pages_use_portal_api_adapters",
    "admin_mock_data_removed",
    "role_context_uses_backend_projection",
    "role_context_not_security_boundary",
    "old_admin_console_removed",
    "figma_imports_residue_excluded",
    "admin_billing_audit_row_key_wiring",
  ],
}, null, 2));
