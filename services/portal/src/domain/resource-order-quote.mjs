import { randomUUID } from "node:crypto";

import { moneyAmount } from "./wallet-ledger.mjs";
import { normalizeResourceOrderFields } from "./resource-order-normalizers.mjs";
import { RESOURCE_ORDER_STATUSES } from "./resource-order-statuses.mjs";

const DEFAULT_PREAUTH_BUFFER_RATIO = 0.2;

export function quoteResourceOrderFromPlan({ user, workspace, serverPlan, input = {}, idempotencyKey = "" }) {
  const now = new Date().toISOString();
  return normalizeResourceOrderFields({
    now,
    order: resourceOrderQuoteRecord({ user, workspace, serverPlan, input, idempotencyKey, now }),
    status: "quoted",
    statuses: RESOURCE_ORDER_STATUSES,
  });
}

function resourceOrderQuoteRecord(context) {
  return {
    ...resourceOrderQuoteIdentity(context),
    status: "quoted",
    ...resourceOrderPlanSnapshot(context.serverPlan, context.input),
    ...resourceOrderStorageSnapshot(context.serverPlan, context.input),
    ...resourceOrderPricingSnapshot(context),
    ...resourceOrderQuoteLifecycle(context),
  };
}

function resourceOrderQuoteIdentity({ user = {}, workspace = {}, input = {}, idempotencyKey = "" }) {
  const tenantId = String(user.tenantId || user.id || "").trim();
  const userId = String(user.id || "").trim();
  return {
    id: String(input.orderId || randomUUID()),
    tenantId,
    userId,
    portalUserId: userId,
    workspaceId: workspace.slug,
    workspaceSessionId: input.workspaceSessionId || "",
    runId: input.runId || "",
    billingAccountId: input.billingAccountId || tenantId,
    idempotencyKey,
  };
}

function resourceOrderPlanSnapshot(serverPlan = {}, input = {}) {
  return {
    serverPlanId: serverPlan?.id || input.serverPlanId || "",
    region: serverPlan?.region || "",
    zone: serverPlan?.zone || "",
    cpu: serverPlan?.cpu || 0,
    memoryGb: serverPlan?.memoryGb || 0,
    gpuType: serverPlan?.gpuType || serverPlan?.gpuModel || "",
    gpuCount: serverPlan?.gpuCount ?? serverPlan?.gpu ?? 0,
  };
}

function resourceOrderStorageSnapshot(serverPlan = {}, input = {}) {
  const fallbackSizeGb = parseStorageGi(serverPlan?.storageRequest || serverPlan?.storageLimit || "10Gi");
  return {
    storagePlanId: input.storagePlanId || "workspace-default",
    storageSizeGb: Math.max(10, Number(input.storageSizeGb || fallbackSizeGb)),
    retentionPolicy: input.retentionPolicy || "retain",
  };
}

function resourceOrderPricingSnapshot({ serverPlan = {}, input = {} }) {
  const billable = billableResourceOrderHours(serverPlan, input);
  const unitPrice = moneyAmount(serverPlan?.discountPrice ?? serverPlan?.unitPrice ?? serverPlan?.hourlyPrice ?? 0, 0);
  const riskFactor = Math.max(1, Number(serverPlan?.riskFactor || 1));
  const quoteAmount = quoteResourceOrderAmount({ serverPlan, billableHours: billable.billableHours, unitPrice, riskFactor });
  return {
    ...billable,
    unitPrice,
    riskFactor,
    quoteAmount,
    freezeAmount: preauthResourceOrderAmount(quoteAmount, resolvePreauthBufferRatio(serverPlan, input)),
  };
}

function billableResourceOrderHours(serverPlan = {}, input = {}) {
  const estimatedHours = Math.max(1, Number(input.estimatedHours || input.estimated_hours || 1));
  const minBillableHours = Math.max(1, Number(serverPlan?.minBillableHours || serverPlan?.min_billable_hours || 1));
  return { estimatedHours, minBillableHours, billableHours: Math.max(estimatedHours, minBillableHours) };
}

function quoteResourceOrderAmount({ serverPlan = {}, billableHours = 1, unitPrice = 0, riskFactor = 1 }) {
  const reservationFloor = moneyAmount(serverPlan?.reservationFloor || 0, 0);
  return moneyAmount(Math.max(reservationFloor, unitPrice * billableHours * riskFactor), 0);
}

function preauthResourceOrderAmount(quoteAmount, preauthBufferRatio) {
  return moneyAmount(Math.max(quoteAmount, quoteAmount * (1 + preauthBufferRatio)), 0);
}

function resourceOrderQuoteLifecycle({ serverPlan = {}, input = {}, now }) {
  return {
    autoStopAt: input.autoStopAt || "",
    quoteId: `quote_${randomUUID()}`,
    currency: serverPlan?.currency || "CNY",
    pricingSource: serverPlan?.pricingSource || serverPlan?.source || serverPlan?.priceStatus || "billing_aggregator_quote",
    priceUpdatedAt: serverPlan?.priceUpdatedAt || serverPlan?.updatedAt || now,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseStorageGi(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/^([0-9.]+)\s*(gi|gib|gb|mi|mib|mb)?$/);
  if (!match) return 10;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return 10;
  const unit = match[2] || "gi";
  if (unit.startsWith("m")) return Math.max(10, Math.ceil(amount / 1024));
  return Math.max(10, Math.ceil(amount));
}

export function resolvePreauthBufferRatio(serverPlan = {}, input = {}) {
  const candidates = [
    input.preauthBufferRatio,
    input.preauth_buffer_ratio,
    serverPlan.preauthBufferRatio,
    serverPlan.preauth_buffer_ratio,
    process.env.PORTAL_PREAUTH_BUFFER_RATIO,
    DEFAULT_PREAUTH_BUFFER_RATIO,
  ];
  return firstValidPreauthBufferRatio(candidates);
}

function firstValidPreauthBufferRatio(candidates = []) {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") continue;
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_PREAUTH_BUFFER_RATIO;
}
