import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const agentsPath = "AGENTS.md";
const invariantsPath = "docs/invariants.md";
const boardPath = "docs/recovery/v22-program-board.md";
const statusTablePath = "docs/recovery/v22-program-status-table.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

const requiredPhrases = [
  "边界先行 -> 探索/canary -> 修正边界 -> 正式实现 -> B 吸收",
  "未知外部系统接入先走 Discovery/Canary lane",
  "canary 必须有用户授权边界",
  "canary 输出只进 .runtime，不进 git",
  "canary 可以验证真实 SDK/云/服务，但不得自动变成 production dependency",
  "canary 发现的事实必须回写 contracts/status/decisions",
  "production implementation 必须基于已验证事实",
  "B 只吸收 productionized 分支，不吸收未清理 canary 临时代码",
  "Portal、Cloud、OPL sync 三条 program 都适用",
];

const programIds = ["portal-product-surface", "cloud-onboarding", "one-person-lab-sync"];

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

const [agents, invariants, board, statusTable, suite] = await Promise.all([
  readFile(agentsPath, "utf8"),
  readFile(invariantsPath, "utf8"),
  readFile(boardPath, "utf8"),
  readFile(statusTablePath, "utf8"),
  readFile(suitePath, "utf8"),
]);

assertIncludesAll(agents, requiredPhrases, "agents_discovery_canary_governance");
assertIncludesAll(invariants, requiredPhrases, "invariants_discovery_canary_governance");
assertIncludesAll(board, requiredPhrases, "program_board_discovery_canary_governance");
assertIncludesAll(statusTable, [
  "Discovery/Canary governance applies to portal-product-surface, cloud-onboarding, and one-person-lab-sync",
  "canary evidence location: .runtime only",
  "productionized branch required before B absorption",
], "program_status_discovery_canary_governance");

assertIncludesAll(board, [
  "Discovery/Canary Lane Rules",
  "discovery-canary",
  "boundary-first",
  "canary-evidence",
  "productionized-implementation",
], "program_board_lane_names");

const boardData = extractJsonBlock(board, "v22-program-board");
assert.equal(boardData.discoveryCanaryGovernance.boundaryFirst, true, "discovery_canary_boundary_first_must_be_true");
assert.equal(boardData.discoveryCanaryGovernance.canaryRequiresUserAuthorization, true, "canary_must_require_user_authorization");
assert.equal(boardData.discoveryCanaryGovernance.canaryOutputLocation, ".runtime", "canary_output_must_go_to_runtime");
assert.equal(boardData.discoveryCanaryGovernance.canaryMayBecomeProductionDependencyAutomatically, false, "canary_must_not_auto_become_prod_dependency");
assert.equal(boardData.discoveryCanaryGovernance.mustWriteBackFactsToContractsStatusDecisions, true, "canary_facts_must_write_back");
assert.equal(boardData.discoveryCanaryGovernance.productionImplementationRequiresVerifiedFacts, true, "production_impl_must_use_verified_facts");
assert.equal(boardData.discoveryCanaryGovernance.bAbsorbsOnlyProductionizedBranches, true, "b_must_absorb_only_productionized");
assert.deepEqual(boardData.discoveryCanaryGovernance.appliesToPrograms, programIds, "discovery_canary_program_scope_mismatch");

for (const program of boardData.programs) {
  assert(program.discoveryCanaryPolicy, `program_${program.programId}_missing_discovery_canary_policy`);
  assert.equal(program.discoveryCanaryPolicy.applies, true, `program_${program.programId}_discovery_canary_must_apply`);
  assert.equal(program.discoveryCanaryPolicy.canaryOutputLocation, ".runtime", `program_${program.programId}_canary_output_must_be_runtime`);
  assert.equal(program.discoveryCanaryPolicy.bAbsorptionRequiresProductionizedBranch, true, `program_${program.programId}_b_absorption_must_require_productionized`);
}

assert(suite.includes("smoke-test-v22-discovery-governance-local-gate.mjs"), "mvp_suite_must_include_discovery_canary_governance_smoke");

assertNotIncludesAny(agents + invariants + board + statusTable, [
  "canary 输出可进 git",
  "canary 自动变成 production dependency",
  "B 可以吸收未清理 canary",
  "未知外部系统直接正式实现",
  "\"canaryMayBecomeProductionDependencyAutomatically\": true",
  "\"bAbsorbsOnlyProductionizedBranches\": false",
], "discovery_canary_forbidden_claims");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_discovery_canary_governance",
  checked: [
    "agents_governance",
    "invariants_governance",
    "program_board_governance",
    "program_status_governance",
    "mvp_suite_integration",
    "no_canary_to_production_auto_promotion",
  ],
}, null, 2));
