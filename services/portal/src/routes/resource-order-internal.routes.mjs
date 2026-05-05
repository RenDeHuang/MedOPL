import {
  freezeResourceOrder,
  releaseResourceOrder,
  resourceOrderPublicView,
  transitionResourceOrder,
} from "../domain/resource-orders.mjs";
import { isBlockedUserStatus } from "../domain/commercial-state.mjs";
import {
  findResourceOrderUser,
  resourceOrderResponse,
} from "./resource-order-route-support.mjs";

export function createResourceOrderInternalRoutes({
  createQuotedResourceOrder,
  logPortalEvent,
  normalizeAuthEmail,
  portalInternalAuthAllowed,
  provisionResourceOrder,
  readJsonBody,
  sendJson,
  writeDb,
}) {
  function rejectIfInternalAuthMissing(req, res) {
    if (portalInternalAuthAllowed(req)) return false;
    sendJson(res, { ok: false, error: "forbidden", message: "internal auth token mismatch" }, 403);
    return true;
  }

  async function readInternalPayload(req, res) {
    try {
      return { ok: true, payload: await readJsonBody(req) };
    } catch {
      sendJson(res, { ok: false, error: "invalid_json_body" }, 400);
      return { ok: false, payload: {} };
    }
  }

  async function persistResourceOrderState(db, order) {
    if (typeof writeDb.persistResourceOrderState === "function") {
      await writeDb.persistResourceOrderState({ db, order, orderId: order?.id });
      return;
    }
    await writeDb(db);
  }

  async function handleInternalPrepareRun({ req, res, url, db }) {
    if (req.method !== "POST" || url.pathname !== "/portal/internal/resource-orders/prepare-run") return false;
    if (rejectIfInternalAuthMissing(req, res)) return true;
    const body = await readInternalPayload(req, res);
    if (!body.ok) return true;
    const payload = body.payload;
    const portalUser = findResourceOrderUser(db, payload, normalizeAuthEmail);
    if (!portalUser) {
      sendJson(res, { ok: false, error: "portal_user_not_found" }, 404);
      return true;
    }
    if (isBlockedUserStatus(portalUser.status)) {
      sendJson(res, { ok: false, error: "account_blocked" }, 403);
      return true;
    }
    const quoted = await createQuotedResourceOrder(db, portalUser, req, payload, { idempotencyPrefix: "prepare-run" });
    if (!quoted.ok) {
      sendJson(res, quoted, quoted.status || 400);
      return true;
    }
    const frozen = freezeResourceOrder(db, {
      user: portalUser,
      order: quoted.order,
      idempotencyKey: String(payload.freezeIdempotencyKey || `prepare-run-freeze:${quoted.order.id}`).trim(),
    });
    if (!frozen.ok) {
      sendJson(res, frozen, frozen.status || 400);
      return true;
    }
    const provisioning = await provisionResourceOrder(db, frozen.order, payload, { allowDisabledPending: true });
    await persistResourceOrderState(db, provisioning.order || frozen.order);
    sendJson(res, {
      ...resourceOrderResponse(db, portalUser, provisioning.order || frozen.order),
      provisioner: provisioning.provisioner || null,
    }, provisioning.ok ? 200 : (provisioning.status || 502));
    return true;
  }

  async function handleInternalMarkRunning({ req, res, url, db }) {
    if (req.method !== "POST" || url.pathname !== "/portal/internal/resource-orders/mark-running") return false;
    if (rejectIfInternalAuthMissing(req, res)) return true;
    const body = await readInternalPayload(req, res);
    if (!body.ok) return true;
    const payload = body.payload;
    const orderId = String(payload.resourceOrderId || payload.orderId || "").trim();
    const result = transitionResourceOrder(db, {
      orderId,
      status: "running",
      actorType: "runner",
      actorId: String(payload.runId || payload.runnerRunId || ""),
      payload,
      idempotencyKey: String(payload.idempotencyKey || `event:running:${orderId}`).trim(),
    });
    if (!result.ok) {
      sendJson(res, result, result.status || 400);
      return true;
    }
    await persistResourceOrderState(db, result.order);
    sendJson(res, { ok: true, resourceOrderId: orderId, order: resourceOrderPublicView(result.order, db.resourceOrderEvents || []) });
    return true;
  }

  async function handleInternalProvisioningResult({ req, res, url, db }) {
    if (req.method !== "POST" || url.pathname !== "/portal/internal/resource-orders/provisioning-result") return false;
    if (rejectIfInternalAuthMissing(req, res)) return true;
    const body = await readInternalPayload(req, res);
    if (!body.ok) return true;
    const payload = body.payload;
    const orderId = String(payload.resourceOrderId || payload.orderId || "").trim();
    const rawStatus = String(payload.status || "").trim().toLowerCase();
    const nextStatus = ["success", "succeeded", "ready", "running"].includes(rawStatus) ? "running" : rawStatus;
    if (!["running", "failed"].includes(nextStatus)) {
      sendJson(res, { ok: false, error: "invalid_provisioning_result_status" }, 400);
      return true;
    }
    const nodePoolId = String(payload.nodePoolId || payload.node_pool_id || "").trim();
    const cloudResourceIds = [
      nodePoolId,
      ...(Array.isArray(payload.cloudResourceIds) ? payload.cloudResourceIds : []),
    ].map((item) => String(item || "").trim()).filter(Boolean);
    const result = transitionResourceOrder(db, {
      orderId,
      status: nextStatus,
      actorType: "resource-provisioner",
      actorId: String(payload.provisionerOrderId || payload.requestId || nodePoolId || ""),
      payload: {
        ...payload,
        nodePoolId,
        cloudResourceIds,
        reason: payload.reason || payload.error || "",
      },
      idempotencyKey: String(payload.idempotencyKey || `event:provisioning-result:${orderId}:${nextStatus}:${payload.requestId || nodePoolId || payload.reason || ""}`).trim(),
    });
    if (!result.ok) {
      sendJson(res, result, result.status || 400);
      return true;
    }
    if (nextStatus === "running" && result.order) {
      result.order.provisionRequestId = String(payload.requestId || payload.provisionRequestId || result.order.provisionRequestId || "").trim();
      result.order.cloudResourceIds = cloudResourceIds.length ? cloudResourceIds : result.order.cloudResourceIds;
    }
    if (nextStatus === "failed") {
      await logPortalEvent({
        type: "resource_order_provision_failed",
        userId: result.order?.userId || "",
        workspaceId: result.order?.workspaceId || "",
        runId: result.order?.runId || payload.runId || "",
        resourceOrderId: orderId,
        reason: payload.reason || payload.error || "provisioning_failed",
      });
    }
    await persistResourceOrderState(db, result.order);
    sendJson(res, { ok: true, resourceOrderId: orderId, order: resourceOrderPublicView(result.order, db.resourceOrderEvents || []) });
    return true;
  }

  async function handleInternalRelease({ req, res, url, db }) {
    if (req.method !== "POST" || url.pathname !== "/portal/internal/resource-orders/release") return false;
    if (rejectIfInternalAuthMissing(req, res)) return true;
    const body = await readInternalPayload(req, res);
    if (!body.ok) return true;
    const payload = body.payload;
    const orderId = String(payload.resourceOrderId || payload.orderId || "").trim();
    const order = db.resourceOrders?.find((item) => item.id === orderId);
    const portalUser = order ? db.users.find((item) => item.id === order.userId) : null;
    const result = releaseResourceOrder(db, {
      user: portalUser,
      orderId,
      actorType: "runner",
      actorId: String(payload.runId || ""),
      payload,
      idempotencyKey: String(payload.idempotencyKey || `preauth_release_deferred:${orderId}`).trim(),
      releasePreauth: payload.releasePreauth === true,
    });
    if (!result.ok) {
      sendJson(res, result, result.status || 400);
      return true;
    }
    await persistResourceOrderState(db, result.order);
    sendJson(res, { ok: true, resourceOrderId: orderId, releasedAmount: result.releasedAmount || 0, order: resourceOrderPublicView(result.order, db.resourceOrderEvents || []) });
    return true;
  }

  return async function handleResourceOrderInternalRoutes(context) {
    if (await handleInternalPrepareRun(context)) return true;
    if (await handleInternalMarkRunning(context)) return true;
    if (await handleInternalProvisioningResult(context)) return true;
    if (await handleInternalRelease(context)) return true;
    return false;
  };
}
