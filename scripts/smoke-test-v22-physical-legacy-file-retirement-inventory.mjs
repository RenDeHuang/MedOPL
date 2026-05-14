import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const inventoryPath = "docs/recovery/physical-legacy-file-retirement-inventory.md";

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

async function listScriptNames() {
  return readdir(path.join(repoRoot, "scripts"));
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

function inventoryRows(markdown) {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("| `") || line.startsWith("| services/") || line.startsWith("| scripts/"));
}

function assertDecisionRow(markdown, pathOrGroup, decision) {
  const row = inventoryRows(markdown).find((line) => line.includes(pathOrGroup));
  assert(row, `inventory_row_missing:${pathOrGroup}`);
  assert(row.includes(`| ${decision} |`), `inventory_decision_mismatch:${pathOrGroup}:${decision}`);
}

const [inventory, scriptNames] = await Promise.all([
  readRepoFile(inventoryPath),
  listScriptNames(),
]);

for (const phrase of [
  "# MedOPL v22 Physical Legacy File Retirement Inventory",
  "inventory_status: batch_completed_waiting_b_review",
  "physical_delete_batch_status: completed_waiting_b_review",
  "agent_run_mode: physical_delete_goal_driven",
  "run_manifest: `docs/recovery/physical-legacy-file-retirement-run-manifest.json`",
  "next_slice queue",
  "slice-2-legacy-script-archive-delete-boundary",
  "slice-3-observability-runner-physical-retirement-boundary",
  "物理删除 goal",
  "导台",
  "inventory gate",
  "不得跳过导台直接删除",
  "decision values: `delete`, `keep_tombstone`, `archive_reference`, `migrate`, `forbidden_without_auth`, `needs_schema_drop_leaf`",
  "physical_delete_status values: `not_started`, `deleted`, `kept_tombstone`, `archive_reference`, `migrated`, `blocked_without_auth`, `transferred_to_schema_drop_leaf`",
  "| path_or_group | legacy_family | current_zone | current_role | inbound_refs | default_suite_ref | public_surface | schema_or_migration_risk | deploy_or_external_risk | decision | physical_delete_status | required_gate | deletion_branch | stop_condition |",
  "slice-2 truth writeback: completed",
  "slice-3 truth writeback: completed",
  "final slice truth writeback: completed_waiting_b_review",
]) {
  assertIncludes(inventory, phrase, "inventory_required_text");
}

for (const decision of [
  "`delete`",
  "`keep_tombstone`",
  "`archive_reference`",
  "`migrate`",
  "`forbidden_without_auth`",
  "`needs_schema_drop_leaf`",
]) {
  assertIncludes(inventory, decision, "inventory_decision_taxonomy");
}

assertDecisionRow(inventory, "`services/portal/src/routes/resource-order.routes.mjs`", "`keep_tombstone`");
assertDecisionRow(inventory, "`services/portal/src/routes/user-owned-resource.routes.mjs`", "`keep_tombstone`");
assertDecisionRow(inventory, "`services/portal/src/domain/user-owned-resources.mjs`", "`delete`");
assertDecisionRow(inventory, "`services/portal/src/state/portal-user-owned-resource-store.mjs`", "`delete`");
assertDecisionRow(inventory, "`services/portal/src/state/portal-resource-order-store.mjs`", "`keep_tombstone`");
assertDecisionRow(inventory, "`services/portal/src/state/portal-store-schema.mjs` resource-order schema fragments", "`needs_schema_drop_leaf`");
assertDecisionRow(inventory, "`scripts/smoke-test-v19-*`", "`archive_reference`");
assertDecisionRow(inventory, "`scripts/smoke-test-v20*`", "`archive_reference`");
assertDecisionRow(inventory, "`scripts/smoke-test-v21-*`", "`archive_reference`");
assertDecisionRow(inventory, "`scripts/live-test-*`", "`archive_reference`");
assertDecisionRow(inventory, "`infra/opencost/**`", "`forbidden_without_auth`");
assertDecisionRow(inventory, "`compose.langfuse.yaml`", "`archive_reference`");
assertDecisionRow(inventory, "`adapters/resource-provisioner/**`", "`forbidden_without_auth`");
assertDecisionRow(inventory, "`adapters/med-autoscience-runner/**`", "`forbidden_without_auth`");
assertDecisionRow(inventory, "`deploy/**`", "`forbidden_without_auth`");

for (const deletedTarget of [
  "`services/portal/src/domain/user-owned-resources.mjs`",
  "`services/portal/src/state/portal-user-owned-resource-store.mjs`",
]) {
  const row = inventoryRows(inventory).find((line) => line.includes(deletedTarget));
  assert(row.includes("| `deleted` |"), `inventory_physical_delete_status_mismatch:${deletedTarget}`);
  assert(
    row.includes("scripts/smoke-test-v22-physical-delete-user-owned-retired-domain-store.mjs"),
    `inventory_physical_delete_gate_missing:${deletedTarget}`,
  );
}

const familiesWithExistingScripts = [
  ["scripts/smoke-test-v19-", "`scripts/smoke-test-v19-*`"],
  ["scripts/smoke-test-v20", "`scripts/smoke-test-v20*`"],
  ["scripts/smoke-test-v21-", "`scripts/smoke-test-v21-*`"],
  ["scripts/live-test-", "`scripts/live-test-*`"],
];

for (const [prefix, inventoryGroup] of familiesWithExistingScripts) {
  const repoHasFamily = scriptNames.some((name) => `scripts/${name}`.startsWith(prefix));
  if (repoHasFamily) assertIncludes(inventory, inventoryGroup, `inventory_family_coverage:${inventoryGroup}`);
}

for (const forbidden of [
  "TBD",
  "TODO",
  "直接删除所有",
  "允许跳过导台",
  "临时补丁",
  "兜底",
]) {
  assertNotIncludes(inventory, forbidden, "inventory_forbidden_wording");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_physical_legacy_file_retirement_inventory",
  inventoryPath,
  inventoryStatus: "batch_completed_waiting_b_review",
}, null, 2));
