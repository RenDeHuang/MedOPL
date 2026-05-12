import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md";
const start = "<!-- v22-portal-workbench-management-ui-composition-contract:start -->";
const end = "<!-- v22-portal-workbench-management-ui-composition-contract:end -->";

async function source(path) {
  return readFile(path, "utf8");
}

function extractJson(markdown) {
  const startIndex = markdown.indexOf(start);
  assert.notEqual(startIndex, -1, "composition_contract_start_marker_missing");
  const endIndex = markdown.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, "composition_contract_end_marker_missing");
  const block = markdown.slice(startIndex + start.length, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, "composition_contract_must_be_single_json_fence");
  return JSON.parse(match[1]);
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function assertAnyIncludes(text, expectedItems, label) {
  assert(expectedItems.some((item) => text.includes(item)), `${label}_missing_any:${expectedItems.join("|")}`);
}

function visibleVueText(sourceText) {
  return sourceText
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/{{[\s\S]*?}}/g, " ")
    .replace(/<[^>]+>/g, " ");
}

const markdown = await source(contractPath);
const contract = extractJson(markdown);

assert.equal(contract.contract, "v22_portal_workbench_management_ui_composition_boundary", "contract_name_mismatch");
assert.equal(contract.version, 1, "contract_version_mismatch");
assert.equal(contract.scope.portalOnly, true, "composition_scope_must_be_portal_only");
assert.equal(contract.scope.implementsUi, true, "composition_contract_must_implement_ui");
assert.equal(contract.scope.callsRealCloud, false, "composition_contract_must_not_call_real_cloud");
assert.equal(contract.scope.readsSecrets, false, "composition_contract_must_not_read_secrets");
assert.equal(contract.entryNaming.userSurface, "工作台", "user_surface_name_mismatch");
assert.equal(contract.entryNaming.adminSurface, "管理台", "admin_surface_name_mismatch");
assert.equal(contract.entryNaming.slashSeparatedUiCopyAllowed, false, "slash_copy_must_be_forbidden");
assert.equal(contract.publicHome.enabled, true, "public_home_must_be_enabled");
assert.deepEqual(contract.publicHome.homeContentModes, ["empty_default_opl_intro", "url_iframe", "html_full_page"], "home_content_modes_mismatch");
assert.equal(contract.loginRegister.loginPrimaryMode, "email_password", "login_primary_mode_mismatch");
assert.equal(contract.loginRegister.loginSuccessLocation, "/overview", "login_success_location_mismatch");
assert.equal(contract.loginRegister.oidcPrimaryButtonAllowed, false, "oidc_primary_button_must_be_forbidden");
assert.equal(contract.visibleRoutes.routerBase, "/", "visible_router_base_must_be_top_level");
assert.equal(contract.visibleRoutes.workbenchOverview, "/overview", "visible_workbench_overview_mismatch");
assert.equal(contract.visibleRoutes.managementSystem, "/admin/system", "visible_management_system_mismatch");
assert.equal(contract.visibleRoutes.legacyPortalAppPrimary, "compat_redirect_only", "legacy_portal_app_must_be_compat_only");
assert.deepEqual(contract.uiArchitecture.layers, ["token", "primitive", "layout", "feature_component", "page_orchestration", "harness_validation"], "ui_architecture_layers_mismatch");
assert.equal(contract.uiArchitecture.pageRole, "orchestration_only", "page_role_must_be_orchestration_only");
assert.equal(contract.uiArchitecture.surfaceRegistry, "services/portal/frontend/src/harness/portal-ui-surfaces.ts", "surface_registry_path_mismatch");
assert.deepEqual(contract.workbenchPages, ["总览", "计算资源", "任务执行", "文件空间", "账务"], "workbench_pages_mismatch");
assert.deepEqual(contract.managementPages, ["平台总览", "客户账户", "资源管理", "任务记录", "账务管理", "审计记录", "站点设置", "服务状态"], "management_pages_mismatch");
assert.equal(contract.runtimeSmokeEntrypoint, "scripts/smoke-test-v22-portal-runtime-suite.mjs", "runtime_suite_entrypoint_mismatch");

const router = await source("services/portal/frontend/src/router/index.ts");
const sidebar = await source("services/portal/frontend/src/layouts/AppSidebar.vue");
const auth = await source("services/portal/src/app/portal-auth-runtime-handler.mjs");
const dispatcher = await source("services/portal/src/app/portal-http-dispatcher.mjs");
const adminRoutes = await source("services/portal/src/routes/admin-ops.routes.mjs");
const adminApi = await source("services/portal/src/app/portal-admin-api-payloads.mjs");
const frontendAdminApi = await source("services/portal/frontend/src/api/portal/admin.ts");
const frontendPublicApi = await source("services/portal/frontend/src/api/portal/public.ts");
const adminSystem = await source("services/portal/frontend/src/views/admin/AdminSystemView.vue");
const surfaceRegistry = await source("services/portal/frontend/src/harness/portal-ui-surfaces.ts");
const dataTable = await source("services/portal/frontend/src/components/common/DataTable.vue");
const dateRangeFilter = await source("services/portal/frontend/src/components/common/DateRangeFilter.vue");
const siteLogoField = await source("services/portal/frontend/src/components/admin/SiteLogoField.vue");
const homeContentEditor = await source("services/portal/frontend/src/components/admin/HomeContentEditor.vue");
const statusBadge = await source("services/portal/frontend/src/components/common/StatusBadge.vue");
const actionPanel = await source("services/portal/frontend/src/components/common/ActionPanel.vue");
const overviewHero = await source("services/portal/frontend/src/components/overview/OverviewHero.vue");
const overviewFinancialMetricsPanel = await source("services/portal/frontend/src/components/overview/OverviewFinancialMetricsPanel.vue");
const overviewManagedEnvironmentPanel = await source("services/portal/frontend/src/components/overview/OverviewManagedEnvironmentPanel.vue");
const overviewRecentRunsPanel = await source("services/portal/frontend/src/components/overview/OverviewRecentRunsPanel.vue");
const overviewWorkspacePanel = await source("services/portal/frontend/src/components/overview/OverviewWorkspacePanel.vue");
const adminSiteSettingsPanel = await source("services/portal/frontend/src/components/admin/AdminSiteSettingsPanel.vue");
const adminServiceStatusPanel = await source("services/portal/frontend/src/components/admin/AdminServiceStatusPanel.vue");
const overview = await source("services/portal/frontend/src/views/overview/OverviewView.vue");
const billing = await source("services/portal/frontend/src/views/billing/BillingView.vue");
const resources = await source("services/portal/frontend/src/views/resources/ResourcesView.vue");
const workspace = await source("services/portal/frontend/src/views/workspace/WorkspaceView.vue");
const trace = await source("services/portal/frontend/src/views/trace/TraceView.vue");

assertIncludes(router, 'path: "/home"', "router_must_define_public_home_route");
assertIncludes(router, 'path: "/login"', "router_must_define_login_route");
assertIncludes(router, 'path: "/register"', "router_must_define_register_route");
assertIncludes(router, "createWebHistory()", "router_must_use_top_level_history");
assertIncludes(dispatcher, '"/portal/api/public/settings"', "dispatcher_must_expose_public_settings_api");
assertIncludes(dispatcher, '"/overview"', "dispatcher_must_serve_top_level_overview_shell");
assertIncludes(dispatcher, '"/admin/system"', "dispatcher_must_serve_top_level_admin_system_shell");
assertIncludes(dispatcher, "renderPortalPublicHome", "dispatcher_must_render_public_home");
assertIncludes(auth, "renderPortalLoginPage", "auth_must_render_brand_login_page");
assertIncludes(auth, "renderPortalRegisterPage", "auth_must_render_brand_register_page");
assertIncludes(auth, 'const PORTAL_AUTH_SUCCESS_LOCATION = "/overview"', "auth_success_must_land_on_top_level_overview");
assertExcludes(auth, "使用统一账号登录", "auth_login_copy");
assertIncludes(await source("services/portal/src/app/portal-public-home.mjs"), 'href="/overview"', "public_home_cta_must_target_top_level_overview");
assertIncludes(adminRoutes, "siteName", "admin_settings_must_accept_site_name");
assertIncludes(adminRoutes, "siteLogo", "admin_settings_must_accept_site_logo");
assertIncludes(adminRoutes, "siteSubtitle", "admin_settings_must_accept_site_subtitle");
assertIncludes(adminRoutes, "homeContent", "admin_settings_must_accept_home_content");
assertIncludes(adminApi, "publicSettings", "admin_system_payload_must_include_public_settings");
assertIncludes(frontendPublicApi, "PublicSettingsPayload", "frontend_public_api_must_type_public_settings");
assertIncludes(frontendPublicApi, '"/public/settings"', "frontend_public_api_must_fetch_public_settings");
assertIncludes(frontendAdminApi, "PublicSettingsPayload", "frontend_admin_api_must_type_public_settings");
assertIncludes(frontendAdminApi, "updateAdminSiteSettings", "frontend_admin_api_must_save_site_settings");
assertIncludes(adminSystem, "站点设置", "admin_system_must_show_site_settings");

assertIncludes(dataTable, "emptyText", "component_registry_data_table");
assertIncludes(dateRangeFilter, "开始日期", "component_registry_date_range_filter");
assertIncludes(siteLogoField, "站点 logo", "component_registry_site_logo_field");
assertIncludes(homeContentEditor, "font-mono", "component_registry_home_content_editor");
assertIncludes(statusBadge, "badgeClass", "component_registry_status_badge");
assertIncludes(actionPanel, "panel-title", "component_registry_action_panel");
assertIncludes(surfaceRegistry, "portalUiSurfaces", "surface_registry_must_export_registry");
for (const surface of [
  "overview.hero",
  "overview.financial_metrics",
  "overview.managed_environment",
  "overview.recent_runs",
  "overview.workspace",
  "admin.system.site_settings",
  "admin.system.service_status",
]) {
  assertIncludes(surfaceRegistry, `componentId: "${surface}"`, `surface_registry_${surface}`);
}
for (const sourceText of [
  overviewHero,
  overviewFinancialMetricsPanel,
  overviewManagedEnvironmentPanel,
  overviewRecentRunsPanel,
  overviewWorkspacePanel,
  adminSiteSettingsPanel,
  adminServiceStatusPanel,
]) {
  assertIncludes(sourceText, "data-route-id", "feature_component_must_declare_route_anchor");
  assertIncludes(sourceText, "data-component-id", "feature_component_must_declare_component_anchor");
}
assertIncludes(overview, "OverviewHero", "overview_view_must_compose_hero_component");
assertIncludes(overview, "OverviewFinancialMetricsPanel", "overview_view_must_compose_financial_metrics_component");
assertIncludes(overview, "OverviewManagedEnvironmentPanel", "overview_view_must_compose_managed_environment_component");
assertIncludes(overview, "OverviewRecentRunsPanel", "overview_view_must_compose_recent_runs_component");
assertIncludes(overview, "OverviewWorkspacePanel", "overview_view_must_compose_workspace_component");
assertIncludes(adminSystem, "AdminSiteSettingsPanel", "admin_system_view_must_compose_site_settings_component");
assertIncludes(adminSystem, "AdminServiceStatusPanel", "admin_system_view_must_compose_service_status_component");
assertAnyIncludes(adminSiteSettingsPanel, ["站点 logo", "站点 Logo"], "admin_site_settings_must_show_logo_editor");
assertIncludes(adminSiteSettingsPanel, "SiteLogoField", "admin_site_settings_must_use_site_logo_field");
assertIncludes(adminSiteSettingsPanel, "HomeContentEditor", "admin_site_settings_must_use_home_content_editor");
assertIncludes(adminSiteSettingsPanel, "ActionPanel", "admin_site_settings_must_use_action_panel");

const workbenchCopy = [
  visibleVueText(sidebar),
  visibleVueText(overview),
  visibleVueText(overviewHero),
  visibleVueText(overviewFinancialMetricsPanel),
  visibleVueText(overviewManagedEnvironmentPanel),
  visibleVueText(overviewRecentRunsPanel),
  visibleVueText(overviewWorkspacePanel),
  visibleVueText(billing),
  visibleVueText(resources),
  visibleVueText(workspace),
  visibleVueText(trace),
].join("\n");

for (const page of contract.workbenchPages) {
  assertIncludes(workbenchCopy, page, `workbench_copy_${page}`);
}
for (const term of contract.entryNaming.forbiddenUiTerms) {
  assertExcludes(workbenchCopy, term, "workbench_forbidden_copy");
}
for (const term of contract.workbenchForbiddenTokens) {
  assertExcludes(workbenchCopy, term, "workbench_forbidden_internal_token");
}
for (const forbiddenSlashCopy of ["预扣费 / 冻结金额", "停止计费 / 审计状态", "输入文件 / 输出文件", "选择套餐 / 工作台资源计划", "释放策略 / 审计状态", "充值 / 退款 / 补扣"]) {
  assertExcludes(workbenchCopy, forbiddenSlashCopy, "slash_separated_ui_copy");
}

const managementCopy = [
  sidebar,
  visibleVueText(adminSystem),
  visibleVueText(adminSiteSettingsPanel),
  visibleVueText(adminServiceStatusPanel),
].join("\n");

for (const page of contract.managementPages) {
  assertIncludes(managementCopy, page, `management_copy_${page}`);
}
for (const term of contract.entryNaming.forbiddenUiTerms) {
  assertExcludes(managementCopy, term, "management_forbidden_copy");
}
for (const forbiddenSlashCopy of ["默认 secret / 默认口令 / 配置卫生问题", "最近任务 / 会话状态", "账号 / 工作空间", "并发 / 队列"]) {
  assertExcludes(workbenchCopy + managementCopy, forbiddenSlashCopy, "slash_separated_ui_copy");
}

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  checked: [
    "contract_json",
    "public_home_route",
    "public_settings_api",
    "auth_pages",
    "admin_site_settings",
    "workbench_copy",
    "management_copy",
  ],
}, null, 2));
