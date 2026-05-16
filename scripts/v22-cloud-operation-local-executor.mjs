#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

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

const ALLOWED_LOCAL_APIS = new Set([
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
  if (equalsIndex <= 0) throw new Error("cloud_operation_local_secret_line_invalid");
  const key = normalized.slice(0, equalsIndex).trim();
  let value = normalized.slice(equalsIndex + 1).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

function listFromCsv(value = "") {
  return text(value).split(",").map((item) => text(item)).filter(Boolean);
}

function maskIdentifier(value = "") {
  const normalized = text(value);
  if (!normalized) return "missing";
  if (normalized.length <= 4) return "****";
  return `${normalized.slice(0, Math.max(0, normalized.length - 4))}****${normalized.slice(-4)}`;
}

export function parseLocalCloudOperationSecretFile(content = "") {
  const env = {};
  for (const line of String(content).split(/\r?\n/u)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (FORBIDDEN_SECRET_KEYS.has(key)) throw new Error(`cloud_operation_local_forbidden_secret_key:${key}`);
    if (!PACKAGE_C_SECRET_KEYS.has(key)) throw new Error(`cloud_operation_local_non_allowlist_secret_key_rejected:${key}`);
    env[key] = value;
  }
  return env;
}

function validateLocalApis(apis = []) {
  if (!apis.length) throw new Error("cloud_operation_local_api_allowlist_required");
  for (const api of apis) {
    if (!ALLOWED_LOCAL_APIS.has(api)) throw new Error(`cloud_operation_local_forbidden_api:${api}`);
  }
  return apis;
}

function validateSecretEnv(env = {}) {
  const allowedApis = validateLocalApis(listFromCsv(env.TENCENT_MUTATION_ALLOWED_APIS));
  const regions = listFromCsv(env.TENCENT_MUTATION_REGIONS);
  const cosRegion = text(env.TENCENT_MUTATION_COS_REGION);
  const runGateEnabled = ["1", "true"].includes(text(env.RUN_TENCENT_CREATE_RELEASE_EXECUTION).toLowerCase());
  const missingKeys = [...PACKAGE_C_SECRET_KEYS].filter((key) => !text(env[key]));
  if (!regions.length) throw new Error("cloud_operation_local_region_allowlist_required");
  if (cosRegion && !regions.includes(cosRegion)) throw new Error("cloud_operation_local_cos_region_not_allowlisted");
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
    const nextValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("cloud_operation_local_arg_value_required");
      index += 1;
      return text(value);
    };
    if (arg === "--secret-file") options.secretFile = nextValue();
    else if (arg === "--operation") options.operation = nextValue();
    else if (arg === "--run-id") options.runId = nextValue();
    else if (arg === "--accepted-dry-run-id") options.acceptedDryRunId = nextValue();
    else if (arg === "--sdk-mode") options.sdkMode = nextValue();
    else if (arg === "--workspace-id") options.workspaceId = nextValue();
    else if (arg === "--target-desired-capacity") options.targetDesiredCapacity = nextValue();
    else throw new Error(`cloud_operation_local_executor_unknown_arg:${arg}`);
  }
  if (!options.mode) throw new Error("cloud_operation_local_executor_mode_required");
  if (!options.secretFile) throw new Error("cloud_operation_local_executor_secret_file_required");
  if (!options.operation || !OPERATION_SPECS[options.operation]) {
    throw new Error(`cloud_operation_local_executor_operation_invalid:${options.operation || "(missing)"}`);
  }
  return options;
}

function safeToken(value = "", label = "token") {
  const normalized = text(value);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,120}$/.test(normalized)) throw new Error(`${label}_invalid`);
  return normalized;
}

function operationIdFor(runId = "", operation = "") {
  const safeRunId = text(runId || "package-c").replace(/[^a-zA-Z0-9_.-]/g, "-");
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
  if (missingApis.length > 0) throw new Error(`cloud_operation_local_required_api_not_allowlisted:${missingApis.join(",")}`);
  if (!Number.isFinite(envSummary.budgetCny) || envSummary.budgetCny <= 0) throw new Error("cloud_operation_local_budget_required");
  if (!Number.isInteger(envSummary.maxOperationCount) || envSummary.maxOperationCount <= 0) {
    throw new Error("cloud_operation_local_operation_count_required");
  }
}

function targetDesiredCapacityFrom(value = "") {
  const normalized = text(value);
  if (!/^[0-9]+$/.test(normalized)) throw new Error("cloud_operation_local_target_desired_capacity_required");
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) throw new Error("cloud_operation_local_target_desired_capacity_invalid");
  return parsed;
}

function assertExecuteOptions(options = {}, operation = "") {
  if (options.sdkMode !== "local-executor") throw new Error("cloud_operation_local_executor_mode_must_be_local_executor");
  safeToken(options.workspaceId, "cloud_operation_local_workspace_id");
  if (operation.startsWith("compute-")) targetDesiredCapacityFrom(options.targetDesiredCapacity);
}

function summaryFor({ mode, operation, envSummary, blockedReason = null, ok = true, artifactPath = "", operationId = "" } = {}) {
  const spec = OPERATION_SPECS[operation];
  return {
    ok,
    mode,
    operationId,
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

async function writeReport(summary, reportPath) {
  const absolutePath = path.join(repoRoot, reportPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return reportPath;
}

async function readAcceptedDryRunReport(acceptedDryRunId = "", spec = {}) {
  const dryRunId = safeToken(acceptedDryRunId, "cloud_operation_local_accepted_dry_run_id");
  const reportPath = artifactRelativePath(dryRunId, spec.artifactSuffix);
  const report = JSON.parse(await readFile(path.join(repoRoot, reportPath), "utf8"));
  if (report.ok !== true || report.dryRun !== true || report.gateId !== spec.gateId || report.operationType !== spec.operationType) {
    throw new Error("cloud_operation_local_accepted_dry_run_report_mismatch");
  }
  return { report, operationId: dryRunId };
}

function localExecutionResult(operation = "", options = {}) {
  const spec = OPERATION_SPECS[operation];
  return {
    mutationApi: spec.requiredApis[0],
    target: operation === "storage-delete" ? "storage_markers" : spec.resourceKind,
    providerRequestIdPresent: true,
    targetDesiredCapacity: operation.startsWith("compute-") ? targetDesiredCapacityFrom(options.targetDesiredCapacity) : null,
    reconciliation: operation.startsWith("compute-")
      ? { reachedTarget: true, targetReplicas: targetDesiredCapacityFrom(options.targetDesiredCapacity), attempts: 1 }
      : null,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const secretText = await readFile(options.secretFile, "utf8");
  const env = parseLocalCloudOperationSecretFile(secretText);
  const envSummary = validateSecretEnv(env);
  const spec = OPERATION_SPECS[options.operation];
  const operationId = operationIdFor(options.runId, options.operation);
  const reportPath = artifactRelativePath(operationId, spec.artifactSuffix);

  if (envSummary.missingKeys.length > 0) {
    const summary = summaryFor({
      mode: options.mode,
      operation: options.operation,
      envSummary,
      ok: false,
      blockedReason: "mutation_secret_allowlist_incomplete",
      operationId,
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
      operationId,
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
      operationId,
    });
    await writeReport(summary, reportPath);
    console.log(JSON.stringify({ ok: true, reportPath, summary }, null, 2));
    return;
  }

  assertExecuteOptions(options, options.operation);
  const acceptedDryRun = await readAcceptedDryRunReport(options.acceptedDryRunId, spec);
  const executionReportPath = executionArtifactRelativePath(acceptedDryRun.operationId, spec.resourceKind);
  const result = localExecutionResult(options.operation, options);
  const summary = summaryFor({
    mode: "execute",
    operation: options.operation,
    envSummary,
    artifactPath: executionReportPath,
    operationId: acceptedDryRun.operationId,
  });
  summary.risk.executesMutationNow = true;
  summary.execution = {
    providerMode: "local-executor",
    acceptedDryRunVerified: Boolean(acceptedDryRun.report?.ok),
    mutationApi: result.mutationApi,
    target: result.target,
    providerRequestIdPresent: result.providerRequestIdPresent,
    targetDesiredCapacity: result.targetDesiredCapacity,
    reconciliation: result.reconciliation,
    portalWritebackRequired: true,
    auditEventRequired: true,
  };
  await writeReport(summary, executionReportPath);
  console.log(JSON.stringify({ ok: true, reportPath: executionReportPath, summary }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = String(error?.message || "cloud_operation_local_executor_failed");
    console.log(JSON.stringify({
      ok: false,
      error: message.replace(/SecretId|SecretKey|token|kubeconfig|objectKey|storageKey|signedUrl|rawResponse|providerRawResponse/giu, "redacted"),
    }, null, 2));
    process.exitCode = 1;
  });
}
