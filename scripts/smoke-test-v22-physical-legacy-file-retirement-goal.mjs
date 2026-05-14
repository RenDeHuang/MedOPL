import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const goalPath = "docs/recovery/physical-legacy-file-retirement-goal.md";
const inventoryPath = "docs/recovery/physical-legacy-file-retirement-inventory.md";
const legacyBacklogPath = "docs/recovery/legacy-cleanup-backlog.md";
const repoZoningPath = "docs/recovery/repo-zoning.md";

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

const [goal, inventory, legacyBacklog, repoZoning] = await Promise.all([
  readRepoFile(goalPath),
  readRepoFile(inventoryPath),
  readRepoFile(legacyBacklogPath),
  readRepoFile(repoZoningPath),
]);

for (const phrase of [
  "branch: `cleanup/v22-physical-legacy-goal`",
  "model: `gpt-5.4`",
  "temporary physical-deletion goal",
  "物理删除 goal",
  "主路径清退已经完成，不等于物理文件清退完成",
  "本 goal 不写入常驻 product cursor",
  "完成后可由用户删除本 goal 文件或对应分支",
]) {
  assertIncludes(goal, phrase, "goal_identity");
}

for (const phrase of [
  "Step 0: Baseline and Contract Subscription",
  "Step 1: 导台 Physical Inventory",
  "Step 2: Inventory Gate",
  "Step 3: Low-Risk Delete Slice",
  "Step 4: Legacy Script Archive/Delete Slice",
  "Step 5: Portal Tombstone Minimization Slice",
  "Step 6: OpenCost/Langfuse/Runner Physical Retirement Slice",
  "Step 7: Schema/Migration Future Leaf",
  "Step 8: Completion Truth and Temporary Goal Removal",
]) {
  assertIncludes(goal, phrase, "goal_steps");
}

for (const phrase of [
  "`delete`",
  "`keep_tombstone`",
  "`archive_reference`",
  "`migrate`",
  "`forbidden_without_auth`",
  "`needs_schema_drop_leaf`",
]) {
  assertIncludes(goal, phrase, "decision_taxonomy");
}

for (const phrase of [
  "不得读取 secret、`.env`、kubeconfig、token、SecretId、SecretKey、SSH private key",
  "不得调用真实云、COS、Langfuse、one-person-lab 或外部生产 API",
  "不得执行 build/push、kubectl、live-test 或真实 runtime smoke",
  "不得修改 `deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*` 或 upstream",
  "不得删除 public 410 tombstone",
  "不得 drop schema、删除 migration collection 或改写历史账本",
]) {
  assertIncludes(goal, phrase, "authorization_boundary");
}

for (const phrase of [
  "可自治",
  "必须停下来让用户确认",
  "每个 deletion slice 必须 deletion-only",
  "先 RED gate，再删除，再 GREEN gate",
  "B ff-only 吸收并 push 后才允许更新物理清退完成事实",
]) {
  assertIncludes(goal, phrase, "autonomy_rules");
}

for (const phrase of [
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs",
  "node scripts/smoke-test-v22-cleanup-completion-truth.mjs",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "git diff --check -- docs/recovery scripts",
]) {
  assertIncludes(goal, phrase, "verification_commands");
}

for (const phrase of [
  "本临时 goal 不要求在分支内运行 `node scripts/smoke-test-v22-goal-state-consistency.mjs`",
  "因为该 gate 要求 runtime branch 是 `cleanup/v22-cleanup-completion-truth` 或 `recovery/platform-v22-trunk`",
  "本分支不得为了通过该 gate 改写 `docs/recovery/v22-goal-current.json`",
]) {
  assertIncludes(goal, phrase, "temporary_goal_state_boundary");
}

for (const phrase of [
  "physical-legacy-file-retirement-inventory",
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
  "physical_legacy_file_retirement_inventory_missing",
  "unadjudicated_legacy_file",
  "active_reference_to_delete_candidate",
  "forbidden_path_without_auth",
  "public_tombstone_delete_requires_user_confirmation",
]) {
  assertIncludes(goal, phrase, "future_gate_requirements");
}

for (const phrase of [
  "## Agent Run Workflow",
  "agent_run_mode: physical_delete_goal_driven",
  "A1: sync-baseline",
  "A2: read-goal-and-inventory",
  "A3: select-one-slice",
  "A4: red-gate",
  "A5: apply-deletion-only-change",
  "A6: green-gates",
  "A7: writeback",
  "A8: B-review-handoff",
  "不得跳过导台直接删除",
]) {
  assertIncludes(goal, phrase, "agent_workflow");
}

for (const phrase of [
  "# MedOPL v22 Physical Legacy File Retirement Inventory",
  "inventory_status: first_delete_slice_applied",
  "decision values: `delete`, `keep_tombstone`, `archive_reference`, `migrate`, `forbidden_without_auth`, `needs_schema_drop_leaf`",
  "physical_delete_status values: `not_started`, `deleted`, `kept_tombstone`, `archive_reference`, `migrated`, `blocked_without_auth`, `transferred_to_schema_drop_leaf`",
  "| path_or_group | legacy_family | current_zone | current_role | inbound_refs | default_suite_ref | public_surface | schema_or_migration_risk | deploy_or_external_risk | decision | physical_delete_status | required_gate | deletion_branch | stop_condition |",
  "`services/portal/src/routes/resource-order.routes.mjs`",
  "`services/portal/src/routes/user-owned-resource.routes.mjs`",
  "`scripts/smoke-test-v19-*`",
  "`scripts/smoke-test-v20*`",
  "`scripts/smoke-test-v21-*`",
  "`scripts/live-test-*`",
  "`infra/opencost/**`",
  "`compose.langfuse.yaml`",
  "`adapters/resource-provisioner/**`",
  "`adapters/med-autoscience-runner/**`",
  "`deploy/**`",
]) {
  assertIncludes(inventory, phrase, "inventory_bootstrap");
}

for (const phrase of [
  "物理删除 goal",
  "导台",
  "inventory gate",
  "delete candidate",
  "keep_tombstone",
  "forbidden_without_auth",
  "needs_schema_drop_leaf",
]) {
  assertIncludes(inventory, phrase, "inventory_policy_terms");
}

for (const phrase of [
  "cleanup 分支 1：建立裁定台账。",
  "本 backlog 从 `docs/recovery/repo-zoning.md` 的 Zone 2/Zone 3 候选中拆出后续专题清退队列。",
  "每个专题先定义 smoke/gate，再执行 rewrite、tombstone、archive 或 delete。",
]) {
  assertIncludes(legacyBacklog, phrase, "legacy_backlog_sample_contract");
}

for (const phrase of [
  "本台账把仓库上下文裁定为四个区",
  "Zone 2: Migration Observation Surface",
  "Zone 3: Historical Archive Surface",
  "Zone 4: Authorization Forbidden Surface",
  "不在本分支 delete files in this branch",
]) {
  assertIncludes(repoZoning, phrase, "repo_zoning_sample_contract");
}

assertNotIncludes(goal, "TODO", "goal_no_todo");
assertNotIncludes(goal, "TBD", "goal_no_tbd");
assertNotIncludes(goal, "临时补丁", "goal_no_temporary_patch");
assertNotIncludes(goal, "兜底", "goal_no_fallback_wording");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_physical_legacy_file_deletion_goal",
  goalPath,
  inventoryPath,
  branch: "cleanup/v22-physical-legacy-goal",
  model: "gpt-5.4",
}, null, 2));
