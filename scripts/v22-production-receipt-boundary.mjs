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

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function asStringSet(values) {
  return new Set(Array.isArray(values) ? values.map((value) => String(value || "").trim()).filter(Boolean) : []);
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
  return violations;
}

export function validateProductionReceiptBoundary({ boundary, cloudAuthorization }) {
  const blockers = [];
  const receiptBoundary = boundary?.production_receipt_boundary || {};
  const requiredTypes = Array.isArray(receiptBoundary.required_receipt_types)
    ? receiptBoundary.required_receipt_types
    : [];
  const cloudRequiredTypes = Array.isArray(cloudAuthorization?.required_receipts_before_production_complete)
    ? cloudAuthorization.required_receipts_before_production_complete
    : [];

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
  const blockers = [];

  if (!isObject(manifest)) {
    return Object.freeze({
      productionComplete: false,
      cloudReleaseCandidateComplete: false,
      blockers: Object.freeze(["production_receipt_manifest_missing_or_invalid"]),
      missingReceiptTypes: Object.freeze([...requiredTypes]),
      missingLifecycleSections: Object.freeze([...requiredLifecycleSections]),
      rawEvidenceViolations: Object.freeze([]),
      unexpectedFieldViolations: Object.freeze([]),
    });
  }

  if (manifest.kind !== "medopl_production_receipt_manifest") {
    blockers.push("production_receipt_manifest_kind_mismatch");
  }
  if (manifest.claim !== "production_complete") {
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
  const receiptTypes = receipts.map((receipt) => String(receipt?.type || "").trim()).filter(Boolean);
  const lifecycleSectionIds = lifecycleSections.map((section) => String(section?.id || "").trim()).filter(Boolean);
  const missingReceiptTypes = requiredTypes.filter((type) => !receiptTypes.includes(type));
  const missingLifecycleSections = requiredLifecycleSections.filter((section) => !lifecycleSectionIds.includes(section));
  const duplicateReceiptTypes = receiptTypes.filter((type, index) => receiptTypes.indexOf(type) !== index);
  for (const duplicate of unique(duplicateReceiptTypes)) {
    blockers.push(`production_receipt_manifest_duplicate_receipt:${duplicate}`);
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
    if (!String(section?.evidence_hash || "").trim()) blockers.push(`production_receipt_manifest_lifecycle_hash_missing:${id || "(missing)"}`);
    if (!String(section?.summary || "").trim()) blockers.push(`production_receipt_manifest_lifecycle_summary_missing:${id || "(missing)"}`);
    if (!Array.isArray(section?.cannotClaim)) blockers.push(`production_receipt_manifest_lifecycle_cannot_claim_missing:${id || "(missing)"}`);
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

  return Object.freeze({
    cloudReleaseCandidateComplete: blockers.length === 0 && missingReceiptTypes.length === 0 && missingLifecycleSections.length === 0,
    productionComplete: blockers.length === 0 && missingReceiptTypes.length === 0 && missingLifecycleSections.length === 0,
    blockers: Object.freeze(unique(blockers)),
    missingReceiptTypes: Object.freeze(missingReceiptTypes),
    missingLifecycleSections: Object.freeze(missingLifecycleSections),
    rawEvidenceViolations: Object.freeze(rawEvidenceViolations),
    unexpectedFieldViolations: Object.freeze(unexpectedFieldViolations),
    receiptMappingViolations: Object.freeze(unique(receiptMappingViolations)),
  });
}
