import { RESOURCE_ORDER_PENDING_STOP_STATUSES } from "./resource-order-statuses.mjs";

export function resourceOrderPublicView(order, events = []) {
  const billing = resourceOrderBillingView(order);
  return {
    ...resourceOrderIdentityView(order),
    ...resourceOrderCapacityView(order),
    ...resourceOrderPricingView(order),
    ...resourceOrderStatusView(order, billing),
    ...resourceOrderTimestampView(order),
    events: sortedResourceOrderEvents(order, events),
  };
}

function resourceOrderIdentityView(order = {}) {
  return {
    id: order.id,
    status: order.status,
    tenantId: order.tenantId,
    userId: order.userId,
    billingAccountId: order.billingAccountId,
    resourceOrderId: order.id,
    workspaceId: order.workspaceId,
    workspaceSessionId: order.workspaceSessionId,
    runId: order.runId,
    serverNo: order.id,
    taskNo: order.runId || order.workspaceSessionId || order.id,
  };
}

function resourceOrderCapacityView(order = {}) {
  return {
    serverPlanId: order.serverPlanId,
    region: order.region,
    zone: order.zone,
    cpu: order.cpu,
    memoryGb: order.memoryGb,
    gpuType: order.gpuType,
    gpuCount: order.gpuCount,
    storagePlanId: order.storagePlanId,
    storageSizeGb: order.storageSizeGb,
    retentionPolicy: order.retentionPolicy,
    estimatedHours: order.estimatedHours,
    quoteId: order.quoteId,
    freezeId: order.freezeId,
    provisionRequestId: order.provisionRequestId,
    cloudResourceIds: order.cloudResourceIds,
  };
}

function resourceOrderPricingView(order = {}) {
  return {
    currency: order.currency,
    unitPrice: order.unitPrice,
    quotedAmount: order.quoteAmount,
    frozenAmount: order.freezeAmount,
    quoteAmount: order.quoteAmount,
    freezeAmount: order.freezeAmount,
    preauthAmount: order.freezeAmount,
    settlementMode: "preauth_then_t1_exact",
    settlementPolicy: resourceOrderSettlementPolicy(),
    exactCost: order.exactCost,
    pricingSource: order.pricingSource,
    priceUpdatedAt: order.priceUpdatedAt,
  };
}

function resourceOrderSettlementPolicy() {
  return {
    mode: "preauth_then_t1_exact",
    exactSource: "tencent_bill_detail_or_cos_daily_bill",
    pendingSource: "opencost_or_local_metering",
    releasePolicy: "release_unused_preauth_after_exact_bill",
  };
}

function resourceOrderStatusView(order = {}, billing = resourceOrderBillingView(order)) {
  return {
    plainStatus: plainResourceOrderStatus(order),
    usageMinutes: billing.usageMinutes,
    billingStopped: billing.billingStopped,
    billingStoppedAt: billing.billingStoppedAt,
    releasedAt: billing.releasedAt,
  };
}

function plainResourceOrderStatus(order = {}) {
  return String(order.status || "").trim().toLowerCase() === "released"
    ? "已释放，停止计费"
    : String(order.status || "");
}

function resourceOrderBillingView(order = {}) {
  const releasedAt = String(order.pendingStoppedAt || order.billingStoppedAt || "").trim();
  const billingStopped = Boolean(releasedAt) || RESOURCE_ORDER_PENDING_STOP_STATUSES.has(String(order.status || "").trim().toLowerCase());
  const usageEndAt = releasedAt || new Date().toISOString();
  return {
    releasedAt,
    billingStopped,
    billingStoppedAt: releasedAt,
    usageMinutes: resourceOrderUsageMinutes(order.createdAt, usageEndAt),
  };
}

function resourceOrderUsageMinutes(createdAt, usageEndAt) {
  return Math.max(0, Math.floor((Date.parse(usageEndAt) - Date.parse(String(createdAt || usageEndAt))) / 60000) || 0);
}

function resourceOrderTimestampView(order = {}) {
  return {
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    settledAt: order.settledAt,
    pendingStoppedAt: order.pendingStoppedAt,
    billingStoppedAtRaw: order.billingStoppedAt,
    failedReason: order.failedReason,
  };
}

function sortedResourceOrderEvents(order = {}, events = []) {
  return events
    .filter((event) => event.orderId === order.id)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}
