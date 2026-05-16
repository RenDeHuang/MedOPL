import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const inventoryPath = "docs/recovery/physical-legacy-file-retirement-inventory.md";

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
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

const inventory = await readRepoFile(inventoryPath);

for (const phrase of [
  "# MedOPL v22 Physical Legacy File Retirement Inventory",
  "inventory_status: strict_monolith_cleanup_completed",
  "physical_delete_batch_status: strict_monolith_retirement_completed",
  "residual_cleanup_status:",
  "zero_compat_active_surface_status:",
  "agent_run_mode: strict_monolith_legacy_retirement",
  "run_manifest: `docs/recovery/physical-legacy-file-retirement-run-manifest.json`",
  "strict monolith cleanup",
  "git history 已足够保存历史",
  "active repo 不再保留旧兼容面、旧测试、旧 deploy/adapters/infra 资产或旧 public 退役壳",
  "decision values: `delete`, `migrate`, `retain_active_v22`, `blocker`",
  "physical_delete_status values: `not_started`, `deleted`, `migrated_to_active_v22`, `retained_active_v22`, `blocked`",
  "completed_slice queue",
  "slice-a-strict-monolith-policy",
  "slice-b-user-owned-resource-order-compat-delete",
  "slice-c-legacy-script-delete",
  "slice-d-retired-adapter-deploy-infra-delete",
  "slice-e-legacy-schema-store-retirement",
  "slice-g-residual-legacy-test-anchor-retirement",
  "后续 feature leaf 碰到过时模块、接口、测试或兼容面时，必须同 leaf 清理退役，或拆出 cleanup leaf 后再继续",
  "| path_or_group | legacy_family | current_zone | current_role | inbound_refs | default_suite_ref | public_surface | schema_or_migration_risk | deploy_or_external_risk | decision | physical_delete_status | required_gate | deletion_branch | stop_condition |",
]) {
  assertIncludes(inventory, phrase, "inventory_required_text");
}

for (const decision of [
  "`delete`",
  "`migrate`",
  "`retain_active_v22`",
  "`blocker`",
]) {
  assertIncludes(inventory, decision, "inventory_decision_taxonomy");
}

assertDecisionRow(inventory, "`services/portal/src/routes/resource-order.routes.mjs`", "`delete`");
assertDecisionRow(inventory, "`services/portal/src/routes/user-owned-resource.routes.mjs`", "`delete`");
assertDecisionRow(inventory, "`services/portal/src/domain/user-owned-resources.mjs`", "`delete`");
assertDecisionRow(inventory, "`services/portal/src/state/portal-user-owned-resource-store.mjs`", "`delete`");
assertDecisionRow(inventory, "`services/portal/src/state/portal-resource-order-store.mjs`", "`delete`");
assertDecisionRow(inventory, "`services/portal/src/state/portal-store-schema.mjs` resource-order schema fragments", "`delete`");
assertDecisionRow(inventory, "`services/portal/src/integrations/resource-provisioner-client.mjs`", "`delete`");
assertDecisionRow(inventory, "`scripts/smoke-test-v19-*`", "`delete`");
assertDecisionRow(inventory, "`scripts/smoke-test-v20*`", "`delete`");
assertDecisionRow(inventory, "`scripts/smoke-test-v21-*`", "`delete`");
assertDecisionRow(inventory, "`scripts/live-test-*`", "`delete`");
assertDecisionRow(inventory, "`old non-v22 billing/portal smoke scripts with resource-order or retired provisioner semantics`", "`delete`");
assertDecisionRow(inventory, "`scripts/start-billing-live.mjs`", "`delete`");
assertDecisionRow(inventory, "`infra/opencost/**`", "`delete`");
assertDecisionRow(inventory, "`compose.langfuse.yaml`", "`delete`");
assertDecisionRow(inventory, "`compose.demo.yaml`", "`delete`");
assertDecisionRow(inventory, "`services/portal/src/integrations/langfuse-trace-client.mjs`", "`retain_active_v22`");
assertDecisionRow(inventory, "`services/opl-runtime-bridge/src/langfuse-publisher.mjs`", "`retain_active_v22`");
assertDecisionRow(inventory, "`adapters/resource-provisioner/**`", "`delete`");
assertDecisionRow(inventory, "`adapters/med-autoscience-runner/**`", "`delete`");
assertDecisionRow(inventory, "`adapters/cloud-provisioner/**`", "`delete`");
assertDecisionRow(inventory, "`adapters/shared/**`", "`delete`");
assertDecisionRow(inventory, "`deploy/tke-package/**` and old runner/provisioner deploy assets", "`delete`");
assertDecisionRow(inventory, "`infra/kubernetes/**`, `infra/codex-runtime/**`, `infra/production-hardening/**`", "`delete`");
assertDecisionRow(inventory, "`old portal resource-order/provisioner scripts, v13 scripts, runner fixtures, v19/v20 helper libs`", "`delete`");
assertDecisionRow(inventory, "`residual non-v22 Portal/Billing smoke anchors and local start/install helper remnants`", "`delete`");
assertDecisionRow(inventory, "`adapters/billing-aggregator/**`", "`delete`");
assertDecisionRow(inventory, "`deploy/local/dockerfiles/portal.Dockerfile`, `deploy/local/dockerfiles/opl-web-gateway.Dockerfile`, `deploy/local/dockerfiles/opl-runtime-bridge.Dockerfile`", "`delete`");
assertDecisionRow(inventory, "`scripts/*live*`, `scripts/*canary*`, `scripts/*authorized-deploy*`, `scripts/*authorized-resource-lifecycle*` v22 executable surfaces", "`delete`");
assertDecisionRow(inventory, "`services/opl-runtime-bridge/src/*` retired resource-order and user-owned runtime identifier hits", "`delete`");

for (const forbidden of [
  "keep_tombstone",
  "archive_reference",
  "tombstone_only",
  "archive_only",
  "blocked_without_auth",
  "forbidden_without_auth",
  "public_tombstone_delete_requires_user_confirmation",
  "schema_or_migration_delete_without_schema_drop_leaf",
  "TBD",
  "TODO",
  "临时补丁",
  "兜底",
]) {
  assertNotIncludes(inventory, forbidden, "inventory_forbidden_wording");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_strict_monolith_physical_legacy_file_retirement_inventory",
  inventoryPath,
  inventoryStatus: "strict_monolith_cleanup_completed",
}, null, 2));
