import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { smokeEvalMetadataOf } from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const branchName = "cleanup/v22-opl-style-taxonomy-hard-compaction";
const branchOverrideId = "opl-style-taxonomy-hard-compaction";
const thisGate = "tests/contract/contract-test-v22-opl-style-taxonomy-hard-compaction.mjs";
const runPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-opl-style-taxonomy-hard-compaction.md";

const retiredTruthFiles = Object.freeze([
  "docs/recovery/product-truth.md",
  "docs/recovery/architecture-truth.md",
  "docs/recovery/active-surface.md",
]);

const activeRefScopes = Object.freeze([
  "scripts",
  "docs/specs/README.md",
  "docs/README.md",
  "docs/active/README.md",
  "docs/product/README.md",
  "docs/runtime/README.md",
  "docs/source/README.md",
  "docs/specs/README.md",
  "docs/policies/README.md",
  "docs/delivery/README.md",
  "docs/public/README.md",
  "docs/references/README.md",
  "docs/history/README.md",
  "docs/vibe-coding.md",
  "docs/recovery/v22-agent-verify-manifest.json",
  "docs/recovery/v22-agent-first-development-loop.md",
  "docs/recovery/repo-zoning.md",
]);

const allowedChangedPrefixes = Object.freeze([
  "AGENTS.md",
  "DESIGN.md",
  "README.md",
  "docs/",
  "scripts/",
  "tests/",
]);

const requiredActiveTruthTokens = Object.freeze([
  "Purpose: `current_state_vs_ideal_gap`",
  "State: `hard_compacted_current_truth`",
  "唯一人读 current truth",
  "MedOPL v22 是 `platform-provisioned / customer-dedicated`",
  "当前 product cursor 是 `leaf-portal-postgres-redis-local-production-data-closure`",
  "当前不是真实云生产闭环",
  "不是 PostgreSQL/Redis production data layer 完成态",
  "Portal 不回答科研问题，不复制 OPL 的 chatbot",
  "OPL 负责科研执行",
  "用户删除文件空间才进入 7 天保护期",
  "释放计算资源不触发文件空间 7 天保护期",
  "删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期",
  "starter_2c4g_10gb",
  "pro_8c16g_100gb",
  "120min",
  "T+1",
  "https://gflabtoken.cn/v1",
  "portal.medopl.cn 登录不需要 gflabtoken API Key",
  "opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key",
  "Portal canonical truth 是 control-plane store，生产方向是 PostgreSQL",
  "Redis 不是事实源",
  "desired state",
  "actual state",
  "reconciled state",
  "Object/blob plane 当前仍属本地/过渡实现",
  "Gateway = 入口反腐层",
  "Runtime Bridge = launch/session/run/artifact/trace 的 canonical integration boundary",
  "one-person-lab 是 clean upstream",
  "active surface 不允许修改 one-person-lab upstream",
  "Current docs / eval surface during migration",
  "不能把旧 `docs/recovery/product-truth.md`",
]);

const requiredViewTokens = Object.freeze({
  "docs/product/README.md": [
    "Purpose: `product_truth_view`",
    "不是第二份 current truth",
    "Current Truth Pointer",
    "docs/active/README.md",
    "旧 `docs/recovery/product-truth.md` 已被吸收到 current truth",
  ],
  "docs/runtime/README.md": [
    "Purpose: `runtime_truth_view`",
    "不是第二份 current truth",
    "Current Truth Pointer",
    "docs/active/README.md",
    "旧 `docs/recovery/architecture-truth.md` 已被吸收到 current truth",
  ],
  "docs/source/README.md": [
    "Purpose: `source_surface_truth_view`",
    "不是第二份 current truth",
    "Current Truth Pointer",
    "docs/active/README.md",
    "旧 `docs/recovery/active-surface.md` 已被吸收到 current truth",
  ],
});

function git(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_failed:${args.join(" ")}:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

async function source(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
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

async function listFilesUnder(repoDir) {
  const entries = await readdir(path.join(repoRoot, repoDir), { withFileTypes: true });
  return entries.map((entry) => entry.name).sort();
}

function trackedFiles() {
  return git(["ls-files"]).split(/\r?\n/u).filter(Boolean).sort();
}

function changedFiles() {
  const outputs = [
    git(["diff", "--name-only", "origin/recovery/platform-v22-trunk...HEAD"]),
    git(["diff", "--name-only", "--cached"]),
    git(["diff", "--name-only"]),
    git(["ls-files", "--others", "--exclude-standard"]),
  ];
  return [...new Set(outputs.flatMap((output) => output.split(/\r?\n/u).filter(Boolean)))].sort();
}

function diffNameStatuses() {
  const outputs = [
    git(["diff", "--name-status", "origin/recovery/platform-v22-trunk...HEAD"]),
    git(["diff", "--name-status", "--cached"]),
    git(["diff", "--name-status"]),
  ];
  return new Set(outputs.flatMap((output) => output.split(/\r?\n/u).filter(Boolean)));
}

function rg(pattern, scopes) {
  const result = spawnSync("rg", ["-n", pattern, ...scopes], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status === 1) return "";
  assert.equal(result.status, 0, `rg_failed:${pattern}:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function assertIncludesAll(text, tokens, label) {
  for (const token of tokens) assert(text.includes(token), `${label}_missing:${token}`);
}

function assertNoForbiddenChangedFiles(files) {
  const forbidden = files.filter((file) => (
    file.startsWith("services/") ||
    file.startsWith("deploy/") ||
    file.startsWith(".sentrux/") ||
    file.startsWith("adapters/") ||
    file.startsWith("infra/") ||
    file.startsWith("one-person-lab/") ||
    file.startsWith("upstream/") ||
    file.startsWith(".runtime/")
  ));
  assert.deepEqual(forbidden, [], `hard_compaction_must_not_touch_forbidden_paths:${forbidden.join(",")}`);
  for (const file of files) {
    assert(allowedChangedPrefixes.some((prefix) => file.startsWith(prefix)), `hard_compaction_changed_file_outside_governance_docs_scripts_tests:${file}`);
  }
}

assert.deepEqual(await listFilesUnder("docs/active"), ["README.md"], "active_truth_dir_must_only_contain_readme");
assert.deepEqual(await listFilesUnder("docs/product"), ["README.md"], "product_truth_dir_must_only_contain_readme");
assert.deepEqual(await listFilesUnder("docs/runtime"), ["README.md"], "runtime_truth_dir_must_only_contain_readme");
assert.deepEqual(await listFilesUnder("docs/source"), ["README.md"], "source_truth_dir_must_only_contain_readme");

for (const retiredPath of retiredTruthFiles) {
  assert.equal(await exists(retiredPath), false, `retired_recovery_truth_file_must_be_deleted:${retiredPath}`);
  assert(
    diffNameStatuses().has(`D\t${retiredPath}`) || !trackedFiles().includes(retiredPath),
    `retired_recovery_truth_file_must_be_deleted_or_absorbed:${retiredPath}`,
  );
}

const activeTruth = await source("docs/active/README.md");
assertIncludesAll(activeTruth, requiredActiveTruthTokens, "docs/active/README.md");

for (const [repoPath, tokens] of Object.entries(requiredViewTokens)) {
  const text = await source(repoPath);
  assertIncludesAll(text, tokens, repoPath);
}

const activeRefs = rg("docs/recovery/(product-truth|architecture-truth|active-surface)\\.md|product-truth\\.md|architecture-truth\\.md|active-surface\\.md", activeRefScopes);
const allowedSelfRefs = activeRefs
  .split(/\r?\n/u)
  .filter(Boolean)
  .filter((line) => !line.startsWith(`${thisGate}:`))
  .filter((line) => !line.startsWith("docs/recovery/v22-agent-verify-manifest.json:"))
  .filter((line) => !line.startsWith("docs/active/README.md:"))
  .filter((line) => !line.startsWith("docs/product/README.md:"))
  .filter((line) => !line.startsWith("docs/runtime/README.md:"))
  .filter((line) => !line.startsWith("docs/source/README.md:"));
assert.deepEqual(allowedSelfRefs, [], `active_references_to_retired_truth_files_must_be_removed:${allowedSelfRefs.join("\n")}`);

const manifest = JSON.parse(await source("docs/recovery/v22-agent-verify-manifest.json"));
const override = manifest.branch_override_suites.find((suite) => suite.id === branchOverrideId);
assert(override, "hard_compaction_branch_override_missing");
assert.equal(override.branch, branchName, "hard_compaction_branch_mismatch");
assert(override.branches.includes(branchName), "hard_compaction_branches_must_include_branch");
assert(override.commands.includes(`node ${thisGate}`), "hard_compaction_override_must_run_this_gate");
assert(override.commands.includes("node tests/contract/contract-test-v22-docs-taxonomy-skeleton.mjs"), "hard_compaction_override_must_run_taxonomy_gate");
assert(override.commands.includes("node tests/contract/contract-test-v22-agent-run-record-gate.mjs"), "hard_compaction_override_must_run_agent_record_gate");
assert(override.commands.includes("node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk"), "hard_compaction_override_must_run_workflow_gate");
for (const retiredPath of retiredTruthFiles) {
  assert(override.retired_files.includes(retiredPath), `hard_compaction_override_must_record_retired_truth:${retiredPath}`);
}
const manifestWithoutHardRetiredFiles = JSON.stringify({
  ...manifest,
  branch_override_suites: manifest.branch_override_suites.map((suite) => (
    suite.id === branchOverrideId ? { ...suite, retired_files: [] } : suite
  )),
});
for (const retiredPath of retiredTruthFiles) {
  assert.equal(manifestWithoutHardRetiredFiles.includes(retiredPath), false, `manifest_must_not_active_reference_retired_truth_file:${retiredPath}`);
}
for (const forbiddenOp of ["secret", "live-cloud", "build-push-kubectl", "deploy", "live-test", "services-implementation", "upstream-write", "postgres-redis-implementation", "ff-only-absorb", "git-push"]) {
  assert(override.forbidden_ops.includes(forbiddenOp), `hard_compaction_override_forbidden_op_missing:${forbiddenOp}`);
}

const localContract = manifest.suites.find((suite) => suite.id === "local-contract");
assert(localContract, "local_contract_suite_missing");
assert(localContract.commands.includes(`node ${thisGate}`), "local_contract_suite_must_include_hard_compaction_gate");

const metadata = smokeEvalMetadataOf(thisGate);
assert.equal(metadata.category, "default/local-contract", "this_gate_category_mismatch");
assert.equal(metadata.tier, "contract-local", "this_gate_tier_mismatch");
assert.equal(metadata.surface, "control-plane", "this_gate_surface_mismatch");
assert.equal(metadata.entryKind, "atomic", "this_gate_entry_kind_mismatch");
assert.equal(metadata.authorization, "none", "this_gate_authorization_mismatch");

assertNoForbiddenChangedFiles(changedFiles());

const planResult = runNode([
  "scripts/v22-verify.mjs",
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  branchName,
  "--dry-run",
  "--json",
]);
assert.equal(planResult.status, 0, `verify_current_hard_compaction_dry_run_must_exit_zero:${planResult.stderr || planResult.stdout}`);
const planPayload = JSON.parse(planResult.stdout);
assert.equal(planPayload.ok, true, "verify_current_hard_compaction_dry_run_ok_mismatch");
assert.equal(planPayload.leafId, "leaf-portal-postgres-redis-local-production-data-closure", "hard_compaction_must_not_change_current_leaf");
assert.equal(planPayload.branchOverride?.suiteId, branchOverrideId, "verify_current_hard_compaction_branch_override_mismatch");
assert.deepEqual(planPayload.commands, override.commands, "verify_current_hard_compaction_commands_mismatch");
assert.deepEqual(planPayload.allowedFiles, override.allowed_files, "verify_current_hard_compaction_allowed_files_mismatch");
assert.deepEqual(planPayload.forbiddenFiles, override.forbidden_files, "verify_current_hard_compaction_forbidden_files_mismatch");

const agentRun = await source(runPath);
assertIncludesAll(agentRun, [
  "schema_version: 1",
  "leaf_id: cleanup-v22-opl-style-taxonomy-hard-compaction",
  "model: gpt-5.4",
  `branch: ${branchName}`,
  "branch_override_id: opl-style-taxonomy-hard-compaction",
  "subagents_and_models",
  "Lagrange: `gpt-5.4`",
  "Leibniz: `gpt-5.4`",
  "Locke: `gpt-5.4`",
  "Halley: `gpt-5.4`",
  "docs/active/README.md",
  "docs/recovery/product-truth.md",
  "docs/recovery/architecture-truth.md",
  "docs/recovery/active-surface.md",
  "pending_B_review",
  "不读取 secret",
  "不调用真实云",
  "不修改 upstream",
  "不 build/deploy/kubectl/live-test",
], "agent_run");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_opl_style_taxonomy_hard_compaction",
  branch: branchName,
  retiredTruthFiles,
  currentTruth: "docs/active/README.md",
  changedFiles: changedFiles(),
}, null, 2));
