import { normalizeCloudResourceIds } from "./resource-order-normalizers.mjs";
import {
  RESOURCE_ORDER_PENDING_STOP_STATUSES,
  RESOURCE_ORDER_STATUSES,
} from "./resource-order-statuses.mjs";

export function transitionResourceOrderRecord(target, { status, payload = {} }) {
  const nextStatus = String(status || "").trim().toLowerCase();
  if (!RESOURCE_ORDER_STATUSES.has(nextStatus)) {
    return { ok: false, status: 400, error: "invalid_resource_order_status" };
  }
  target.status = nextStatus;
  applyResourceOrderTransitionPayload(target, payload);
  applyResourceOrderTransitionStatus(target, nextStatus, payload);
  target.updatedAt = new Date().toISOString();
  return { ok: true, order: target, nextStatus };
}

function applyResourceOrderTransitionPayload(target, payload = {}) {
  if (payload.runId) target.runId = String(payload.runId);
  if (payload.workspaceSessionId) target.workspaceSessionId = String(payload.workspaceSessionId);
  if (payload.billingAccountId) target.billingAccountId = String(payload.billingAccountId);
  if (payload.cloudResourceIds) target.cloudResourceIds = normalizeCloudResourceIds(payload.cloudResourceIds);
}

function applyResourceOrderTransitionStatus(target, nextStatus, payload = {}) {
  if (nextStatus === "settled") target.settledAt = new Date().toISOString();
  if (RESOURCE_ORDER_PENDING_STOP_STATUSES.has(nextStatus)) {
    target.pendingStoppedAt = String(payload.pendingStoppedAt || payload.pending_stopped_at || new Date().toISOString());
  }
  if (nextStatus === "failed") target.failedReason = String(payload.reason || payload.error || "");
}
