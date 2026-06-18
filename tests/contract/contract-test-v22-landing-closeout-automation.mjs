import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readJson(repoPath) {
  return JSON.parse(await readFile(path.join(repoRoot, repoPath), "utf8"));
}

async function readText(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function runCloseout(args) {
  return spawnSync("node", ["scripts/v22-landing-closeout.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_command_failed:${args.join(" ")}:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function assertCloseoutFailure(args, expectedMessage) {
  const result = runCloseout(args);
  assert.notEqual(result.status, 0, `closeout_command_must_fail:${args.join(" ")}:${result.stdout}`);
  assert.match(result.stderr || result.stdout, expectedMessage, `closeout_failure_message_mismatch:${args.join(" ")}`);
}

const current = await readJson("tests/fixtures/v22/goal-current.json");
const history = await readText("docs/history/README.md");
const handoffBranch = current.last_landed_branch;
const handoffCommit = current.last_landed_commit;
const previousCommit = runGit(["rev-parse", `${handoffCommit}^`]);

assert(previousCommit, "previous_landed_commit_required");
assert.notEqual(previousCommit, handoffCommit, "previous_landed_commit_must_not_equal_handoff");
assert.equal(/^###\s+\d{4}-\d{2}-\d{2}\s+/mu.test(history), false, "history_must_not_store_run_sections_for_closeout_automation");
assert.equal(history.includes("Status: `ready_for_landing_review`"), false, "history_must_not_store_ready_for_landing_review");

assertCloseoutFailure([
  "generate",
  "--branch",
  handoffBranch,
  "--landed-commit",
  handoffCommit.slice(0, 12),
  "--next-cursor",
  "leaf-portal-postgres-only-local-production-data-closure",
  "--verification-summary",
  "negative short commit dry run",
  "--dry-run",
  "--json",
], /invalid_landed_commit/u);

assertCloseoutFailure([
  "generate",
  "--branch",
  handoffBranch,
  "--landed-commit",
  "1111111111111111111111111111111111111111",
  "--next-cursor",
  "leaf-portal-postgres-only-local-production-data-closure",
  "--verification-summary",
  "negative unknown commit dry run",
  "--dry-run",
  "--json",
], /landed_commit_not_found/u);

assertCloseoutFailure([
  "generate",
  "--branch",
  handoffBranch,
  "--landed-commit",
  previousCommit,
  "--next-cursor",
  "leaf-portal-postgres-only-local-production-data-closure",
  "--verification-summary",
  "negative wrong old commit dry run",
  "--dry-run",
  "--json",
], /landed_commit_mismatch/u);

assertCloseoutFailure([
  "generate",
  "--branch",
  "cleanup/v22-unknown-closeout-branch",
  "--landed-commit",
  handoffCommit,
  "--next-cursor",
  "leaf-portal-postgres-only-local-production-data-closure",
  "--verification-summary",
  "negative unknown branch dry run",
  "--dry-run",
  "--json",
], /branch_ref_missing/u);

assertCloseoutFailure([
  "generate",
  "--branch",
  handoffBranch,
  "--landed-commit",
  handoffCommit,
  "--next-cursor",
  "leaf-portal-postgres-only-local-production-data-closure",
  "--trunk-ref",
  previousCommit,
  "--verification-summary",
  "negative stale trunk reachability dry run",
  "--dry-run",
  "--json",
], /landed_commit_not_reachable_from_trunk/u);

assertCloseoutFailure([
  "generate",
  "--branch",
  handoffBranch,
  "--landed-commit",
  handoffCommit,
  "--verification-summary",
  "negative missing next cursor dry run",
  "--dry-run",
  "--json",
], /missing_next_cursor/u);

assertCloseoutFailure([
  "generate",
  "--branch",
  handoffBranch,
  "--landed-commit",
  handoffCommit,
  "--next-cursor",
  "leaf-portal-postgres-only-local-production-data-closure",
  "--verification-summary",
  "negative missing plan completion audit dry run",
  "--dry-run",
  "--json",
], /missing_plan_completion_audit/u);

const generateDryRun = runCloseout([
  "generate",
  "--branch",
  handoffBranch,
  "--landed-commit",
  handoffCommit,
  "--next-cursor",
  "leaf-portal-postgres-only-local-production-data-closure",
  "--verification-summary",
  "positive branch handoff dry run",
  "--completion-audit",
  "functional:done;code_cleanup:done;docs_foldback:done;verification:done;retired_entrypoints:partial;cannot_claim:done",
  "--cleanup-result",
  "deleted:obsolete active baton;folded:history summary;retained:runtime evidence;reason:external runtime not authorized;next:manifest compaction",
  "--dry-run",
  "--json",
]);
assert.equal(generateDryRun.status, 0, `valid_landing_closeout_generate_dry_run_failed:${generateDryRun.stderr || generateDryRun.stdout}`);
const generatePayload = JSON.parse(generateDryRun.stdout);
assert.equal(generatePayload.ok, true, "valid_landing_closeout_generate_payload_must_be_ok");
assert.equal(generatePayload.landedCommit, handoffCommit, "valid_landing_closeout_generate_commit_mismatch");
assert(generatePayload.updatedCurrentProblem.includes(handoffBranch), "valid_landing_closeout_generate_must_update_problem_branch");
assert(generatePayload.updatedCurrentProblem.includes(handoffCommit), "valid_landing_closeout_generate_must_update_problem_commit");
assert.equal(generatePayload.dryRun, true, "valid_landing_closeout_generate_must_stay_dry_run");
assert.equal(generatePayload.completionAudit.functional, "done", "valid_landing_closeout_must_parse_completion_audit");
assert.equal(generatePayload.completionAudit.retired_entrypoints, "partial", "valid_landing_closeout_must_allow_partial_audit");
assert.equal(generatePayload.cleanupResult.deleted, "obsolete active baton", "valid_landing_closeout_must_parse_cleanup_result");
assert.equal(generatePayload.cleanupResult.next, "manifest compaction", "valid_landing_closeout_must_parse_cleanup_next_gate");
assert.deepEqual(generatePayload.files, [
  "docs/history/README.md",
  "tests/fixtures/v22/goal-current.json",
  "docs/active/README.md",
], "valid_landing_closeout_generate_files_mismatch");

const result = runCloseout([
  "check",
  "--trunk-ref",
  "origin/recovery/platform-v22-trunk",
  "--json",
]);

assert.equal(result.status, 0, `landing_closeout_check_failed:${result.stderr || result.stdout}`);

const payload = JSON.parse(result.stdout);
assert.equal(payload.ok, true, "landing_closeout_payload_must_be_ok");
assert.equal(payload.trunkRef, "origin/recovery/platform-v22-trunk", "landing_closeout_trunk_ref_mismatch");
assert.equal(payload.lastLandedCommit, current.last_landed_commit, "landing_closeout_must_read_goal_current");
assert.equal(payload.lastLandedBranch, current.last_landed_branch, "landing_closeout_must_read_latest_branch");
assert.equal(payload.latestHistoryBranch, "", "landing_closeout_check_must_not_parse_history_branch");
assert.equal(payload.latestHistoryLandedCommit, "", "landing_closeout_check_must_not_parse_history_commit");
assert.equal(payload.postMergeCloseoutCompleted, true, "landing_closeout_must_confirm_truth_closeout");
assert.deepEqual(payload.missingPostMergeFields, [], "landing_closeout_missing_required_fields");

const headResult = runCloseout([
  "check",
  "--trunk-ref",
  "HEAD",
  "--json",
]);

assert.equal(headResult.status, 0, `landing_closeout_head_check_failed:${headResult.stderr || headResult.stdout}`);
const headPayload = JSON.parse(headResult.stdout);
assert.equal(headPayload.ok, true, "landing_closeout_head_payload_must_be_ok");
assert.equal(
  headPayload.findings.some((finding) => finding.code === "latest_cleanup_landed_commit_not_trunk_head"),
  false,
  "cleanup_closeout_must_allow_closeout_commit_after_landed_cleanup_commit",
);
assert.equal(
  headPayload.findings.some((finding) => finding.code === "non_closeout_commits_after_latest_landed"),
  false,
  "authoring_branch_head_must_not_apply_origin_trunk_post_merge_sync",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_landing_closeout_automation",
  trunkRef: payload.trunkRef,
  lastLandedCommit: payload.lastLandedCommit,
  lastLandedBranch: payload.lastLandedBranch,
}, null, 2));
