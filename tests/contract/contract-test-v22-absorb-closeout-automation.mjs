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
  return spawnSync("node", ["scripts/v22-absorb-closeout.mjs", ...args], {
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

function extractHistorySection(history, branch) {
  const headings = [...history.matchAll(/^###\s+\d{4}-\d{2}-\d{2}\s+(.+)$/gmu)];
  const selectedIndex = headings.findIndex((match) => match[1].trim() === branch);
  assert.notEqual(selectedIndex, -1, `history_section_missing:${branch}`);
  const start = headings[selectedIndex].index;
  const end = selectedIndex + 1 < headings.length ? headings[selectedIndex + 1].index : history.length;
  return history.slice(start, end);
}

function extractField(section, field) {
  const match = section.match(new RegExp(`^${field}:\\s+\`?([^\`\\n]+)\`?\\s*$`, "mu"));
  return match ? match[1].trim() : "";
}

function previousAbsorbedCommit(history, branch) {
  const headings = [...history.matchAll(/^###\s+\d{4}-\d{2}-\d{2}\s+(.+)$/gmu)];
  const selectedIndex = headings.findIndex((match) => match[1].trim() === branch);
  assert.notEqual(selectedIndex, -1, `history_section_missing:${branch}`);
  for (let index = selectedIndex + 1; index < headings.length; index += 1) {
    const start = headings[index].index;
    const end = index + 1 < headings.length ? headings[index + 1].index : history.length;
    const section = history.slice(start, end);
    const status = extractField(section, "Status");
    const absorbedCommit = extractField(section, "absorbed_commit");
    if (status === "absorbed / pushed / post-push verified" && absorbedCommit) return absorbedCommit;
  }
  return "";
}

const current = await readJson("tests/fixtures/v22/goal-current.json");
const history = await readText("docs/history/README.md");
const handoffBranch = "cleanup/v22-opl-loop-event-automation-and-ci-closure";
const handoffSection = extractHistorySection(history, handoffBranch);
const handoffCommit = extractField(handoffSection, "handoff_commit")
  || extractField(handoffSection, "absorbed_commit")
  || runGit(["rev-parse", handoffBranch]);
const baseTrunkHead = extractField(handoffSection, "Base trunk HEAD");
const previousCommit = previousAbsorbedCommit(history, handoffBranch);

assert(previousCommit, "previous_absorbed_commit_required");
assert.notEqual(previousCommit, handoffCommit, "previous_absorbed_commit_must_not_equal_handoff");
assert(baseTrunkHead, "base_trunk_head_required");

assertCloseoutFailure([
  "generate",
  "--branch",
  handoffBranch,
  "--absorbed-commit",
  handoffCommit.slice(0, 12),
  "--next-cursor",
  "leaf-portal-postgres-redis-local-production-data-closure",
  "--verification-summary",
  "negative short commit dry run",
  "--dry-run",
  "--json",
], /invalid_absorbed_commit/u);

assertCloseoutFailure([
  "generate",
  "--branch",
  handoffBranch,
  "--absorbed-commit",
  "1111111111111111111111111111111111111111",
  "--next-cursor",
  "leaf-portal-postgres-redis-local-production-data-closure",
  "--verification-summary",
  "negative unknown commit dry run",
  "--dry-run",
  "--json",
], /absorbed_commit_not_found/u);

assertCloseoutFailure([
  "generate",
  "--branch",
  handoffBranch,
  "--absorbed-commit",
  previousCommit,
  "--next-cursor",
  "leaf-portal-postgres-redis-local-production-data-closure",
  "--verification-summary",
  "negative wrong old commit dry run",
  "--dry-run",
  "--json",
], /absorbed_commit_mismatch/u);

assertCloseoutFailure([
  "generate",
  "--branch",
  "cleanup/v22-unknown-closeout-branch",
  "--absorbed-commit",
  handoffCommit,
  "--next-cursor",
  "leaf-portal-postgres-redis-local-production-data-closure",
  "--verification-summary",
  "negative unknown branch dry run",
  "--dry-run",
  "--json",
], /history_section_missing/u);

assertCloseoutFailure([
  "generate",
  "--branch",
  handoffBranch,
  "--absorbed-commit",
  handoffCommit,
  "--next-cursor",
  "leaf-portal-postgres-redis-local-production-data-closure",
  "--trunk-ref",
  baseTrunkHead,
  "--verification-summary",
  "negative stale trunk reachability dry run",
  "--dry-run",
  "--json",
], /absorbed_commit_not_reachable_from_trunk/u);

assertCloseoutFailure([
  "generate",
  "--branch",
  handoffBranch,
  "--absorbed-commit",
  handoffCommit,
  "--verification-summary",
  "negative missing next cursor dry run",
  "--dry-run",
  "--json",
], /missing_next_cursor/u);

const generateDryRun = runCloseout([
  "generate",
  "--branch",
  handoffBranch,
  "--absorbed-commit",
  handoffCommit,
  "--next-cursor",
  "leaf-portal-postgres-redis-local-production-data-closure",
  "--verification-summary",
  "positive branch handoff dry run",
  "--dry-run",
  "--json",
]);
assert.equal(generateDryRun.status, 0, `valid_absorb_closeout_generate_dry_run_failed:${generateDryRun.stderr || generateDryRun.stdout}`);
const generatePayload = JSON.parse(generateDryRun.stdout);
assert.equal(generatePayload.ok, true, "valid_absorb_closeout_generate_payload_must_be_ok");
assert.equal(generatePayload.absorbedCommit, handoffCommit, "valid_absorb_closeout_generate_commit_mismatch");
assert.equal(generatePayload.dryRun, true, "valid_absorb_closeout_generate_must_stay_dry_run");

const result = runCloseout([
  "check",
  "--trunk-ref",
  "origin/recovery/platform-v22-trunk",
  "--json",
]);

assert.equal(result.status, 0, `absorb_closeout_check_failed:${result.stderr || result.stdout}`);

const payload = JSON.parse(result.stdout);
assert.equal(payload.ok, true, "absorb_closeout_payload_must_be_ok");
assert.equal(payload.trunkRef, "origin/recovery/platform-v22-trunk", "absorb_closeout_trunk_ref_mismatch");
assert.equal(payload.lastAbsorbedCommit, current.last_absorbed_commit, "absorb_closeout_must_read_goal_current");
assert.equal(payload.lastAbsorbedBranch, current.last_absorbed_branch, "absorb_closeout_must_read_latest_branch");
assert.equal(payload.postAbsorbTruthCloseoutCompleted, true, "absorb_closeout_must_confirm_truth_closeout");
assert.deepEqual(payload.missingPostAbsorbFields, [], "absorb_closeout_missing_required_fields");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_absorb_closeout_automation",
  trunkRef: payload.trunkRef,
  lastAbsorbedCommit: payload.lastAbsorbedCommit,
  lastAbsorbedBranch: payload.lastAbsorbedBranch,
}, null, 2));
