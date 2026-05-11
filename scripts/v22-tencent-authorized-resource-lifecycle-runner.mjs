#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const reportRoot = path.join(repoRoot, ".runtime", "v22-cloud-lifecycle");
const portalRequire = createRequire(path.join(repoRoot, "services", "portal", "package.json"));

const PACKAGE_C_SECRET_KEYS = new Set([
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "TENCENT_MUTATION_ALLOWED_APIS",
  "TENCENT_MUTATION_REGIONS",
  "TENCENT_MUTATION_ACCOUNT_ID",
  "TENCENT_MUTATION_DAILY_BUDGET_CNY",
  "TENCENT_MUTATION_MAX_OPERATION_COUNT",
  "TENCENT_MUTATION_TKE_CLUSTER_ID",
  "TENCENT_MUTATION_TKE_NODE_POOL_ID",
  "TENCENT_MUTATION_COS_BUCKET",
  "TENCENT_MUTATION_COS_REGION",
  "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT",
]);

const FORBIDDEN_SECRET_KEYS = new Set([
  "RUN_TENCENT_READONLY_INVENTORY",
  "TENCENT_READONLY_SECRET_ID",
  "TENCENT_READONLY_SECRET_KEY",
  "TCR_ID",
  "TCR_SECRET",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
  "LANGFUSE_SECRET_KEY",
  "GITHUB_TOKEN",
  "DATABASE_URL",
  "SSH_PRIVATE_KEY",
  "kubeconfig",
]);

const ALLOWED_MUTATION_APIS = new Set([
  "DescribeClusters",
  "DescribeClusterNodePools",
  "DescribeClusterNodePoolDetail",
  "DescribeClusterInstances",
  "DescribeNodePools",
  "ModifyClusterNodePool",
  "ModifyNodePoolDesiredCapacityAboutAsg",
  "ModifyNodePool",
  "ScaleNodePool",
  "CreateClusterNodePool",
  "DeleteClusterNodePool",
  "Namespace",
  "ResourceQuota",
  "LimitRange",
  "NetworkPolicy",
  "getBucket",
  "headObject",
  "putObject",
  "deleteObject",
  "deleteMultipleObject",
]);

const OPERATION_SPECS = Object.freeze({
  "storage-create": Object.freeze({
    gateId: "R-06",
    artifactSuffix: "storage-dry-run",
    operationType: "create_storage",
    resourceKind: "storage",
    requiredApis: ["putObject"],
    portalRecords: ["cloud_operation", "file_space_entitlement", "wallet_ledger_freeze", "audit_event"],
  }),
  "compute-create": Object.freeze({
    gateId: "R-08",
    artifactSuffix: "compute-dry-run",
    operationType: "create_compute",
    resourceKind: "compute",
    requiredApis: ["DescribeNodePools", "ScaleNodePool"],
    portalRecords: ["cloud_operation", "compute_allocation", "wallet_ledger_freeze", "audit_event"],
  }),
  "storage-expand": Object.freeze({
    gateId: "R-11",
    artifactSuffix: "storage-expand",
    operationType: "expand_storage",
    resourceKind: "storage",
    requiredApis: ["putObject"],
    portalRecords: ["cloud_operation", "file_space_entitlement", "wallet_ledger_freeze", "audit_event"],
  }),
  "compute-expand": Object.freeze({
    gateId: "R-12",
    artifactSuffix: "compute-expand",
    operationType: "expand_compute",
    resourceKind: "compute",
    requiredApis: ["DescribeNodePools", "ScaleNodePool"],
    portalRecords: ["cloud_operation", "compute_allocation", "wallet_ledger_freeze", "audit_event"],
  }),
  "compute-release": Object.freeze({
    gateId: "R-19",
    artifactSuffix: "compute-release",
    operationType: "release_compute",
    resourceKind: "compute",
    requiredApis: ["DescribeNodePools", "ScaleNodePool"],
    portalRecords: ["cloud_operation", "compute_allocation", "billing_reconciliation", "audit_event"],
  }),
  "storage-delete": Object.freeze({
    gateId: "R-20",
    artifactSuffix: "storage-delete",
    operationType: "delete_storage",
    resourceKind: "storage",
    requiredApis: ["deleteObject"],
    portalRecords: ["cloud_operation", "file_space_entitlement", "billing_reconciliation", "audit_event"],
  }),
});

function text(value = "") {
  return String(value ?? "").trim();
}

function parseLine(line = "") {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
  const equalsIndex = normalized.indexOf("=");
  if (equalsIndex <= 0) {
    throw new Error("tencent_resource_lifecycle_secret_line_invalid");
  }
  const key = normalized.slice(0, equalsIndex).trim();
  let value = normalized.slice(equalsIndex + 1).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

function listFromCsv(value = "") {
  return text(value)
    .split(",")
    .map((item) => text(item))
    .filter(Boolean);
}

function maskIdentifier(value = "") {
  const normalized = text(value);
  if (!normalized) return "missing";
  if (normalized.length <= 4) return "****";
  return `${normalized.slice(0, Math.max(0, normalized.length - 4))}****${normalized.slice(-4)}`;
}

export function parseTencentMutationSecretFile(content = "") {
  const env = {};
  for (const line of String(content).split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (FORBIDDEN_SECRET_KEYS.has(key)) {
      throw new Error(`tencent_resource_lifecycle_forbidden_secret_key:${key}`);
    }
    if (!PACKAGE_C_SECRET_KEYS.has(key)) {
      throw new Error(`tencent_resource_lifecycle_non_allowlist_secret_key_rejected:${key}`);
    }
    env[key] = value;
  }
  return env;
}

function validateMutationApis(apis = []) {
  if (!apis.length) {
    throw new Error("tencent_resource_lifecycle_api_allowlist_required");
  }
  for (const api of apis) {
    if (!ALLOWED_MUTATION_APIS.has(api)) {
      throw new Error(`tencent_resource_lifecycle_forbidden_api:${api}`);
    }
  }
  return apis;
}

function validateSecretEnv(env = {}) {
  const allowedApis = validateMutationApis(listFromCsv(env.TENCENT_MUTATION_ALLOWED_APIS));
  const regions = listFromCsv(env.TENCENT_MUTATION_REGIONS);
  const cosRegion = text(env.TENCENT_MUTATION_COS_REGION);
  const runGateEnabled = text(env.RUN_TENCENT_CREATE_RELEASE_EXECUTION) === "1"
    || text(env.RUN_TENCENT_CREATE_RELEASE_EXECUTION).toLowerCase() === "true";
  const missingKeys = [...PACKAGE_C_SECRET_KEYS].filter((key) => !text(env[key]));
  if (!regions.length) {
    throw new Error("tencent_resource_lifecycle_region_allowlist_required");
  }
  if (cosRegion && !regions.includes(cosRegion)) {
    throw new Error("tencent_resource_lifecycle_cos_region_not_allowlisted");
  }
  return {
    runGateEnabled,
    allowedApis,
    regions,
    missingKeys,
    accountMasked: maskIdentifier(env.TENCENT_MUTATION_ACCOUNT_ID),
    budgetCny: Number(env.TENCENT_MUTATION_DAILY_BUDGET_CNY || 0),
    maxOperationCount: Number(env.TENCENT_MUTATION_MAX_OPERATION_COUNT || 0),
    tkeClusterMasked: maskIdentifier(env.TENCENT_MUTATION_TKE_CLUSTER_ID),
    tkeNodePoolMasked: maskIdentifier(env.TENCENT_MUTATION_TKE_NODE_POOL_ID),
    cosBucketMasked: maskIdentifier(env.TENCENT_MUTATION_COS_BUCKET),
    cosRegion,
    workspacePrefixRootMasked: maskIdentifier(env.TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT),
  };
}

function parseArgs(argv = []) {
  const options = {
    mode: "",
    secretFile: "",
    operation: "",
    runId: "",
    acceptedDryRunId: "",
    sdkMode: "",
    workspaceId: "",
    targetDesiredCapacity: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check-config" || arg === "--dry-run" || arg === "--execute") {
      options.mode = arg.slice(2);
      continue;
    }
    if (arg === "--secret-file") {
      options.secretFile = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--operation") {
      options.operation = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--run-id") {
      options.runId = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--accepted-dry-run-id") {
      options.acceptedDryRunId = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--sdk-mode") {
      options.sdkMode = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--workspace-id") {
      options.workspaceId = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--target-desired-capacity") {
      options.targetDesiredCapacity = text(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`tencent_resource_lifecycle_runner_unknown_arg:${arg}`);
  }
  if (!options.mode) throw new Error("tencent_resource_lifecycle_runner_mode_required");
  if (!options.secretFile) throw new Error("tencent_resource_lifecycle_runner_secret_file_required");
  if (!options.operation || !OPERATION_SPECS[options.operation]) {
    throw new Error(`tencent_resource_lifecycle_runner_operation_invalid:${options.operation || "(missing)"}`);
  }
  return options;
}

function operationIdFor(runId = "", operation = "") {
  const safeRunId = text(runId || new Date().toISOString().replace(/[:.]/g, "-")).replace(/[^a-zA-Z0-9_.-]/g, "-");
  return `${safeRunId}-${operation}`;
}

function artifactRelativePath(operationId = "", artifactSuffix = "") {
  return `.runtime/v22-cloud-lifecycle/${operationId}-${artifactSuffix}.json`;
}

function executionArtifactRelativePath(operationId = "", resourceKind = "") {
  return `.runtime/v22-cloud-lifecycle/${operationId}-${resourceKind}-execution.json`;
}

function assertOperationAllowed(envSummary = {}, spec = {}) {
  const allowed = new Set(envSummary.allowedApis || []);
  const missingApis = (spec.requiredApis || []).filter((api) => !allowed.has(api));
  if (missingApis.length > 0) {
    throw new Error(`tencent_resource_lifecycle_required_api_not_allowlisted:${missingApis.join(",")}`);
  }
  if (!Number.isFinite(envSummary.budgetCny) || envSummary.budgetCny <= 0) {
    throw new Error("tencent_resource_lifecycle_budget_required");
  }
  if (!Number.isInteger(envSummary.maxOperationCount) || envSummary.maxOperationCount <= 0) {
    throw new Error("tencent_resource_lifecycle_operation_count_required");
  }
}

function safeWorkspaceId(value = "") {
  const normalized = text(value);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,80}$/.test(normalized)) {
    throw new Error("tencent_resource_lifecycle_workspace_id_invalid");
  }
  return normalized;
}

function desiredCapacityFrom(value = "") {
  const normalized = text(value);
  if (!/^[0-9]+$/.test(normalized)) {
    throw new Error("tencent_resource_lifecycle_target_desired_capacity_required");
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("tencent_resource_lifecycle_target_desired_capacity_invalid");
  }
  return parsed;
}

function objectKeyFor(env = {}, workspaceId = "", operation = "") {
  const root = text(env.TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT).replace(/^\/+|\/+$/g, "");
  const workspace = safeWorkspaceId(workspaceId);
  const marker = operation === "storage-expand" ? ".medopl-file-space-expansion" : ".medopl-file-space";
  return [root, workspace, marker].filter(Boolean).join("/");
}

function storageObjectKeysForOperation(env = {}, workspaceId = "", operation = "") {
  if (operation !== "storage-delete") return [objectKeyFor(env, workspaceId, operation)];
  return [
    objectKeyFor(env, workspaceId, "storage-create"),
    objectKeyFor(env, workspaceId, "storage-expand"),
  ];
}

function summaryFor({ mode, operation, envSummary, blockedReason = null, ok = true, artifactPath = "", operationId = "" } = {}) {
  const spec = OPERATION_SPECS[operation];
  const resolvedOperationId = operationId || operationIdFor(mode === "dry-run" ? currentRunId : "", operation);
  return {
    ok,
    mode,
    operationId: resolvedOperationId,
    gateId: spec.gateId,
    operationType: spec.operationType,
    resourceKind: spec.resourceKind,
    dryRun: mode !== "execute",
    artifactPath,
    portalRecords: [...spec.portalRecords],
    risk: {
      accountMasked: envSummary?.accountMasked || "missing",
      regions: envSummary?.regions || [],
      requiredApis: [...spec.requiredApis],
      budgetCny: envSummary?.budgetCny || 0,
      maxOperationCount: envSummary?.maxOperationCount || 0,
      tkeClusterMasked: envSummary?.tkeClusterMasked || "missing",
      tkeNodePoolMasked: envSummary?.tkeNodePoolMasked || "missing",
      cosBucketMasked: envSummary?.cosBucketMasked || "missing",
      cosRegion: envSummary?.cosRegion || "",
      workspacePrefixRootMasked: envSummary?.workspacePrefixRootMasked || "missing",
      callsRealCloudNow: false,
      executesMutationNow: false,
    },
    blockedReason,
  };
}

function executionSummaryFor({ operation, envSummary, operationId, artifactPath, providerMode, acceptedDryRun, result = {}, ok = true, blockedReason = null } = {}) {
  const summary = summaryFor({
    mode: "execute",
    operation,
    envSummary,
    operationId,
    artifactPath,
    ok,
    blockedReason,
  });
  summary.risk.callsRealCloudNow = providerMode === "tencent-official-sdk-live";
  summary.risk.executesMutationNow = ok;
  summary.execution = {
    providerMode,
    acceptedDryRunVerified: Boolean(acceptedDryRun?.ok && acceptedDryRun?.dryRun === true),
    mutationApi: result.mutationApi || "",
    target: result.target || "",
    providerRequestIdPresent: Boolean(result.providerRequestIdPresent),
    targetDesiredCapacity: Number.isFinite(result.targetDesiredCapacity) ? result.targetDesiredCapacity : null,
    reconciliation: result.reconciliation || null,
    portalWritebackRequired: true,
    auditEventRequired: true,
  };
  return summary;
}

let currentRunId = "";

async function writeReport(summary, reportPath) {
  const absolutePath = path.join(repoRoot, reportPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return reportPath;
}

async function readAcceptedDryRunReport(acceptedDryRunId = "", spec = {}) {
  const dryRunId = text(acceptedDryRunId);
  if (!dryRunId) {
    throw new Error("execute_requires_accepted_dry_run_id");
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(dryRunId)) {
    throw new Error("tencent_resource_lifecycle_accepted_dry_run_id_invalid");
  }
  const reportPath = artifactRelativePath(dryRunId, spec.artifactSuffix);
  const report = JSON.parse(await readFile(path.join(repoRoot, reportPath), "utf8"));
  if (report.ok !== true || report.dryRun !== true || report.gateId !== spec.gateId || report.operationType !== spec.operationType) {
    throw new Error("tencent_resource_lifecycle_accepted_dry_run_report_mismatch");
  }
  return { report, reportPath, operationId: dryRunId };
}

function assertExecuteOptions(options = {}, operation = "") {
  if (!["fake-live", "tencent-official-sdk-live"].includes(options.sdkMode)) {
    throw new Error("tencent_resource_lifecycle_sdk_mode_required");
  }
  safeWorkspaceId(options.workspaceId);
  if (operation.startsWith("compute-")) {
    desiredCapacityFrom(options.targetDesiredCapacity);
  }
}

function providerRequestIdPresent(response = {}) {
  return Boolean(text(response.RequestId || response.requestId || response.headers?.["x-cos-request-id"] || response.headers?.["x-cos-requestid"]));
}

function sleep(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeFakeLive({ operation }) {
  const spec = OPERATION_SPECS[operation];
  return {
    mutationApi: spec.requiredApis[0],
    target: operation === "storage-delete" ? "storage_markers" : spec.resourceKind,
    providerRequestIdPresent: true,
  };
}

function nativeReplicaSummary(nodePool = {}) {
  const native = nodePool.Native || {};
  return {
    replicas: Number(native.Replicas ?? 0),
    readyReplicas: Number(native.ReadyReplicas ?? 0),
    joiningReplicas: Number(native.JoiningReplicas ?? 0),
    minReplicas: Number(native.Scaling?.MinReplicas ?? 0),
    maxReplicas: Number(native.Scaling?.MaxReplicas ?? 0),
  };
}

async function describeAuthorizedNodePool(client, env = {}) {
  const nodePoolsResponse = await client.DescribeNodePools({
    ClusterId: text(env.TENCENT_MUTATION_TKE_CLUSTER_ID),
    Filters: [{
      Name: "NodePoolsId",
      Values: [text(env.TENCENT_MUTATION_TKE_NODE_POOL_ID)],
    }],
    Offset: 0,
    Limit: 100,
  });
  const nodePools = Array.isArray(nodePoolsResponse.NodePools) ? nodePoolsResponse.NodePools : [];
  const nodePool = nodePools.find((item) => text(item.NodePoolId) === text(env.TENCENT_MUTATION_TKE_NODE_POOL_ID));
  if (!nodePool) {
    throw new Error("tencent_resource_lifecycle_tke_node_pool_not_found");
  }
  if (text(nodePool.Type) && text(nodePool.Type) !== "Native") {
    throw new Error(`tencent_resource_lifecycle_tke_node_pool_type_unsupported:${text(nodePool.Type)}`);
  }
  return nodePool;
}

async function waitForNativeNodePoolReplicas(client, env = {}, targetReplicas = 0) {
  let latest = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const nodePool = await describeAuthorizedNodePool(client, env);
    latest = nativeReplicaSummary(nodePool);
    const reachedTarget = latest.replicas === targetReplicas
      && latest.joiningReplicas === 0
      && latest.readyReplicas === targetReplicas;
    if (reachedTarget) {
      return { reachedTarget: true, targetReplicas, attempts: attempt + 1, observed: latest };
    }
    await sleep(10_000);
  }
  const error = new Error("tencent_resource_lifecycle_tke_node_pool_replicas_not_reconciled");
  error.observedReplicas = latest;
  error.targetReplicas = targetReplicas;
  throw error;
}

async function executeCosMutation({ env, operation, workspaceId }) {
  const COS = portalRequire("cos-nodejs-sdk-v5");
  const cos = new COS({
    SecretId: text(env.TENCENT_MUTATION_SECRET_ID),
    SecretKey: text(env.TENCENT_MUTATION_SECRET_KEY),
  });
  const baseParams = {
    Bucket: text(env.TENCENT_MUTATION_COS_BUCKET),
    Region: text(env.TENCENT_MUTATION_COS_REGION),
  };
  if (operation === "storage-delete") {
    const responses = [];
    for (const key of storageObjectKeysForOperation(env, workspaceId, operation)) {
      responses.push(await cos.deleteObject({
        ...baseParams,
        Key: key,
      }));
    }
    return {
      mutationApi: "deleteObject",
      target: "storage_markers",
      providerRequestIdPresent: responses.every(providerRequestIdPresent),
    };
  }
  const response = await cos.putObject({
    ...baseParams,
    Key: objectKeyFor(env, workspaceId, operation),
    Body: "",
    ContentLength: 0,
  });
  return {
    mutationApi: "putObject",
    target: "storage_marker",
    providerRequestIdPresent: providerRequestIdPresent(response),
  };
}

async function executeTkeMutation({ env, operation, options }) {
  const tencentcloud = portalRequire("tencentcloud-sdk-nodejs");
  const TkeClient = tencentcloud?.tke?.v20220501?.Client;
  if (typeof TkeClient !== "function") {
    throw new Error("tencent_resource_lifecycle_tke_client_required");
  }
  const client = new TkeClient({
    credential: {
      secretId: text(env.TENCENT_MUTATION_SECRET_ID),
      secretKey: text(env.TENCENT_MUTATION_SECRET_KEY),
    },
    region: text(env.TENCENT_MUTATION_REGIONS).split(",").map((item) => text(item)).filter(Boolean)[0],
    profile: {
      httpProfile: {
        endpoint: "tke.tencentcloudapi.com",
      },
    },
  });
  await describeAuthorizedNodePool(client, env);
  const targetReplicas = desiredCapacityFrom(options.targetDesiredCapacity);
  const response = await client.ScaleNodePool({
    ClusterId: text(env.TENCENT_MUTATION_TKE_CLUSTER_ID),
    NodePoolId: text(env.TENCENT_MUTATION_TKE_NODE_POOL_ID),
    Replicas: targetReplicas,
  });
  const reconciliation = await waitForNativeNodePoolReplicas(client, env, targetReplicas);
  return {
    mutationApi: operation === "compute-create" ? "ScaleNodePool" : "ScaleNodePool",
    target: "tke_native_node_pool_replicas",
    providerRequestIdPresent: providerRequestIdPresent(response),
    targetDesiredCapacity: targetReplicas,
    reconciliation,
  };
}

function safeMutationError(error = {}) {
  const raw = text(error.code || error.Code || error.name || error.message || "mutation_failed").toLowerCase();
  if (raw.includes("auth") || raw.includes("signature") || raw.includes("permission") || raw.includes("denied")) {
    return "permission_or_auth_failed";
  }
  if (raw.includes("notfound") || raw.includes("not_found")) return "resource_not_found";
  if (raw.includes("limit") || raw.includes("quota") || raw.includes("rate")) return "limit_or_quota_failed";
  if (raw.includes("region")) return "region_failed";
  if (raw.includes("network") || raw.includes("timeout")) return "network_failed";
  return "provider_mutation_failed";
}

async function executeMutation({ env, operation, options }) {
  if (options.sdkMode === "fake-live") {
    return executeFakeLive({ operation });
  }
  if (operation.startsWith("storage-")) {
    return executeCosMutation({ env, operation, workspaceId: options.workspaceId });
  }
  if (operation.startsWith("compute-")) {
    return executeTkeMutation({ env, operation, options });
  }
  throw new Error("tencent_resource_lifecycle_operation_not_implemented");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  currentRunId = text(options.runId || "package-c");
  const secretText = await readFile(options.secretFile, "utf8");
  const env = parseTencentMutationSecretFile(secretText);
  const envSummary = validateSecretEnv(env);
  const spec = OPERATION_SPECS[options.operation];
  const operationId = operationIdFor(currentRunId, options.operation);
  const reportPath = artifactRelativePath(operationId, spec.artifactSuffix);

  if (envSummary.missingKeys.length > 0) {
    const summary = summaryFor({
      mode: options.mode,
      operation: options.operation,
      envSummary,
      ok: false,
      blockedReason: "mutation_secret_allowlist_incomplete",
    });
    console.log(JSON.stringify({ ok: false, reportPath: null, summary }, null, 2));
    process.exitCode = 1;
    return;
  }
  assertOperationAllowed(envSummary, spec);

  if (options.mode === "check-config") {
    const summary = summaryFor({
      mode: "check-config",
      operation: options.operation,
      envSummary,
      blockedReason: envSummary.runGateEnabled ? null : "mutation_run_gate_disabled",
      ok: envSummary.runGateEnabled,
    });
    console.log(JSON.stringify({ ok: summary.ok, reportPath: null, summary }, null, 2));
    if (!summary.ok) process.exitCode = 1;
    return;
  }

  if (options.mode === "dry-run") {
    const summary = summaryFor({
      mode: "dry-run",
      operation: options.operation,
      envSummary,
      artifactPath: reportPath,
      blockedReason: envSummary.runGateEnabled ? null : "mutation_run_gate_disabled",
      ok: envSummary.runGateEnabled,
    });
    if (!summary.ok) {
      console.log(JSON.stringify({ ok: false, reportPath: null, summary }, null, 2));
      process.exitCode = 1;
      return;
    }
    await writeReport(summary, reportPath);
    console.log(JSON.stringify({ ok: true, reportPath, summary }, null, 2));
    return;
  }

  if (options.mode === "execute") {
    if (!envSummary.runGateEnabled) {
      const summary = summaryFor({
        mode: "execute",
        operation: options.operation,
        envSummary,
        ok: false,
        blockedReason: "mutation_run_gate_disabled",
      });
      console.log(JSON.stringify({ ok: false, reportPath: null, summary }, null, 2));
      process.exitCode = 1;
      return;
    }
    let accepted;
    try {
      accepted = await readAcceptedDryRunReport(options.acceptedDryRunId, spec);
      assertExecuteOptions(options, options.operation);
    } catch (error) {
      const summary = summaryFor({
        mode: "execute",
        operation: options.operation,
        envSummary,
        ok: false,
        blockedReason: text(error?.message || error),
      });
      console.log(JSON.stringify({ ok: false, reportPath: null, summary }, null, 2));
      process.exitCode = 1;
      return;
    }
    const executionReportPath = executionArtifactRelativePath(accepted.operationId, spec.resourceKind);
    try {
      const result = await executeMutation({ env, operation: options.operation, options });
      const summary = executionSummaryFor({
        operation: options.operation,
        envSummary,
        operationId: accepted.operationId,
        artifactPath: executionReportPath,
        providerMode: options.sdkMode,
        acceptedDryRun: accepted.report,
        result,
      });
      await writeReport(summary, executionReportPath);
      console.log(JSON.stringify({ ok: true, reportPath: executionReportPath, summary }, null, 2));
    } catch (error) {
      const summary = executionSummaryFor({
        operation: options.operation,
        envSummary,
        operationId: accepted.operationId,
        artifactPath: "",
        providerMode: options.sdkMode,
        acceptedDryRun: accepted.report,
        ok: false,
        blockedReason: safeMutationError(error),
      });
      console.log(JSON.stringify({ ok: false, reportPath: null, summary }, null, 2));
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: text(error?.message || error),
    }, null, 2));
    process.exitCode = 1;
  });
}
