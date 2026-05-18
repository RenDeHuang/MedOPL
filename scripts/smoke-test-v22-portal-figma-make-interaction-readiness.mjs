import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appRoot = "services/portal/frontend/src/app";

async function source(filePath) {
  return readFile(filePath, "utf8");
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function assertRefForwarded(sourceText, componentName) {
  assert(
    sourceText.includes(`const ${componentName} = React.forwardRef`) ||
      sourceText.includes(`const ${componentName} = forwardRef`),
    `radix_primitive_must_forward_ref:${componentName}`,
  );
  assertIncludes(sourceText, `${componentName}.displayName`, `radix_primitive_display_name:${componentName}`);
}

function sliceBetween(text, start, end, label) {
  const startIndex = text.indexOf(start);
  assert.notEqual(startIndex, -1, `${label}_start_missing:${start}`);
  const endIndex = text.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `${label}_end_missing:${end}`);
  return text.slice(startIndex, endIndex);
}

const [
  buttonSource,
  sheetSource,
  overviewSource,
  tasksSource,
  workspaceSource,
  runtimeSource,
  oplEntrySource,
  billingSource,
  layoutSource,
  userMenuSource,
  adminUsersSource,
  adminAlertsSource,
  adminDashboardSource,
  adminAuditSource,
  adminSystemSource,
  adminOpsSource,
  dialogSource,
  adminApiSource,
  adapterSource,
] = await Promise.all([
  source(`${appRoot}/components/ui/button.tsx`),
  source(`${appRoot}/components/ui/sheet.tsx`),
  source(`${appRoot}/pages/Overview.tsx`),
  source(`${appRoot}/pages/TasksResults.tsx`),
  source(`${appRoot}/pages/Workspace.tsx`),
  source(`${appRoot}/pages/RuntimeEnvironment.tsx`),
  source(`${appRoot}/pages/OPLEntry.tsx`),
  source(`${appRoot}/pages/BillingAudit.tsx`),
  source(`${appRoot}/components/Layout.tsx`),
  source(`${appRoot}/components/UserMenu.tsx`),
  source(`${appRoot}/pages/admin/AdminUsers.tsx`),
  source(`${appRoot}/pages/admin/AdminAlerts.tsx`),
  source(`${appRoot}/pages/admin/AdminDashboard.tsx`),
  source(`${appRoot}/pages/admin/AdminAudit.tsx`),
  source(`${appRoot}/pages/admin/AdminSystem.tsx`),
  source(`${appRoot}/pages/admin/AdminOps.tsx`),
  source(`${appRoot}/components/ui/dialog.tsx`),
  source("services/portal/frontend/src/api/portal/admin.ts"),
  source(`${appRoot}/data/portalAdapters.ts`),
]);

assertRefForwarded(buttonSource, "Button");
for (const componentName of [
  "SheetTrigger",
  "SheetClose",
  "SheetOverlay",
  "SheetContent",
  "SheetTitle",
  "SheetDescription",
]) {
  assertRefForwarded(sheetSource, componentName);
}
for (const componentName of [
  "DialogTrigger",
  "DialogClose",
  "DialogOverlay",
  "DialogContent",
  "DialogTitle",
  "DialogDescription",
]) {
  assertRefForwarded(dialogSource, componentName);
}

for (const [label, pageSource, routes] of [
  ["overview", overviewSource, ["/resources", "/billing", "/opl-launch"]],
  ["tasks_results", tasksSource, ["/opl-launch", "/workspace", "/trace"]],
  ["workspace", workspaceSource, ["/opl-launch", "/trace", "/resources"]],
  ["runtime_environment", runtimeSource, ["/billing"]],
  ["opl_entry", oplEntrySource, ["/overview", "/workspace", "/resources", "/billing"]],
]) {
  assertIncludes(pageSource, 'from "react-router"', `${label}_must_use_react_router_links`);
  for (const route of routes) {
    assertIncludes(pageSource, `to="${route}"`, `${label}_cta_route`);
  }
}

assertIncludes(oplEntrySource, "OPL 网关暂不可用，请稍后重试；如持续失败，请联系管理员。", "opl_entry_product_error_copy");
assertIncludes(oplEntrySource, "<a href={query.data.oplWebUrl}", "opl_entry_ready_cta_must_open_opl_url");
assertIncludes(oplEntrySource, "<Button asChild", "opl_entry_primary_ctas_must_bind_children");

assertIncludes(userMenuSource, "Dialog", "user_menu_account_info_must_open_dialog");
assertIncludes(userMenuSource, "setAccountDialogOpen(true)", "user_menu_account_info_must_have_visible_product_action");
assertIncludes(userMenuSource, 'window.location.assign("/logout")', "user_menu_logout_must_call_backend_logout_route");
assertIncludes(userMenuSource, "hidden sm:flex", "user_menu_must_not_overflow_mobile_header");

assertIncludes(billingSource, "exportBillingRecords", "billing_export_must_have_handler");
assertIncludes(billingSource, "URL.createObjectURL", "billing_export_must_create_download");
assertIncludes(billingSource, "download =", "billing_export_must_set_download_filename");
assertIncludes(billingSource, "onClick={exportBillingRecords}", "billing_export_button_must_bind_handler");
assertIncludes(billingSource, "exportNotice", "billing_empty_export_must_show_visible_notice");
assertIncludes(billingSource, 'role="status"', "billing_empty_export_notice_must_be_status_region");
assertExcludes(billingSource, 'disabled title="当前时间窗口没有可导出的账单流水"', "billing_empty_export_must_not_be_dead_disabled_button");

assertIncludes(layoutSource, "flex-col md:flex-row", "layout_shell_must_reflow_mobile");
assertIncludes(layoutSource, "w-full md:w-64", "layout_sidebar_must_not_force_mobile_width");
assertIncludes(layoutSource, "overflow-x-auto", "layout_navigation_must_scroll_on_mobile");
assertIncludes(layoutSource, "帮助中心暂未接入", "layout_help_button_must_not_be_empty_action");
assertIncludes(layoutSource, 'name: "用户管理"', "layout_admin_users_nav_must_use_user_management_copy");
assertIncludes(layoutSource, '"/admin/users": "用户管理"', "layout_admin_users_title_must_use_user_management_copy");
assertExcludes(layoutSource, "客户账户", "layout_must_not_use_old_customer_account_copy");
assertIncludes(adminAuditSource, "overflow-x-auto", "admin_audit_table_must_be_scrollable_instead_of_layout_overflow");

assertIncludes(adminApiSource, "toggleAdminUser", "admin_user_toggle_api_helper_missing");
assertIncludes(adminApiSource, "rechargeAdminUser", "admin_user_recharge_api_helper_missing");
assertIncludes(adminApiSource, "deleteAdminUser", "admin_user_delete_api_helper_missing");
assertIncludes(adminApiSource, "saveAdminAnnouncement", "admin_announcement_save_api_helper_missing");
assertIncludes(adminApiSource, "toggleAdminAnnouncement", "admin_announcement_toggle_api_helper_missing");
assertIncludes(adminApiSource, "deleteAdminAnnouncement", "admin_announcement_delete_api_helper_missing");
assertIncludes(adminApiSource, "PORTAL_ADMIN_ACTION_FAILED_MESSAGE", "admin_action_errors_must_use_product_copy");
assertIncludes(adminApiSource, "businessMessage", "admin_action_errors_must_expose_product_message");
assertExcludes(adminApiSource, "DOMParser", "admin_action_errors_must_not_parse_backend_html");
assertExcludes(adminApiSource, "response.text()", "admin_action_errors_must_not_read_backend_html_body");

assertIncludes(adminUsersSource, "用户管理", "admin_users_page_must_use_user_management_copy");
assertIncludes(adminUsersSource, "toggleAdminUser", "admin_users_page_must_wire_toggle_action");
assertIncludes(adminUsersSource, "deleteAdminUser", "admin_users_page_must_wire_delete_action");
assertIncludes(adminUsersSource, "setRefreshVersion", "admin_users_page_must_refresh_after_mutation");
assertIncludes(adminUsersSource, "Dialog", "admin_users_actions_must_open_dialogs_for_confirmed_actions");
assertIncludes(adminUsersSource, "openDetailDialog(user)", "admin_users_detail_menu_must_open_dialog");
assertIncludes(adminUsersSource, "walletActionDisabledMessage", "admin_users_wallet_actions_must_have_disabled_boundary");
assertIncludes(adminUsersSource, "账本充值/退款等待后端账务事务能力启用", "admin_users_wallet_actions_must_not_call_unavailable_accounting_store");
assertExcludes(adminUsersSource, "rechargeAdminUser", "admin_users_page_must_not_call_recharge_until_accounting_store_enabled");
assertExcludes(adminUsersSource, "refundAdminUser", "admin_users_page_must_not_call_refund_until_accounting_store_enabled");
assertExcludes(adminUsersSource, "openRechargeDialog(user)", "admin_users_recharge_menu_must_not_open_executable_dialog");
assertExcludes(adminUsersSource, "openRefundDialog(user)", "admin_users_refund_menu_must_not_open_executable_dialog");
assertIncludes(adminUsersSource, "openToggleDialog(user)", "admin_users_toggle_menu_must_open_confirm_dialog");
assertIncludes(adminUsersSource, "openDeleteDialog(user)", "admin_users_delete_menu_must_open_confirm_dialog");
assertIncludes(adminUsersSource, "打开 ${user.name} 的用户操作菜单", "admin_users_action_menu_trigger_must_have_accessible_label");
assertExcludes(adminUsersSource, "客户账户", "admin_users_page_must_not_use_old_customer_account_copy");
for (const forbidden of [
  "<DropdownMenuItem disabled>\n                            <CheckCircle",
  "<DropdownMenuItem disabled className=\"text-red-600\">\n                            <Trash2",
]) {
  assertExcludes(adminUsersSource, forbidden, "admin_users_menu_must_not_leave_primary_actions_disabled");
}

assertIncludes(adminAlertsSource, "saveAdminAnnouncement", "admin_alerts_page_must_wire_save_announcement");
assertIncludes(adminAlertsSource, "toggleAdminAnnouncement", "admin_alerts_page_must_wire_toggle_announcement");
assertIncludes(adminAlertsSource, "deleteAdminAnnouncement", "admin_alerts_page_must_wire_delete_announcement");
assertIncludes(adminAlertsSource, "setRefreshVersion", "admin_alerts_page_must_refresh_after_mutation");
assertIncludes(adminAlertsSource, "Dialog", "admin_alerts_actions_must_open_dialogs_for_confirmed_actions");
assertIncludes(adapterSource, "alertRowKey(", "admin_alerts_pending_rows_must_use_stable_event_key");
assertIncludes(adapterSource, 'return `alert:items:${type}:${detail}:${primary}:${action}`;', "admin_alerts_pending_row_key_must_include_type_detail_primary_action");
assertExcludes(adapterSource, "alert:items:${type}:${detail}:${primary}:${index}", "admin_alerts_pending_row_key_must_not_use_list_index");
assertIncludes(adapterSource, "rowKey: alertRowKey(row)", "admin_alerts_dashboard_pending_rows_must_expose_ui_row_key");
assertIncludes(adminAlertsSource, "key={item.rowKey}", "admin_alerts_pending_table_must_use_ui_row_key");
assertExcludes(adminAlertsSource, "key={item.id}", "admin_alerts_pending_table_must_not_key_by_business_id");
assertIncludes(adminDashboardSource, "key={item.rowKey}", "admin_dashboard_pending_summary_must_use_ui_row_key");
assertExcludes(adminDashboardSource, "key={item.id}", "admin_dashboard_pending_summary_must_not_key_by_business_id");
assertIncludes(adapterSource, "adminServiceRowKey(", "admin_service_lists_must_use_stable_row_key_helper");
assertIncludes(adapterSource, 'return `admin-service:${source}:${identity}:${status}:${index}`;', "admin_service_row_key_must_include_source_identity_status_index");
assertIncludes(adminSystemSource, "key={route.rowKey}", "admin_system_key_routes_must_use_ui_row_key");
assertIncludes(adminOpsSource, "key={service.rowKey}", "admin_ops_services_must_use_ui_row_key");
assertExcludes(adminSystemSource, "key={route.name}", "admin_system_key_routes_must_not_key_by_display_name");
assertExcludes(adminOpsSource, "key={service.name}", "admin_ops_services_must_not_key_by_display_name");
const announcementListSource = sliceBetween(
  adminAlertsSource,
  '<TabsContent value="announcements"',
  '<TabsContent value="pending"',
  "admin_alerts_announcements_tab",
);
assertExcludes(announcementListSource, '<Button size="sm" className="gap-2" disabled title={adminReadOnlyMessage}>', "admin_alerts_create_must_not_be_disabled");
assertExcludes(announcementListSource, '<Button variant="ghost" size="sm" disabled title={adminReadOnlyMessage}>', "admin_alerts_edit_must_not_be_disabled");
assertExcludes(announcementListSource, '<Button variant="ghost" size="sm" className="text-red-600" disabled title={adminReadOnlyMessage}>', "admin_alerts_delete_must_not_be_disabled");
assertIncludes(adminAlertsSource, "待处理事项", "admin_alerts_pending_tab_must_remain_visible");

for (const [label, sourceText, forbidden] of [
  ["overview_runtime_detail", overviewSource, "<Button variant=\"ghost\" size=\"sm\" className=\"gap-1 text-neutral-600 hover:text-neutral-900\">\n                查看详情"],
  ["overview_tasks_all", overviewSource, "<Button variant=\"ghost\" size=\"sm\" className=\"gap-1 text-neutral-600 hover:text-neutral-900\">\n                查看全部"],
  ["overview_task_result", overviewSource, "<Button variant=\"ghost\" size=\"sm\" className=\"text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50\">\n                    查看结果"],
  ["overview_change_plan", overviewSource, "<Button variant=\"ghost\" size=\"sm\" className=\"gap-1 text-neutral-600 hover:text-neutral-900\">\n                更改套餐"],
  ["runtime_compute_increase", runtimeSource, "<Button variant=\"outline\" size=\"sm\">\n                <Plus"],
  ["runtime_compute_decrease", runtimeSource, "<Button variant=\"outline\" size=\"sm\">\n                <Minus"],
]) {
  assertExcludes(sourceText, forbidden, `${label}_must_not_be_empty_clickable_button`);
}
assertIncludes(runtimeSource, "资源调整需要后端确认流程；当前页面只展示已接入的资源状态。", "runtime_adjust_actions_must_show_product_boundary");
assertIncludes(runtimeSource, "释放计算资源需要后端确认流程；当前入口未接入。", "runtime_release_action_must_not_be_empty_clickable_button");
assertIncludes(runtimeSource, "删除存储资源需要后端确认流程；当前入口未接入。", "runtime_delete_storage_action_must_not_be_empty_clickable_button");

for (const forbidden of [
  "<Button variant=\"outline\">\n                <Upload",
  "<Button>\n              <Upload",
  "<Button variant=\"outline\">\n              <Download",
  "<Button size=\"sm\" className=\"gap-2\">\n                    <Upload",
  "<Button size=\"sm\" variant=\"outline\">\n                        <Download",
]) {
  assertExcludes(workspaceSource, forbidden, "workspace_file_action_must_not_be_empty_button");
}
assertIncludes(workspaceSource, "上传请进入 OPL 工作台", "workspace_upload_action_must_have_product_boundary_copy");
assertIncludes(workspaceSource, "结果下载请在 OPL 工作台或任务详情中完成", "workspace_download_action_must_have_product_boundary_copy");
assertIncludes(workspaceSource, "更多文件操作请在 OPL 工作台完成", "workspace_more_file_action_must_have_product_boundary_copy");
assertExcludes(workspaceSource, "<button className=\"p-1 hover:bg-neutral-100 rounded\">", "workspace_more_file_action_must_not_be_empty_raw_button");
assertIncludes(workspaceSource, "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4", "workspace_summary_layout_must_reflow_mobile");
assertIncludes(tasksSource, "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5", "tasks_summary_layout_must_reflow_mobile");
assertIncludes(billingSource, "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6", "billing_summary_layout_must_reflow_mobile");

for (const sourceText of [overviewSource, tasksSource, workspaceSource, runtimeSource, oplEntrySource, adapterSource]) {
  assertExcludes(sourceText, "Request failed with status code", "portal_user_surface_must_not_expose_transport_error");
}
assertExcludes(adapterSource, "error instanceof Error ? error.message", "portal_query_error_must_not_directly_expose_error_message");
assertIncludes(adapterSource, "PortalDisplayError", "portal_query_must_use_display_error_boundary");
assertIncludes(adapterSource, "OPL 网关暂不可用，请稍后重试；如持续失败，请联系管理员。", "opl_launch_error_must_have_product_message");
assertIncludes(adapterSource, "Portal 数据暂时不可用，请稍后重试。", "portal_data_error_must_have_product_message");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_figma_make_interaction_readiness",
  checked: [
    "cta_routes",
    "radix_forward_ref",
    "opl_launch_product_error",
    "header_account_billing_interactions",
    "admin_local_portal_actions",
    "technical_error_redaction",
  ],
}, null, 2));
