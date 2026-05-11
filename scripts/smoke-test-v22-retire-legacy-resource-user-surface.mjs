import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const resourcesViewPath = "services/portal/frontend/src/views/resources/ResourcesView.vue";
const resourcesSurfacePath = "services/portal/frontend/src/composables/useResourcesSurface.ts";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

const resourcesView = await readFile(resourcesViewPath, "utf8");
const resourcesSurface = await readFile(resourcesSurfacePath, "utf8");
const resourcesSurfaceSources = `${resourcesView}\n${resourcesSurface}`;
const suite = await readFile(suitePath, "utf8");

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
  "工作台资源",
  "基础套餐",
  "Pro 套餐",
  "2 核 / 4GB",
  "8 核 / 16GB",
  "10GB 文件空间",
  "100GB 文件空间",
  "当前套餐",
  "计算规格",
  "文件空间",
  "并发数",
  "预计费用",
  "余额状态",
  "冻结金额",
  "释放策略",
  "审计状态",
  "增加计算资源",
  "增加存储资源",
]) {
  assertIncludes(resourcesSurfaceSources, required, "ordinary_resource_surface_required_copy");
}

assertIncludes(resourcesSurfaceSources, "dry-run", "resource_adjustment_must_be_dry_run_copy");
assertIncludes(resourcesSurfaceSources, "不会真实开通", "resource_adjustment_must_not_create_real_resources");
assertIncludes(resourcesView, "生成套餐调整计划", "package_card_cta_must_be_dry_run_copy");
assertIncludes(resourcesView, "shrink-0 whitespace-nowrap", "resource_confirmation_badge_must_not_wrap_on_mobile");
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

assertIncludes(suite, "smoke-test-v22-retire-legacy-resource-user-surface", "mvp_suite_must_run_resource_surface_cleanup_smoke");

const serversView = await readFile("services/portal/frontend/src/views/servers/ServersView.vue", "utf8");
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
  assertExcludes(serversView, retiredServerDependency, "servers_view_must_not_import_retired_resource_surface_api");
}
assertIncludes(serversView, "旧服务器目录已退役", "servers_view_must_explain_retired_surface");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_retire_legacy_resource_user_surface",
  covered: [
    "legacy_resource_orchestration_copy_removed",
    "ordinary_user_product_language_required",
    "dry_run_adjustment_only",
    "no_user_freeze_manual_entry",
    "no_direct_cloud_or_resource_mutation_entry",
  ],
}, null, 2));
