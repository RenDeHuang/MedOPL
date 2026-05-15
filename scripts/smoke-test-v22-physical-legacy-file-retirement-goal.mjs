import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const goalPath = "docs/recovery/physical-legacy-file-retirement-goal.md";
const inventoryPath = "docs/recovery/physical-legacy-file-retirement-inventory.md";
const manifestPath = "docs/recovery/physical-legacy-file-retirement-run-manifest.json";

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

const [goal, inventory, manifestSource] = await Promise.all([
  readRepoFile(goalPath),
  readRepoFile(inventoryPath),
  readRepoFile(manifestPath),
]);
const manifest = JSON.parse(manifestSource);

for (const phrase of [
  "# MedOPL v22 Strict Monolith Legacy Retirement Goal",
  "branch: `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement`",
  "model: `gpt-5.4`",
  "strict monolith cleanup goal",
  "先写清 v22 理想形态与差距，再清故事线，最后分 slice 物理删除旧模块、旧接口、旧测试、旧脚本、旧部署资产和旧兼容面",
  "physical_delete_batch_status: strict_monolith_retirement_completed",
]) {
  assertIncludes(goal, phrase, "goal_identity");
}

for (const phrase of [
  "MedOPL 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台",
  "Portal 是托管科研工作台 control plane",
  "用户购买套餐、算力、存储和运行环境",
  "平台负责开通、隔离、计费、审计和释放",
  "OPL runtime 负责科研工作区执行、文件、任务和结果",
]) {
  assertIncludes(goal, phrase, "goal_ideal_state");
}

for (const phrase of [
  "`user-owned` 不是主线",
  "`resource-order` 不是主线",
  "v19/v20/v21 legacy smoke 不是当前验证体系",
  "old runner/provisioner 不是 v22 Runtime Bridge / Gateway 主线",
  "OpenCost/Langfuse 旧默认叙事不是当前产品事实源",
  "后续 feature leaf 碰到过时模块、接口、测试或兼容面时，必须同 leaf 清理退役，或拆出 cleanup leaf 后再继续",
]) {
  assertIncludes(goal, phrase, "goal_gap_policy");
}

for (const phrase of [
  "`delete`: 无 active v22 reason，必须物理删除",
  "`migrate`: 仍有业务价值，但必须先改名、改边界、改合同并进入 v22 active surface",
  "`retain_active_v22`: 只有明确属于 active v22 Portal/Gateway/Runtime Bridge、billing aggregator 或 sanitized trace metadata implementation boundary 的文件可保留",
  "`blocker`: 只有触发硬停止条件时使用",
]) {
  assertIncludes(goal, phrase, "decision_taxonomy");
}

for (const phrase of [
  "不读取 secret、`.env`、kubeconfig、token、SecretId、SecretKey、SSH private key",
  "不调用真实云、COS、Langfuse、one-person-lab 或外部生产 API",
  "不执行 build/push、kubectl、live-test 或真实 runtime smoke",
  "不连接真实 DB，不执行真实 DB migration",
  "不修改 `.sentrux/*` 或 upstream",
  "本次允许删除旧 public retired route shell、v19/v20/v21 legacy smoke、旧 user-owned/resource-order 兼容面，以及不属于 v22 active surface 的旧 deploy/adapters/infra 资产",
]) {
  assertIncludes(goal, phrase, "authorization_boundary");
}

for (const slice of [
  "Slice A: Story And Inventory Policy Retirement",
  "Slice B: User-Owned And Resource-Order Compatibility Surface Deletion",
  "Slice C: Legacy Script Deletion",
  "Slice D: Retired Adapter Deploy And Infra Asset Deletion",
  "Slice E: Legacy Schema And Store Remnant Retirement",
]) {
  assertIncludes(goal, slice, "goal_slices");
}

for (const phrase of [
  "先 RED gate",
  "删除前用 `rg` / import scan 证明无 active v22 reference",
  "删除后更新 inventory、gap matrix、status truth",
  "单独 commit",
  "不把失败 gate 改弱成兼容通过",
]) {
  assertIncludes(goal, phrase, "per_slice_rules");
}

for (const command of [
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
  "node scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs",
  "node scripts/smoke-test-v22-retire-user-owned-primary-path.mjs",
  "node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  "node scripts/smoke-test-v22-cleanup-completion-truth.mjs",
  "node scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "git diff --check -- docs/recovery docs/contracts scripts services deploy adapters infra",
]) {
  assertIncludes(goal, command, "verification_commands");
}

for (const phrase of [
  "inventory_status: strict_monolith_cleanup_completed",
  "decision values: `delete`, `migrate`, `retain_active_v22`, `blocker`",
  "slice-e-legacy-schema-store-retirement",
]) {
  assertIncludes(inventory, phrase, "inventory_alignment");
}

assert.equal(manifest.manifest_role, "strict_monolith_legacy_retirement_run_manifest", "manifest_role_mismatch");
assert.equal(manifest.working_branch, "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement", "manifest_branch_mismatch");
assert.equal(manifest.current_status, "strict_monolith_retirement_completed", "manifest_status_mismatch");

for (const forbidden of [
  "keep_tombstone",
  "archive_reference",
  "tombstone_only",
  "archive_only",
  "blocked_without_auth",
  "forbidden_without_auth",
  "public_tombstone_delete_requires_user_confirmation",
  "schema_or_migration_delete_without_schema_drop_leaf",
  "临时补丁",
  "兜底",
]) {
  assertNotIncludes(goal, forbidden, "goal_forbidden_wording");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_strict_monolith_legacy_retirement_goal",
  goalPath,
  inventoryPath,
  manifestPath,
  branch: "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement",
  model: "gpt-5.4",
}, null, 2));
