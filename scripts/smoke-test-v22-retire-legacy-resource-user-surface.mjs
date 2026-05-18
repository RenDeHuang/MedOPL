import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isSmokeClassifiedIn } from "./v22-smoke-classification.mjs";

const resourcesViewPath = "services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx";
const resourcesSurfacePath = "services/portal/frontend/src/app/data/portalAdapters.ts";

const resourcesView = await readFile(resourcesViewPath, "utf8");
const resourcesSurface = await readFile(resourcesSurfacePath, "utf8");
const layoutSource = await readFile("services/portal/frontend/src/app/components/Layout.tsx", "utf8");
const routesSource = await readFile("services/portal/frontend/src/app/routes.tsx", "utf8");
const resourcesSurfaceSources = `${resourcesView}\n${resourcesSurface}\n${layoutSource}\n${routesSource}`;

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

const forbiddenVisibleCopy = [
  "设置本周冻结金额",
  "填入本周冻结金额",
  "云资源清单",
  "服务器编号",
  "节点池",
  "删除节点池",
  "开通文件空间",
  "进阶升级",
  "进阶套餐",
  "开通工作台资源",
];

for (const copy of forbiddenVisibleCopy) {
  assertExcludes(resourcesSurfaceSources, copy, "ordinary_resource_surface_legacy_copy");
}

for (const copy of ["CVM", "COS", "K8s", "TKE"]) {
  assertExcludes(resourcesSurfaceSources, `>${copy}<`, "ordinary_resource_surface_cloud_console_copy");
  assertExcludes(resourcesSurfaceSources, `${copy}：`, "ordinary_resource_surface_cloud_console_copy");
}

for (const required of [
  "基础版",
  "标准版",
  "文件空间",
  "并发任务",
  "价格待审批",
  "正式售价未定价",
  "不展示小时售价",
  "当前页面仅展示状态，不提供资源调整动作。",
  "审计模式",
]) {
  assertIncludes(resourcesSurfaceSources, required, "ordinary_resource_surface_required_copy");
}

assertIncludes(resourcesSurfaceSources, "loadRuntimeEnvironmentModel", "resource_surface_must_use_portal_adapter_loader");
assertIncludes(resourcesSurfaceSources, "fetchMyResources", "resource_adapter_must_call_platform_provisioned_resources_api");
assertIncludes(resourcesSurfaceSources, "starter_2c4g_10gb", "resource_surface_must_use_starter_package_id");
assertIncludes(resourcesSurfaceSources, "pro_8c16g_100gb", "resource_surface_must_use_pro_package_id");
assertExcludes(resourcesSurfaceSources, "@submit.prevent=\"submitEnsureProtectionFreeze\"", "ordinary_resource_surface_must_not_offer_freeze_form");
assertExcludes(resourcesSurfaceSources, "@submit.prevent=\"submitCreateCompute\"", "ordinary_resource_surface_must_not_offer_direct_compute_create");
assertExcludes(resourcesSurfaceSources, "@submit.prevent=\"submitCreateStorage\"", "ordinary_resource_surface_must_not_offer_direct_storage_create");
assertExcludes(resourcesSurfaceSources, "@submit.prevent=\"submitBindWorkspace\"", "ordinary_resource_surface_must_not_offer_duplicate_environment_open");
assertExcludes(resourcesSurfaceSources, "ensureProtectionFreeze(", "ordinary_resource_surface_must_not_call_freeze_mutation");
assertExcludes(resourcesSurfaceSources, "createComputeInstance(", "ordinary_resource_surface_must_not_call_compute_mutation");
assertExcludes(resourcesSurfaceSources, "createStorageBucket(", "ordinary_resource_surface_must_not_call_storage_mutation");
assertExcludes(resourcesSurfaceSources, "deleteComputeInstance(", "ordinary_resource_surface_must_not_call_compute_delete");
assertExcludes(resourcesSurfaceSources, "deleteStorageBucket(", "ordinary_resource_surface_must_not_call_storage_delete");
assertExcludes(resourcesSurfaceSources, "unbindWorkspaceResource(", "ordinary_resource_surface_must_not_call_unbind_mutation");

assert.equal(
  isSmokeClassifiedIn("scripts/smoke-test-v22-retire-legacy-resource-user-surface.mjs"),
  true,
  "mvp_suite_must_run_resource_surface_cleanup_smoke",
);

for (const retiredServerDependency of [
  "fetchCloudResources",
  "fetchResourceOrders",
  "deleteResourceOrderNodePool",
  "quoteResourceOrder",
  "freezeResourceOrder",
  "provisionResourceOrder",
  "releaseResourceOrder",
  "CloudResourcesPayload",
  "ResourceOrdersPayload",
]) {
  assertExcludes(resourcesSurfaceSources, retiredServerDependency, "resource_surface_must_not_import_retired_resource_surface_api");
}
assertExcludes(routesSource, "/advanced/servers", "servers_route_must_be_physically_retired");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_retire_legacy_resource_user_surface",
  covered: [
    "legacy_resource_orchestration_copy_removed",
    "ordinary_user_product_language_required",
    "approved_plan_activation_only",
    "no_hardcoded_hourly_price",
    "no_user_freeze_manual_entry",
    "no_direct_cloud_or_resource_mutation_entry",
  ],
}, null, 2));
