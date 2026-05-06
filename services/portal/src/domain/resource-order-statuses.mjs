export const RESOURCE_ORDER_STATUSES = new Set([
  "quoted",
  "frozen",
  "provisioning",
  "running",
  "released",
  "reconciling",
  "settled",
  "failed",
  "cancelled",
]);

export const RESOURCE_ORDER_PENDING_STOP_STATUSES = new Set([
  "released",
  "settled",
  "failed",
  "cancelled",
]);

export const RESOURCE_ORDER_REUSABLE_STATUSES = new Set([
  "quoted",
  "frozen",
  "provisioning",
  "running",
]);
