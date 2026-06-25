export function canaryAdmissionReceiptFromGate(payload = {}) {
  const admission = payload?.canaryAdmission;
  if (!admission || typeof admission !== "object") return null;
  const allowed = "enabled allowed decision reason enabledBy tenantScopeHash userScopeHash costCeiling monitoringOwner rollbackOwner disableCommandRef admissionReceiptId".split(" ");
  const receipt = Object.fromEntries(allowed.filter((key) => Object.hasOwn(admission, key)).map((key) => [key, admission[key]]));
  return receipt.decision ? receipt : null;
}

export function canaryAdmissionRequired(env = process.env) {
  return ["1", "true", "yes", "on", "enabled"].includes(String(env.MEDOPL_CANARY_ADMISSION_ENABLED || "").trim().toLowerCase());
}

export function canaryEmergencyStopRequired(env = process.env) {
  return ["1", "true", "yes", "on", "enabled"].includes(String(env.MEDOPL_CANARY_EMERGENCY_STOP || "").trim().toLowerCase());
}

export function assertCanaryAdmissionAllowed({ receipt, operation, required = canaryAdmissionRequired(), fail }) {
  if (!required) return;
  if (!receipt || receipt.enabled !== true || receipt.allowed !== true || receipt.decision !== "allowed") {
    fail("production_goal_live_test_canary_admission_required", {
      operationClass: operation,
      canaryAdmissionReceipt: receipt || null,
    }, 1);
  }
  for (const field of ["tenantScopeHash", "userScopeHash", "costCeiling", "monitoringOwner", "rollbackOwner", "disableCommandRef", "admissionReceiptId"]) {
    if (receipt[field] === undefined || receipt[field] === null || receipt[field] === "") {
      fail("production_goal_live_test_canary_admission_receipt_incomplete", {
        operationClass: operation,
        missingField: field,
        canaryAdmissionReceipt: receipt,
      }, 1);
    }
  }
}

export async function probeUnlistedCanaryUser({
  liveRequest,
  tenantId,
  workspaceId,
  operation,
  required = canaryAdmissionRequired(),
  emergencyStop = canaryEmergencyStopRequired(),
  fail,
}) {
  if (!required || emergencyStop) return null;
  const unlistedUserId = "user-unlisted-canary";
  const denied = await liveRequest({
    path: "/api/opl/runtime-gate",
    method: "POST",
    body: { tenantId, portalUserId: unlistedUserId, workspaceId, invocationMode: "runtime_required" },
    identity: { tenantId, portalUserId: unlistedUserId, workspaceId },
    stepId: "canary_admission_unlisted_user",
    allowFailure: true,
  });
  const receipt = canaryAdmissionReceiptFromGate(denied);
  if (denied.httpStatus !== 403 || !receipt || receipt.allowed !== false || receipt.decision !== "denied") {
    fail("production_goal_live_test_canary_admission_unlisted_user_not_denied", {
      operationClass: operation,
      status: denied.httpStatus || 0,
      canaryAdmissionReceipt: receipt || null,
    }, 1);
  }
  return receipt;
}
