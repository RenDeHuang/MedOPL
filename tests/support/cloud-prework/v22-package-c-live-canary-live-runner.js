#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseCloudParameters,
  redactedCreateNodePoolRequest,
  validateCloudParameters,
} from "./package-c-live-canary-cloud-params.js";
import {
  PACKAGE_C_LIVE_CANARY_API_ALLOWLIST,
  PACKAGE_C_LIVE_CANARY_SECRET_ALLOWLIST,
  expectedCreateReleasePlan,
  parseEnv,
  validateEnv,
  value,
} from "./v22-package-c-live-canary-readiness.js";

const FORBIDDEN_ARGS = new Set([
  "--apply",
  "--mutate",
  "--deploy",
  "--kubectl",
  "--build",
  "--push",
  "--kubeconfig",
  "--package-d",
  "--modify-node-pool",
]);

const REGION = "na-siliconvalley";
const FIXED_CLUSTER_ID = "cls-fi097sy4";
const FIXED_PLATFORM_NODE_POOL_ID = "np-cbk784r8";
const FIXED_TENANT_NODE_POOL_PREFIX = "medopl-tenant-";
const TARGET_TENANT_NODE_POOL_NAME = "medopl-tenant-rb-package-c-live-canary-20260613";
const API_VERSIONS = Object.freeze({
  GetCallerIdentity: "v20180813",
  DescribeClusters: "v20220501",
  DescribeNodePools: "v20220501",
  CreateNodePool: "v20220501",
  ScaleNodePool: "v20220501",
  DeleteNodePool: "v20220501",
  TagResources: "v20180813",
  GetResources: "v20180813",
});

export function parsePackageCLiveCanaryLiveArgs(argv = process.argv.slice(2)) {
  const options = {
    live: false,
    confirmRealCloud: false,
    secretFile: "",
    cloudParamsFile: "",
    reportDir: path.join(".runtime", "v22-cloud-lifecycle"),
    operationId: "",
    accountId: "",
    workspaceId: "",
    resourceBindingId: "",
    billingAttributionId: "",
    tenantId: "",
    serverPlanId: "",
    targetClusterId: "",
    protectedPlatformNodePoolId: "",
    tenantNodePoolPrefix: "",
    resetRunGate: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (FORBIDDEN_ARGS.has(arg)) throw new Error(`package_c_live_canary_live_forbidden_arg:${arg}`);
    if (arg === "--live") {
      options.live = true;
    } else if (arg === "--confirm-real-cloud") {
      options.confirmRealCloud = true;
    } else if (arg === "--secret-file") {
      options.secretFile = argv[++index] || "";
    } else if (arg === "--cloud-params-file") {
      options.cloudParamsFile = argv[++index] || "";
    } else if (arg === "--report-dir") {
      options.reportDir = argv[++index] || "";
    } else if (arg === "--operation-id") {
      options.operationId = argv[++index] || "";
    } else if (arg === "--account-id") {
      options.accountId = argv[++index] || "";
    } else if (arg === "--workspace-id") {
      options.workspaceId = argv[++index] || "";
    } else if (arg === "--resource-binding-id") {
      options.resourceBindingId = argv[++index] || "";
    } else if (arg === "--billing-attribution-id") {
      options.billingAttributionId = argv[++index] || "";
    } else if (arg === "--tenant-id") {
      options.tenantId = argv[++index] || "";
    } else if (arg === "--server-plan-id") {
      options.serverPlanId = argv[++index] || "";
    } else if (arg === "--target-cluster-id") {
      options.targetClusterId = argv[++index] || "";
    } else if (arg === "--protected-platform-node-pool-id") {
      options.protectedPlatformNodePoolId = argv[++index] || "";
    } else if (arg === "--tenant-node-pool-prefix") {
      options.tenantNodePoolPrefix = argv[++index] || "";
    } else if (arg === "--no-reset-run-gate") {
      throw new Error("package_c_live_canary_live_reset_run_gate_required");
    } else {
      throw new Error(`package_c_live_canary_live_unknown_arg:${arg}`);
    }
  }
  return options;
}

function requireOption(options, key) {
  if (!String(options[key] || "").trim()) throw new Error(`package_c_live_canary_live_missing:${key}`);
}

function validateOptions(options) {
  if (!options.live || !options.confirmRealCloud) {
    throw new Error("package_c_live_canary_live_confirmation_required");
  }
  for (const key of [
    "secretFile",
    "cloudParamsFile",
    "reportDir",
    "operationId",
    "accountId",
    "workspaceId",
    "resourceBindingId",
    "billingAttributionId",
    "tenantId",
    "serverPlanId",
    "targetClusterId",
    "protectedPlatformNodePoolId",
    "tenantNodePoolPrefix",
  ]) {
    requireOption(options, key);
  }
  if (options.targetClusterId !== FIXED_CLUSTER_ID) {
    throw new Error("package_c_live_canary_live_cluster_must_be_cls_fi097sy4");
  }
  if (options.protectedPlatformNodePoolId !== FIXED_PLATFORM_NODE_POOL_ID) {
    throw new Error("package_c_live_canary_live_platform_pool_must_be_np_cbk784r8");
  }
  if (options.tenantNodePoolPrefix !== FIXED_TENANT_NODE_POOL_PREFIX) {
    throw new Error("package_c_live_canary_live_tenant_prefix_must_be_medopl_tenant");
  }
  if (`${options.tenantNodePoolPrefix}${options.resourceBindingId}` !== TARGET_TENANT_NODE_POOL_NAME) {
    throw new Error("package_c_live_canary_live_tenant_node_pool_name_must_match_authorized_target");
  }
}

function validateLiveEnv(env, options) {
  const validation = validateEnv(new Map([...env, ["RUN_TENCENT_CREATE_RELEASE_EXECUTION", "0"]]), options);
  if (value(env, "RUN_TENCENT_CREATE_RELEASE_EXECUTION") !== "1") {
    throw new Error("package_c_live_canary_live_run_gate_must_be_one");
  }
  if (Number(value(env, "TENCENT_MUTATION_DAILY_BUDGET_CNY")) > 50) {
    throw new Error("package_c_live_canary_live_budget_too_high");
  }
  if (Number(value(env, "TENCENT_MUTATION_MAX_OPERATION_COUNT")) !== 1) {
    throw new Error("package_c_live_canary_live_max_operation_count_must_be_one");
  }
  return validation;
}

function normalizeRequestId(response = {}) {
  const value = response?.RequestId;
  return value ? String(value).slice(0, 96) : "";
}

function nodePoolsFrom(response = {}) {
  if (Array.isArray(response.NodePools)) return response.NodePools;
  if (Array.isArray(response.NodePoolSet)) return response.NodePoolSet;
  return [];
}

function findNodePoolByName(response = {}, name = "") {
  return nodePoolsFrom(response).find((nodePool) => String(nodePool?.Name || "") === name) || null;
}

function sanitizedStep(api, status, response = {}, extra = {}) {
  return {
    api,
    action: api,
    ...(API_VERSIONS[api] ? { apiVersion: API_VERSIONS[api] } : {}),
    status,
    ...(extra.nodePoolId ? { nodePoolId: extra.nodePoolId } : {}),
    ...(extra.nodePoolName ? { nodePoolName: extra.nodePoolName } : {}),
    ...(Number.isInteger(extra.replicas) ? { replicas: extra.replicas } : {}),
    ...(extra.region ? { region: extra.region } : {}),
    ...(normalizeRequestId(response) ? { requestId: normalizeRequestId(response) } : {}),
  };
}

function redactedText(value = "") {
  const placeholder = "[redacted-sensitive-value]";
  return String(value || "")
    .replace(/SecretId/gu, placeholder)
    .replace(/SecretKey/gu, placeholder)
    .replace(/Authorization/giu, placeholder)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, `Bearer ${placeholder}`)
    .replace(/\btoken\s*[:=]\s*[^,\s;]+/giu, placeholder)
    .replace(/\btoken\b/giu, placeholder)
    .replace(/\bkubeconfig\b/giu, placeholder)
    .slice(0, 512);
}

function errorRequestId(error = {}) {
  if (error?.requestId) return String(error.requestId).slice(0, 96);
  if (error?.RequestId) return String(error.RequestId).slice(0, 96);
  if (error?.response?.RequestId) return String(error.response.RequestId).slice(0, 96);
  if (error?.response?.requestId) return String(error.response.requestId).slice(0, 96);
  if (typeof error?.getRequestId === "function") {
    return String(error.getRequestId() || "").slice(0, 96);
  }
  return "";
}

function sanitizedErrorPayload(error) {
  const requestId = errorRequestId(error);
  return {
    code: String(error?.code || error?.Code || error?.name || "tencent_sdk_call_failed").replace(/[^A-Za-z0-9_.:-]/gu, "_").slice(0, 96),
    message: redactedText(error?.message || error?.Message || ""),
    requestId,
  };
}

function sanitizedTencentError(api, error, extra = {}) {
  const errorPayload = sanitizedErrorPayload(error);
  return {
    error: errorPayload,
    code: errorPayload.code,
    message: errorPayload.message,
    ...(errorPayload.requestId ? { requestId: errorPayload.requestId } : {}),
    ...(API_VERSIONS[api] ? { apiVersion: API_VERSIONS[api] } : {}),
    action: api,
    ...(extra.region ? { region: extra.region } : {}),
    ...(extra.nodePoolName ? { nodePoolName: extra.nodePoolName } : {}),
  };
}

function sanitizedFailureStep(api, error, extra = {}) {
  const sanitizedError = sanitizedTencentError(api, error, extra);
  return {
    api,
    action: api,
    ...(sanitizedError.apiVersion ? { apiVersion: sanitizedError.apiVersion } : {}),
    status: "failed",
    error: sanitizedError.error,
    code: sanitizedError.code,
    message: sanitizedError.message,
    ...(sanitizedError.requestId ? { requestId: sanitizedError.requestId } : {}),
    ...(extra.nodePoolId ? { nodePoolId: extra.nodePoolId } : {}),
    ...(extra.nodePoolName ? { nodePoolName: extra.nodePoolName } : {}),
    ...(Number.isInteger(extra.replicas) ? { replicas: extra.replicas } : {}),
    ...(extra.region ? { region: extra.region } : {}),
  };
}

function ensureTenantNodePoolId(nodePoolId, protectedNodePoolIds, protectedPlatformNodePoolId) {
  const normalized = String(nodePoolId || "").trim();
  if (!normalized) throw new Error("package_c_live_canary_live_tenant_node_pool_id_missing");
  if (normalized === protectedPlatformNodePoolId || protectedNodePoolIds.includes(normalized)) {
    throw new Error("package_c_live_canary_live_refuses_protected_node_pool_target");
  }
  return normalized;
}

function tagList(options) {
  return [
    { Key: "resourceBindingId", Value: options.resourceBindingId },
    { Key: "billingAttributionId", Value: options.billingAttributionId },
    { Key: "tenantId", Value: options.tenantId },
    { Key: "workspaceId", Value: options.workspaceId },
    { Key: "medopl.io/role", Value: "tenant_node_pool" },
    { Key: "medopl.io/package", Value: "C" },
    { Key: "medopl.io/canary", Value: "package_c_live" },
  ];
}

function nodeLabels(options) {
  return [
    { Name: "medopl.io/role", Value: "tenant-node-pool" },
    { Name: "medopl.io/resource-binding-id", Value: options.resourceBindingId },
    { Name: "medopl.io/workspace-id", Value: options.workspaceId },
  ];
}

function nodeAnnotations(cloudParameters) {
  return [
    { Name: "medopl.io/availability-zone", Value: cloudParameters.availabilityZone },
    { Name: "medopl.io/runtime", Value: cloudParameters.nodeImageOrRuntimeConfig.runtime },
    { Name: "medopl.io/runtime-version", Value: cloudParameters.nodeImageOrRuntimeConfig.runtimeVersion },
    { Name: "medopl.io/image-type", Value: cloudParameters.nodeImageOrRuntimeConfig.imageType },
    { Name: "medopl.io/login-policy", Value: cloudParameters.loginOrKeyPolicy.mode },
  ];
}

function createNodePoolRequest(cloudParameters, options) {
  return {
    ClusterId: options.targetClusterId,
    Name: TARGET_TENANT_NODE_POOL_NAME,
    Type: "Native",
    Labels: nodeLabels(options),
    Tags: [
      {
        ResourceType: "machine",
        Tags: tagList(options),
      },
    ],
    DeletionProtection: false,
    Unschedulable: true,
    Annotations: nodeAnnotations(cloudParameters),
    Native: {
      Scaling: {
        MinReplicas: 0,
        MaxReplicas: 1,
        CreatePolicy: "ZonePriority",
      },
      SubnetIds: [cloudParameters.workerSubnetId],
      InstanceChargeType: cloudParameters.billingMode,
      SystemDisk: {
        DiskType: cloudParameters.systemDisk.type,
        DiskSize: cloudParameters.systemDisk.sizeGb,
      },
      InstanceTypes: [cloudParameters.nodeInstanceType],
      SecurityGroupIds: [cloudParameters.securityGroupId],
      EnableAutoscaling: false,
      Replicas: 0,
      InternetAccessible: {
        MaxBandwidthOut: 0,
        ChargeType: "TRAFFIC_POSTPAID_BY_HOUR",
      },
      MachineType: "NativeCVM",
      AutomationService: true,
      RuntimeRootDir: "/var/lib/containerd",
    },
  };
}

function tagResourceArn(env, nodePoolId) {
  return `qcs::tke:${REGION}:uin/${value(env, "TENCENT_MUTATION_ACCOUNT_ID")}:nodepool/${nodePoolId}`;
}

function assertNoForbiddenApi(api) {
  if (!PACKAGE_C_LIVE_CANARY_API_ALLOWLIST.includes(api)) {
    throw new Error(`package_c_live_canary_live_api_not_allowed:${api}`);
  }
}

async function callStep(steps, api, fn, extra = {}) {
  assertNoForbiddenApi(api);
  try {
    const response = await fn();
    steps.push(sanitizedStep(api, "completed", response, extra));
    return response;
  } catch (error) {
    steps.push(sanitizedFailureStep(api, error, extra));
    throw error;
  }
}

async function rollbackTenantPool({ modules, steps, options, validation, nodePoolId }) {
  if (!nodePoolId) return [];
  const rollbackSteps = [];
  const safeNodePoolId = ensureTenantNodePoolId(
    nodePoolId,
    validation.protectedNodePoolIds,
    options.protectedPlatformNodePoolId,
  );
  try {
    await callStep(steps, "ScaleNodePool", () => modules.scaleNodePool(REGION, {
      ClusterId: options.targetClusterId,
      NodePoolId: safeNodePoolId,
      Replicas: 0,
    }), { region: REGION, nodePoolId: safeNodePoolId, replicas: 0 });
    rollbackSteps.push("scale_tenant_pool_to_zero");
  } catch {
    rollbackSteps.push("scale_tenant_pool_to_zero_failed");
  }
  try {
    await callStep(steps, "DeleteNodePool", () => modules.deleteNodePool(REGION, {
      ClusterId: options.targetClusterId,
      NodePoolId: safeNodePoolId,
    }), { region: REGION, nodePoolId: safeNodePoolId });
    rollbackSteps.push("delete_tenant_pool");
  } catch {
    rollbackSteps.push("delete_tenant_pool_failed");
  }
  return rollbackSteps;
}

async function writeRunGateZero(secretFile) {
  const content = await readFile(secretFile, "utf8");
  const lines = content.split(/\r?\n/u);
  let replaced = false;
  const next = lines.map((line) => {
    if (/^\s*(?:export\s+)?RUN_TENCENT_CREATE_RELEASE_EXECUTION\s*=/u.test(line)) {
      replaced = true;
      const exportPrefix = /^\s*export\s+/u.test(line) ? "export " : "";
      return `${exportPrefix}RUN_TENCENT_CREATE_RELEASE_EXECUTION=0`;
    }
    return line;
  });
  if (!replaced) next.unshift("RUN_TENCENT_CREATE_RELEASE_EXECUTION=0");
  await writeFile(secretFile, next.join("\n"));
}

function redactedSummaryFor({ ok, options, validation, cloudParameters, steps, targetNodePoolId = "", rollbackSteps = [], failure = null }) {
  const evidenceRoot = path.join(options.reportDir, options.operationId);
  return {
    ok,
    package: "C",
    mode: "live_canary",
    operationClass: "package_c.tencent_tke_tenant_node_pool.live_canary.create_scale_release",
    operationId: options.operationId,
    accountId: options.accountId,
    workspaceId: options.workspaceId,
    resourceBindingId: options.resourceBindingId,
    billingAttributionId: options.billingAttributionId,
    tenantId: options.tenantId,
    serverPlanId: options.serverPlanId,
    boundary: {
      realCloudCalls: true,
      mutationExecuted: steps.some((step) => ["CreateNodePool", "ScaleNodePool", "DeleteNodePool", "TagResources"].includes(step.api)),
      readsMutationSecret: true,
      writesLedger: false,
      callsKubectl: false,
      deploysWorkload: false,
      buildsOrPushesImage: false,
      readsKubeconfig: false,
      packageD: false,
      runGateResetTo: "0",
    },
    target: {
      cloudAccountId: "redacted",
      region: REGION,
      clusterId: options.targetClusterId,
      protectedPlatformNodePoolId: options.protectedPlatformNodePoolId,
      protectedNodePoolIds: validation.protectedNodePoolIds,
      tenantNodePoolPrefix: options.tenantNodePoolPrefix,
      tenantNodePoolName: TARGET_TENANT_NODE_POOL_NAME,
      tenantNodePoolId: targetNodePoolId || "",
      workerSubnetId: cloudParameters.workerSubnetId,
      securityGroupId: cloudParameters.securityGroupId,
      publicIp: cloudParameters.publicIp,
      sharedUserComputePoolAllowed: false,
    },
    secretAllowlist: PACKAGE_C_LIVE_CANARY_SECRET_ALLOWLIST,
    apiAllowlist: PACKAGE_C_LIVE_CANARY_API_ALLOWLIST,
    expectedCreateReleasePlan: expectedCreateReleasePlan(options),
    executedApis: steps.map((step) => step.api),
    steps,
    rollback: {
      owner: "MedOPL Operations",
      attempted: rollbackSteps.length > 0,
      steps: rollbackSteps,
      protectedPlatformNodePoolId: options.protectedPlatformNodePoolId,
    },
    evidenceSink: {
      root: evidenceRoot,
      gitTracked: false,
      rawSecretsAllowed: false,
      rawProviderResponseAllowed: false,
    },
    ...(failure ? { failure } : {}),
  };
}

async function writeEvidenceFiles({ options, summary, cloudParameters }) {
  const evidenceRoot = path.join(options.reportDir, options.operationId);
  await mkdir(evidenceRoot, { recursive: true });
  const createRequestPath = path.join(evidenceRoot, "create-request-redacted.json");
  const summaryPath = path.join(evidenceRoot, "summary.json");
  const preflightPath = path.join(evidenceRoot, "preflight.json");
  const createResultPath = path.join(evidenceRoot, "create-result-redacted.json");
  const scaleUpResultPath = path.join(evidenceRoot, "scale-up-result-redacted.json");
  const scaleDownResultPath = path.join(evidenceRoot, "scale-down-result-redacted.json");
  const releaseResultPath = path.join(evidenceRoot, "release-result-redacted.json");
  const failureResultPath = path.join(evidenceRoot, "failure-result-redacted.json");
  await writeFile(createRequestPath, `${JSON.stringify(redactedCreateNodePoolRequest(cloudParameters, options), null, 2)}\n`);
  await writeFile(preflightPath, `${JSON.stringify({
    ok: true,
    operationId: options.operationId,
    clusterId: options.targetClusterId,
    protectedPlatformNodePoolId: options.protectedPlatformNodePoolId,
    tenantNodePoolName: TARGET_TENANT_NODE_POOL_NAME,
    publicIp: cloudParameters.publicIp,
    evidenceSink: summary.evidenceSink,
  }, null, 2)}\n`);
  await writeFile(createResultPath, `${JSON.stringify(summary.steps.find((step) => step.api === "CreateNodePool") || null, null, 2)}\n`);
  await writeFile(scaleUpResultPath, `${JSON.stringify(summary.steps.find((step) => step.api === "ScaleNodePool" && step.replicas === 1) || null, null, 2)}\n`);
  await writeFile(scaleDownResultPath, `${JSON.stringify(summary.steps.find((step) => step.api === "ScaleNodePool" && step.replicas === 0) || null, null, 2)}\n`);
  await writeFile(releaseResultPath, `${JSON.stringify(summary.steps.find((step) => step.api === "DeleteNodePool") || null, null, 2)}\n`);
  await writeFile(failureResultPath, `${JSON.stringify(summary.steps.find((step) => step.status === "failed") || null, null, 2)}\n`);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return {
    evidenceRoot,
    createRequestPath,
    summaryPath,
  };
}

export function createTencentPackageCLiveCanaryModules({ clients, tencentSdkRoot, credentials, defaultRegion = REGION } = {}) {
  if (clients) {
    return {
      getCallerIdentity: (req = null) => clients.sts.GetCallerIdentity(req),
      describeClusters: (region, req = {}) => clients.tkeByRegion[region].DescribeClusters(req),
      describeNodePools: (region, req = {}) => clients.tkeNativeByRegion[region].DescribeNodePools(req),
      createNodePool: (region, req = {}) => clients.tkeNativeByRegion[region].CreateNodePool(req),
      scaleNodePool: (region, req = {}) => clients.tkeNativeByRegion[region].ScaleNodePool(req),
      deleteNodePool: (region, req = {}) => clients.tkeNativeByRegion[region].DeleteNodePool(req),
      tagResources: (req = {}) => clients.tag.TagResources(req),
      getResources: (req = {}) => clients.tag.GetResources(req),
    };
  }
  const sdkRoot = tencentSdkRoot?.default && typeof tencentSdkRoot.default === "object" ? tencentSdkRoot.default : tencentSdkRoot;
  if (!credentials?.secretId || !credentials?.secretKey) throw new Error("package_c_live_canary_live_credentials_required");
  const credential = {
    secretId: credentials.secretId,
    secretKey: credentials.secretKey,
  };
  const clientCache = new Map();
  function client(service, version, region = "") {
    const cacheKey = `${service}:${version}:${region}`;
    if (!clientCache.has(cacheKey)) {
      const Client = sdkRoot?.[service]?.[version]?.Client;
      if (typeof Client !== "function") throw new Error(`package_c_live_canary_live_sdk_client_missing:${service}:${version}`);
      clientCache.set(cacheKey, new Client({
        credential,
        region,
        profile: {
          httpProfile: {
            reqTimeout: 60,
          },
        },
      }));
    }
    return clientCache.get(cacheKey);
  }
  return {
    getCallerIdentity: (req = null) => client("sts", "v20180813", defaultRegion).GetCallerIdentity(req),
    describeClusters: (region, req = {}) => client("tke", "v20220501", region).DescribeClusters(req),
    describeNodePools: (region, req = {}) => client("tke", "v20220501", region).DescribeNodePools(req),
    createNodePool: (region, req = {}) => client("tke", "v20220501", region).CreateNodePool(req),
    scaleNodePool: (region, req = {}) => client("tke", "v20220501", region).ScaleNodePool(req),
    deleteNodePool: (region, req = {}) => client("tke", "v20220501", region).DeleteNodePool(req),
    tagResources: (req = {}) => client("tag", "v20180813", defaultRegion).TagResources(req),
    getResources: (req = {}) => client("tag", "v20180813", defaultRegion).GetResources(req),
  };
}

export async function runPackageCLiveCanaryLive({ options, modules } = {}) {
  if (!options) throw new Error("package_c_live_canary_live_options_required");
  validateOptions(options);
  const env = parseEnv(await readFile(options.secretFile, "utf8"));
  const validation = validateLiveEnv(env, options);
  const cloudParameters = validateCloudParameters(parseCloudParameters(await readFile(options.cloudParamsFile, "utf8")), options);
  if (!modules) throw new Error("package_c_live_canary_live_modules_required");
  const steps = [];
  let targetNodePoolId = "";
  let rollbackSteps = [];
  let summary;
  let lastFailure = null;
  try {
    const identity = await callStep(steps, "GetCallerIdentity", () => modules.getCallerIdentity(null));
    if (String(identity?.AccountId || "") !== value(env, "TENCENT_MUTATION_ACCOUNT_ID")) {
      throw new Error("package_c_live_canary_live_account_id_mismatch");
    }

    const clusterResponse = await callStep(steps, "DescribeClusters", () => modules.describeClusters(REGION, {
      ClusterIds: [options.targetClusterId],
      Limit: 20,
    }), { region: REGION });
    const clusters = Array.isArray(clusterResponse?.Clusters) ? clusterResponse.Clusters : [];
    if (!clusters.some((cluster) => String(cluster?.ClusterId || "") === options.targetClusterId)) {
      throw new Error("package_c_live_canary_live_cluster_not_observed");
    }

    const beforePools = await callStep(steps, "DescribeNodePools", () => modules.describeNodePools(REGION, {
      ClusterId: options.targetClusterId,
      Limit: 100,
    }), { region: REGION });
    if (nodePoolsFrom(beforePools).some((pool) => String(pool?.NodePoolId || "") === options.protectedPlatformNodePoolId && String(pool?.Name || "") === TARGET_TENANT_NODE_POOL_NAME)) {
      throw new Error("package_c_live_canary_live_platform_pool_name_collision");
    }
    if (nodePoolsFrom(beforePools).some((pool) => String(pool?.Name || "") === TARGET_TENANT_NODE_POOL_NAME)) {
      throw new Error("package_c_live_canary_live_tenant_node_pool_already_exists");
    }

    const createResponse = await callStep(steps, "CreateNodePool", () => modules.createNodePool(REGION, createNodePoolRequest(cloudParameters, options)), {
      region: REGION,
      nodePoolName: TARGET_TENANT_NODE_POOL_NAME,
    });
    targetNodePoolId = ensureTenantNodePoolId(
      createResponse?.NodePoolId,
      validation.protectedNodePoolIds,
      options.protectedPlatformNodePoolId,
    );

    const resourceArn = tagResourceArn(env, targetNodePoolId);
    await callStep(steps, "TagResources", () => modules.tagResources({
      ResourceList: [resourceArn],
      Tags: tagList(options),
    }), { region: REGION, nodePoolId: targetNodePoolId, nodePoolName: TARGET_TENANT_NODE_POOL_NAME });

    await callStep(steps, "ScaleNodePool", () => modules.scaleNodePool(REGION, {
      ClusterId: options.targetClusterId,
      NodePoolId: targetNodePoolId,
      Replicas: 1,
    }), { region: REGION, nodePoolId: targetNodePoolId, replicas: 1 });

    const afterCreatePools = await callStep(steps, "DescribeNodePools", () => modules.describeNodePools(REGION, {
      ClusterId: options.targetClusterId,
      Filters: [{ Name: "NodePoolsName", Values: [TARGET_TENANT_NODE_POOL_NAME] }],
      Limit: 20,
    }), { region: REGION, nodePoolId: targetNodePoolId, nodePoolName: TARGET_TENANT_NODE_POOL_NAME });
    const observed = findNodePoolByName(afterCreatePools, TARGET_TENANT_NODE_POOL_NAME);
    if (observed?.NodePoolId) {
      targetNodePoolId = ensureTenantNodePoolId(
        observed.NodePoolId,
        validation.protectedNodePoolIds,
        options.protectedPlatformNodePoolId,
      );
    }

    await callStep(steps, "ScaleNodePool", () => modules.scaleNodePool(REGION, {
      ClusterId: options.targetClusterId,
      NodePoolId: targetNodePoolId,
      Replicas: 0,
    }), { region: REGION, nodePoolId: targetNodePoolId, replicas: 0 });

    await callStep(steps, "DeleteNodePool", () => modules.deleteNodePool(REGION, {
      ClusterId: options.targetClusterId,
      NodePoolId: targetNodePoolId,
    }), { region: REGION, nodePoolId: targetNodePoolId });

    await callStep(steps, "GetResources", () => modules.getResources({
      ResourceList: [resourceArn],
      MaxResults: 50,
    }), { region: REGION, nodePoolId: targetNodePoolId, nodePoolName: TARGET_TENANT_NODE_POOL_NAME });

    summary = redactedSummaryFor({
      ok: true,
      options,
      validation,
      cloudParameters,
      steps,
      targetNodePoolId,
    });
  } catch (error) {
    lastFailure = steps.findLast?.((step) => step.status === "failed") || null;
    rollbackSteps = await rollbackTenantPool({
      modules,
      steps,
      options,
      validation,
      nodePoolId: targetNodePoolId,
    });
    summary = redactedSummaryFor({
      ok: false,
      options,
      validation,
      cloudParameters,
      steps,
      targetNodePoolId,
      rollbackSteps,
      failure: lastFailure ? {
        error: lastFailure.error,
        code: lastFailure.code,
        message: lastFailure.message,
        ...(lastFailure.requestId ? { requestId: lastFailure.requestId } : {}),
        ...(lastFailure.apiVersion ? { apiVersion: lastFailure.apiVersion } : {}),
        action: lastFailure.action || lastFailure.api,
        ...(lastFailure.region ? { region: lastFailure.region } : {}),
        ...(lastFailure.nodePoolName ? { nodePoolName: lastFailure.nodePoolName } : {}),
      } : sanitizedTencentError("local_validator", error, {}),
    });
  } finally {
    await writeRunGateZero(options.secretFile);
  }

  const paths = await writeEvidenceFiles({ options, summary, cloudParameters });
  if (!summary.ok) {
    const error = new Error("package_c_live_canary_live_failed");
    error.summary = { ...summary, ...paths };
    throw error;
  }
  return {
    ok: true,
    package: "C",
    mode: "live_canary",
    operationId: options.operationId,
    targetNodePoolName: TARGET_TENANT_NODE_POOL_NAME,
    targetNodePoolId,
    evidenceRoot: paths.evidenceRoot,
    summaryPath: paths.summaryPath,
    realCloudCalls: true,
    mutationExecuted: true,
    callsKubectl: false,
    deploysWorkload: false,
    buildsOrPushesImage: false,
    readsKubeconfig: false,
    runGateResetTo: "0",
  };
}

async function officialModulesFromEnv(env) {
  const tencentRoot = await import("tencentcloud-sdk-nodejs");
  return createTencentPackageCLiveCanaryModules({
    tencentSdkRoot: tencentRoot,
    credentials: {
      secretId: value(env, "TENCENT_MUTATION_SECRET_ID"),
      secretKey: value(env, "TENCENT_MUTATION_SECRET_KEY"),
    },
  });
}

async function main() {
  const options = parsePackageCLiveCanaryLiveArgs();
  validateOptions(options);
  const env = parseEnv(await readFile(options.secretFile, "utf8"));
  validateLiveEnv(env, options);
  const modules = await officialModulesFromEnv(env);
  const summary = await runPackageCLiveCanaryLive({ options, modules });
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (error) => {
    const summary = error?.summary;
    if (summary) {
      console.error(JSON.stringify({
        ok: false,
        package: "C",
        mode: "live_canary",
        operationId: summary.operationId,
        evidenceRoot: summary.evidenceRoot,
        summaryPath: summary.summaryPath,
        realCloudCalls: true,
        mutationExecuted: summary.boundary?.mutationExecuted === true,
        callsKubectl: false,
        deploysWorkload: false,
        buildsOrPushesImage: false,
        readsKubeconfig: false,
        runGateResetTo: "0",
      }, null, 2));
    } else {
      console.error(String(error?.message || "package_c_live_canary_live_failed"));
    }
    process.exitCode = 1;
  });
}
