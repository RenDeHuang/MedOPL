import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { TEST_LANE_SUITES } from "../../../scripts/v22-test-classification.mjs";

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function extractArray(source, constName) {
  const start = source.indexOf(`const ${constName} = [`);
  assert.notEqual(start, -1, `array_missing:${constName}`);
  const bodyStart = source.indexOf("[", start);
  const bodyEnd = source.indexOf("];", bodyStart);
  assert.notEqual(bodyEnd, -1, `array_end_missing:${constName}`);
  return source.slice(bodyStart, bodyEnd + 1);
}

const [
  rootReadme,
  activeReadme,
  publicReadme,
  specsIndex,
  productSpec,
  operationsSpec,
  runtimeSpec,
  frameworkReadme,
  evidenceReadme,
  sourceSpec,
  productReadme,
  pageStateMatrix,
  layout,
  roleContext,
  routes,
  adminApi,
  adminModel,
  goRouter,
] = await Promise.all([
  readFile("README.md", "utf8"),
  readFile("docs/active/README.md", "utf8"),
  readFile("docs/public/README.md", "utf8"),
  readFile("docs/specs/README.md", "utf8"),
  readFile("specs/product/spec.md", "utf8"),
  readFile("specs/operations/spec.md", "utf8"),
  readFile("specs/runtime/spec.md", "utf8"),
  readFile("docs/framework/README.md", "utf8"),
  readFile("docs/evidence/README.md", "utf8"),
  readFile("specs/source/spec.md", "utf8"),
  readFile("docs/product/README.md", "utf8"),
  readFile("contracts/medopl-portal-page-state-matrix.json", "utf8"),
  readFile("services/portal/frontend/src/app/components/Layout.tsx", "utf8"),
  readFile("services/portal/frontend/src/app/contexts/RoleContext.tsx", "utf8"),
  readFile("services/portal/frontend/src/app/routes.tsx", "utf8"),
  readFile("services/portal/frontend/src/api/portal/admin.ts", "utf8"),
  readFile("services/portal/frontend/src/app/data/portalAdminOpsModel.ts", "utf8"),
  readFile("services/medopl-go-backend/internal/server/router.go", "utf8"),
]);

assertIncludes(specsIndex, "spec:v22-portal-user-surface-boundary", "specs_index_user_surface_anchor");
assertIncludes(specsIndex, "spec:v22-portal-admin-ops-surface-boundary", "specs_index_admin_surface_anchor");
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_role_surface_json");

assertIncludes(productSpec, "`product:portal-user-surface-boundary`", "product_spec_user_surface_requirement");
assertIncludes(operationsSpec, "`operations:portal-admin-ops-surface-boundary`", "operations_spec_admin_surface_requirement");
assertIncludes(runtimeSpec, "`runtime:saas-portal-opl-ops-surface-boundary`", "runtime_spec_shared_surface_requirement");
assertIncludes(productReadme, "普通用户产品语言不展示 CVM、COS、K8s、节点池或云控制台配置", "product_readme_user_surface_language");
assertIncludes(productReadme, "管理台和普通用户边界", "product_readme_role_boundary");
assertIncludes(productReadme, "用户侧只回答六个资源问题", "product_readme_resource_control_user_surface");
assertIncludes(productReadme, "计算资源", "product_readme_compute_resource_language");
assertIncludes(productReadme, "存储空间里有什么", "product_readme_storage_inventory_language");
assertNotIncludes(productReadme, "billing / trace / audit", "product_readme_must_not_keep_trace_in_golden_path");
assertNotIncludes(productReadme, "Trace 不再作为用户主导航", "product_readme_must_state_trace_retirement_without_reintroducing_nav_copy");
for (const [sourceName, sourceText] of [
  ["root_readme", rootReadme],
  ["active_readme", activeReadme],
  ["public_readme", publicReadme],
  ["product_readme", productReadme],
  ["framework_readme", frameworkReadme],
  ["evidence_readme", evidenceReadme],
  ["runtime_spec", runtimeSpec],
  ["source_spec", sourceSpec],
]) {
  assertNotIncludes(sourceText, "托管科研工作台", `${sourceName}_must_not_keep_workbench_product_truth`);
  assertNotIncludes(sourceText, "运行轨迹", `${sourceName}_must_not_keep_trace_product_copy`);
  assertNotIncludes(sourceText, "任务与结果", `${sourceName}_must_not_keep_tasks_results_product_copy`);
  assertNotIncludes(sourceText, "工作台", `${sourceName}_must_not_keep_workbench_surface_copy`);
  assertNotIncludes(sourceText, "files-billing-trace", `${sourceName}_must_not_keep_files_billing_trace_anchor`);
  assertNotIncludes(sourceText, "trace metadata", `${sourceName}_must_not_keep_trace_metadata_surface`);
  assertNotIncludes(sourceText, "trace projection", `${sourceName}_must_not_keep_trace_projection_surface`);
}
assertIncludes(pageStateMatrix, "\"resource_overview\"", "page_state_matrix_resource_overview");
assertIncludes(pageStateMatrix, "\"packages_purchase\"", "page_state_matrix_packages_purchase");
assertIncludes(pageStateMatrix, "\"compute_resource\"", "page_state_matrix_compute_resource");
assertIncludes(pageStateMatrix, "\"storage_space\"", "page_state_matrix_storage_space");
assertIncludes(pageStateMatrix, "\"usage_billing\"", "page_state_matrix_usage_billing");
assertIncludes(pageStateMatrix, "\"opl_entry\"", "page_state_matrix_opl_entry");
assertNotIncludes(pageStateMatrix, "actor_trace", "page_state_matrix_must_not_own_actor_trace");

const userNavigation = extractArray(layout, "userNavigation");
const adminNavigation = extractArray(layout, "adminNavigation");

for (const route of ["/overview", "/packages", "/resources", "/workspace", "/billing", "/opl-launch"]) {
  assertIncludes(userNavigation, route, `user_navigation_route:${route}`);
}
assertNotIncludes(userNavigation, "/trace", "user_navigation_must_retire_trace_route");
for (const label of ["资源总览", "套餐与购买", "计算资源", "存储空间", "费用与用量", "进入 OPL"]) {
  assertIncludes(userNavigation, label, `user_navigation_label:${label}`);
}
for (const route of ["/admin/dashboard", "/admin/users", "/admin/alerts", "/admin/billing-ops", "/admin/audit", "/admin/system", "/admin/ops"]) {
  assertIncludes(adminNavigation, route, `admin_navigation_route:${route}`);
  assertNotIncludes(userNavigation, route, `user_navigation_must_not_include_admin_route:${route}`);
}

assertIncludes(layout, "const isAdmin = userRole === \"admin\"", "layout_must_gate_admin_navigation_by_role");
assertIncludes(layout, "{isAdmin &&", "layout_admin_navigation_must_be_conditional");
assertIncludes(layout, "真实 admin 权限由 Go /api/admin/* 后端校验", "layout_must_name_backend_admin_authority");
assertIncludes(roleContext, "loadCurrentUser", "role_context_must_receive_current_user_loader");
assertNotIncludes(roleContext, "../../api/portal/", "role_context_must_not_import_portal_api_directly");

for (const route of ["admin/dashboard", "admin/users", "admin/alerts", "admin/billing-ops", "admin/audit", "admin/system", "admin/ops"]) {
  assertIncludes(routes, `path: "${route}"`, `admin_route_registered:${route}`);
}
for (const route of ["overview", "packages", "resources", "workspace", "billing", "opl-launch"]) {
  assertIncludes(routes, `path: "${route}"`, `user_route_registered:${route}`);
}
assertNotIncludes(routes, 'path: "trace"', "trace_user_route_must_be_retired");
assertNotIncludes(routes, 'path: "tasks"', "retired_tasks_route_must_stay_retired");

assertIncludes(goRouter, 'router.GET("/api/admin/overview", handlers.AdminOverview())', "go_router_admin_overview_route");
assertIncludes(goRouter, 'router.GET("/api/admin/ops", handlers.AdminOps())', "go_router_admin_ops_route");
assertNotIncludes(goRouter, "/api/admin/agent-traces", "go_router_must_retire_admin_agent_trace_route");
assertIncludes(goRouter, "/api/admin/audit-events", "go_router_must_expose_admin_audit_events_route");
assertNotIncludes(adminApi, "fetchAdminAgentTraces", "admin_api_must_retire_agent_trace_fetcher");
assertNotIncludes(adminApi, "AdminAgentTracesPayload", "admin_api_must_retire_agent_trace_payload");
assertIncludes(adminApi, "fetchAdminAuditEvents", "admin_api_must_expose_audit_events_fetcher");
assertIncludes(adminModel, "markAdminBillingOp", "admin_model_local_billing_action");
assertIncludes(adminModel, "saveAdminAnnouncement", "admin_model_local_announcement_action");
assertIncludes(adminModel, "toggleAdminAnnouncement", "admin_model_local_toggle_announcement_action");
assertIncludes(adminModel, "updateAdminSiteSettings", "admin_model_local_site_settings_action");
assertIncludes(adminModel, "真实云资源操作未授权", "admin_model_no_real_cloud_action");
assertIncludes(adminModel, "真实扣费未授权", "admin_model_no_real_billing_action");

for (const forbidden of [
  "SecretId",
  "SecretKey",
  "kubeconfig",
  "raw API Key",
  "signedUrl",
  "objectKey",
]) {
  assertNotIncludes(userNavigation, forbidden, "user_navigation_sensitive_boundary");
}

assert(
  TEST_LANE_SUITES["local-regression"].includes("tests/regression/portal/regression-test-v22-portal-role-surface-boundaries.mjs"),
  "local_regression_suite_must_run_role_surface_boundary",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_role_surface_boundaries",
  checked: [
    "spec_owner_anchors",
    "user_navigation_excludes_admin",
    "admin_navigation_role_gated",
    "go_admin_route_authority",
    "admin_local_actions_without_real_cloud_or_secret",
  ],
}, null, 2));
