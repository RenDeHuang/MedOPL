import { mkdir, readFile, writeFile } from "node:fs/promises";
import { runtimeRoot, ordersFile } from "./config.mjs";

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

function nonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeRemaining(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    nodePools: nonNegativeNumber(source.nodePools ?? source.nodePoolCount, 0),
    instances: nonNegativeNumber(source.instances ?? source.instanceCount, 0),
    pods: nonNegativeNumber(source.pods ?? source.podCount, 0),
    jobs: nonNegativeNumber(source.jobs ?? source.jobCount, 0),
    pvcs: nonNegativeNumber(source.pvcs ?? source.pvcCount, 0),
    cosKeys: nonNegativeNumber(source.cosKeys ?? source.cosKeyCount, 0),
  };
}

function cloudResourcePatch(source = {}) {
  const resources = source && typeof source === "object" ? source : {};
  const nodePoolId = stringValue(resources.nodePoolId || resources.node_pool_id);
  return {
    clusterId: stringValue(resources.clusterId || resources.cluster_id),
    nodePoolId,
    nodePoolIds: uniqueStrings(resources.nodePoolIds, resources.nodePoolId, resources.node_pool_ids, resources.node_pool_id),
    nodeNames: uniqueStrings(resources.nodeNames, resources.nodeName, resources.node_names, resources.node_name),
    cvmInstanceIds: uniqueStrings(resources.cvmInstanceIds, resources.cvmInstanceId, resources.instanceIds, resources.instanceId),
    podNames: uniqueStrings(resources.podNames, resources.podName),
    jobNames: uniqueStrings(resources.jobNames, resources.jobName),
    pvcNames: uniqueStrings(resources.pvcNames, resources.pvcName),
    cosKeys: uniqueStrings(resources.cosKeys, resources.cosKey, resources.artifactKeys, resources.artifactKey),
    ledgerIds: uniqueStrings(resources.ledgerIds, resources.ledgerId),
  };
}

export async function readOrders() {
  try {
    const state = JSON.parse(await readFile(ordersFile, "utf8"));
    if (!Array.isArray(state.orders)) state.orders = [];
    if (!Array.isArray(state.resourceMappings)) state.resourceMappings = [];
    return state;
  } catch {
    return { orders: [], resourceMappings: [] };
  }
}

export async function writeOrders(state) {
  await mkdir(runtimeRoot, { recursive: true });
  if (!Array.isArray(state.orders)) state.orders = [];
  if (!Array.isArray(state.resourceMappings)) state.resourceMappings = [];
  await writeFile(ordersFile, JSON.stringify(state, null, 2), "utf8");
}

export function buildProvisionResourceMapping({
  context = {},
  nodePoolId = "",
  requestId = "",
  createdAt = new Date().toISOString(),
  billingStartedAt = createdAt,
  cloudResources = {},
} = {}) {
  const resourceOrderId = stringValue(context.resourceOrderId || context.resource_order_id);
  const runId = stringValue(context.runId || context.run_id || resourceOrderId);
  const id = stringValue(context.mappingId)
    || uniqueStrings(resourceOrderId, runId, nodePoolId)[0]
    || `${stringValue(context.workspaceId || context.workspace_id) || "workspace"}:${createdAt}`;
  return {
    id,
    tenantId: stringValue(context.tenantId || context.tenant_id || context.customerId || context.customer_id),
    workspaceId: stringValue(context.workspaceId || context.workspace_id),
    resourceOrderId,
    runId,
    serverPlanId: stringValue(context.serverPlanId || context.server_plan_id),
    region: stringValue(context.region),
    nodePoolId: stringValue(nodePoolId || cloudResources.nodePoolId),
    clusterId: stringValue(context.clusterId || context.tkeClusterId || cloudResources.clusterId),
    nodePoolIds: uniqueStrings(cloudResources.nodePoolIds, nodePoolId, cloudResources.nodePoolId),
    nodeNames: uniqueStrings(cloudResources.nodeNames, cloudResources.nodeName),
    cvmInstanceIds: uniqueStrings(cloudResources.cvmInstanceIds, cloudResources.cvmInstanceId, cloudResources.instanceIds, cloudResources.instanceId),
    podNames: uniqueStrings(cloudResources.podNames, cloudResources.podName),
    jobNames: uniqueStrings(cloudResources.jobNames, cloudResources.jobName),
    pvcNames: uniqueStrings(cloudResources.pvcNames, cloudResources.pvcName),
    cosKeys: uniqueStrings(cloudResources.cosKeys, cloudResources.cosKey, cloudResources.artifactKeys, cloudResources.artifactKey),
    ledgerIds: uniqueStrings(cloudResources.ledgerIds, cloudResources.ledgerId),
    createRequestId: stringValue(requestId || cloudResources.createRequestId),
    deleteRequestId: stringValue(cloudResources.deleteRequestId),
    billingStartedAt: stringValue(billingStartedAt || createdAt),
    billingStoppedAt: stringValue(cloudResources.billingStoppedAt),
    cleanupStatus: stringValue(cloudResources.cleanupStatus || "active"),
    cleanupEvidenceId: stringValue(cloudResources.cleanupEvidenceId),
    cleanupRemaining: normalizeRemaining(cloudResources.cleanupRemaining),
    createdAt: stringValue(createdAt),
    updatedAt: stringValue(cloudResources.updatedAt || createdAt),
  };
}

export function mergeProvisionResourceMapping(current = {}, patch = {}) {
  const updatedAt = stringValue(patch.updatedAt || new Date().toISOString());
  return {
    ...current,
    ...patch,
    clusterId: stringValue(patch.clusterId) || stringValue(current.clusterId),
    nodePoolId: stringValue(patch.nodePoolId) || stringValue(current.nodePoolId),
    nodePoolIds: uniqueStrings(current.nodePoolIds, current.nodePoolId, patch.nodePoolIds, patch.nodePoolId),
    nodeNames: uniqueStrings(current.nodeNames, patch.nodeNames, patch.nodeName),
    cvmInstanceIds: uniqueStrings(current.cvmInstanceIds, patch.cvmInstanceIds, patch.cvmInstanceId, patch.instanceIds, patch.instanceId),
    podNames: uniqueStrings(current.podNames, patch.podNames, patch.podName),
    jobNames: uniqueStrings(current.jobNames, patch.jobNames, patch.jobName),
    pvcNames: uniqueStrings(current.pvcNames, patch.pvcNames, patch.pvcName),
    cosKeys: uniqueStrings(current.cosKeys, patch.cosKeys, patch.cosKey, patch.artifactKeys, patch.artifactKey),
    ledgerIds: uniqueStrings(current.ledgerIds, patch.ledgerIds, patch.ledgerId),
    cleanupRemaining: normalizeRemaining(patch.cleanupRemaining || current.cleanupRemaining),
    updatedAt,
  };
}

export function markProvisionResourceCleanup(current = {}, {
  status = "deleted",
  requestId = "",
  cleanupEvidenceId = "",
  billingStoppedAt = new Date().toISOString(),
  remaining = {},
} = {}) {
  return mergeProvisionResourceMapping(current, {
    cleanupStatus: stringValue(status || "deleted"),
    deleteRequestId: stringValue(requestId || current.deleteRequestId),
    cleanupEvidenceId: stringValue(cleanupEvidenceId || current.cleanupEvidenceId),
    billingStoppedAt: stringValue(billingStoppedAt || current.billingStoppedAt),
    cleanupRemaining: normalizeRemaining(remaining),
    updatedAt: stringValue(billingStoppedAt || new Date().toISOString()),
  });
}

export function upsertProvisionResourceMapping(state, mapping) {
  if (!Array.isArray(state.resourceMappings)) state.resourceMappings = [];
  const normalized = buildProvisionResourceMapping({
    context: mapping,
    nodePoolId: mapping.nodePoolId,
    requestId: mapping.createRequestId,
    createdAt: mapping.createdAt,
    billingStartedAt: mapping.billingStartedAt,
    cloudResources: mapping,
  });
  const index = state.resourceMappings.findIndex((item) =>
    (normalized.resourceOrderId && item.resourceOrderId === normalized.resourceOrderId) ||
    (normalized.nodePoolId && item.nodePoolId === normalized.nodePoolId) ||
    (normalized.id && item.id === normalized.id)
  );
  if (index >= 0) {
    state.resourceMappings[index] = mergeProvisionResourceMapping(state.resourceMappings[index], normalized);
    return state.resourceMappings[index];
  }
  state.resourceMappings.unshift(normalized);
  return normalized;
}

export function observeProvisionResourceMappingResources(state, input = {}) {
  const mapping = findProvisionResourceMapping(state, {
    resourceOrderId: stringValue(input.resourceOrderId || input.resource_order_id),
    nodePoolId: stringValue(input.nodePoolId || input.node_pool_id),
    runId: stringValue(input.runId || input.run_id),
  });
  if (!mapping) return null;
  const observedAt = stringValue(input.observedAt || input.observed_at || new Date().toISOString());
  const cloudResources = cloudResourcePatch({
    ...(input.cloudResources || input.cloud_resources || {}),
    clusterId: input.clusterId || input.cluster_id || input.cloudResources?.clusterId || input.cloud_resources?.cluster_id,
    nodePoolId: input.nodePoolId || input.node_pool_id || input.cloudResources?.nodePoolId || input.cloud_resources?.node_pool_id,
  });
  const index = state.resourceMappings.findIndex((item) => item.id === mapping.id);
  const updated = mergeProvisionResourceMapping(mapping, {
    ...cloudResources,
    lastObservedAt: observedAt,
    updatedAt: observedAt,
  });
  if (index >= 0) state.resourceMappings[index] = updated;
  const order = (state.orders || []).find((item) =>
    (updated.resourceOrderId && item.resourceOrderId === updated.resourceOrderId) ||
    (updated.nodePoolId && item.nodePoolId === updated.nodePoolId) ||
    (updated.runId && item.runId === updated.runId)
  );
  if (order) {
    order.cloudResourceIds = uniqueStrings(order.cloudResourceIds, updated.nodePoolIds, updated.nodePoolId, updated.cvmInstanceIds, updated.cosKeys);
    order.resourceMappingId = updated.id;
    order.updatedAt = observedAt;
  }
  return updated;
}

export function findProvisionResourceMapping(state, { resourceOrderId = "", nodePoolId = "", runId = "" } = {}) {
  const mappings = Array.isArray(state.resourceMappings) ? state.resourceMappings : [];
  const hasLookup = Boolean(resourceOrderId || nodePoolId || runId);
  if (!hasLookup) return null;
  return mappings.find((item) => {
    if (resourceOrderId && item.resourceOrderId !== resourceOrderId) return false;
    if (nodePoolId && item.nodePoolId !== nodePoolId) return false;
    if (runId && item.runId !== runId) return false;
    return true;
  }) || null;
}

export function updateProvisionResourceMappingCleanup(state, input = {}) {
  const mapping = findProvisionResourceMapping(state, {
    resourceOrderId: stringValue(input.resourceOrderId || input.resource_order_id),
    nodePoolId: stringValue(input.nodePoolId || input.node_pool_id),
    runId: stringValue(input.runId || input.run_id),
  });
  if (!mapping) return null;
  const index = state.resourceMappings.findIndex((item) => item.id === mapping.id);
  const updated = markProvisionResourceCleanup(mapping, {
    status: stringValue(input.status || input.cleanupStatus || input.cleanup_status || "deleted"),
    requestId: stringValue(input.requestId || input.deleteRequestId || input.delete_request_id),
    cleanupEvidenceId: stringValue(input.cleanupEvidenceId || input.cleanup_evidence_id),
    billingStoppedAt: stringValue(input.billingStoppedAt || input.billing_stopped_at || new Date().toISOString()),
    remaining: input.cleanupRemaining || input.cleanup_remaining || {},
  });
  if (index >= 0) state.resourceMappings[index] = updated;
  const order = (state.orders || []).find((item) =>
    (updated.resourceOrderId && item.resourceOrderId === updated.resourceOrderId) ||
    (updated.nodePoolId && item.nodePoolId === updated.nodePoolId) ||
    (updated.runId && item.runId === updated.runId)
  );
  if (order) {
    order.billingStoppedAt = updated.billingStoppedAt;
    order.cleanupStatus = updated.cleanupStatus;
    order.cleanupEvidenceId = updated.cleanupEvidenceId;
    order.updatedAt = updated.updatedAt;
  }
  return updated;
}
