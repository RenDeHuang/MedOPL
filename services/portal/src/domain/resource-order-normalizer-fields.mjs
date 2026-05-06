import { randomUUID } from "node:crypto";

import { moneyAmount } from "./wallet-ledger.mjs";
import { normalizeCloudResourceIds } from "./resource-order-normalizer-objects.mjs";

export function normalizeResourceOrderFields({
  now = new Date().toISOString(),
  order = {},
  status,
  statuses,
}) {
  const identity = resourceOrderRequiredIdentity(order);
  if (!identity) return null;
  return {
    ...identity,
    status: statuses.has(status) ? status : "quoted",
    ...resourceOrderFieldGroups(order, now),
  };
}

function resourceOrderFieldGroups(order = {}, now = new Date().toISOString()) {
  return {
    ...resourceOrderPlanFields(order),
    ...resourceOrderStorageFields(order),
    ...resourceOrderLifecycleFields(order),
    ...resourceOrderCloudFields(order),
    ...resourceOrderMoneyFields(order),
    ...resourceOrderSourceFields(order),
    ...resourceOrderTimeFields(order, now),
  };
}

function resourceOrderRequiredIdentity(order = {}) {
  const id = String(order.id || randomUUID()).trim();
  const userId = String(order.userId || order.portalUserId || order.portal_user_id || order.tenantId || "").trim();
  const workspaceId = String(order.workspaceId || order.workspace_id || "").trim();
  if (!id || !userId || !workspaceId) return null;
  return resourceOrderIdentityFields({ id, order, userId, workspaceId });
}

function resourceOrderIdentityFields({ id, order = {}, userId = "", workspaceId = "" }) {
  return {
    id,
    tenantId: String(order.tenantId || order.tenant_id || userId).trim() || userId,
    userId,
    portalUserId: String(order.portalUserId || order.portal_user_id || userId).trim() || userId,
    workspaceId,
    workspaceSessionId: String(order.workspaceSessionId || order.workspace_session_id || "").trim(),
    runId: String(order.runId || order.run_id || "").trim(),
    billingAccountId: String(order.billingAccountId || order.billing_account_id || userId).trim() || userId,
  };
}

function resourceOrderPlanFields(order = {}) {
  return {
    serverPlanId: String(order.serverPlanId || order.server_plan_id || "").trim(),
    region: String(order.region || "").trim(),
    zone: String(order.zone || "").trim(),
    cpu: Number(order.cpu || 0),
    memoryGb: Number(order.memoryGb || order.memory_gb || 0),
    gpuType: String(order.gpuType || order.gpu_type || "").trim(),
    gpuCount: Number(order.gpuCount || order.gpu_count || order.gpu || 0),
  };
}

function resourceOrderStorageFields(order = {}) {
  return {
    storagePlanId: String(order.storagePlanId || order.storage_plan_id || "workspace-default").trim() || "workspace-default",
    storageSizeGb: Number(order.storageSizeGb ?? order.storage_size_gb ?? 0),
    retentionPolicy: String(order.retentionPolicy || order.retention_policy || "retain").trim() || "retain",
  };
}

function resourceOrderLifecycleFields(order = {}) {
  return {
    estimatedHours: Number(order.estimatedHours || order.estimated_hours || 1),
    autoStopAt: String(order.autoStopAt || order.auto_stop_at || "").trim(),
    quoteId: String(order.quoteId || order.quote_id || "").trim(),
    freezeId: String(order.freezeId || order.freeze_id || "").trim(),
    provisionRequestId: String(order.provisionRequestId || order.provision_request_id || "").trim(),
  };
}

function resourceOrderCloudFields(order = {}) {
  return {
    cloudResourceIds: normalizeCloudResourceIds(order.cloudResourceIds || order.cloud_resource_ids_json),
  };
}

function resourceOrderMoneyFields(order = {}) {
  return {
    currency: String(order.currency || "CNY").trim() || "CNY",
    unitPrice: moneyAmount(order.unitPrice ?? order.unit_price ?? 0, 0),
    minBillableHours: Number(order.minBillableHours || order.min_billable_hours || 1),
    riskFactor: Number(order.riskFactor || order.risk_factor || 1),
    quoteAmount: moneyAmount(order.quoteAmount ?? order.quote_amount ?? 0, 0),
    freezeAmount: moneyAmount(order.freezeAmount ?? order.freeze_amount ?? order.quoteAmount ?? order.quote_amount ?? 0, 0),
    exactCost: order.exactCost === undefined && order.exact_cost === undefined ? null : moneyAmount(order.exactCost ?? order.exact_cost, 0),
  };
}

function resourceOrderSourceFields(order = {}) {
  return {
    pricingSource: String(order.pricingSource || order.pricing_source || "").trim(),
    priceUpdatedAt: String(order.priceUpdatedAt || order.price_updated_at || "").trim(),
    idempotencyKey: String(order.idempotencyKey || order.idempotency_key || "").trim(),
  };
}

function resourceOrderTimeFields(order = {}, now = new Date().toISOString()) {
  return {
    createdAt: String(order.createdAt || order.created_at || now).trim() || now,
    updatedAt: String(order.updatedAt || order.updated_at || now).trim() || now,
    settledAt: String(order.settledAt || order.settled_at || "").trim(),
    pendingStoppedAt: String(order.pendingStoppedAt || order.pending_stopped_at || "").trim(),
    billingStoppedAt: String(order.billingStoppedAt || order.billing_stopped_at || "").trim(),
    failedReason: String(order.failedReason || order.failed_reason || "").trim(),
  };
}
