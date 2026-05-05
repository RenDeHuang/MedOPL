import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  sidebar: "services/portal/frontend/src/layouts/AppSidebar.vue",
  resources: "services/portal/frontend/src/views/resources/ResourcesView.vue",
  workspace: "services/portal/frontend/src/views/workspace/WorkspaceView.vue",
  trace: "services/portal/frontend/src/views/trace/TraceView.vue",
  adminDashboard: "services/portal/frontend/src/views/admin/AdminDashboardView.vue",
  adminSystem: "services/portal/frontend/src/views/admin/AdminSystemView.vue",
  adminOps: "services/portal/frontend/src/views/admin/AdminOpsView.vue",
  adminPayloads: "services/portal/src/app/portal-admin-api-payloads.mjs",
  clickMatrix: "scripts/live-test-v20.34-portal-component-click-matrix.mjs",
};

const source = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, file]) => [key, await readFile(file, "utf8")])
));

assert.doesNotMatch(
  source.resources,
  /账单标签|resourceorderid|serverplanid|tenantid|workspaceid|runid/,
  "resources_view_must_not_show_internal_billing_tags_by_default"
);
assert.match(source.resources, /高级信息|确认删除|删除后停止继续预扣/, "resources_view_must_keep_safe_lifecycle_controls");

assert.doesNotMatch(
  source.workspace,
  /createStorageOrder|orderStorage|开通容量|调整容量|存储容量/,
  "workspace_view_must_not_own_storage_purchase_flow"
);
assert.match(source.workspace, /套餐页|上传文件|下载结果|进入工作台/, "workspace_view_must_focus_on_files_results_and_opl_entry");

assert.doesNotMatch(source.trace, /费用|T\+1|预扣|金额|exactCostLabel|billing\?/, "trace_view_must_not_show_billing_amounts");
assert.match(source.trace, /traceId|会话|任务编号|状态/, "trace_view_must_focus_on_process_trace_and_status");

assert.match(source.sidebar, /运营总台/, "admin_sidebar_must_name_dashboard_as_operations_console");
assert.doesNotMatch(source.sidebar, /运行资源/, "admin_sidebar_must_not_use_engineering_resource_label");

assert.doesNotMatch(source.adminDashboard, /关键入口|告警概览|K8s运维与分发|Agent Traces/, "admin_dashboard_must_remove_engineering_noise");
assert.match(source.adminDashboard, /运营入口|待处理事项|客户账务|账单归因|云资源状态/, "admin_dashboard_must_focus_on_operations_actions");

for (const [key, text] of Object.entries({ adminSystem: source.adminSystem })) {
  assert.doesNotMatch(text, /Harbor|OpenCost|Rancher/, `${key}_must_not_show_retired_infra_tools`);
}
assert.match(source.adminSystem, /Portal|OPL|Trace|Adapter|内部诊断/, "admin_system_must_focus_on_product_systems");
assert.match(source.adminOps, /云资源状态|服务器|停止计费/, "admin_ops_must_focus_on_cloud_resource_lifecycle");
assert.match(source.adminOps, /cloudResourceRows/, "admin_ops_must_read_cloud_resource_rows");
assert.match(source.adminPayloads, /cloudResourceRows/, "admin_payload_must_publish_cloud_resource_rows");
assert.match(source.adminPayloads, /customerSegment|adminDataSegment|commercialCustomers/, "admin_payload_must_segment_real_internal_and_test_fixture_customers");
assert.match(source.adminPayloads, /commercialResourceOrders|includeTestFixtures/, "admin_cloud_resource_rows_must_default_exclude_test_fixtures");
assert.doesNotMatch(source.adminPayloads, /buildAdminOpsApiPayload\(payload\)[\s\S]*serviceStatuses/, "admin_ops_payload_must_not_use_service_statuses_as_cloud_resources");
assert.match(source.clickMatrix, /RUN_V20_34_COMPONENT_CLICK_DRY_RUN/, "click_matrix_must_separate_dry_run_from_release_gate");
assert.match(source.clickMatrix, /missing_required_env_or_gate_closed/, "click_matrix_must_fail_release_gate_when_required_env_is_missing");
assert.match(source.clickMatrix, /dialog.*dismiss|confirm|二次确认/s, "click_matrix_must_exercise_dangerous_actions_to_confirmation_boundary");
assert.doesNotMatch(source.clickMatrix, /controls\.slice\(0, config\.maxControlsPerRoute\)/, "click_matrix_must_not_sample_components_by_default");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.34_portal_component_click_contract",
  covered: Object.keys(files),
}, null, 2));
