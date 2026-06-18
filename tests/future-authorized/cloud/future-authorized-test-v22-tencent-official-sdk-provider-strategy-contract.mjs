import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifestPath = "tests/fixtures/v22/agent-verify-manifest.json";
const selfFile = "tests/future-authorized/cloud/future-authorized-test-v22-tencent-official-sdk-provider-strategy-contract.mjs";

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
  readonlySpecDelta,
  readonlyDesign,
  readonlyCloseout,
  tc3SpecDelta,
  tc3Closeout,
  officialSdkSupport,
] = await Promise.all([
  readFile("docs/specs/README.md", "utf8"),
  readFile("specs/operations/spec.md", "utf8"),
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile("changes/archive/2026-06-10-tencent-readonly-inventory-live-runner/spec-delta.md", "utf8"),
  readFile("changes/archive/2026-06-10-tencent-readonly-inventory-live-runner/design.md", "utf8"),
  readFile("changes/archive/2026-06-10-tencent-readonly-inventory-live-runner/closeout.md", "utf8"),
  readFile("changes/archive/2026-06-10-tc3-readonly-diagnostic-retirement/spec-delta.md", "utf8"),
  readFile("changes/archive/2026-06-10-tc3-readonly-diagnostic-retirement/closeout.md", "utf8"),
  readFile("tests/support/cloud-prework/lib/tencent-readonly-inventory-official-sdk-support.js", "utf8"),
]);
const realCloudReadinessFiles = commandFiles(manifest.suites.find((suite) => suite.id === "real-cloud-readiness")?.commands || []);

assert.equal(specsIndex.split("\n").length <= 400, true, `specs_index_line_budget_exceeded:${specsIndex.split("\n").length}`);
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_machine_json");
assertIncludesAll(specsIndex, [
  "spec:v22-tencent-readonly-inventory-boundary",
  "spec:v22-tencent-tc3-diagnostic-cleanup-plan",
  "specs/operations/spec.md",
], "official_sdk_strategy_specs_index");

assertIncludesAll(operationsSpec, [
  "`operations:tencent-readonly-inventory-boundary`",
  "`operations:tencent-tc3-diagnostic-cleanup-plan`",
  "tests/support/cloud-prework/lib/tencent-readonly-inventory-official-sdk-support.js",
  "node tests/future-authorized/cloud/future-authorized-test-v22-tencent-official-sdk-provider-strategy-contract.mjs",
], "official_sdk_strategy_operations_spec");

assertIncludesAll(`${readonlySpecDelta}\n${readonlyDesign}\n${readonlyCloseout}`, [
  "official SDK",
  "--enable-official-sdk-loader",
  "tencent-official-sdk-readonly",
  "account",
  "TKE",
  "billing",
  "tag",
  "COS metadata",
  "readsCosObjectBody=false",
  "callsMutationApi=false",
], "official_sdk_strategy_archive");

assertIncludesAll(`${tc3SpecDelta}\n${tc3Closeout}`, [
  "TC3",
  "diagnostic",
  "production/default readonly path",
  "Tencent official SDK wrapper remains the future authorized provider candidate",
], "official_sdk_tc3_retirement_archive");

assertIncludesAll(officialSdkSupport, [
  "createTencentReadonlyInventoryOfficialSdkModules",
  "runTencentReadonlyInventoryOfficialSdk",
  "describeAccount",
  "describeTkeClusters",
  "describeTkeNodePools",
  "describeTkeNativeNodePools",
  "describeBillingSummary",
  "describeTagResources",
  "describeCosBuckets",
  "describeCosMetadata",
], "official_sdk_strategy_source_interface");

assertNotIncludesAny(officialSdkSupport, [
  "createTencentMutation",
  "genericApiCall",
  "call(apiName",
  "DeleteCluster",
  "CreateCluster",
  "PutObject",
  "DeleteObject",
], "official_sdk_strategy_forbidden_surface");

assert(realCloudReadinessFiles.includes(selfFile), "real_cloud_readiness_suite_must_include_official_sdk_strategy_contract");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_official_sdk_provider_strategy",
  checked: [
    "specs_index_pointer",
    "operations_spec_owner",
    "official_sdk_archive",
    "tc3_retirement_archive",
    "official_sdk_wrapper_source",
  ],
}, null, 2));
