import assert from "node:assert/strict";

export const REQUIRED_PORTAL_PAGES = Object.freeze([
  Object.freeze({ page: "overview", route: "/portal/app/overview", apiSource: "/portal/api/overview", moduleSource: "overview", capability: "overview_snapshot", buildTag: "opl-v20.31" }),
  Object.freeze({ page: "packages", route: "/portal/app/packages", apiSource: "/portal/api/lab-packages", moduleSource: "packages", capability: "package_catalog", buildTag: "opl-v20.31" }),
  Object.freeze({ page: "resources", route: "/portal/app/resources", apiSource: "/portal/api/my/resources", moduleSource: "resources", capability: "resource_binding", buildTag: "opl-v20.31" }),
  Object.freeze({ page: "workspace", route: "/portal/app/workspace", apiSource: "/portal/api/workspace", moduleSource: "workspace", capability: "workspace_file_io", buildTag: "opl-v20.31" }),
  Object.freeze({ page: "billing", route: "/portal/app/billing", apiSource: "/portal/api/billing", moduleSource: "billing", capability: "billing_summary", buildTag: "opl-v20.31" }),
  Object.freeze({ page: "trace", route: "/portal/app/trace", apiSource: "/portal/api/session-traces", moduleSource: "session_trace", capability: "trace_lookup", buildTag: "opl-v20.31" }),
  Object.freeze({ page: "admin_dashboard", route: "/portal/app/admin/dashboard", apiSource: "/portal/api/admin/overview", moduleSource: "admin_dashboard", capability: "resource_admin", buildTag: "opl-v20.31" }),
  Object.freeze({ page: "admin_billing_ops", route: "/portal/app/admin/billing-ops", apiSource: "/portal/api/admin/billing-ops", moduleSource: "admin_billing_ops", capability: "accounting_admin", buildTag: "opl-v20.31" }),
  Object.freeze({ page: "admin_usage", route: "/portal/app/admin/usage", apiSource: "/portal/api/admin/usage", moduleSource: "admin_usage", capability: "usage_attribution", buildTag: "opl-v20.31" }),
  Object.freeze({ page: "admin_users", route: "/portal/app/admin/users", apiSource: "/portal/api/admin/users", moduleSource: "admin_users", capability: "user_admin", buildTag: "opl-v20.31" }),
  Object.freeze({ page: "admin_system", route: "/portal/app/admin/system", apiSource: "/portal/api/admin/system", moduleSource: "admin_system", capability: "system_health", buildTag: "opl-v20.31" }),
  Object.freeze({ page: "admin_ops", route: "/portal/app/admin/ops", apiSource: "/portal/api/admin/ops", moduleSource: "admin_ops", capability: "operations_queue", buildTag: "opl-v20.31" }),
]);

const EXPECTED_PAGES = Object.freeze([
  "overview",
  "packages",
  "resources",
  "workspace",
  "billing",
  "trace",
  "admin_dashboard",
  "admin_billing_ops",
  "admin_usage",
  "admin_users",
  "admin_system",
  "admin_ops",
]);

assert.deepEqual(
  REQUIRED_PORTAL_PAGES.map((page) => page.page),
  EXPECTED_PAGES,
  "v20_31_portal_module_wiring_must_cover_all_required_pages",
);

for (const page of REQUIRED_PORTAL_PAGES) {
  assert.equal(typeof page.page, "string", "page_name_must_be_string");
  assert.equal(typeof page.route, "string", "page_route_must_be_string");
  assert.equal(typeof page.apiSource, "string", "page_api_source_must_be_string");
  assert.equal(typeof page.moduleSource, "string", "page_module_source_must_be_string");
  assert.equal(typeof page.capability, "string", "page_capability_must_be_string");
  assert.equal(page.buildTag, "opl-v20.31", "page_build_tag_must_match_expected_release");
  assert(page.route.startsWith("/portal/app/"), "page_route_must_point_to_portal_app");
  assert(page.apiSource.startsWith("/portal/api/"), "page_api_source_must_point_to_portal_api");
  assert(page.moduleSource.length > 0, "page_module_source_must_not_be_empty");
}

console.log(JSON.stringify({
  ok: true,
  suite: "v20.31_portal_module_wiring_contract",
  buildTag: "opl-v20.31",
  requiredPageCount: REQUIRED_PORTAL_PAGES.length,
}, null, 2));
