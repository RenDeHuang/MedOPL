const FIXED_CLUSTER_ID = "cls-fi097sy4";
const FIXED_PLATFORM_NODE_POOL_ID = "np-cbk784r8";
const FIXED_TENANT_NODE_POOL_PREFIX = "medopl-tenant-";
const FIXED_WORKER_SUBNET_ID = "subnet-a1fldajw";
const FIXED_SECURITY_GROUP_ID = "sg-6671l5we";

export const REQUIRED_CLOUD_PARAMETER_KEYS = Object.freeze([
  "workerSubnetId",
  "availabilityZone",
  "instanceType",
  "systemDisk",
  "securityGroupId",
  "nodeImageOrRuntimeConfig",
  "billingMode",
  "publicIp",
  "loginOrKeyPolicy",
]);

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "schemaVersion",
  "clusterId",
  "protectedPlatformNodePoolId",
  "tenantNodePoolPrefix",
  ...REQUIRED_CLOUD_PARAMETER_KEYS,
]);

function requireString(value, key) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`package_c_live_canary_readiness_cloud_param_missing:${key}`);
  }
  return value.trim();
}

function requireObject(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`package_c_live_canary_readiness_cloud_param_missing:${key}`);
  }
  return value;
}

export function parseCloudParameters(content = "") {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("package_c_live_canary_readiness_cloud_params_json_invalid");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("package_c_live_canary_readiness_cloud_params_must_be_object");
  }
  for (const key of Object.keys(parsed)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      throw new Error(`package_c_live_canary_readiness_cloud_param_not_allowed:${key}`);
    }
  }
  return parsed;
}

export function validateCloudParameters(params, options) {
  if (params.schemaVersion !== 1) {
    throw new Error("package_c_live_canary_readiness_cloud_params_schema_version_must_be_1");
  }
  if (params.clusterId !== FIXED_CLUSTER_ID || params.clusterId !== options.targetClusterId) {
    throw new Error("package_c_live_canary_readiness_cloud_cluster_must_be_cls_fi097sy4");
  }
  if (params.protectedPlatformNodePoolId !== FIXED_PLATFORM_NODE_POOL_ID || params.protectedPlatformNodePoolId !== options.protectedPlatformNodePoolId) {
    throw new Error("package_c_live_canary_readiness_cloud_platform_pool_must_be_np_cbk784r8");
  }
  if (params.tenantNodePoolPrefix !== FIXED_TENANT_NODE_POOL_PREFIX || params.tenantNodePoolPrefix !== options.tenantNodePoolPrefix) {
    throw new Error("package_c_live_canary_readiness_cloud_tenant_prefix_must_be_medopl_tenant");
  }
  if (params.workerSubnetId !== FIXED_WORKER_SUBNET_ID) {
    throw new Error("package_c_live_canary_readiness_worker_subnet_must_be_subnet_a1fldajw");
  }
  if (params.securityGroupId !== FIXED_SECURITY_GROUP_ID) {
    throw new Error("package_c_live_canary_readiness_security_group_must_be_sg_6671l5we");
  }

  const systemDisk = requireObject(params.systemDisk, "systemDisk");
  const publicIp = requireObject(params.publicIp, "publicIp");
  const nodeImageOrRuntimeConfig = requireObject(params.nodeImageOrRuntimeConfig, "nodeImageOrRuntimeConfig");
  const loginOrKeyPolicy = requireObject(params.loginOrKeyPolicy, "loginOrKeyPolicy");

  const normalized = {
    schemaVersion: 1,
    clusterId: params.clusterId,
    protectedPlatformNodePoolId: params.protectedPlatformNodePoolId,
    tenantNodePoolPrefix: params.tenantNodePoolPrefix,
    workerSubnetId: params.workerSubnetId,
    securityGroupId: params.securityGroupId,
    availabilityZone: requireString(params.availabilityZone, "availabilityZone"),
    instanceType: requireString(params.instanceType, "instanceType"),
    systemDisk: {
      type: requireString(systemDisk.type, "systemDisk.type"),
      sizeGb: Number(systemDisk.sizeGb),
    },
    billingMode: requireString(params.billingMode, "billingMode"),
    publicIp: {
      enabled: publicIp.enabled,
    },
    nodeImageOrRuntimeConfig: {
      imageType: requireString(nodeImageOrRuntimeConfig.imageType, "nodeImageOrRuntimeConfig.imageType"),
      runtime: requireString(nodeImageOrRuntimeConfig.runtime, "nodeImageOrRuntimeConfig.runtime"),
      runtimeVersion: requireString(nodeImageOrRuntimeConfig.runtimeVersion, "nodeImageOrRuntimeConfig.runtimeVersion"),
    },
    loginOrKeyPolicy: {
      mode: requireString(loginOrKeyPolicy.mode, "loginOrKeyPolicy.mode"),
    },
  };

  if (!Number.isInteger(normalized.systemDisk.sizeGb) || normalized.systemDisk.sizeGb < 20 || normalized.systemDisk.sizeGb > 100) {
    throw new Error("package_c_live_canary_readiness_system_disk_size_out_of_range");
  }
  if (normalized.publicIp.enabled !== false) {
    throw new Error("package_c_live_canary_readiness_public_ip_must_be_disabled");
  }
  if (normalized.loginOrKeyPolicy.mode !== "DISABLED") {
    throw new Error("package_c_live_canary_readiness_login_policy_must_be_disabled");
  }
  return normalized;
}

export function redactedCreateNodePoolRequest(cloudParameters, options) {
  const tenantNodePoolId = `${options.tenantNodePoolPrefix}${options.resourceBindingId}`;
  return {
    api: "CreateNodePool",
    executedNow: false,
    clusterId: cloudParameters.clusterId,
    protectedPlatformNodePoolId: cloudParameters.protectedPlatformNodePoolId,
    tenantNodePoolId,
    tenantNodePoolPrefix: cloudParameters.tenantNodePoolPrefix,
    workerSubnetId: cloudParameters.workerSubnetId,
    securityGroupId: cloudParameters.securityGroupId,
    availabilityZone: cloudParameters.availabilityZone,
    instanceType: cloudParameters.instanceType,
    systemDisk: cloudParameters.systemDisk,
    billingMode: cloudParameters.billingMode,
    publicIp: cloudParameters.publicIp,
    nodeImageOrRuntimeConfig: cloudParameters.nodeImageOrRuntimeConfig,
    loginOrKeyPolicy: cloudParameters.loginOrKeyPolicy,
  };
}
