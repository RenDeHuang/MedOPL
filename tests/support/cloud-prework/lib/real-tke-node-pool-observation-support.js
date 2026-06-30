import { failClosed } from "./real-tke-lifecycle-failure-support.js";

export function publicRef(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/[^A-Za-z0-9_.:-]/gu, "-").slice(0, 96);
}

export function extractFirstString(value, keys = []) {
  if (!value || typeof value !== "object") return "";
  for (const key of keys) {
    const child = value[key];
    if (typeof child === "string" && child.trim()) return child.trim();
  }
  return "";
}

export function extractNumber(value, keys = []) {
  if (!value || typeof value !== "object") return 0;
  for (const key of keys) {
    const number = Number(value[key]);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

export function withoutEmpty(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined && child !== null && child !== ""));
}

export function nodePoolNodeTotal(nodePool = {}) {
  const summary = nodePool.NodeCountSummary || nodePool.Native?.NodeCountSummary || {};
  const autoscaling = summary.AutoscalingAdded || {};
  const manual = summary.ManuallyAdded || {};
  const total = extractNumber(autoscaling, ["Total", "Normal", "Joining", "Initializing"])
    + extractNumber(manual, ["Total", "Normal", "Joining", "Initializing"]);
  return total || extractNumber(nodePool.Native || {}, ["ReadyReplicas"]);
}

export function nodePoolReadyNodeCount(nodePool = {}) {
  const summary = nodePool.NodeCountSummary || nodePool.Native?.NodeCountSummary || {};
  const autoscaling = summary.AutoscalingAdded || {};
  const manual = summary.ManuallyAdded || {};
  const ready = extractNumber(autoscaling, ["Normal", "Ready", "Total"])
    + extractNumber(manual, ["Normal", "Ready", "Total"]);
  return ready || extractNumber(nodePool.Native || {}, ["ReadyReplicas"]);
}

export function nodePoolInstanceTypes(nodePool = {}) {
  const sources = [
    nodePool.InstanceTypes,
    nodePool.Native?.InstanceTypes,
    nodePool.Regular?.InstanceTypes,
    nodePool.LaunchConfiguration?.InstanceTypes,
  ];
  for (const source of sources) {
    if (Array.isArray(source) && source.length) return source.map((item) => String(item || "").trim()).filter(Boolean);
  }
  const single = extractFirstString(nodePool, ["InstanceType"]);
  return single ? [single] : [];
}

export function tagValue(item = {}, keys = []) {
  const sources = [
    item.Tags,
    item.TagSet,
    item.Labels,
    item.LabelSet,
    item.TagSpecification?.Tags,
  ].filter(Array.isArray);
  for (const source of sources) {
    for (const tag of source) {
      const key = String(tag?.Key ?? tag?.key ?? tag?.Name ?? tag?.name ?? "").trim();
      const value = String(tag?.Value ?? tag?.value ?? "").trim();
      if (keys.includes(key) && value) return value;
    }
  }
  return "";
}

export function classifyNodePool(nodePool = {}) {
  const role = tagValue(nodePool, ["medopl.io/pool", "medopl.io/role", "medopl_pool", "medopl_role"]);
  if (["platform", "platform_service", "platform_services"].includes(role)) return "platform_service";
  if (["tenant", "tenant_node_pool", "tenant_workspace"].includes(role)) return "tenant";
  if (["shared", "shared_user_compute"].includes(role)) return "shared_user_compute_forbidden";
  return "unclassified";
}

export function summarizeNodePoolCandidate(nodePool = {}) {
  return withoutEmpty({
    nodePoolRef: publicRef(extractFirstString(nodePool, ["NodePoolId", "NodePoolID", "Id", "ID"])),
    name: publicRef(extractFirstString(nodePool, ["Name", "NodePoolName"])),
    role: classifyNodePool(nodePool),
    lifeState: publicRef(extractFirstString(nodePool, ["LifeState", "Status", "State"])),
    nodeTotal: nodePoolNodeTotal(nodePool),
    readyNodeCount: nodePoolReadyNodeCount(nodePool),
  });
}

export function nativeNodePoolDescribeRequest(clusterId, nodePoolId) {
  return {
    ClusterId: clusterId,
    Filters: [{ Name: "NodePoolsId", Values: [nodePoolId] }],
    Limit: 20,
  };
}

function observationFailureDetails(operation, stage, nodePoolId, attempts, lastObservation = null, waitReason = "node_pool_not_found") {
  return {
    operationClass: operation,
    stage,
    nodePoolRef: "created_node_pool_ref",
    observed: withoutEmpty({
      found: false,
      stage,
      attempts,
      waitReason,
      nodePoolRef: publicRef(nodePoolId),
      ...(lastObservation || {}),
    }),
  };
}

function deletionFailureDetails(operation, nodePoolId, attempts, lastObservation = null) {
  return {
    operationClass: operation,
    nodePoolRef: "created_node_pool_ref",
    observed: withoutEmpty({
      found: Boolean(lastObservation),
      attempts,
      waitReason: lastObservation ? "node_pool_still_visible" : "node_pool_not_found",
      nodePoolRef: publicRef(nodePoolId),
      ...(lastObservation || {}),
    }),
  };
}

async function wait() {
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

function observedNodePool(found, stage, attempt) {
  return {
    found: true,
    nodePoolId: extractFirstString(found, ["NodePoolId", "NodePoolID", "Id", "ID"]),
    stage,
    attempt,
    lifeState: extractFirstString(found, ["LifeState", "Status", "State"]),
    nodeTotal: nodePoolNodeTotal(found),
    readyNodeCount: nodePoolReadyNodeCount(found),
    desiredNodesNum: extractNumber(found, ["DesiredNodesNum", "DesiredCapacity"]),
    minNodesNum: extractNumber(found, ["MinNodesNum", "MinSize"]),
    maxNodesNum: extractNumber(found, ["MaxNodesNum", "MaxSize"]),
    instanceTypes: nodePoolInstanceTypes(found),
  };
}

function observedNativeNodePool(found, stage, attempt) {
  return {
    ...observedNodePool(found, stage, attempt),
    desiredNodesNum: extractNumber(found.Native || found, ["Replicas", "DesiredNodesNum", "DesiredCapacity"]),
    minNodesNum: extractNumber(found.Native?.Scaling || found, ["MinReplicas", "MinNodesNum", "MinSize"]),
    maxNodesNum: extractNumber(found.Native?.Scaling || found, ["MaxReplicas", "MaxNodesNum", "MaxSize"]),
  };
}

async function waitForObservedPool({ describe, poolsKey, clusterId, nodePoolId, operation, stage, maxAttempts, options, native }) {
  let lastObservation = null;
  let waitReason = "node_pool_not_found";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await describe();
    const nodePools = Array.isArray(response?.[poolsKey]) ? response[poolsKey] : [];
    const found = nodePools.find((item) => extractFirstString(item, ["NodePoolId", "NodePoolID", "Id", "ID"]) === nodePoolId);
    if (found) {
      const observed = native ? observedNativeNodePool(found, stage, attempt) : observedNodePool(found, stage, attempt);
      observed.nodePoolId = nodePoolId;
      lastObservation = observed;
      if (options.requireNodeTotal && observed.nodeTotal < Number(options.requireNodeTotal)) {
        waitReason = "node_total_below_requirement";
        await wait();
        continue;
      }
      if (options.requireReadyNodeCount && observed.readyNodeCount < Number(options.requireReadyNodeCount)) {
        waitReason = "ready_node_count_below_requirement";
        await wait();
        continue;
      }
      if (options.requireDesiredNodesNum && observed.desiredNodesNum !== Number(options.requireDesiredNodesNum)) {
        waitReason = "desired_nodes_num_mismatch";
        await wait();
        continue;
      }
      if (options.requireInstanceType && !observed.instanceTypes.includes(String(options.requireInstanceType))) {
        waitReason = "instance_type_mismatch";
        await wait();
        continue;
      }
      return observed;
    }
    lastObservation = null;
    waitReason = "node_pool_not_found";
    await wait();
  }
  failClosed("production_goal_real_tke_node_pool_not_observed", observationFailureDetails(operation, stage, nodePoolId, maxAttempts, lastObservation, waitReason), 1);
}

async function waitForDeletedPool({ describe, poolsKey, clusterId, nodePoolId, operation, maxAttempts }) {
  let lastObservation = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await describe();
    const found = (Array.isArray(response?.[poolsKey]) ? response[poolsKey] : [])
      .find((item) => extractFirstString(item, ["NodePoolId", "NodePoolID", "Id", "ID"]) === nodePoolId);
    if (!found) return { cleanupVerified: true, nodePoolDestroyed: true, attempt };
    lastObservation = summarizeNodePoolCandidate({ ...found, NodePoolId: nodePoolId });
    lastObservation.attempt = attempt;
    await wait();
  }
  failClosed("production_goal_real_tke_node_pool_destroy_not_verified", deletionFailureDetails(operation, nodePoolId, maxAttempts, lastObservation), 1);
}

export async function waitForTkeNodePool(client, clusterId, nodePoolId, operation, stage, maxAttempts = 12, options = {}) {
  return waitForObservedPool({
    describe: () => client.DescribeClusterNodePools({ ClusterId: clusterId }),
    poolsKey: "NodePoolSet",
    clusterId,
    nodePoolId,
    operation,
    stage,
    maxAttempts,
    options,
    native: false,
  });
}

export async function waitForTkeNodePoolDeleted(client, clusterId, nodePoolId, operation, maxAttempts = 18) {
  return waitForDeletedPool({
    describe: () => client.DescribeClusterNodePools({ ClusterId: clusterId }),
    poolsKey: "NodePoolSet",
    clusterId,
    nodePoolId,
    operation,
    maxAttempts,
  });
}

export async function waitForNativeTkeNodePool(client, clusterId, nodePoolId, operation, stage, maxAttempts = 12, options = {}) {
  return waitForObservedPool({
    describe: () => client.DescribeNodePools(nativeNodePoolDescribeRequest(clusterId, nodePoolId)),
    poolsKey: "NodePools",
    clusterId,
    nodePoolId,
    operation,
    stage,
    maxAttempts,
    options,
    native: true,
  });
}

export async function waitForNativeTkeNodePoolDeleted(client, clusterId, nodePoolId, operation, maxAttempts = 18) {
  return waitForDeletedPool({
    describe: () => client.DescribeNodePools(nativeNodePoolDescribeRequest(clusterId, nodePoolId)),
    poolsKey: "NodePools",
    clusterId,
    nodePoolId,
    operation,
    maxAttempts,
  });
}
