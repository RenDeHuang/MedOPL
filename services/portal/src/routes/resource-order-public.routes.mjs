import {
  ensureResourceOrderCollections,
  freezeResourceOrder,
  releaseResourceOrder,
  resourceOrderPublicView,
  resourceOrdersForUser,
  transitionResourceOrder,
} from "../domain/resource-orders.mjs";
import { buildCommercialProfile } from "../domain/commercial-state.mjs";
import { currentServerPlanSelection } from "../domain/server-plans.mjs";
import { isAdminUser } from "../domain/tenant-scope.mjs";
import {
  findUserResourceOrder,
  resourceOrderResponse,
} from "./resource-order-route-support.mjs";

export function createResourceOrderPublicRoutes({
  createQuotedResourceOrder,
  provisionResourceOrder,
  readJsonBody,
  resourceProvisionerClient,
  sendJson,
  writeDb,
}) {
  async function readPublicPayload(req, res) {
    try {
      return { ok: true, payload: await readJsonBody(req) };
    } catch {
      sendJson(res, { ok: false, error: "invalid_json_body" }, 400);
      return { ok: false, payload: {} };
    }
  }

  async function handleResourceOrderList({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/resource-orders") return false;
    ensureResourceOrderCollections(db);
    const items = resourceOrdersForUser(db, user.id)
      .map((order) => resourceOrderPublicView(order, db.resourceOrderEvents || []));
    sendJson(res, {
      ok: true,
      items,
      commercial: buildCommercialProfile(db, user),
      source: "portal_resource_order_state",
    });
    return true;
  }

  async function handleResourceOrderQuote({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/resource-orders/quote") return false;
    const body = await readPublicPayload(req, res);
    if (!body.ok) return true;
    const payload = body.payload;
    const quoted = await createQuotedResourceOrder(db, user, req, payload, { idempotencyPrefix: "resource-order-quote" });
    if (!quoted.ok) {
      sendJson(res, quoted, quoted.status || 400);
      return true;
    }
    await writeDb(db);
    sendJson(res, {
      ...resourceOrderResponse(db, user, quoted.order),
      selectedServerPlan: currentServerPlanSelection(quoted.taskSpace),
      plansSummary: quoted.plansSummary,
    });
    return true;
  }

  async function handleResourceOrderFreeze({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/resource-orders/freeze") return false;
    const body = await readPublicPayload(req, res);
    if (!body.ok) return true;
    const payload = body.payload;
    let order = db.resourceOrders?.find((item) => item.id === String(payload.orderId || payload.resourceOrderId || ""));
    if (!order) {
      const quoted = await createQuotedResourceOrder(db, user, req, payload, { idempotencyPrefix: "resource-order-freeze-quote" });
      if (!quoted.ok) {
        sendJson(res, quoted, quoted.status || 400);
        return true;
      }
      order = quoted.order;
    }
    const frozen = freezeResourceOrder(db, {
      user,
      order,
      idempotencyKey: String(req.headers["x-idempotency-key"] || payload.idempotencyKey || `preauth_hold:${order.id}`).trim(),
    });
    if (!frozen.ok) {
      sendJson(res, frozen, frozen.status || 400);
      return true;
    }
    await writeDb(db);
    sendJson(res, resourceOrderResponse(db, user, frozen.order));
    return true;
  }

  async function handleCloudResources({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/cloud/resources") return false;
    if (!isAdminUser(user)) {
      sendJson(res, {
        ok: false,
        error: "forbidden_admin_scope_required",
        use: "/portal/api/resource-orders",
      }, 403);
      return true;
    }
    const resources = await resourceProvisionerClient.fetchCloudResources();
    sendJson(res, {
      ok: Boolean(resources?.ok),
      source: "resource_provisioner",
      resources,
      resourceOrders: {
        items: resourceOrdersForUser(db, user.id).slice(0, 20).map((order) => resourceOrderPublicView(order, db.resourceOrderEvents || [])),
      },
    });
    return true;
  }

  async function handleResourceOrderProvision({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/resource-orders/provision") return false;
    const body = await readPublicPayload(req, res);
    if (!body.ok) return true;
    const payload = body.payload;
    const order = findUserResourceOrder(db, user, payload.orderId || payload.resourceOrderId);
    if (!order) {
      sendJson(res, { ok: false, error: "resource_order_not_found" }, 404);
      return true;
    }
    if (!["frozen", "provisioning"].includes(String(order.status || "").toLowerCase())) {
      sendJson(res, { ok: false, error: "resource_order_must_be_frozen", status: order.status }, 409);
      return true;
    }
    const provisioned = await provisionResourceOrder(db, order, payload);
    await writeDb(db);
    sendJson(res, {
      ...resourceOrderResponse(db, user, provisioned.order || order),
      provisioner: provisioned.provisioner,
    }, provisioned.ok ? 200 : (provisioned.status || 502));
    return true;
  }

  async function handleResourceOrderRelease({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/resource-orders/release") return false;
    const body = await readPublicPayload(req, res);
    if (!body.ok) return true;
    const payload = body.payload;
    const order = findUserResourceOrder(db, user, payload.orderId || payload.resourceOrderId);
    if (!order) {
      sendJson(res, { ok: false, error: "resource_order_not_found" }, 404);
      return true;
    }
    let scaleResult = null;
    if (payload.scaleToZero === true) {
      scaleResult = await resourceProvisionerClient.scaleToZero({
        resourceOrderId: order.id,
        nodePoolId: payload.nodePoolId || order.cloudResourceIds?.[0] || "",
        tenantId: order.tenantId,
        workspaceId: order.workspaceId,
        serverPlanId: order.serverPlanId,
      });
      if (!scaleResult?.ok) {
        sendJson(res, { ok: false, error: "scale_to_zero_failed", provisioner: scaleResult }, scaleResult?.status || 502);
        return true;
      }
    }
    const released = releaseResourceOrder(db, {
      user,
      orderId: order.id,
      actorType: "portal",
      actorId: user.id,
      payload: { scaleToZero: payload.scaleToZero === true, scaleResult },
      idempotencyKey: String(payload.idempotencyKey || `portal_release:${order.id}`).trim(),
    });
    if (!released.ok) {
      sendJson(res, released, released.status || 400);
      return true;
    }
    await writeDb(db);
    sendJson(res, { ...resourceOrderResponse(db, user, released.order), scaleResult });
    return true;
  }

  async function handleResourceOrderDeleteNodePool({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/resource-orders/delete-node-pool") return false;
    const body = await readPublicPayload(req, res);
    if (!body.ok) return true;
    const payload = body.payload;
    const order = findUserResourceOrder(db, user, payload.orderId || payload.resourceOrderId);
    if (!order) {
      sendJson(res, { ok: false, error: "resource_order_not_found" }, 404);
      return true;
    }
    if (payload.confirmDeleteNodePool !== true) {
      sendJson(res, {
        ok: false,
        error: "delete_node_pool_confirmation_required",
        message: "删除节点池前必须确认：销毁 CVM 会释放实例和节点本地数据；保留 CVM 会继续产生云资源费用。",
      }, 409);
      return true;
    }
    const deleted = await resourceProvisionerClient.deleteNodePool({
      resourceOrderId: order.id,
      nodePoolId: payload.nodePoolId || order.cloudResourceIds?.[0] || "",
      destroyCvmInstances: payload.destroyCvmInstances === true,
      tenantId: order.tenantId,
      workspaceId: order.workspaceId,
      serverPlanId: order.serverPlanId,
      confirmation: "delete-node-pool",
    });
    if (!deleted?.ok) {
      sendJson(res, { ok: false, error: "delete_node_pool_failed", provisioner: deleted }, deleted?.status || 502);
      return true;
    }
    const transitioned = transitionResourceOrder(db, {
      orderId: order.id,
      status: "released",
      actorType: "portal",
      actorId: user.id,
      payload: { deleteNodePool: deleted },
      idempotencyKey: `event:delete-node-pool:${order.id}:${payload.destroyCvmInstances === true ? "destroy" : "retain"}`,
    });
    await writeDb(db);
    sendJson(res, { ...resourceOrderResponse(db, user, transitioned.order || order), provisioner: deleted });
    return true;
  }

  return async function handleResourceOrderPublicRoutes(context) {
    if (await handleResourceOrderList(context)) return true;
    if (await handleResourceOrderQuote(context)) return true;
    if (await handleResourceOrderFreeze(context)) return true;
    if (await handleCloudResources(context)) return true;
    if (await handleResourceOrderProvision(context)) return true;
    if (await handleResourceOrderRelease(context)) return true;
    if (await handleResourceOrderDeleteNodePool(context)) return true;
    return false;
  };
}
