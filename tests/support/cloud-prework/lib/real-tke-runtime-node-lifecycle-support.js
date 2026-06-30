import path from "node:path";
import { pathToFileURL } from "node:url";

import { parseEnvFile, readJsonFile } from "./production-goal-command-config-support.js";

export class RealTkeLifecycleFailure extends Error {
  constructor(blocker, details = {}, status = 1) {
    super(blocker);
    this.blocker = blocker;
    this.details = details;
    this.status = status;
  }
}

function failClosed(blocker, details = {}, status = 1) {
  throw new RealTkeLifecycleFailure(blocker, details, status);
}

function requireObject(value, blocker, operation) {
  if (!value || typeof value !== "object" || Array.isArray(value)) failClosed(blocker, { operationClass: operation }, 65);
  return value;
}

function requirePlanObject(plan, key, blocker, operation) {
  return requireObject(plan[key], blocker, operation);
}

function requirePlanArray(plan, key, blocker, operation) {
  const value = plan[key];
  if (!Array.isArray(value) || value.length === 0) failClosed(blocker, { operationClass: operation, missingPlanField: key }, 65);
  return value;
}

function publicRef(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/[^A-Za-z0-9_.:-]/gu, "-").slice(0, 96);
}

function extractFirstString(value, keys = []) {
  if (!value || typeof value !== "object") return "";
  for (const key of keys) {
    const child = value[key];
    if (typeof child === "string" && child.trim()) return child.trim();
  }
  return "";
}

function extractNumber(value, keys = []) {
  if (!value || typeof value !== "object") return 0;
  for (const key of keys) {
    const number = Number(value[key]);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function parseJsonObject(value, blocker, operation) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) failClosed(blocker, { operationClass: operation }, 65);
  try {
    return requireObject(JSON.parse(value), blocker, operation);
  } catch {
    failClosed(blocker, { operationClass: operation }, 65);
  }
}

function nodePoolNodeTotal(nodePool = {}) {
  const summary = nodePool.NodeCountSummary || {};
  const autoscaling = summary.AutoscalingAdded || {};
  const manual = summary.ManuallyAdded || {};
  return extractNumber(autoscaling, ["Total", "Normal", "Joining", "Initializing"])
    + extractNumber(manual, ["Total", "Normal", "Joining", "Initializing"]);
}

function nodePoolReadyNodeCount(nodePool = {}) {
  const summary = nodePool.NodeCountSummary || {};
  const autoscaling = summary.AutoscalingAdded || {};
  const manual = summary.ManuallyAdded || {};
  return extractNumber(autoscaling, ["Normal", "Ready", "Total"])
    + extractNumber(manual, ["Normal", "Ready", "Total"]);
}

function tagValue(item = {}, keys = []) {
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

function classifyNodePool(nodePool = {}) {
  const role = tagValue(nodePool, ["medopl.io/pool", "medopl.io/role", "medopl_pool", "medopl_role"]);
  if (["platform", "platform_service", "platform_services"].includes(role)) return "platform_service";
  if (["tenant", "tenant_node_pool", "tenant_workspace"].includes(role)) return "tenant";
  if (["shared", "shared_user_compute"].includes(role)) return "shared_user_compute_forbidden";
  return "unclassified";
}

function summarizeNodePoolCandidate(nodePool = {}) {
  return withoutEmpty({
    nodePoolRef: publicRef(extractFirstString(nodePool, ["NodePoolId", "NodePoolID", "Id", "ID"])),
    name: publicRef(extractFirstString(nodePool, ["Name", "NodePoolName"])),
    role: classifyNodePool(nodePool),
    lifeState: publicRef(extractFirstString(nodePool, ["LifeState", "Status", "State"])),
    nodeTotal: nodePoolNodeTotal(nodePool),
    readyNodeCount: nodePoolReadyNodeCount(nodePool),
  });
}

function isNodePoolNotFound(error) {
  const text = `${String(error?.code || "")} ${String(error?.message || "")}`;
  return /DBRecordNotFound|record not found|get nodepool .* failed/iu.test(text);
}

function tierById(tiers, id, operation) {
  const found = tiers.find((item) => item?.id === id);
  if (!found) failClosed("production_goal_real_tke_tier_missing", { operationClass: operation, tier: id }, 65);
  return found;
}

function tierRequest(plan, key, tierId, operation) {
  const container = requirePlanObject(plan, key, `production_goal_real_tke_${key}_required`, operation);
  const request = container[tierId];
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    failClosed(`production_goal_real_tke_${key}_${tierId}_required`, { operationClass: operation }, 65);
  }
  return request;
}

function withNodePoolName(request, suffix) {
  const generated = `medopl-${suffix}-${Date.now()}`;
  const name = String(request.Name || generated)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gu, "-")
    .slice(0, 63)
    .replace(/^[^a-z]+/u, "m")
    .replace(/[^a-z0-9]+$/u, "");
  return { ...request, Name: name || generated };
}

function withoutEmpty(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined && child !== null && child !== ""));
}

function normalizeTencentCloudTagKey(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_.:-]/gu, "_")
    .replace(/^_+/u, "")
    .slice(0, 127);
}

function normalizeTencentCloudTags(tags = [], fallback = []) {
  const safe = (Array.isArray(tags) && tags.length ? tags : fallback)
    .map((tag) => {
      const key = normalizeTencentCloudTagKey(tag?.Key ?? tag?.key ?? tag?.Name ?? tag?.name ?? "");
      const value = String(tag?.Value ?? tag?.value ?? "").trim().slice(0, 255);
      return key && value ? { Key: key, Value: value } : null;
    })
    .filter(Boolean);
  return safe.length ? safe : undefined;
}

function cloneLaunchConfiguration(source = {}, overrides = {}, suffix = "runtime") {
  const instanceTypes = Array.isArray(overrides.InstanceTypes) && overrides.InstanceTypes.length
    ? overrides.InstanceTypes
    : (Array.isArray(source.InstanceTypes) && source.InstanceTypes.length ? source.InstanceTypes : undefined);
  return withoutEmpty({
    ImageId: source.ImageId,
    ImageFamily: source.ImageFamily,
    ProjectId: source.ProjectId,
    InstanceType: overrides.InstanceType || (!instanceTypes ? source.InstanceType : undefined),
    InstanceTypes: instanceTypes,
    SystemDisk: source.SystemDisk,
    DataDisks: overrides.DataDisks || source.DataDisks,
    InternetAccessible: source.InternetAccessible,
    SecurityGroupIds: source.SecurityGroupIds,
    EnhancedService: source.EnhancedService,
    InstanceChargeType: source.InstanceChargeType || "POSTPAID_BY_HOUR",
    InstanceTypesCheckPolicy: source.LastOperationInstanceTypesCheckPolicy || source.InstanceTypesCheckPolicy || "ANY",
    InstanceTags: source.InstanceTags,
    Tags: normalizeTencentCloudTags(source.Tags),
    CamRoleName: source.CamRoleName,
    HostNameSettings: source.HostNameSettings,
    InstanceNameSettings: source.InstanceNameSettings,
    DiskTypePolicy: source.DiskTypePolicy,
    HpcClusterId: source.HpcClusterId,
    DisasterRecoverGroupIds: source.DisasterRecoverGroupIds,
    DedicatedClusterId: source.DedicatedClusterId,
  });
}

function cloneAutoScalingGroup(source = {}, launchConfigurationId = "", overrides = {}, suffix = "runtime") {
  return withoutEmpty({
    LaunchConfigurationId: launchConfigurationId,
    MaxSize: Number(overrides.MaxSize || 1),
    MinSize: Number(overrides.MinSize || 1),
    DesiredCapacity: Number(overrides.DesiredCapacity || 1),
    VpcId: source.VpcId,
    SubnetIds: source.SubnetIdSet,
    Zones: source.ZoneSet,
    ProjectId: source.ProjectId,
    DefaultCooldown: source.DefaultCooldown,
    TerminationPolicySet: source.TerminationPolicySet,
    RetryPolicy: source.RetryPolicy,
    Tags: normalizeTencentCloudTags(source.Tags),
    ServiceSettings: source.ServiceSettings,
    MultiZoneSubnetPolicy: source.MultiZoneSubnetPolicy,
    HealthCheckType: source.HealthCheckType,
    LoadBalancerHealthCheckGracePeriod: source.LoadBalancerHealthCheckGracePeriod,
    InstanceAllocationPolicy: source.InstanceAllocationPolicy,
    SpotMixedAllocationPolicy: source.SpotMixedAllocationPolicy,
    CapacityRebalance: source.CapacityRebalance,
    InstanceNameIndexSettings: source.InstanceNameIndexSettings,
    HostNameIndexSettings: source.HostNameIndexSettings,
    ConcurrentScaleOutForDesiredCapacity: source.ConcurrentScaleOutForDesiredCapacity,
  });
}

function createRequestFromDerivedPlan(plan, source = {}, tierId = "", suffix = "runtime") {
  const tier = (Array.isArray(plan.tiers) ? plan.tiers : []).find((item) => item?.id === tierId) || {};
  const tierOverride = plan.deriveFromPlatformNodePool?.tierOverrides?.[tierId] || {};
  const launchConfiguration = cloneLaunchConfiguration(
    source.launchConfiguration,
    {
      InstanceType: tierOverride.instanceType || tier.instanceType || "",
      DataDisks: tierOverride.dataDisks,
    },
    suffix,
  );
  const autoScalingGroup = cloneAutoScalingGroup(
    source.autoScalingGroup,
    "",
    {
      MinSize: tierOverride.minSize || plan.requireNodeTotal || 1,
      MaxSize: tierOverride.maxSize || plan.requireNodeTotal || 1,
      DesiredCapacity: tierOverride.desiredCapacity || plan.requireNodeTotal || 1,
    },
    suffix,
  );
  return {
    Name: `medopl-${suffix}-${tierId}`.slice(0, 63),
    AutoScalingGroupPara: JSON.stringify(autoScalingGroup),
    LaunchConfigurePara: JSON.stringify(launchConfiguration),
    InstanceAdvancedSettings: source.instanceAdvancedSettings || {},
    EnableAutoscale: true,
    Labels: source.labels,
    Taints: source.taints,
    Annotations: source.annotations,
    ContainerRuntime: source.containerRuntime,
    RuntimeVersion: source.runtimeVersion,
    NodePoolOs: source.nodePoolOs,
    OsCustomizeType: source.osCustomizeType,
    DeletionProtection: false,
  };
}

function filterFirst(items = [], keys = []) {
  return (Array.isArray(items) ? items : []).find((item) => keys.every((key) => item?.[key] !== undefined && item?.[key] !== null && item?.[key] !== "")) || null;
}

function pickInstanceType(configs = [], tier = {}, allowedZones = []) {
  const zones = new Set((Array.isArray(allowedZones) ? allowedZones : []).filter(Boolean));
  const candidates = (Array.isArray(configs) ? configs : [])
    .filter((config) => Number(config.CPU) === Number(tier.cpuCores) && Number(config.Memory) === Number(tier.memoryGb))
    .filter((config) => !zones.size || !config.Zone || zones.has(config.Zone))
    .map((config) => String(config.InstanceType || "").trim())
    .filter(Boolean)
    .sort();
  return candidates[0] || "";
}

function pickImage(images = [], pattern = "") {
  const normalizedPattern = String(pattern || "").trim().toLowerCase();
  const candidates = (Array.isArray(images) ? images : [])
    .filter((image) => String(image.ImageId || "").trim())
    .filter((image) => !image.ImageState || String(image.ImageState).toUpperCase() === "NORMAL")
    .filter((image) => {
      if (!normalizedPattern) return true;
      return `${image.ImageName || ""} ${image.OsName || ""} ${image.Platform || ""}`.toLowerCase().includes(normalizedPattern);
    })
    .map((image) => String(image.ImageId || "").trim())
    .sort();
  return candidates[0] || "";
}

function pickSecurityGroup(securityGroups = [], vpcId = "") {
  const candidates = (Array.isArray(securityGroups) ? securityGroups : [])
    .filter((group) => String(group.SecurityGroupId || "").trim())
    .filter((group) => !vpcId || !group.VpcId || group.VpcId === vpcId)
    .sort((left, right) => {
      const leftName = String(left.SecurityGroupName || left.GroupName || "").toLowerCase();
      const rightName = String(right.SecurityGroupName || right.GroupName || "").toLowerCase();
      const leftPreferred = /medopl|runtime|tke|default/u.test(leftName) ? 0 : 1;
      const rightPreferred = /medopl|runtime|tke|default/u.test(rightName) ? 0 : 1;
      if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;
      return String(left.SecurityGroupId).localeCompare(String(right.SecurityGroupId));
    });
  return String(candidates[0]?.SecurityGroupId || "").trim();
}

function securityGroupDiscoveryRequest(securityGroupId = "") {
  return securityGroupId ? { SecurityGroupIds: [securityGroupId] } : { Limit: "100" };
}

function pickZone(configs = [], allowedZones = []) {
  const zones = new Set((Array.isArray(allowedZones) ? allowedZones : []).filter(Boolean));
  const candidates = (Array.isArray(configs) ? configs : [])
    .map((config) => String(config.Zone || "").trim())
    .filter((zone) => zone && (!zones.size || zones.has(zone)))
    .sort();
  return candidates[0] || "";
}

async function importTencentCloudSdkForRealTkeLifecycle() {
  const moduleOverride = String(process.env.V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE || "").trim();
  if (moduleOverride) {
    const absolutePath = path.resolve(moduleOverride);
    const relativePath = path.relative(process.cwd(), absolutePath);
    const isRuntimePath = relativePath.startsWith(`.runtime${path.sep}`);
    const isTempPath = absolutePath.startsWith(path.resolve(process.env.RUNNER_TEMP || process.env.TMPDIR || "/tmp"));
    if (!isRuntimePath && !isTempPath) {
      failClosed("production_goal_real_tke_sdk_module_override_not_allowed", { operationClass: "real_tke_runtime_node_lifecycle" }, 65);
    }
    return import(pathToFileURL(absolutePath).href);
  }
  return import("tencentcloud-sdk-nodejs");
}

async function deriveRealTkePlanFromPlatformNodePool({ plan, env, root, operation }) {
  const clusterId = plan.clusterId || env.TENCENT_MUTATION_TKE_CLUSTER_ID || "";
  const platformNodePoolId = plan.deriveFromPlatformNodePool?.nodePoolId || env.TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID || "";
  const region = plan.region || (env.TENCENT_MUTATION_REGIONS || env.TENCENT_MUTATION_COS_REGION || "").split(",")[0].trim();
  const TkeClient = root?.tke?.v20180525?.Client;
  const AsClient = root?.as?.v20180419?.Client;
  const CvmClient = root?.cvm?.v20170312?.Client;
  if (typeof TkeClient !== "function" || typeof AsClient !== "function" || typeof CvmClient !== "function") {
    failClosed("production_goal_real_tke_sdk_missing", { operationClass: operation }, 65);
  }
  if (!clusterId || !platformNodePoolId || !region) {
    failClosed("production_goal_real_tke_derive_foundation_missing", { operationClass: operation }, 65);
  }
  const clientConfig = {
    credential: { secretId: env.TENCENT_MUTATION_SECRET_ID, secretKey: env.TENCENT_MUTATION_SECRET_KEY },
    region,
    profile: { httpProfile: { reqTimeout: 60 } },
  };
  const tkeClient = new TkeClient(clientConfig);
  const asClient = new AsClient(clientConfig);
  const cvmClient = new CvmClient(clientConfig);
  let detail;
  try {
    detail = await tkeClient.DescribeClusterNodePoolDetail({ ClusterId: clusterId, NodePoolId: platformNodePoolId });
  } catch (error) {
    let candidateNodePools = [];
    try {
      const response = await tkeClient.DescribeClusterNodePools({ ClusterId: clusterId });
      candidateNodePools = (Array.isArray(response?.NodePoolSet) ? response.NodePoolSet : [])
        .map((item) => summarizeNodePoolCandidate(item))
        .filter((item) => item.nodePoolRef)
        .slice(0, 12);
    } catch {
      candidateNodePools = [];
    }
    failClosed(isNodePoolNotFound(error)
      ? "production_goal_real_tke_platform_node_pool_not_found"
      : "production_goal_real_tke_platform_node_pool_detail_failed", {
      operationClass: operation,
      clusterRef: "TENCENT_MUTATION_TKE_CLUSTER_ID",
      sourceNodePoolRef: "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID",
      requestedNodePoolRef: publicRef(platformNodePoolId),
      candidateNodePools,
      nextAction: "update TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID from a verified platform_service candidate or provide TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_JSON",
    }, 65);
  }
  const nodePool = detail?.NodePool || {};
  const autoScalingGroupId = nodePool.AutoscalingGroupId || "";
  const launchConfigurationId = nodePool.LaunchConfigurationId || "";
  if (!autoScalingGroupId || !launchConfigurationId) {
    failClosed("production_goal_real_tke_platform_node_pool_detail_incomplete", { operationClass: operation }, 65);
  }
  const asResponse = await asClient.DescribeAutoScalingGroups({ AutoScalingGroupIds: [autoScalingGroupId] });
  const launchResponse = await asClient.DescribeLaunchConfigurations({ LaunchConfigurationIds: [launchConfigurationId] });
  const sourceAsGroup = filterFirst(asResponse?.AutoScalingGroupSet || [], ["VpcId", "SubnetIdSet", "ZoneSet"]);
  const sourceLaunchConfiguration = filterFirst(launchResponse?.LaunchConfigurationSet || [], ["SecurityGroupIds"]);
  if (!sourceAsGroup || !sourceLaunchConfiguration) {
    failClosed("production_goal_real_tke_platform_as_detail_incomplete", { operationClass: operation }, 65);
  }
  const zoneResponse = await cvmClient.DescribeInstanceTypeConfigs({ Filters: [{ Name: "instance-charge-type", Values: ["POSTPAID_BY_HOUR"] }] });
  const instanceTypes = zoneResponse?.InstanceTypeConfigSet || [];
  const derivedTiers = (Array.isArray(plan.tiers) ? plan.tiers : []).map((tier) => ({
    ...tier,
    instanceType: tier.instanceType || pickInstanceType(instanceTypes, tier, sourceAsGroup.ZoneSet || []),
  }));
  for (const tier of derivedTiers) {
    if (!tier.instanceType) {
      failClosed("production_goal_real_tke_instance_type_unavailable", {
        operationClass: operation,
        tier: tier.id || "unknown",
        cpuCores: tier.cpuCores,
        memoryGb: tier.memoryGb,
      }, 65);
    }
  }
  const source = {
    autoScalingGroup: sourceAsGroup,
    launchConfiguration: sourceLaunchConfiguration,
    instanceAdvancedSettings: plan.deriveFromPlatformNodePool?.instanceAdvancedSettings || {
      Taints: [],
      Labels: [],
      DataDisks: [],
      ExtraArgs: {},
    },
    labels: nodePool.Labels || [],
    taints: nodePool.Taints || [],
    annotations: nodePool.Annotations || [],
    containerRuntime: nodePool.RuntimeConfig?.RuntimeType || undefined,
    runtimeVersion: nodePool.RuntimeConfig?.RuntimeVersion || undefined,
    nodePoolOs: nodePool.NodePoolOs || undefined,
    tags: normalizeTencentCloudTags(nodePool.TagSpecification?.Tags),
  };
  return {
    ...plan,
    clusterId,
    region,
    tiers: derivedTiers,
    createClusterNodePool: {
      starter_2c4g_10gb: createRequestFromDerivedPlan({ ...plan, tiers: derivedTiers }, source, "starter_2c4g_10gb", "starter"),
      pro_8c16g_100gb: createRequestFromDerivedPlan({ ...plan, tiers: derivedTiers }, source, "pro_8c16g_100gb", "pro"),
    },
    upgradeClusterNodePool: plan.upgradeClusterNodePool || {
      modifyNodePoolInstanceTypes: {
        InstanceTypes: [derivedTiers.find((tier) => tier.id === "pro_8c16g_100gb")?.instanceType].filter(Boolean),
      },
    },
    deleteClusterNodePool: plan.deleteClusterNodePool || { KeepInstance: false },
    derivedFromPlatformNodePool: {
      enabled: true,
      sourceNodePoolRef: "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID",
      sourceAutoScalingGroupRef: "platform_source_as_group_ref",
      sourceLaunchConfigurationRef: "platform_source_launch_config_ref",
    },
  };
}

async function deriveRealTkePlanFromClusterFoundation({ plan, env, root, operation }) {
  const clusterId = plan.clusterId || env.TENCENT_MUTATION_TKE_CLUSTER_ID || "";
  const region = plan.region || (env.TENCENT_MUTATION_REGIONS || env.TENCENT_MUTATION_COS_REGION || "").split(",")[0].trim();
  const foundation = plan.deriveFromClusterFoundation || {};
  const TkeClient = root?.tke?.v20180525?.Client;
  const CvmClient = root?.cvm?.v20170312?.Client;
  if (typeof TkeClient !== "function" || typeof CvmClient !== "function") {
    failClosed("production_goal_real_tke_sdk_missing", { operationClass: operation }, 65);
  }
  if (!clusterId || !region) {
    failClosed("production_goal_real_tke_cluster_foundation_missing", { operationClass: operation }, 65);
  }
  const clientConfig = {
    credential: { secretId: env.TENCENT_MUTATION_SECRET_ID, secretKey: env.TENCENT_MUTATION_SECRET_KEY },
    region,
    profile: { httpProfile: { reqTimeout: 60 } },
  };
  const tkeClient = new TkeClient(clientConfig);
  const cvmClient = new CvmClient(clientConfig);
  const clusterResponse = await tkeClient.DescribeClusters({ ClusterIds: [clusterId], Limit: 20 });
  const cluster = (Array.isArray(clusterResponse?.Clusters) ? clusterResponse.Clusters : [])
    .find((item) => item?.ClusterId === clusterId) || {};
  const clusterNetwork = cluster.ClusterNetworkSettings || {};
  const vpcId = foundation.vpcId || clusterNetwork.VpcId || "";
  const subnetId = foundation.subnetId || (Array.isArray(clusterNetwork.Subnets) ? clusterNetwork.Subnets[0] : "") || "";
  if (!vpcId || !subnetId) {
    failClosed("production_goal_real_tke_cluster_foundation_missing", {
      operationClass: operation,
      missing: [
        ...(!vpcId ? ["vpcId"] : []),
        ...(!subnetId ? ["subnetId"] : []),
      ],
    }, 65);
  }
  const instanceTypeResponse = await cvmClient.DescribeInstanceTypeConfigs({});
  const instanceTypes = instanceTypeResponse?.InstanceTypeConfigSet || [];
  const clusterSubnetZones = Array.isArray(clusterNetwork.SubnetIdSet)
    ? clusterNetwork.SubnetIdSet.map((item) => String(item?.Zone || item?.zone || "").trim()).filter(Boolean)
    : [];
  const zone = String(foundation.zone || pickZone(instanceTypes, clusterSubnetZones)).trim();
  if (!zone) failClosed("production_goal_real_tke_cluster_foundation_zone_missing", { operationClass: operation }, 65);
  const derivedTiers = (Array.isArray(plan.tiers) ? plan.tiers : []).map((tier) => ({
    ...tier,
    instanceType: tier.instanceType || pickInstanceType(instanceTypes, tier, [zone]),
  }));
  for (const tier of derivedTiers) {
    if (!tier.instanceType) {
      failClosed("production_goal_real_tke_instance_type_unavailable", {
        operationClass: operation,
        tier: tier.id || "unknown",
        cpuCores: tier.cpuCores,
        memoryGb: tier.memoryGb,
        zone,
      }, 65);
    }
  }
  let imageId = String(foundation.imageId || "").trim();
  if (!imageId && foundation.discoverImage === true) {
    const imageResponse = await cvmClient.DescribeImages({
      Filters: [{ Name: "image-type", Values: ["PUBLIC_IMAGE"] }],
      Limit: 100,
    });
    imageId = pickImage(imageResponse?.ImageSet || [], foundation.imageNamePattern || "TencentOS");
    if (!imageId) failClosed("production_goal_real_tke_cluster_foundation_image_missing", { operationClass: operation }, 65);
  }
  let securityGroupId = String(foundation.securityGroupId || "").trim();
  if (securityGroupId || foundation.validateSecurityGroup === true || foundation.requireSecurityGroup !== false) {
    const VpcClient = root?.vpc?.v20170312?.Client;
    if (typeof VpcClient !== "function") failClosed("production_goal_real_tke_sdk_missing", { operationClass: operation }, 65);
    const vpcClient = new VpcClient(clientConfig);
    const securityGroupResponse = await vpcClient.DescribeSecurityGroups(securityGroupDiscoveryRequest(securityGroupId));
    securityGroupId ||= pickSecurityGroup(securityGroupResponse?.SecurityGroupSet || [], vpcId);
    const securityGroup = (Array.isArray(securityGroupResponse?.SecurityGroupSet) ? securityGroupResponse.SecurityGroupSet : [])
      .find((item) => item?.SecurityGroupId === securityGroupId) || {};
    if (!securityGroup.SecurityGroupId) {
      failClosed("production_goal_real_tke_cluster_foundation_security_group_missing", { operationClass: operation }, 65);
    }
  }
  const source = {
    autoScalingGroup: {
      VpcId: vpcId,
      SubnetIdSet: [subnetId],
      ZoneSet: [zone],
      ProjectId: Number(foundation.projectId || 0),
      DefaultCooldown: 300,
    },
    launchConfiguration: {
      ImageId: imageId || undefined,
      SystemDisk: foundation.systemDisk || { DiskType: "CLOUD_PREMIUM", DiskSize: 50 },
      SecurityGroupIds: securityGroupId ? [securityGroupId] : undefined,
      InternetAccessible: foundation.internetAccessible || { InternetChargeType: "TRAFFIC_POSTPAID_BY_HOUR", InternetMaxBandwidthOut: 1, PublicIpAssigned: false },
      EnhancedService: foundation.enhancedService || { SecurityService: { Enabled: true }, MonitorService: { Enabled: true } },
      InstanceChargeType: "POSTPAID_BY_HOUR",
    },
    instanceAdvancedSettings: foundation.instanceAdvancedSettings || {
      Taints: [],
      Labels: [],
      DataDisks: [],
      ExtraArgs: {},
    },
    labels: foundation.labels || [{ Name: "medopl.io/pool", Value: "tenant_workspace" }],
    taints: foundation.taints || [],
    annotations: foundation.annotations || [],
    containerRuntime: foundation.containerRuntime || "containerd",
    runtimeVersion: foundation.runtimeVersion || undefined,
    nodePoolOs: foundation.nodePoolOs || "tlinux3.1x86_64",
    tags: normalizeTencentCloudTags(foundation.tags),
  };
  return {
    ...plan,
    clusterId,
    region,
    tiers: derivedTiers,
    createClusterNodePool: {
      starter_2c4g_10gb: createRequestFromDerivedPlan({ ...plan, tiers: derivedTiers }, source, "starter_2c4g_10gb", "starter"),
      pro_8c16g_100gb: createRequestFromDerivedPlan({ ...plan, tiers: derivedTiers }, source, "pro_8c16g_100gb", "pro"),
    },
    upgradeClusterNodePool: plan.upgradeClusterNodePool || {
      modifyNodePoolInstanceTypes: {
        InstanceTypes: [derivedTiers.find((tier) => tier.id === "pro_8c16g_100gb")?.instanceType].filter(Boolean),
      },
    },
    deleteClusterNodePool: plan.deleteClusterNodePool || { KeepInstance: false },
    derivedFromClusterFoundation: {
      enabled: true,
      vpcRef: "cluster_foundation_vpc_ref",
      subnetRef: "cluster_foundation_subnet_ref",
      securityGroupRef: "cluster_foundation_security_group_ref",
      imageRef: "cluster_foundation_image_ref",
    },
  };
}

async function waitForTkeNodePool(client, clusterId, nodePoolId, operation, stage, maxAttempts = 12, options = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await client.DescribeClusterNodePools({ ClusterId: clusterId });
    const nodePools = Array.isArray(response?.NodePoolSet) ? response.NodePoolSet : [];
    const found = nodePools.find((item) => extractFirstString(item, ["NodePoolId", "NodePoolID", "Id", "ID"]) === nodePoolId);
    if (found) {
      const observed = {
        found: true,
        nodePoolId,
        stage,
        attempt,
        lifeState: extractFirstString(found, ["LifeState", "Status", "State"]),
        nodeTotal: nodePoolNodeTotal(found),
        readyNodeCount: nodePoolReadyNodeCount(found),
        desiredNodesNum: extractNumber(found, ["DesiredNodesNum", "DesiredCapacity"]),
        minNodesNum: extractNumber(found, ["MinNodesNum", "MinSize"]),
        maxNodesNum: extractNumber(found, ["MaxNodesNum", "MaxSize"]),
      };
      if (options.requireNodeTotal && observed.nodeTotal < Number(options.requireNodeTotal)) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      if (options.requireReadyNodeCount && observed.readyNodeCount < Number(options.requireReadyNodeCount)) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      if (options.requireDesiredNodesNum && observed.desiredNodesNum !== Number(options.requireDesiredNodesNum)) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      return observed;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  failClosed("production_goal_real_tke_node_pool_not_observed", { operationClass: operation, stage, nodePoolRef: "created_node_pool_ref" }, 1);
}

async function waitForTkeNodePoolDeleted(client, clusterId, nodePoolId, operation, maxAttempts = 18) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await client.DescribeClusterNodePools({ ClusterId: clusterId });
    const found = (Array.isArray(response?.NodePoolSet) ? response.NodePoolSet : [])
      .some((item) => extractFirstString(item, ["NodePoolId", "NodePoolID", "Id", "ID"]) === nodePoolId);
    if (!found) return { cleanupVerified: true, nodePoolDestroyed: true, attempt };
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  failClosed("production_goal_real_tke_node_pool_destroy_not_verified", { operationClass: operation, nodePoolRef: "created_node_pool_ref" }, 1);
}

export async function runRealTkeRuntimeNodeLifecycle({ operation, env, plan: inputPlan, writeEvidence }) {
  let plan = inputPlan;
  const sdkRoot = await importTencentCloudSdkForRealTkeLifecycle();
  const root = sdkRoot.default || sdkRoot;
  if (plan.deriveFromPlatformNodePool?.enabled === true) {
    plan = await deriveRealTkePlanFromPlatformNodePool({ plan, env, root, operation });
  } else if (plan.deriveFromClusterFoundation?.enabled === true) {
    plan = await deriveRealTkePlanFromClusterFoundation({ plan, env, root, operation });
  }
  const clusterId = plan.clusterId || env.TENCENT_MUTATION_TKE_CLUSTER_ID || "";
  const region = plan.region || (env.TENCENT_MUTATION_REGIONS || env.TENCENT_MUTATION_COS_REGION || "").split(",")[0].trim();
  const tiers = requirePlanArray(plan, "tiers", "production_goal_real_tke_tiers_required", operation);
  const starterCreateRequest = tierRequest(plan, "createClusterNodePool", "starter_2c4g_10gb", operation);
  const proCreateRequest = tierRequest(plan, "createClusterNodePool", "pro_8c16g_100gb", operation);
  const upgradeRequest = requirePlanObject(plan, "upgradeClusterNodePool", "production_goal_real_tke_upgrade_request_required", operation);
  const deleteRequest = requirePlanObject(plan, "deleteClusterNodePool", "production_goal_real_tke_delete_request_required", operation);
  if (!clusterId || !region) failClosed("production_goal_real_tke_foundation_missing", { operationClass: operation }, 65);
  const starterTier = tierById(tiers, "starter_2c4g_10gb", operation);
  const proTier = tierById(tiers, "pro_8c16g_100gb", operation);
  for (const request of [starterCreateRequest, proCreateRequest]) {
    parseJsonObject(request.AutoScalingGroupPara, "production_goal_real_tke_asg_para_required", operation);
    parseJsonObject(request.LaunchConfigurePara, "production_goal_real_tke_launch_para_required", operation);
  }
  if (!upgradeRequest.modifyClusterNodePool && !upgradeRequest.modifyNodePoolInstanceTypes) {
    failClosed("production_goal_real_tke_upgrade_request_required", { operationClass: operation }, 65);
  }
  const Client = root?.tke?.v20180525?.Client;
  if (typeof Client !== "function") failClosed("production_goal_real_tke_sdk_missing", { operationClass: operation }, 65);
  const client = new Client({
    credential: { secretId: env.TENCENT_MUTATION_SECRET_ID, secretKey: env.TENCENT_MUTATION_SECRET_KEY },
    region,
    profile: { httpProfile: { reqTimeout: 60 } },
  });
  const createdNodePoolIds = [];
  const lifecycle = {};
  let cleanupResults = [];
  try {
    const starterCreated = await client.CreateClusterNodePool({ ClusterId: clusterId, ...withNodePoolName(starterCreateRequest, "starter") });
    const starterNodePoolId = extractFirstString(starterCreated, ["NodePoolId", "NodePoolID", "Id", "ID"])
      || extractFirstString(starterCreated?.Response, ["NodePoolId", "NodePoolID", "Id", "ID"]);
    if (!starterNodePoolId) failClosed("production_goal_real_tke_create_missing_node_pool_id", { operationClass: operation, tier: starterTier.id }, 1);
    createdNodePoolIds.push(starterNodePoolId);
    const starterObserved = await waitForTkeNodePool(client, clusterId, starterNodePoolId, operation, "starter_created", Number(plan.createObserveAttempts || 24), {
      requireNodeTotal: Number(plan.requireNodeTotal || 1),
      requireReadyNodeCount: Number(plan.requireReadyNodeCount || plan.requireNodeTotal || 1),
    });
    if (upgradeRequest.modifyClusterNodePool) await client.ModifyClusterNodePool({ ClusterId: clusterId, NodePoolId: starterNodePoolId, ...upgradeRequest.modifyClusterNodePool });
    if (upgradeRequest.modifyNodePoolInstanceTypes) await client.ModifyNodePoolInstanceTypes({ ClusterId: clusterId, NodePoolId: starterNodePoolId, ...upgradeRequest.modifyNodePoolInstanceTypes });
    const starterUpgradeObserved = await waitForTkeNodePool(client, clusterId, starterNodePoolId, operation, "starter_upgrade_checked", Number(plan.upgradeObserveAttempts || 12));
    const proCreated = await client.CreateClusterNodePool({ ClusterId: clusterId, ...withNodePoolName(proCreateRequest, "pro") });
    const proNodePoolId = extractFirstString(proCreated, ["NodePoolId", "NodePoolID", "Id", "ID"])
      || extractFirstString(proCreated?.Response, ["NodePoolId", "NodePoolID", "Id", "ID"]);
    if (!proNodePoolId) failClosed("production_goal_real_tke_create_missing_node_pool_id", { operationClass: operation, tier: proTier.id }, 1);
    createdNodePoolIds.push(proNodePoolId);
    const proObserved = await waitForTkeNodePool(client, clusterId, proNodePoolId, operation, "pro_created", Number(plan.createObserveAttempts || 24), {
      requireNodeTotal: Number(plan.requireNodeTotal || 1),
      requireReadyNodeCount: Number(plan.requireReadyNodeCount || plan.requireNodeTotal || 1),
    });
    lifecycle.createStarter = { api: "CreateClusterNodePool", tier: starterTier.id, observed: starterObserved };
    lifecycle.upgradeStarter = {
      api: upgradeRequest.modifyNodePoolInstanceTypes ? "ModifyNodePoolInstanceTypes" : "ModifyClusterNodePool",
      tierFrom: starterTier.id,
      tierTo: proTier.id,
      observed: starterUpgradeObserved,
    };
    lifecycle.createPro = { api: "CreateClusterNodePool", tier: proTier.id, observed: proObserved };
  } finally {
    cleanupResults = [];
    for (const nodePoolId of [...createdNodePoolIds].reverse()) {
      const cleanupResult = { nodePoolRef: publicRef(nodePoolId), cleanupVerified: false, nodePoolDestroyed: false };
      try {
        await client.DeleteClusterNodePool({ ClusterId: clusterId, NodePoolIds: [nodePoolId], ...deleteRequest });
        Object.assign(cleanupResult, await waitForTkeNodePoolDeleted(client, clusterId, nodePoolId, operation, Number(plan.deleteObserveAttempts || 36)));
      } catch (error) {
        cleanupResult.cleanupBlocker = error instanceof RealTkeLifecycleFailure
          ? error.blocker
          : String(error?.code || error?.name || "production_goal_real_tke_cleanup_failed").replace(/[^A-Za-z0-9_.:-]/gu, "_").slice(0, 96);
      }
      cleanupResults.push(cleanupResult);
    }
  }
  const cleanupVerified = cleanupResults.length === createdNodePoolIds.length && cleanupResults.every((item) => item.cleanupVerified && item.nodePoolDestroyed);
  if (!cleanupVerified) failClosed("production_goal_real_tke_cleanup_incomplete", { operationClass: operation }, 1);
  const tierCoverage = tiers.map((tier) => ({ id: tier.id, cpuCores: tier.cpuCores, memoryGb: tier.memoryGb, storageGb: tier.storageGb }));
  const evidenceRef = writeEvidence(operation, {
    status: "accepted",
    realProviderMutationExecuted: true,
    provider: "tencent_tke",
    clusterRef: "TENCENT_MUTATION_TKE_CLUSTER_ID",
    nodePoolRefs: createdNodePoolIds.map(publicRef),
    region,
    tierCoverage,
    lifecycle: {
      derivedFromPlatformNodePool: Boolean(plan.derivedFromPlatformNodePool?.enabled),
      derivedFromClusterFoundation: Boolean(plan.derivedFromClusterFoundation?.enabled),
      ...lifecycle,
      destroy: { api: "DeleteClusterNodePool", cleanupResults },
    },
    cleanupVerified,
    nodePoolDestroyed: cleanupVerified,
    cannotClaim: ["production complete", "all users/all tenants", "SLA/multi-region", "ongoing authorization"],
  });
  return {
    evidenceRef,
    provider: "tencent_tke",
    realProviderMutationExecuted: true,
    nodePoolRefs: createdNodePoolIds.map(publicRef),
    tierCoverage: tierCoverage.map((tier) => tier.id),
    derivedFromClusterFoundation: Boolean(plan.derivedFromClusterFoundation?.enabled),
    upgradeVerified: true,
    cleanupVerified,
    nodePoolDestroyed: cleanupVerified,
  };
}

export async function runRealTkeRuntimeNodeLifecycleCommand({ operation, fail, writeEvidence }) {
  try {
    return await runRealTkeRuntimeNodeLifecycle({
      operation,
      env: parseEnvFile(process.env.V22_TENCENT_MUTATION_SECRET_FILE),
      plan: readJsonFile(process.env.V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE),
      writeEvidence,
    });
  } catch (error) {
    if (error instanceof RealTkeLifecycleFailure) fail(error.blocker, error.details, error.status);
    throw error;
  }
}
