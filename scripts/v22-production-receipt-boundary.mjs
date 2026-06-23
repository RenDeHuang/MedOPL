export const PRODUCTION_RECEIPT_BOUNDARY_PATH = "contracts/medopl-production-receipt-boundary.json";

export const FORBIDDEN_RAW_MANIFEST_FIELDS = Object.freeze([
  "raw_cloud_payload",
  "raw_payload",
  "provider_response",
  "provider_payload",
  "kubeconfig",
  "secret",
  "token",
  "logs",
  "log",
  "screenshots",
  "screenshot",
  "uploaded_files",
  "uploaded_file",
  "upload_file",
  "artifacts",
  "artifact",
]);

const ALLOWED_TOP_LEVEL_FIELDS = Object.freeze([
  "schema_version",
  "kind",
  "state",
  "claim",
  "evidence_level",
  "target_environment",
  "authorization",
  "summary",
  "lifecycle_sections",
  "receipts",
  "production_complete_criteria",
]);

const ALLOWED_LIFECYCLE_SECTION_FIELDS = Object.freeze([
  "id",
  "owner",
  "status",
  "run_id",
  "issued_at",
  "operation_class",
  "resource_refs",
  "evidence_ref",
  "evidence_hash",
  "summary",
  "cannotClaim",
]);

const ALLOWED_RECEIPT_FIELDS = Object.freeze([
  "type",
  "owner",
  "status",
  "issued_at",
  "evidence_ref",
  "summary",
  "authorization_ref",
  "operation_class",
  "runner_id",
]);

const ALLOWED_PRODUCTION_COMPLETE_CRITERIA_FIELDS = Object.freeze([
  "id",
  "owner",
  "status",
  "issued_at",
  "evidence_ref",
  "evidence_hash",
  "summary",
  "cannotClaim",
]);

const RECEIPT_OPERATION_CLASSES = Object.freeze({
  runtime_owner_receipt: "tenant_runtime_provisioning",
  storage_owner_receipt: "storage_lifecycle",
  billing_owner_receipt: "billing_audit_writeback",
  audit_owner_receipt: "billing_audit_writeback",
  release_owner_receipt: "storage_lifecycle",
  opl_webui_consumer_receipt: "live_test",
  production_deploy_receipt: "deploy",
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeRuntimePointer(value) {
  const normalized = String(value || "").trim();
  return /^\.runtime(?:\/[A-Za-z0-9._*-]+)*$/u.test(normalized) && !normalized.includes("..");
}

function isSafeAuthorizationRef(value) {
  const normalized = String(value || "").trim();
  return /^contracts\/medopl-cloud-authorization-pack\.json#[A-Za-z0-9._:-]+$/u.test(normalized);
}

function isSafeRunnerId(value) {
  return /^[A-Za-z0-9_.:-]+$/u.test(String(value || "").trim());
}

function isSafeSha256Hash(value) {
  return /^sha256:[A-Za-z0-9._:-]{16,}$/u.test(String(value || "").trim());
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function asStringSet(values) {
  return new Set(Array.isArray(values) ? values.map((value) => String(value || "").trim()).filter(Boolean) : []);
}

function normalizedStringArray(values) {
  return Array.isArray(values) ? values.map((value) => String(value || "").trim()).filter(Boolean) : [];
}

function arraysMatch(left, right) {
  const normalizedLeft = normalizedStringArray(left);
  const normalizedRight = normalizedStringArray(right);
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function operationalCriteriaContractById(productionCompleteGate) {
  const items = Array.isArray(productionCompleteGate?.operational_criteria_contract)
    ? productionCompleteGate.operational_criteria_contract
    : [];
  return new Map(items
    .filter((item) => isObject(item) && String(item.id || "").trim())
    .map((item) => [String(item.id).trim(), item]));
}

function findRawEvidenceFields(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findRawEvidenceFields(item, `${prefix}[${index}]`));
  }
  if (!isObject(value)) return [];
  const violations = [];
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (FORBIDDEN_RAW_MANIFEST_FIELDS.includes(normalizedKey)) violations.push(childPath);
    violations.push(...findRawEvidenceFields(child, childPath));
  }
  return violations;
}

function collectUnexpectedFields(manifest) {
  const violations = [];
  const topAllowed = new Set(ALLOWED_TOP_LEVEL_FIELDS);
  for (const key of Object.keys(manifest || {})) {
    if (!topAllowed.has(key)) violations.push(key);
  }
  const receiptAllowed = new Set(ALLOWED_RECEIPT_FIELDS);
  const sectionAllowed = new Set(ALLOWED_LIFECYCLE_SECTION_FIELDS);
  for (const [index, section] of (manifest?.lifecycle_sections || []).entries()) {
    if (!isObject(section)) continue;
    for (const key of Object.keys(section)) {
      if (!sectionAllowed.has(key)) violations.push(`lifecycle_sections[${index}].${key}`);
    }
  }
  for (const [index, receipt] of (manifest?.receipts || []).entries()) {
    if (!isObject(receipt)) continue;
    for (const key of Object.keys(receipt)) {
      if (!receiptAllowed.has(key)) violations.push(`receipts[${index}].${key}`);
    }
  }
  const criteriaAllowed = new Set(ALLOWED_PRODUCTION_COMPLETE_CRITERIA_FIELDS);
  for (const [index, criterion] of (manifest?.production_complete_criteria || []).entries()) {
    if (!isObject(criterion)) continue;
    for (const key of Object.keys(criterion)) {
      if (!criteriaAllowed.has(key)) violations.push(`production_complete_criteria[${index}].${key}`);
    }
  }
  return violations;
}

export function validateProductionReceiptBoundary({ boundary, cloudAuthorization, releaseBoundary, uiQualityContract }) {
  const blockers = [];
  const receiptBoundary = boundary?.production_receipt_boundary || {};
  const requiredTypes = Array.isArray(receiptBoundary.required_receipt_types)
    ? receiptBoundary.required_receipt_types
    : [];
  const cloudRequiredTypes = Array.isArray(cloudAuthorization?.required_receipts_before_production_complete)
    ? cloudAuthorization.required_receipts_before_production_complete
    : [];
  const releaseOwnerReadiness = releaseBoundary?.medopl_release_boundary?.release_owner_readiness;
  const uiProductionReadiness = uiQualityContract?.medopl_portal_ui_quality_contract?.production_readiness;

  if (boundary?.state !== "active") blockers.push("production_receipt_boundary_must_be_active");
  if (boundary?.authority_boundary?.surface !== "production_complete_owner_receipt_aggregation") {
    blockers.push("production_receipt_boundary_surface_mismatch");
  }
  if (receiptBoundary.local_rc_claim_upgrade !== "forbidden") {
    blockers.push("production_receipt_boundary_local_rc_upgrade_must_be_forbidden");
  }
  if (receiptBoundary.cloud_deployable_rc_claim_upgrade !== "forbidden") {
    blockers.push("production_receipt_boundary_cloud_deployable_rc_upgrade_must_be_forbidden");
  }
  if (receiptBoundary.authorized_command_receipt_manifest_required !== true) {
    blockers.push("production_receipt_boundary_authorized_command_manifest_required");
  }
  if (receiptBoundary.receipt_operation_binding_required !== true) {
    blockers.push("production_receipt_boundary_operation_binding_required");
  }
  if (receiptBoundary.receipt_authorization_ref_required !== true) {
    blockers.push("production_receipt_boundary_authorization_ref_required");
  }
  if (receiptBoundary.receipt_runner_id_required !== true) {
    blockers.push("production_receipt_boundary_runner_id_required");
  }
  const productionCompleteGate = receiptBoundary.production_complete_owner_receipt_gate;
  if (!isObject(productionCompleteGate)) {
    blockers.push("production_receipt_boundary_production_complete_gate_missing");
  } else {
    if (productionCompleteGate.state !== "fail_closed_until_dedicated_production_complete_receipt") {
      blockers.push("production_receipt_boundary_production_complete_gate_state_mismatch");
    }
    if (productionCompleteGate.current_claimable_state !== "cloud_release_candidate_only") {
      blockers.push("production_receipt_boundary_production_complete_gate_claimable_state_mismatch");
    }
    if (productionCompleteGate.claim_upgrade_from_cloud_rc !== "forbidden") {
      blockers.push("production_receipt_boundary_production_complete_gate_cloud_rc_upgrade_must_be_forbidden");
    }
    if (productionCompleteGate.production_complete_criteria_manifest_field !== "production_complete_criteria") {
      blockers.push("production_receipt_boundary_production_complete_gate_criteria_manifest_field_mismatch");
    }
    if (productionCompleteGate.criteria_evidence_ref_policy !== "runtime_pointer_summary_only") {
      blockers.push("production_receipt_boundary_production_complete_gate_criteria_pointer_policy_mismatch");
    }
    if (productionCompleteGate.criteria_evidence_hash_policy !== "sha256_pointer_hash_required") {
      blockers.push("production_receipt_boundary_production_complete_gate_criteria_hash_policy_mismatch");
    }
    if (!isObject(productionCompleteGate.scope_policy)) {
      blockers.push("production_receipt_boundary_production_complete_gate_scope_policy_missing");
    } else {
      if (productionCompleteGate.scope_policy.default_claim_scope !== "current_authorized_canary_path_only") {
        blockers.push("production_receipt_boundary_production_complete_gate_default_scope_mismatch");
      }
      if (productionCompleteGate.scope_policy.scope_expansion_requires !== "dedicated_contract_and_evidence") {
        blockers.push("production_receipt_boundary_production_complete_gate_scope_expansion_mismatch");
      }
      if (productionCompleteGate.scope_policy.single_canary_upgrade !== "forbidden") {
        blockers.push("production_receipt_boundary_production_complete_gate_single_canary_upgrade_must_be_forbidden");
      }
    }
    const requiredGateSet = asStringSet(productionCompleteGate.required_gates);
    for (const gate of [
      "release_owner_receipt",
      "business_db_persistence_receipt",
      "security_dependency_gate",
      "browser_accessibility_regression",
      "role_boundary_browser_gate",
      "s_level_ui_polish_gate",
      "observability_receipt",
    ]) {
      if (!requiredGateSet.has(gate)) blockers.push(`production_receipt_boundary_production_complete_gate_required_gate_missing:${gate}`);
    }
    const criteria = Array.isArray(productionCompleteGate.required_operational_criteria)
      ? productionCompleteGate.required_operational_criteria.map((criterion) => String(criterion || "").trim()).filter(Boolean)
      : [];
    if (criteria.length === 0) blockers.push("production_receipt_boundary_production_complete_gate_operational_criteria_missing");
    const criteriaSet = new Set(criteria);
    const criteriaContract = Array.isArray(productionCompleteGate.operational_criteria_contract)
      ? productionCompleteGate.operational_criteria_contract
      : [];
    if (criteriaContract.length === 0) {
      blockers.push("production_receipt_boundary_production_complete_gate_operational_criteria_contract_missing");
    }
    const criteriaContractById = operationalCriteriaContractById(productionCompleteGate);
    for (const criterion of [
      "release_owner_readiness_receipt",
      "business_db_persistence_receipt",
      "production_dependency_security_receipt",
      "browser_accessibility_verification_receipt",
      "s_level_ui_polish_receipt",
      "observability_deploy_receipt",
      "rollback_readiness_receipt",
      "post_release_monitoring_receipt",
    ]) {
      if (!criteriaSet.has(criterion)) {
        blockers.push(`production_receipt_boundary_production_complete_gate_operational_criterion_missing:${criterion}`);
      }
      const contract = criteriaContractById.get(criterion);
      if (!contract) {
        blockers.push(`production_receipt_boundary_production_complete_gate_operational_criteria_contract_item_missing:${criterion}`);
      } else {
        if (!String(contract.owner || "").trim()) {
          blockers.push(`production_receipt_boundary_production_complete_gate_operational_criteria_contract_owner_missing:${criterion}`);
        }
        if (!requiredGateSet.has(String(contract.required_gate || "").trim())) {
          blockers.push(`production_receipt_boundary_production_complete_gate_operational_criteria_contract_gate_mismatch:${criterion}`);
        }
        if (!String(contract.evidence_source || "").trim()) {
          blockers.push(`production_receipt_boundary_production_complete_gate_operational_criteria_contract_evidence_source_missing:${criterion}`);
        }
        if (contract.evidence_ref_policy !== "runtime_pointer_summary_only") {
          blockers.push(`production_receipt_boundary_production_complete_gate_operational_criteria_contract_ref_policy_mismatch:${criterion}`);
        }
        if (contract.evidence_hash_policy !== "sha256_pointer_hash_required") {
          blockers.push(`production_receipt_boundary_production_complete_gate_operational_criteria_contract_hash_policy_mismatch:${criterion}`);
        }
        if (contract.raw_evidence_policy !== "forbidden") {
          blockers.push(`production_receipt_boundary_production_complete_gate_operational_criteria_contract_raw_policy_mismatch:${criterion}`);
        }
      }
    }
    if (releaseBoundary) {
      const releaseOwnerContract = criteriaContractById.get("release_owner_readiness_receipt");
      if (!isObject(releaseOwnerReadiness)) {
        blockers.push("production_receipt_boundary_release_owner_readiness_missing");
      } else {
        if (releaseOwnerReadiness.production_criterion !== "release_owner_readiness_receipt") {
          blockers.push("production_receipt_boundary_release_owner_readiness_criterion_mismatch");
        }
        if (releaseOwnerReadiness.required_gate !== "release_owner_receipt") {
          blockers.push("production_receipt_boundary_release_owner_readiness_gate_mismatch");
        }
        if (releaseOwnerReadiness.evidence_ref_policy !== "runtime_pointer_summary_only") {
          blockers.push("production_receipt_boundary_release_owner_readiness_ref_policy_mismatch");
        }
        if (releaseOwnerReadiness.evidence_hash_policy !== "sha256_pointer_hash_required") {
          blockers.push("production_receipt_boundary_release_owner_readiness_hash_policy_mismatch");
        }
        if (releaseOwnerReadiness.raw_evidence_policy !== "forbidden") {
          blockers.push("production_receipt_boundary_release_owner_readiness_raw_policy_mismatch");
        }
        if (releaseOwnerReadiness.claimable_before_owner_receipt !== false) {
          blockers.push("production_receipt_boundary_release_owner_readiness_claim_must_fail_closed");
        }
        if (releaseOwnerContract && releaseOwnerContract.owner !== releaseBoundary.owner) {
          blockers.push("production_receipt_boundary_release_owner_readiness_owner_mismatch");
        }
        if (releaseOwnerContract && releaseOwnerContract.required_gate !== releaseOwnerReadiness.required_gate) {
          blockers.push("production_receipt_boundary_release_owner_readiness_gate_contract_mismatch");
        }
        if (releaseOwnerContract && releaseOwnerContract.evidence_ref_policy !== releaseOwnerReadiness.evidence_ref_policy) {
          blockers.push("production_receipt_boundary_release_owner_readiness_ref_policy_contract_mismatch");
        }
        if (releaseOwnerContract && releaseOwnerContract.evidence_hash_policy !== releaseOwnerReadiness.evidence_hash_policy) {
          blockers.push("production_receipt_boundary_release_owner_readiness_hash_policy_contract_mismatch");
        }
        if (releaseOwnerContract && releaseOwnerContract.raw_evidence_policy !== releaseOwnerReadiness.raw_evidence_policy) {
          blockers.push("production_receipt_boundary_release_owner_readiness_raw_policy_contract_mismatch");
        }
      }
    }
    if (uiQualityContract) {
      const dependencySecurityContract = criteriaContractById.get("production_dependency_security_receipt");
      const auditGates = dependencySecurityContract?.audit_gates;
      const rootGate = uiProductionReadiness?.root_production_dependency_gate;
      const frontendGate = uiProductionReadiness?.security_dependency_gate;
      const browserAccessibilityContract = criteriaContractById.get("browser_accessibility_verification_receipt");
      const sLevelUiPolishContract = criteriaContractById.get("s_level_ui_polish_receipt");
      if (!isObject(auditGates) || !isObject(auditGates.root) || !isObject(auditGates.frontend)) {
        blockers.push("production_receipt_boundary_dependency_security_audit_gates_missing");
      } else {
        if (dependencySecurityContract.evidence_source !== "scripts/v22-repo-hygiene.mjs") {
          blockers.push("production_receipt_boundary_dependency_security_evidence_source_mismatch");
        }
        if (auditGates.root.command !== rootGate?.command) {
          blockers.push("production_receipt_boundary_dependency_security_root_command_mismatch");
        }
        if (auditGates.root.max_high_or_critical_vulnerabilities !== rootGate?.max_prod_high_or_critical_vulnerabilities) {
          blockers.push("production_receipt_boundary_dependency_security_root_threshold_mismatch");
        }
        if (auditGates.frontend.command !== frontendGate?.command) {
          blockers.push("production_receipt_boundary_dependency_security_frontend_command_mismatch");
        }
        if (auditGates.frontend.max_high_vulnerabilities !== frontendGate?.max_prod_high_vulnerabilities) {
          blockers.push("production_receipt_boundary_dependency_security_frontend_threshold_mismatch");
        }
        if (dependencySecurityContract.receipt_source_policy !== "repo_hygiene_audit_summary_only") {
          blockers.push("production_receipt_boundary_dependency_security_source_policy_mismatch");
        }
        if (dependencySecurityContract.audit_payload_policy !== "summary_counts_only_no_raw_advisory_payload") {
          blockers.push("production_receipt_boundary_dependency_security_audit_payload_policy_mismatch");
        }
      }
      if (
        !browserAccessibilityContract ||
        browserAccessibilityContract.evidence_source !== uiProductionReadiness?.accessibility_verification?.consumer ||
        !arraysMatch(browserAccessibilityContract.checks, uiProductionReadiness?.accessibility_verification?.checks)
      ) {
        blockers.push("production_receipt_boundary_browser_accessibility_checks_mismatch");
      } else {
        if (browserAccessibilityContract.required_gate !== "browser_accessibility_regression") {
          blockers.push("production_receipt_boundary_browser_accessibility_gate_mismatch");
        }
        if (browserAccessibilityContract.browser_role_boundary !== "admin_and_user_mobile_nav") {
          blockers.push("production_receipt_boundary_browser_accessibility_role_boundary_mismatch");
        }
        if (browserAccessibilityContract.receipt_source_policy !== "browser_regression_summary_only") {
          blockers.push("production_receipt_boundary_browser_accessibility_source_policy_mismatch");
        }
      }
      if (
        !sLevelUiPolishContract ||
        sLevelUiPolishContract.evidence_source !== uiProductionReadiness?.s_level_ui_polish_gate?.consumer ||
        !arraysMatch(sLevelUiPolishContract.checks, uiProductionReadiness?.s_level_ui_polish_gate?.checks)
      ) {
        blockers.push("production_receipt_boundary_s_level_ui_polish_checks_mismatch");
      } else {
        if (sLevelUiPolishContract.required_gate !== "s_level_ui_polish_gate") {
          blockers.push("production_receipt_boundary_s_level_ui_polish_gate_mismatch");
        }
        if (sLevelUiPolishContract.receipt_source_policy !== "browser_regression_summary_only") {
          blockers.push("production_receipt_boundary_s_level_ui_polish_source_policy_mismatch");
        }
      }
    }
    const observabilityContract = criteriaContractById.get("observability_deploy_receipt");
    const rollbackContract = criteriaContractById.get("rollback_readiness_receipt");
    const monitoringContract = criteriaContractById.get("post_release_monitoring_receipt");
    const deployOperation = (cloudAuthorization?.active_pack?.operation_class_command_map || [])
      .find((entry) => entry?.operation_class === "deploy");
    const rollbackCommands = cloudAuthorization?.active_pack?.rollback_commands || [];
    if (
      !observabilityContract ||
      observabilityContract.evidence_source !== "scripts/cloud-rollout/medopl.mjs" ||
      !arraysMatch(observabilityContract.runbook_commands, [
        "npm run cloud:goal -- --operation deploy",
        "npm run cloud:rollout:availability",
      ]) ||
      !arraysMatch(observabilityContract.required_observability_checks, [
        "deployment_image",
        "pod_status",
        "routing_diagnostics",
        "healthz_json",
        "readyz_json",
      ])
    ) {
      blockers.push("production_receipt_boundary_observability_deploy_runbook_mismatch");
    } else {
      if (!deployOperation?.receipt_types?.includes("production_deploy_receipt")) {
        blockers.push("production_receipt_boundary_observability_deploy_receipt_type_mismatch");
      }
      if (observabilityContract.receipt_source_policy !== "cloud_rollout_summary_only") {
        blockers.push("production_receipt_boundary_observability_deploy_source_policy_mismatch");
      }
      if (observabilityContract.raw_log_policy !== "forbidden") {
        blockers.push("production_receipt_boundary_observability_deploy_raw_log_policy_mismatch");
      }
    }
    if (
      !rollbackContract ||
      rollbackContract.evidence_source !== "scripts/cloud-rollout/medopl.mjs" ||
      !arraysMatch(rollbackContract.runbook_commands, [
        "npm run cloud:goal -- --operation deploy",
        "node scripts/cloud-rollout/medopl.mjs --rollback",
      ]) ||
      !arraysMatch(rollbackContract.rollback_commands, rollbackCommands)
    ) {
      blockers.push("production_receipt_boundary_rollback_readiness_commands_mismatch");
    } else {
      if (cloudAuthorization?.active_pack?.rollback_owner !== rollbackContract.owner) {
        blockers.push("production_receipt_boundary_rollback_readiness_owner_mismatch");
      }
      if (rollbackContract.receipt_source_policy !== "cloud_rollout_summary_only") {
        blockers.push("production_receipt_boundary_rollback_readiness_source_policy_mismatch");
      }
      if (rollbackContract.raw_log_policy !== "forbidden") {
        blockers.push("production_receipt_boundary_rollback_readiness_raw_log_policy_mismatch");
      }
    }
    if (
      !monitoringContract ||
      monitoringContract.evidence_source !== "scripts/cloud-rollout/medopl.mjs" ||
      !arraysMatch(monitoringContract.runbook_commands, ["npm run cloud:rollout:availability"]) ||
      !arraysMatch(monitoringContract.required_monitoring_checks, [
        "healthz_json",
        "readyz_json",
        "no_static_html",
        "no_secret_text",
      ])
    ) {
      blockers.push("production_receipt_boundary_post_release_monitoring_checks_mismatch");
    } else {
      if (monitoringContract.receipt_source_policy !== "cloud_rollout_summary_only") {
        blockers.push("production_receipt_boundary_post_release_monitoring_source_policy_mismatch");
      }
      if (monitoringContract.raw_log_policy !== "forbidden") {
        blockers.push("production_receipt_boundary_post_release_monitoring_raw_log_policy_mismatch");
      }
    }
    const nonGoalSet = asStringSet(productionCompleteGate.explicit_non_goals_until_dedicated_contract);
    for (const nonGoal of [
      "multi_region_production",
      "sla_proven",
      "enterprise_compliance",
      "ongoing_authorization",
      "unobserved_tenants_or_resources",
    ]) {
      if (!nonGoalSet.has(nonGoal)) blockers.push(`production_receipt_boundary_production_complete_gate_non_goal_missing:${nonGoal}`);
    }
  }
  if (requiredTypes.length !== 7) blockers.push("production_receipt_boundary_must_require_7_receipts");
  if (requiredTypes.join("\u0000") !== cloudRequiredTypes.join("\u0000")) {
    blockers.push("production_receipt_boundary_must_match_cloud_authorization_required_receipts");
  }
  if (!isSafeRuntimePointer(receiptBoundary.receipt_manifest_path_pattern)) {
    blockers.push("production_receipt_boundary_manifest_path_must_be_runtime_pointer");
  }
  const forbiddenLevels = asStringSet(receiptBoundary.forbidden_completion_evidence_levels);
  for (const level of ["local_rc", "cloud_deployable_rc"]) {
    if (!forbiddenLevels.has(level)) blockers.push(`production_receipt_boundary_forbidden_evidence_level_missing:${level}`);
  }
  const allowedLevels = asStringSet(receiptBoundary.allowed_completion_evidence_levels);
  if (allowedLevels.size === 0) blockers.push("production_receipt_boundary_allowed_completion_levels_missing");
  if (receiptBoundary.lifecycle_section_evidence_hash_policy !== "sha256_pointer_hash_required") {
    blockers.push("production_receipt_boundary_lifecycle_hash_policy_mismatch");
  }

  const rawFields = asStringSet(receiptBoundary.forbidden_raw_manifest_fields);
  for (const field of FORBIDDEN_RAW_MANIFEST_FIELDS) {
    if (!rawFields.has(field)) blockers.push(`production_receipt_boundary_forbidden_raw_field_missing:${field}`);
  }

  return Object.freeze({
    ok: blockers.length === 0,
    blockers: Object.freeze(blockers),
    requiredReceiptTypes: Object.freeze([...requiredTypes]),
  });
}

export function evaluateProductionReceiptManifest({ boundary, manifest }) {
  const receiptBoundary = boundary?.production_receipt_boundary || {};
  const requiredTypes = Array.isArray(receiptBoundary.required_receipt_types)
    ? receiptBoundary.required_receipt_types.map(String)
    : [];
  const requiredLifecycleSections = Array.isArray(receiptBoundary.required_lifecycle_sections)
    ? receiptBoundary.required_lifecycle_sections.map(String)
    : [];
  const allowedCompletionLevels = asStringSet(receiptBoundary.allowed_completion_evidence_levels);
  const forbiddenCompletionLevels = asStringSet(receiptBoundary.forbidden_completion_evidence_levels);
  const completionState = String(receiptBoundary.production_complete_state || "complete");
  const productionCompleteGate = receiptBoundary.production_complete_owner_receipt_gate || {};
  const criteriaContractById = operationalCriteriaContractById(productionCompleteGate);
  const requiredProductionCompleteCriteria = Array.isArray(productionCompleteGate.required_operational_criteria)
    ? productionCompleteGate.required_operational_criteria.map(String)
    : [];
  const blockers = [];

  if (!isObject(manifest)) {
    return Object.freeze({
      productionComplete: false,
      cloudReleaseCandidateComplete: false,
      blockers: Object.freeze(["production_receipt_manifest_missing_or_invalid"]),
      missingReceiptTypes: Object.freeze([...requiredTypes]),
      missingLifecycleSections: Object.freeze([...requiredLifecycleSections]),
      missingProductionCompleteCriteria: Object.freeze([...requiredProductionCompleteCriteria]),
      rawEvidenceViolations: Object.freeze([]),
      unexpectedFieldViolations: Object.freeze([]),
    });
  }

  if (manifest.kind !== "medopl_production_receipt_manifest") {
    blockers.push("production_receipt_manifest_kind_mismatch");
  }
  if (!["cloud_release_candidate", "production_complete"].includes(manifest.claim)) {
    blockers.push("production_receipt_manifest_claim_mismatch");
  }
  if (manifest.state !== completionState) {
    blockers.push(`production_receipt_manifest_state_mismatch:${manifest.state || "(missing)"}`);
  }
  if (forbiddenCompletionLevels.has(manifest.evidence_level)) {
    blockers.push(`production_receipt_manifest_forbidden_evidence_level:${manifest.evidence_level}`);
  }
  if (!allowedCompletionLevels.has(manifest.evidence_level)) {
    blockers.push(`production_receipt_manifest_evidence_level_not_allowed:${manifest.evidence_level || "(missing)"}`);
  }
  if (!Array.isArray(manifest.receipts)) {
    blockers.push("production_receipt_manifest_receipts_missing");
  }

  const receipts = Array.isArray(manifest.receipts) ? manifest.receipts : [];
  const lifecycleSections = Array.isArray(manifest.lifecycle_sections) ? manifest.lifecycle_sections : [];
  const productionCompleteCriteria = Array.isArray(manifest.production_complete_criteria)
    ? manifest.production_complete_criteria
    : [];
  const receiptTypes = receipts.map((receipt) => String(receipt?.type || "").trim()).filter(Boolean);
  const lifecycleSectionIds = lifecycleSections.map((section) => String(section?.id || "").trim()).filter(Boolean);
  const productionCompleteCriteriaIds = productionCompleteCriteria.map((criterion) => String(criterion?.id || "").trim()).filter(Boolean);
  const missingReceiptTypes = requiredTypes.filter((type) => !receiptTypes.includes(type));
  const missingLifecycleSections = requiredLifecycleSections.filter((section) => !lifecycleSectionIds.includes(section));
  const missingProductionCompleteCriteria = manifest.claim === "production_complete"
    ? requiredProductionCompleteCriteria.filter((criterion) => !productionCompleteCriteriaIds.includes(criterion))
    : [];
  const duplicateReceiptTypes = receiptTypes.filter((type, index) => receiptTypes.indexOf(type) !== index);
  for (const duplicate of unique(duplicateReceiptTypes)) {
    blockers.push(`production_receipt_manifest_duplicate_receipt:${duplicate}`);
  }
  const duplicateProductionCriteria = productionCompleteCriteriaIds.filter((criterion, index) =>
    productionCompleteCriteriaIds.indexOf(criterion) !== index);
  for (const duplicate of unique(duplicateProductionCriteria)) {
    blockers.push(`production_receipt_manifest_duplicate_production_complete_criterion:${duplicate}`);
  }

  for (const receipt of receipts) {
    if (!requiredTypes.includes(receipt?.type)) blockers.push(`production_receipt_manifest_unknown_receipt:${receipt?.type || "(missing)"}`);
    if (!String(receipt?.owner || "").trim()) blockers.push(`production_receipt_manifest_receipt_owner_missing:${receipt?.type || "(missing)"}`);
    if (receipt?.status !== "accepted") blockers.push(`production_receipt_manifest_receipt_not_accepted:${receipt?.type || "(missing)"}`);
    if (!isSafeRuntimePointer(receipt?.evidence_ref)) blockers.push(`production_receipt_manifest_receipt_evidence_ref_invalid:${receipt?.type || "(missing)"}`);
    if (!String(receipt?.summary || "").trim()) blockers.push(`production_receipt_manifest_receipt_summary_missing:${receipt?.type || "(missing)"}`);
  }
  for (const section of lifecycleSections) {
    const id = String(section?.id || "").trim();
    if (!requiredLifecycleSections.includes(id)) blockers.push(`production_receipt_manifest_unknown_lifecycle_section:${id || "(missing)"}`);
    if (!String(section?.owner || "").trim()) blockers.push(`production_receipt_manifest_lifecycle_owner_missing:${id || "(missing)"}`);
    if (section?.status !== "done") blockers.push(`production_receipt_manifest_lifecycle_not_done:${id || "(missing)"}`);
    if (!String(section?.run_id || "").trim()) blockers.push(`production_receipt_manifest_lifecycle_run_id_missing:${id || "(missing)"}`);
    if (!isSafeRuntimePointer(section?.evidence_ref)) blockers.push(`production_receipt_manifest_lifecycle_evidence_ref_invalid:${id || "(missing)"}`);
    if (!isSafeSha256Hash(section?.evidence_hash)) blockers.push(`production_receipt_manifest_lifecycle_evidence_hash_invalid:${id || "(missing)"}`);
    if (!String(section?.summary || "").trim()) blockers.push(`production_receipt_manifest_lifecycle_summary_missing:${id || "(missing)"}`);
    if (!Array.isArray(section?.cannotClaim)) blockers.push(`production_receipt_manifest_lifecycle_cannot_claim_missing:${id || "(missing)"}`);
  }
  if (manifest.claim === "production_complete") {
    if (!Array.isArray(manifest.production_complete_criteria)) {
      blockers.push("production_receipt_manifest_production_complete_criteria_missing");
    }
    for (const criterion of productionCompleteCriteria) {
      const id = String(criterion?.id || "").trim();
      if (!requiredProductionCompleteCriteria.includes(id)) {
        blockers.push(`production_receipt_manifest_unknown_production_complete_criterion:${id || "(missing)"}`);
      }
      if (!String(criterion?.owner || "").trim()) blockers.push(`production_receipt_manifest_production_complete_criterion_owner_missing:${id || "(missing)"}`);
      const criterionContract = criteriaContractById.get(id);
      if (criterionContract && criterion?.owner !== criterionContract.owner) {
        blockers.push(`production_receipt_manifest_production_complete_criterion_owner_mismatch:${id || "(missing)"}`);
      }
      if (criterion?.status !== "accepted") blockers.push(`production_receipt_manifest_production_complete_criterion_not_accepted:${id || "(missing)"}`);
      if (!String(criterion?.issued_at || "").trim()) blockers.push(`production_receipt_manifest_production_complete_criterion_issued_at_missing:${id || "(missing)"}`);
      if (!isSafeRuntimePointer(criterion?.evidence_ref)) blockers.push(`production_receipt_manifest_production_complete_criterion_evidence_ref_invalid:${id || "(missing)"}`);
      if (!isSafeSha256Hash(criterion?.evidence_hash)) blockers.push(`production_receipt_manifest_production_complete_criterion_evidence_hash_invalid:${id || "(missing)"}`);
      if (!String(criterion?.summary || "").trim()) blockers.push(`production_receipt_manifest_production_complete_criterion_summary_missing:${id || "(missing)"}`);
      if (!Array.isArray(criterion?.cannotClaim)) blockers.push(`production_receipt_manifest_production_complete_criterion_cannot_claim_missing:${id || "(missing)"}`);
    }
  }

  const rawEvidenceViolations = unique(findRawEvidenceFields(manifest).map((field) => field.split(".").at(-1) || field));
  const unexpectedFieldViolations = collectUnexpectedFields(manifest);
  const receiptMappingViolations = [];
  const expectedAuthorizationRef = manifest?.authorization?.run_id
    ? `contracts/medopl-cloud-authorization-pack.json#${manifest.authorization.run_id}`
    : "";
  for (const receipt of receipts) {
    const type = String(receipt?.type || "").trim();
    if (!type) continue;
    const expectedOperationClass = RECEIPT_OPERATION_CLASSES[type];
    if (expectedOperationClass && receipt?.operation_class !== expectedOperationClass) {
      receiptMappingViolations.push(`${type}:operation_class`);
    }
    if (!isSafeAuthorizationRef(receipt?.authorization_ref)) {
      receiptMappingViolations.push(`${type}:authorization_ref`);
    } else if (expectedAuthorizationRef && receipt.authorization_ref !== expectedAuthorizationRef) {
      receiptMappingViolations.push(`${type}:authorization_ref_run_id`);
    }
    if (!isSafeRunnerId(receipt?.runner_id)) {
      receiptMappingViolations.push(`${type}:runner_id`);
    }
  }
  if (rawEvidenceViolations.length > 0) blockers.push("production_receipt_manifest_embeds_raw_evidence");
  if (unexpectedFieldViolations.length > 0) blockers.push("production_receipt_manifest_unexpected_fields");
  if (receiptMappingViolations.length > 0) blockers.push("production_receipt_manifest_receipt_mapping_invalid");

  const complete = blockers.length === 0 &&
    missingReceiptTypes.length === 0 &&
    missingLifecycleSections.length === 0 &&
    missingProductionCompleteCriteria.length === 0;
  return Object.freeze({
    cloudReleaseCandidateComplete: complete,
    productionComplete: complete && manifest.claim === "production_complete",
    blockers: Object.freeze(unique(blockers)),
    missingReceiptTypes: Object.freeze(missingReceiptTypes),
    missingLifecycleSections: Object.freeze(missingLifecycleSections),
    missingProductionCompleteCriteria: Object.freeze(missingProductionCompleteCriteria),
    rawEvidenceViolations: Object.freeze(rawEvidenceViolations),
    unexpectedFieldViolations: Object.freeze(unexpectedFieldViolations),
    receiptMappingViolations: Object.freeze(unique(receiptMappingViolations)),
  });
}
