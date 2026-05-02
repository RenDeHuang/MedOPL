import {
  transitionResourceOrder,
} from "../domain/resource-orders.mjs";
import { buildServerPlansFallback } from "../domain/server-plans.mjs";
import { collectResourceOrderAttribution } from "./resource-order-route-support.mjs";

export function createResourceOrderProvisioningService({
  fetchServerPlans,
  resourceProvisionerClient,
}) {
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
      provisioningMode: plan.provisioningMode || "tke_node_pool_create",
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
    const plan = await findResourceOrderPlan(order);
    const provisionerPayload = await resourceOrderProvisionInput(db, order, plan, payload);
    const pending = transitionResourceOrder(db, {
      orderId: order.id,
      status: "provisioning",
      actorType: "resource-provisioner",
      actorId: "provision-async",
      payload: {
        runId: provisionerPayload.runId,
        async: true,
      },
      idempotencyKey: `event:provisioning:${order.id}:${provisionerPayload.runId || "default"}`,
    });
    if (!pending.ok) {
      return { ok: false, status: pending.status || 400, provisioner: null, order };
    }

    const provisioned = await resourceProvisionerClient.startProvision(provisionerPayload);
    if (!provisioned?.ok) {
      if (options.allowDisabledPending && String(provisioned?.error || "") === "resource_provisioning_disabled") {
        return { ok: true, provisioner: provisioned, order: pending.order || order };
      }
      const failed = transitionResourceOrder(db, {
        orderId: order.id,
        status: "failed",
        actorType: "resource-provisioner",
        actorId: "provision-async",
        payload: {
          error: provisioned?.error || "resource_provisioner_failed",
          code: provisioned?.code || "",
        },
        idempotencyKey: `event:provision-failed:${order.id}:${provisioned?.code || provisioned?.error || "error"}`,
      });
      return { ok: false, status: provisioned?.status || 502, provisioner: provisioned, order: failed.order || pending.order || order };
    }

    const provisionerOrder = provisioned.order || {};
    if (provisionerOrder.status === "ready") {
      const ready = transitionResourceOrder(db, {
        orderId: order.id,
        status: "running",
        actorType: "resource-provisioner",
        actorId: String(provisionerOrder.requestId || provisionerOrder.nodePoolId || ""),
        payload: {
          runId: provisionerPayload.runId,
          provisionRequestId: provisionerOrder.requestId || "",
          nodePoolId: provisionerOrder.nodePoolId || "",
          cloudResourceIds: [provisionerOrder.nodePoolId].filter(Boolean),
          provisionerOrder,
        },
        idempotencyKey: `event:provisioned:${order.id}:${provisionerOrder.requestId || provisionerOrder.nodePoolId || "ready"}`,
      });
      return { ok: true, provisioner: provisioned, order: ready.order || pending.order || order };
    }

    if (pending.order) {
      pending.order.provisionRequestId = String(provisionerOrder.requestId || provisionerOrder.id || pending.order.provisionRequestId || "").trim();
    }
    return { ok: true, provisioner: provisioned, order: pending.order || order };
  }

  return {
    findResourceOrderPlan,
    provisionResourceOrder,
    resourceOrderProvisionInput,
  };
}
