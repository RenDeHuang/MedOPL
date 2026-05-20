import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const contractPath = "docs/contracts/v22-cloud-onboarding-workflow-boundary.md";
const boardPath = "docs/recovery/cloud-onboarding-execution-board.md";
const statusPath = "docs/recovery/cloud-onboarding-status-table.md";
const workflowScriptPath = "scripts/v22-agent-workflow.mjs";
const suitePath = "tests/contract/contract-test-v22-mvp-contract-suite.mjs";

const expectedSteps = [
  "R-00",
  "R-01",
  "R-02",
  "R-03",
  "R-04",
  "R-05",
  "R-06",
  "R-07",
  "R-08",
  "R-09",
  "R-10",
  "R-11",
  "R-12",
  "R-13",
  "R-14",
  "R-15",
  "R-16",
  "R-17",
  "R-18",
  "R-19",
  "R-20",
  "R-21",
];

const expectedGateIds = [
  "CC-01",
  "CC-01",
  "CC-01",
  "CC-02",
  "CC-02",
  "CC-03",
  "CC-04",
  "CC-04",
  "CC-05",
  "CC-05",
  "CC-03",
  "CC-04",
  "CC-05",
  "CC-06",
  "CC-07",
  "CC-07",
  "CC-07",
  "CC-07",
  "CC-07",
  "CC-05",
  "CC-04",
  "CC-REVIEW",
];

const expectedArtifactFragments = [
  "stdout JSON only",
  "services/portal/package.json",
  "services/portal/package-lock.json",
  ".runtime/v22-tencent-readonly-inventory/",
  ".runtime/v22-cloud-lifecycle/",
  ".runtime/v22-registry/",
  ".runtime/v22-cloud-reconciliation/",
  ".runtime/v22-cloud-deploy/",
  ".runtime/v22-runtime-smoke/",
  ".runtime/v22-cloud-cleanup/",
];

const retiredAliases = [
  "C00",
  "C01",
  "C02",
  "C03",
  "C04",
  "CO-01..CO-14",
];

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

function extractJsonBlock(source, markerName) {
  const start = `<!-- ${markerName}:start -->`;
  const end = `<!-- ${markerName}:end -->`;
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  assert(startIndex >= 0, `${markerName}_start_marker_missing`);
  assert(endIndex > startIndex, `${markerName}_end_marker_missing`);
  const block = source.slice(startIndex + start.length, endIndex);
  const match = /```json\s*([\s\S]*?)\s*```/.exec(block);
  assert(match, `${markerName}_json_fence_missing`);
  return JSON.parse(match[1]);
}

function runWorkflow(args) {
  const result = spawnSync(process.execPath, [workflowScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `workflow_${args.join("_")}_must_exit_zero:${result.stderr}`);
  return JSON.parse(result.stdout);
}

const [contract, board, status, workflowScript, suite] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(boardPath, "utf8"),
  readFile(statusPath, "utf8"),
  readFile(workflowScriptPath, "utf8"),
  readFile(suitePath, "utf8"),
]);

assertIncludesAll(contract, [
  "Future Authorized Cloud Connection Path",
  "R-00 local contract guard",
  "R-01 SDK dependency install",
  "R-04 readonly live report",
  "R-12 expand compute dry-run and execution",
  "R-18 runtime smoke",
  "R-21 final reconciliation cleanup and B review",
], "contract_future_authorized_path");

assertIncludesAll(contract + board + status, retiredAliases, "retired_aliases_documented");

const contractData = extractJsonBlock(contract, "v22-cloud-onboarding-workflow-contract");
assert.equal(contractData.activeGatePrefix, "CC", "contract_active_gate_prefix");
assert.deepEqual(contractData.retiredLegacyGateAliases, retiredAliases, "contract_retired_aliases");
assert.deepEqual(contractData.futureAuthorizedPath.map((step) => step.step), expectedSteps, "contract_future_authorized_step_order");
assert.deepEqual(contractData.futureAuthorizedPath.map((step) => step.gateId), expectedGateIds, "contract_future_authorized_gate_order");
for (const step of contractData.futureAuthorizedPath) {
  for (const key of ["step", "gateId", "authorizationPackage", "entrypoint", "artifactPath", "blockerWriteback"]) {
    assert(Object.hasOwn(step, key), `contract_future_authorized_${step.step}_missing:${key}`);
  }
}

const boardData = extractJsonBlock(board, "v22-cloud-onboarding-execution-board");
assert.equal(boardData.activeGatePrefix, "CC", "board_active_gate_prefix");
assert.deepEqual(boardData.retiredLegacyGateAliases, retiredAliases, "board_retired_aliases");
assertIncludesAll(boardData.runnablePathArtifactRoots.join("\n"), expectedArtifactFragments, "board_artifact_roots");

const statusData = extractJsonBlock(status, "v22-cloud-onboarding-status-table");
assert.equal(statusData.activeGatePrefix, "CC", "status_active_gate_prefix");
assert.deepEqual(statusData.retiredLegacyGateAliases, retiredAliases, "status_retired_aliases");
assert.deepEqual(statusData.runnableGateMapping.map((item) => item.gateId), [
  "CC-01",
  "CC-02",
  "CC-03",
  "CC-04",
  "CC-05",
  "CC-06",
  "CC-07",
  "CC-REVIEW",
], "status_runnable_gate_mapping_order");

const statusPayload = runWorkflow(["cloud-onboarding", "status", "--json"]);
assert.deepEqual(statusPayload.runnablePath.map((step) => step.step), expectedSteps, "workflow_runnable_step_order");
assert.deepEqual(statusPayload.runnablePath.map((step) => step.gateId), expectedGateIds, "workflow_runnable_gate_order");
assert.equal(statusPayload.runnablePath.find((step) => step.step === "R-04").blockedReason, "needs_explicit_user_authorization", "workflow_r04_must_be_blocked");
assert.equal(statusPayload.runnablePath.find((step) => step.step === "R-04").suggestedCommands.length, 0, "workflow_r04_must_not_emit_live_command");
assert.equal(JSON.stringify(statusPayload.runnablePath).includes("/home/dev/" + ".secrets"), false, "workflow_runnable_path_must_not_emit_secret_path");
assert.equal(JSON.stringify(statusPayload.runnablePath).includes("--live-readonly"), false, "workflow_runnable_path_must_not_emit_live_flag");

assertIncludesAll(workflowScript, [
  "cloudOnboardingRunnablePath",
  ".runtime/v22-tencent-readonly-inventory/<authorized-run-id>.json",
  ".runtime/v22-cloud-lifecycle/<operation-id>-storage-dry-run.json",
  ".runtime/v22-registry/<run-id>.json",
  ".runtime/v22-cloud-reconciliation/<run-id>.json",
  ".runtime/v22-runtime-smoke/<run-id>.json",
  ".runtime/v22-cloud-cleanup/<run-id>.json",
], "workflow_script_runnable_path");

assert(suite.includes("future-authorized-test-v22-cloud-connection-runnable-path.mjs"), "mvp_suite_must_include_runnable_path_smoke");

assertNotIncludesAny(contract + board + status, [
  "\"gateId\": \"C00\"",
  "\"gateId\": \"C01\"",
  "\"gateId\": \"C02\"",
  "\"gateId\": \"C03\"",
  "\"gateId\": \"C04\"",
  "| C00 |",
  "| C01 |",
  "| C02 |",
  "| C03 |",
  "| C04 |",
  "\"readsSecretNow\": true",
  "\"callsRealCloudNow\": true",
  "\"executesMutationNow\": true",
], "retired_gate_aliases_must_not_be_active");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_connection_runnable_path",
  checked: [
    "legacy_c00_c04_aliases_retired",
    "runnable_steps_r00_to_r21",
    "cc_gate_mapping",
    "artifact_paths",
    "workflow_json_runnable_path",
    "mvp_suite_integration",
  ],
}, null, 2));
