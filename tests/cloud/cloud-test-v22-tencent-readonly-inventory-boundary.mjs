import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifestPath = "tests/fixtures/v22/agent-verify-manifest.json";
const selfFile = "tests/cloud/cloud-test-v22-tencent-readonly-inventory-boundary.mjs";

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
  cloudContract,
  manifest,
  readonlyRunner,
  officialSdkSupport,
] = await Promise.all([
  readFile("docs/specs/README.md", "utf8"),
  readFile("specs/operations/spec.md", "utf8"),
  readFile("contracts/medopl-cloud-boundary.json", "utf8").then(JSON.parse),
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile("tests/support/cloud-prework/tencent-readonly-inventory-support.js", "utf8"),
  readFile("tests/support/cloud-prework/lib/tencent-readonly-inventory-official-sdk-support.js", "utf8"),
]);
const realCloudReadinessFiles = commandFiles(manifest.suites.find((entry) => entry.id === "real-cloud-readiness")?.commands || []);

assert.equal(specsIndex.split("\n").length <= 400, true, `specs_index_line_budget_exceeded:${specsIndex.split("\n").length}`);
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_machine_json");
assertIncludesAll(specsIndex, [
  "spec:v22-tencent-readonly-inventory-boundary",
  "specs/operations/spec.md",
], "readonly_inventory_specs_index");

assertIncludesAll(operationsSpec, [
  "`operations:tencent-readonly-inventory-boundary`",
  "tests/support/cloud-prework/tencent-readonly-inventory-support.js",
  "tests/support/cloud-prework/lib/tencent-readonly-inventory-official-sdk-support.js",
  "COS object body reads",
  "raw provider response output",
], "readonly_inventory_operations_spec");

assertIncludesAll(readonlyRunner, [
  "ALLOWED_SECRET_KEYS",
  "FORBIDDEN_SECRET_KEYS",
  "RUN_TENCENT_READONLY_INVENTORY",
  "TENCENT_READONLY_SECRET_ID",
  "TENCENT_READONLY_SECRET_KEY",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "FORBIDDEN_API_PREFIXES",
  "Create",
  "Delete",
  "Modify",
  "Run",
  "Terminate",
  "Attach",
  "Detach",
  "Put",
  "Update",
  "redactedReport",
  "readsCosObjectBody: false",
  "callsMutationApi: false",
], "readonly_inventory_runner_boundary");

assertIncludesAll(officialSdkSupport, [
  "describeAccount",
  "describeTkeClusters",
  "describeTkeNodePools",
  "describeTkeNativeNodePools",
  "describeBillingSummary",
  "describeTagResources",
  "describeCosBuckets",
  "describeCosMetadata",
  "headObject",
], "readonly_inventory_official_sdk_boundary");

assert.equal(
  cloudContract.authority_boundary.default_real_cloud_execution,
  "allowed_when_authorization_pack_is_active",
  "cloud_contract_must_use_machine_authorization_pack",
);
assert.equal(
  cloudContract.authority_boundary.authorization_pack,
  "contracts/medopl-cloud-authorization-pack.json",
  "cloud_contract_must_reference_authorization_pack",
);
assertIncludesAll(JSON.stringify(cloudContract.medopl_cloud_boundary), [
  "provider_account",
  "object_storage",
  "secret_binding",
  "audit_sink",
  "raw_provider_console",
  "kubeconfig_content",
  "provider_secret_key",
], "readonly_inventory_cloud_contract_boundary");

assertNotIncludesAny(`${readonlyRunner}\n${officialSdkSupport}`, [
  "readFileSync(",
  "CreateCluster",
  "DeleteCluster",
  "ModifyCluster",
  "RunInstances",
  "TerminateInstances",
  "putObject",
  "deleteObject",
], "readonly_inventory_forbidden_runtime_surface");

assert(realCloudReadinessFiles.includes(selfFile), "real_cloud_readiness_suite_must_include_readonly_inventory_contract");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_boundary",
  checked: {
    registrySuite: "real-cloud-readiness",
    owner: "specs/operations/spec.md",
  },
}, null, 2));
