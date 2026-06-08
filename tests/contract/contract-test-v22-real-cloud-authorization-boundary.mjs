import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEST_LANE_REGISTRY,
  TEST_LANE_SUITES,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const selfFile = "tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs";
const changeRoot = "changes/active/real-cloud-authorization-boundary";

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertIncludes(source, marker, label) {
  assert(String(source).includes(marker), `${label}_missing:${marker}`);
}

function assertExcludes(source, marker, label) {
  assert.equal(String(source).includes(marker), false, `${label}_must_not_include:${marker}`);
}

function commandFiles(commands) {
  return commands
    .map((command) => String(command).match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u)?.[1] || "")
    .filter(Boolean)
    .sort();
}

const registryEntry = TEST_LANE_REGISTRY.find((entry) => entry.file === selfFile);
assert(registryEntry, "real_cloud_authorization_boundary_test_must_be_registered");
assert.equal(registryEntry.lane, "contract", "real_cloud_authorization_boundary_lane_mismatch");
assert.equal(registryEntry.surface, "cloud", "real_cloud_authorization_boundary_surface_mismatch");
assert.equal(registryEntry.entryKind, "gate-self-test", "real_cloud_authorization_boundary_entry_kind_mismatch");
assert.equal(registryEntry.authorization, "none", "real_cloud_authorization_boundary_must_not_require_authorization");
for (const suite of ["local-contract", "current", "review"]) {
  assert(TEST_LANE_SUITES[suite].includes(selfFile), `real_cloud_authorization_boundary_missing_suite:${suite}`);
}

const manifest = await readJson("tests/fixtures/v22/agent-verify-manifest.json");
const current = await readJson("tests/fixtures/v22/goal-current.json");
const manifestSuites = new Map(manifest.suites.map((suite) => [suite.id, suite]));
for (const suite of ["current", "local-contract"]) {
  const files = commandFiles(manifestSuites.get(suite)?.commands || []);
  assert(files.includes(selfFile), `real_cloud_authorization_boundary_missing_manifest_suite:${suite}`);
}
assert(commandFiles(current.current_leaf.verification_commands).includes(selfFile), "real_cloud_authorization_boundary_missing_current_leaf_command");
assert(commandFiles(current.verification_commands).includes(selfFile), "real_cloud_authorization_boundary_missing_top_level_command");

assert.equal(current.current_cursor, "real-cloud-authorization-boundary", "current_cursor_must_stay_authorization_boundary");
assert.equal(current.release_readiness_state.status, "authorization_required", "release_readiness_status_must_be_authorization_required");
assert.equal(current.release_readiness_state.blocked_before_risky_execution, true, "release_readiness_must_block_risky_execution");
assert.deepEqual(current.release_readiness_state.required_sequence, [
  "real-cloud authorization boundary",
  "mock/snapshot provider",
  "readonly quote",
  "dry-run plan",
  "readonly inventory",
  "authorized create/release",
  "authorized deploy",
  "canary / QA / status update",
], "real_cloud_release_sequence_mismatch");

const proposal = await readRepoFile(`${changeRoot}/proposal.md`);
const design = await readRepoFile(`${changeRoot}/design.md`);
const evalPlan = await readRepoFile(`${changeRoot}/eval-plan.md`);
const specDelta = await readRepoFile(`${changeRoot}/spec-delta.md`);
const tasks = await readRepoFile(`${changeRoot}/tasks.md`);
const review = await readRepoFile(`${changeRoot}/review.md`);
const closeout = await readRepoFile(`${changeRoot}/closeout.md`);
const delivery = await readRepoFile("docs/delivery/README.md");
const evidence = await readRepoFile("docs/evidence/README.md");
const specs = await readRepoFile("docs/specs/README.md");
const operationsSpec = await readRepoFile("specs/operations/spec.md");

for (const marker of [
  "operation class",
  "target environment",
  "evidence sink",
  "rollback owner",
  "secret allowlist",
  "API allowlist",
  "budget",
  "real-cloud authorization boundary",
]) {
  assertIncludes(proposal, marker, "real_cloud_authorization_proposal");
}

for (const marker of [
  "mock/snapshot provider",
  "readonly quote",
  "dry-run plan",
  "readonly inventory",
  "authorized create/release",
  "authorized deploy",
  "canary / QA / status update",
]) {
  assertIncludes(design, marker, "real_cloud_authorization_design_sequence");
  assertIncludes(evalPlan, marker, "real_cloud_authorization_eval_sequence");
}

for (const marker of [
  "Gate-A",
  "Gate-B",
  "realCloudCalls=false",
  ".runtime",
  "sanitized summary",
]) {
  assertIncludes(specDelta, marker, "real_cloud_authorization_spec_delta");
}

for (const marker of [
  "`node tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs`: passed",
  "`node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --dry-run --json`: passed",
  "Status: local_boundary_audited",
]) {
  assertIncludes(closeout, marker, "real_cloud_authorization_closeout");
}

assertIncludes(tasks, "- [x] Step 4: run local future-authorized evals.", "real_cloud_authorization_tasks_local_eval_done");
assertIncludes(tasks, "- [ ] Step 2: receive explicit authorization for any sensitive operation class.", "real_cloud_authorization_tasks_auth_still_open");
assertIncludes(review, "result: local boundary accepted; live execution remains blocked", "real_cloud_authorization_review_result");

for (const marker of [
  "Cloud delivery must keep this order",
  "mock/snapshot provider",
  "readonly quote",
  "dry-run plan",
  "readonly inventory",
  "authorized create/release",
  "authorized deploy",
  "canary / QA / status update",
]) {
  assertIncludes(delivery, marker, "delivery_truth_real_cloud_sequence");
}

for (const marker of [
  "authorized canary evidence",
  "live evidence",
  "production evidence",
  "raw provider key",
  "kubeconfig",
]) {
  assertIncludes(evidence, marker, "evidence_truth_authorization_storage");
}

for (const marker of [
  "spec:v22-cloud-onboarding-workflow-boundary",
  "Gate-A",
  "Gate-B",
  "realCloudCalls=false",
]) {
  assertIncludes(specs, marker, "specs_cloud_onboarding_boundary");
}

assertIncludes(operationsSpec, "operations:real-cloud-authorization-boundary", "operations_spec_real_cloud_boundary");
for (const forbidden of [
  "Status: landed",
  "Status: archived",
]) {
  assertExcludes(closeout, forbidden, "real_cloud_authorization_closeout_false_claim");
}
for (const marker of [
  "cloud online",
  "production online",
  "deploy ready",
  "secret authorized",
  "live-test authorized",
]) {
  assertIncludes(closeout, marker, "real_cloud_authorization_closeout_must_keep_cannot_claim");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_real_cloud_authorization_boundary",
  canClaim: [
    "real-cloud authorization package is locally audited",
    "post-six-step cloud gate order is repo-native and verifiable",
    "sensitive operations remain blocked before explicit authorization",
  ],
  cannotClaim: [
    "real cloud, secret, deploy, kubectl, build/push, live-test or production release is authorized",
  ],
}, null, 2));
