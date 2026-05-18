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
  adapterSource,
] = await Promise.all([
  source(`${appRoot}/components/ui/button.tsx`),
  source(`${appRoot}/components/ui/sheet.tsx`),
  source(`${appRoot}/pages/Overview.tsx`),
  source(`${appRoot}/pages/TasksResults.tsx`),
  source(`${appRoot}/pages/Workspace.tsx`),
  source(`${appRoot}/pages/RuntimeEnvironment.tsx`),
  source(`${appRoot}/pages/OPLEntry.tsx`),
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
    "technical_error_redaction",
  ],
}, null, 2));
