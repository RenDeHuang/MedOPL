const REQUIRED_JOURNEY_STEPS = [
  "admin_create_user",
  "admin_recharge",
  "portal_user_login",
  "opl_user_login_with_gflabtoken",
  "portal_create_node_and_storage",
  "portal_pending_bill_visible",
  "opl_send_message",
  "opl_upload_file",
  "opl_run_task",
  "opl_download_output",
  "portal_workspace_file_visible",
  "portal_billing_visible",
  "portal_trace_visible",
  "delete_server",
  "billing_stopped",
  "l3_exact_settlement",
];

const SENSITIVE_PATTERNS = [
  new RegExp("q-" + "ak=", "i"),
  new RegExp("q-" + "signature=", "i"),
  new RegExp("x-cos-security-" + "token=", "i"),
  new RegExp("q-sign-" + "time=", "i"),
  new RegExp("AK" + "ID[A-Za-z0-9_-]+"),
  /authorization/i,
  /cookie/i,
];

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /signedUrl/i,
  /signed_url/i,
];

function stringValue(value) {
  return String(value ?? "").trim();
}

function requireString(value, field) {
  const text = stringValue(value);
  if (!text) throw new Error(`commercial_ops_evidence_missing:${field}`);
  return text;
}

function requireArray(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`commercial_ops_evidence_missing:${field}`);
  }
  return value;
}

function assertNoSensitiveValues(value, path = "evidence") {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(value)) throw new Error(`commercial_ops_evidence_sensitive_value:${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveValues(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
        throw new Error(`commercial_ops_evidence_sensitive_key:${path}.${key}`);
      }
      assertNoSensitiveValues(item, `${path}.${key}`);
    }
  }
}

function stepNames(evidence = {}) {
  return (Array.isArray(evidence.steps) ? evidence.steps : [])
    .map((item) => stringValue(item.name || item.step))
    .filter(Boolean);
}

function assertRequiredSteps(evidence = {}) {
  const names = stepNames(evidence);
  const missing = REQUIRED_JOURNEY_STEPS.filter((step) => !names.includes(step));
  if (missing.length) {
    throw new Error(`commercial_ops_evidence_missing_steps:${missing.join(",")}`);
  }
}

function assertAttribution(evidence = {}) {
  const target = evidence.target || {};
  requireString(target.tenantId, "target.tenantId");
  requireString(target.userId, "target.userId");
  requireString(target.workspaceId, "target.workspaceId");
  requireString(target.resourceOrderId, "target.resourceOrderId");
  requireString(target.runId, "target.runId");
  requireString(target.serverPlanId, "target.serverPlanId");
}

function assertCloudResources(evidence = {}) {
  const resources = evidence.cloudResources || {};
  requireString(resources.nodePoolId, "cloudResources.nodePoolId");
  requireArray(resources.cvmInstanceIds, "cloudResources.cvmInstanceIds");
  if (!Array.isArray(resources.cosKeys) && !Array.isArray(resources.pvcNames)) {
    throw new Error("commercial_ops_evidence_missing:cloudResources.cosKeys_or_pvcNames");
  }
}

function assertBilling(evidence = {}) {
  const billing = evidence.billing || {};
  requireString(billing.billingStartedAt, "billing.billingStartedAt");
  requireString(billing.billingStoppedAt, "billing.billingStoppedAt");
  requireString(billing.earliestExactWriteAt, "billing.earliestExactWriteAt");
  if (Number(billing.l3ExactWaitMinutes) !== 120) {
    throw new Error("commercial_ops_evidence_l3_wait_must_equal_120");
  }
  requireString(billing.exactSource, "billing.exactSource");
  if (billing.exactSource !== "DescribeBillDetail") {
    throw new Error(`commercial_ops_evidence_invalid_exact_source:${billing.exactSource}`);
  }
  requireString(billing.settlementAction, "billing.settlementAction");
  if (!["charged", "refund", "makeup_charge", "unattributed"].includes(billing.settlementAction)) {
    throw new Error(`commercial_ops_evidence_invalid_settlement_action:${billing.settlementAction}`);
  }
  if (billing.settlementAction !== "unattributed") {
    requireString(billing.matchedResourceId, "billing.matchedResourceId");
    requireString(billing.resourceMappingId, "billing.resourceMappingId");
    requireArray(billing.ledgerIds, "billing.ledgerIds");
  }
}

function assertPortalAndOpl(evidence = {}) {
  const portal = evidence.portal || {};
  const opl = evidence.opl || {};
  requireString(portal.baseUrl, "portal.baseUrl");
  requireString(opl.baseUrl, "opl.baseUrl");
  if (opl.providerKeySource !== "gflabtoken") {
    throw new Error(`commercial_ops_evidence_invalid_provider_key_source:${opl.providerKeySource || ""}`);
  }
  if (opl.onePersonLabUpstreamClean !== true) {
    throw new Error("commercial_ops_evidence_upstream_must_stay_clean");
  }
}

export function requiredCommercialOpsJourneySteps() {
  return [...REQUIRED_JOURNEY_STEPS];
}

export function validateCommercialOpsJourneyEvidence(evidence = {}) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error("commercial_ops_evidence_must_be_object");
  }
  assertNoSensitiveValues(evidence);
  assertAttribution(evidence);
  assertPortalAndOpl(evidence);
  assertCloudResources(evidence);
  assertBilling(evidence);
  assertRequiredSteps(evidence);
  return {
    ok: true,
    stepCount: stepNames(evidence).length,
    requiredStepCount: REQUIRED_JOURNEY_STEPS.length,
  };
}
