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

const [current, activeTruth, productTruth, historyTruth, manifest, releaseBoundary, composeProduct, envDemoTemplate, deliveryTruth] = await Promise.all([
  readJson("tests/fixtures/v22/goal-current.json"),
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/product/README.md"),
  readRepoFile("docs/history/README.md"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readJson("contracts/medopl-release-boundary.json"),
  readJson("compose.product.yaml"),
  readRepoFile(".env.demo.template"),
  readRepoFile("docs/delivery/README.md"),
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

const figmaUiBoundary =
  "Commercial Launch UI absorbed means repo-native resource-control information architecture and copy were absorbed; it does not claim the approved Figma Make UI is high-fidelity replaced or rollout-complete.";
assert(
  maturity.ui_boundary?.includes(figmaUiBoundary),
  "maturity_gap_ui_boundary_must_distinguish_repo_absorption_from_figma_make_replacement",
);
assert(activeTruth.includes(figmaUiBoundary), "active_truth_ui_boundary_missing");
assert(productTruth.includes(figmaUiBoundary), "product_truth_ui_boundary_missing");
assert(historyTruth.includes(figmaUiBoundary), "history_truth_ui_boundary_missing");

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
  if (gap.id === "payment_psp_admin_payment_api") {
    assert.equal(gap.status, "completed_retired", "payment_admin_gap_must_be_completed_retired_after_maturity_goal");
    assert.equal(
      gap.closeout_goal,
      "goal-commercial-payment-admin-api-maturity",
      "payment_admin_gap_closeout_goal_mismatch",
    );
    assert.equal(
      gap.payment_boundary,
      "admin_credit_internal_mode_only_future_psp_contract_without_real_settlement_claim",
      "payment_admin_gap_boundary_mismatch",
    );
    assert(Array.isArray(gap.implementation_roadmap) && gap.implementation_roadmap.length >= 7, "payment_admin_implementation_roadmap_missing");
  } else if (gap.id === "deploy_package_compose_install_upgrade_uninstall_systemd") {
    assert.equal(gap.status, "completed_retired", "install_package_gap_must_be_completed_retired_after_maturity_goal");
    assert.equal(
      gap.closeout_goal,
      "goal-commercial-ops-install-package-maturity",
      "install_package_gap_closeout_goal_mismatch",
    );
  } else if (gap.id === "env_config_secrets_admin_bootstrap_setup_wizard") {
    assert.equal(gap.status, "completed_retired", "owner_bootstrap_gap_must_be_completed_retired_after_maturity_goal");
    assert.equal(
      gap.closeout_goal,
      "goal-commercial-owner-bootstrap-setup-wizard",
      "owner_bootstrap_gap_closeout_goal_mismatch",
    );
  } else {
    assert.equal(gap.status, "gap", `maturity_gap_status_must_remain_gap:${gap.id}`);
  }
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
assert(roadmapIds.has("goal-commercial-payment-admin-api-maturity"), "roadmap_payment_admin_goal_missing");
assert(roadmapIds.has("goal-commercial-ops-install-package-maturity"), "roadmap_next_install_package_goal_missing");
assert(roadmapIds.has("goal-commercial-owner-bootstrap-setup-wizard"), "roadmap_owner_bootstrap_goal_missing");
assert(roadmapIds.has("goal-commercial-release-metadata-rollback-maturity"), "roadmap_release_metadata_goal_missing");
const paymentRoadmapEntry = (maturity.recommended_goal_roadmap ?? []).find((goal) => goal.goal_id === "goal-commercial-payment-admin-api-maturity");
assert.equal(paymentRoadmapEntry?.status, "completed_retired", "roadmap_payment_admin_goal_must_be_completed_retired");
assert.equal(maturity.next_recommended_goal, "goal-commercial-release-metadata-rollback-maturity", "maturity_next_goal_mismatch");
assert.equal(
  current.goal_lifecycle?.next_recommended_goal,
  "goal-commercial-release-metadata-rollback-maturity",
  "goal_lifecycle_next_goal_must_follow_owner_bootstrap_closeout",
);
assert.equal(
  current.nextAuthorizationPrompt?.runIdHint,
  "commercial-release-metadata-rollback-maturity",
  "next_authorization_prompt_must_point_to_release_metadata_rollback",
);
assert(
  current.nextAuthorizationPrompt?.prompt?.includes("goal-commercial-release-metadata-rollback-maturity"),
  "next_authorization_prompt_must_name_release_metadata_rollback_goal",
);
assert.equal(
  current.nextAuthorizationPrompt?.prompt?.includes("推进 goal-commercial-owner-bootstrap-setup-wizard"),
  false,
  "next_authorization_prompt_must_not_recommend_retired_owner_bootstrap_goal",
);
assert.equal(
  productTruth.includes("下一步推荐进入 `goal-commercial-ops-install-package-maturity`"),
  false,
  "product_truth_must_not_recommend_retired_install_package_goal",
);
assert(
  productTruth.includes("goal-commercial-release-metadata-rollback-maturity"),
  "product_truth_must_point_to_release_metadata_rollback_next_goal",
);
assert(
  activeTruth.includes("umbrella product spine"),
  "active_truth_must_explain_current_cursor_as_umbrella_product_spine",
);
assert.equal(
  current.goal_lifecycle?.completed_goals?.some((goal) => goal.goal_id === current.current_cursor),
  false,
  "current_cursor_must_not_be_completed_goal",
);
assert.equal(
  current.goal_lifecycle?.completed_goals?.some((goal) => goal.goal_id === current.goal_lifecycle?.next_recommended_goal),
  false,
  "next_recommended_goal_must_not_be_completed_goal",
);

const completedGoal = current.goal_lifecycle?.completed_goals?.find((goal) => goal.goal_id === "goal-commercial-production-maturity-gap-audit");
if (completedGoal) {
  assert.equal(completedGoal.status, "completed_retired", "maturity_gap_completed_goal_status_mismatch");
}
const paymentCompletedGoal = current.goal_lifecycle?.completed_goals?.find((goal) => goal.goal_id === "goal-commercial-payment-admin-api-maturity");
assert.equal(paymentCompletedGoal?.status, "completed_retired", "payment_admin_completed_goal_status_mismatch");

const installPackageGap = (maturity.gap_matrix ?? []).find((gap) => gap.id === "deploy_package_compose_install_upgrade_uninstall_systemd");
assert.equal(installPackageGap?.status, "completed_retired", "install_package_gap_must_be_completed_retired");
assert.equal(installPackageGap?.closeout_goal, "goal-commercial-ops-install-package-maturity", "install_package_gap_closeout_goal_mismatch");
const installRoadmapEntry = (maturity.recommended_goal_roadmap ?? []).find((goal) => goal.goal_id === "goal-commercial-ops-install-package-maturity");
assert.equal(installRoadmapEntry?.verification_lane, "local_dry_run_no_cloud", "install_package_roadmap_lane_mismatch");
assert.equal(installRoadmapEntry?.status, "completed_retired", "install_package_roadmap_status_mismatch");
const ownerBootstrapGap = (maturity.gap_matrix ?? []).find((gap) => gap.id === "env_config_secrets_admin_bootstrap_setup_wizard");
assert.equal(ownerBootstrapGap?.status, "completed_retired", "owner_bootstrap_gap_must_be_completed_retired");
assert.equal(ownerBootstrapGap?.closeout_goal, "goal-commercial-owner-bootstrap-setup-wizard", "owner_bootstrap_gap_closeout_goal_mismatch");
const ownerBootstrapRoadmapEntry = (maturity.recommended_goal_roadmap ?? []).find((goal) => goal.goal_id === "goal-commercial-owner-bootstrap-setup-wizard");
assert.equal(ownerBootstrapRoadmapEntry?.verification_lane, "local_ui_backend_no_cloud", "owner_bootstrap_roadmap_lane_mismatch");
assert.equal(ownerBootstrapRoadmapEntry?.status, "completed_retired", "owner_bootstrap_roadmap_status_mismatch");

const packageBoundary = releaseBoundary.medopl_release_boundary?.medopl_deploy_install_package_maturity;
assert(packageBoundary, "deploy_install_package_maturity_contract_missing");
assert.equal(packageBoundary.current_mode, "local_standalone_package_boundary_no_cloud_execution", "deploy_install_package_current_mode_mismatch");
for (const surface of [
  "deploy_package",
  "env_config_example",
  "compose_local",
  "compose_standalone",
  "install",
  "upgrade",
  "uninstall",
  "systemd_service_example",
  "secret_generation",
  "admin_bootstrap",
  "setup_wizard_future_boundary",
]) {
  assert(packageBoundary.required_surfaces?.includes(surface), `deploy_install_package_surface_missing:${surface}`);
}
assert.equal(packageBoundary.must_not_touch?.includes("deploy/medopl-cloud/medopl.k8s.json"), true, "cloud_rollout_path_must_be_protected");
assert.equal(packageBoundary.cannot_claim?.includes("cloud deploy executed"), true, "install_package_cannot_claim_cloud_deploy_missing");

assert(composeProduct["x-medopl-package-maturity"], "compose_package_maturity_extension_missing");
assert(composeProduct["x-medopl-package-maturity"].profiles?.includes("standalone"), "compose_standalone_profile_missing");
assert(composeProduct["x-medopl-package-maturity"].lifecycle_actions?.includes("install"), "compose_install_action_missing");
assert(composeProduct["x-medopl-package-maturity"].lifecycle_actions?.includes("upgrade"), "compose_upgrade_action_missing");
assert(composeProduct["x-medopl-package-maturity"].lifecycle_actions?.includes("uninstall"), "compose_uninstall_action_missing");

for (const envName of [
  "MEDOPL_PACKAGE_PROFILE",
  "MEDOPL_INSTALL_ROOT",
  "MEDOPL_SYSTEMD_SERVICE",
  "MEDOPL_SECRET_GENERATION_MODE",
  "MEDOPL_ADMIN_BOOTSTRAP_MODE",
  "MEDOPL_SETUP_WIZARD_MODE",
]) {
  assert(composeProduct["x-medopl-package-maturity"].env_config_example_keys?.includes(envName), `compose_env_config_key_missing:${envName}`);
  assert(deliveryTruth.includes(envName), `delivery_env_config_key_missing:${envName}`);
}
for (const secretLine of envDemoTemplate.split("\n").filter((line) => /(?:SECRET|TOKEN|PASSWORD)=/u.test(line) && !line.startsWith("#"))) {
  const [, value = ""] = secretLine.split("=");
  assert.equal(value.trim(), "", `env_demo_must_not_ship_secret_default:${secretLine}`);
}

assert(deliveryTruth.includes("MedOPL Local / Standalone Package Maturity"), "delivery_package_maturity_section_missing");
assert(deliveryTruth.includes("install / upgrade / uninstall"), "delivery_install_upgrade_uninstall_boundary_missing");
assert(deliveryTruth.includes("systemd service example"), "delivery_systemd_example_missing");

const setupBoundary = releaseBoundary.medopl_release_boundary?.medopl_owner_bootstrap_setup_wizard_maturity;
assert(setupBoundary, "owner_bootstrap_setup_wizard_contract_missing");
assert.equal(setupBoundary.current_mode, "local_first_run_setup_boundary_no_secret_read_no_cloud", "owner_bootstrap_current_mode_mismatch");
for (const surface of [
  "owner_admin_initial_account_bootstrap",
  "admin_password_secret_generation_boundary",
  "first_run_setup_flow",
  "config_validation",
  "setup_completed_marker",
  "install_package_setup_handoff",
]) {
  assert(setupBoundary.required_surfaces?.includes(surface), `owner_bootstrap_surface_missing:${surface}`);
}
assert.equal(setupBoundary.secret_policy?.raw_secret_read, "forbidden", "owner_bootstrap_must_forbid_raw_secret_read");
assert.equal(setupBoundary.secret_policy?.generated_secret_output, ".runtime or operator secret store only", "owner_bootstrap_secret_sink_mismatch");
assert.equal(setupBoundary.config_validation?.fail_closed, true, "owner_bootstrap_config_validation_must_fail_closed");
assert.equal(setupBoundary.setup_completed_marker?.location, "operator env file or backend setup state only", "owner_bootstrap_marker_location_mismatch");
assert.equal(setupBoundary.must_not_claim?.includes("external PSP settlement"), true, "owner_bootstrap_cannot_claim_psp_missing");
assert.equal(setupBoundary.must_not_claim?.includes("production complete"), true, "owner_bootstrap_cannot_claim_production_missing");

const setupMaturity = composeProduct["x-medopl-setup-wizard-maturity"];
assert(setupMaturity, "compose_setup_wizard_maturity_extension_missing");
assert.equal(setupMaturity.owner_admin_bootstrap, "required_before_runtime_commercial_operations", "compose_owner_bootstrap_policy_mismatch");
assert(setupMaturity.config_validation_required?.includes("PORTAL_ADMIN_EMAIL"), "compose_setup_validation_admin_email_missing");
assert(setupMaturity.config_validation_required?.includes("PORTAL_ADMIN_PASSWORD"), "compose_setup_validation_admin_password_missing");
assert(setupMaturity.config_validation_required?.includes("MEDOPL_SETUP_COMPLETED"), "compose_setup_validation_marker_missing");
assert.equal(setupMaturity.secret_generation_boundary, "operator_generated_no_raw_secret_in_git", "compose_setup_secret_boundary_mismatch");

for (const envName of [
  "MEDOPL_OWNER_BOOTSTRAP_EMAIL",
  "MEDOPL_OWNER_BOOTSTRAP_PASSWORD",
  "MEDOPL_SETUP_COMPLETED",
  "MEDOPL_SETUP_MARKER_PATH",
]) {
  assert(deliveryTruth.includes(envName), `delivery_setup_env_key_missing:${envName}`);
}
assert(deliveryTruth.includes("MedOPL Owner Bootstrap / Setup Wizard Maturity"), "delivery_owner_bootstrap_section_missing");
assert(deliveryTruth.includes("setup completed marker"), "delivery_setup_completed_marker_missing");

assert(productTruth.includes("commercial production maturity gap"), "product_truth_maturity_gap_pointer_missing");
assert(productTruth.includes("Payment / Admin Payment API maturity boundary"), "product_truth_payment_admin_boundary_missing");
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
