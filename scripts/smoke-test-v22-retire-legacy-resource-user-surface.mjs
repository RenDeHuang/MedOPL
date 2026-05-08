import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const resourcesViewPath = "services/portal/frontend/src/views/resources/ResourcesView.vue";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

const resourcesView = await readFile(resourcesViewPath, "utf8");
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
];

for (const copy of forbiddenVisibleCopy) {
  assertExcludes(resourcesView, copy, "ordinary_resource_surface_legacy_copy");
}

for (const copy of ["CVM", "COS", "K8s", "TKE"]) {
  assertExcludes(resourcesView, `>${copy}<`, "ordinary_resource_surface_cloud_console_copy");
  assertExcludes(resourcesView, `${copy}：`, "ordinary_resource_surface_cloud_console_copy");
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
  "余额/冻结金额状态",
  "释放策略",
  "审计状态",
  "增加计算资源",
  "增加存储资源",
]) {
  assertIncludes(resourcesView, required, "ordinary_resource_surface_required_copy");
}

assertIncludes(resourcesView, "dry-run", "resource_adjustment_must_be_dry_run_copy");
assertIncludes(resourcesView, "不会真实开通", "resource_adjustment_must_not_create_real_resources");
assertExcludes(resourcesView, "@submit.prevent=\"submitEnsureProtectionFreeze\"", "ordinary_resource_surface_must_not_offer_freeze_form");
assertExcludes(resourcesView, "@submit.prevent=\"submitCreateCompute\"", "ordinary_resource_surface_must_not_offer_direct_compute_create");
assertExcludes(resourcesView, "@submit.prevent=\"submitCreateStorage\"", "ordinary_resource_surface_must_not_offer_direct_storage_create");
assertExcludes(resourcesView, "@submit.prevent=\"submitBindWorkspace\"", "ordinary_resource_surface_must_not_offer_duplicate_environment_open");
assertExcludes(resourcesView, "ensureProtectionFreeze(", "ordinary_resource_surface_must_not_call_freeze_mutation");
assertExcludes(resourcesView, "createComputeInstance(", "ordinary_resource_surface_must_not_call_compute_mutation");
assertExcludes(resourcesView, "createStorageBucket(", "ordinary_resource_surface_must_not_call_storage_mutation");
assertExcludes(resourcesView, "deleteComputeInstance(", "ordinary_resource_surface_must_not_call_compute_delete");
assertExcludes(resourcesView, "deleteStorageBucket(", "ordinary_resource_surface_must_not_call_storage_delete");
assertExcludes(resourcesView, "unbindWorkspaceResource(", "ordinary_resource_surface_must_not_call_unbind_mutation");

assertIncludes(suite, "smoke-test-v22-retire-legacy-resource-user-surface", "mvp_suite_must_run_resource_surface_cleanup_smoke");

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
