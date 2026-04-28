import { COST_TAG_KEYS, TENCENT_CLOUD_REGION, TENCENT_TKE_CLUSTER_ID, tencentCloudConfigured } from "./config.mjs";
import { callCvm, callTke, sanitizeTencentError } from "./tencent-cloud.mjs";

function tagMap(tags = []) {
  if (!Array.isArray(tags)) return {};
  return Object.fromEntries(tags.map((tag) => [String(tag.Key || tag.key || "").trim(), String(tag.Value || tag.value || "").trim()]).filter(([key]) => key));
}

function normalizeNodePool(item = {}) {
  return {
    id: String(item.NodePoolId || item.Id || item.id || "").trim(),
    nodePoolId: String(item.NodePoolId || item.Id || item.id || "").trim(),
    name: String(item.Name || item.NamePrefix || item.nodePoolName || "").trim(),
    status: String(item.LifeState || item.Status || item.State || "").trim(),
    clusterId: String(item.ClusterId || TENCENT_TKE_CLUSTER_ID).trim(),
    maxNodes: item.MaxNodes ?? item.MaxSize ?? item?.AutoScalingGroupRange?.MaxSize,
    minNodes: item.MinNodes ?? item.MinSize ?? item?.AutoScalingGroupRange?.MinSize,
    labels: item.Labels || [],
    tags: item.Tags || [],
    raw: item,
  };
}

function normalizeInstance(item = {}) {
  const tags = item.Tags || item.TagSet || [];
  const mappedTags = tagMap(tags);
  return {
    id: String(item.InstanceId || item.InstanceIdSet?.[0] || item.id || "").trim(),
    instanceId: String(item.InstanceId || item.InstanceIdSet?.[0] || item.id || "").trim(),
    instanceName: String(item.InstanceName || item.Name || "").trim(),
    instanceType: String(item.InstanceType || "").trim(),
    status: String(item.InstanceState || item.Status || item.State || "").trim(),
    privateIp: item.PrivateIpAddresses?.[0] || item.LanIp || "",
    publicIp: item.PublicIpAddresses?.[0] || item.WanIp || "",
    tags,
    tagCompleteness: COST_TAG_KEYS.filter((key) => mappedTags[key]).length,
    raw: item,
  };
}

function extractInstanceIds(clusterInstances = []) {
  return clusterInstances
    .map((item) => item.InstanceId || item.InstanceIdSet?.[0] || item.NodeId || item.Instance?.InstanceId || "")
    .map((item) => String(item || "").trim())
    .filter((item) => /^ins-[a-z0-9]+$/i.test(item))
    .filter(Boolean);
}

async function describeNodePools() {
  const response = await callTke("DescribeClusterNodePools", { ClusterId: TENCENT_TKE_CLUSTER_ID }, TENCENT_CLOUD_REGION);
  const items = response.NodePools || response.NodePoolSet || response.Items || [];
  return items.map(normalizeNodePool);
}

async function describeClusterInstances() {
  const response = await callTke("DescribeClusterInstances", { ClusterId: TENCENT_TKE_CLUSTER_ID }, TENCENT_CLOUD_REGION);
  const items = response.InstanceSet || response.Instances || response.Items || [];
  const instanceIds = extractInstanceIds(items);
  if (!instanceIds.length) return items.map(normalizeInstance);
  const cvm = await callCvm("DescribeInstances", { InstanceIds: instanceIds }, TENCENT_CLOUD_REGION);
  const cvmItems = cvm.InstanceSet || cvm.Instances || [];
  return cvmItems.map(normalizeInstance);
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
    const orderLinkedNodePoolCount = nodePools.filter((item) => JSON.stringify(item.tags || item.labels || []).includes("resource_order_id")).length;
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
