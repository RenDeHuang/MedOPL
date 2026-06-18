import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifestPath = "tests/fixtures/v22/agent-verify-manifest.json";
const selfFile = "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-execution-contract.mjs";

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
  sourceReadme,
  delivery,
  liveRunner,
  cloudParamsSource,
  ledgerWriterSource,
  manifest,
] = await Promise.all([
  readFile("docs/specs/README.md", "utf8"),
  readFile("specs/operations/spec.md", "utf8"),
  readFile("docs/source/README.md", "utf8"),
  readFile("docs/delivery/README.md", "utf8"),
  readFile("tests/support/cloud-prework/v22-package-c-live-canary-live-runner.js", "utf8"),
  readFile("tests/support/cloud-prework/package-c-live-canary-cloud-params.js", "utf8"),
  readFile("tests/support/cloud-prework/package-c-live-canary-ledger-writer.js", "utf8"),
  readFile(manifestPath, "utf8").then(JSON.parse),
]);
const cloudFutureAuthorizedFiles = commandFiles(manifest.suites.find((suite) => suite.id === "cloud-future-authorized")?.commands || []);

assert.equal(specsIndex.split("\n").length <= 400, true, `specs_index_line_budget_exceeded:${specsIndex.split("\n").length}`);
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_machine_json");
assertIncludesAll(specsIndex, [
  "spec:v22-authorized-tencent-create-release-execution-boundary",
  "specs/operations/spec.md",
], "authorized_tencent_execution_specs_index");

assertIncludesAll(operationsSpec, [
  "`operations:authorized-tencent-create-release-execution-boundary`",
  "tests/support/cloud-prework/v22-package-c-live-canary-live-runner.js",
  "tests/support/cloud-prework/package-c-live-canary-cloud-params.js",
  "docs/source/README.md",
  "docs/delivery/README.md",
  "node tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-execution-contract.mjs",
  "node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs",
  "default Package C live execution",
  "secret reads",
  "Tencent mutation",
  "public access",
  "production PostgreSQL writes",
], "authorized_tencent_execution_operations_spec");

assertIncludesAll(sourceReadme, [
  "resource_bindings",
  "cloud_operations",
  "Package C tenant node pool lifecycle",
  "ResourceBinding / CloudOperation status vocabulary",
  "canonical ownership / billing truth",
], "authorized_tencent_execution_source_owner");

assertIncludesAll(delivery, [
  "readonly inventory",
  "Package C live canary readiness pack with execution disabled",
  "authorized create/release canary completed",
  "Production Launch Goal / Gap Map",
  "当前 cursor 不授权 Tencent mutation",
  "Package C live",
  "public access completion claim",
], "authorized_tencent_execution_delivery_owner");

assertIncludesAll(liveRunner, [
  "FORBIDDEN_ARGS",
  "\"--deploy\"",
  "\"--kubectl\"",
  "\"--build\"",
  "\"--push\"",
  "\"--kubeconfig\"",
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "package_c_live_canary_live_run_gate_must_be_one",
  "TENCENT_MUTATION_DAILY_BUDGET_CNY",
  "TENCENT_MUTATION_MAX_OPERATION_COUNT",
  "CreateNodePool",
  "ScaleNodePool",
  "DeleteNodePool",
  "DescribeNodePools",
  "TagResources",
  "GetResources",
  "tenantNodePoolPrefix",
  "protectedPlatformNodePoolId",
  "sharedUserComputePoolAllowed: false",
  "runGateResetTo: \"0\"",
  "productionPostgresWrite: false",
], "authorized_tencent_execution_live_runner");

assertIncludesAll(`${cloudParamsSource}\n${ledgerWriterSource}`, [
  "canonicalOwnershipSource",
  "PostgreSQL resource_bindings/cloud_operations",
  "resourceBindingId",
  "billingAttributionId",
  "tenantId",
  "workspaceId",
  "medopl.io/role",
  "tenant_node_pool",
], "authorized_tencent_execution_ownership_sources");

assertNotIncludesAny(liveRunner, [
  "ModifyNodePoolDesiredCapacityAboutAsg",
  "TENCENT_MUTATION_TKE_NODE_POOL_ID",
  "shared_quota",
  "standardPlanUsesSharedPool",
  "premiumDedicatedPoolSupported",
], "authorized_tencent_execution_retired_surface");

assert(cloudFutureAuthorizedFiles.includes(selfFile), "cloud_future_authorized_suite_missing_authorized_tencent_execution_contract");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_authorized_tencent_create_release_execution_boundary",
  checked: [
    "specs_index_pointer",
    "operations_spec_owner",
    "source_owner",
    "delivery_sequence",
    "live_runner_gate",
    "ownership_sources",
  ],
}, null, 2));
