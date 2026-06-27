import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEST_LANE_REGISTRY,
  TEST_LANE_SUITES,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const selfFile = "tests/contracts/contract-test-v22-validate-active-platform.mjs";

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function runGit(args) {
  return spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function assertIncludes(source, marker, label) {
  assert(String(source).includes(marker), `${label}_missing:${marker}`);
}

function assertNotIncludes(source, marker, label) {
  assert.equal(String(source).includes(marker), false, `${label}_must_not_include:${marker}`);
}

const [packageJson, scriptSource, landingCloseoutSource, manifest, current] = await Promise.all([
  readJson("package.json"),
  readRepoFile("scripts/v22-verify.mjs"),
  readRepoFile("scripts/v22-landing-closeout.mjs"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readJson("tests/fixtures/v22/goal-current.json"),
]);
const activeTruth = await readRepoFile("docs/active/README.md");

assert.equal(packageJson.scripts["validate:active-platform"], "node scripts/v22-verify.mjs active-platform", "package_script_mismatch");
assert.equal(packageJson.scripts.verify, "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk", "verify_script_mismatch");
assert.equal(packageJson.scripts["gate:review"], "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk", "review_script_mismatch");

for (const marker of [
  "tests/fixtures/v22/goal-current.json",
  "tests/fixtures/v22/agent-verify-manifest.json",
  "scripts/v22-verify.mjs",
  "scripts/v22-workflow-gate.mjs",
  "contracts/README.md",
  "contracts/medopl-product-profile.json",
  "contracts/medopl-portal-page-state-matrix.json",
  "contracts/medopl-portal-interaction-flow-contract.json",
  "contracts/medopl-portal-ui-quality-contract.json",
  "contracts/medopl-api-contract.json",
  "contracts/medopl-runtime-bridge-contract.json",
  "contracts/medopl-data-plane-contract.json",
  "contracts/medopl-billing-ledger-contract.json",
  "contracts/medopl-release-boundary.json",
  "contracts/medopl-cloud-boundary.json",
  "contracts/medopl-cloud-authorization-pack.json",
  "contracts/medopl-production-receipt-boundary.json",
  "global_forbidden_ops",
  "global_forbidden_files",
]) {
  assertIncludes(scriptSource, marker, "active_platform_wrapper_source");
}

assertIncludes(
  landingCloseoutSource,
  "tests\\/contracts\\/contract-test-v22-validate-active-platform\\.mjs",
  "landing_closeout_allowed_closeout_files",
);

for (const forbidden of [
  "kubectl ",
  "docker build",
  "docker push",
  "npm run build",
  "sentrux check",
  "sentrux gate",
  "deploy --",
]) {
  assertNotIncludes(scriptSource, forbidden, "active_platform_wrapper_must_not_embed_forbidden_command");
}

const registryEntry = TEST_LANE_REGISTRY.find((entry) => entry.file === selfFile);
assert(registryEntry, "active_platform_test_must_be_registered");
assert.equal(registryEntry.lane, "contract", "active_platform_lane_mismatch");
assert.equal(registryEntry.surface, "control-plane", "active_platform_surface_mismatch");
assert.equal(registryEntry.entryKind, "gate-self-test", "active_platform_entry_kind_mismatch");
assert.equal(registryEntry.authorization, "none", "active_platform_authorization_mismatch");
for (const suite of ["health", "local-contract", "current", "review"]) {
  assert(TEST_LANE_SUITES[suite].includes(selfFile), `active_platform_missing_suite:${suite}`);
}

assert.equal(current.verify_manifest, "tests/fixtures/v22/agent-verify-manifest.json", "current_manifest_pointer_mismatch");
assert.equal(manifest.runner, "scripts/v22-verify.mjs", "manifest_runner_mismatch");
const manifestCurrentLeaf = manifest.leaves.find((leaf) => leaf.leaf_id === current.current_cursor);
assert(manifestCurrentLeaf, "manifest_current_leaf_missing");
assert.equal(current.current_leaf?.step_id, current.current_cursor, "current_leaf_step_must_match_current_cursor");
assert.equal(manifestCurrentLeaf.gap_id, current.current_leaf?.gap_id, "manifest_current_leaf_gap_must_match_current_fixture");
assert.equal(manifestCurrentLeaf.stage, current.current_leaf?.stage, "manifest_current_leaf_stage_must_match_current_fixture");

const lastLandedCommit = current.last_landed_commit;
assert.match(lastLandedCommit, /^[0-9a-f]{40}$/u, "current_last_landed_commit_must_be_full_sha");
const trunkRef = current.branch_baseline || "origin/recovery/platform-v22-trunk";
const trunkHead = runGit(["rev-parse", "--verify", `${trunkRef}^{commit}`]);
assert.equal(trunkHead.status, 0, `current_branch_baseline_lookup_failed:${trunkHead.stderr || trunkHead.stdout}`);
const trunkHeadCommit = trunkHead.stdout.trim();
const landedOnTrunk = runGit(["merge-base", "--is-ancestor", lastLandedCommit, trunkHead.stdout.trim()]);
assert.equal(landedOnTrunk.status, 0, `current_last_landed_commit_must_be_trunk_ancestor:${landedOnTrunk.stderr || landedOnTrunk.stdout}`);
const landingCloseoutCheck = runNode([
  "scripts/v22-landing-closeout.mjs",
  "check",
  "--trunk-ref",
  trunkRef,
  "--json",
]);
assert.equal(landingCloseoutCheck.status, 0, `current_landing_closeout_check_must_pass:${landingCloseoutCheck.stderr || landingCloseoutCheck.stdout}`);
const landingCloseoutPayload = JSON.parse(landingCloseoutCheck.stdout);
assert.equal(landingCloseoutPayload.ok, true, "current_landing_closeout_payload_must_be_ok");
assert.equal(landingCloseoutPayload.trunkHead, trunkHeadCommit, "current_landing_closeout_trunk_head_must_match_baseline");
assert.equal(landingCloseoutPayload.lastLandedCommit, lastLandedCommit, "current_landing_closeout_last_landed_must_match_current");
assert.equal(current.latest_landed_closeout?.landed_commit, lastLandedCommit, "latest_closeout_landed_commit_must_match_current");
assert.equal(current.latest_landed_closeout?.branch, current.last_landed_branch, "latest_closeout_branch_must_match_current");
assert.equal(current.latest_landed_closeout?.next_cursor, current.current_cursor, "latest_closeout_next_cursor_must_match_current_cursor");
assert.equal(current.latest_landed_closeout?.post_merge_closeout, "completed", "latest_closeout_post_merge_must_be_completed");
assertIncludes(activeTruth, current.latest_landed_closeout?.branch, "active_truth_latest_landed_branch");
assertIncludes(activeTruth, current.latest_landed_closeout?.landed_commit, "active_truth_latest_landed_commit");
assert(
  current.current_problem.includes("opl-webui-runtime-production-slice"),
  "current_problem_must_keep_active_product_cursor",
);
assertIncludes(current.current_problem, current.latest_landed_closeout?.branch, "current_problem_latest_landed_branch");
assertIncludes(current.current_problem, current.latest_landed_closeout?.landed_commit, "current_problem_latest_landed_commit");
const repoGateCloseoutPattern = /The latest repo\/gate closeout is ([^ ]+) at ([a-f0-9]{40})/u;
const repoGateCloseout = current.current_problem.match(repoGateCloseoutPattern);
assert(repoGateCloseout, "current_problem_latest_repo_gate_closeout_missing");
assert.equal(repoGateCloseout[1], current.latest_landed_closeout?.branch, "current_problem_latest_repo_gate_branch_must_match_current");
assert.equal(repoGateCloseout[2], current.latest_landed_closeout?.landed_commit, "current_problem_latest_repo_gate_commit_must_match_current");
assert.equal(
  current.current_problem.includes("PostgreSQL-only local production data closure"),
  false,
  "current_problem_must_not_regress_to_old_postgresql_closeout_text",
);
assert.equal(
  current.current_blockers.includes("public_portal_medopl_api_routes_static_html_not_go_control_plane"),
  false,
  "current_blockers_must_not_keep_resolved_public_go_api_static_html_blocker",
);
assert.equal(
  current.current_problem.includes("old static nginx CLB"),
  false,
  "current_problem_must_not_keep_resolved_public_go_api_static_html_blocker",
);
assert.equal(
  current.public_api_availability?.status,
  "go_health_ready_available",
  "current_public_api_availability_status_must_record_go_health_ready_available",
);
assert.equal(
  current.public_api_availability?.evidence_level,
  "public_availability_probe",
  "current_public_api_availability_evidence_level_must_be_public_probe",
);
assert.equal(
  current.public_api_availability?.host,
  "https://portal.medopl.cn",
  "current_public_api_availability_host_mismatch",
);
assert.deepEqual(
  current.public_api_availability?.endpoints,
  ["healthz", "readyz"],
  "current_public_api_availability_endpoints_mismatch",
);
assert.deepEqual(
  current.public_api_availability?.cannot_claim,
  [
    "full OPL-Webui runtime-required product E2E canary completed",
    "cloud release candidate receipt manifest completed",
    "production complete",
  ],
  "current_public_api_availability_cannot_claim_mismatch",
);

const quick = runNode(["scripts/v22-verify.mjs", "active-platform", "--quick", "--json"]);
assert.equal(quick.status, 0, `active_platform_quick_must_pass:${quick.stderr || quick.stdout}`);
const payload = JSON.parse(quick.stdout);
assert.equal(payload.ok, true, "active_platform_quick_payload_must_be_ok");
assert.equal(payload.contract, "validate_active_platform", "active_platform_payload_contract_mismatch");
assert.equal(payload.currentCursor, current.current_cursor, "active_platform_payload_cursor_mismatch");
assert.equal(payload.manifestRunner, "scripts/v22-verify.mjs", "active_platform_payload_runner_mismatch");

const defaultRun = runNode(["scripts/v22-verify.mjs", "active-platform", "--json"]);
assert.equal(defaultRun.status, 0, `active_platform_default_must_pass:${defaultRun.stderr || defaultRun.stdout}`);
const defaultPayload = JSON.parse(defaultRun.stdout);
assert.deepEqual(defaultPayload, payload, "active_platform_default_must_remain_shape_only");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_validate_active_platform",
  currentCursor: current.current_cursor,
}, null, 2));
