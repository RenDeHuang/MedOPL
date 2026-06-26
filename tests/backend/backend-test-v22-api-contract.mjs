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
    "canClaim",
    "cannotClaim",
  ],
  "runtime_gate_commercial_action_contract_fields_mismatch",
);
assert(
  runtimeGate.must_return.includes("actionContract"),
  "runtime_gate_must_return_action_contract",
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
const canaryAdmission = runtimeGate.canary_admission;
assert(canaryAdmission, "runtime_gate_canary_admission_contract_missing");
assert.equal(canaryAdmission.intent, "selected_real_user_production_canary_runtime_required_admission", "runtime_gate_canary_admission_intent_mismatch");
for (const marker of [
  canaryAdmission.enabled_flag,
  canaryAdmission.emergency_stop_flag,
  canaryAdmission.tenant_allowlist,
  canaryAdmission.user_allowlist,
  "ErrCanaryAdmissionDenied",
  "ErrCanaryAdmissionDisabled",
  "WithCanaryAdmission",
  "SetCanaryAdmissionPolicy",
]) {
  assert(goRouteSurface.includes(marker) || configSurface.includes(marker) || serviceSurface.includes(marker), `runtime_gate_canary_admission_marker_missing:${marker}`);
}
for (const field of canaryAdmission.decision_fields) {
  assert(
    serviceSurface.includes(`json:"${field}`),
    `runtime_gate_canary_admission_decision_field_missing:${field}`,
  );
}
for (const auditKind of canaryAdmission.audit_events) {
  assert(
    controlplaneDomainSurface.includes(auditKind) || serviceSurface.includes(auditKind) || goRouteSurface.includes(auditKind),
    `runtime_gate_canary_admission_audit_missing:${auditKind}`,
  );
}
assert(
  serviceSurface.includes("RuntimeGateInput struct") && serviceSurface.includes("TenantID") && serviceSurface.includes("PortalUserID"),
  "runtime_gate_canary_admission_identity_input_missing",
);
for (const field of canaryAdmission.must_not_return) {
  assert(!runtimeGateProjectionSurface.includes(`json:"${field}`), `runtime_gate_canary_admission_forbidden_response_field:${field}`);
}
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
  ["ok", "status", "statusUrl", "run", "artifactRef", "artifacts"],
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
]) {
  assert(serviceSurface.includes(marker), `commercial_billing_service_marker_missing:${marker}`);
}
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
