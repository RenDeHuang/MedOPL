import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readRepoGoDir(repoPath) {
  const absoluteDir = path.join(repoRoot, repoPath);
  const names = await readdir(absoluteDir);
  const goFiles = names.filter((name) => name.endsWith(".go") && !name.endsWith("_test.go")).sort();
  const sources = await Promise.all(goFiles.map((name) => readRepoFile(path.join(repoPath, name))));
  return sources.join("\n");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

const apiContract = await readJson("contracts/medopl-api-contract.json");
const goalCurrent = await readJson("tests/fixtures/v22/goal-current.json");
const controlplaneServiceSurface = await readRepoGoDir("services/medopl-go-backend/internal/service/controlplane");
assert.equal(controlplaneServiceSurface.includes("func Test"), false, "api_contract_surface_must_exclude_go_test_files");
assert.equal(controlplaneServiceSurface.includes("t.Fatalf"), false, "api_contract_surface_must_exclude_go_test_assertions");
const goRouteSurface = [
  await readRepoFile("services/medopl-go-backend/internal/server/router.go"),
  await readRepoFile("services/medopl-go-backend/internal/server/security.go"),
  await readRepoFile("services/medopl-go-backend/internal/server/session_bootstrap.go"),
  await readRepoFile("services/medopl-go-backend/internal/server/handlers/controlplane.go"),
  await readRepoFile("services/medopl-go-backend/internal/server/handlers/controlplane_helpers.go"),
  controlplaneServiceSurface,
].join("\n");
const configSurface = await readRepoFile("services/medopl-go-backend/internal/config/config.go");
const controlplaneDomainSurface = await readRepoFile("services/medopl-go-backend/internal/domain/controlplane/controlplane.go");
const serviceSurface = controlplaneServiceSurface;
const billingReconciliationTestSurface = await readRepoFile(
  "services/medopl-go-backend/internal/service/controlplane/billing_reconciliation_test.go",
);
const migration = await readRepoFile("services/medopl-go-backend/migrations/0001_baseline.sql");

const requiredRouteMarkers = [
  "/api/me",
  "/api/workspace",
  "/runtime-gate",
  "/opl/runs",
  "/billing/summary",
  "/v22/billing/payment-orders",
  "/v22/billing/payment-paid",
  "/v22/billing/refund",
  "/v22/billing/adjustment",
  "/v22/billing/statement",
  "/v22/runtime/freeze",
  "/api/admin/audit",
  "/v22/managed-environment/release",
  "/v22/storage/destroy",
];
for (const marker of requiredRouteMarkers) {
  assert(goRouteSurface.includes(marker), `api_contract_route_missing:${marker}`);
}

for (const marker of [
  "productionSecurityMiddleware(cfg)",
  "MEDOPL_AUTH_TOKEN_SHA256",
  "MEDOPL_ADMIN_TOKEN_SHA256",
  "MEDOPL_WEBHOOK_SECRET_SHA256",
  "MEDOPL_SESSION_SIGNING_SECRET_SHA256",
  "MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256",
  "authentication_required",
  "session_bootstrap_signature_required",
  "admin_required",
  "webhook_signature_required",
  "tenant_forbidden",
  "user_forbidden",
  "workspace_forbidden",
  "/api/v22/billing/payment-paid",
]) {
  assert(goRouteSurface.includes(marker) || configSurface.includes(marker), `api_contract_security_boundary_missing:${marker}`);
}
for (const marker of [
  "hashMatches",
  "subtle.ConstantTimeCompare",
  "requiresAdmin",
  "isWebhookOnlyPath",
  "identityScopeAllowed",
  "actorFromSessionCookie",
  "productionSessionBootstrap",
  "productionSessionBootstrapSignature",
  "productionSessionCookieName",
  "productionCSRFCookieName",
  "json.Unmarshal",
]) {
  assert(goRouteSurface.includes(marker), `api_contract_security_implementation_missing:${marker}`);
}

for (const table of ["tenants", "workspaces", "runs", "artifacts", "files", "billing_events", "cloud_operations"]) {
  assert(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `api_contract_table_missing:${table}`);
}

for (const forbidden of apiContract.medopl_api_contract.forbidden_response_fields) {
  assert(!goRouteSurface.includes(`"${forbidden}"`), `api_contract_forbidden_response_field:${forbidden}`);
}

const runtimeGate = apiContract.medopl_api_contract.runtime_gate;
assert(runtimeGate, "api_contract_runtime_gate_missing");
assert.equal(runtimeGate.product_owner, "medopl", "runtime_gate_product_owner_must_be_medopl");
assert.equal(runtimeGate.primary_consumer, "opl-webui", "runtime_gate_primary_consumer_must_be_opl_webui");
assert.equal(runtimeGate.consumer_role, "entry_and_chat_surface", "runtime_gate_consumer_role_mismatch");
assert.deepEqual(runtimeGate.invocation_modes, ["api_only", "ordinary_chat", "runtime_required"], "runtime_gate_invocation_modes_mismatch");
assert.equal(runtimeGate.ordinary_chat_owner, "opl-webui", "runtime_gate_ordinary_chat_owner_must_be_opl_webui");
assert.equal(runtimeGate.runtime_required_owner, "medopl", "runtime_gate_runtime_required_owner_must_be_medopl");

const oplWebuiLaunchContract = apiContract.medopl_api_contract.opl_webui_e2e_launch_contract;
assert(oplWebuiLaunchContract, "api_contract_opl_webui_e2e_launch_contract_missing");
assert.equal(
  oplWebuiLaunchContract.goal_id,
  "goal-commercial-webui-medopl-e2e-launch-contract",
  "opl_webui_launch_goal_id_mismatch",
);
assert.equal(oplWebuiLaunchContract.scope, "cross_repo_local_contract_only", "opl_webui_launch_scope_mismatch");
assert.equal(oplWebuiLaunchContract.medopl_truth_owner, "medopl", "opl_webui_launch_medopl_truth_owner_mismatch");
assert.equal(oplWebuiLaunchContract.opl_webui_consumer_owner, "opl-webui", "opl_webui_launch_consumer_owner_mismatch");
assert.equal(oplWebuiLaunchContract.build_push_deploy_live_test_allowed, false, "opl_webui_launch_must_not_allow_live_ops");
assert.equal(
  oplWebuiLaunchContract.does_not_replace_next_recommended_goal,
  "goal-commercial-release-metadata-rollback-maturity",
  "opl_webui_launch_next_goal_boundary_mismatch",
);
assert.deepEqual(
  oplWebuiLaunchContract.identity_mapping.shared_keys,
  ["userId", "email", "tenantId", "workspaceId"],
  "opl_webui_launch_identity_shared_keys_mismatch",
);
assert.deepEqual(
  oplWebuiLaunchContract.identity_mapping.medopl_truth_keys,
  ["accountId", "planId", "balance", "quota", "runtimeBindingId", "storageBindingId", "billingAttributionId"],
  "opl_webui_launch_medopl_truth_keys_mismatch",
);
assert.deepEqual(
  oplWebuiLaunchContract.identity_mapping.forbidden_crossings,
  ["rawProviderKey", "paymentToken", "runtimeToken", "storageObjectKey", "artifactBody"],
  "opl_webui_launch_forbidden_crossings_mismatch",
);

const launchPathIds = oplWebuiLaunchContract.path_matrix.map((item) => item.id);
assert.deepEqual(
  launchPathIds,
  ["ordinary_path", "specialist_blocked_handoff", "specialist_onboarding_required", "specialist_ready_projection"],
  "opl_webui_launch_path_ids_mismatch",
);
const launchPaths = new Map(oplWebuiLaunchContract.path_matrix.map((item) => [item.id, item]));
assert.equal(launchPaths.get("ordinary_path").medopl_runtime_required, false, "ordinary_path_must_not_require_medopl_runtime");
assert.equal(launchPaths.get("ordinary_path").medopl_storage_required, false, "ordinary_path_must_not_require_medopl_storage");
assert.equal(launchPaths.get("ordinary_path").owner, "opl-webui", "ordinary_path_owner_must_be_opl_webui");
assert.equal(launchPaths.get("specialist_blocked_handoff").owner, "medopl", "blocked_path_owner_must_be_medopl");
assert.equal(launchPaths.get("specialist_blocked_handoff").webui_auto_run_allowed, false, "blocked_path_must_not_auto_run");
assert.deepEqual(
  launchPaths.get("specialist_blocked_handoff").handoff_next_actions,
  ["open_medopl_onboarding", "select_plan", "recharge_or_credit_required", "open_runtime_storage"],
  "blocked_path_handoff_actions_mismatch",
);
assert.equal(launchPaths.get("specialist_onboarding_required").state, "onboarding_required", "onboarding_state_mismatch");
assert.equal(launchPaths.get("specialist_onboarding_required").webui_auto_run_allowed, false, "onboarding_path_must_not_auto_run");
assert.equal(launchPaths.get("specialist_ready_projection").state, "ready", "ready_path_state_mismatch");
assert.equal(launchPaths.get("specialist_ready_projection").ready_source_owner, "medopl", "ready_path_owner_mismatch");
assert.deepEqual(
  launchPaths.get("specialist_ready_projection").allowed_webui_bridge_actions,
  ["POST /api/opl/runtime-gate", "POST /api/opl/runs"],
  "ready_path_bridge_actions_mismatch",
);
assert.equal(
  launchPaths.get("specialist_ready_projection").projection_policy,
  "refs_progress_deliverables_only",
  "ready_path_projection_policy_mismatch",
);
for (const forbiddenClaim of [
  "medopl_owns_ordinary_chat",
  "opl_webui_owns_payment_truth",
  "opl_webui_owns_billing_truth",
  "opl_webui_owns_runtime_truth",
  "opl_webui_owns_storage_truth",
]) {
  assert(oplWebuiLaunchContract.cannot_claim.includes(forbiddenClaim), `opl_webui_launch_forbidden_claim_missing:${forbiddenClaim}`);
}

const dynamicSync = apiContract.medopl_api_contract.commercial_cross_repo_dynamic_current_truth_sync;
assert(dynamicSync, "api_contract_dynamic_cross_repo_sync_missing");
assert.equal(dynamicSync.goal_id, "goal-commercial-cross-repo-dynamic-current-truth-sync", "dynamic_sync_goal_id_mismatch");
assert.equal(dynamicSync.mode, "contract_pointer_remote_head_current_truth_readout_validation_gate", "dynamic_sync_mode_mismatch");
assert.equal(dynamicSync.state, "fresh_sync_recorded_2026-06-29", "dynamic_sync_state_mismatch");
assert.equal(dynamicSync.operation_boundary.cloud_allowed, false, "dynamic_sync_must_not_allow_cloud");
assert.equal(dynamicSync.operation_boundary.build_push_image_allowed, false, "dynamic_sync_must_not_allow_build_push");
assert.equal(dynamicSync.operation_boundary.deploy_live_test_allowed, false, "dynamic_sync_must_not_allow_deploy_live_test");
assert.equal(dynamicSync.operation_boundary.secret_read_allowed, false, "dynamic_sync_must_not_read_secret");
assert.equal(dynamicSync.raw_evidence_policy.commits_raw_evidence, false, "dynamic_sync_must_not_commit_raw_evidence");
assert.equal(dynamicSync.repo_identity.medopl.branch, "recovery/platform-v22-trunk", "dynamic_sync_medopl_branch_mismatch");
assert.equal(dynamicSync.repo_identity.medopl.remote_head, "e6d2e7ae54ee3bcb2fd86fd21d56c35492ac7b35", "dynamic_sync_medopl_head_mismatch");
assert.equal(dynamicSync.repo_identity.medopl.latest_closeout.goal_id, "goal-commercial-current-truth-stale-pointer-cleanup", "dynamic_sync_medopl_closeout_mismatch");
assert.equal(dynamicSync.repo_identity.medopl.next_recommended_goal, "goal-commercial-release-metadata-rollback-maturity", "dynamic_sync_medopl_next_goal_mismatch");
assert.equal(dynamicSync.repo_identity.opl_webui.branch, "main", "dynamic_sync_webui_branch_mismatch");
assert.equal(dynamicSync.repo_identity.opl_webui.remote_head, "94704dc55b9d689655d6e0a34625e8dd10d73b4a", "dynamic_sync_webui_head_mismatch");
assert.equal(dynamicSync.repo_identity.opl_webui.latest_closeout.goal_id, "gap-registry-compaction-v1", "dynamic_sync_webui_closeout_mismatch");
assert.equal(dynamicSync.repo_identity.opl_webui.next_recommended_goal, "goal-commercial-webui-ha-resilience-error-budget-readiness", "dynamic_sync_webui_next_goal_mismatch");
for (const owner of ["account", "plan", "balance", "quota", "runtime", "storage", "billing_ledger", "statement_reconciliation", "release", "destroy", "stop_billing", "future_payment_psp_truth"]) {
  assert(dynamicSync.ownership_boundary.medopl_owns.includes(owner), `dynamic_sync_medopl_owner_missing:${owner}`);
}
for (const owner of ["ordinary_chat", "research_interaction", "task_experience", "page_state", "readonly_medopl_projection_rendering", "deeplink_handoff"]) {
  assert(dynamicSync.ownership_boundary.opl_webui_owns.includes(owner), `dynamic_sync_webui_owner_missing:${owner}`);
}
for (const cannotClaim of ["payment_truth", "billing_truth", "runtime_truth", "storage_truth", "artifact_body_authority"]) {
  assert(dynamicSync.cannot_claim_boundary.opl_webui_cannot_claim.includes(cannotClaim), `dynamic_sync_webui_cannot_claim_missing:${cannotClaim}`);
}
for (const cannotClaim of ["ordinary_chat_task_ux_ownership", "opl_webui_page_state_ownership", "external_psp_settlement", "all_users_all_tenants", "sla_multi_region_production_complete"]) {
  assert(dynamicSync.cannot_claim_boundary.medopl_cannot_claim.includes(cannotClaim), `dynamic_sync_medopl_cannot_claim_missing:${cannotClaim}`);
}
const dynamicStates = new Map(dynamicSync.e2e_state_matrix.map((state) => [state.id, state]));
assert.equal(dynamicStates.get("ordinary_path").runtime_storage_required, false, "dynamic_sync_ordinary_path_must_not_require_runtime_storage");
assert.equal(dynamicStates.get("specialist_blocked_onboarding").requires_medopl_projection, true, "dynamic_sync_blocked_must_require_projection");
assert.equal(dynamicStates.get("specialist_blocked_onboarding").requires_deeplink, true, "dynamic_sync_blocked_must_require_deeplink");
assert.deepEqual(
  dynamicStates.get("specialist_ready").ready_requires,
  ["MedOPL approved account", "MedOPL plan", "MedOPL balance/quota", "MedOPL runtime ready", "MedOPL storage ready"],
  "dynamic_sync_ready_requirements_mismatch",
);
for (const trigger of [
  "public_contract_changed",
  "current_truth_or_next_recommended_goal_changed",
  "can_claim_or_cannot_claim_changed",
  "payment_psp_billing_runtime_storage_release_boundary_changed",
  "opl_webui_projection_deeplink_runtime_bridge_changed",
  "ha_rollback_production_evidence_or_broader_tenant_canary_completed",
  "live_e2e_evidence_added_or_expired",
]) {
  assert(dynamicSync.dynamic_sync_triggers.includes(trigger), `dynamic_sync_trigger_missing:${trigger}`);
}
assert.equal(dynamicSync.fail_closed_rule.on_mismatch, true, "dynamic_sync_mismatch_must_fail_closed");
for (const blocked of ["live_e2e", "rollout", "production_complete_claim"]) {
  assert(dynamicSync.fail_closed_rule.blocked_actions.includes(blocked), `dynamic_sync_fail_closed_action_missing:${blocked}`);
}
assert.deepEqual(
  dynamicSync.next_live_e2e_prerequisites,
  [
    "MedOPL release metadata / rollback maturity",
    "OPL-Webui HA / resilience / error-budget readiness",
    "future PSP goal before payment-to-runtime E2E",
  ],
  "dynamic_sync_next_live_prerequisites_mismatch",
);
assert.equal(dynamicSync.retirement.closeout_after_sync, true, "dynamic_sync_must_closeout_after_sync");
assert.equal(dynamicSync.retirement.long_term_active_blocker, false, "dynamic_sync_must_not_be_long_term_blocker");
const currentDynamicSync = goalCurrent.commercial_cross_repo_dynamic_current_truth_sync;
assert(currentDynamicSync, "goal_current_dynamic_cross_repo_sync_missing");
assert.equal(currentDynamicSync.goal_id, dynamicSync.goal_id, "goal_current_dynamic_sync_goal_id_mismatch");
assert.equal(currentDynamicSync.repo_identity.medopl.remote_head, dynamicSync.repo_identity.medopl.remote_head, "goal_current_dynamic_sync_medopl_head_mismatch");
assert.equal(currentDynamicSync.repo_identity.opl_webui.remote_head, dynamicSync.repo_identity.opl_webui.remote_head, "goal_current_dynamic_sync_webui_head_mismatch");
assert.deepEqual(currentDynamicSync.e2e_state_matrix, dynamicSync.e2e_state_matrix, "goal_current_dynamic_sync_e2e_matrix_mismatch");
assert.deepEqual(currentDynamicSync.dynamic_sync_triggers, dynamicSync.dynamic_sync_triggers, "goal_current_dynamic_sync_triggers_mismatch");
assert.deepEqual(currentDynamicSync.fail_closed_rule, dynamicSync.fail_closed_rule, "goal_current_dynamic_sync_fail_closed_rule_mismatch");
const dynamicCompletedGoal = goalCurrent.goal_lifecycle.completed_goals.find((goal) => goal.goal_id === dynamicSync.goal_id);
assert(dynamicCompletedGoal, "dynamic_sync_completed_goal_missing_after_closeout");
assert.equal(
  dynamicCompletedGoal.landed_commit,
  goalCurrent.latest_landed_closeout.landed_commit,
  "dynamic_sync_completed_goal_commit_must_match_latest_closeout",
);
assert.match(dynamicCompletedGoal.landed_commit, /^[0-9a-f]{40}$/u, "dynamic_sync_completed_goal_commit_must_be_full_sha");
assert.notEqual(
  dynamicCompletedGoal.landed_commit,
  "0000000000000000000000000000000000000000",
  "dynamic_sync_completed_goal_must_not_use_placeholder_sha",
);
assert.equal(goalCurrent.goal_lifecycle.next_recommended_goal, "goal-commercial-release-metadata-rollback-maturity", "dynamic_sync_must_not_replace_medopl_next_goal");

const accountProductization = apiContract.medopl_api_contract.account_productization;
assert(accountProductization, "api_contract_account_productization_missing");
assert.equal(
  accountProductization.intent,
  "owner_created_or_approved_account_recharge_plan_productization",
  "account_productization_intent_mismatch",
);
assert.deepEqual(
  accountProductization.routes,
  [
    "POST /api/v22/users/prepare",
    "POST /api/v22/users/approve",
    "POST /api/v22/users/credit",
    "POST /api/v22/billing/payment-orders",
    "POST /api/v22/billing/payment-paid",
    "GET /api/v22/billing/statement",
    "GET /api/v22/runtime/freeze",
  ],
  "account_productization_routes_mismatch",
);
assert.equal(
  accountProductization.approval_policy,
  "prepared_account_is_not_approved_until_owner_approve",
  "account_productization_approval_policy_mismatch",
);
assert.deepEqual(
  accountProductization.commercial_runtime_fail_closed_on,
  ["account_required", "account_not_approved", "insufficient_balance"],
  "account_productization_fail_closed_mismatch",
);
assert.equal(
  accountProductization.cost_ceiling_source,
  "business_account_balance_plan_hold_amount_and_quota",
  "account_productization_cost_ceiling_source_mismatch",
);
assert(
  accountProductization.can_claim.includes("owner_created_or_approved_paid_account_runtime_gate") &&
    accountProductization.cannot_claim.includes("external_psp_settlement"),
  "account_productization_claim_boundary_mismatch",
);
for (const marker of [
  "/v22/users/prepare",
  "/v22/users/approve",
  "/v22/users/credit",
  "func (service *Service) PrepareBusinessAccount",
  "func (service *Service) ApproveBusinessAccount",
  "func (service *Service) CreditBusinessAccount",
  "ErrAccountNotApproved",
  "account_not_approved",
]) {
  assert(goRouteSurface.includes(marker) || serviceSurface.includes(marker), `account_productization_marker_missing:${marker}`);
}
assert(
  serviceSurface.includes("case \"approved\", \"active\", \"provisioned\"") &&
    !serviceSurface.includes("case \"prepared\", \"approved\", \"active\", \"provisioned\""),
  "prepared_account_must_not_be_treated_as_approved",
);
const paymentAdminMaturity = apiContract.medopl_api_contract.payment_admin_api_maturity;
assert(paymentAdminMaturity, "api_contract_payment_admin_api_maturity_missing");
assert.equal(
  paymentAdminMaturity.intent,
  "payment_admin_api_maturity_boundary_without_external_psp_settlement_claim",
  "payment_admin_maturity_intent_mismatch",
);
assert.deepEqual(
  paymentAdminMaturity.current_truth,
  [
    "internal_credit_billing_ledger_statement_reconciliation_release_destroy_stop_billing_passed",
    "external_psp_settlement_not_completed",
    "real_payment_refund_invoice_tax_compliance_not_completed",
  ],
  "payment_admin_current_truth_mismatch",
);
assert.deepEqual(
  paymentAdminMaturity.required_surfaces,
  [
    "payment_order",
    "payment_intent",
    "payment_provider_config",
    "psp_webhook_intake",
    "settlement_event",
    "refund_event",
    "invoice_metadata",
    "payment_reconciliation",
    "admin_payment_operation_audit",
  ],
  "payment_admin_required_surfaces_mismatch",
);
assert.deepEqual(
  paymentAdminMaturity.routes,
  [
    "POST /api/v22/billing/payment-orders",
    "POST /api/v22/billing/payment-paid",
    "POST /api/v22/billing/refund",
    "POST /api/v22/billing/adjustment",
    "GET /api/v22/billing/statement",
  ],
  "payment_admin_routes_mismatch",
);
assert.equal(paymentAdminMaturity.payment_ledger.owner, "future_payment_provider_settlement_boundary", "payment_ledger_owner_mismatch");
assert.deepEqual(
  paymentAdminMaturity.payment_ledger.responsibilities,
  [
    "payment_intent",
    "provider_verified_payment",
    "settlement_event",
    "refund_event",
    "invoice_metadata",
    "payment_reconciliation_refs",
  ],
  "payment_ledger_responsibilities_mismatch",
);
assert.equal(paymentAdminMaturity.billing_ledger.owner, "medopl_resource_usage_billing_boundary", "billing_ledger_owner_mismatch");
assert.deepEqual(
  paymentAdminMaturity.billing_ledger.responsibilities,
  [
    "account_balance",
    "credit",
    "hold",
    "debit",
    "release",
    "usage",
    "statement",
    "release_destroy_stop_billing",
  ],
  "billing_ledger_responsibilities_mismatch",
);
assert.deepEqual(
  paymentAdminMaturity.reconciliation_refs,
  ["account_id", "workspace_id", "statement_id", "payment_order_id", "provider_event_ref", "ledger_event_id"],
  "payment_admin_reconciliation_refs_mismatch",
);
assert.deepEqual(
  paymentAdminMaturity.can_claim,
  [
    "payment_admin_api_maturity_contract",
    "internal_admin_credit_mode_explicit",
    "payment_vs_billing_ledger_boundary",
  ],
  "payment_admin_can_claim_mismatch",
);
for (const claim of [
  "external_psp_settlement",
  "real_payment_completed",
  "refund_completed_against_external_provider",
  "invoice_tax_compliance_complete",
]) {
  assert(paymentAdminMaturity.cannot_claim.includes(claim), `payment_admin_cannot_claim_missing:${claim}`);
}
assert.equal(paymentAdminMaturity.mock_payment_policy, "mock_or_admin_credit_must_not_claim_real_payment", "payment_admin_mock_policy_mismatch");
assert.equal(paymentAdminMaturity.secret_boundary, "provider_secret_refs_only_no_raw_secret_in_contract_or_ui", "payment_admin_secret_boundary_mismatch");
for (const forbidden of ["cardNumber", "bankAccount", "paymentProviderSecret", "rawProviderWebhookSecret"]) {
  assert(paymentAdminMaturity.forbidden_response_fields.includes(forbidden), `payment_admin_forbidden_field_missing:${forbidden}`);
}
for (const marker of [
  "func (service *Service) CreatePaymentOrder",
  "func (service *Service) MarkPaymentPaid",
  "func (service *Service) RefundBusinessAccount",
  "func (service *Service) AdjustBusinessAccount",
]) {
  assert(serviceSurface.includes(marker), `payment_admin_service_marker_missing:${marker}`);
}
for (const route of paymentAdminMaturity.routes) {
  assert(goRouteSurface.includes(route.replace("POST /api", "").replace("GET /api", "")), `payment_admin_route_missing:${route}`);
}
assert(runtimeGate.commercial_action_contract, "runtime_gate_commercial_action_contract_missing");
assert.deepEqual(
  runtimeGate.commercial_action_contract.actions,
  ["open_medopl_purchase", "select_plan", "recharge_or_credit_required", "open_runtime_storage", "return_to_opl_task"],
  "runtime_gate_commercial_action_contract_actions_mismatch",
);
assert.deepEqual(
  runtimeGate.commercial_action_contract.action_fields,
  [
    "action",
    "reason",
    "workspaceId",
    "sessionId",
    "taskRef",
    "taskIntent",
    "requiredPlan",
    "planRequirement",
    "balanceRequirement",
    "medoplDeeplink",
    "returnToOplDeeplink",
    "returnToOplTaskContract",
    "canClaim",
    "cannotClaim",
  ],
  "runtime_gate_commercial_action_contract_fields_mismatch",
);
const purchaseProjection = runtimeGate.commercial_action_contract.purchase_action_projection;
assert(purchaseProjection, "runtime_gate_purchase_action_projection_missing");
assert.equal(
  purchaseProjection.intent,
  "medopl_purchase_plan_recharge_open_resource_projection",
  "runtime_gate_purchase_action_projection_intent_mismatch",
);
assert.deepEqual(
  purchaseProjection.actions,
  ["select_plan", "recharge_or_credit_required", "open_runtime_storage", "return_to_opl_task"],
  "runtime_gate_purchase_action_projection_actions_mismatch",
);
assert.deepEqual(
  purchaseProjection.fields,
  [
    "workspaceId",
    "sessionId",
    "taskRef",
    "taskIntent",
    "requiredPlan",
    "selectedPlanId",
    "balance",
    "availableBalance",
    "activeFreeze",
    "minRequiredBalance",
    "canOpenRuntimeStorage",
    "selectPlanAction",
    "rechargeOrCreditAction",
    "openRuntimeStorageAction",
    "returnToOplAction",
    "returnToOplTaskContract",
    "canClaim",
    "cannotClaim",
  ],
  "runtime_gate_purchase_action_projection_fields_mismatch",
);
const returnToOplContract = runtimeGate.commercial_action_contract.return_to_opl_task_contract;
assert(returnToOplContract, "runtime_gate_return_to_opl_task_contract_missing");
assert.equal(
  returnToOplContract.intent,
  "stable_deeplink_and_session_resume_contract_for_opl_webui",
  "runtime_gate_return_to_opl_task_contract_intent_mismatch",
);
assert.deepEqual(
  returnToOplContract.fields,
  [
    "resumeAction",
    "resumeMethod",
    "workspaceId",
    "sessionId",
    "taskRef",
    "taskIntent",
    "returnToOplDeeplink",
    "requiredConsumer",
    "canClaim",
    "cannotClaim",
  ],
  "runtime_gate_return_to_opl_task_contract_fields_mismatch",
);
assert(
  returnToOplContract.can_claim.includes("return_to_opl_task_contract") &&
    returnToOplContract.cannot_claim.includes("full_opl_webui_resume_implementation"),
  "runtime_gate_return_to_opl_task_contract_claim_boundary_mismatch",
);
assert(
  runtimeGate.must_return.includes("actionContract"),
  "runtime_gate_must_return_action_contract",
);
assert(
  runtimeGate.must_return.includes("commercialAdmission"),
  "runtime_gate_must_return_commercial_admission",
);
assert.equal(apiContract.medopl_api_contract.storage_destroy?.route, "POST /api/v22/storage/destroy", "storage_destroy_route_contract_missing");
assert.deepEqual(
  apiContract.medopl_api_contract.storage_destroy?.must_return,
  ["ok", "storageDestroyed", "billingStopped", "storageBindingId", "storageState", "auditEvent", "releaseReceipts"],
  "storage_destroy_must_return_contract_mismatch",
);
assert.deepEqual(
  apiContract.medopl_api_contract.storage_destroy?.must_not_return,
  ["rawObjectStoreSecret", "signedUrl", "objectKey", "storageKey", "localPath", "bearerToken", "runtimeToken", "kubeconfig"],
  "storage_destroy_forbidden_response_contract_mismatch",
);

for (const field of runtimeGate.must_return) {
  assert(
    goRouteSurface.includes(`"${field}"`) || goRouteSurface.includes(`json:"${field}`),
    `runtime_gate_go_response_field_missing:${field}`,
  );
}
const runtimeGateProjectionSurface = serviceSurface.slice(
  serviceSurface.indexOf("type RuntimeGateProjection struct"),
  serviceSurface.indexOf("type LaunchLookupInput struct"),
);
assert(runtimeGateProjectionSurface.includes("ActionContract"), "runtime_gate_projection_action_contract_missing");
for (const field of runtimeGate.commercial_action_contract.action_fields) {
  assert(
    serviceSurface.includes(`json:"${field}`),
    `runtime_gate_commercial_action_field_missing:${field}`,
  );
}
for (const field of returnToOplContract.fields) {
  assert(
    serviceSurface.includes(`json:"${field}`),
    `runtime_gate_return_to_opl_task_contract_go_field_missing:${field}`,
  );
}
for (const marker of [
  "type RuntimeReturnToOPLTask struct",
  "func runtimeReturnToOPLTaskContract",
  "json:\"returnToOplTaskContract\"",
  "full_opl_webui_resume_implementation",
  "local_controlled_commercial_business_closure",
  "cloud_deployment_proof",
]) {
  assert(serviceSurface.includes(marker), `runtime_gate_return_to_opl_task_contract_marker_missing:${marker}`);
}
assert.equal(runtimeGate.canary_admission, undefined, "runtime_gate_must_not_use_selected_canary_as_business_admission_truth");
const commercialAdmission = runtimeGate.commercial_admission;
assert(commercialAdmission, "runtime_gate_commercial_admission_contract_missing");
assert.equal(
  commercialAdmission.intent,
  "account_approved_commercial_runtime_gate",
  "runtime_gate_commercial_admission_intent_mismatch",
);
assert.deepEqual(
  commercialAdmission.conditions,
  [
    "account_exists",
    "account_approved",
    "workspace_exists",
    "provider_key_ref_exists_when_needed",
    "plan_selected",
    "balance_sufficient",
    "quota_available",
    "no_emergency_platform_stop",
  ],
  "runtime_gate_commercial_admission_conditions_mismatch",
);
assert.deepEqual(
  commercialAdmission.decision_fields,
  [
    "accountExists",
    "accountApproved",
    "workspaceExists",
    "providerKeyRefExists",
    "planSelected",
    "balanceSufficient",
    "quotaAvailable",
    "emergencyPlatformStop",
    "allowed",
    "decision",
    "reason",
  ],
  "runtime_gate_commercial_admission_decision_fields_mismatch",
);
for (const marker of [
  "CommercialAdmission",
  "json:\"commercialAdmission\"",
  "account_exists",
  "account_approved",
  "workspace_exists",
  "provider_key_ref_exists_when_needed",
  "plan_selected",
  "balance_sufficient",
  "quota_available",
  "no_emergency_platform_stop",
]) {
  assert(goRouteSurface.includes(marker) || serviceSurface.includes(marker), `runtime_gate_commercial_admission_marker_missing:${marker}`);
}
for (const field of commercialAdmission.decision_fields) {
  assert(
    serviceSurface.includes(`json:"${field}`),
    `runtime_gate_commercial_admission_decision_field_missing:${field}`,
  );
}
assert(
  serviceSurface.includes("RuntimeGateInput struct") && serviceSurface.includes("TenantID") && serviceSurface.includes("PortalUserID"),
  "runtime_gate_commercial_admission_identity_input_missing",
);
const operationsSafety = runtimeGate.operations_safety_boundary;
assert(operationsSafety, "runtime_gate_operations_safety_boundary_missing_for_production_launch_env");
assert.equal(operationsSafety.intent, "production_launch_operations_safety_gate_only", "runtime_gate_operations_safety_boundary_intent_mismatch");
assert.equal(operationsSafety.env_refs, undefined, "runtime_gate_operations_safety_must_not_require_runtime_env_refs");
assert.deepEqual(
  operationsSafety.workflow_input_refs,
  [
    "confirm_production_launch",
    "rollout_scope",
    "launch_scope",
    "emergency_stop",
    "cost_guard_ref",
    "owner",
    "rollback_ref",
  ],
  "runtime_gate_operations_safety_workflow_input_refs_mismatch",
);
assert.equal(
  operationsSafety.operator_confirmation_gate,
  "workflow_dispatch_plus_github_production_environment_deployment_operations_safety",
  "runtime_gate_operations_safety_operator_confirmation_gate_mismatch",
);
assert(
  operationsSafety.cannot_claim.includes("business_or_commercial_admission_truth"),
  "runtime_gate_operations_safety_must_not_claim_business_admission",
);
assert(
  operationsSafety.cannot_claim.includes("non_commercial_business_admission"),
  "runtime_gate_operations_safety_must_not_claim_non_commercial_business_admission",
);
assert(
  !runtimeGateProjectionSurface.includes("CanaryAdmission") && !runtimeGateProjectionSurface.includes('json:"canaryAdmission"'),
  "runtime_gate_projection_must_not_return_canary_admission_as_business_field",
);
for (const field of runtimeGate.forbidden_response_fields) {
  assert(!runtimeGateProjectionSurface.includes(`json:"${field}`), `runtime_gate_forbidden_response_field:${field}`);
}

const runResult = apiContract.medopl_api_contract.run_result;
assert(runResult, "api_contract_run_result_missing");
assert.equal(runResult.route, "POST /api/opl/runs", "run_result_route_contract_missing");
assert.equal(runResult.primary_consumer, "opl-webui", "run_result_primary_consumer_must_be_opl_webui");
assert.equal(
  runResult.artifact_ref_policy,
  "top_level_artifactRef_must_match_first_artifact_artifactRef",
  "run_result_artifact_ref_policy_mismatch",
);
assert.deepEqual(
  runResult.must_return,
  ["ok", "status", "statusUrl", "run", "artifactRef", "artifacts", "refs", "progress", "deliverables"],
  "run_result_must_return_contract_mismatch",
);
const publicRunResultSurface = serviceSurface.slice(
  serviceSurface.indexOf("type PublicRunResult struct"),
  serviceSurface.indexOf("func (service *Service) StartRun"),
);
for (const field of runResult.must_return) {
  assert(
    publicRunResultSurface.includes(`json:"${field}`),
    `run_result_go_response_field_missing:${field}`,
  );
}
for (const field of runResult.must_not_return) {
  assert(!publicRunResultSurface.includes(`json:"${field}`), `run_result_forbidden_response_field:${field}`);
}
assert(
  /ArtifactRef:\s*artifactRef/u.test(serviceSurface),
  "run_result_top_level_artifact_ref_not_populated_from_generated_artifact_ref",
);
assert(
  /Refs\s+PublicRunRefs/u.test(publicRunResultSurface) &&
    /json:"refs"/u.test(publicRunResultSurface),
  "run_result_refs_projection_missing",
);
const runRefsProjection = serviceSurface.slice(
  serviceSurface.indexOf("Refs: PublicRunRefs{"),
  serviceSurface.indexOf("Artifacts: []PublicArtifact{{"),
);
for (const marker of [
  "RunRef:           runID",
  "ArtifactRef:      artifactRef",
  "FileRefs:         append([]string(nil), fileRefs...)",
  "StorageBindingID: storageBindingID",
]) {
  assert(runRefsProjection.includes(marker), `run_result_refs_projection_marker_missing:${marker}`);
}

const billingSummary = apiContract.medopl_api_contract.billing_summary;
assert(billingSummary, "api_contract_billing_summary_missing");
assert.equal(billingSummary.route, "GET /api/billing/summary", "billing_summary_route_contract_missing");
assert.equal(billingSummary.primary_consumer, "opl-webui", "billing_summary_primary_consumer_must_be_opl_webui");
assert.equal(
  billingSummary.count_policy,
  "top_level_runCount_and_ledgerCount_must_match_summary_runCount_and_ledger_length",
  "billing_summary_count_policy_mismatch",
);
assert.deepEqual(
  billingSummary.must_return,
  ["ok", "source", "runCount", "ledgerCount", "summary", "ledger"],
  "billing_summary_must_return_contract_mismatch",
);
const billingSummarySurface = serviceSurface.slice(
  serviceSurface.indexOf("type BillingSummary struct"),
  serviceSurface.indexOf("type BillingDetails struct"),
);
for (const field of billingSummary.must_return) {
  assert(
    billingSummarySurface.includes(`json:"${field}`),
    `billing_summary_go_response_field_missing:${field}`,
  );
}
for (const field of billingSummary.must_not_return) {
  assert(!billingSummarySurface.includes(`json:"${field}`), `billing_summary_forbidden_response_field:${field}`);
}
assert(
  serviceSurface.includes("summary.RunCount = runCount") && serviceSurface.includes("summary.LedgerCount = len(summary.Ledger)"),
  "billing_summary_top_level_counts_not_populated_from_summary_and_ledger",
);

const billingStatement = apiContract.medopl_api_contract.billing_statement;
assert(billingStatement, "api_contract_billing_statement_missing");
assert.equal(billingStatement.route, "GET /api/v22/billing/statement", "billing_statement_route_contract_missing");
assert.equal(billingStatement.primary_consumer, "opl-webui", "billing_statement_primary_consumer_must_be_opl_webui");
assert.deepEqual(
  billingStatement.must_return,
  ["ok", "source", "workspaceId", "wallet", "rows", "receipts", "businessClosureReceipt"],
  "billing_statement_must_return_contract_mismatch",
);
assert.deepEqual(
  billingStatement.business_closure_receipt_fields,
  [
    "customerAccountExists",
    "creditRecorded",
    "balanceIncreased",
    "preOpenBalanceCheck",
    "resourcePreauthFreeze",
    "usageDebitRecorded",
    "billingAttributionLinked",
    "releaseStopBilling",
    "storageBillingStopped",
    "auditLinked",
    "idempotencyPolicy",
    "insufficientBalancePolicy",
    "canClaim",
    "cannotClaim",
  ],
  "billing_statement_business_closure_receipt_fields_mismatch",
);
assert(
  billingStatement.can_claim.includes("internal_commercial_billing_ledger_closure") &&
    billingStatement.cannot_claim.includes("external_psp_settlement"),
  "billing_statement_claim_boundary_mismatch",
);
const billingStatementSurface = serviceSurface.slice(
  serviceSurface.indexOf("type BillingStatement struct"),
  serviceSurface.indexOf("type RuntimeFreezeProjection struct"),
);
for (const field of billingStatement.must_return) {
  assert(
    billingStatementSurface.includes(`json:"${field}`),
    `billing_statement_go_response_field_missing:${field}`,
  );
}
for (const field of billingStatement.business_closure_receipt_fields) {
  assert(
    billingStatementSurface.includes(`json:"${field}`),
    `billing_statement_business_closure_go_field_missing:${field}`,
  );
}
for (const field of billingStatement.must_not_return) {
  assert(!billingStatementSurface.includes(`json:"${field}`), `billing_statement_forbidden_response_field:${field}`);
}
for (const marker of [
  "type CommercialBusinessClosureReceipt struct",
  "func (service *Service) commercialBusinessClosureReceipt",
  "account_and_available_balance_required",
  "credit_and_billing_events_use_idempotency_keys",
  "runtime_open_fails_closed_when_available_balance_below_hold",
  "internal_commercial_billing_ledger_closure",
  "external_psp_settlement",
]) {
  assert(serviceSurface.includes(marker), `billing_statement_business_closure_marker_missing:${marker}`);
}
for (const marker of [
  "func (service *Service) CreatePaymentOrder",
  "func (service *Service) MarkPaymentPaid",
  "func (service *Service) RefundBusinessAccount",
  "func (service *Service) AdjustBusinessAccount",
  "func (service *Service) BillingStatement",
  "func (service *Service) RuntimeFreeze",
  "walletFromCommercialLedger",
  "commercialRuntimeHoldAmount",
  "commercialFreezeDays",
  "type RuntimePurchaseActionProjection struct",
  "func RuntimePurchaseActionProjectionFromQuery",
  "json:\"purchaseProjection\"",
  "cloud_deployment_proof",
]) {
  assert(serviceSurface.includes(marker), `commercial_billing_service_marker_missing:${marker}`);
}
for (const marker of [
  "func (service *Service) saveBillingEventForAudit",
  "ResourceBindingLedgerByID(ctx, audit.ResourceBindingID)",
  "errors.Is(err, cprepo.ErrNotFound)",
]) {
  assert(serviceSurface.includes(marker), `commercial_upload_billing_writeback_marker_missing:${marker}`);
}
for (const marker of [
  "billing-event-writeback.csv",
  "billing-fk.csv",
  "canonical runtime tenant/workspace/resource identity",
]) {
  assert(
    billingReconciliationTestSurface.includes(marker),
    `commercial_upload_billing_writeback_test_marker_missing:${marker}`,
  );
}
assert(
  !serviceSurface.includes("production_canary_commercial_closure"),
  "commercial_billing_projection_must_not_make_production_canary_gap6_a_business_claim_boundary",
);
for (const marker of [
  "ErrAccountRequired",
  "ErrInsufficientBalance",
]) {
  assert(serviceSurface.includes(marker) || goRouteSurface.includes(marker), `commercial_billing_error_boundary_missing:${marker}`);
}
for (const marker of [
  "account_required",
  "insufficient_balance",
]) {
  assert(goRouteSurface.includes(marker), `commercial_billing_http_error_mapping_missing:${marker}`);
}

const releaseRuntime = apiContract.medopl_api_contract.release_runtime;
assert(releaseRuntime, "api_contract_release_runtime_missing");
assert.equal(releaseRuntime.route, "POST /api/v22/managed-environment/release", "release_runtime_route_contract_missing");
assert.equal(releaseRuntime.primary_consumer, "opl-webui", "release_runtime_primary_consumer_must_be_opl_webui");
assert.equal(
  releaseRuntime.audit_event_policy,
  "top_level_auditEventId_must_match_auditEvent_id",
  "release_runtime_audit_event_policy_mismatch",
);
assert.deepEqual(
  releaseRuntime.must_return,
  ["ok", "status", "billingStopped", "auditEventId", "auditEvent", "receipts"],
  "release_runtime_must_return_contract_mismatch",
);
const releaseResultSurface = serviceSurface.slice(
  serviceSurface.indexOf("type ReleaseResult struct"),
  serviceSurface.indexOf("type ReleaseReceipts struct"),
);
for (const field of releaseRuntime.must_return) {
  assert(
    releaseResultSurface.includes(`json:"${field}`),
    `release_runtime_go_response_field_missing:${field}`,
  );
}
for (const field of releaseRuntime.must_not_return) {
  assert(!releaseResultSurface.includes(`json:"${field}`), `release_runtime_forbidden_response_field:${field}`);
}
assert(
  /AuditEventID:\s*audit\.ID/u.test(serviceSurface),
  "release_runtime_top_level_audit_event_id_not_populated_from_audit_event",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_medopl_api_contract",
  routes: requiredRouteMarkers.length,
}, null, 2));
