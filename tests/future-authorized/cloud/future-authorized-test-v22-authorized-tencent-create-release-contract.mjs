import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifestPath = "tests/fixtures/v22/agent-verify-manifest.json";
const selfFile = "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-contract.mjs";

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
  dryRunArchive,
  planCatalogArchive,
  manifest,
] = await Promise.all([
  readFile("docs/specs/README.md", "utf8"),
  readFile("specs/operations/spec.md", "utf8"),
  readFile("docs/product/README.md", "utf8"),
  readFile("tests/support/cloud-prework/v22-tencent-create-release-dry-run-plan.js", "utf8"),
  readFile("tests/support/cloud-prework/package-c-live-canary-plan-catalog-allowlist.json", "utf8"),
  Promise.all([
    readFile("changes/archive/2026-06-10-package-c-dry-run-create-release-plan/spec-delta.md", "utf8"),
    readFile("changes/archive/2026-06-10-package-c-dry-run-create-release-plan/design.md", "utf8"),
    readFile("changes/archive/2026-06-10-package-c-dry-run-create-release-plan/closeout.md", "utf8"),
  ]).then((parts) => parts.join("\n")),
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
  "spec:v22-authorized-tencent-create-release-boundary",
  "specs/operations/spec.md",
], "authorized_tencent_create_release_specs_index");

assertIncludesAll(operationsSpec, [
  "`operations:authorized-tencent-create-release-boundary`",
  "tests/support/cloud-prework/v22-tencent-create-release-dry-run-plan.js",
  "tests/support/cloud-prework/package-c-live-canary-plan-catalog-allowlist.json",
  "changes/archive/2026-06-10-package-c-dry-run-create-release-plan",
  "changes/archive/2026-06-13-package-c-plan-catalog-contract",
  "node tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-contract.mjs",
  "node tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs",
  "Real Tencent Cloud resource mutation",
  "mutation secret reads",
  "Portal ledger writes",
  "arbitrary cloud SKU input",
], "authorized_tencent_create_release_operations_spec");

assertIncludesAll(product, [
  "platform-provisioned / customer-dedicated",
  "计算资源和文件空间不是默认强制能力",
  "基础套餐 | 2c / 4GB | 10GB 文件空间 | 1 个任务并发",
  "Pro 套餐 | 8c / 16GB | 100GB 文件空间 | 2 个任务并发",
  "释放计算资源不删除文件空间",
  "删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期",
  "120min",
  "T+1",
  "plan catalog allowlist",
], "authorized_tencent_create_release_product_owner");

assertIncludesAll(dryRunRunner, [
  "FOUNDATION_ENV_KEYS",
  "FORBIDDEN_FOUNDATION_ENV_KEYS",
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "workspace_file_space",
  "workspace_compute_allocation",
  "unified_tke_cluster_with_tenant_node_pools",
  "tenant_workspace_dedicated",
  "createdByPackageC: true",
  "releasedByPackageC: true",
  "bindsResourceBindingId",
  "deleteProtectionDays: 7",
  "computeReleaseDeletesFileSpace: false",
  "reconciliation: \"t_plus_1\"",
  "stopBillingConfirmWithinMinutes: 120",
  "realCloudCalls: false",
  "mutationExecuted: false",
  "readsMutationSecret: false",
  "writesLedger: false",
  "callsKubectl: false",
  "buildsOrPushesImage: false",
], "authorized_tencent_create_release_dry_run_runner");

assertIncludesAll(`${dryRunArchive}\n${planCatalogArchive}`, [
  "Package C dry-run create/release plan",
  "workspace file space",
  "workspace compute allocation",
  "freeze-only billing",
  "plan catalog allowlist",
  "Arbitrary `instanceType` and `nodeInstanceType` input is not accepted",
  "Real Tencent mutation",
], "authorized_tencent_create_release_archive");

assert.equal(planCatalog.contract, "v22_package_c_live_canary_plan_catalog_allowlist", "plan_catalog_contract");
assert.equal(planCatalog.upgradePolicy.requiresPlanCatalogAllowlist, true, "plan_catalog_requires_allowlist");
assert.equal(planCatalog.upgradePolicy.arbitraryInstanceTypeAllowed, false, "plan_catalog_rejects_arbitrary_instance_type");
assert.equal(planCatalog.workspaceStorageIsNodeSystemDisk, false, "workspace_storage_is_not_node_disk");
assert.deepEqual(planCatalog.plans.map((plan) => [plan.id, plan.compute.cpuCores, plan.compute.memoryGb, plan.workspaceStorageGb, plan.compute.maxConcurrentTasks]), [
  ["starter_2c4g_10gb", 2, 4, 10, 1],
  ["pro_8c16g_100gb", 8, 16, 100, 2],
], "plan_catalog_current_shapes");

assertNotIncludesAny(`${dryRunRunner}\n${planCatalogSource}`, [
  "legacyResourceOrderId",
  "TENCENT_MUTATION_TKE_NODE_POOL_ID",
  "standardPlanUsesSharedPool",
  "premiumDedicatedPoolSupported",
  "shared_quota",
], "authorized_tencent_create_release_retired_surface");

assert(cloudFutureAuthorizedFiles.includes(selfFile), "cloud_future_authorized_suite_missing_authorized_tencent_create_release_contract");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_authorized_tencent_create_release_boundary",
  checked: [
    "specs_index_pointer",
    "operations_spec_owner",
    "product_owner",
    "dry_run_runner",
    "plan_catalog_allowlist",
    "archive_provenance",
  ],
}, null, 2));
