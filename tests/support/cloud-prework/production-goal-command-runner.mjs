#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const OPERATION_CONFIG = Object.freeze({
  tenant_runtime_provisioning: {
    requiredEnv: ["V22_TENCENT_MUTATION_SECRET_FILE", "V22_TENCENT_RUNTIME_PLAN_FILE"],
    requiredPaths: ["V22_TENCENT_MUTATION_SECRET_FILE", "V22_TENCENT_RUNTIME_PLAN_FILE"],
  },
  storage_lifecycle: {
    requiredEnv: ["V22_TENCENT_MUTATION_SECRET_FILE", "V22_TENCENT_STORAGE_PLAN_FILE"],
    requiredPaths: ["V22_TENCENT_MUTATION_SECRET_FILE", "V22_TENCENT_STORAGE_PLAN_FILE"],
  },
  billing_audit_writeback: {
    requiredEnv: ["V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE", "DATABASE_URL"],
    requiredPaths: ["V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE"],
  },
  build_push: {
    requiredEnv: ["V22_CONTAINER_BUILD_CONTEXT", "V22_CONTAINER_IMAGE_REF", "TCR_ID", "TCR_SECRET"],
    requiredPaths: ["V22_CONTAINER_BUILD_CONTEXT"],
  },
  kubectl: {
    requiredEnv: ["TENCENT_DEPLOY_KUBECONFIG_REF", "V22_KUBERNETES_MANIFEST_DIR"],
    requiredPaths: ["V22_KUBERNETES_MANIFEST_DIR"],
  },
  deploy: {
    requiredEnv: ["TENCENT_DEPLOY_KUBECONFIG_REF", "V22_MEDOPL_DEPLOY_PLAN_FILE"],
    requiredPaths: ["V22_MEDOPL_DEPLOY_PLAN_FILE"],
  },
  live_test: {
    requiredEnv: ["V22_OPL_WEBUI_CONSUMER_CANARY_URL", "V22_MEDOPL_PUBLIC_BASE_URL"],
    requiredPaths: [],
  },
});

function parseArgs(argv = process.argv.slice(2)) {
  const options = { operation: "", execute: false, checkConfig: false, confirmAuthorization: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--operation") {
      options.operation = argv[++index] || "";
    } else if (item === "--execute") {
      options.execute = true;
    } else if (item === "--check-config") {
      options.checkConfig = true;
    } else if (item === "--confirm-current-session-authorization") {
      options.confirmAuthorization = true;
    } else if (item === "--help" || item === "-h") {
      options.help = true;
    } else {
      throw new Error(`production_goal_command_unknown_arg:${item}`);
    }
  }
  return options;
}

function usage() {
  return [
    "Usage:",
    "  node tests/support/cloud-prework/production-goal-command-runner.mjs --operation <operation> --check-config",
    "  node tests/support/cloud-prework/production-goal-command-runner.mjs --operation <operation> --execute --confirm-current-session-authorization",
  ].join("\n");
}

function secretValuesForRedaction() {
  return [
    "TENCENT_READONLY_SECRET_ID",
    "TENCENT_READONLY_SECRET_KEY",
    "TENCENT_MUTATION_SECRET_ID",
    "TENCENT_MUTATION_SECRET_KEY",
    "TENCENT_DEPLOY_KUBECONFIG_REF",
    "TCR_ID",
    "TCR_SECRET",
    "DATABASE_URL",
  ]
    .map((key) => String(process.env[key] || "").trim())
    .filter((value) => value.length >= 4);
}

function redactText(value = "") {
  let redacted = String(value || "")
    .replace(/SecretId/gu, "SecretRef")
    .replace(/SecretKey/gu, "SecretRef")
    .replace(/rawResponse/gu, "redacted_raw_response")
    .replace(/provider_response/gu, "provider_summary")
    .replace(/postgres(?:ql)?:\/\/[^\s"]+/giu, "DATABASE_URL_REF")
    .replace(/token/giu, "redacted_token_ref")
    .replace(/password/giu, "redacted_password_ref");
  for (const secret of secretValuesForRedaction()) {
    redacted = redacted.split(secret).join("redacted_secret_ref");
  }
  return redacted;
}

function redactValues(value) {
  if (Array.isArray(value)) return value.map((item) => redactValues(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redactValues(child)]));
  }
  if (typeof value !== "string") return value;
  return redactText(value);
}

function writeJson(payload, status = 0) {
  process.stdout.write(`${JSON.stringify(redactValues(payload), null, 2)}\n`);
  process.exit(status);
}

function fail(blocker, details = {}, status = 1) {
  process.stderr.write(`${blocker}\n`);
  writeJson({
    ok: false,
    summary: {
      blocker,
      ...details,
      productionComplete: false,
    },
  }, status);
}

function parseEnvFile(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equals = normalized.indexOf("=");
    if (equals <= 0) continue;
    const key = normalized.slice(0, equals).trim();
    let value = normalized.slice(equals + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function readJsonFile(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function operationConfig(operation) {
  const config = OPERATION_CONFIG[operation];
  if (!config) fail("production_goal_command_operation_unsupported", { operationClass: operation }, 64);
  return config;
}

function missingEnv(config) {
  return config.requiredEnv.filter((key) => !String(process.env[key] || "").trim());
}

function missingPaths(config) {
  return config.requiredPaths.filter((key) => {
    const value = String(process.env[key] || "").trim();
    return value && !existsSync(path.resolve(value));
  });
}

function directoryHasFile(dir, predicate = () => true) {
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) return false;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(dir, entry.name);
    if (entry.isFile() && predicate(entry.name)) return true;
    if (entry.isDirectory() && directoryHasFile(child, predicate)) return true;
  }
  return false;
}

function semanticConfigMissing(operation) {
  const missing = [];
  if (operation === "build_push" && !directoryHasFile(path.resolve(process.env.V22_CONTAINER_BUILD_CONTEXT || ""), (name) => name === "Dockerfile")) {
    missing.push("V22_CONTAINER_BUILD_CONTEXT:Dockerfile");
  }
  if (operation === "kubectl" && !directoryHasFile(path.resolve(process.env.V22_KUBERNETES_MANIFEST_DIR || ""), (name) => /\.(?:ya?ml|json)$/u.test(name))) {
    missing.push("V22_KUBERNETES_MANIFEST_DIR:manifest");
  }
  return missing;
}

function ensureConfig(operation) {
  const config = operationConfig(operation);
  const requiredEnvMissing = missingEnv(config);
  const requiredPathMissing = missingPaths(config);
  const requiredContentMissing = semanticConfigMissing(operation);
  if (requiredEnvMissing.length || requiredPathMissing.length || requiredContentMissing.length) {
    fail("production_goal_command_config_missing", {
      operationClass: operation,
      requiredEnvMissing,
      requiredPathMissing,
      requiredContentMissing,
    }, 65);
  }
  return config;
}

function safeWriteRuntimeEvidence(operation, payload) {
  const evidenceRef = String(process.env.V22_GOAL_EVIDENCE_REF || "").trim();
  if (!evidenceRef || !evidenceRef.startsWith(".runtime/") || evidenceRef.includes("..")) return "";
  const absolutePath = path.resolve(evidenceRef);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(redactValues({
    kind: "v22_production_goal_command_evidence",
    operationClass: operation,
    ...payload,
  }), null, 2)}\n`);
  return evidenceRef;
}

function executeShell(command, operation) {
  const result = spawnSync(command, {
    shell: true,
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
    env: process.env,
  });
  if (result.status !== 0) {
    fail("production_goal_command_shell_failed", {
      operationClass: operation,
      status: result.status ?? 1,
      stdoutSummary: redactText((result.stdout || "").slice(0, 3000)),
      stderrSummary: redactText((result.stderr || "").slice(0, 3000)),
    }, result.status ?? 1);
  }
  return {
    status: result.status ?? 0,
    stdoutSummary: redactText((result.stdout || "").slice(0, 3000)),
    stderrSummary: redactText((result.stderr || "").slice(0, 3000)),
  };
}

async function runRuntimeProvisioning(operation) {
  const env = parseEnvFile(process.env.V22_TENCENT_MUTATION_SECRET_FILE);
  const plan = readJsonFile(process.env.V22_TENCENT_RUNTIME_PLAN_FILE);
  const clusterId = env.TENCENT_MUTATION_TKE_CLUSTER_ID || "";
  const nodePoolId = env.TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID || "";
  const region = (env.TENCENT_MUTATION_REGIONS || env.TENCENT_MUTATION_COS_REGION || "").split(",")[0].trim();
  if (!clusterId || !nodePoolId || !region) fail("production_goal_runtime_foundation_missing", { operationClass: operation }, 65);
  let sdkSummary = { sdkChecked: false };
  if (process.env.V22_TENCENT_RUNTIME_USE_OFFICIAL_SDK === "1") {
    const sdkRoot = await import("tencentcloud-sdk-nodejs");
    const root = sdkRoot.default || sdkRoot;
    const Client = root?.tke?.v20180525?.Client;
    if (typeof Client !== "function") fail("production_goal_runtime_tke_sdk_missing", { operationClass: operation }, 65);
    const client = new Client({
      credential: { secretId: env.TENCENT_MUTATION_SECRET_ID, secretKey: env.TENCENT_MUTATION_SECRET_KEY },
      region,
      profile: { httpProfile: { reqTimeout: 30 } },
    });
    await client.DescribeClusters({ ClusterIds: [clusterId] });
    await client.DescribeClusterNodePools({ ClusterId: clusterId, NodePoolIds: [nodePoolId] });
    sdkSummary = { sdkChecked: true, clusterObserved: true, nodePoolObserved: true };
  }
  const evidenceRef = safeWriteRuntimeEvidence(operation, {
    status: "accepted",
    clusterRef: "TENCENT_MUTATION_TKE_CLUSTER_ID",
    nodePoolRef: "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID",
    region,
    planRef: process.env.V22_TENCENT_RUNTIME_PLAN_FILE,
    workspaceId: plan.workspace_id || plan.workspaceId || "",
    ...sdkSummary,
  });
  return { evidenceRef, ...sdkSummary };
}

async function runStorageLifecycle(operation) {
  const env = parseEnvFile(process.env.V22_TENCENT_MUTATION_SECRET_FILE);
  const plan = readJsonFile(process.env.V22_TENCENT_STORAGE_PLAN_FILE);
  const bucket = env.TENCENT_MUTATION_COS_BUCKET || "";
  const region = env.TENCENT_MUTATION_COS_REGION || "";
  const workspacePrefixRoot = env.TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT || "";
  if (!bucket || !region || !workspacePrefixRoot) fail("production_goal_storage_foundation_missing", { operationClass: operation }, 65);
  let cosSummary = { cosChecked: false };
  if (process.env.V22_TENCENT_STORAGE_USE_COS_SDK === "1") {
    const cosRoot = await import("cos-nodejs-sdk-v5");
    const Cos = cosRoot.default || cosRoot;
    const client = new Cos({ SecretId: env.TENCENT_MUTATION_SECRET_ID, SecretKey: env.TENCENT_MUTATION_SECRET_KEY });
    const workspaceId = String(plan.workspace_id || plan.workspaceId || "goal-af-workspace").replace(/[^A-Za-z0-9_.:-]/gu, "-");
    const key = `${workspacePrefixRoot.replace(/\/?$/u, "/")}${workspaceId}/.medopl-goal-af-probe.json`;
    await client.putObject({
      Bucket: bucket,
      Region: region,
      Key: key,
      Body: JSON.stringify({ ok: true, kind: "medopl_goal_af_storage_probe" }),
      ContentType: "application/json",
    });
    await client.headObject({ Bucket: bucket, Region: region, Key: key });
    if (process.env.V22_TENCENT_STORAGE_DELETE_PROBE === "1") {
      await client.deleteObject({ Bucket: bucket, Region: region, Key: key });
    }
    cosSummary = {
      cosChecked: true,
      probeWritten: true,
      probeDeleted: process.env.V22_TENCENT_STORAGE_DELETE_PROBE === "1",
      objectBodyRead: false,
      objectRef: "workspace_probe_ref",
    };
  }
  const evidenceRef = safeWriteRuntimeEvidence(operation, {
    status: "accepted",
    bucketRef: "TENCENT_MUTATION_COS_BUCKET",
    region,
    workspacePrefixRootRef: "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT",
    planRef: process.env.V22_TENCENT_STORAGE_PLAN_FILE,
    ...cosSummary,
  });
  return { evidenceRef, ...cosSummary };
}

async function runBillingAudit(operation) {
  const request = readJsonFile(process.env.V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE);
  let dbSummary = { databaseWriteback: false };
  if (process.env.V22_MEDOPL_BILLING_AUDIT_USE_POSTGRES === "1") {
    const pg = await import("pg");
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("CREATE TABLE IF NOT EXISTS medopl_goal_receipts (id TEXT PRIMARY KEY, operation_class TEXT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())");
      const id = `goal-af-${Date.now()}`;
      await client.query("INSERT INTO medopl_goal_receipts (id, operation_class, status) VALUES ($1, $2, $3)", [id, operation, "accepted"]);
      dbSummary = { databaseWriteback: true, receiptRowRef: "medopl_goal_receipts" };
    } finally {
      await client.end();
    }
  }
  const evidenceRef = safeWriteRuntimeEvidence(operation, {
    status: "accepted",
    receiptFileRef: process.env.V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE,
    eventCount: Array.isArray(request.events) ? request.events.length : 0,
    ...dbSummary,
  });
  return { evidenceRef, ...dbSummary };
}

async function runBuildPush(operation) {
  const command = process.env.V22_CONTAINER_BUILD_PUSH_SHELL
    || `docker buildx build --push -t ${JSON.stringify(process.env.V22_CONTAINER_IMAGE_REF)} ${JSON.stringify(process.env.V22_CONTAINER_BUILD_CONTEXT)}`;
  const shell = executeShell(command, operation);
  const evidenceRef = safeWriteRuntimeEvidence(operation, {
    status: "accepted",
    imageRef: process.env.V22_CONTAINER_IMAGE_REF,
    buildContextRef: process.env.V22_CONTAINER_BUILD_CONTEXT,
    shell,
  });
  return { evidenceRef, imageRef: process.env.V22_CONTAINER_IMAGE_REF, shellStatus: shell.status };
}

async function runKubectl(operation) {
  const command = process.env.V22_KUBERNETES_APPLY_SHELL
    || `kubectl --kubeconfig ${JSON.stringify(process.env.TENCENT_DEPLOY_KUBECONFIG_REF)} apply -f ${JSON.stringify(process.env.V22_KUBERNETES_MANIFEST_DIR)}`;
  const shell = executeShell(command, operation);
  const evidenceRef = safeWriteRuntimeEvidence(operation, {
    status: "accepted",
    manifestDirRef: process.env.V22_KUBERNETES_MANIFEST_DIR,
    kubeconfigRef: "TENCENT_DEPLOY_KUBECONFIG_REF",
    shell,
  });
  return { evidenceRef, manifestApplied: true, shellStatus: shell.status };
}

async function runDeploy(operation) {
  const plan = readJsonFile(process.env.V22_MEDOPL_DEPLOY_PLAN_FILE);
  const namespace = process.env.V22_MEDOPL_KUBERNETES_NAMESPACE || plan.namespace || "np-6l4nkdto-2cdtm";
  const command = process.env.V22_MEDOPL_DEPLOY_SHELL
    || `kubectl --kubeconfig ${JSON.stringify(process.env.TENCENT_DEPLOY_KUBECONFIG_REF)} -n ${JSON.stringify(namespace)} rollout status deploy --timeout=180s`;
  const shell = executeShell(command, operation);
  const evidenceRef = safeWriteRuntimeEvidence(operation, {
    status: "accepted",
    deployPlanRef: process.env.V22_MEDOPL_DEPLOY_PLAN_FILE,
    namespace,
    shell,
  });
  return { evidenceRef, namespace, rolloutObserved: true, shellStatus: shell.status };
}

async function runLiveTest(operation) {
  const urls = [process.env.V22_OPL_WEBUI_CONSUMER_CANARY_URL, process.env.V22_MEDOPL_PUBLIC_BASE_URL].filter(Boolean);
  const observed = [];
  for (const url of urls) {
    const response = await fetch(url, { redirect: "manual" });
    if (response.status >= 500) fail("production_goal_live_test_http_failed", { operationClass: operation, url, status: response.status }, 1);
    observed.push({ url, status: response.status });
  }
  const evidenceRef = safeWriteRuntimeEvidence(operation, {
    status: "accepted",
    observed,
  });
  return { evidenceRef, urls, observed };
}

async function runOperation(operation) {
  if (operation === "tenant_runtime_provisioning") return runRuntimeProvisioning(operation);
  if (operation === "storage_lifecycle") return runStorageLifecycle(operation);
  if (operation === "billing_audit_writeback") return runBillingAudit(operation);
  if (operation === "build_push") return runBuildPush(operation);
  if (operation === "kubectl") return runKubectl(operation);
  if (operation === "deploy") return runDeploy(operation);
  if (operation === "live_test") return runLiveTest(operation);
  fail("production_goal_command_operation_unsupported", { operationClass: operation }, 64);
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!options.operation) fail("production_goal_command_operation_required", {}, 64);
  const config = operationConfig(options.operation);
  const requiredEnvMissing = missingEnv(config);
  const requiredPathMissing = missingPaths(config);
  if (options.checkConfig) {
    const requiredContentMissing = semanticConfigMissing(options.operation);
    writeJson({
      ok: requiredEnvMissing.length === 0 && requiredPathMissing.length === 0 && requiredContentMissing.length === 0,
      summary: {
        operationClass: options.operation,
        executesCloudCommands: false,
        requiredEnvMissing,
        requiredPathMissing,
        requiredContentMissing,
        urls: [process.env.V22_OPL_WEBUI_CONSUMER_CANARY_URL, process.env.V22_MEDOPL_PUBLIC_BASE_URL].filter(Boolean),
        productionComplete: false,
      },
    }, requiredEnvMissing.length || requiredPathMissing.length || requiredContentMissing.length ? 1 : 0);
  }
  if (!options.execute) fail("production_goal_command_execute_required", { operationClass: options.operation }, 65);
  if (!options.confirmAuthorization) fail("production_goal_command_authorization_required", { operationClass: options.operation }, 65);
  ensureConfig(options.operation);
  const summary = await runOperation(options.operation);
  writeJson({
    ok: true,
    summary: {
      operationClass: options.operation,
      executesCloudCommands: true,
      ...summary,
      productionComplete: false,
    },
  });
}

main().catch((error) => {
  fail("production_goal_command_exception", { detail: String(error?.message || error) }, 1);
});
