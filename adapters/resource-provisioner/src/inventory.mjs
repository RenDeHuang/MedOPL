import { COST_TAG_KEYS, TENCENT_CLOUD_REGION, TENCENT_TKE_CLUSTER_ID, tencentCloudConfigured } from "./config.mjs";
import { callCvm, callTke, sanitizeTencentError } from "./tencent-cloud.mjs";

const REQUIRED_CLOUD_TAG_KEYS = COST_TAG_KEYS.map((key) => key.replaceAll("_", ""));

export function metadataMap(items = []) {
  if (!Array.isArray(items)) return {};
  return Object.fromEntries(
    items
      .map((item) => [
        String(item.Key || item.key || item.Name || item.name || "").trim(),
        String(item.Value || item.value || "").trim(),
      ])
      .filter(([key]) => key),
  );
}

function mergeMetadata(primary = [], secondary = []) {
  const merged = [];
  const seen = new Set();
  for (const entry of [...primary, ...secondary]) {
    const key = String(entry?.Key || entry?.key || entry?.Name || entry?.name || "").trim();
    if (!key || seen.has(key)) continue;
    merged.push(entry);
    seen.add(key);
  }
  return merged;
}

function extractInstanceId(item = {}) {
  return String(item.InstanceId || item.InstanceIdSet?.[0] || item.NodeId || item.Instance?.InstanceId || item.id || "").trim();
}

function extractNodePoolId(item = {}) {
  return String(
    item.NodePoolId ||
    item.NodePool?.NodePoolId ||
    item.NodePool?.Id ||
    item.NodePoolIdSet?.[0] ||
    item.NodePool?.NodePoolIdSet?.[0] ||
    "",
  ).trim();
}

function normalizeNodePool(item = {}) {
  const tags = item.Tags || item.TagSet || [];
  const labels = item.Labels || item.LabelSet || [];
  const mappedTags = metadataMap(tags);
  const mappedLabels = metadataMap(labels);
  return {
    id: String(item.NodePoolId || item.Id || item.id || "").trim(),
    nodePoolId: String(item.NodePoolId || item.Id || item.id || "").trim(),
    name: String(item.Name || item.NamePrefix || item.nodePoolName || "").trim(),
    status: String(item.LifeState || item.Status || item.State || "").trim(),
    clusterId: String(item.ClusterId || TENCENT_TKE_CLUSTER_ID).trim(),
    desiredCapacity: item.DesiredCapacity ?? item.AutoScalingGroupRange?.DesiredCapacity,
    maxNodes: item.MaxNodes ?? item.MaxSize ?? item?.AutoScalingGroupRange?.MaxSize,
    minNodes: item.MinNodes ?? item.MinSize ?? item?.AutoScalingGroupRange?.MinSize,
    labels,
    labelMap: mappedLabels,
    labelCompleteness: [
      "gaofenglab/resource-order-id",
      "gaofenglab/run-id",
      "gaofenglab/server-plan-id",
      "gaofenglab/tenant-id",
      "gaofenglab/workspace-id",
    ].filter((key) => mappedLabels[key]).length,
    tags,
    tagMap: mappedTags,
    tagCompleteness: REQUIRED_CLOUD_TAG_KEYS.filter((key) => mappedTags[key]).length,
    raw: item,
  };
}

function normalizeInstance(item = {}, clusterItem = {}) {
  const tags = mergeMetadata(item.Tags || item.TagSet || [], clusterItem.Tags || clusterItem.TagSet || []);
  const mappedTags = metadataMap(tags);
  const instanceId = extractInstanceId(item) || extractInstanceId(clusterItem);
  return {
    id: instanceId,
    instanceId,
    instanceName: String(item.InstanceName || item.Name || "").trim(),
    instanceType: String(item.InstanceType || "").trim(),
    status: String(item.InstanceState || item.Status || item.State || "").trim(),
    privateIp: item.PrivateIpAddresses?.[0] || item.LanIp || "",
    publicIp: item.PublicIpAddresses?.[0] || item.WanIp || "",
    clusterId: String(clusterItem.ClusterId || item.ClusterId || TENCENT_TKE_CLUSTER_ID).trim(),
    clusterStatus: String(clusterItem.InstanceState || clusterItem.Status || clusterItem.State || "").trim(),
    nodePoolId: extractNodePoolId(clusterItem) || extractNodePoolId(item),
    nodePoolName: String(clusterItem.NodePoolName || clusterItem.NodePool?.Name || item.NodePoolName || "").trim(),
    tags,
    tagMap: mappedTags,
    tagCompleteness: REQUIRED_CLOUD_TAG_KEYS.filter((key) => mappedTags[key]).length,
    raw: item,
    rawCluster: clusterItem,
  };
}

function extractInstanceIds(clusterInstances = []) {
  return clusterInstances
    .map((item) => extractInstanceId(item))
    .filter((item) => /^ins-[a-z0-9]+$/i.test(item))
    .filter(Boolean);
}

export async function describeNodePools(options = {}) {
  const clusterId = String(options.clusterId || TENCENT_TKE_CLUSTER_ID).trim();
  const region = String(options.region || TENCENT_CLOUD_REGION).trim();
  const response = await callTke("DescribeClusterNodePools", { ClusterId: clusterId }, region);
  const items = response.NodePools || response.NodePoolSet || response.Items || [];
  return items.map(normalizeNodePool);
}

export async function describeClusterInstances(options = {}) {
  const clusterId = String(options.clusterId || TENCENT_TKE_CLUSTER_ID).trim();
  const region = String(options.region || TENCENT_CLOUD_REGION).trim();
  const response = await callTke("DescribeClusterInstances", { ClusterId: clusterId }, region);
  const items = response.InstanceSet || response.Instances || response.Items || [];
  const clusterItemsByInstanceId = new Map();
  for (const item of items) {
    const instanceId = extractInstanceId(item);
    if (instanceId) clusterItemsByInstanceId.set(instanceId, item);
  }
  const instanceIds = extractInstanceIds(items);
  if (!instanceIds.length) return items.map((item) => normalizeInstance(item, item));
  const cvm = await callCvm("DescribeInstances", { InstanceIds: instanceIds }, region);
  const cvmItems = cvm.InstanceSet || cvm.Instances || [];
  const normalized = cvmItems.map((item) => normalizeInstance(item, clusterItemsByInstanceId.get(extractInstanceId(item)) || {}));
  const seen = new Set(normalized.map((item) => item.instanceId).filter(Boolean));
  for (const [instanceId, clusterItem] of clusterItemsByInstanceId.entries()) {
    if (seen.has(instanceId)) continue;
    normalized.push(normalizeInstance({}, clusterItem));
  }
  return normalized;
}

export async function cloudResources() {
  if (!tencentCloudConfigured()) {
    return {
      ok: false,
      reason: "tencent_cloud_credentials_not_configured",
      cluster: { clusterId: TENCENT_TKE_CLUSTER_ID, region: TENCENT_CLOUD_REGION },
      summary: { nodePoolCount: 0, instanceCount: 0, taggedInstanceCount: 0, orderLinkedNodePoolCount: 0 },
      nodePools: [],
      instances: [],
    };
  }

  try {
    const [nodePools, instances] = await Promise.all([describeNodePools(), describeClusterInstances()]);
    const taggedInstanceCount = instances.filter((item) => item.tagCompleteness >= COST_TAG_KEYS.length).length;
    const orderLinkedNodePoolCount = nodePools.filter((item) => item.tagMap.resourceorderid || item.labelMap["gaofenglab/resource-order-id"]).length;
    return {
      ok: true,
      source: "tencent_cloud_tke_cvm",
      cluster: { clusterId: TENCENT_TKE_CLUSTER_ID, region: TENCENT_CLOUD_REGION },
      summary: {
        nodePoolCount: nodePools.length,
        instanceCount: instances.length,
        taggedInstanceCount,
        orderLinkedNodePoolCount,
      },
      nodePools,
      instances,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      reason: "tencent_cloud_inventory_failed",
      error: sanitizeTencentError(error),
      cluster: { clusterId: TENCENT_TKE_CLUSTER_ID, region: TENCENT_CLOUD_REGION },
      summary: { nodePoolCount: 0, instanceCount: 0, taggedInstanceCount: 0, orderLinkedNodePoolCount: 0 },
      nodePools: [],
      instances: [],
    };
  }
}
