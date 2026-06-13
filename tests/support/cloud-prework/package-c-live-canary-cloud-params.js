import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXED_CLUSTER_ID = "cls-fi097sy4";
const FIXED_PLATFORM_NODE_POOL_ID = "np-cbk784r8";
const FIXED_TENANT_NODE_POOL_PREFIX = "medopl-tenant-";
const FIXED_WORKER_SUBNET_ID = "subnet-a1fldajw";
const FIXED_SECURITY_GROUP_ID = "sg-6671l5we";
const PLAN_CATALOG_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "package-c-live-canary-plan-catalog-allowlist.json",
);

export const REQUIRED_CLOUD_PARAMETER_KEYS = Object.freeze([
  "planId",
  "workerSubnetId",
  "availabilityZone",
  "systemDisk",
  "securityGroupId",
  "nodeImageOrRuntimeConfig",
  "billingMode",
  "publicIp",
  "loginOrKeyPolicy",
]);

export const PACKAGE_C_PLAN_CATALOG = Object.freeze(JSON.parse(readFileSync(PLAN_CATALOG_PATH, "utf8")));

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

function requireInteger(value, key) {
  if (typeof value === "boolean" || value === null || String(value).trim() === "" || !Number.isInteger(Number(value))) {
    throw new Error(`package_c_live_canary_readiness_cloud_param_missing:${key}`);
  }
  return Number(value);
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

function planAliases(plan) {
  return [plan.id, ...(Array.isArray(plan.aliases) ? plan.aliases : [])].map((item) => String(item || "").trim()).filter(Boolean);
}

function planFor(input) {
  const requested = String(input || "").trim();
  const plan = (PACKAGE_C_PLAN_CATALOG.plans || []).find((item) => planAliases(item).includes(requested));
  if (!plan) throw new Error(`package_c_live_canary_readiness_plan_not_allowlisted:${requested}`);
  return plan;
}

function validateCatalogShape(plan) {
  const compute = requireObject(plan.compute, "plan.compute");
  const tke = requireObject(plan.tke, "plan.tke");
  const systemDisk = requireObject(tke.systemDisk, "plan.tke.systemDisk");
  const publicIp = requireObject(tke.publicIp, "plan.tke.publicIp");
  return {
    id: requireString(plan.id, "plan.id"),
    planCatalogId: requireString(PACKAGE_C_PLAN_CATALOG.contract, "planCatalog.contract"),
    compute: {
      cpuCores: requireInteger(compute.cpuCores, "plan.compute.cpuCores"),
      memoryGb: requireInteger(compute.memoryGb, "plan.compute.memoryGb"),
      maxConcurrentTasks: requireInteger(compute.maxConcurrentTasks, "plan.compute.maxConcurrentTasks"),
    },
    workspaceStorageGb: requireInteger(plan.workspaceStorageGb, "plan.workspaceStorageGb"),
    nodeInstanceType: requireString(tke.nodeInstanceType, "plan.tke.nodeInstanceType"),
    systemDisk: {
      type: requireString(systemDisk.type, "plan.tke.systemDisk.type"),
      sizeGb: requireInteger(systemDisk.sizeGb, "plan.tke.systemDisk.sizeGb"),
    },
    billingMode: requireString(tke.billingMode, "plan.tke.billingMode"),
    publicIp: {
      enabled: publicIp.enabled,
    },
  };
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

  const requestedPlanId = requireString(params.planId, "planId");
  const plan = validateCatalogShape(planFor(requestedPlanId));
  const serverPlan = validateCatalogShape(planFor(options.serverPlanId));
  if (plan.id !== serverPlan.id) {
    throw new Error(`package_c_live_canary_readiness_plan_mismatch:${serverPlan.id}:${plan.id}`);
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
    requestedPlanId,
    planId: plan.id,
    planCatalogId: plan.planCatalogId,
    compute: plan.compute,
    workspaceStorageGb: plan.workspaceStorageGb,
    nodeInstanceType: plan.nodeInstanceType,
    workerSubnetId: params.workerSubnetId,
    securityGroupId: params.securityGroupId,
    availabilityZone: requireString(params.availabilityZone, "availabilityZone"),
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
  if (normalized.systemDisk.type !== plan.systemDisk.type) {
    throw new Error(`package_c_live_canary_readiness_system_disk_type_must_be_${plan.systemDisk.type}`);
  }
  if (normalized.systemDisk.sizeGb !== plan.systemDisk.sizeGb) {
    throw new Error(`package_c_live_canary_readiness_system_disk_size_must_be_${plan.systemDisk.sizeGb}`);
  }
  if (normalized.billingMode !== plan.billingMode) {
    throw new Error(`package_c_live_canary_readiness_billing_mode_must_be_${plan.billingMode}`);
  }
  if (normalized.publicIp.enabled !== false) {
    throw new Error("package_c_live_canary_readiness_public_ip_must_be_disabled");
  }
  if (normalized.publicIp.enabled !== plan.publicIp.enabled) {
    throw new Error("package_c_live_canary_readiness_plan_public_ip_must_be_disabled");
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
    planId: cloudParameters.planId,
    requestedPlanId: cloudParameters.requestedPlanId,
    planCatalogId: cloudParameters.planCatalogId,
    compute: cloudParameters.compute,
    workspaceStorageGb: cloudParameters.workspaceStorageGb,
    nodeInstanceType: cloudParameters.nodeInstanceType,
    workerSubnetId: cloudParameters.workerSubnetId,
    securityGroupId: cloudParameters.securityGroupId,
    availabilityZone: cloudParameters.availabilityZone,
    systemDisk: cloudParameters.systemDisk,
    billingMode: cloudParameters.billingMode,
    publicIp: cloudParameters.publicIp,
    nodeImageOrRuntimeConfig: cloudParameters.nodeImageOrRuntimeConfig,
    loginOrKeyPolicy: cloudParameters.loginOrKeyPolicy,
  };
}
