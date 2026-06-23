import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import {
  evaluateProductionReceiptManifest,
  validateProductionReceiptBoundary,
} from "../../scripts/v22-production-receipt-boundary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const testRunId = `test-production-complete-candidate-${process.pid}`;
const testEvidenceDir = `.runtime/v22-production-complete-candidate/${testRunId}`;
const testManifestPath = `${testEvidenceDir}/receipt-manifest.json`;

async function readJson(repoPath) {
  return JSON.parse(await readFile(path.join(repoRoot, repoPath), "utf8"));
}

function runVerifyCloudReleaseCandidate(args = []) {
  return spawnSync(process.execPath, ["scripts/v22-verify.mjs", "cloud-release-candidate", "--json", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function runVerifyProductionCompleteCandidate(args = []) {
  return spawnSync(process.execPath, ["scripts/v22-verify.mjs", "production-complete-candidate", "--json", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

const [boundary, cloudAuthorization, exampleManifest, uiQualityContract] = await Promise.all([
  readJson("contracts/medopl-production-receipt-boundary.json"),
  readJson("contracts/medopl-cloud-authorization-pack.json"),
  readJson("tests/fixtures/v22/production-receipt-manifest.example.json"),
  readJson("contracts/medopl-portal-ui-quality-contract.json"),
]);
const releaseBoundary = await readJson("contracts/medopl-release-boundary.json");

const boundaryResult = validateProductionReceiptBoundary({
  boundary,
  cloudAuthorization,
  releaseBoundary,
  uiQualityContract,
});
assert.equal(boundaryResult.ok, true, `production_receipt_boundary_must_be_valid:${JSON.stringify(boundaryResult, null, 2)}`);
assert.deepEqual(
  boundary.production_receipt_boundary.required_receipt_types,
  cloudAuthorization.required_receipts_before_production_complete,
  "production_receipts_must_match_cloud_authorization_pack",
);
assert.equal(
  boundary.production_receipt_boundary.local_rc_claim_upgrade,
  "forbidden",
  "local_rc_must_not_auto_upgrade_to_production_complete",
);
assert.equal(
  boundary.production_receipt_boundary.cloud_deployable_rc_claim_upgrade,
  "forbidden",
  "cloud_deployable_rc_must_not_auto_upgrade_to_production_complete",
);
assert.equal(
  boundary.production_receipt_boundary.authorized_command_receipt_manifest_required,
  true,
  "authorized_cloud_command_must_write_receipt_manifest",
);
assert.equal(
  boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.state,
  "fail_closed_until_dedicated_production_complete_receipt",
  "production_complete_owner_receipt_gate_must_fail_closed",
);
assert.equal(
  boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.current_claimable_state,
  "cloud_release_candidate_only",
  "production_complete_owner_receipt_gate_must_not_upgrade_cloud_rc",
);
assert.equal(
  boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.claim_upgrade_from_cloud_rc,
  "forbidden",
  "production_complete_owner_receipt_gate_must_forbid_cloud_rc_upgrade",
);
assert.equal(
  boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.production_complete_criteria_manifest_field,
  "production_complete_criteria",
  "production_complete_owner_receipt_gate_must_require_dedicated_criteria_manifest_field",
);
assert.equal(
  boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.criteria_evidence_ref_policy,
  "runtime_pointer_summary_only",
  "production_complete_owner_receipt_gate_criteria_evidence_must_stay_pointer_only",
);
assert.equal(
  boundary.production_receipt_boundary.lifecycle_section_evidence_hash_policy,
  "sha256_pointer_hash_required",
  "production_receipt_boundary_lifecycle_evidence_hash_policy_missing",
);
assert.equal(
  boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.criteria_evidence_hash_policy,
  "sha256_pointer_hash_required",
  "production_complete_owner_receipt_gate_criteria_evidence_hash_policy_missing",
);
assert.equal(
  boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.scope_policy?.default_claim_scope,
  "current_authorized_canary_path_only",
  "production_complete_owner_receipt_gate_default_scope_must_stay_narrow",
);
assert.equal(
  boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.scope_policy?.scope_expansion_requires,
  "dedicated_contract_and_evidence",
  "production_complete_owner_receipt_gate_scope_expansion_must_need_dedicated_contract",
);
assert.equal(
  boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.scope_policy?.single_canary_upgrade,
  "forbidden",
  "production_complete_owner_receipt_gate_single_canary_upgrade_must_be_forbidden",
);
for (const gate of [
  "release_owner_receipt",
  "security_dependency_gate",
  "browser_accessibility_regression",
  "role_boundary_browser_gate",
  "s_level_ui_polish_gate",
  "observability_receipt",
]) {
  assert(
    boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.required_gates?.includes(gate),
    `production_complete_owner_receipt_gate_required_gate_missing:${gate}`,
  );
}
for (const criterion of [
  "release_owner_readiness_receipt",
  "production_dependency_security_receipt",
  "browser_accessibility_verification_receipt",
  "s_level_ui_polish_receipt",
  "observability_deploy_receipt",
  "rollback_readiness_receipt",
  "post_release_monitoring_receipt",
]) {
  assert(
    boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.required_operational_criteria?.includes(criterion),
    `production_complete_owner_receipt_gate_operational_criterion_missing:${criterion}`,
  );
}
const criteriaContract = boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.operational_criteria_contract;
assert(Array.isArray(criteriaContract), "production_complete_operational_criteria_contract_missing");
const criteriaContractById = new Map(criteriaContract.map((criterion) => [criterion.id, criterion]));
for (const criterion of boundary.production_receipt_boundary.production_complete_owner_receipt_gate.required_operational_criteria) {
  const contract = criteriaContractById.get(criterion);
  assert(contract, `production_complete_operational_criteria_contract_item_missing:${criterion}`);
  assert(String(contract.owner || "").trim(), `production_complete_operational_criteria_contract_owner_missing:${criterion}`);
  assert(String(contract.evidence_source || "").trim(), `production_complete_operational_criteria_contract_evidence_source_missing:${criterion}`);
  assert(
    boundary.production_receipt_boundary.production_complete_owner_receipt_gate.required_gates.includes(contract.required_gate),
    `production_complete_operational_criteria_contract_gate_mismatch:${criterion}`,
  );
  assert.equal(contract.evidence_ref_policy, "runtime_pointer_summary_only", `production_complete_operational_criteria_contract_ref_policy_mismatch:${criterion}`);
  assert.equal(contract.evidence_hash_policy, "sha256_pointer_hash_required", `production_complete_operational_criteria_contract_hash_policy_mismatch:${criterion}`);
  assert.equal(contract.raw_evidence_policy, "forbidden", `production_complete_operational_criteria_contract_raw_policy_mismatch:${criterion}`);
}
assert.equal(
  criteriaContractById.get("production_dependency_security_receipt")?.evidence_source,
  "scripts/v22-repo-hygiene.mjs",
  "production_dependency_security_receipt_must_bind_repo_hygiene",
);
const securityContract = criteriaContractById.get("production_dependency_security_receipt");
assert.equal(
  securityContract?.audit_gates?.root?.command,
  uiQualityContract.medopl_portal_ui_quality_contract.production_readiness.root_production_dependency_gate.command,
  "production_dependency_security_receipt_root_audit_command_mismatch",
);
assert.equal(
  securityContract?.audit_gates?.root?.max_high_or_critical_vulnerabilities,
  uiQualityContract.medopl_portal_ui_quality_contract.production_readiness.root_production_dependency_gate.max_prod_high_or_critical_vulnerabilities,
  "production_dependency_security_receipt_root_audit_threshold_mismatch",
);
assert.equal(
  securityContract?.audit_gates?.frontend?.command,
  uiQualityContract.medopl_portal_ui_quality_contract.production_readiness.security_dependency_gate.command,
  "production_dependency_security_receipt_frontend_audit_command_mismatch",
);
assert.equal(
  securityContract?.audit_gates?.frontend?.max_high_vulnerabilities,
  uiQualityContract.medopl_portal_ui_quality_contract.production_readiness.security_dependency_gate.max_prod_high_vulnerabilities,
  "production_dependency_security_receipt_frontend_audit_threshold_mismatch",
);
assert.equal(
  securityContract?.receipt_source_policy,
  "repo_hygiene_audit_summary_only",
  "production_dependency_security_receipt_source_policy_mismatch",
);
assert.equal(
  securityContract?.audit_payload_policy,
  "summary_counts_only_no_raw_advisory_payload",
  "production_dependency_security_receipt_audit_payload_policy_mismatch",
);
assert.equal(
  criteriaContractById.get("browser_accessibility_verification_receipt")?.evidence_source,
  "tests/regression/portal/regression-test-v22-portal-resource-control-ui-browser.mjs",
  "browser_accessibility_receipt_must_bind_browser_regression",
);
assert.equal(
  criteriaContractById.get("s_level_ui_polish_receipt")?.evidence_source,
  "tests/regression/portal/regression-test-v22-portal-resource-control-ui-browser.mjs",
  "s_level_ui_polish_receipt_must_bind_browser_regression",
);
const browserAccessibilityContract = criteriaContractById.get("browser_accessibility_verification_receipt");
assert.deepEqual(
  browserAccessibilityContract?.checks,
  uiQualityContract.medopl_portal_ui_quality_contract.production_readiness.accessibility_verification.checks,
  "browser_accessibility_receipt_checks_must_match_ui_quality_contract",
);
assert.equal(
  browserAccessibilityContract?.browser_role_boundary,
  "admin_and_user_mobile_nav",
  "browser_accessibility_receipt_must_bind_role_boundary_browser_gate",
);
assert.equal(
  browserAccessibilityContract?.receipt_source_policy,
  "browser_regression_summary_only",
  "browser_accessibility_receipt_source_policy_mismatch",
);
const sLevelContract = criteriaContractById.get("s_level_ui_polish_receipt");
assert.deepEqual(
  sLevelContract?.checks,
  uiQualityContract.medopl_portal_ui_quality_contract.production_readiness.s_level_ui_polish_gate.checks,
  "s_level_ui_polish_receipt_checks_must_match_ui_quality_contract",
);
assert.equal(
  sLevelContract?.receipt_source_policy,
  "browser_regression_summary_only",
  "s_level_ui_polish_receipt_source_policy_mismatch",
);
const observabilityContract = criteriaContractById.get("observability_deploy_receipt");
const rollbackContract = criteriaContractById.get("rollback_readiness_receipt");
const monitoringContract = criteriaContractById.get("post_release_monitoring_receipt");
for (const [criterion, contract] of [
  ["observability_deploy_receipt", observabilityContract],
  ["rollback_readiness_receipt", rollbackContract],
  ["post_release_monitoring_receipt", monitoringContract],
]) {
  assert.equal(contract?.evidence_source, "scripts/cloud-rollout/medopl.mjs", `${criterion}_must_bind_cloud_rollout_runner`);
  assert.equal(contract?.receipt_source_policy, "cloud_rollout_summary_only", `${criterion}_source_policy_mismatch`);
  assert.equal(contract?.raw_log_policy, "forbidden", `${criterion}_raw_log_policy_mismatch`);
}
assert.deepEqual(
  observabilityContract?.runbook_commands,
  [
    "npm run cloud:goal -- --operation deploy",
    "npm run cloud:rollout:availability",
  ],
  "observability_deploy_receipt_runbook_commands_mismatch",
);
assert.deepEqual(
  observabilityContract?.required_observability_checks,
  ["deployment_image", "pod_status", "routing_diagnostics", "healthz_json", "readyz_json"],
  "observability_deploy_receipt_checks_mismatch",
);
assert.deepEqual(
  rollbackContract?.runbook_commands,
  [
    "npm run cloud:goal -- --operation deploy",
    "node scripts/cloud-rollout/medopl.mjs --rollback",
  ],
  "rollback_readiness_receipt_runbook_commands_mismatch",
);
assert.deepEqual(
  rollbackContract?.rollback_commands,
  cloudAuthorization.active_pack.rollback_commands,
  "rollback_readiness_receipt_must_match_authorization_pack",
);
assert.deepEqual(
  monitoringContract?.runbook_commands,
  ["npm run cloud:rollout:availability"],
  "post_release_monitoring_receipt_runbook_commands_mismatch",
);
assert.deepEqual(
  monitoringContract?.required_monitoring_checks,
  ["healthz_json", "readyz_json", "no_static_html", "no_secret_text"],
  "post_release_monitoring_receipt_checks_mismatch",
);
for (const cannotClaim of [
  "multi_region_production",
  "sla_proven",
  "enterprise_compliance",
  "ongoing_authorization",
  "unobserved_tenants_or_resources",
]) {
  assert(
    boundary.production_receipt_boundary.production_complete_owner_receipt_gate?.explicit_non_goals_until_dedicated_contract?.includes(cannotClaim),
    `production_complete_owner_receipt_gate_non_goal_missing:${cannotClaim}`,
  );
}
const missingProductionCompleteGateBoundary = structuredClone(boundary);
delete missingProductionCompleteGateBoundary.production_receipt_boundary.production_complete_owner_receipt_gate;
const missingProductionCompleteGateResult = validateProductionReceiptBoundary({
  boundary: missingProductionCompleteGateBoundary,
  cloudAuthorization,
});
assert.equal(missingProductionCompleteGateResult.ok, false, "production_complete_owner_receipt_gate_must_be_validated_by_runner");
assert(
  missingProductionCompleteGateResult.blockers.includes("production_receipt_boundary_production_complete_gate_missing"),
  "production_complete_owner_receipt_gate_missing_blocker_mismatch",
);
const missingProductionCriteriaBoundary = structuredClone(boundary);
delete missingProductionCriteriaBoundary.production_receipt_boundary.production_complete_owner_receipt_gate.required_operational_criteria;
const missingProductionCriteriaResult = validateProductionReceiptBoundary({
  boundary: missingProductionCriteriaBoundary,
  cloudAuthorization,
});
assert.equal(missingProductionCriteriaResult.ok, false, "production_complete_operational_criteria_must_be_validated_by_runner");
assert(
  missingProductionCriteriaResult.blockers.includes("production_receipt_boundary_production_complete_gate_operational_criteria_missing"),
  "production_complete_operational_criteria_missing_blocker_mismatch",
);
assert.equal(boundary.production_receipt_boundary.receipt_operation_binding_required, true, "receipt_operation_binding_must_be_required");
assert.equal(boundary.production_receipt_boundary.receipt_authorization_ref_required, true, "receipt_authorization_ref_must_be_required");
assert.equal(boundary.production_receipt_boundary.receipt_runner_id_required, true, "receipt_runner_id_must_be_required");

const missingReleaseReadinessBoundary = structuredClone(releaseBoundary);
delete missingReleaseReadinessBoundary.medopl_release_boundary.release_owner_readiness.production_criterion;
const missingReleaseReadinessResult = validateProductionReceiptBoundary({
  boundary,
  cloudAuthorization,
  releaseBoundary: missingReleaseReadinessBoundary,
});
assert.equal(missingReleaseReadinessResult.ok, false, "release_owner_readiness_contract_must_be_validated_by_runner");
assert(
  missingReleaseReadinessResult.blockers.includes("production_receipt_boundary_release_owner_readiness_criterion_mismatch"),
  "release_owner_readiness_missing_criterion_blocker_mismatch",
);

const mismatchedReleaseReadinessBoundary = structuredClone(releaseBoundary);
mismatchedReleaseReadinessBoundary.medopl_release_boundary.release_owner_readiness.evidence_hash_policy = "summary_only";
const mismatchedReleaseReadinessResult = validateProductionReceiptBoundary({
  boundary,
  cloudAuthorization,
  releaseBoundary: mismatchedReleaseReadinessBoundary,
});
assert.equal(mismatchedReleaseReadinessResult.ok, false, "release_owner_readiness_policy_must_be_validated_by_runner");
assert(
  mismatchedReleaseReadinessResult.blockers.includes("production_receipt_boundary_release_owner_readiness_hash_policy_mismatch"),
  "release_owner_readiness_hash_policy_blocker_mismatch",
);

const missingSecurityAuditGateBoundary = structuredClone(boundary);
delete missingSecurityAuditGateBoundary.production_receipt_boundary.production_complete_owner_receipt_gate
  .operational_criteria_contract
  .find((criterion) => criterion.id === "production_dependency_security_receipt").audit_gates;
const missingSecurityAuditGateResult = validateProductionReceiptBoundary({
  boundary: missingSecurityAuditGateBoundary,
  cloudAuthorization,
  releaseBoundary,
  uiQualityContract,
});
assert.equal(missingSecurityAuditGateResult.ok, false, "dependency_security_audit_gates_must_be_validated_by_runner");
assert(
  missingSecurityAuditGateResult.blockers.includes("production_receipt_boundary_dependency_security_audit_gates_missing"),
  "dependency_security_audit_gates_missing_blocker_mismatch",
);

const mismatchedSecurityAuditGateBoundary = structuredClone(boundary);
mismatchedSecurityAuditGateBoundary.production_receipt_boundary.production_complete_owner_receipt_gate
  .operational_criteria_contract
  .find((criterion) => criterion.id === "production_dependency_security_receipt")
  .audit_gates.frontend.max_high_vulnerabilities = 1;
const mismatchedSecurityAuditGateResult = validateProductionReceiptBoundary({
  boundary: mismatchedSecurityAuditGateBoundary,
  cloudAuthorization,
  releaseBoundary,
  uiQualityContract,
});
assert.equal(mismatchedSecurityAuditGateResult.ok, false, "dependency_security_audit_threshold_must_match_ui_quality_contract");
assert(
  mismatchedSecurityAuditGateResult.blockers.includes("production_receipt_boundary_dependency_security_frontend_threshold_mismatch"),
  "dependency_security_frontend_threshold_blocker_mismatch",
);

const missingBrowserChecksBoundary = structuredClone(boundary);
delete missingBrowserChecksBoundary.production_receipt_boundary.production_complete_owner_receipt_gate
  .operational_criteria_contract
  .find((criterion) => criterion.id === "browser_accessibility_verification_receipt").checks;
const missingBrowserChecksResult = validateProductionReceiptBoundary({
  boundary: missingBrowserChecksBoundary,
  cloudAuthorization,
  releaseBoundary,
  uiQualityContract,
});
assert.equal(missingBrowserChecksResult.ok, false, "browser_accessibility_checks_must_be_validated_by_runner");
assert(
  missingBrowserChecksResult.blockers.includes("production_receipt_boundary_browser_accessibility_checks_mismatch"),
  "browser_accessibility_checks_missing_blocker_mismatch",
);

const mismatchedSLevelChecksBoundary = structuredClone(boundary);
mismatchedSLevelChecksBoundary.production_receipt_boundary.production_complete_owner_receipt_gate
  .operational_criteria_contract
  .find((criterion) => criterion.id === "s_level_ui_polish_receipt")
  .checks = ["component_state_consistency"];
const mismatchedSLevelChecksResult = validateProductionReceiptBoundary({
  boundary: mismatchedSLevelChecksBoundary,
  cloudAuthorization,
  releaseBoundary,
  uiQualityContract,
});
assert.equal(mismatchedSLevelChecksResult.ok, false, "s_level_ui_polish_checks_must_match_ui_quality_contract");
assert(
  mismatchedSLevelChecksResult.blockers.includes("production_receipt_boundary_s_level_ui_polish_checks_mismatch"),
  "s_level_ui_polish_checks_mismatch_blocker_mismatch",
);

const missingObservabilityRunbookBoundary = structuredClone(boundary);
delete missingObservabilityRunbookBoundary.production_receipt_boundary.production_complete_owner_receipt_gate
  .operational_criteria_contract
  .find((criterion) => criterion.id === "observability_deploy_receipt").runbook_commands;
const missingObservabilityRunbookResult = validateProductionReceiptBoundary({
  boundary: missingObservabilityRunbookBoundary,
  cloudAuthorization,
  releaseBoundary,
  uiQualityContract,
});
assert.equal(missingObservabilityRunbookResult.ok, false, "observability_runbook_must_be_validated_by_runner");
assert(
  missingObservabilityRunbookResult.blockers.includes("production_receipt_boundary_observability_deploy_runbook_mismatch"),
  "observability_runbook_missing_blocker_mismatch",
);

const mismatchedRollbackCommandsBoundary = structuredClone(boundary);
mismatchedRollbackCommandsBoundary.production_receipt_boundary.production_complete_owner_receipt_gate
  .operational_criteria_contract
  .find((criterion) => criterion.id === "rollback_readiness_receipt")
  .rollback_commands = ["npm run test:cloud"];
const mismatchedRollbackCommandsResult = validateProductionReceiptBoundary({
  boundary: mismatchedRollbackCommandsBoundary,
  cloudAuthorization,
  releaseBoundary,
  uiQualityContract,
});
assert.equal(mismatchedRollbackCommandsResult.ok, false, "rollback_commands_must_match_authorization_pack");
assert(
  mismatchedRollbackCommandsResult.blockers.includes("production_receipt_boundary_rollback_readiness_commands_mismatch"),
  "rollback_commands_mismatch_blocker_mismatch",
);

const mismatchedMonitoringChecksBoundary = structuredClone(boundary);
mismatchedMonitoringChecksBoundary.production_receipt_boundary.production_complete_owner_receipt_gate
  .operational_criteria_contract
  .find((criterion) => criterion.id === "post_release_monitoring_receipt")
  .required_monitoring_checks = ["healthz_json"];
const mismatchedMonitoringChecksResult = validateProductionReceiptBoundary({
  boundary: mismatchedMonitoringChecksBoundary,
  cloudAuthorization,
  releaseBoundary,
  uiQualityContract,
});
assert.equal(mismatchedMonitoringChecksResult.ok, false, "monitoring_checks_must_be_validated_by_runner");
assert(
  mismatchedMonitoringChecksResult.blockers.includes("production_receipt_boundary_post_release_monitoring_checks_mismatch"),
  "monitoring_checks_mismatch_blocker_mismatch",
);

const complete = evaluateProductionReceiptManifest({
  boundary,
  manifest: exampleManifest,
});
assert.equal(complete.cloudReleaseCandidateComplete, true, "complete_manifest_must_allow_cloud_release_candidate");
assert.equal(complete.productionComplete, false, "cloud_rc_manifest_must_not_allow_production_complete");
assert.deepEqual(complete.missingReceiptTypes, [], "complete_manifest_must_have_no_missing_receipts");
assert.deepEqual(complete.missingLifecycleSections, [], "complete_manifest_must_have_no_missing_lifecycle_sections");
assert.deepEqual(complete.rawEvidenceViolations, [], "complete_manifest_must_not_embed_raw_evidence");
assert.deepEqual(complete.receiptMappingViolations, [], "complete_manifest_must_match_operation_mapping");

const localRcUpgrade = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    evidence_level: "local_rc",
  },
});
assert.equal(localRcUpgrade.productionComplete, false, "local_rc_manifest_must_not_claim_production_complete");
assert(localRcUpgrade.blockers.includes("production_receipt_manifest_forbidden_evidence_level:local_rc"), "local_rc_upgrade_blocker_missing");

const cloudDeployableUpgrade = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    evidence_level: "cloud_deployable_rc",
  },
});
assert.equal(cloudDeployableUpgrade.productionComplete, false, "cloud_deployable_rc_manifest_must_not_claim_production_complete");
assert(
  cloudDeployableUpgrade.blockers.includes("production_receipt_manifest_forbidden_evidence_level:cloud_deployable_rc"),
  "cloud_deployable_upgrade_blocker_missing",
);

const missingReceipt = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    receipts: exampleManifest.receipts.filter((receipt) => receipt.type !== "production_deploy_receipt"),
  },
});
assert.equal(missingReceipt.productionComplete, false, "missing_receipt_manifest_must_not_complete");
assert.deepEqual(missingReceipt.missingReceiptTypes, ["production_deploy_receipt"], "missing_receipt_type_mismatch");

const rawPayload = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    raw_cloud_payload: {
      instanceId: "must-not-be-committed",
    },
  },
});
assert.equal(rawPayload.productionComplete, false, "raw_payload_manifest_must_not_complete");
assert.equal(rawPayload.cloudReleaseCandidateComplete, false, "raw_payload_manifest_must_not_claim_cloud_rc");
assert(rawPayload.rawEvidenceViolations.includes("raw_cloud_payload"), "raw_payload_violation_missing");

const missingLifecycleSection = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    lifecycle_sections: exampleManifest.lifecycle_sections.filter((section) => section.id !== "post_destroy_inventory"),
  },
});
assert.equal(missingLifecycleSection.productionComplete, false, "missing_lifecycle_section_manifest_must_not_complete");
assert.equal(missingLifecycleSection.cloudReleaseCandidateComplete, false, "missing_lifecycle_section_manifest_must_not_claim_cloud_rc");
assert.deepEqual(
  missingLifecycleSection.missingLifecycleSections,
  ["post_destroy_inventory"],
  "missing_lifecycle_section_mismatch",
);

const rawLifecyclePayload = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    lifecycle_sections: exampleManifest.lifecycle_sections.map((section) => section.id === "provider_inventory"
      ? { ...section, provider_response: { raw: "must-not-commit" } }
      : section),
  },
});
assert.equal(rawLifecyclePayload.productionComplete, false, "raw_lifecycle_payload_manifest_must_not_complete");
assert.equal(rawLifecyclePayload.cloudReleaseCandidateComplete, false, "raw_lifecycle_payload_manifest_must_not_claim_cloud_rc");
assert(rawLifecyclePayload.rawEvidenceViolations.includes("provider_response"), "raw_lifecycle_payload_violation_missing");

const wrongOperationMapping = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    receipts: exampleManifest.receipts.map((receipt) => receipt.type === "runtime_owner_receipt"
      ? { ...receipt, operation_class: "storage_lifecycle" }
      : receipt),
  },
});
assert.equal(wrongOperationMapping.productionComplete, false, "wrong_operation_mapping_manifest_must_not_complete");
assert(
  wrongOperationMapping.receiptMappingViolations.includes("runtime_owner_receipt:operation_class"),
  "wrong_operation_mapping_violation_missing",
);

const missingAuthorizationRef = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    receipts: exampleManifest.receipts.map((receipt) => receipt.type === "storage_owner_receipt"
      ? { ...receipt, authorization_ref: "" }
      : receipt),
  },
});
assert.equal(missingAuthorizationRef.productionComplete, false, "missing_authorization_ref_manifest_must_not_complete");
assert(
  missingAuthorizationRef.receiptMappingViolations.includes("storage_owner_receipt:authorization_ref"),
  "missing_authorization_ref_violation_missing",
);

const mismatchedAuthorizationRun = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    receipts: exampleManifest.receipts.map((receipt) => receipt.type === "production_deploy_receipt"
      ? { ...receipt, authorization_ref: "contracts/medopl-cloud-authorization-pack.json#different-run" }
      : receipt),
  },
});
assert.equal(mismatchedAuthorizationRun.productionComplete, false, "mismatched_authorization_run_manifest_must_not_complete");
assert(
  mismatchedAuthorizationRun.receiptMappingViolations.includes("production_deploy_receipt:authorization_ref_run_id"),
  "mismatched_authorization_run_violation_missing",
);

const missingManifestGate = runVerifyCloudReleaseCandidate([
  "--receipt-manifest",
  "tests/fixtures/v22/missing-production-receipt-manifest.json",
]);
assert.equal(missingManifestGate.status, 1, "cloud_rc_gate_missing_manifest_must_fail_closed");
const missingManifestGatePayload = JSON.parse(missingManifestGate.stdout);
assert.equal(missingManifestGatePayload.cloudReleaseCandidateComplete, false, "cloud_rc_gate_missing_manifest_must_not_complete");
assert(
  missingManifestGatePayload.blockers.includes("production_receipt_manifest_missing_or_invalid"),
  "cloud_rc_gate_missing_manifest_blocker_missing",
);

const fixtureManifestGate = runVerifyCloudReleaseCandidate([
  "--receipt-manifest",
  "tests/fixtures/v22/production-receipt-manifest.example.json",
]);
assert.equal(fixtureManifestGate.status, 0, `cloud_rc_gate_fixture_manifest_must_pass:${fixtureManifestGate.stderr || fixtureManifestGate.stdout}`);
const fixtureManifestGatePayload = JSON.parse(fixtureManifestGate.stdout);
assert.equal(fixtureManifestGatePayload.cloudReleaseCandidateComplete, true, "cloud_rc_gate_fixture_manifest_must_complete");
assert.equal(fixtureManifestGatePayload.productionComplete, false, "cloud_rc_gate_must_not_claim_production_complete");
assert.deepEqual(fixtureManifestGatePayload.rawEvidenceViolations, [], "cloud_rc_gate_fixture_must_not_embed_raw_evidence");

const cloudRcAsProductionCompleteCandidate = runVerifyProductionCompleteCandidate([
  "--receipt-manifest",
  "tests/fixtures/v22/production-receipt-manifest.example.json",
]);
assert.equal(cloudRcAsProductionCompleteCandidate.status, 1, "production_complete_candidate_gate_cloud_rc_manifest_must_fail_closed");
const cloudRcAsProductionCompleteCandidatePayload = JSON.parse(cloudRcAsProductionCompleteCandidate.stdout);
assert.equal(
  cloudRcAsProductionCompleteCandidatePayload.productionCompleteCandidateComplete,
  false,
  "production_complete_candidate_gate_cloud_rc_payload_must_not_complete",
);
assert(
  cloudRcAsProductionCompleteCandidatePayload.blockers.includes("production_receipt_manifest_production_complete_criteria_missing")
    || cloudRcAsProductionCompleteCandidatePayload.missingProductionCompleteCriteria.length > 0,
  "production_complete_candidate_gate_cloud_rc_must_report_missing_criteria",
);

const productionCompleteWithoutCriteria = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    claim: "production_complete",
    evidence_level: "production_canary",
  },
});
assert.equal(productionCompleteWithoutCriteria.productionComplete, false, "production_complete_manifest_without_criteria_must_fail_closed");
assert(
  productionCompleteWithoutCriteria.blockers.includes("production_receipt_manifest_production_complete_criteria_missing"),
  "production_complete_manifest_without_criteria_blocker_missing",
);

const productionCompleteCriteria = boundary.production_receipt_boundary.production_complete_owner_receipt_gate.required_operational_criteria.map((id) => ({
  id,
  owner: criteriaContractById.get(id)?.owner,
  status: "accepted",
  issued_at: "2026-06-23T00:00:00Z",
  evidence_ref: `.runtime/v22-cloud-authorization/run-v22-001/${id}.json`,
  evidence_hash: `sha256:${"a".repeat(64)}`,
  summary: `${id} accepted by owner receipt gate`,
  cannotClaim: ["multi-region production", "SLA proven outside this claim scope"],
}));
mkdirSync(path.join(repoRoot, testEvidenceDir), { recursive: true });
writeFileSync(path.join(repoRoot, testManifestPath), `${JSON.stringify({
  ...exampleManifest,
  claim: "production_complete",
  evidence_level: "production_canary",
  production_complete_criteria: productionCompleteCriteria,
}, null, 2)}\n`);
const productionCompleteWithCriteria = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    claim: "production_complete",
    evidence_level: "production_canary",
    production_complete_criteria: productionCompleteCriteria,
  },
});
assert.equal(productionCompleteWithCriteria.productionComplete, true, "production_complete_manifest_with_all_criteria_must_pass_shape_gate");

const productionCompleteCandidateFixtureGate = runVerifyProductionCompleteCandidate([
  "--receipt-manifest",
  testManifestPath,
]);
assert.equal(
  productionCompleteCandidateFixtureGate.status,
  0,
  `production_complete_candidate_fixture_gate_must_pass:${productionCompleteCandidateFixtureGate.stderr || productionCompleteCandidateFixtureGate.stdout}`,
);
const productionCompleteCandidateFixtureGatePayload = JSON.parse(productionCompleteCandidateFixtureGate.stdout);
assert.equal(
  productionCompleteCandidateFixtureGatePayload.productionCompleteCandidateComplete,
  true,
  "production_complete_candidate_fixture_gate_must_complete",
);
assert.equal(
  productionCompleteCandidateFixtureGatePayload.productionComplete,
  false,
  "production_complete_candidate_gate_must_not_emit_production_complete_claim",
);

const productionCompleteMissingCriterion = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    claim: "production_complete",
    evidence_level: "production_canary",
    production_complete_criteria: productionCompleteCriteria.filter((criterion) => criterion.id !== "rollback_readiness_receipt"),
  },
});
assert.equal(productionCompleteMissingCriterion.productionComplete, false, "production_complete_manifest_missing_criterion_must_fail_closed");
assert.deepEqual(
  productionCompleteMissingCriterion.missingProductionCompleteCriteria,
  ["rollback_readiness_receipt"],
  "production_complete_missing_criterion_mismatch",
);

const productionCompleteCriterionInvalidEvidenceHash = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    claim: "production_complete",
    evidence_level: "production_canary",
    production_complete_criteria: productionCompleteCriteria.map((criterion) => criterion.id === "post_release_monitoring_receipt"
      ? { ...criterion, evidence_hash: "not-a-sha256-hash" }
      : criterion),
  },
});
assert.equal(
  productionCompleteCriterionInvalidEvidenceHash.productionComplete,
  false,
  "production_complete_criterion_with_invalid_evidence_hash_must_fail_closed",
);
assert(
  productionCompleteCriterionInvalidEvidenceHash.blockers.includes(
    "production_receipt_manifest_production_complete_criterion_evidence_hash_invalid:post_release_monitoring_receipt",
  ),
  "production_complete_criterion_invalid_hash_blocker_mismatch",
);

const productionCompleteCriterionWrongOwner = evaluateProductionReceiptManifest({
  boundary,
  manifest: {
    ...exampleManifest,
    claim: "production_complete",
    evidence_level: "production_canary",
    production_complete_criteria: productionCompleteCriteria.map((criterion) => criterion.id === "production_dependency_security_receipt"
      ? { ...criterion, owner: "MedOPL Operations" }
      : criterion),
  },
});
assert.equal(
  productionCompleteCriterionWrongOwner.productionComplete,
  false,
  "production_complete_criterion_with_wrong_owner_must_fail_closed",
);
assert(
  productionCompleteCriterionWrongOwner.blockers.includes(
    "production_receipt_manifest_production_complete_criterion_owner_mismatch:production_dependency_security_receipt",
  ),
  "production_complete_criterion_wrong_owner_blocker_mismatch",
);

rmSync(path.join(repoRoot, testEvidenceDir), { recursive: true, force: true });

console.log(JSON.stringify({
  ok: true,
  contract: "v22_production_receipt_boundary",
  requiredReceipts: boundary.production_receipt_boundary.required_receipt_types.length,
}, null, 2));
