import { liveLabelValue } from "./v19-live-labels.mjs";

function requiredString(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name}_required`);
  return normalized;
}

function requireUsableLabel(value, name) {
  const original = requiredString(value, name);
  const normalized = liveLabelValue(original);
  if (!normalized || normalized === "unknown") {
    throw new Error(`${name}_label_empty`);
  }
  return original;
}

function requireTestScopedLabel(value, name) {
  const original = requireUsableLabel(value, name);
  if (!liveLabelValue(original).startsWith("test-")) {
    throw new Error(`${name}_must_start_with_test-`);
  }
  return original;
}

export function validateLiveTkeContext(input = {}) {
  return {
    tenantId: requireUsableLabel(input.tenantId, "tenantId"),
    workspaceId: requireTestScopedLabel(input.workspaceId, "workspaceId"),
    resourceOrderId: requireUsableLabel(input.resourceOrderId, "resourceOrderId"),
    runId: requireTestScopedLabel(input.runId, "runId"),
    serverPlanId: requireUsableLabel(input.serverPlanId, "serverPlanId"),
  };
}
