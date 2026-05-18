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
  adminAuditSource,
  dialogSource,
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
  source(`${appRoot}/pages/admin/AdminAudit.tsx`),
  source(`${appRoot}/components/ui/dialog.tsx`),
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

assertIncludes(layoutSource, "flex-col md:flex-row", "layout_shell_must_reflow_mobile");
assertIncludes(layoutSource, "w-full md:w-64", "layout_sidebar_must_not_force_mobile_width");
assertIncludes(layoutSource, "overflow-x-auto", "layout_navigation_must_scroll_on_mobile");
assertIncludes(layoutSource, "帮助中心暂未接入", "layout_help_button_must_not_be_empty_action");
assertIncludes(adminAuditSource, "overflow-x-auto", "admin_audit_table_must_be_scrollable_instead_of_layout_overflow");

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
    "technical_error_redaction",
  ],
}, null, 2));
