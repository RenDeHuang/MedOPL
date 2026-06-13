import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const EXECUTION_GATE_KEY = "RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION";
const REQUIRED_KEYS = Object.freeze([
  EXECUTION_GATE_KEY,
  "MEDOPL_POSTGRES_LEDGER_HOST",
  "MEDOPL_POSTGRES_LEDGER_PORT",
  "MEDOPL_POSTGRES_LEDGER_DATABASE",
  "MEDOPL_POSTGRES_LEDGER_USER",
  "MEDOPL_POSTGRES_LEDGER_PASSWORD",
  "MEDOPL_POSTGRES_LEDGER_SSLMODE",
]);
const OPTIONAL_KEYS = Object.freeze(["MEDOPL_POSTGRES_LEDGER_SCHEMA"]);
const ALLOWLIST = Object.freeze([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);
const REQUIRED_TABLES = Object.freeze(["resource_bindings", "cloud_operations"]);
const VALID_STATUSES = new Set([
  "requested",
  "creating",
  "created",
  "scaling",
  "ready",
  "releaseRequested",
  "deleting",
  "released",
  "failed",
  "cleanupRequired",
]);
const UPDATE_FIELD_ALLOWLIST = new Set([
  "node_pool_id",
  "status",
  "released_at",
  "completed_at",
]);
const requireFromHere = createRequire(import.meta.url);
const FORBIDDEN_ARGS = new Set([
  "--deploy",
  "--kubectl",
  "--build",
  "--push",
  "--package-d",
  "--kubeconfig",
  "--tencent-mutation",
  "--live-mutation",
]);

function clean(value = "") {
  return String(value || "").trim();
}

function redactedText(value = "") {
  return String(value || "")
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/giu, "[redacted-db-url]")
    .replace(/password\s*[:=]\s*[^,\s;]+/giu, "password=[redacted]")
    .replace(/SecretId|SecretKey|KUBECONFIG|kubeconfig/giu, "[redacted-sensitive-key]")
    .slice(0, 512);
}

function stripQuotes(value = "") {
  const text = String(value || "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function parseLine(line = "") {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
  const index = normalized.indexOf("=");
  if (index <= 0) return null;
  return [normalized.slice(0, index).trim(), stripQuotes(normalized.slice(index + 1))];
}

export function parsePostgresLedgerEnv(content = "") {
  const env = new Map();
  for (const line of String(content || "").split(/\r?\n/u)) {
    const parsed = parseLine(line);
    if (parsed) env.set(parsed[0], parsed[1]);
  }
  return env;
}

function forbiddenKey(key = "") {
  return (
    /^TENCENT_/u.test(key)
    || /^PACKAGE_D_/u.test(key)
    || /(?:^|_)KUBECONFIG$/u.test(key)
    || /KUBE/u.test(key)
    || /SECRET_ID|SECRET_KEY/u.test(key)
    || /DEPLOY/u.test(key)
    || /BUILD_PUSH/u.test(key)
  );
}

function validateIdentifier(value = "", label = "identifier") {
  const text = clean(value);
  if (!/^[a-z_][a-z0-9_]*$/u.test(text)) {
    throw new Error(`package_c_postgres_ledger_invalid_${label}`);
  }
  return text;
}

function tableName(schema, table) {
  return `"${validateIdentifier(schema, "schema")}"."${validateIdentifier(table, "table")}"`;
}

function value(env, key) {
  return clean(env.get(key));
}

export function validatePostgresLedgerEnv(env) {
  const forbidden = [...env.keys()].filter((key) => !ALLOWLIST.includes(key) || forbiddenKey(key)).sort();
  const missing = REQUIRED_KEYS.filter((key) => value(env, key) === "");
  const errors = [];
  if (value(env, EXECUTION_GATE_KEY) !== "1") errors.push("RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION_must_be_1");
  const port = Number(value(env, "MEDOPL_POSTGRES_LEDGER_PORT"));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) errors.push("MEDOPL_POSTGRES_LEDGER_PORT_invalid");
  const sslMode = value(env, "MEDOPL_POSTGRES_LEDGER_SSLMODE");
  if (sslMode && !["disable", "require", "verify-ca", "verify-full"].includes(sslMode)) {
    errors.push("MEDOPL_POSTGRES_LEDGER_SSLMODE_invalid");
  }
  const schema = value(env, "MEDOPL_POSTGRES_LEDGER_SCHEMA") || "public";
  try {
    validateIdentifier(schema, "schema");
  } catch {
    errors.push("MEDOPL_POSTGRES_LEDGER_SCHEMA_invalid");
  }
  const ok = forbidden.length === 0 && missing.length === 0 && errors.length === 0;
  return {
    ok,
    forbidden,
    missing,
    errors,
    allowlist: ALLOWLIST,
    requiredKeys: REQUIRED_KEYS,
    config: ok ? {
      executionGate: value(env, EXECUTION_GATE_KEY),
      host: value(env, "MEDOPL_POSTGRES_LEDGER_HOST"),
      port,
      database: value(env, "MEDOPL_POSTGRES_LEDGER_DATABASE"),
      user: value(env, "MEDOPL_POSTGRES_LEDGER_USER"),
      password: value(env, "MEDOPL_POSTGRES_LEDGER_PASSWORD"),
      sslMode,
      schema,
    } : null,
  };
}

export function redactPostgresLedgerConfig(config = {}) {
  return {
    executionGate: clean(config.executionGate) === "1" ? "1" : "0",
    host: clean(config.host) ? "[redacted-host]" : "",
    port: Number(config.port) || 0,
    database: clean(config.database) ? "[redacted-database]" : "",
    user: clean(config.user) ? "[redacted-user]" : "",
    password: "[redacted]",
    sslMode: clean(config.sslMode),
    schema: clean(config.schema || "public"),
    connectionUrl: "[not-used]",
  };
}

export function createPackageCPostgresDriverAdapter() {
  let client = null;
  return {
    async connect(config) {
      let pg;
      try {
        pg = requireFromHere("pg");
      } catch {
        throw new Error("package_c_postgres_ledger_pg_driver_missing");
      }
      const Client = pg.Client;
      if (typeof Client !== "function") throw new Error("package_c_postgres_ledger_pg_driver_invalid");
      client = new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.sslMode === "disable" ? false : { rejectUnauthorized: config.sslMode === "verify-full" },
      });
      await client.connect();
    },
    async query(sql, params = []) {
      if (!client) throw new Error("package_c_postgres_ledger_pg_client_not_connected");
      return client.query(sql, params);
    },
    async close() {
      if (client) await client.end();
      client = null;
    },
  };
}

function requireValidStatus(status = "") {
  const normalized = clean(status);
  if (!VALID_STATUSES.has(normalized)) throw new Error("package_c_postgres_ledger_invalid_status");
  return normalized;
}

function requiredString(object, key) {
  const output = clean(object?.[key]);
  if (!output) throw new Error(`package_c_postgres_ledger_missing:${key}`);
  return output;
}

function optionalString(object, key) {
  return clean(object?.[key]);
}

function isoTimestamp(value = "") {
  const text = clean(value);
  if (!text) return new Date().toISOString();
  const time = new Date(text);
  if (Number.isNaN(time.getTime())) throw new Error("package_c_postgres_ledger_invalid_timestamp");
  return time.toISOString();
}

function optionalIsoTimestamp(value = "") {
  const text = clean(value);
  if (!text) return null;
  return isoTimestamp(text);
}

function stableId(prefix, id) {
  return `${prefix}-${requiredString({ id }, "id")}`;
}

function resourceBindingRow(resourceBinding = {}) {
  return {
    id: stableId("rb", resourceBinding.resourceBindingId),
    tenantId: requiredString(resourceBinding, "tenantId"),
    accountId: requiredString(resourceBinding, "accountId"),
    workspaceId: requiredString(resourceBinding, "workspaceId"),
    resourceBindingId: requiredString(resourceBinding, "resourceBindingId"),
    billingAttributionId: requiredString(resourceBinding, "billingAttributionId"),
    serverPlanId: requiredString(resourceBinding, "serverPlanId"),
    workspaceStorageGb: Number(resourceBinding.workspaceStorageGb),
    cloudProvider: requiredString(resourceBinding, "cloudProvider"),
    region: requiredString(resourceBinding, "region"),
    clusterId: requiredString(resourceBinding, "clusterId"),
    nodePoolId: optionalString(resourceBinding, "nodePoolId") || null,
    nodePoolName: requiredString(resourceBinding, "nodePoolName"),
    status: requireValidStatus(resourceBinding.status),
    operationId: requiredString(resourceBinding, "operationId"),
    canonicalOwnershipSource: optionalString(resourceBinding, "canonicalOwnershipSource") || "postgres_resource_binding_ledger",
    cloudTagSupport: optionalString(resourceBinding, "cloudTagSupport") || "tke_nodepool_unsupported",
    createdAt: isoTimestamp(resourceBinding.createdAt),
    releasedAt: optionalIsoTimestamp(resourceBinding.releasedAt),
    updatedAt: new Date().toISOString(),
  };
}

function cloudOperationRow(operation = {}) {
  return {
    id: stableId("op", operation.operationId),
    operationId: requiredString(operation, "operationId"),
    resourceBindingId: requiredString(operation, "resourceBindingId"),
    tenantId: requiredString(operation, "tenantId"),
    accountId: requiredString(operation, "accountId"),
    workspaceId: requiredString(operation, "workspaceId"),
    billingAttributionId: requiredString(operation, "billingAttributionId"),
    operationType: requiredString(operation, "operationType"),
    serverPlanId: requiredString(operation, "serverPlanId"),
    workspaceStorageGb: Number(operation.workspaceStorageGb),
    status: requireValidStatus(operation.status),
    cloudProvider: requiredString(operation, "cloudProvider"),
    region: requiredString(operation, "region"),
    clusterId: requiredString(operation, "clusterId"),
    nodePoolId: optionalString(operation, "nodePoolId") || null,
    nodePoolName: requiredString(operation, "nodePoolName"),
    cloudTagSupport: optionalString(operation, "cloudTagSupport") || "tke_nodepool_unsupported",
    canonicalOwnershipSource: optionalString(operation, "canonicalOwnershipSource") || "postgres_resource_binding_ledger",
    createdAt: isoTimestamp(operation.createdAt),
    completedAt: optionalIsoTimestamp(operation.completedAt),
    updatedAt: new Date().toISOString(),
  };
}

function assertPositiveStorage(row) {
  if (!Number.isInteger(row.workspaceStorageGb) || row.workspaceStorageGb <= 0) {
    throw new Error("package_c_postgres_ledger_invalid_workspace_storage_gb");
  }
}

function assertTenantNodePool(nodePoolId = "") {
  const normalized = clean(nodePoolId);
  if (normalized === "np-cbk784r8") {
    throw new Error("package_c_postgres_ledger_refuses_protected_platform_pool");
  }
  return normalized || null;
}

async function requiredQuery(adapter, sql, params = []) {
  if (!adapter || typeof adapter.query !== "function") throw new Error("package_c_postgres_ledger_adapter_query_required");
  return adapter.query(sql, params);
}

async function preflight({ adapter, schema }) {
  if (!adapter || typeof adapter.connect !== "function" || typeof adapter.close !== "function") {
    throw new Error("package_c_postgres_ledger_adapter_required");
  }
  await requiredQuery(adapter, "SELECT 1 AS medopl_postgres_ledger_reachable");
  const tableResult = await requiredQuery(adapter, `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_name = ANY($2)
  `, [schema, REQUIRED_TABLES]);
  const observed = new Set((tableResult?.rows || []).map((row) => clean(row.table_name)));
  const missingTables = REQUIRED_TABLES.filter((name) => !observed.has(name));
  if (missingTables.length > 0) {
    const error = new Error("package_c_postgres_ledger_required_tables_missing");
    error.missingTables = missingTables;
    throw error;
  }
  await requiredQuery(adapter, `
    CREATE TEMP TABLE medopl_ledger_write_permission_probe (
      id TEXT PRIMARY KEY
    ) ON COMMIT DROP
  `);
  await requiredQuery(adapter, "INSERT INTO medopl_ledger_write_permission_probe (id) VALUES ($1)", ["probe"]);
  await requiredQuery(adapter, "DROP TABLE IF EXISTS medopl_ledger_write_permission_probe");
}

export function createPackageCPostgresLedgerSink({ config, adapter }) {
  if (!config || clean(config.executionGate) !== "1") {
    throw new Error("package_c_postgres_ledger_execution_gate_required");
  }
  if (!adapter) throw new Error("package_c_postgres_ledger_adapter_required");
  const schema = validateIdentifier(config.schema || "public", "schema");
  const resourceBindingsTable = tableName(schema, "resource_bindings");
  const cloudOperationsTable = tableName(schema, "cloud_operations");
  let connected = false;

  async function ensureConnected() {
    if (connected) return;
    await adapter.connect(config);
    connected = true;
  }

  async function updateResourceBinding(resourceBindingId, fields) {
    await ensureConnected();
    const entries = Object.entries(fields);
    for (const [field] of entries) {
      if (!UPDATE_FIELD_ALLOWLIST.has(field)) throw new Error("package_c_postgres_ledger_update_field_not_allowed");
    }
    const assignments = entries.map(([field], index) => `${field} = $${index + 2}`).join(", ");
    await requiredQuery(adapter, `
      UPDATE ${resourceBindingsTable}
      SET ${assignments}, updated_at = NOW()
      WHERE resource_binding_id = $1
    `, [resourceBindingId, ...entries.map(([, value]) => value)]);
  }

  async function updateCloudOperation(resourceBindingId, fields) {
    const entries = Object.entries(fields);
    for (const [field] of entries) {
      if (!UPDATE_FIELD_ALLOWLIST.has(field)) throw new Error("package_c_postgres_ledger_update_field_not_allowed");
    }
    const assignments = entries.map(([field], index) => `${field} = $${index + 2}`).join(", ");
    await requiredQuery(adapter, `
      UPDATE ${cloudOperationsTable}
      SET ${assignments}, updated_at = NOW()
      WHERE resource_binding_id = $1
    `, [resourceBindingId, ...entries.map(([, value]) => value)]);
  }

  return {
    mode: "postgres_execution",
    productionPostgresWrite: true,
    async preflight() {
      await ensureConnected();
      await preflight({ adapter, schema });
    },
    async createResourceBinding(resourceBinding) {
      await ensureConnected();
      const row = resourceBindingRow(resourceBinding);
      assertPositiveStorage(row);
      assertTenantNodePool(row.nodePoolId);
      await requiredQuery(adapter, `
        INSERT INTO ${resourceBindingsTable} (
          id, tenant_id, account_id, workspace_id, resource_binding_id,
          billing_attribution_id, server_plan_id, workspace_storage_gb,
          cloud_provider, region, cluster_id, node_pool_id, node_pool_name,
          status, operation_id, canonical_ownership_source, cloud_tag_support,
          created_at, released_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20
        )
        ON CONFLICT (resource_binding_id) DO UPDATE SET
          status = EXCLUDED.status,
          operation_id = EXCLUDED.operation_id,
          updated_at = EXCLUDED.updated_at
      `, [
        row.id,
        row.tenantId,
        row.accountId,
        row.workspaceId,
        row.resourceBindingId,
        row.billingAttributionId,
        row.serverPlanId,
        row.workspaceStorageGb,
        row.cloudProvider,
        row.region,
        row.clusterId,
        row.nodePoolId,
        row.nodePoolName,
        row.status,
        row.operationId,
        row.canonicalOwnershipSource,
        row.cloudTagSupport,
        row.createdAt,
        row.releasedAt,
        row.updatedAt,
      ]);
    },
    async appendCloudOperationEvent(cloudOperation) {
      await ensureConnected();
      const row = cloudOperationRow(cloudOperation);
      assertPositiveStorage(row);
      assertTenantNodePool(row.nodePoolId);
      await requiredQuery(adapter, `
        INSERT INTO ${cloudOperationsTable} (
          id, operation_id, resource_binding_id, tenant_id, account_id,
          workspace_id, billing_attribution_id, operation_type, server_plan_id,
          workspace_storage_gb, status, cloud_provider, region, cluster_id,
          node_pool_id, node_pool_name, cloud_tag_support,
          canonical_ownership_source, created_at, completed_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          $15, $16, $17,
          $18, $19, $20, $21
        )
        ON CONFLICT (operation_id) DO UPDATE SET
          status = EXCLUDED.status,
          node_pool_id = EXCLUDED.node_pool_id,
          completed_at = EXCLUDED.completed_at,
          updated_at = EXCLUDED.updated_at
      `, [
        row.id,
        row.operationId,
        row.resourceBindingId,
        row.tenantId,
        row.accountId,
        row.workspaceId,
        row.billingAttributionId,
        row.operationType,
        row.serverPlanId,
        row.workspaceStorageGb,
        row.status,
        row.cloudProvider,
        row.region,
        row.clusterId,
        row.nodePoolId,
        row.nodePoolName,
        row.cloudTagSupport,
        row.canonicalOwnershipSource,
        row.createdAt,
        row.completedAt,
        row.updatedAt,
      ]);
    },
    async updateNodePoolId(resourceBindingId, nodePoolId, status) {
      const safeNodePoolId = assertTenantNodePool(nodePoolId);
      const safeStatus = requireValidStatus(status);
      await updateResourceBinding(resourceBindingId, { node_pool_id: safeNodePoolId, status: safeStatus });
      await updateCloudOperation(resourceBindingId, { node_pool_id: safeNodePoolId, status: safeStatus });
    },
    async updateLifecycleStatus(resourceBindingId, status) {
      const safeStatus = requireValidStatus(status);
      await updateResourceBinding(resourceBindingId, { status: safeStatus });
      await updateCloudOperation(resourceBindingId, { status: safeStatus });
    },
    async markReleased(resourceBindingId, releasedAt) {
      const timestamp = isoTimestamp(releasedAt);
      await updateResourceBinding(resourceBindingId, { status: "released", released_at: timestamp });
      await updateCloudOperation(resourceBindingId, { status: "released", completed_at: timestamp });
    },
    async markFailed(resourceBindingId) {
      await updateResourceBinding(resourceBindingId, { status: "failed" });
      await updateCloudOperation(resourceBindingId, { status: "failed", completed_at: new Date().toISOString() });
    },
    async markCleanupRequired(resourceBindingId) {
      await updateResourceBinding(resourceBindingId, { status: "cleanupRequired" });
      await updateCloudOperation(resourceBindingId, { status: "cleanupRequired", completed_at: new Date().toISOString() });
    },
    async close() {
      if (connected) await adapter.close();
      connected = false;
    },
  };
}

export async function runPackageCPostgresLedgerPrepareOnly({
  envContent = "",
  envFile = "",
  reportDir = path.join(".runtime", "v22-cloud-lifecycle"),
  operationId = "op-package-c-postgres-ledger-prepare-only",
  adapter,
} = {}) {
  if (clean(envFile) && /(?:package-d-deploy|kubeconfig)/iu.test(clean(envFile))) {
    throw new Error("package_c_postgres_ledger_env_file_forbidden");
  }
  const content = clean(envFile) ? await readFile(envFile, "utf8") : envContent;
  const env = parsePostgresLedgerEnv(content);
  const validation = validatePostgresLedgerEnv(env);
  const evidenceRoot = path.join(reportDir, operationId);
  await mkdir(evidenceRoot, { recursive: true });
  const summaryPath = path.join(evidenceRoot, "postgres-ledger-prepare-only-summary.json");
  if (!validation.ok) {
    const summary = {
      ok: false,
      mode: "postgres_ledger_prepare_only",
      operationId,
      validation: {
        forbidden: validation.forbidden,
        missing: validation.missing,
        errors: validation.errors,
        requiredKeys: REQUIRED_KEYS,
        allowlist: ALLOWLIST,
      },
      boundary: {
        productionPostgresWrite: false,
        readsPackageDDeployEnv: false,
        readsKubeconfig: false,
        executesTencentMutation: false,
        deploysWorkload: false,
        buildsOrPushesImage: false,
      },
      evidenceSink: ".runtime",
    };
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    return { ...summary, summaryPath, evidenceRoot };
  }
  const sink = createPackageCPostgresLedgerSink({
    config: validation.config,
    adapter: adapter || createPackageCPostgresDriverAdapter(),
  });
  try {
    await sink.preflight();
  } catch (error) {
    const summary = {
      ok: false,
      mode: "postgres_ledger_prepare_only",
      operationId,
      requiredTables: REQUIRED_TABLES,
      config: redactPostgresLedgerConfig(validation.config),
      boundary: {
        productionPostgresWrite: false,
        preparesPostgresExecutionSink: true,
        validatesReachability: false,
        validatesRequiredTables: false,
        validatesWritePermission: false,
        writesBusinessRows: false,
        readsPackageDDeployEnv: false,
        readsKubeconfig: false,
        executesTencentMutation: false,
        deploysWorkload: false,
        buildsOrPushesImage: false,
      },
      failure: {
        code: clean(error?.message || error?.code || "package_c_postgres_ledger_preflight_failed"),
        message: redactedText(error?.message || "package_c_postgres_ledger_preflight_failed"),
      },
      redactionAudit: {
        passwordRedacted: true,
        connectionUrlOmitted: true,
        rawProviderResponseStored: false,
      },
      evidenceSink: ".runtime",
    };
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    return { ...summary, summaryPath, evidenceRoot };
  } finally {
    await sink.close();
  }
  const summary = {
    ok: true,
    mode: "postgres_ledger_prepare_only",
    operationId,
    requiredTables: REQUIRED_TABLES,
    config: redactPostgresLedgerConfig(validation.config),
    boundary: {
      productionPostgresWrite: false,
      preparesPostgresExecutionSink: true,
      validatesReachability: true,
      validatesRequiredTables: true,
      validatesWritePermission: true,
      writesBusinessRows: false,
      readsPackageDDeployEnv: false,
      readsKubeconfig: false,
      executesTencentMutation: false,
      deploysWorkload: false,
      buildsOrPushesImage: false,
    },
    redactionAudit: {
      passwordRedacted: true,
      connectionUrlOmitted: true,
      rawProviderResponseStored: false,
    },
    evidenceSink: ".runtime",
  };
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return { ...summary, summaryPath, evidenceRoot };
}

export function parsePackageCPostgresLedgerArgs(argv = process.argv.slice(2)) {
  const options = {
    prepareOnly: false,
    confirmDbPreflightOnly: false,
    envFile: "",
    reportDir: path.join(".runtime", "v22-cloud-lifecycle"),
    operationId: "op-package-c-postgres-ledger-prepare-only",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (FORBIDDEN_ARGS.has(arg)) throw new Error(`package_c_postgres_ledger_forbidden_arg:${arg}`);
    if (arg === "--prepare-only") {
      options.prepareOnly = true;
    } else if (arg === "--confirm-db-preflight-only") {
      options.confirmDbPreflightOnly = true;
    } else if (arg === "--ledger-env-file") {
      options.envFile = argv[++index] || "";
    } else if (arg === "--report-dir") {
      options.reportDir = argv[++index] || "";
    } else if (arg === "--operation-id") {
      options.operationId = argv[++index] || "";
    } else {
      throw new Error(`package_c_postgres_ledger_unknown_arg:${arg}`);
    }
  }
  if (!options.prepareOnly || !options.confirmDbPreflightOnly) {
    throw new Error("package_c_postgres_ledger_prepare_only_confirmation_required");
  }
  if (!clean(options.envFile)) throw new Error("package_c_postgres_ledger_env_file_required");
  if (!clean(options.operationId)) throw new Error("package_c_postgres_ledger_operation_id_required");
  return options;
}

async function main() {
  const options = parsePackageCPostgresLedgerArgs();
  const summary = await runPackageCPostgresLedgerPrepareOnly({
    envFile: options.envFile,
    reportDir: options.reportDir,
    operationId: options.operationId,
  });
  console.log(JSON.stringify({
    ok: summary.ok,
    package: "C",
    mode: "postgres_ledger_prepare_only",
    operationId: summary.operationId,
    summaryPath: summary.summaryPath,
    evidenceRoot: summary.evidenceRoot,
    productionPostgresWrite: false,
    executesTencentMutation: false,
    callsKubectl: false,
    deploysWorkload: false,
    buildsOrPushesImage: false,
    readsKubeconfig: false,
  }, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(redactedText(error?.message || "package_c_postgres_ledger_failed"));
    process.exitCode = 1;
  });
}
