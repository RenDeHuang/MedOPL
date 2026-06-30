import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { smokeEvalMetadataOf } from "../../../scripts/v22-test-classification.mjs";

const smokeScriptPath = "tests/regression/portal/regression-test-v22-admin-ops-console-boundary.mjs";

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, unexpected, label) {
  assert.equal(source.includes(unexpected), false, `${label}_must_not_include:${unexpected}`);
}

const [
  specsIndex,
  operationsSpec,
  adminOpsModel,
  adminOpsPage,
  portalAdminApi,
  goRouter,
  goProjectionAdmin,
  suite,
] = await Promise.all([
  readFile("docs/specs/README.md", "utf8"),
  readFile("specs/operations/spec.md", "utf8"),
  readFile("services/portal/frontend/src/app/data/portalAdminOpsModel.ts", "utf8"),
  readFile("services/portal/frontend/src/app/pages/admin/AdminOps.tsx", "utf8"),
  readFile("services/portal/frontend/src/api/portal/admin.ts", "utf8"),
  readFile("services/medopl-go-backend/internal/server/router.go", "utf8"),
  readFile("services/medopl-go-backend/internal/server/handlers/portal_projection_admin.go", "utf8"),
  readFile("tests/suites/suite-test-v22-local-acceptance.mjs", "utf8"),
]);

assertIncludes(specsIndex, "spec:v22-admin-ops-console-boundary", "specs_index_admin_ops_anchor");
assertIncludes(specsIndex, "specs/operations/spec.md", "specs_index_admin_ops_owner");
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_admin_ops_json");

assertIncludes(operationsSpec, "`operations:admin-ops-console-boundary`", "operations_spec_admin_ops_requirement");
assertIncludes(operationsSpec, "services/portal/frontend/src/app/pages/admin/AdminOps.tsx", "operations_spec_admin_ops_page_owner");
assertIncludes(operationsSpec, "services/portal/frontend/src/app/data/portalAdminOpsModel.ts", "operations_spec_admin_ops_model_owner");
assertIncludes(operationsSpec, "real cloud console operations", "operations_spec_admin_ops_cannot_claim_real_cloud_console");
assertIncludes(operationsSpec, "secret reads", "operations_spec_admin_ops_cannot_claim_secret_reads");

assertIncludes(goRouter, 'router.GET("/api/admin/ops", handlers.AdminOps())', "go_router_admin_ops_route");
assertIncludes(goProjectionAdmin, "func AdminOps() gin.HandlerFunc", "go_projection_admin_ops_handler");
assertIncludes(goProjectionAdmin, '"opsSurfaceEnabled": true', "go_projection_admin_ops_local_projection");

assertIncludes(portalAdminApi, 'goControlPlaneClient.get("/admin/ops")', "portal_admin_api_admin_ops_endpoint");
assertIncludes(portalAdminApi, "ops_surface_disabled", "portal_admin_api_disabled_state");
assertIncludes(portalAdminApi, "opsSurfaceEnabled: false", "portal_admin_api_disabled_projection");

assertIncludes(adminOpsModel, "export const adminReadOnlyMessage", "admin_ops_model_readonly_message");
assertIncludes(adminOpsModel, "真实云资源操作未授权", "admin_ops_model_real_cloud_disabled");
assertIncludes(adminOpsModel, "真实扣费未授权", "admin_ops_model_real_billing_disabled");
assertIncludes(adminOpsModel, "真实资源释放未授权", "admin_ops_model_real_release_disabled");
assertIncludes(adminOpsModel, "disabled", "admin_ops_model_disabled_status");
assertIncludes(adminOpsModel, "future-authorized", "admin_ops_model_future_authorized_status");
assertIncludes(adminOpsModel, "resourceBindingId", "admin_ops_model_cost_allocation_resource_binding");
assertIncludes(adminOpsModel, "billingAttributionId", "admin_ops_model_cost_allocation_billing_attribution");
assertIncludes(adminOpsModel, "accountId", "admin_ops_model_cost_allocation_account");
assertIncludes(adminOpsModel, "workspaceId", "admin_ops_model_cost_allocation_workspace");
assertIncludes(adminOpsModel, "environmentId", "admin_ops_model_cost_allocation_environment");

assertIncludes(adminOpsPage, "平台托管运维入口未启用", "admin_ops_page_disabled_copy");
assertNotIncludes(adminOpsPage, "ops_surface_disabled", "admin_ops_page_must_not_render_disabled_error_code");
assertIncludes(adminOpsPage, "本地运维投影", "admin_ops_page_local_projection_copy");
assertIncludes(adminOpsPage, "待授权操作边界", "admin_ops_page_future_authorized_copy");
assertNotIncludes(adminOpsPage, "future-authorized", "admin_ops_page_must_not_render_future_authorized_code");
assertIncludes(adminOpsPage, "此页面仅展示服务层状态摘要,不提供云资源直接操作能力。", "admin_ops_page_no_direct_cloud_operation_copy");

for (const forbidden of [
  "SecretId",
  "SecretKey",
  "kubeconfig",
  "raw API Key",
  "launchToken",
  "runtimeToken",
  "直接删除节点池",
  "直接释放云资源",
]) {
  assertNotIncludes(adminOpsPage, forbidden, "admin_ops_page_secret_or_console_language");
}

assertIncludes(suite, "listSmokeEvalScripts", "local_acceptance_suite_must_use_eval_tier_selector");
assertIncludes(suite, "localAcceptanceTiers", "local_acceptance_suite_must_name_local_tier_scope");
assert.equal(smokeEvalMetadataOf(smokeScriptPath).tier, "local-regression", "admin_ops_boundary_must_be_local_regression");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_admin_ops_console_boundary",
  checked: [
    "operations_spec_owner",
    "admin_ops_route_and_handler",
    "disabled_product_state",
    "future_authorized_actions",
    "no_secret_or_direct_cloud_console_copy",
    "local_regression_registry",
  ],
}, null, 2));
