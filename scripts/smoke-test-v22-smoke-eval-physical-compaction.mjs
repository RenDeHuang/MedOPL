import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  HEALTH_CHECK_SCRIPTS,
  SMOKE_GOLDEN_SCRIPTS,
  SMOKE_CLASSIFICATION,
  listSmokeEvalScripts,
  smokeEvalMetadataOf,
} from "./v22-smoke-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const retiredScripts = Object.freeze([
  "scripts/check-portal-copy.mjs",
  "scripts/check-one-person-lab-upstream-clean.mjs",
  "scripts/smoke-test-workspace-storage-routes-contract.mjs",
]);

const replacementAuthorities = Object.freeze({
  "scripts/check-portal-copy.mjs": "scripts/check-mojibake.mjs",
  "scripts/check-one-person-lab-upstream-clean.mjs": "scripts/smoke-test-v22-repo-governance-physical-compaction.mjs",
  "scripts/smoke-test-workspace-storage-routes-contract.mjs": "scripts/smoke-test-v22-workspace-storage-public-response.mjs",
});

const blockedCandidates = Object.freeze([
  "scripts/v22-agent-workflow.mjs",
  "scripts/sync-workspace-file-to-minio.ps1",
]);

const requiredFiles = Object.freeze([
  "docs/recovery/v22-smoke-eval-physical-compaction-index.md",
  "docs/recovery/agent-runs/2026-05-20-cleanup-v22-smoke-eval-physical-compaction.md",
  "scripts/smoke-test-v22-smoke-eval-physical-compaction.mjs",
]);

function git(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_failed:${args.join(" ")}:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

async function exists(repoPath) {
  try {
    await access(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function source(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function trackedFiles() {
  return git(["ls-files"]).split(/\r?\n/u).filter(Boolean).sort();
}

function diffNameStatuses(base) {
  const commandSets = [
    ["diff", "--name-status", `${base}...HEAD`],
    ["diff", "--name-status", "--cached"],
    ["diff", "--name-status"],
  ];
  return [...new Set(commandSets.flatMap((args) => {
    const output = git(args);
    return output ? output.split(/\r?\n/u).filter(Boolean) : [];
  }))].sort();
}

for (const repoPath of requiredFiles) {
  assert.equal(await exists(repoPath), true, `required_smoke_eval_compaction_file_missing:${repoPath}`);
}

const files = trackedFiles();
const v22SmokeFiles = files.filter((file) => /^scripts\/smoke-test-v22-.+\.mjs$/u.test(file));
assert.deepEqual(Object.keys(SMOKE_CLASSIFICATION).sort(), v22SmokeFiles, "all_v22_smoke_eval_files_must_be_classified");

for (const scriptPath of retiredScripts) {
  assert.equal(await exists(scriptPath), false, `retired_smoke_eval_support_script_must_not_exist:${scriptPath}`);
  assert.equal(files.includes(scriptPath), false, `retired_smoke_eval_support_script_must_not_be_tracked:${scriptPath}`);
  assert.equal(Object.hasOwn(SMOKE_CLASSIFICATION, scriptPath), false, `retired_non_v22_script_must_not_be_classified:${scriptPath}`);
}

for (const replacementPath of Object.values(replacementAuthorities)) {
  assert.equal(await exists(replacementPath), true, `replacement_authority_missing:${replacementPath}`);
}

for (const scriptPath of blockedCandidates) {
  assert.equal(await exists(scriptPath), true, `blocked_candidate_must_remain_until_refs_migrate:${scriptPath}`);
}

const tierCounts = Object.fromEntries([
  "health-check",
  "smoke-golden",
  "contract-local",
  "local-regression",
  "future-authorized",
  "retired",
].map((tier) => [tier, listSmokeEvalScripts({ tiers: [tier] }).length]));

assert.equal(v22SmokeFiles.length, Object.keys(SMOKE_CLASSIFICATION).length, `v22_smoke_eval_count_mismatch:${v22SmokeFiles.length}`);
assert(v22SmokeFiles.length >= 148, `v22_smoke_eval_count_must_not_drop_below_absorbed_baseline:${v22SmokeFiles.length}`);
assert.equal(tierCounts["health-check"], 6, "health_check_count_must_remain_small");
assert.equal(tierCounts["smoke-golden"], 11, "smoke_golden_count_must_remain_stable");
assert.equal(tierCounts.retired, 0, "retired_eval_tier_must_remain_zero");
assert.deepEqual(listSmokeEvalScripts({ tiers: ["health-check"] }), [...HEALTH_CHECK_SCRIPTS].sort(), "health_check_scripts_must_be_explicit");
assert.deepEqual(listSmokeEvalScripts({ tiers: ["smoke-golden"] }), [...SMOKE_GOLDEN_SCRIPTS].sort(), "smoke_golden_scripts_must_be_explicit");

const compactionGate = "scripts/smoke-test-v22-smoke-eval-physical-compaction.mjs";
assert.equal(SMOKE_CLASSIFICATION[compactionGate], "default/local-contract", "smoke_eval_compaction_gate_must_be_local_contract");
assert.equal(smokeEvalMetadataOf(compactionGate).tier, "contract-local", "smoke_eval_compaction_gate_tier_mismatch");
assert.equal(smokeEvalMetadataOf(compactionGate).surface, "control-plane", "smoke_eval_compaction_gate_surface_mismatch");

const indexText = await source("docs/recovery/v22-smoke-eval-physical-compaction-index.md");
for (const token of [
  "v22 eval scripts: 148",
  "health-check: 6",
  "smoke-golden: 11",
  "contract-local: 21",
  "local-regression: 62",
  "future-authorized: 48",
  "retired: 0",
  "后续治理 gate 会增加当前 eval 总量",
]) {
  assert(indexText.includes(token), `smoke_eval_compaction_index_stat_missing:${token}`);
}
for (const scriptPath of retiredScripts) {
  assert(indexText.includes(scriptPath), `smoke_eval_compaction_index_retired_script_missing:${scriptPath}`);
  assert(indexText.includes(replacementAuthorities[scriptPath]), `smoke_eval_compaction_index_replacement_missing:${scriptPath}`);
}
for (const scriptPath of blockedCandidates) {
  assert(indexText.includes(scriptPath), `smoke_eval_compaction_index_blocked_candidate_missing:${scriptPath}`);
}

const repoGovernanceText = await source("docs/recovery/v22-repo-governance-physical-compaction-index.md");
const repoGovernanceGateText = await source("scripts/smoke-test-v22-repo-governance-physical-compaction.mjs");
for (const scriptPath of retiredScripts) {
  assert(repoGovernanceText.includes(scriptPath), `repo_governance_index_must_record_smoke_eval_retirement:${scriptPath}`);
  assert(!repoGovernanceText.includes(`| \`${scriptPath}\` | merge-candidate |`), `repo_governance_index_must_not_leave_retired_script_blocked:${scriptPath}`);
}
for (const token of [
  "assertOptionalRuntimeUpstreamClean",
  ".runtime",
  "one-person-lab-upstream",
  "git",
  "status",
  "--short",
]) {
  assert(repoGovernanceGateText.includes(token), `repo_governance_gate_must_absorb_upstream_clean_check:${token}`);
}

const manifest = JSON.parse(await source("docs/recovery/v22-agent-verify-manifest.json"));
const override = manifest.branch_override_suites.find((suite) => suite.id === "smoke-eval-physical-compaction");
assert(override, "smoke_eval_physical_compaction_branch_override_missing");
assert(override.branches.includes("cleanup/v22-smoke-eval-physical-compaction"), "smoke_eval_physical_compaction_branch_missing");
assert(override.commands.includes("node scripts/smoke-test-v22-smoke-eval-physical-compaction.mjs"), "smoke_eval_physical_compaction_override_must_run_gate");
assert(override.forbidden_files.includes("services/*"), "smoke_eval_physical_compaction_must_forbid_services");
assert(override.forbidden_ops.includes("postgres-redis-implementation"), "smoke_eval_physical_compaction_must_forbid_postgres_redis");

const localContract = manifest.suites.find((suite) => suite.id === "local-contract");
assert(localContract, "local_contract_suite_missing");
assert(localContract.commands.includes("node scripts/smoke-test-v22-smoke-eval-physical-compaction.mjs"), "local_contract_suite_must_include_smoke_eval_compaction_gate");

const mvpSuite = manifest.suites.find((suite) => suite.id === "mvp");
assert(mvpSuite?.description.includes("Legacy local deterministic regression entrypoint"), "mvp_suite_must_be_marked_legacy_regression");

const statuses = diffNameStatuses("origin/recovery/platform-v22-trunk");
for (const scriptPath of retiredScripts) {
  const activeDeletionDiff = statuses.some((line) => line === `D\t${scriptPath}`);
  assert(activeDeletionDiff || !files.includes(scriptPath), `retired_script_must_be_deleted_or_absorbed:${scriptPath}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_smoke_eval_physical_compaction",
  v22SmokeEvalFiles: v22SmokeFiles.length,
  tierCounts,
  retiredScripts,
  blockedCandidates,
}, null, 2));
