import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const docs = await readFile(path.join(repoRoot, "docs/vibe-coding.md"), "utf8");
assertIncludesAll(docs, [
  "scripts/v22-agent-workflow.mjs",
  "start --type <cleanup|portal-ui|resource-billing|contract|ops-console>",
  "review-pack --branch <branch> --base recovery/platform-v22-trunk",
  "c-qa-pack --surface <resources|workspace|trace|billing|overview>",
  "checkpoint-pack",
  "next --state <json>",
  "不自动 merge",
  "不自动 push",
  "不启动 tmux",
  "不读 secret",
  "不调用真实云",
  "主工作区只用于规划、B 审计、ff-only merge、checkpoint、push、清理",
  "A/C/D 只要会写文件，默认必须在独立 git worktree",
  "一个 worktree 只承载一条 active lane",
  "lane 完成后走 verify -> B review -> absorb or abandon -> cleanup",
  "tmux pane/session 只是执行面，不是 truth",
  "truth 必须进入 repo-tracked contracts/docs/scripts/tests",
  "不提交 tmux session、agent 对话、临时日志、本地状态",
], "vibe_coding_doc");

const startResult = runWorkflow(["start", "--type", "cleanup"]);
assert.equal(startResult.status, 0, "start_cli_must_exit_zero");
assertIncludesAll(startResult.stdout, [
  "A 窗口任务包",
  "B 窗口任务包",
  "C 窗口任务包",
  "下一步建议",
  "不自动 merge",
  "不自动 push",
  "不启动 tmux",
  "不读 secret",
  "不调用真实云",
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
const startPayload = JSON.parse(startJson.stdout);
assert.equal(startPayload.command, "start", "start_json_command");
assert.equal(startPayload.type, "portal-ui", "start_json_type");
assert.equal(startPayload.ok, true, "start_json_ok");
assert.equal(startPayload.packages.A.window, "A", "start_json_a_window");
assert.equal(startPayload.packages.B.window, "B", "start_json_b_window");
assert.equal(startPayload.packages.C.window, "C", "start_json_c_window");
assert.equal(startPayload.packages.A.title.includes("A 窗口任务包"), true, "start_json_a_title");
assert.equal(startPayload.recommendedBranch, "feat/v22-portal-ui-lane", "start_json_recommended_branch");
assert.equal(startPayload.recommendedWorktreePath, "/home/dev/projects/platform-v22.worktrees/portal-ui", "start_json_recommended_worktree_path");
assert.equal(startPayload.workspaceDiscipline.mainWorkspaceWritable, false, "start_json_main_workspace_must_not_be_writable");
assert.equal(startPayload.workspaceDiscipline.bUsesMainWorkspace, true, "start_json_b_uses_main_workspace");
assert.deepEqual(startPayload.workspaceDiscipline.writingLanesUseWorktree, ["A", "C", "D"], "start_json_writing_lanes_worktree");
assert.equal(startPayload.workspaceDiscipline.truthTrackedPaths.includes("docs"), true, "start_json_truth_docs");
assert.equal(startPayload.packages.A.recommendedWorktreePath, "/home/dev/projects/platform-v22.worktrees/portal-ui", "start_json_a_worktree_path");
assert.equal(startPayload.packages.B.workspace, "main", "start_json_b_workspace");
assert.equal(startPayload.packages.C.workspace, "independent-worktree-if-writing", "start_json_c_workspace");
assert.equal(startPayload.disallowedActions.includes("git merge"), true, "start_json_disallowed_merge");
assert.equal(startPayload.disallowedActions.includes("git push"), true, "start_json_disallowed_push");

const reviewResult = runWorkflow(["review-pack", "--branch", "feat/v22-agent-workflow-orchestrator", "--base", "recovery/platform-v22-trunk"]);
assert.equal(reviewResult.status, 0, "review_cli_must_exit_zero");
assertIncludesAll(reviewResult.stdout, [
  "B 审查包",
  "验证命令",
  "合并条件",
  "feat/v22-agent-workflow-orchestrator",
  "recovery/platform-v22-trunk",
  "B 使用主工作区",
  "主工作区不可写",
  "Owner Worktree 纪律",
  "JSON 摘要",
], "review_human_output");

const reviewJson = runWorkflow(["review-pack", "--branch", "feat/v22-agent-workflow-orchestrator", "--base", "recovery/platform-v22-trunk", "--json"]);
assert.equal(reviewJson.status, 0, "review_json_must_exit_zero");
const reviewPayload = JSON.parse(reviewJson.stdout);
assert.equal(reviewPayload.command, "review-pack", "review_json_command");
assert.equal(reviewPayload.branch, "feat/v22-agent-workflow-orchestrator", "review_json_branch");
assert.equal(reviewPayload.base, "recovery/platform-v22-trunk", "review_json_base");
assert.equal(reviewPayload.recommendedWorktreePath, "/home/dev/projects/platform-v22.worktrees/v22-agent-workflow-orchestrator", "review_json_worktree_path");
assert.equal(reviewPayload.workspaceDiscipline.bUsesMainWorkspace, true, "review_json_b_uses_main_workspace");
assert.equal(reviewPayload.workspaceDiscipline.mainWorkspaceWritable, false, "review_json_main_workspace_writable");
assert.equal(Array.isArray(reviewPayload.verificationCommands), true, "review_json_verification_commands");
assert.equal(reviewPayload.mergeConditions.includes("工作区干净"), true, "review_json_merge_condition");

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

const qaJson = runWorkflow(["c-qa-pack", "--surface", "trace", "--json"]);
assert.equal(qaJson.status, 0, "qa_json_must_exit_zero");
const qaPayload = JSON.parse(qaJson.stdout);
assert.equal(qaPayload.command, "c-qa-pack", "qa_json_command");
assert.equal(qaPayload.surface, "trace", "qa_json_surface");
assert.equal(qaPayload.recommendedWorktreePath, "/home/dev/projects/platform-v22.worktrees/c-qa-trace", "qa_json_worktree_path");
assert.equal(qaPayload.workspaceDiscipline.mainWorkspaceWritable, false, "qa_json_main_workspace_must_not_be_writable");
assert.equal(qaPayload.workspaceDiscipline.bUsesMainWorkspace, true, "qa_json_b_uses_main_workspace");
assert.equal(Array.isArray(qaPayload.screenshotRequirements), true, "qa_json_screenshot_requirements");
assert.equal(Array.isArray(qaPayload.boundaryChecks), true, "qa_json_boundary_checks");

const checkpointResult = runWorkflow(["checkpoint-pack"]);
assert.equal(checkpointResult.status, 0, "checkpoint_cli_must_exit_zero");
assertIncludesAll(checkpointResult.stdout, [
  "B push 前 checkpoint 包",
  "不自动 merge",
  "不自动 push",
  "主工作区只用于规划、B 审计、ff-only merge、checkpoint、push、清理",
  "Owner Worktree 纪律",
  "JSON 摘要",
], "checkpoint_human_output");

const checkpointJson = runWorkflow(["checkpoint-pack", "--json"]);
assert.equal(checkpointJson.status, 0, "checkpoint_json_must_exit_zero");
const checkpointPayload = JSON.parse(checkpointJson.stdout);
assert.equal(checkpointPayload.command, "checkpoint-pack", "checkpoint_json_command");
assert.equal(checkpointPayload.workspaceDiscipline.bUsesMainWorkspace, true, "checkpoint_json_b_uses_main_workspace");
assert.equal(checkpointPayload.workspaceDiscipline.mainWorkspaceWritable, false, "checkpoint_json_main_workspace_writable");
assert.equal(Array.isArray(checkpointPayload.checklist), true, "checkpoint_json_checklist");
assert.equal(checkpointPayload.disallowedActions.includes("git push"), true, "checkpoint_json_disallowed_push");

const nextStates = [
  ["A_COMMITTED", "B", "review-pack"],
  ["B_BLOCKED", "A", "fix"],
  ["B_MERGED", "B", "checkpoint-pack"],
  ["B_PUSHED", "B", "收尾"],
  ["C_BLOCKER", "A", "C blocker"],
  ["C_PASS", "B", "checkpoint-pack"],
];

for (const [status, window, snippet] of nextStates) {
  const result = runWorkflow(["next", "--state", JSON.stringify({ status, branch: "feat/v22-agent-workflow-orchestrator" })]);
  assert.equal(result.status, 0, `next_cli_must_exit_zero_${status}`);
  assertIncludesAll(result.stdout, [
    status,
    `窗口 ${window}`,
    snippet,
    "Owner Worktree 纪律",
    "JSON 摘要",
  ], `next_human_output_${status}`);

  const payload = JSON.parse(runWorkflow(["next", "--state", JSON.stringify({ status, branch: "feat/v22-agent-workflow-orchestrator" }), "--json"]).stdout);
  assert.equal(payload.command, "next", `next_json_command_${status}`);
  assert.equal(payload.state.status, status, `next_json_status_${status}`);
  assert.equal(payload.next.window, window, `next_json_window_${status}`);
  assert.equal(typeof payload.next.message, "string", `next_json_message_${status}`);
  assert.equal(payload.workspaceDiscipline.bUsesMainWorkspace, true, `next_json_b_uses_main_workspace_${status}`);
  assert.equal(payload.workspaceDiscipline.mainWorkspaceWritable, false, `next_json_main_workspace_writable_${status}`);
}

const source = await readFile(path.join(repoRoot, "scripts/v22-agent-workflow.mjs"), "utf8");
assertNotIncludesAny(source, [
  "spawnSync(",
  "execFileSync(",
  "node:child_process",
  "readFile(",
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
    "checkpoint_pack_b_push_preflight",
    "next_state_dispatch_for_a_b_c_statuses",
    "owner_worktree_lane_discipline_and_json_fields",
    "no_process_launch_no_secret_io_no_cloud_operations",
    "docs_vibe_coding_updated",
  ],
}, null, 2));
