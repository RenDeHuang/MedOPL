import { randomUUID } from "node:crypto";

import { ownerIdFrom, tenantIdFrom } from "./state-store-identity.mjs";
import { nowIso } from "./state-store-record-time.mjs";

export { normalizeCostRecords } from "./state-store-cost-normalization.mjs";

export function buildCostRecord(input = {}) {
  const ownerId = ownerIdFrom(input);
  return {
    costRecordId: input.costRecordId || input.cost_record_id || randomUUID(),
    runId: input.runId || input.run_id || "",
    tenantId: tenantIdFrom(input),
    portalUserId: input.portalUserId || input.portal_user_id || "",
    ownerId,
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    cpuCost: input.cpuCost ?? null,
    gpuCost: input.gpuCost ?? null,
    storageCost: input.storageCost ?? null,
    vpnCost: input.vpnCost ?? null,
    trafficCost: input.trafficCost ?? null,
    totalCost: input.totalCost ?? null,
    pricingSource: input.pricingSource || "v22-pricing-pending-product-approval",
    status: input.status || "pending",
    createdAt: input.createdAt || input.created_at || nowIso(),
  };
}
