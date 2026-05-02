import { randomUUID } from "node:crypto";

import { buildCommercialProfile } from "../domain/commercial-state.mjs";
import {
  ensureResourceOrderCollections,
  resourceOrderPublicView,
} from "../domain/resource-orders.mjs";
import { resourceBelongsToUser } from "../domain/tenant-scope.mjs";

export function idempotencyKeyFor(req, prefix, user, workspaceId, payload = {}) {
  const explicit = String(req.headers["x-idempotency-key"] || payload.idempotencyKey || payload.idempotency_key || "").trim();
  if (explicit) return explicit;
  const runId = String(payload.runId || payload.run_id || payload.runtimeRunId || "").trim();
  const planId = String(payload.serverPlanId || payload.planId || "").trim();
  return `${prefix}:${user.id}:${workspaceId}:${runId || planId || randomUUID()}`;
}

export function selectServerPlan(plansPayload, planId = "") {
  const items = Array.isArray(plansPayload?.items) ? plansPayload.items : [];
  const normalizedPlanId = String(planId || "").trim();
  return items.find((item) =>
    String(item.id || "") === normalizedPlanId ||
    String(item.serverPlanId || "") === normalizedPlanId ||
    String(item.instanceType || "") === normalizedPlanId,
  ) || (normalizedPlanId ? null : items.find((item) => item.salable) || items[0] || null);
}

export function findResourceOrderUser(db, payload = {}, normalizeAuthEmail = (value) => String(value || "").trim().toLowerCase()) {
  const userId = String(payload.userId || payload.portalUserId || payload.tenantId || payload.customerId || payload.customer_id || "").trim();
  const email = normalizeAuthEmail(payload.email || payload.userEmail || payload.portalUserEmail);
  return db.users.find((item) =>
    (userId && item.id === userId) ||
    (email && normalizeAuthEmail(item.email) === email),
  ) || null;
}

function stringValue(value) {
  return String(value ?? "").trim();
}

function uniqueStrings(...values) {
  const result = [];
  const seen = new Set();
  for (const value of values.flat(Infinity)) {
    const text = stringValue(value);
    if (!text || seen.has(text)) continue;
    result.push(text);
    seen.add(text);
  }
  return result;
}

function ownerMatches(item = {}, order = {}) {
  if (stringValue(item.workspaceId || item.workspace_id) !== stringValue(order.workspaceId)) return false;
  const itemUserId = stringValue(item.userId || item.user_id);
  const itemTenantId = stringValue(item.tenantId || item.tenant_id || itemUserId);
  return itemUserId === stringValue(order.userId) || itemTenantId === stringValue(order.tenantId);
}

export function collectResourceOrderAttribution(db = {}, order = {}, payload = {}) {
  const ledgerIds = uniqueStrings(
    payload.ledgerIds,
    payload.ledger_ids,
    payload.ledgerId,
    payload.ledger_id,
    order.freezeId,
    (db.ledger || [])
      .filter((entry) => stringValue(entry.resourceOrderId || entry.resource_order_id || entry.orderId || entry.order_id) === stringValue(order.id))
      .filter((entry) => ["preauth_hold", "exact_resource_charge", "refund", "makeup_charge"].includes(stringValue(entry.type)))
      .map((entry) => entry.id),
  );

  const cosKeys = uniqueStrings(
    payload.cosKeys,
    payload.cos_keys,
    payload.cosKey,
    payload.cos_key,
    (db.storageOrders || [])
      .filter((item) => ownerMatches(item, order))
      .filter((item) => !["deleted", "cancelled"].includes(stringValue(item.status).toLowerCase()))
      .map((item) => item.cosPrefix || item.cos_prefix),
    (db.workspaceFiles || [])
      .filter((item) => ownerMatches(item, order))
      .filter((item) => !["deleted"].includes(stringValue(item.status).toLowerCase()))
      .filter((item) => !stringValue(item.runId || item.run_id) || stringValue(item.runId || item.run_id) === stringValue(order.runId || payload.runId || payload.run_id))
      .map((item) => item.storageKey || item.storage_key),
  );

  return { ledgerIds, cosKeys };
}

export function resourceOrderResponse(db, user, order) {
  return {
    ok: true,
    resourceOrderId: order.id,
    order: resourceOrderPublicView(order, db.resourceOrderEvents || []),
    commercial: buildCommercialProfile(db, user),
  };
}

export function findUserResourceOrder(db, user, orderId = "") {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) return null;
  ensureResourceOrderCollections(db);
  return db.resourceOrders.find((item) => item.id === normalizedOrderId && resourceBelongsToUser(item, user)) || null;
}
