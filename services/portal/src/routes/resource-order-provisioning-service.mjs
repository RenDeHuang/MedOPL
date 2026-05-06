import {
  transitionResourceOrder,
} from "../domain/resource-orders.mjs";
import { buildServerPlansFallback } from "../domain/server-plans.mjs";
import { collectResourceOrderAttribution } from "./resource-order-route-support.mjs";

export function createResourceOrderProvisioningService({
  fetchServerPlans,
  resourceProvisionerClient,
}) {
  function retiredProvisionResponse(order) {
    return {
      ok: false,
      status: 410,
      provisioner: {
        ok: false,
        error: "retired_in_v21",
        runtimeMode: "platform_provisioned",
        message: "v21 默认 product path 已移除旧资源订单 provision 链路。",
        use: "/portal/api/platform-provisioned-resources",
        legacyUse: "/portal/api/user-owned-resources",
      },
      order,
    };
  }

  async function findResourceOrderPlan(order) {
    const plansPayload = await fetchServerPlans() || buildServerPlansFallback();
    const items = Array.isArray(plansPayload.items) ? plansPayload.items : [];
    return items.find((item) => String(item.id || "") === String(order.serverPlanId || "")) || {};
  }

  async function resourceOrderProvisionInput(db, order, plan = {}, payload = {}) {
    const runId = String(order.runId || payload.runId || payload.run_id || order.id).trim();
    const attribution = collectResourceOrderAttribution(db, { ...order, runId }, payload);
    return {
      tenantId: order.tenantId || order.userId,
      userId: order.userId,
      workspaceId: order.workspaceId,
      workspaceSessionId: order.workspaceSessionId,
      runId,
      resourceOrderId: order.id,
      serverPlanId: order.serverPlanId,
      ledgerIds: attribution.ledgerIds,
      cosKeys: attribution.cosKeys,
      region: order.region || plan.region || "",
      zone: order.zone || plan.zone || "",
      provisioningMode: plan.provisioningMode || "",
      serverPlan: {
        ...plan,
        id: order.serverPlanId || plan.id || "",
        region: order.region || plan.region || "",
        zone: order.zone || plan.zone || "",
        ledgerIds: attribution.ledgerIds,
        cosKeys: attribution.cosKeys,
      },
    };
  }

  async function provisionResourceOrder(db, order, payload = {}, options = {}) {
    void db;
    void payload;
    void options;
    return retiredProvisionResponse(order);
  }

  return {
    findResourceOrderPlan,
    provisionResourceOrder,
    resourceOrderProvisionInput,
  };
}
