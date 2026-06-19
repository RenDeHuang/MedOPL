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
  manifest,
  readonlyRunner,
  officialSdkSupport,
  readonlySpecDelta,
  readonlyEvalPlan,
] = await Promise.all([
  readFile("docs/specs/README.md", "utf8"),
  readFile("specs/operations/spec.md", "utf8"),
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile("tests/support/cloud-prework/tencent-readonly-inventory-support.js", "utf8"),
  readFile("tests/support/cloud-prework/lib/tencent-readonly-inventory-official-sdk-support.js", "utf8"),
  readFile("changes/archive/2026-06-10-tencent-readonly-inventory-live-runner/spec-delta.md", "utf8"),
  readFile("changes/archive/2026-06-10-tencent-readonly-inventory-live-runner/eval-plan.md", "utf8"),
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

assertIncludesAll(`${readonlySpecDelta}\n${readonlyEvalPlan}`, [
  "official SDK",
  "readonly",
  "COS metadata",
  "readsCosObjectBody=false",
  "callsMutationApi=false",
  "tests/support/cloud-prework/tencent-readonly-inventory-support.js",
], "readonly_inventory_archive_boundary");

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
