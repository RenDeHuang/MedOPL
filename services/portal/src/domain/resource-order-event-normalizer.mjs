import { randomUUID } from "node:crypto";

import { normalizeObject } from "./resource-order-normalizer-objects.mjs";

export function normalizeResourceOrderEvent(event = {}) {
  if (!event || typeof event !== "object") return null;
  const identity = resourceOrderEventIdentity(event);
  if (!identity) return null;
  return {
    ...identity,
    eventPayload: normalizeObject(event.eventPayload || event.event_payload_json),
    actorType: String(event.actorType || event.actor_type || "system").trim() || "system",
    actorId: String(event.actorId || event.actor_id || "").trim(),
    idempotencyKey: String(event.idempotencyKey || event.idempotency_key || "").trim(),
    createdAt: String(event.createdAt || event.created_at || new Date().toISOString()).trim(),
  };
}

function resourceOrderEventIdentity(event = {}) {
  const orderId = String(event.orderId || event.order_id || "").trim();
  const eventType = String(event.eventType || event.event_type || "").trim();
  if (!orderId || !eventType) return null;
  return { id: String(event.id || randomUUID()).trim(), orderId, eventType };
}
