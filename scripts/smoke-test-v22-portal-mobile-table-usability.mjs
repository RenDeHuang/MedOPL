import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludesAny(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

function sliceBetween(source, start, end, label) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `${label}_start_marker_missing`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `${label}_end_marker_missing`);
  return source.slice(startIndex, endIndex);
}

function assertResponsiveTableSection(section, label) {
  assertIncludesAll(section, [
    "mobile-card-list",
    "mobile-only-card",
    "desktop-table-shell",
    "min-w-[",
  ], label);
}

const attributionTagFields = [
  "tenantId",
  "environmentId",
  "resourceOrderId",
  "serverPlanId",
];

const forbiddenSecretsAndStorage = [
  "SecretId",
  "SecretKey",
  "raw API Key",
  "rawApiKey",
  "kubeconfig",
  "objectKey",
  "storageKey",
  "cosPrefix",
  "storageBackend",
  "signedUrl",
];

const forbiddenUserCloudConsoleCopy = [
  "/admin/ops",
  "运营总览",
  "全局账号",
  "全局费用",
  "全局审计",
  "资源异常处置",
  "CVM",
  "COS",
  "K8s",
  "TKE",
  "节点池",
  "服务器编号",
  "云资源清单",
  "删除节点池",
];

const adminOpsSource = await readFile("services/portal/frontend/src/views/admin/AdminOpsView.vue", "utf8");
const billingSource = await readFile("services/portal/frontend/src/views/billing/BillingView.vue", "utf8");
const billingWorkspaceCostsSource = await readFile("services/portal/frontend/src/components/billing/BillingWorkspaceCostPanel.vue", "utf8");
const billingRunCostsSource = await readFile("services/portal/frontend/src/components/billing/BillingRunCostPanel.vue", "utf8");
const billingSurfaceSource = `${billingSource}\n${billingWorkspaceCostsSource}\n${billingRunCostsSource}`;
const styleSource = await readFile("services/portal/frontend/src/style.css", "utf8");

assertIncludesAll(styleSource, [
  ".desktop-table-shell",
  "hidden",
  "md:block",
  ".mobile-card-list",
  "md:hidden",
], "responsive_table_shared_styles");

const accountOpsSection = sliceBetween(
  adminOpsSource,
  "<h2 class=\"panel-title\">账号状态</h2>",
  "<h2 class=\"panel-title\">账单对账</h2>",
  "admin_ops_account_operations_section",
);
assertResponsiveTableSection(accountOpsSection, "admin_ops_account_operations_mobile_cards");

const workspaceOpsSection = sliceBetween(
  adminOpsSource,
  "<h2 class=\"panel-title\">工作空间状态</h2>",
  "<h2 class=\"panel-title\">当前运行</h2>",
  "admin_ops_workspace_operations_section",
);
assertResponsiveTableSection(workspaceOpsSection, "admin_ops_workspace_operations_mobile_cards");

const currentRunsSection = sliceBetween(
  adminOpsSource,
  "<h2 class=\"panel-title\">当前运行</h2>",
  "<h2 class=\"panel-title\">文件空间状态</h2>",
  "admin_ops_current_runs_section",
);
assertNotIncludesAny(currentRunsSection, attributionTagFields, "admin_ops_current_runs_attribution_tags");

assertIncludesAll(billingSource, [
  "BillingWorkspaceCostPanel",
  "BillingRunCostPanel",
], "billing_view_must_render_cost_table_components");
assertIncludesAll(billingWorkspaceCostsSource, [
  'data-component-id="billing.workspace_costs"',
  "<h2 class=\"panel-title\">工作空间成本明细</h2>",
], "billing_workspace_costs_component_contract");
assertResponsiveTableSection(billingWorkspaceCostsSource, "billing_workspace_costs_mobile_cards");
assertIncludesAll(billingRunCostsSource, [
  'data-component-id="billing.run_costs"',
  "<h2 class=\"panel-title\">任务明细</h2>",
], "billing_run_costs_component_contract");
assertResponsiveTableSection(billingRunCostsSource, "billing_run_costs_mobile_cards");

assertNotIncludesAny(adminOpsSource, forbiddenSecretsAndStorage, "admin_ops_mobile_table_secret_storage_copy");
assertNotIncludesAny(billingSurfaceSource, forbiddenSecretsAndStorage, "billing_mobile_table_secret_storage_copy");
assertNotIncludesAny(billingSurfaceSource, forbiddenUserCloudConsoleCopy, "billing_user_surface_admin_or_cloud_console_copy");

const suiteSource = await readFile("scripts/smoke-test-v22-mvp-contract-suite.mjs", "utf8");
assertIncludesAll(suiteSource, [
  "smoke-test-v22-portal-mobile-table-usability",
], "mvp_suite_mobile_table_usability");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_mobile_table_usability",
  covered: [
    "admin_ops_account_operations_mobile_cards",
    "admin_ops_workspace_operations_mobile_cards",
    "billing_workspace_costs_mobile_cards",
    "billing_run_costs_mobile_cards",
    "current_runs_no_attribution_tags",
    "user_surface_no_admin_or_cloud_console_copy",
  ],
}, null, 2));
