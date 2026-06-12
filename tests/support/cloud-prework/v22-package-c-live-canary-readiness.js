#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_CLOUD_PARAMETER_KEYS,
  parseCloudParameters,
  redactedCreateNodePoolRequest,
  validateCloudParameters,
} from "./package-c-live-canary-cloud-params.js";

const FORBIDDEN_ARGS = new Set([
  "--live",
  "--execute",
  "--apply",
  "--mutate",
  "--deploy",
  "--kubectl",
  "--build",
  "--push",
  "--kubeconfig",
]);

export const PACKAGE_C_LIVE_CANARY_SECRET_ALLOWLIST = [
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "TENCENT_MUTATION_ACCOUNT_ID",
  "TENCENT_MUTATION_REGIONS",
  "TENCENT_MUTATION_ALLOWED_APIS",
  "TENCENT_MUTATION_DAILY_BUDGET_CNY",
  "TENCENT_MUTATION_MAX_OPERATION_COUNT",
  "TENCENT_MUTATION_TKE_CLUSTER_ID",
  "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID",
  "TENCENT_MUTATION_PROTECTED_NODE_POOL_IDS",
  "TENCENT_MUTATION_COS_BUCKET",
  "TENCENT_MUTATION_COS_REGION",
  "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT",
];

const SECRET_ALLOWLIST_SET = new Set(PACKAGE_C_LIVE_CANARY_SECRET_ALLOWLIST);

export const PACKAGE_C_LIVE_CANARY_API_ALLOWLIST = [
  "GetCallerIdentity",
  "DescribeClusters",
  "DescribeNodePools",
  "CreateNodePool",
  "ScaleNodePool",
  "DeleteNodePool",
  "GetResources",
  "TagResources",
];

const API_ALLOWLIST_SET = new Set(PACKAGE_C_LIVE_CANARY_API_ALLOWLIST);

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    prepareOnly: false,
    confirmNoRealCloud: false,
    allowBlockedEvidence: false,
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
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (FORBIDDEN_ARGS.has(arg)) throw new Error(`package_c_live_canary_readiness_forbidden_arg:${arg}`);
    if (arg === "--prepare-only") {
      options.prepareOnly = true;
    } else if (arg === "--confirm-no-real-cloud") {
      options.confirmNoRealCloud = true;
    } else if (arg === "--allow-blocked-evidence") {
      options.allowBlockedEvidence = true;
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
    } else {
      throw new Error(`package_c_live_canary_readiness_unknown_arg:${arg}`);
    }
  }
  return options;
}

export function parseEnv(content = "") {
  const env = new Map();
  for (const [lineIndex, line] of String(content).split(/\r?\n/u).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) throw new Error(`package_c_live_canary_readiness_secret_line_invalid:${lineIndex + 1}`);
    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!SECRET_ALLOWLIST_SET.has(key)) throw new Error(`package_c_live_canary_readiness_secret_key_not_allowed:${key}`);
    env.set(key, value);
  }
  return env;
}

export function value(env, key) {
  return String(env.get(key) || "").trim();
}

export function splitCsv(text = "") {
  return String(text)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireOption(options, key) {
  if (!String(options[key] || "").trim()) throw new Error(`package_c_live_canary_readiness_missing:${key}`);
}

export function validateOptions(options) {
  if (!options.prepareOnly || !options.confirmNoRealCloud) {
    throw new Error("package_c_live_canary_readiness_prepare_confirmation_required");
  }
  for (const key of [
    "secretFile",
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
  if (options.targetClusterId !== "cls-fi097sy4") {
    throw new Error("package_c_live_canary_readiness_cluster_must_be_cls_fi097sy4");
  }
  if (options.protectedPlatformNodePoolId !== "np-cbk784r8") {
    throw new Error("package_c_live_canary_readiness_platform_pool_must_be_np_cbk784r8");
  }
  if (options.tenantNodePoolPrefix !== "medopl-tenant-") {
    throw new Error("package_c_live_canary_readiness_tenant_prefix_must_be_medopl_tenant");
  }
}

export function validateEnv(env, options) {
  for (const key of PACKAGE_C_LIVE_CANARY_SECRET_ALLOWLIST) {
    if (!value(env, key)) throw new Error(`package_c_live_canary_readiness_secret_missing:${key}`);
  }
  if (value(env, "RUN_TENCENT_CREATE_RELEASE_EXECUTION") !== "0") {
    throw new Error("package_c_live_canary_readiness_run_gate_must_remain_zero");
  }
  if (value(env, "TENCENT_MUTATION_TKE_CLUSTER_ID") !== options.targetClusterId) {
    throw new Error("package_c_live_canary_readiness_cluster_mismatch");
  }
  if (value(env, "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID") !== options.protectedPlatformNodePoolId) {
    throw new Error("package_c_live_canary_readiness_platform_pool_mismatch");
  }
  const protectedNodePoolIds = splitCsv(value(env, "TENCENT_MUTATION_PROTECTED_NODE_POOL_IDS"));
  if (!protectedNodePoolIds.includes(options.protectedPlatformNodePoolId)) {
    throw new Error("package_c_live_canary_readiness_platform_pool_not_protected");
  }
  const regions = splitCsv(value(env, "TENCENT_MUTATION_REGIONS"));
  if (!regions.includes("na-siliconvalley")) {
    throw new Error("package_c_live_canary_readiness_region_must_include_na_siliconvalley");
  }
  const apis = splitCsv(value(env, "TENCENT_MUTATION_ALLOWED_APIS"));
  for (const api of apis) {
    if (!API_ALLOWLIST_SET.has(api)) throw new Error(`package_c_live_canary_readiness_api_not_allowed:${api}`);
  }
  for (const api of PACKAGE_C_LIVE_CANARY_API_ALLOWLIST) {
    if (!apis.includes(api)) throw new Error(`package_c_live_canary_readiness_api_missing:${api}`);
  }
  if (Number(value(env, "TENCENT_MUTATION_MAX_OPERATION_COUNT")) !== 1) {
    throw new Error("package_c_live_canary_readiness_max_operation_count_must_be_one");
  }
  if (Number(value(env, "TENCENT_MUTATION_DAILY_BUDGET_CNY")) > 50) {
    throw new Error("package_c_live_canary_readiness_daily_budget_too_high");
  }
  return { apis, protectedNodePoolIds };
}

function planAction(action, api, targetNodePoolId = "") {
  return {
    action,
    api,
    targetNodePoolId,
    executedNow: false,
  };
}

export function expectedCreateReleasePlan(options) {
  const tenantNodePoolRef = `${options.tenantNodePoolPrefix}${options.resourceBindingId}`;
  return [
    planAction("validate_run_gate_disabled", "local_validator"),
    planAction("validate_identity", "GetCallerIdentity"),
    planAction("observe_cluster", "DescribeClusters"),
    planAction("observe_node_pools", "DescribeNodePools"),
    planAction("protect_platform_pool", "local_validator"),
    planAction("create_tenant_node_pool_desired_zero", "CreateNodePool", tenantNodePoolRef),
    planAction("tag_tenant_resources", "TagResources", tenantNodePoolRef),
    planAction("scale_tenant_pool_to_one", "ScaleNodePool", tenantNodePoolRef),
    planAction("observe_tenant_pool", "DescribeNodePools", tenantNodePoolRef),
    planAction("scale_tenant_pool_to_zero", "ScaleNodePool", tenantNodePoolRef),
    planAction("delete_tenant_node_pool", "DeleteNodePool", tenantNodePoolRef),
    planAction("verify_cleanup", "DescribeNodePools", tenantNodePoolRef),
  ];
}

function reportFor(options, env, validation, cloudParameters = null) {
  const evidenceRoot = path.join(options.reportDir, options.operationId);
  const cloudParametersSource = cloudParameters
    ? {
        kind: "non_secret_json_file",
        path: options.cloudParamsFile,
        secretFile: false,
        mutationEnv: false,
      }
    : {
        kind: "not_provided",
        path: "",
        secretFile: false,
        mutationEnv: false,
      };
  return {
    ok: true,
    package: "C",
    mode: "live_canary_readiness",
    operationClass: "package_c.tencent_tke_tenant_node_pool.live_canary.create_scale_release",
    operationId: options.operationId,
    accountId: options.accountId,
    workspaceId: options.workspaceId,
    resourceBindingId: options.resourceBindingId,
    billingAttributionId: options.billingAttributionId,
    tenantId: options.tenantId,
    serverPlanId: options.serverPlanId,
    boundary: {
      realCloudCalls: false,
      mutationExecuted: false,
      readsMutationSecret: false,
      writesLedger: false,
      callsKubectl: false,
      deploysWorkload: false,
      buildsOrPushesImage: false,
      readsKubeconfig: false,
      runGateValue: value(env, "RUN_TENCENT_CREATE_RELEASE_EXECUTION"),
    },
    target: {
      cloudAccountId: value(env, "TENCENT_MUTATION_ACCOUNT_ID"),
      region: "na-siliconvalley",
      clusterId: options.targetClusterId,
      protectedPlatformNodePoolId: options.protectedPlatformNodePoolId,
      protectedNodePoolIds: validation.protectedNodePoolIds,
      tenantNodePoolPrefix: options.tenantNodePoolPrefix,
      sharedUserComputePoolAllowed: false,
    },
    secretAllowlist: PACKAGE_C_LIVE_CANARY_SECRET_ALLOWLIST,
    apiAllowlist: PACKAGE_C_LIVE_CANARY_API_ALLOWLIST,
    requiredMissingCloudParameters: cloudParameters ? [] : REQUIRED_CLOUD_PARAMETER_KEYS,
    cloudParametersSource,
    ...(cloudParameters ? { cloudParameters } : {}),
    expectedCreateReleasePlan: expectedCreateReleasePlan(options),
    evidenceSink: {
      root: evidenceRoot,
      files: [
        "preflight.json",
        "create-request-redacted.json",
        "create-result-redacted.json",
        "scale-up-result-redacted.json",
        "scale-down-result-redacted.json",
        "release-result-redacted.json",
        "summary.json",
      ],
      gitTracked: false,
      rawSecretsAllowed: false,
      rawProviderResponseAllowed: false,
    },
    rollback: {
      owner: "MedOPL Operations",
      executor: "MedOPL Platform / Package C runner",
      protectedPlatformNodePoolId: options.protectedPlatformNodePoolId,
      allowedOnlyForThisResourceBindingId: options.resourceBindingId,
      allowedActionsAfterExplicitLiveAuthorization: [
        "ScaleNodePool tenant node pool to 0",
        "DeleteNodePool tenant node pool",
        "write admin audit evidence if cleanup fails",
      ],
    },
    authorizationRequiredBeforeLiveMutation: true,
    currentRunGateMustRemainZero: true,
    forbiddenOperations: [
      "kubectl",
      "deploy",
      "build/push",
      "Package D",
      "delete or scale protected platform node pool",
      "shared user compute pool",
      "read kubeconfig",
    ],
  };
}

function authorizationPackFrom(report) {
  return {
    operationClass: report.operationClass,
    secretAllowlist: report.secretAllowlist,
    tencentApiAllowlist: report.apiAllowlist,
    targetResourceConstraints: report.target,
    evidenceSink: report.evidenceSink,
    rollbackOwner: report.rollback.owner,
    rollback: report.rollback,
    requiredMissingCloudParameters: report.requiredMissingCloudParameters,
    cloudParametersSource: report.cloudParametersSource,
    ...(report.cloudParameters ? { cloudParameters: report.cloudParameters } : {}),
    expectedCreateReleasePlan: report.expectedCreateReleasePlan,
    authorizationRequiredBeforeLiveMutation: true,
    currentRunGateMustRemainZero: true,
    forbiddenOperations: report.forbiddenOperations,
  };
}

async function writeBlockedEvidence(options, blockers) {
  const evidenceRoot = path.join(options.reportDir || path.join(".runtime", "v22-cloud-lifecycle"), options.operationId || "package-c-live-canary-readiness-blocked");
  await mkdir(evidenceRoot, { recursive: true });
  const reportPath = path.join(evidenceRoot, `${options.operationId || "package-c-live-canary-readiness-blocked"}-blocked-readiness.json`);
  const report = {
    ok: false,
    blocked: true,
    package: "C",
    mode: "live_canary_readiness",
    operationId: options.operationId || "",
    blockers,
    boundary: {
      realCloudCalls: false,
      mutationExecuted: false,
      readsMutationSecret: false,
      writesLedger: false,
      callsKubectl: false,
      deploysWorkload: false,
      buildsOrPushesImage: false,
      readsKubeconfig: false,
      runGateValue: "0",
    },
    evidenceSink: {
      root: evidenceRoot,
      gitTracked: false,
      rawSecretsAllowed: false,
      rawProviderResponseAllowed: false,
    },
    nextAction: "fix_package_c_mutation_env_allowlist_before_live_authorization",
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: false,
    blocked: true,
    package: "C",
    mode: "live_canary_readiness",
    operationId: options.operationId || "",
    reportPath,
    authorizationPackPath: "",
    realCloudCalls: false,
    mutationExecuted: false,
    callsKubectl: false,
    deploysWorkload: false,
    buildsOrPushesImage: false,
    readsKubeconfig: false,
  }, null, 2));
}

async function main() {
  const options = parseArgs();
  validateOptions(options);
  const env = parseEnv(await readFile(options.secretFile, "utf8"));
  const validation = validateEnv(env, options);
  const cloudParameters = options.cloudParamsFile
    ? validateCloudParameters(parseCloudParameters(await readFile(options.cloudParamsFile, "utf8")), options)
    : null;
  const report = reportFor(options, env, validation, cloudParameters);
  const pack = authorizationPackFrom(report);
  await mkdir(report.evidenceSink.root, { recursive: true });
  const reportPath = path.join(report.evidenceSink.root, `${options.operationId}-readiness.json`);
  const authorizationPackPath = path.join(report.evidenceSink.root, `${options.operationId}-authorization-pack.json`);
  if (cloudParameters) {
    const createRequestPath = path.join(report.evidenceSink.root, "create-request-redacted.json");
    await writeFile(createRequestPath, `${JSON.stringify(redactedCreateNodePoolRequest(cloudParameters, options), null, 2)}\n`);
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(authorizationPackPath, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    package: "C",
    mode: "live_canary_readiness",
    operationId: options.operationId,
    reportPath,
    authorizationPackPath,
    realCloudCalls: false,
    mutationExecuted: false,
    callsKubectl: false,
    deploysWorkload: false,
    buildsOrPushesImage: false,
    readsKubeconfig: false,
    runGateValue: value(env, "RUN_TENCENT_CREATE_RELEASE_EXECUTION"),
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = String(error?.message || "package_c_live_canary_readiness_failed");
    const options = (() => {
      try {
        return parseArgs();
      } catch {
        return {};
      }
    })();
    if (options.allowBlockedEvidence && options.prepareOnly && options.confirmNoRealCloud) {
      writeBlockedEvidence(options, [message]).catch((writeError) => {
        console.error(String(writeError?.message || message));
        process.exitCode = 1;
      });
    } else {
      console.error(message);
      process.exitCode = 1;
    }
  });
}
