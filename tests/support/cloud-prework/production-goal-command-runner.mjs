#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
    requiredEnv: ["V22_CONTAINER_BUILD_CONTEXT", "V22_CONTAINER_DOCKERFILE", "V22_CONTAINER_IMAGE_REF", "TCR_ID", "TCR_SECRET"],
    requiredPaths: ["V22_CONTAINER_BUILD_CONTEXT", "V22_CONTAINER_DOCKERFILE"],
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
    requiredEnv: ["V22_OPL_WEBUI_CONSUMER_CANARY_URL", "V22_MEDOPL_PUBLIC_BASE_URL", "MEDOPL_SESSION_SIGNING_SECRET_SHA256"],
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
    "MEDOPL_AUTH_TOKEN_SHA256",
    "MEDOPL_ADMIN_TOKEN_SHA256",
    "MEDOPL_WEBHOOK_SECRET_SHA256",
    "MEDOPL_SESSION_SIGNING_SECRET_SHA256",
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
  if (operation === "build_push") {
    const dockerfile = path.resolve(process.env.V22_CONTAINER_DOCKERFILE || "");
    if (!existsSync(dockerfile) || !statSync(dockerfile).isFile()) {
      missing.push("V22_CONTAINER_DOCKERFILE:Dockerfile");
    }
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

function normalizeDeploymentTarget(value) {
  const raw = String(value || "").trim();
  if (!raw) return "deployment/medopl-control-plane";
  if (raw.includes("/")) return raw;
  return `deployment/${raw}`;
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
    await client.DescribeClusterNodePools({ ClusterId: clusterId });
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
    dockerfileRef: process.env.V22_CONTAINER_DOCKERFILE,
    shell,
  });
  return { evidenceRef, imageRef: process.env.V22_CONTAINER_IMAGE_REF, shellStatus: shell.status };
}

function assertPublicPayload(value, operation) {
  const text = JSON.stringify(value || {});
  if (/SecretId|SecretKey|BEGIN (?:OPENSSH|RSA).*PRIVATE KEY|postgres(?:ql)?:\/\/|sk-[A-Za-z0-9_-]{20,}/iu.test(text)) {
    fail("production_goal_live_test_sensitive_payload", { operationClass: operation }, 1);
  }
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = Number(process.env.V22_PRODUCTION_GOAL_HTTP_TIMEOUT_MS || 8000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "manual",
      ...options,
      headers: {
        connection: "close",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson({ baseUrl, path: requestPath, method = "GET", body, operation, stepId }) {
  return requestJsonWithAuth({ baseUrl, path: requestPath, method, body, operation, stepId });
}

async function requestJsonWithAuth({ baseUrl, path: requestPath, method = "GET", body, operation, stepId, session }) {
  const url = `${String(baseUrl || "").replace(/\/$/u, "")}${requestPath}`;
  let response;
  const headers = body ? { "content-type": "application/json" } : {};
  if (session) {
    headers.cookie = session.cookieHeader;
    if (method !== "GET" && method !== "HEAD") {
      headers["X-MedOPL-CSRF"] = session.csrfToken;
    }
  }
  try {
    response = await fetchWithTimeout(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    fail(`production_goal_live_test_${stepId}_failed`, {
      operationClass: operation,
      url,
      errorCode: error?.name || "FetchError",
    }, 1);
  }
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    fail(`production_goal_live_test_${stepId}_failed`, {
      operationClass: operation,
      url,
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      bodyShape: "non_json",
    }, 1);
  }
  assertPublicPayload(payload, operation);
  if (!response.ok) {
    fail(`production_goal_live_test_${stepId}_failed`, {
      operationClass: operation,
      url,
      status: response.status,
      payloadSummary: payload,
    }, 1);
  }
  return payload;
}

async function requestText({ url, operation, stepId }) {
  let response;
  try {
    response = await fetchWithTimeout(url);
  } catch (error) {
    fail(`production_goal_live_test_${stepId}_failed`, {
      operationClass: operation,
      url,
      errorCode: error?.name || "FetchError",
    }, 1);
  }
  const text = await response.text();
  if (response.status >= 500) {
    fail(`production_goal_live_test_${stepId}_failed`, {
      operationClass: operation,
      url,
      status: response.status,
    }, 1);
  }
  if (/SecretId|SecretKey|BEGIN (?:OPENSSH|RSA).*PRIVATE KEY|postgres(?:ql)?:\/\/|sk-[A-Za-z0-9_-]{20,}/iu.test(text)) {
    fail("production_goal_live_test_sensitive_payload", { operationClass: operation, stepId }, 1);
  }
  return { status: response.status, contentType: response.headers.get("content-type") || "", textLength: text.length };
}

async function requestPortalHtml({ url, operation, stepId }) {
  let response;
  try {
    response = await fetchWithTimeout(url);
  } catch (error) {
    fail(`production_goal_live_test_${stepId}_failed`, {
      operationClass: operation,
      url,
      errorCode: error?.name || "FetchError",
    }, 1);
  }
  const text = await response.text();
  assertPublicPayload({ text }, operation);
  const contentType = response.headers.get("content-type") || "";
  if (response.status !== 200 || !contentType.includes("text/html") || !(/MedOPL Portal|id="root"|\/assets\//u.test(text))) {
    fail(`production_goal_live_test_${stepId}_failed`, {
      operationClass: operation,
      url,
      status: response.status,
      contentType,
      bodyShape: "portal_html_required",
    }, 1);
  }
  return { status: response.status, contentType, textLength: text.length };
}

function requireFields(payload, fields, blocker, operation) {
  const missing = fields.filter((field) => {
    const value = field.split(".").reduce((node, key) => node?.[key], payload);
    return value === undefined || value === null || value === "";
  });
  if (missing.length > 0) {
    fail(blocker, { operationClass: operation, missingFields: missing }, 1);
  }
}

function assertGoHealth(payload, stepId, operation) {
  if (payload?.service !== "medopl-go-backend" || payload?.status !== "ok") {
    fail("production_goal_live_test_medopl_health_failed", {
      operationClass: operation,
      stepId,
      service: payload?.service || "",
      status: payload?.status || "",
    }, 1);
  }
}

function hashPublicRef(value = "") {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

function productionSessionCookieHeader({ tenantId, portalUserId, workspaceId, role = "user", csrfToken, operation }) {
  const sessionSecretHash = String(process.env.MEDOPL_SESSION_SIGNING_SECRET_SHA256 || "").trim();
  if (!/^[0-9a-f]{64}$/u.test(sessionSecretHash)) {
    fail("production_goal_live_test_session_signing_secret_missing", { operationClass: operation }, 65);
  }
  const claims = {
    tenantId,
    userId: portalUserId,
    workspaceId,
    role,
    csrfHash: createHash("sha256").update(csrfToken).digest("hex"),
  };
  const payloadHex = Buffer.from(JSON.stringify(claims), "utf8").toString("hex");
  const signature = createHash("sha256").update(`${payloadHex}:${sessionSecretHash}`).digest("hex");
  return `medopl_session=${payloadHex}.${signature}; medopl_csrf=${encodeURIComponent(csrfToken)}`;
}

function assertPositiveCount(value, label, operation) {
  const count = Number(value || 0);
  if (!Number.isInteger(count) || count < 1) {
    fail("production_goal_live_db_persistence_metadata_missing", {
      operationClass: operation,
      label,
      observedCount: count,
    }, 1);
  }
  return count;
}

async function queryCount(client, query, values) {
  const result = await client.query(query, values);
  return Number(result.rows?.[0]?.count || 0);
}

async function queryLiveDatabasePersistenceProof(operation, workspaceId, refs = {}) {
  if (process.env.V22_MEDOPL_LIVE_DB_PERSISTENCE_PROOF !== "1") {
    return { databasePersistenceProof: false };
  }
  if (!String(process.env.DATABASE_URL || "").trim()) {
    fail("production_goal_live_db_persistence_database_url_missing", { operationClass: operation }, 65);
  }

  const pg = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const counts = {
      businessAccounts: assertPositiveCount(
        await queryCount(client, "SELECT count(*)::int AS count FROM business_accounts WHERE workspace_id = $1", [workspaceId]),
        "business_accounts",
        operation,
      ),
      creditEvents: assertPositiveCount(
        await queryCount(client, "SELECT count(*)::int AS count FROM credit_events WHERE workspace_id = $1", [workspaceId]),
        "credit_events",
        operation,
      ),
      providerBindings: assertPositiveCount(
        await queryCount(client, "SELECT count(*)::int AS count FROM control_plane_records WHERE kind = 'provider_binding' AND workspace_id = $1", [workspaceId]),
        "provider_binding_records",
        operation,
      ),
      launchProjections: assertPositiveCount(
        await queryCount(client, "SELECT count(*)::int AS count FROM control_plane_records WHERE kind = 'launch_projection' AND workspace_id = $1", [workspaceId]),
        "launch_projection_records",
        operation,
      ),
      managedResources: assertPositiveCount(
        await queryCount(client, "SELECT count(*)::int AS count FROM control_plane_records WHERE kind = 'managed_resource' AND workspace_id = $1", [workspaceId]),
        "managed_resource_records",
        operation,
      ),
      files: assertPositiveCount(
        await queryCount(client, "SELECT count(*)::int AS count FROM files WHERE workspace_id = $1", [workspaceId]),
        "file_records",
        operation,
      ),
      runs: assertPositiveCount(
        await queryCount(client, "SELECT count(*)::int AS count FROM runs WHERE workspace_id = $1", [workspaceId]),
        "run_records",
        operation,
      ),
      artifacts: assertPositiveCount(
        await queryCount(client, "SELECT count(*)::int AS count FROM artifacts WHERE workspace_id = $1", [workspaceId]),
        "artifact_records",
        operation,
      ),
      auditEvents: assertPositiveCount(
        await queryCount(client, "SELECT count(*)::int AS count FROM control_plane_audit_events WHERE workspace_id = $1", [workspaceId]),
        "audit_event_records",
        operation,
      ),
      billingEvents: assertPositiveCount(
        await queryCount(client, "SELECT count(*)::int AS count FROM billing_events WHERE workspace_id = $1", [workspaceId]),
        "billing_event_records",
        operation,
      ),
    };
    return {
      databasePersistenceProof: true,
      databaseUrlRef: "DATABASE_URL",
      workspaceRefHash: hashPublicRef(workspaceId),
      objectRefHashes: Object.fromEntries(Object.entries(refs).map(([key, value]) => [key, hashPublicRef(value)])),
      recordCounts: counts,
    };
  } finally {
    await client.end();
  }
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
  const namespace = process.env.V22_MEDOPL_KUBERNETES_NAMESPACE || plan.namespace || "medopl";
  const deployment = normalizeDeploymentTarget(plan.deployment);
  const command = process.env.V22_MEDOPL_DEPLOY_SHELL
    || `kubectl --kubeconfig ${JSON.stringify(process.env.TENCENT_DEPLOY_KUBECONFIG_REF)} -n ${JSON.stringify(namespace)} rollout status ${JSON.stringify(deployment)} --timeout=180s`;
  const shell = executeShell(command, operation);
  const evidenceRef = safeWriteRuntimeEvidence(operation, {
    status: "accepted",
    deployPlanRef: process.env.V22_MEDOPL_DEPLOY_PLAN_FILE,
    namespace,
    deployment,
    shell,
  });
  return { evidenceRef, namespace, deployment, rolloutObserved: true, shellStatus: shell.status };
}

async function runLiveTest(operation) {
  const oplBaseUrl = String(process.env.V22_OPL_WEBUI_CONSUMER_CANARY_URL || "").replace(/\/$/u, "");
  const medoplBaseUrl = String(process.env.V22_MEDOPL_PUBLIC_BASE_URL || "").replace(/\/$/u, "");
  const workspaceId = `goal-f-production-canary-${Date.now()}`;
  const tenantId = "tenant-goal-f-canary";
  const portalUserId = "user-goal-f-canary";
  const csrfToken = `goal-f-csrf-${workspaceId}`;
  const session = {
    csrfToken,
    cookieHeader: productionSessionCookieHeader({ tenantId, portalUserId, workspaceId, csrfToken, operation }),
  };
  const observed = [];

  const oplEntry = await requestText({ url: oplBaseUrl, operation, stepId: "opl_webui_public_entry" });
  observed.push({ step: "opl_webui_public_entry", url: oplBaseUrl, status: oplEntry.status });
  const portalEntry = await requestPortalHtml({ url: medoplBaseUrl, operation, stepId: "medopl_portal_public_entry" });
  observed.push({ step: "medopl_portal_public_entry", url: medoplBaseUrl, status: portalEntry.status });

  const health = await requestJson({ baseUrl: medoplBaseUrl, path: "/healthz", operation, stepId: "medopl_healthz" });
  assertGoHealth(health, "medopl_healthz", operation);
  observed.push({ step: "medopl_healthz", status: 200 });
  const ready = await requestJson({ baseUrl: medoplBaseUrl, path: "/readyz", operation, stepId: "medopl_readyz" });
  assertGoHealth(ready, "medopl_readyz", operation);
  observed.push({ step: "medopl_readyz", status: 200 });

  const account = await requestJson({
    baseUrl: medoplBaseUrl,
    path: "/api/v22/users/prepare",
    method: "POST",
    body: {
      tenantId,
      portalUserId,
      workspaceId,
    },
    operation,
    stepId: "prepare_business_account",
    session,
  });
  requireFields(account, ["workspaceId"], "production_goal_live_test_prepare_business_account_failed", operation);
  observed.push({ step: "prepare_business_account", accountStatus: account.accountStatus || account.status || "active" });

  const credit = await requestJson({
    baseUrl: medoplBaseUrl,
    path: "/api/v22/users/credit",
    method: "POST",
    body: {
      tenantId,
      portalUserId,
      workspaceId,
      amount: 1,
      currency: "CNY",
      idempotencyKey: `${workspaceId}-credit`,
    },
    operation,
    stepId: "credit_business_account",
    session,
  });
  requireFields(credit, ["workspaceId"], "production_goal_live_test_credit_business_account_failed", operation);
  observed.push({ step: "credit_business_account", credited: true });

  const provider = await requestJson({
    baseUrl: medoplBaseUrl,
    path: "/api/v22/provider-key",
    method: "POST",
    body: {
      tenantId,
      portalUserId,
      workspaceId,
      apiKey: "goal-f-canary-provider-key-redacted",
      idempotencyKey: `${workspaceId}-provider`,
    },
    operation,
    stepId: "bind_provider_key",
    session,
  });
  requireFields(provider, ["providerKeyRef"], "production_goal_live_test_provider_key_failed", operation);
  observed.push({ step: "bind_provider_key", providerKeyStatus: provider.boundStatus || "bound" });

  const launch = await requestJson({
    baseUrl: medoplBaseUrl,
    path: "/api/v22/managed-environment/open",
    method: "POST",
    body: {
      tenantId,
      portalUserId,
      workspaceId,
      idempotencyKey: `${workspaceId}-open-runtime`,
    },
    operation,
    stepId: "open_runtime",
    session,
  });
  requireFields(launch, ["launchId", "resourceBindingId"], "production_goal_live_test_open_runtime_failed", operation);
  observed.push({ step: "open_runtime", runtimeRef: "runtime_ref" });

  const gate = await requestJson({
    baseUrl: medoplBaseUrl,
    path: "/api/opl/runtime-gate",
    method: "POST",
    body: { workspaceId, invocationMode: "runtime_required" },
    operation,
    stepId: "runtime_gate",
    session,
  });
  requireFields(gate, ["ok", "workspaceId", "runtimeState", "storageState", "nodePoolProjection.state"], "production_goal_live_test_runtime_gate_failed", operation);
  if (gate.ok !== true) fail("production_goal_live_test_runtime_gate_failed", { operationClass: operation, reason: "ok_false" }, 1);
  observed.push({ step: "runtime_gate", runtimeState: gate.runtimeState, storageState: gate.storageState });

  const launchQuery = `?launchId=${encodeURIComponent(launch.launchId)}`;
  const file = await requestJson({
    baseUrl: medoplBaseUrl,
    path: `/api/opl/files${launchQuery}`,
    method: "POST",
    body: {
      fileName: "goal-f-canary.csv",
      relativePath: "inputs/goal-f-canary.csv",
      contentType: "text/csv",
      sizeBytes: 32,
    },
    operation,
    stepId: "upload_file",
    session,
  });
  requireFields(file, ["fileRef"], "production_goal_live_test_upload_file_failed", operation);
  observed.push({ step: "upload_file", fileRef: "file_ref" });

  const run = await requestJson({
    baseUrl: medoplBaseUrl,
    path: `/api/opl/runs${launchQuery}`,
    method: "POST",
    body: {
      message: "goal f production canary",
      fileRefs: [file.fileRef],
      toolName: "runtime_required",
      requestId: `${workspaceId}-run`,
    },
    operation,
    stepId: "run_task",
    session,
  });
  requireFields(run, ["artifactRef"], "production_goal_live_test_run_task_failed", operation);
  observed.push({ step: "run_task", artifactRef: "artifact_ref" });

  const artifact = await requestJson({
    baseUrl: medoplBaseUrl,
    path: `/api/opl/artifacts/${encodeURIComponent(run.artifactRef)}${launchQuery}`,
    operation,
    stepId: "fetch_artifact",
    session,
  });
  requireFields(artifact, ["artifactRef"], "production_goal_live_test_fetch_artifact_failed", operation);
  observed.push({ step: "fetch_artifact", artifactRef: "artifact_ref" });

  const billing = await requestJson({
    baseUrl: medoplBaseUrl,
    path: `/api/billing/summary?workspaceId=${encodeURIComponent(workspaceId)}`,
    operation,
    stepId: "billing_summary",
    session,
  });
  requireFields(billing, ["runCount", "ledgerCount"], "production_goal_live_test_billing_summary_failed", operation);
  observed.push({ step: "billing_summary", runCount: billing.runCount, ledgerCount: billing.ledgerCount });

  const release = await requestJson({
    baseUrl: medoplBaseUrl,
    path: "/api/v22/managed-environment/release",
    method: "POST",
    body: {
      workspaceId,
      resourceBindingId: launch.resourceBindingId,
      stopBilling: true,
      idempotencyKey: `${workspaceId}-release-runtime`,
    },
    operation,
    stepId: "release_runtime",
    session,
  });
  requireFields(release, ["billingStopped", "auditEventId"], "production_goal_live_test_release_runtime_failed", operation);
  observed.push({ step: "release_runtime", billingStopped: release.billingStopped === true });

  const storage = await requestJson({
    baseUrl: medoplBaseUrl,
    path: "/api/v22/storage/destroy",
    method: "POST",
    body: {
      workspaceId,
      resourceBindingId: launch.resourceBindingId,
      storageBindingId: gate.storageBindingId || file.storageBindingId || "storage-canary",
      idempotencyKey: `${workspaceId}-destroy-storage`,
    },
    operation,
    stepId: "destroy_storage",
    session,
  });
  requireFields(storage, ["storageDestroyed", "storageState"], "production_goal_live_test_destroy_storage_failed", operation);
  observed.push({ step: "destroy_storage", storageState: storage.storageState });

  const databaseProof = await queryLiveDatabasePersistenceProof(operation, workspaceId, {
    fileRef: file.fileRef,
    runRef: run.runRef || run.runId || `${workspaceId}-run`,
    artifactRef: run.artifactRef,
    resourceBindingId: launch.resourceBindingId,
  });
  const steps = observed.map((item) => item.step);
  const evidenceRef = safeWriteRuntimeEvidence(operation, {
    status: "accepted",
    flowCompleteness: "medopl_public_api_product_e2e",
    observed,
    databaseProof,
  });
  return {
    evidenceRef,
    urls: [oplBaseUrl, medoplBaseUrl],
    flowCompleteness: "medopl_public_api_product_e2e",
    steps,
    observed,
    databaseProof,
  };
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
