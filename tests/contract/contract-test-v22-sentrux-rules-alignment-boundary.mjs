import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEST_LANE_REGISTRY,
  TEST_LANE_SUITES,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const selfFile = "tests/contract/contract-test-v22-sentrux-rules-alignment-boundary.mjs";
const changeRoot = "changes/active/sentrux-v22-rules-alignment";

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

function assertNotIncludes(source, marker, label) {
  assert.equal(String(source).includes(marker), false, `${label}_must_not_include:${marker}`);
}

function commandFiles(commands) {
  return commands
    .map((command) => String(command).match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u)?.[1] || "")
    .filter(Boolean)
    .sort();
}

assert.equal(await exists(changeRoot), true, "sentrux_alignment_change_package_missing");

const registryEntry = TEST_LANE_REGISTRY.find((entry) => entry.file === selfFile);
assert(registryEntry, "sentrux_alignment_test_must_be_registered");
assert.equal(registryEntry.lane, "contract", "sentrux_alignment_lane_mismatch");
assert.equal(registryEntry.surface, "control-plane", "sentrux_alignment_surface_mismatch");
assert.equal(registryEntry.entryKind, "gate-self-test", "sentrux_alignment_entry_kind_mismatch");
assert.equal(registryEntry.authorization, "none", "sentrux_alignment_test_must_not_require_authorization");
for (const suite of ["local-contract", "current", "review"]) {
  assert(TEST_LANE_SUITES[suite].includes(selfFile), `sentrux_alignment_missing_suite:${suite}`);
}

const manifest = await readJson("tests/fixtures/v22/agent-verify-manifest.json");
const current = await readJson("tests/fixtures/v22/goal-current.json");
const manifestSuites = new Map(manifest.suites.map((suite) => [suite.id, suite]));
for (const suite of ["current", "local-contract"]) {
  const files = commandFiles(manifestSuites.get(suite)?.commands || []);
  assert(files.includes(selfFile), `sentrux_alignment_missing_manifest_suite:${suite}`);
}
assert(commandFiles(current.current_leaf.verification_commands).includes(selfFile), "sentrux_alignment_missing_current_leaf_command");
assert(commandFiles(current.verification_commands).includes(selfFile), "sentrux_alignment_missing_top_level_command");

const sourceTruth = await readRepoFile("docs/source/README.md");
const sentruxRules = await readRepoFile(".sentrux/rules.toml");
const closeout = await readRepoFile("changes/active/ai-runtime-contract/closeout.md");
const proposal = await readRepoFile(`${changeRoot}/proposal.md`);
const design = await readRepoFile(`${changeRoot}/design.md`);
const evalPlan = await readRepoFile(`${changeRoot}/eval-plan.md`);
const specDelta = await readRepoFile(`${changeRoot}/spec-delta.md`);
const tasks = await readRepoFile(`${changeRoot}/tasks.md`);
const review = await readRepoFile(`${changeRoot}/review.md`);
const alignmentCloseout = await readRepoFile(`${changeRoot}/closeout.md`);

for (const marker of [
  "services/portal/frontend",
  "services/medopl-go-backend",
  "services/opl-web-gateway",
  "services/opl-runtime-bridge",
  "`services/portal/src` 已物理清退",
]) {
  assertIncludes(sourceTruth, marker, "source_truth_v22_active_surface");
}

for (const marker of [
  "MedOPL v22 architecture rules for Sentrux",
  "services/portal/frontend",
  "services/medopl-go-backend",
  "services/opl-web-gateway",
  "services/opl-runtime-bridge",
  "max_cycles = 0",
  "max_upward_violations = 0",
  "no_god_files = true",
  "min_modularity = 0.759",
]) {
  assertIncludes(sentruxRules, marker, "sentrux_rules_v22_active_surface");
}
for (const marker of [
  "services/portal/src",
  "adapters/resource-provisioner",
  "adapters/med-autoscience-runner",
  "min_modularity = 0.80",
]) {
  assertNotIncludes(sentruxRules, marker, "sentrux_rules_stale_surface_retired");
}

for (const marker of [
  "`sentrux gate .`: passed",
  "`sentrux check .`: passed",
  "0.7594",
  "0.759",
  "rule/baseline alignment",
]) {
  assertIncludes(closeout, marker, "ai_runtime_closeout_sentrux_boundary");
}

for (const marker of [
  "Owner: MedOPL Platform",
  "Affected plane: Framework",
  "## Authorization Boundary",
  ".sentrux/* requires explicit authorization",
  "services/portal/frontend",
  "services/medopl-go-backend",
  "services/opl-web-gateway",
  "services/opl-runtime-bridge",
  "evidence-backed v22 baseline",
]) {
  assertIncludes(proposal, marker, "sentrux_alignment_proposal");
}

for (const marker of [
  "The authorized `.sentrux/rules.toml` edit",
  "remove retired `services/portal/src`",
  "remove old adapter layer assumptions",
  "keep `max_cycles = 0`",
  "keep `no_god_files = true`",
]) {
  assertIncludes(design, marker, "sentrux_alignment_design");
}

for (const marker of [
  "node tests/contract/contract-test-v22-sentrux-rules-alignment-boundary.mjs",
  "sentrux check .",
  "sentrux gate .",
]) {
  assertIncludes(evalPlan, marker, "sentrux_alignment_eval_plan");
}

for (const marker of [
  "specs/source/spec.md",
  "MODIFIED",
  "CANNOT-CLAIM",
  ".sentrux/*",
]) {
  assertIncludes(specDelta, marker, "sentrux_alignment_spec_delta");
}

assertIncludes(tasks, "- [x] Step 0: baseline audit current Sentrux state.", "sentrux_alignment_tasks_baseline_done");
assertIncludes(tasks, "- [x] Step 2: receive explicit authorization to modify `.sentrux/*`.", "sentrux_alignment_tasks_auth_done");
assertIncludes(review, "authorized rules alignment accepted", "sentrux_alignment_review_result");
assertIncludes(alignmentCloseout, "Status: local_rules_aligned", "sentrux_alignment_closeout_status");
assertIncludes(alignmentCloseout, "`sentrux check .`: passed", "sentrux_alignment_closeout_check_passed");
assertIncludes(alignmentCloseout, "Repository structure satisfies `.sentrux/rules.toml`", "sentrux_alignment_closeout_can_claim");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_sentrux_rules_alignment_boundary",
  canClaim: [
    "Sentrux v22 rules alignment package is locally completed",
    "current Sentrux check passes against the v22 active source model",
  ],
  cannotClaim: [
    "real cloud, deploy, kubectl, build/push or live-test readiness",
    "production readiness from local Sentrux structural readiness",
  ],
}, null, 2));
