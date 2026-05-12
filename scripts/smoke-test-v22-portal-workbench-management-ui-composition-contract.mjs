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
assert.equal(contract.version, 2, "contract_version_mismatch");
assert.equal(contract.model, "gpt-5.4", "contract_model_mismatch");
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
assert.equal(contract.visibleRoutes.publicAuthRenderedByBackend, true, "public_auth_must_be_backend_rendered");
assert.equal(contract.visibleRoutes.spaRouterOwnsAuthenticatedApp, true, "spa_router_must_own_authenticated_app");
assert.equal(contract.designReference.sub2apiEngineeringPatternOnly, true, "sub2api_must_be_engineering_pattern_only");
assert.equal(contract.designReference.sub2apiCodeCopied, false, "sub2api_code_must_not_be_copied");
assert.equal(contract.designReference.uiUxProMaxDesignPatternOnly, true, "ui_ux_pro_max_must_be_design_pattern_only");
assert.equal(contract.designReference.uiUxProMaxFrameworkDependency, false, "ui_ux_pro_max_must_not_be_framework_dependency");
assert.deepEqual(contract.designReference.designChecks, [
  "information_hierarchy",
  "card_list_table_choice",
  "color_typography_tone",
  "anti_patterns",
], "design_reference_checks_mismatch");
assert.equal(contract.uiArchitecture.method, "sub2api_style_layout_first", "ui_architecture_method_mismatch");
assert.deepEqual(contract.uiArchitecture.layers, ["route_entry", "token", "primitive", "layout", "domain_composable", "feature_component", "page_orchestration", "harness_validation"], "ui_architecture_layers_mismatch");
assert.deepEqual(contract.uiArchitecture.sequence, ["visual_primitives", "page_layouts", "common_patterns", "domain_components", "view_orchestration", "state_composables", "contract_harness"], "ui_architecture_sequence_mismatch");
assert.equal(contract.uiArchitecture.pageRole, "orchestration_only", "page_role_must_be_orchestration_only");
assert.deepEqual(contract.uiArchitecture.layoutProtocol, ["DashboardPageLayout", "TablePageLayout", "DetailPageLayout"], "layout_protocol_mismatch");
assert.deepEqual(contract.uiArchitecture.currentFeatureComponentSources, [
  "services/portal/frontend/src/components/overview",
  "services/portal/frontend/src/components/billing",
  "services/portal/frontend/src/components/resources",
  "services/portal/frontend/src/components/workspace",
  "services/portal/frontend/src/components/trace",
  "services/portal/frontend/src/components/admin",
], "current_feature_component_sources_mismatch");
assert.equal(contract.uiArchitecture.surfaceRegistry, "services/portal/frontend/src/harness/portal-ui-surfaces.ts", "surface_registry_path_mismatch");
assert.equal(contract.uiArchitecture.sixLayerAudit.routeEntry.status, "partial", "route_entry_audit_status_mismatch");
assert.equal(contract.uiArchitecture.sixLayerAudit.pageShell.status, "partial", "page_shell_audit_status_mismatch");
assert.equal(contract.uiArchitecture.sixLayerAudit.pageOrchestration.status, "partial", "page_orchestration_audit_status_mismatch");
assert.equal(contract.uiArchitecture.sixLayerAudit.featureComponents.status, "partial", "feature_components_audit_status_mismatch");
assert.equal(contract.uiArchitecture.sixLayerAudit.commonComponents.status, "partial", "common_components_audit_status_mismatch");
assert.equal(contract.uiArchitecture.sixLayerAudit.visualFoundation.status, "partial", "visual_foundation_audit_status_mismatch");
assertIncludes(contract.uiArchitecture.sixLayerAudit.pageOrchestration.gaps.join("\n"), "overview_not_yet_using_DashboardPageLayout", "six_layer_audit_must_record_overview_layout_gap");
assertIncludes(contract.uiArchitecture.sixLayerAudit.commonComponents.gaps.join("\n"), "missing_SectionCard_PageState_TableShell_PaginationBar_FormField", "six_layer_audit_must_record_common_gap");
assert.equal(contract.uiArchitecture.navigationPageSurfaceModel.siteSettingsDuplicate, false, "site_settings_must_not_be_treated_as_duplicate");
assert.deepEqual(contract.uiArchitecture.navigationPageSurfaceModel.adminSystemContains, [
  "admin.system.site_settings",
  "admin.system.service_status",
], "admin_system_surface_model_mismatch");
assert.equal(contract.copyArchitecture.rawStatusVisible, false, "raw_status_must_not_be_visible");
assertIncludes(contract.copyArchitecture.forbiddenUiTerms.join("\n"), "账务", "copy_forbidden_ledger_term");
assert.deepEqual(contract.workbenchPages, ["总览", "计算资源", "任务执行", "文件空间", "账单"], "workbench_pages_mismatch");
assert.deepEqual(contract.managementPages, ["平台总览", "客户账户", "资源管理", "任务记录", "账单管理", "审计记录", "站点设置", "服务状态"], "management_pages_mismatch");
assert.deepEqual(contract.commonComponentRegistry, [
  "MetricCard",
  "DataTable",
  "DateRangeFilter",
  "StatusBadge",
  "ActionPanel",
], "common_component_registry_mismatch");
assert.deepEqual(contract.fixedFeatureComponentRegistry, [
  "SiteLogoField",
  "HomeContentEditor",
], "fixed_feature_component_registry_mismatch");
assert.equal(contract.runtimeSmokeEntrypoint, "scripts/smoke-test-v22-portal-runtime-suite.mjs", "runtime_suite_entrypoint_mismatch");
assertIncludes(contract.validationGroups.join("\n"), "architecture", "runtime_suite_must_include_architecture_group");

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
const dashboardPageLayout = await source("services/portal/frontend/src/layouts/DashboardPageLayout.vue");
const tablePageLayout = await source("services/portal/frontend/src/layouts/TablePageLayout.vue");
const detailPageLayout = await source("services/portal/frontend/src/layouts/DetailPageLayout.vue");
const overviewHero = await source("services/portal/frontend/src/components/overview/OverviewHero.vue");
const overviewFinancialMetricsPanel = await source("services/portal/frontend/src/components/overview/OverviewFinancialMetricsPanel.vue");
const overviewManagedEnvironmentPanel = await source("services/portal/frontend/src/components/overview/OverviewManagedEnvironmentPanel.vue");
const overviewRecentRunsPanel = await source("services/portal/frontend/src/components/overview/OverviewRecentRunsPanel.vue");
const overviewWorkspacePanel = await source("services/portal/frontend/src/components/overview/OverviewWorkspacePanel.vue");
const billingHero = await source("services/portal/frontend/src/components/billing/BillingHero.vue");
const billingCostBreakdownPanel = await source("services/portal/frontend/src/components/billing/BillingCostBreakdownPanel.vue");
const billingTrendAndFilterPanel = await source("services/portal/frontend/src/components/billing/BillingTrendAndFilterPanel.vue");
const billingWorkspaceCostPanel = await source("services/portal/frontend/src/components/billing/BillingWorkspaceCostPanel.vue");
const billingRunCostPanel = await source("services/portal/frontend/src/components/billing/BillingRunCostPanel.vue");
const billingLedgerPanel = await source("services/portal/frontend/src/components/billing/BillingLedgerPanel.vue");
const resourcesHero = await source("services/portal/frontend/src/components/resources/ResourcesHero.vue");
const resourcesPlanSelectionPanel = await source("services/portal/frontend/src/components/resources/ResourcesPlanSelectionPanel.vue");
const resourcesAdjustmentPanel = await source("services/portal/frontend/src/components/resources/ResourcesAdjustmentPanel.vue");
const resourcesCurrentPanel = await source("services/portal/frontend/src/components/resources/ResourcesCurrentPanel.vue");
const resourcesReleaseAuditPanel = await source("services/portal/frontend/src/components/resources/ResourcesReleaseAuditPanel.vue");
const traceHero = await source("services/portal/frontend/src/components/trace/TraceHero.vue");
const traceFilterPanel = await source("services/portal/frontend/src/components/trace/TraceFilterPanel.vue");
const traceSessionTablePanel = await source("services/portal/frontend/src/components/trace/TraceSessionTablePanel.vue");
const workspaceHero = await source("services/portal/frontend/src/components/workspace/WorkspaceHero.vue");
const workspaceFileSpacePanel = await source("services/portal/frontend/src/components/workspace/WorkspaceFileSpacePanel.vue");
const workspaceManagedPlanPanel = await source("services/portal/frontend/src/components/workspace/WorkspaceManagedPlanPanel.vue");
const workspaceListPanel = await source("services/portal/frontend/src/components/workspace/WorkspaceListPanel.vue");
const workspaceFilesPanel = await source("services/portal/frontend/src/components/workspace/WorkspaceFilesPanel.vue");
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
assertIncludes(dashboardPageLayout, "data-layout-id", "dashboard_layout_must_expose_layout_anchor");
assertIncludes(dashboardPageLayout, "data-layout-slot", "dashboard_layout_must_expose_slot_anchors");
assertIncludes(dashboardPageLayout, "hero", "dashboard_layout_must_support_hero_slot");
assertIncludes(tablePageLayout, "data-layout-id", "table_layout_must_expose_layout_anchor");
assertIncludes(tablePageLayout, "filters", "table_layout_must_support_filters_slot");
assertIncludes(tablePageLayout, "pagination", "table_layout_must_support_pagination_slot");
assertIncludes(detailPageLayout, "data-layout-id", "detail_layout_must_expose_layout_anchor");
assertIncludes(detailPageLayout, "primary", "detail_layout_must_support_primary_slot");
assertIncludes(detailPageLayout, "secondary", "detail_layout_must_support_secondary_slot");
assertIncludes(surfaceRegistry, "portalUiSurfaces", "surface_registry_must_export_registry");
assertIncludes(surfaceRegistry, "portalUiLayouts", "surface_registry_must_export_layout_registry");
for (const layout of [
  "layout.dashboard_page",
  "layout.table_page",
  "layout.detail_page",
]) {
  assertIncludes(surfaceRegistry, `layoutId: "${layout}"`, `surface_registry_${layout}`);
}
for (const surface of [
  "overview.hero",
  "overview.financial_metrics",
  "overview.managed_environment",
  "overview.recent_runs",
  "overview.workspace",
  "billing.hero",
  "billing.cost_breakdown",
  "billing.trend_filter",
  "billing.workspace_costs",
  "billing.run_costs",
  "billing.ledger",
  "resources.hero",
  "resources.plan_selection",
  "resources.adjustment",
  "resources.current",
  "resources.release_audit",
  "trace.hero",
  "trace.filter",
  "trace.session_table",
  "workspace.hero",
  "workspace.file_space",
  "workspace.managed_plan",
  "workspace.list",
  "workspace.files",
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
  billingHero,
  billingCostBreakdownPanel,
  billingTrendAndFilterPanel,
  billingWorkspaceCostPanel,
  billingRunCostPanel,
  billingLedgerPanel,
  resourcesHero,
  resourcesPlanSelectionPanel,
  resourcesAdjustmentPanel,
  resourcesCurrentPanel,
  resourcesReleaseAuditPanel,
  traceHero,
  traceFilterPanel,
  traceSessionTablePanel,
  workspaceHero,
  workspaceFileSpacePanel,
  workspaceManagedPlanPanel,
  workspaceListPanel,
  workspaceFilesPanel,
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
assertIncludes(billing, "BillingHero", "billing_view_must_compose_hero_component");
assertIncludes(billing, "DashboardPageLayout", "billing_view_must_use_dashboard_page_layout");
assertIncludes(billing, "TablePageLayout", "billing_view_must_use_table_page_layout");
assertIncludes(billing, "DetailPageLayout", "billing_view_must_use_detail_page_layout");
assertIncludes(billing, "BillingCostBreakdownPanel", "billing_view_must_compose_cost_breakdown_component");
assertIncludes(billing, "BillingTrendAndFilterPanel", "billing_view_must_compose_trend_filter_component");
assertIncludes(billing, "BillingWorkspaceCostPanel", "billing_view_must_compose_workspace_cost_component");
assertIncludes(billing, "BillingRunCostPanel", "billing_view_must_compose_run_cost_component");
assertIncludes(billing, "BillingLedgerPanel", "billing_view_must_compose_ledger_component");
assertIncludes(resources, "DashboardPageLayout", "resources_view_must_use_dashboard_page_layout");
assertIncludes(resources, "DetailPageLayout", "resources_view_must_use_detail_page_layout");
assertIncludes(resources, "ResourcesHero", "resources_view_must_compose_hero_component");
assertIncludes(resources, "ResourcesPlanSelectionPanel", "resources_view_must_compose_plan_selection_component");
assertIncludes(resources, "ResourcesAdjustmentPanel", "resources_view_must_compose_adjustment_component");
assertIncludes(resources, "ResourcesCurrentPanel", "resources_view_must_compose_current_component");
assertIncludes(resources, "ResourcesReleaseAuditPanel", "resources_view_must_compose_release_audit_component");
assertIncludes(trace, "DashboardPageLayout", "trace_view_must_use_dashboard_page_layout");
assertIncludes(trace, "TablePageLayout", "trace_view_must_use_table_page_layout");
assertIncludes(trace, "TraceHero", "trace_view_must_compose_hero_component");
assertIncludes(trace, "TraceFilterPanel", "trace_view_must_compose_filter_component");
assertIncludes(trace, "TraceSessionTablePanel", "trace_view_must_compose_session_table_component");
assertIncludes(workspace, "DashboardPageLayout", "workspace_view_must_use_dashboard_page_layout");
assertIncludes(workspace, "DetailPageLayout", "workspace_view_must_use_detail_page_layout");
assertIncludes(workspace, "TablePageLayout", "workspace_view_must_use_table_page_layout");
assertIncludes(workspace, "WorkspaceHero", "workspace_view_must_compose_hero_component");
assertIncludes(workspace, "WorkspaceFileSpacePanel", "workspace_view_must_compose_file_space_component");
assertIncludes(workspace, "WorkspaceManagedPlanPanel", "workspace_view_must_compose_managed_plan_component");
assertIncludes(workspace, "WorkspaceListPanel", "workspace_view_must_compose_list_component");
assertIncludes(workspace, "WorkspaceFilesPanel", "workspace_view_must_compose_files_component");
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
  visibleVueText(billingHero),
  visibleVueText(billingCostBreakdownPanel),
  visibleVueText(billingTrendAndFilterPanel),
  visibleVueText(billingWorkspaceCostPanel),
  visibleVueText(billingRunCostPanel),
  visibleVueText(billingLedgerPanel),
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
for (const term of contract.copyArchitecture.forbiddenUiTerms) {
  assertExcludes(workbenchCopy, term, "workbench_copy_forbidden_architecture_term");
}
for (const term of contract.workbenchForbiddenTokens) {
  assertExcludes(workbenchCopy, term, "workbench_forbidden_internal_token");
}
for (const forbiddenSlashCopy of ["预扣费 / 冻结金额", "停止计费 / 审计状态", "输入文件 / 输出文件", "选择套餐 / 工作台资源计划", "释放策略 / 审计状态", "充值 / 退款 / 补扣", "核 /", "¥3.20 / 小时", "¥9.60 / 小时", " 入 / ", " 出 / "]) {
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
for (const term of contract.copyArchitecture.forbiddenUiTerms) {
  assertExcludes(managementCopy, term, "management_copy_forbidden_architecture_term");
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
