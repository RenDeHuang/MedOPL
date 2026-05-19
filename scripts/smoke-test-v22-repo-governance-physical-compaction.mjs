import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SMOKE_CLASSIFICATION, smokeEvalMetadataOf } from "./v22-smoke-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const requiredFiles = Object.freeze([
  "docs/recovery/v22-repo-governance-physical-compaction-index.md",
  "docs/recovery/v22-agent-first-development-loop.md",
  "docs/recovery/agent-runs/2026-05-20-cleanup-v22-repo-governance-physical-compaction.md",
]);

const physicallyRetiredPaths = Object.freeze([
  "configs",
  "scripts/check-production-entry-health.mjs",
  "scripts/check-production-entry-performance.mjs",
  "scripts/update-dnspod-records.mjs",
  "scripts/smoke-test-root-dockerignore.mjs",
  "scripts/fixtures/fake-kubectl-success.cmd",
]);

const blockedRetireCandidates = Object.freeze([
  "compose.product.yaml",
  "scripts/v22-agent-workflow.mjs",
  "scripts/check-portal-copy.mjs",
  "scripts/check-one-person-lab-upstream-clean.mjs",
  "scripts/smoke-test-workspace-storage-routes-contract.mjs",
  "scripts/sync-workspace-file-to-minio.ps1",
  ".sentrux/**",
  ".env.demo.template",
]);

const allowedNonV22Scripts = Object.freeze([
  "scripts/check-mojibake.mjs",
  "scripts/check-one-person-lab-upstream-clean.mjs",
  "scripts/check-portal-copy.mjs",
  "scripts/fixtures/opl-product-api-fixture.mjs",
  "scripts/lib/portal-oidc-playwright.mjs",
  "scripts/smoke-test-workspace-storage-routes-contract.mjs",
  "scripts/sync-workspace-file-to-minio.ps1",
  "scripts/v22-agent-workflow.mjs",
  "scripts/v22-cloud-harness-select-checks.mjs",
  "scripts/v22-cloud-operation-local-executor.mjs",
  "scripts/v22-retired-surface-data.mjs",
  "scripts/v22-smoke-classification.mjs",
  "scripts/v22-tencent-readonly-inventory-runner.mjs",
  "scripts/v22-verify.mjs",
  "scripts/v22-workflow-gate.mjs",
]);

const forbiddenTopLevelDirs = Object.freeze([
  "openspec",
  "docs/plan",
  "docs/reports",
  "docs/releases",
  "docs/logs",
  "docs/operations",
  "docs/superpowers",
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

function diffNames(base, pathspec = "") {
  const commandSets = [
    ["diff", "--name-only", `${base}...HEAD`],
    ["diff", "--name-only", "--cached"],
    ["diff", "--name-only"],
  ].map((args) => (pathspec ? [...args, "--", pathspec] : args));
  return [...new Set(commandSets.flatMap((args) => {
    const output = git(args);
    return output ? output.split(/\r?\n/u).filter(Boolean) : [];
  }))].sort();
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

function classifyTrackedFile(filePath) {
  if ([
    "AGENTS.md",
    "README.md",
    "DESIGN.md",
    ".gitignore",
    ".dockerignore",
    ".env.demo.template",
    "compose.product.yaml",
  ].includes(filePath)) return "root-governance";

  if (filePath.startsWith(".sentrux/")) return "frozen-governance";
  if (filePath === "docs/product.md" || filePath === "docs/architecture.md") return "truth";
  if (["docs/status.md", "docs/vibe-coding.md", "docs/invariants.md", "docs/decisions.md"].includes(filePath)) return "governance-reference";
  if (filePath === "docs/contracts/README.md" || /^docs\/contracts\/v22-.+\.md$/u.test(filePath)) return "contracts";
  if (filePath.startsWith("docs/recovery/agent-runs/")) return "agent-runs";
  if (filePath.startsWith("docs/recovery/")) return "truth-index";
  if (/^scripts\/smoke-test-v22-.+\.mjs$/u.test(filePath)) return "v22-eval";
  if (allowedNonV22Scripts.includes(filePath)) return "eval-support";
  if (filePath.startsWith("services/portal/")) return "active-code:portal";
  if (filePath.startsWith("services/opl-web-gateway/")) return "active-code:opl-web-gateway";
  if (filePath.startsWith("services/opl-runtime-bridge/")) return "active-code:opl-runtime-bridge";
  return "";
}

for (const repoPath of requiredFiles) {
  assert.equal(await exists(repoPath), true, `required_governance_file_missing:${repoPath}`);
}

for (const repoPath of forbiddenTopLevelDirs) {
  assert.equal(await exists(repoPath), false, `retired_archive_or_second_truth_source_must_not_exist:${repoPath}`);
}

for (const repoPath of physicallyRetiredPaths) {
  assert.equal(await exists(repoPath), false, `physical_retire_path_must_not_exist:${repoPath}`);
}

const files = trackedFiles();
assert.equal(files.some((file) => file.startsWith("configs/")), false, "configs_must_not_be_tracked");
for (const repoPath of physicallyRetiredPaths.filter((item) => item !== "configs")) {
  assert.equal(files.includes(repoPath), false, `physical_retire_file_must_not_be_tracked:${repoPath}`);
}

const unclassified = files.filter((filePath) => !classifyTrackedFile(filePath));
assert.deepEqual(unclassified, [], `tracked_file_unclassified:${unclassified.join(",")}`);

const indexText = await source("docs/recovery/v22-repo-governance-physical-compaction-index.md");
for (const token of [
  "contracts / truth / index / eval / agent-runs",
  "configs/**",
  "blocked-retire-candidate",
  "leaf-portal-postgres-redis-local-production-data-closure",
  "PostgreSQL",
  "Redis",
  "7 天保护期",
]) {
  assert(indexText.includes(token), `repo_governance_index_token_missing:${token}`);
}

for (const repoPath of physicallyRetiredPaths) {
  assert(indexText.includes(repoPath), `repo_governance_index_must_record_retired_path:${repoPath}`);
}

for (const repoPath of blockedRetireCandidates) {
  assert(indexText.includes(repoPath), `repo_governance_index_must_record_blocked_candidate:${repoPath}`);
}

const loopText = await source("docs/recovery/v22-agent-first-development-loop.md");
for (const token of [
  "goal",
  "contracts",
  "truth",
  "index",
  "eval-first",
  "agent-run record",
  "B review only absorb",
  "post-absorb truth",
  "不新增 `openspec/` 第二事实源",
]) {
  assert(loopText.includes(token), `agent_first_loop_token_missing:${token}`);
}

const runRecordText = await source("docs/recovery/agent-runs/2026-05-20-cleanup-v22-repo-governance-physical-compaction.md");
for (const token of [
  "leaf_id",
  "goal",
  "model",
  "subagents_and_models",
  "base_trunk_head",
  "contract_subscription",
  "allowed_write_scope",
  "forbidden_scope",
  "verification_commands",
  "b_review_result",
  "pending_B_review",
  "不读取 secret",
  "不调用真实云",
  "不修改 upstream",
]) {
  assert(runRecordText.includes(token), `agent_run_record_token_missing:${token}`);
}

assert.equal(
  SMOKE_CLASSIFICATION["scripts/smoke-test-v22-repo-governance-physical-compaction.mjs"],
  "default/local-contract",
  "repo_governance_gate_must_be_default_local_contract",
);
assert.equal(
  smokeEvalMetadataOf("scripts/smoke-test-v22-repo-governance-physical-compaction.mjs").tier,
  "contract-local",
  "repo_governance_gate_must_be_contract_local_eval",
);

const manifest = JSON.parse(await source("docs/recovery/v22-agent-verify-manifest.json"));
const override = manifest.branch_override_suites.find((suite) => suite.id === "repo-governance-physical-compaction");
assert(override, "repo_governance_branch_override_missing");
assert(override.branches.includes("cleanup/v22-repo-governance-physical-compaction"), "repo_governance_branch_override_branch_missing");
assert(override.commands.includes("node scripts/smoke-test-v22-repo-governance-physical-compaction.mjs"), "repo_governance_override_must_run_gate");
assert(override.forbidden_files.includes("services/*"), "repo_governance_override_must_forbid_services");
assert(override.forbidden_ops.includes("postgres-redis-implementation"), "repo_governance_override_must_forbid_postgres_redis_implementation");

const localContract = manifest.suites.find((suite) => suite.id === "local-contract");
assert(localContract, "local_contract_suite_missing");
assert(localContract.commands.includes("node scripts/smoke-test-v22-repo-governance-physical-compaction.mjs"), "local_contract_suite_must_include_repo_governance_gate");

const serviceDiff = diffNames("origin/recovery/platform-v22-trunk", "services");
assert.deepEqual(serviceDiff, [], `services_must_not_change_in_governance_branch:${serviceDiff.join(",")}`);

const sentruxDiff = diffNames("origin/recovery/platform-v22-trunk", ".sentrux");
assert.deepEqual(sentruxDiff, [], `sentrux_must_not_change:${sentruxDiff.join(",")}`);

const statuses = diffNameStatuses("origin/recovery/platform-v22-trunk");
for (const deletedPath of physicallyRetiredPaths.filter((item) => item !== "configs")) {
  assert(statuses.some((line) => line === `D\t${deletedPath}`), `retired_file_must_be_deletion_only:${deletedPath}`);
}
const configDeleteCount = statuses.filter((line) => /^D\tconfigs\//u.test(line)).length;
assert.equal(configDeleteCount, 14, `configs_deletion_count_mismatch:${configDeleteCount}`);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_repo_governance_physical_compaction",
  trackedFiles: files.length,
  classifiedFiles: files.length - unclassified.length,
  physicallyRetiredPaths,
  configDeleteCount,
  blockedRetireCandidates,
}, null, 2));
