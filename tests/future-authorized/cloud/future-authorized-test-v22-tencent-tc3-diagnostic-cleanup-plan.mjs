import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifestPath = "tests/fixtures/v22/agent-verify-manifest.json";
const runnerPath = "tests/support/cloud-prework/tencent-readonly-inventory-support.js";
const selfFile = "tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs";

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
  runner,
  specDelta,
  closeout,
  proposal,
] = await Promise.all([
  readFile("docs/specs/README.md", "utf8"),
  readFile("specs/operations/spec.md", "utf8"),
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile(runnerPath, "utf8"),
  readFile("changes/archive/2026-06-10-tc3-readonly-diagnostic-retirement/spec-delta.md", "utf8"),
  readFile("changes/archive/2026-06-10-tc3-readonly-diagnostic-retirement/closeout.md", "utf8"),
  readFile("changes/archive/2026-06-10-tc3-readonly-diagnostic-retirement/proposal.md", "utf8"),
]);
const realCloudReadinessFiles = commandFiles(manifest.suites.find((suite) => suite.id === "real-cloud-readiness")?.commands || []);

assert.equal(specsIndex.split("\n").length <= 400, true, `specs_index_line_budget_exceeded:${specsIndex.split("\n").length}`);
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_machine_json");
assertIncludesAll(specsIndex, [
  "spec:v22-tencent-tc3-diagnostic-cleanup-plan",
  "specs/operations/spec.md",
], "tc3_cleanup_specs_index");

assertIncludesAll(operationsSpec, [
  "`operations:tencent-tc3-diagnostic-cleanup-plan`",
  "tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs",
  "historical/provenance TC3 text is fully deleted",
], "tc3_cleanup_operations_spec");

assertIncludesAll(`${specDelta}\n${closeout}\n${proposal}`, [
  "TC3",
  "diagnostic",
  "production/default readonly path",
  "Tencent official SDK wrapper",
  "future authorized provider candidate",
], "tc3_cleanup_archive");

assertNotIncludesAny(runner, [
  "tencent-tc3-readonly",
  "--enable-real-fetch",
  "enableRealFetch",
], "tc3_cleanup_runner_must_not_expose_tc3_live_bridge");

assert(realCloudReadinessFiles.includes(selfFile), "real_cloud_readiness_suite_must_include_tc3_cleanup_plan_contract");

assertNotIncludesAny(`${specDelta}\n${closeout}`, [
  "callRealCloudNow: true",
  "readSecretNow: true",
  "runnerSupportsTencentTc3Readonly: true",
], "tc3_cleanup_forbidden_claims");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_tc3_diagnostic_cleanup_plan",
  checked: [
    "specs_index_pointer",
    "operations_spec_owner",
    "tc3_archive",
    "runner_no_tc3_live_bridge",
  ],
}, null, 2));
