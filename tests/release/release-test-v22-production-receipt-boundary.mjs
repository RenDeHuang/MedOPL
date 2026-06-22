import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import {
  evaluateProductionReceiptManifest,
  validateProductionReceiptBoundary,
} from "../../scripts/v22-production-receipt-boundary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

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

const [boundary, cloudAuthorization, exampleManifest] = await Promise.all([
  readJson("contracts/medopl-production-receipt-boundary.json"),
  readJson("contracts/medopl-cloud-authorization-pack.json"),
  readJson("tests/fixtures/v22/production-receipt-manifest.example.json"),
]);

const boundaryResult = validateProductionReceiptBoundary({ boundary, cloudAuthorization });
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
  owner: "MedOPL Operations",
  status: "accepted",
  issued_at: "2026-06-23T00:00:00Z",
  evidence_ref: `.runtime/v22-cloud-authorization/run-v22-001/${id}.json`,
  evidence_hash: `sha256:${"a".repeat(64)}`,
  summary: `${id} accepted by owner receipt gate`,
  cannotClaim: ["multi-region production", "SLA proven outside this claim scope"],
}));
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

console.log(JSON.stringify({
  ok: true,
  contract: "v22_production_receipt_boundary",
  requiredReceipts: boundary.production_receipt_boundary.required_receipt_types.length,
}, null, 2));
