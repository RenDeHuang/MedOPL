import { firstString } from "./labels.mjs";

export const NODE_POOL_BINDING_FIELDS = [
  "resourceOrderId",
  "nodePoolId",
  "tenantId",
  "workspaceId",
  "serverPlanId",
];

export function bindingField(input, ...keys) {
  return firstString(...keys.map((key) => input?.[key]));
}

export function nodePoolBindingFromInput(input = {}, nodePoolId = "") {
  return {
    resourceOrderId: bindingField(input, "resourceOrderId", "resource_order_id"),
    nodePoolId: firstString(nodePoolId, input.nodePoolId, input.node_pool_id),
    runId: bindingField(input, "runId", "run_id"),
    tenantId: bindingField(input, "tenantId", "tenant_id", "customerId", "customer_id"),
    workspaceId: bindingField(input, "workspaceId", "workspace_id"),
    serverPlanId: bindingField(input, "serverPlanId", "server_plan_id"),
  };
}

export function hasBindingScope(binding = {}) {
  return Boolean(binding.resourceOrderId || binding.runId || binding.tenantId || binding.workspaceId || binding.serverPlanId);
}

export function matchesBinding(item = {}, binding = {}) {
  for (const [key, value] of Object.entries(binding)) {
    if (!value) continue;
    if (String(item?.[key] || "") !== String(value)) return false;
  }
  return true;
}

export function findOrderByBinding(orders = [], binding = {}) {
  return orders.find((order) => matchesBinding(order, binding)) || null;
}

export function assertDeleteBindingRequired(binding = {}) {
  const missing = NODE_POOL_BINDING_FIELDS.filter((field) => !String(binding[field] || "").trim());
  if (!missing.length) return;
  const error = new Error(`delete_node_pool_binding_fields_required:${missing.join(",")}`);
  error.status = 422;
  throw error;
}

export function assertDeleteBindingMatch(mapping, order, binding = {}) {
  if (!mapping) {
    const error = new Error("delete_node_pool_mapping_not_found");
    error.status = 409;
    throw error;
  }
  if (!order) {
    const error = new Error("delete_node_pool_order_not_found");
    error.status = 409;
    throw error;
  }
  assertItemBinding("mapping", mapping, binding);
  assertItemBinding("order", order, binding);
}

function assertItemBinding(label, item = {}, binding = {}) {
  const mismatches = NODE_POOL_BINDING_FIELDS
    .filter((field) => String(item[field] || "") !== String(binding[field] || ""));
  if (!mismatches.length) return;
  const error = new Error(`delete_node_pool_${label}_binding_mismatch:${mismatches.join(",")}`);
  error.status = 409;
  throw error;
}
