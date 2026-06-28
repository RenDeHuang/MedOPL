import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function ids(items) {
  return new Set((items ?? []).map((item) => String(item?.id || item?.goal_id || "").trim()).filter(Boolean));
}

const [current, activeTruth, productTruth, historyTruth, manifest] = await Promise.all([
  readJson("tests/fixtures/v22/goal-current.json"),
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/product/README.md"),
  readRepoFile("docs/history/README.md"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
]);

const maturity = current.commercial_production_maturity_gap;
assert(maturity, "commercial_production_maturity_gap_missing");
assert.equal(maturity.schema_version, 1, "maturity_gap_schema_version_mismatch");
assert.equal(maturity.goal_id, "goal-commercial-production-maturity-gap-audit", "maturity_gap_goal_id_mismatch");
assert.equal(maturity.status, "temporary_gap_matrix", "maturity_gap_status_mismatch");
assert.equal(maturity.business_closure_goal_completed, true, "business_closure_must_be_completed_before_maturity_gap");
assert.equal(maturity.reference_scope?.sub2api, "production_packaging_structure_reference_only", "sub2api_reference_scope_mismatch");
assert.equal(maturity.reference_scope?.opl_ordinary_path, "consumer_bridge_boundary_reference_only", "opl_reference_scope_mismatch");

for (const claim of [
  "authorized commercial business-flow cloud canary passed",
  "internal credit + billing ledger + statement reconciliation + release/destroy/stop billing passed",
  "Commercial Launch UI absorbed",
]) {
  assert(maturity.canClaim?.includes(claim), `maturity_gap_can_claim_missing:${claim}`);
  assert(activeTruth.includes(claim), `active_truth_can_claim_missing:${claim}`);
}

for (const claim of [
  "external PSP settlement",
  "real payment completed",
  "refund / invoice / tax / compliance",
  "unscoped full production",
  "all users/all tenants",
  "SLA/multi-region/ongoing authorization",
]) {
  assert(maturity.cannotClaim?.includes(claim), `maturity_gap_cannot_claim_missing:${claim}`);
  assert(activeTruth.includes(claim), `active_truth_cannot_claim_missing:${claim}`);
}

const expectedGapIds = [
  "payment_psp_admin_payment_api",
  "deploy_package_compose_install_upgrade_uninstall_systemd",
  "env_config_secrets_admin_bootstrap_setup_wizard",
  "release_workflow_version_changelog_image_tag_rollback",
  "ci_security_dependency_secret_scan",
  "operations_docs_troubleshooting_backup_migration",
  "billing_incident_stop_billing_reconciliation_storage_destroy_protection",
  "ops_data_management_sidecar",
  "opl_webui_consumer_bridge_deeplink_projection_boundary",
];
const gapIds = ids(maturity.gap_matrix);
for (const expected of expectedGapIds) {
  assert(gapIds.has(expected), `maturity_gap_matrix_missing:${expected}`);
}

for (const gap of maturity.gap_matrix ?? []) {
  assert.equal(gap.status, "gap", `maturity_gap_status_must_remain_gap:${gap.id}`);
  assert.equal(gap.repo_change_required, true, `maturity_gap_repo_change_required:${gap.id}`);
  assert(Array.isArray(gap.canClaim) && gap.canClaim.length > 0, `maturity_gap_can_claim_required:${gap.id}`);
  assert(Array.isArray(gap.cannotClaim) && gap.cannotClaim.length > 0, `maturity_gap_cannot_claim_required:${gap.id}`);
  assert.equal(
    gap.cannotClaim.includes("business closure not completed"),
    false,
    `maturity_gap_must_not_reopen_business_closure:${gap.id}`,
  );
}

const roadmapIds = ids(maturity.recommended_goal_roadmap);
assert(roadmapIds.has("goal-commercial-payment-admin-api-maturity"), "roadmap_first_payment_admin_goal_missing");
assert.equal(maturity.next_recommended_goal, "goal-commercial-payment-admin-api-maturity", "maturity_next_goal_mismatch");
assert.equal(current.goal_lifecycle?.next_recommended_goal, maturity.next_recommended_goal, "goal_lifecycle_next_goal_must_follow_maturity_gap");
assert.equal(
  current.latest_landed_closeout?.next_recommended_goal,
  maturity.next_recommended_goal,
  "latest_closeout_next_goal_must_follow_maturity_gap",
);

const completedGoal = current.goal_lifecycle?.completed_goals?.find((goal) => goal.goal_id === "goal-commercial-production-maturity-gap-audit");
if (completedGoal) {
  assert.equal(completedGoal.status, "completed_retired", "maturity_gap_completed_goal_status_mismatch");
}

assert(productTruth.includes("commercial production maturity gap"), "product_truth_maturity_gap_pointer_missing");
assert(historyTruth.includes("goal-commercial-production-maturity-gap-audit"), "history_maturity_gap_closeout_missing");

const productSuite = manifest.suites?.find((suite) => suite.id === "product");
assert(
  productSuite?.commands?.includes("node tests/product/product-test-v22-commercial-production-maturity-gap-audit.mjs"),
  "product_suite_must_run_maturity_gap_test",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_commercial_production_maturity_gap_audit",
  gapCount: maturity.gap_matrix.length,
  nextRecommendedGoal: maturity.next_recommended_goal,
}, null, 2));
