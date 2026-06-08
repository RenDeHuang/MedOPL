import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  TEST_LANE_REGISTRY,
  TEST_LANE_SUITES,
  smokeEvalMetadataOf,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const selfFile = "tests/contract/contract-test-v22-ai-mvp-readiness-audit.mjs";

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function assertIncludes(source, marker, label) {
  assert(String(source).includes(marker), `${label}_missing:${marker}`);
}

function assertExcludesAll(source, markers, label) {
  for (const marker of markers) {
    assert.equal(String(source).includes(marker), false, `${label}_must_not_include:${marker}`);
  }
}

function commandFiles(commands) {
  return commands
    .map((command) => String(command).match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u)?.[1] || "")
    .filter(Boolean)
    .sort();
}

function registryEntry(file) {
  return TEST_LANE_REGISTRY.find((entry) => entry.file === file);
}

const requiredLocalProofs = Object.freeze([
  "tests/contract/contract-test-v22-mvp-contract-suite.mjs",
  "tests/contract/contract-test-v22-precloud-deployable-rc.mjs",
  "tests/contract/contract-test-v22-local-portal-opl-delivery-rc.mjs",
  "tests/contract/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs",
  "tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs",
  "tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-local-fake-probe.mjs",
]);

const requiredSourceOwners = Object.freeze([
  "services/opl-runtime-bridge/src/runtime-bridge-mcp-compatible-shapes.mjs",
  "services/opl-runtime-bridge/src/runtime-bridge-files.mjs",
  "services/opl-runtime-bridge/src/runtime-bridge-runtime-agent-relay.mjs",
  "services/opl-runtime-bridge/src/runtime-bridge-routes.mjs",
  "services/portal/frontend/src/app/data/portalAdminOpsModel.ts",
  "services/portal/frontend/src/app/data/portalAdminUsersModel.ts",
]);

for (const file of [selfFile, ...requiredLocalProofs, ...requiredSourceOwners]) {
  assert.equal(await exists(file), true, `ai_mvp_readiness_required_file_missing:${file}`);
}

const selfEntry = registryEntry(selfFile);
assert(selfEntry, `ai_mvp_readiness_audit_must_be_registered:${selfFile}`);
assert.equal(selfEntry.lane, "contract", "ai_mvp_readiness_audit_lane_mismatch");
assert.equal(selfEntry.surface, "control-plane", "ai_mvp_readiness_audit_surface_mismatch");
assert.equal(selfEntry.entryKind, "gate-self-test", "ai_mvp_readiness_audit_entry_kind_mismatch");
assert.equal(selfEntry.authorization, "none", "ai_mvp_readiness_audit_must_not_require_authorization");
for (const suite of ["local-contract", "current", "review"]) {
  assert(TEST_LANE_SUITES[suite].includes(selfFile), `ai_mvp_readiness_audit_missing_registry_suite:${suite}`);
}

for (const file of requiredLocalProofs) {
  const metadata = smokeEvalMetadataOf(file);
  assert(metadata.tier, `local_proof_must_be_registry_owned:${file}`);
  assert.equal(metadata.authorization, "none", `local_proof_must_not_require_authorization:${file}`);
  assert.notEqual(metadata.tier, "future-authorized", `local_proof_must_not_be_future_authorized:${file}`);
  assert.notEqual(metadata.tier, "local-rc-authorized", `local_proof_must_not_be_local_rc_authorized:${file}`);
}

const manifest = await readJson("tests/fixtures/v22/agent-verify-manifest.json");
const current = await readJson("tests/fixtures/v22/goal-current.json");
const manifestSuites = new Map(manifest.suites.map((suite) => [suite.id, suite]));
for (const suite of ["current", "local-contract", "review"]) {
  const suiteFiles = commandFiles(manifestSuites.get(suite)?.commands || []);
  assert(suiteFiles.includes(selfFile), `ai_mvp_readiness_audit_missing_manifest_suite:${suite}`);
}
assert(commandFiles(current.current_leaf.verification_commands).includes(selfFile), "ai_mvp_readiness_audit_missing_current_leaf_verification");
assert(commandFiles(current.verification_commands).includes(selfFile), "ai_mvp_readiness_audit_missing_top_level_verification");

assert.equal(current.current_cursor, "real-cloud-authorization-boundary", "current_cursor_must_remain_real_cloud_authorization_boundary");
assert.equal(current.release_readiness_state.status, "authorization_required", "release_readiness_must_remain_authorization_required");
assert.equal(current.release_readiness_state.cursor_eligible, false, "release_readiness_must_not_be_cursor_eligible");
assert.deepEqual(current.release_readiness_state.required_sequence, [
  "real-cloud authorization boundary",
  "mock/snapshot provider",
  "readonly quote",
  "dry-run plan",
  "readonly inventory",
  "authorized create/release",
  "authorized deploy",
  "canary / QA / status update",
], "real_cloud_sequence_must_stay_explicit_before_online_claim");
assert.equal(current.ai_mvp_readiness_state.status, "local_readiness_audited", "ai_mvp_readiness_state_must_be_local_audited");
assert.equal(current.ai_mvp_readiness_state.after_six_steps_claim, "local_ai_mvp_readiness_only", "six_steps_must_not_claim_cloud_online_ready");
assert.equal(current.ai_mvp_readiness_state.cloud_online_ready, false, "six_steps_must_not_be_cloud_online_ready");
assert.deepEqual(current.ai_mvp_readiness_state.six_step_sequence, [
  "current_fix_branch_closeout",
  "portal_structure_quality_recovery",
  "e2e_mvp_verification",
  "ai_runtime_contract",
  "runtime_bridge_ai_runtime_layer",
  "mcp_compatible_boundary_design",
], "ai_mvp_six_step_sequence_mismatch");
assert.deepEqual(current.ai_mvp_readiness_state.post_six_step_cloud_gate, current.release_readiness_state.required_sequence, "ai_mvp_post_six_step_gate_must_match_release_sequence");
for (const forbiddenClaim of [
  "real_cloud_ready",
  "production_online",
  "deploy_ready",
  "secret_authorized",
  "live_test_authorized",
]) {
  assert(current.ai_mvp_readiness_state.cannot_claim_after_six_steps.includes(forbiddenClaim), `ai_mvp_six_steps_forbidden_claim_missing:${forbiddenClaim}`);
}

const activeTruth = await readRepoFile("docs/active/README.md");
const specsTruth = await readRepoFile("docs/specs/README.md");
const runtimeTruth = await readRepoFile("docs/runtime/README.md");
const frameworkTruth = await readRepoFile("docs/framework/README.md");
const sourceTruth = await readRepoFile("docs/source/README.md");
const sentruxRules = await readRepoFile(".sentrux/rules.toml");
const aiRuntimeEvalPlan = await readRepoFile("changes/active/ai-runtime-contract/eval-plan.md");
const aiRuntimeCloseout = await readRepoFile("changes/active/ai-runtime-contract/closeout.md");

for (const marker of [
  "platform-provisioned / customer-dedicated",
  "real-cloud-authorization-boundary",
  "secret read, provider operation, true cloud mutation, deploy, kubectl, build/push and live-test remain blocked",
  "not real-cloud readiness",
]) {
  assertIncludes(activeTruth, marker, "active_truth_ai_mvp_readiness_boundary");
}

for (const marker of [
  "AI Runtime Contract",
  "MCP-compatible boundary",
  "runtimeTool",
  "runtimeResource",
  "runtimeRun",
  "runtimeArtifact",
  "runtimeApproval",
  "node tests/contract/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs",
  "node tests/contract/contract-test-v22-ai-mvp-readiness-audit.mjs",
  "local_ai_mvp_readiness_only",
  "six-step AI MVP readiness",
]) {
  assertIncludes(specsTruth, marker, "specs_truth_ai_mvp_readiness");
}

for (const marker of [
  "AI Runtime Contract",
  "MCP-compatible boundary",
  "Runtime Bridge AI runtime adapter layer",
]) {
  assertIncludes(runtimeTruth, marker, "runtime_truth_ai_mvp_readiness");
}

for (const marker of [
  "AI Runtime Contract",
  "MCP-compatible boundary",
  "Runtime Bridge / Runtime Agent projection boundary",
]) {
  assertIncludes(frameworkTruth, marker, "framework_truth_ai_mvp_readiness");
}

assertIncludes(sourceTruth, "`services/portal/src` 已物理清退", "source_truth_retired_portal_src");
for (const marker of [
  "MedOPL v22 architecture rules for Sentrux",
  "services/portal/frontend",
  "services/medopl-go-backend",
  "services/opl-web-gateway",
  "services/opl-runtime-bridge",
  "min_modularity = 0.759",
]) {
  assertIncludes(sentruxRules, marker, "sentrux_rules_v22_active_surface");
}
for (const marker of [
  "`sentrux gate .`: passed",
  "`sentrux check .`: passed",
  "measured modularity",
  "0.7594",
  "0.759",
  "Repository structure satisfies `.sentrux/rules.toml`",
]) {
  assertIncludes(aiRuntimeCloseout, marker, "ai_runtime_closeout_structure_boundary");
}

for (const marker of [
  "node tests/contract/contract-test-v22-ai-mvp-readiness-audit.mjs",
  "sentrux gate .",
  "sentrux check .",
]) {
  assertIncludes(aiRuntimeEvalPlan, marker, "ai_runtime_eval_plan_ai_mvp_readiness");
}

const mcpShapesUrl = pathToFileURL(path.join(repoRoot, "services/opl-runtime-bridge/src/runtime-bridge-mcp-compatible-shapes.mjs"));
mcpShapesUrl.search = `readiness=${Date.now()}`;
const mcpShapes = await import(mcpShapesUrl.href);
const shapePayload = mcpShapes.buildMcpCompatibleRuntimeShapes({
  runtimeSession: {
    runtimeSessionId: "runtime-session-ai-mvp-readiness",
    workspaceId: "workspace-ai-mvp-readiness",
    workspaceSessionId: "workspace-session-ai-mvp-readiness",
    providerKeyRef: "provider-key-ref-ai-mvp-readiness",
    rawProviderKey: "raw-provider-key-must-not-project",
    launchToken: "launch-token-must-not-project",
    runtimeToken: "runtime-token-must-not-project",
  },
  run: {
    runId: "run-ai-mvp-readiness",
    traceId: "trace-ai-mvp-readiness",
    toolName: "opl-runtime",
    objectKey: "object-key-must-not-project",
    localPath: "/tmp/local-path-must-not-project",
  },
  artifact: {
    artifactId: "artifact-ai-mvp-readiness",
    runId: "run-ai-mvp-readiness",
    name: "result.csv",
    relativePath: "outputs/result.csv",
    signedUrl: "https://storage.example.test/private?signature=must-not-project",
  },
});

assert.equal(shapePayload.boundary.shapeOnly, true, "mcp_shape_boundary_must_stay_shape_only");
assert.equal(shapePayload.boundary.productionMcpServer, false, "mcp_shape_must_not_claim_production_server");
assert.equal(shapePayload.boundary.externalClientsAuthorized, false, "mcp_shape_must_not_authorize_external_clients");
assert.equal(shapePayload.boundary.realCloudAuthorized, false, "mcp_shape_must_not_authorize_real_cloud");
mcpShapes.assertMcpCompatibleShapeOnly(shapePayload);
assertExcludesAll(JSON.stringify(shapePayload), [
  "raw-provider-key-must-not-project",
  "launch-token-must-not-project",
  "runtime-token-must-not-project",
  "object-key-must-not-project",
  "/tmp/local-path-must-not-project",
  "signature=must-not-project",
  "rawProviderKey",
  "launchToken",
  "runtimeToken",
  "objectKey",
  "localPath",
  "signedUrl",
], "ai_mvp_readiness_mcp_shape");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_ai_mvp_readiness_audit",
  canClaim: [
    "local AI Runtime Contract boundary is source-owned and registered",
    "local Runtime Bridge session/run/file/providerKeyRef and fake Runtime Agent loops are registered no-authorization proofs",
    "MCP-compatible projection is shape-only and does not authorize production MCP clients",
  ],
  cannotClaim: [
    "real cloud, secret, deploy, kubectl, build/push, live-test or production runtime readiness",
    "real-cloud or production readiness from local Sentrux structural readiness",
  ],
}, null, 2));
