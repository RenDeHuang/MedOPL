import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function runWorkflow(args) {
  return spawnSync(process.execPath, ["scripts/v22-agent-workflow.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

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

function parseJson(stdout) {
  return JSON.parse(stdout);
}

async function writeReply(tempRoot, name, body) {
  const replyPath = path.join(tempRoot, name);
  await writeFile(replyPath, body, "utf8");
  return replyPath;
}

const docs = await readFile(path.join(repoRoot, "docs/vibe-coding.md"), "utf8");
assertIncludesAll(docs, [
  "scripts/v22-agent-workflow.mjs",
  "ingest --from A|B|C|D --file <reply.txt>",
  "write-pack --window A|B|C|D --state <state.json>",
  "status",
  "A_COMMITTED",
  "B_BLOCKER",
  "A_FIXED",
  "B_MERGED",
  "B_PUSHED",
  "C_BLOCKER",
  "C_PASS",
  "不自动 merge",
  "不自动 push",
  "不启动 tmux",
  "不读 secret",
  "不调用真实云",
  "主工作区只用于规划、B 审计、ff-only merge、checkpoint、push、清理",
  "A/C/D 只要会写文件，默认必须在独立 git worktree",
  "truth 必须进入 repo-tracked contracts/docs/scripts/tests",
], "vibe_coding_doc");

const startResult = runWorkflow(["start", "--type", "cleanup"]);
assert.equal(startResult.status, 0, "start_cli_must_exit_zero");
assertIncludesAll(startResult.stdout, [
  "A 窗口任务包",
  "B 窗口任务包",
  "C 窗口任务包",
  "下一步建议",
  "推荐 worktree 路径",
  "推荐 branch",
  "主工作区不可写",
  "B 使用主工作区",
  "A/C/D 使用独立 worktree",
  "Owner Worktree 纪律",
  "JSON 摘要",
], "start_human_output");

const startJson = runWorkflow(["start", "--type", "portal-ui", "--json"]);
assert.equal(startJson.status, 0, "start_json_must_exit_zero");
const startPayload = parseJson(startJson.stdout);
assert.equal(startPayload.command, "start", "start_json_command");
assert.equal(startPayload.type, "portal-ui", "start_json_type");
assert.equal(startPayload.ok, true, "start_json_ok");
assert.equal(startPayload.recommendedBranch, "feat/v22-portal-ui-lane", "start_json_recommended_branch");
assert.equal(startPayload.recommendedWorktreePath, "/home/dev/projects/platform-v22.worktrees/portal-ui", "start_json_recommended_worktree_path");
assert.deepEqual(startPayload.workspaceDiscipline.writingLanesUseWorktree, ["A", "C", "D"], "start_json_writing_lanes_worktree");
assert.equal(startPayload.disallowedActions.includes("git merge"), true, "start_json_disallowed_merge");
assert.equal(startPayload.disallowedActions.includes("git push"), true, "start_json_disallowed_push");

const reviewResult = runWorkflow(["review-pack", "--branch", "feat/v22-agent-workflow-state-machine", "--base", "recovery/platform-v22-trunk"]);
assert.equal(reviewResult.status, 0, "review_cli_must_exit_zero");
assertIncludesAll(reviewResult.stdout, [
  "B 审查包",
  "验证命令",
  "合并条件",
  "feat/v22-agent-workflow-state-machine",
  "B 使用主工作区",
  "主工作区不可写",
  "Owner Worktree 纪律",
  "JSON 摘要",
], "review_human_output");

const qaResult = runWorkflow(["c-qa-pack", "--surface", "workspace"]);
assert.equal(qaResult.status, 0, "qa_cli_must_exit_zero");
assertIncludesAll(qaResult.stdout, [
  "C 只读 UI QA 包",
  "截图要求",
  "边界检查项",
  "workspace",
  "A/C/D 使用独立 worktree",
  "truth 必须进入 repo-tracked contracts/docs/scripts/tests",
  "Owner Worktree 纪律",
  "JSON 摘要",
], "qa_human_output");

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-agent-workflow-state-machine-"));
try {
  const aSuccess = await writeReply(tempRoot, "a-success.txt", [
    "status: A_COMMITTED",
    "branch: feat/v22-admin-ops-console-boundary",
    "commit: 111aaaa",
    "worktree: /home/dev/projects/platform-v22.worktrees/admin-ops-console",
    "summary: A 完成 admin/ops MVP commit",
  ].join("\n"));

  const bBlocker = await writeReply(tempRoot, "b-blocker.txt", [
    "status: B_BLOCKER",
    "branch: feat/v22-admin-ops-console-boundary",
    "base: recovery/platform-v22-trunk",
    "commit: 111aaaa",
    "blocker: admin ops smoke 没有覆盖普通用户 role surface 边界",
  ].join("\n"));

  const aFixed = await writeReply(tempRoot, "a-fixed.txt", [
    "status: A_FIXED",
    "branch: feat/v22-admin-ops-console-boundary",
    "commit: 222bbbb",
    "fix: 已补 role surface smoke 并重跑验证",
  ].join("\n"));

  const bPush = await writeReply(tempRoot, "b-pushed.txt", [
    "status: B_PUSHED",
    "branch: recovery/platform-v22-trunk",
    "commit: ab786a0",
    "surface: overview",
    "summary: B 已复审、ff-only 合并并 push",
  ].join("\n"));

  const cBlocker = await writeReply(tempRoot, "c-blocker.txt", [
    "status: C_BLOCKER",
    "branch: feat/v22-admin-ops-console-boundary",
    "surface: billing",
    "blocker: 账单页截图显示运维字段进入普通用户主语言",
  ].join("\n"));

  const cPass = await writeReply(tempRoot, "c-pass.txt", [
    "status: C_PASS",
    "branch: recovery/platform-v22-trunk",
    "surface: overview",
    "summary: C 只读 QA 通过，无 blocker",
  ].join("\n"));

  const ingestASuccess = runWorkflow(["ingest", "--from", "A", "--file", aSuccess]);
  assert.equal(ingestASuccess.status, 0, "ingest_a_success_must_exit_zero");
  assertIncludesAll(ingestASuccess.stdout, [
    "stableStatus: A_COMMITTED",
    "B review-pack",
    "feat/v22-admin-ops-console-boundary",
    "JSON 摘要",
  ], "ingest_a_success_human");
  const ingestASuccessJson = parseJson(runWorkflow(["ingest", "--from", "A", "--file", aSuccess, "--json"]).stdout);
  assert.equal(ingestASuccessJson.command, "ingest", "ingest_a_success_json_command");
  assert.equal(ingestASuccessJson.stableStatus, "A_COMMITTED", "ingest_a_success_stable_status");
  assert.equal(ingestASuccessJson.next.window, "B", "ingest_a_success_next_window");
  assert.equal(ingestASuccessJson.next.action, "review-pack", "ingest_a_success_next_action");
  assert.equal(ingestASuccessJson.pack.command, "review-pack", "ingest_a_success_pack_command");

  const ingestBBlocker = runWorkflow(["ingest", "--from", "B", "--file", bBlocker]);
  assert.equal(ingestBBlocker.status, 0, "ingest_b_blocker_must_exit_zero");
  assertIncludesAll(ingestBBlocker.stdout, [
    "stableStatus: B_BLOCKER",
    "A fix-pack",
    "admin ops smoke 没有覆盖普通用户 role surface 边界",
    "JSON 摘要",
  ], "ingest_b_blocker_human");
  const ingestBBlockerJson = parseJson(runWorkflow(["ingest", "--from", "B", "--file", bBlocker, "--json"]).stdout);
  assert.equal(ingestBBlockerJson.stableStatus, "B_BLOCKER", "ingest_b_blocker_stable_status");
  assert.equal(ingestBBlockerJson.next.window, "A", "ingest_b_blocker_next_window");
  assert.equal(ingestBBlockerJson.next.action, "fix-pack", "ingest_b_blocker_next_action");
  assert.equal(ingestBBlockerJson.pack.command, "fix-pack", "ingest_b_blocker_pack_command");

  const ingestAFixedJson = parseJson(runWorkflow(["ingest", "--from", "A", "--file", aFixed, "--json"]).stdout);
  assert.equal(ingestAFixedJson.stableStatus, "A_FIXED", "ingest_a_fixed_stable_status");
  assert.equal(ingestAFixedJson.next.window, "B", "ingest_a_fixed_next_window");
  assert.equal(ingestAFixedJson.next.action, "re-review-pack", "ingest_a_fixed_next_action");
  assert.equal(ingestAFixedJson.pack.command, "re-review-pack", "ingest_a_fixed_pack_command");

  const ingestBPushJson = parseJson(runWorkflow(["ingest", "--from", "B", "--file", bPush, "--json"]).stdout);
  assert.equal(ingestBPushJson.stableStatus, "B_PUSHED", "ingest_b_push_stable_status");
  assert.equal(ingestBPushJson.next.window, "C", "ingest_b_push_next_window");
  assert.equal(ingestBPushJson.next.action, "qa-pack", "ingest_b_push_next_action");
  assert.equal(ingestBPushJson.pack.command, "c-qa-pack", "ingest_b_push_pack_command");

  const ingestCBlockerJson = parseJson(runWorkflow(["ingest", "--from", "C", "--file", cBlocker, "--json"]).stdout);
  assert.equal(ingestCBlockerJson.stableStatus, "C_BLOCKER", "ingest_c_blocker_stable_status");
  assert.equal(ingestCBlockerJson.next.window, "A", "ingest_c_blocker_next_window");
  assert.equal(ingestCBlockerJson.next.action, "fix-pack", "ingest_c_blocker_next_action");

  const ingestCPassJson = parseJson(runWorkflow(["ingest", "--from", "C", "--file", cPass, "--json"]).stdout);
  assert.equal(ingestCPassJson.stableStatus, "C_PASS", "ingest_c_pass_stable_status");
  assert.equal(ingestCPassJson.next.action, "done", "ingest_c_pass_next_action");
  assert.equal(ingestCPassJson.pack.command, "done", "ingest_c_pass_pack_command");

  const writeAFix = runWorkflow(["write-pack", "--window", "A", "--state", JSON.stringify({
    status: "B_BLOCKER",
    branch: "feat/v22-admin-ops-console-boundary",
    blocker: "admin ops smoke 没有覆盖普通用户 role surface 边界",
  })]);
  assert.equal(writeAFix.status, 0, "write_a_fix_must_exit_zero");
  assertIncludesAll(writeAFix.stdout, [
    "A fix-pack",
    "admin ops smoke 没有覆盖普通用户 role surface 边界",
    "修复后回复 status: A_FIXED",
    "JSON 摘要",
  ], "write_a_fix_human");

  const writeBReReview = runWorkflow(["write-pack", "--window", "B", "--state", JSON.stringify({
    status: "A_FIXED",
    branch: "feat/v22-admin-ops-console-boundary",
    commit: "222bbbb",
  })]);
  assert.equal(writeBReReview.status, 0, "write_b_rereview_must_exit_zero");
  assertIncludesAll(writeBReReview.stdout, [
    "B re-review-pack",
    "222bbbb",
    "复审修复 commit",
    "JSON 摘要",
  ], "write_b_rereview_human");

  const nextAFixedJson = parseJson(runWorkflow(["next", "--state", JSON.stringify({
    status: "A_FIXED",
    branch: "feat/v22-admin-ops-console-boundary",
    commit: "222bbbb",
  }), "--json"]).stdout);
  assert.equal(nextAFixedJson.stableStatus, "A_FIXED", "next_a_fixed_stable_status");
  assert.equal(nextAFixedJson.next.window, "B", "next_a_fixed_window");
  assert.equal(nextAFixedJson.next.action, "re-review-pack", "next_a_fixed_action");

  const statusJson = parseJson(runWorkflow(["status", "--json"]).stdout);
  assert.equal(statusJson.command, "status", "status_json_command");
  assert.equal(typeof statusJson.branch, "string", "status_json_branch");
  assert.equal(typeof statusJson.worktree, "string", "status_json_worktree");
  assert.equal(typeof statusJson.pendingOwner, "string", "status_json_pending_owner");
  assert.equal(typeof statusJson.nextAction, "string", "status_json_next_action");

  const secretReject = runWorkflow(["ingest", "--from", "A", "--file", path.join(tempRoot, ".env")]);
  assert.notEqual(secretReject.status, 0, "ingest_secret_like_file_must_fail");
  assert(secretReject.stderr.includes("secret_like_reply_file_rejected"), "ingest_secret_like_file_error");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

const source = await readFile(path.join(repoRoot, "scripts/v22-agent-workflow.mjs"), "utf8");
assertNotIncludesAny(source, [
  "writeFile(",
  "tmux",
  "kubectl",
  "live-test",
  "git push",
  "git merge",
  "SecretId",
  "SecretKey",
  ".env",
  "sessionStorage",
  "localStorage",
  "one-person-lab",
  "Langfuse",
  "腾讯云",
  "COS",
], "workflow_orchestrator_source");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_agent_workflow_orchestrator",
  covered: [
    "start_type_packages_and_json_summary",
    "review_pack_branch_base_prompt_and_merge_conditions",
    "c_qa_pack_surface_prompt_and_checks",
    "ingest_a_committed_to_b_review_pack",
    "ingest_b_blocker_to_a_fix_pack",
    "ingest_a_fixed_to_b_re_review_pack",
    "ingest_b_pushed_to_c_qa_pack",
    "ingest_c_blocker_and_c_pass",
    "write_pack_a_fix_and_b_re_review",
    "status_lane_summary",
    "stable_status_enum",
    "owner_worktree_lane_discipline_and_json_fields",
    "no_secret_like_reply_file_no_cloud_no_merge_push_tmux",
    "docs_vibe_coding_updated",
  ],
}, null, 2));
