import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

const workspaceSource = await readFile("services/portal/frontend/src/app/pages/Workspace.tsx", "utf8");
const tasksSource = await readFile("services/portal/frontend/src/app/pages/TasksResults.tsx", "utf8");
const billingSource = await readFile("services/portal/frontend/src/app/pages/BillingAudit.tsx", "utf8");
const layoutSource = await readFile("services/portal/frontend/src/app/components/Layout.tsx", "utf8");

for (const [label, source] of [
  ["workspace", workspaceSource],
  ["tasks", tasksSource],
  ["billing", billingSource],
]) {
  assert(
    source.includes("Table") || source.includes("Tabs") || source.includes("filtered"),
    `${label}_must_keep_structured_table_or_list_surface`,
  );
  assertIncludes(source, "grid", `${label}_must_keep_responsive_summary_grid`);
  assertIncludes(source, "max-w-7xl", `${label}_must_bound_content_width`);
  assertExcludes(source, "tenantId", `${label}_must_not_show_attribution_tag_tenant_id`);
  assertExcludes(source, "environmentId", `${label}_must_not_show_attribution_tag_environment_id`);
  assertExcludes(source, "objectKey", `${label}_must_not_show_storage_object_key`);
  assertExcludes(source, "storageKey", `${label}_must_not_show_storage_key`);
  assertExcludes(source, "signedUrl", `${label}_must_not_show_signed_url`);
}

for (const forbiddenCopy of [
  "/admin/ops",
  "运营总览",
  "全局账号",
  "全局费用",
  "全局审计",
  "CVM",
  "COS",
  "K8s",
  "TKE",
  "节点池",
  "云资源清单",
]) {
  assertExcludes(workspaceSource, forbiddenCopy, `workspace_forbidden_admin_or_cloud_copy:${forbiddenCopy}`);
  assertExcludes(tasksSource, forbiddenCopy, `tasks_forbidden_admin_or_cloud_copy:${forbiddenCopy}`);
  assertExcludes(billingSource, forbiddenCopy, `billing_forbidden_admin_or_cloud_copy:${forbiddenCopy}`);
}

assertIncludes(layoutSource, "hidden sm:inline", "layout_must_have_small_viewport_text_collapse");
assertIncludes(layoutSource, "overflow-auto", "layout_must_keep_scroll_boundary");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_mobile_table_usability",
  currentTruth: "figma_make_zip_react_user_surface",
  retiredVueAdminOpsTableSurface: true,
}, null, 2));
