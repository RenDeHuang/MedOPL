import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifestPath = "tests/fixtures/v22/agent-verify-manifest.json";
const selfFile = "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-implementation-contract.mjs";

function commandFiles(commands = []) {
  return commands
    .map((command) => String(command).match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u)?.[1] || "")
    .filter(Boolean)
    .sort();
}

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

const [
  specsIndex,
  operationsSpec,
  product,
  dryRunRunner,
  planCatalogSource,
  cloudParamsSource,
  readinessRunner,
  planCatalogArchive,
  manifest,
] = await Promise.all([
  readFile("docs/specs/README.md", "utf8"),
  readFile("specs/operations/spec.md", "utf8"),
  readFile("docs/product/README.md", "utf8"),
  readFile("tests/support/cloud-prework/v22-tencent-create-release-dry-run-plan.js", "utf8"),
  readFile("tests/support/cloud-prework/package-c-live-canary-plan-catalog-allowlist.json", "utf8"),
  readFile("tests/support/cloud-prework/package-c-live-canary-cloud-params.js", "utf8"),
  readFile("tests/support/cloud-prework/v22-package-c-live-canary-readiness.js", "utf8"),
  Promise.all([
    readFile("changes/archive/2026-06-13-package-c-plan-catalog-contract/spec-delta.md", "utf8"),
    readFile("changes/archive/2026-06-13-package-c-plan-catalog-contract/design.md", "utf8"),
    readFile("changes/archive/2026-06-13-package-c-plan-catalog-contract/closeout.md", "utf8"),
  ]).then((parts) => parts.join("\n")),
  readFile(manifestPath, "utf8").then(JSON.parse),
]);
const cloudFutureAuthorizedFiles = commandFiles(manifest.suites.find((suite) => suite.id === "cloud-future-authorized")?.commands || []);
const planCatalog = JSON.parse(planCatalogSource);

assert.equal(specsIndex.split("\n").length <= 400, true, `specs_index_line_budget_exceeded:${specsIndex.split("\n").length}`);
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_machine_json");
assertIncludesAll(specsIndex, [
  "spec:v22-authorized-tencent-create-release-implementation-boundary",
  "specs/operations/spec.md",
], "authorized_tencent_implementation_specs_index");

assertIncludesAll(operationsSpec, [
  "`operations:authorized-tencent-create-release-implementation-boundary`",
  "docs/product/README.md",
  "tests/support/cloud-prework/v22-tencent-create-release-dry-run-plan.js",
  "tests/support/cloud-prework/package-c-live-canary-plan-catalog-allowlist.json",
  "tests/support/cloud-prework/package-c-live-canary-cloud-params.js",
  "node tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-implementation-contract.mjs",
  "node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-readiness-local-gate.mjs",
  "prepare-only proof",
  "user-selected arbitrary Tencent instance types",
], "authorized_tencent_implementation_operations_spec");

assertIncludesAll(product, [
  "用户可以升级配置，但只能选择 MedOPL plan catalog allowlist 里的规格",
  "释放托管运行环境不等于删除文件空间",
  "删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期",
  "余额或冻结金额不足时，停止新托管任务和计算资源续用",
  "120min",
  "T+1",
  "api_only",
  "full_runtime",
  "customer_dedicated",
], "authorized_tencent_implementation_product_owner");

assert.deepEqual(planCatalog.plans.map((plan) => ({
  id: plan.id,
  cpuCores: plan.compute.cpuCores,
  memoryGb: plan.compute.memoryGb,
  workspaceStorageGb: plan.workspaceStorageGb,
  maxConcurrentTasks: plan.compute.maxConcurrentTasks,
  nodeInstanceType: plan.tke.nodeInstanceType,
  nodeSystemDiskGb: plan.tke.systemDisk.sizeGb,
  publicIpEnabled: plan.tke.publicIp.enabled,
})), [
  {
    id: "starter_2c4g_10gb",
    cpuCores: 2,
    memoryGb: 4,
    workspaceStorageGb: 10,
    maxConcurrentTasks: 1,
    nodeInstanceType: "SA5.MEDIUM4",
    nodeSystemDiskGb: 50,
    publicIpEnabled: false,
  },
  {
    id: "pro_8c16g_100gb",
    cpuCores: 8,
    memoryGb: 16,
    workspaceStorageGb: 100,
    maxConcurrentTasks: 2,
    nodeInstanceType: "SA5.2XLARGE16",
    nodeSystemDiskGb: 50,
    publicIpEnabled: false,
  },
], "authorized_tencent_implementation_plan_catalog_shapes");
assert.equal(planCatalog.upgradePolicy.requiresPlanCatalogAllowlist, true, "upgrade_requires_plan_catalog");
assert.equal(planCatalog.upgradePolicy.arbitraryInstanceTypeAllowed, false, "upgrade_rejects_arbitrary_instance_type");
assert.equal(planCatalog.workspaceStorageIsNodeSystemDisk, false, "workspace_storage_is_not_node_system_disk");

assertIncludesAll(`${cloudParamsSource}\n${readinessRunner}`, [
  "planFor",
  "validateCatalogShape",
  "package_c_live_canary_readiness_plan_not_allowlisted",
  "package_c_live_canary_readiness_plan_mismatch",
  "package_c_live_canary_readiness_cloud_param_not_allowed",
  "package_c_live_canary_readiness_public_ip_must_be_disabled",
  "package_c_live_canary_readiness_secret_key_not_allowed",
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "confirm-no-real-cloud",
  "realCloudCalls: false",
  "mutationExecuted: false",
], "authorized_tencent_implementation_readiness_sources");

assertIncludesAll(dryRunRunner, [
  "fileSpaceGb: options.serverPlanId === \"pro\" ? 100 : 10",
  "computeReleaseDeletesFileSpace: false",
  "deleteProtectionDays: 7",
  "chargeApplied: false",
  "freezeOnly: true",
  "reconciliation: \"t_plus_1\"",
  "stopBillingConfirmWithinMinutes: 120",
  "ordinary_user_language_only",
], "authorized_tencent_implementation_dry_run_policy");

assertIncludesAll(planCatalogArchive, [
  "Starter as 2C4G compute, 10GB workspace storage and one task concurrency",
  "Pro current plan is 8C16G + 100GB workspace storage and two task concurrency",
  "User upgrades must enter MedOPL plan catalog allowlist",
  "Arbitrary `instanceType` and `nodeInstanceType` input is not accepted",
  "Workspace storage must not be interpreted as TKE node system disk",
], "authorized_tencent_implementation_archive_owner");

assertNotIncludesAny(`${dryRunRunner}\n${cloudParamsSource}\n${planCatalogSource}`, [
  "用户自配云资源作为主线",
  "TENCENT_MUTATION_TKE_NODE_POOL_ID",
  "defaultHardStopEnabled",
  "computeReleaseDeletesFileSpace: true",
  "maxConcurrentSessions",
  "standardPlanUsesSharedPool",
  "premiumDedicatedPoolSupported",
  "workspaceStorageIsNodeSystemDisk\": true",
], "authorized_tencent_implementation_forbidden_surface");

assert(cloudFutureAuthorizedFiles.includes(selfFile), "cloud_future_authorized_suite_missing_authorized_tencent_implementation_contract");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_authorized_tencent_create_release_implementation_boundary",
  checked: [
    "specs_index_pointer",
    "operations_spec_owner",
    "product_owner",
    "plan_catalog_shapes",
    "readiness_sources",
    "dry_run_policy",
    "archive_provenance",
  ],
}, null, 2));
