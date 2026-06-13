import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createPackageCPostgresDriverAdapter,
  createPackageCPostgresLedgerSink,
  parsePostgresLedgerEnv,
  redactPostgresLedgerConfig,
  runPackageCPostgresLedgerPrepareOnly,
  validatePostgresLedgerEnv,
} from "../../support/cloud-prework/package-c-postgres-ledger-sink.js";

const runner = "tests/support/cloud-prework/package-c-postgres-ledger-sink.js";

function runCli(args = []) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function baseEnv(overrides = {}) {
  const entries = {
    RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION: "1",
    MEDOPL_POSTGRES_LEDGER_HOST: "127.0.0.1",
    MEDOPL_POSTGRES_LEDGER_PORT: "5432",
    MEDOPL_POSTGRES_LEDGER_DATABASE: "medopl",
    MEDOPL_POSTGRES_LEDGER_USER: "medopl_ledger",
    MEDOPL_POSTGRES_LEDGER_PASSWORD: "db-password-proof",
    MEDOPL_POSTGRES_LEDGER_SSLMODE: "disable",
    MEDOPL_POSTGRES_LEDGER_SCHEMA: "public",
    ...overrides,
  };
  return Object.entries(entries).map(([key, value]) => `${key}=${value}`).join("\n");
}

function assertNoSensitiveOutput(text = "", label = "output") {
  for (const forbidden of [
    "db-password-proof",
    "postgres://",
    "postgresql://",
    "package-d",
    "KUBECONFIG",
    "SecretId",
    "SecretKey",
    "kubeconfig",
    "rawResponse",
  ]) {
    assert.equal(String(text).includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

function createFakeAdapter({ tableRows = [{ table_name: "resource_bindings" }, { table_name: "cloud_operations" }] } = {}) {
  const calls = [];
  return {
    calls,
    async connect(config) {
      calls.push({ method: "connect", config: { ...config, password: "[redacted]" } });
    },
    async query(sql, params = []) {
      calls.push({ method: "query", sql, params });
      if (sql.includes("SELECT 1 AS medopl_postgres_ledger_reachable")) {
        return { rows: [{ medopl_postgres_ledger_reachable: 1 }] };
      }
      if (sql.includes("information_schema.tables")) {
        return { rows: tableRows };
      }
      if (sql.includes("medopl_ledger_write_permission_probe")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
    async close() {
      calls.push({ method: "close" });
    },
  };
}

const missingEnv = validatePostgresLedgerEnv(parsePostgresLedgerEnv([
  "RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION=1",
  "MEDOPL_POSTGRES_LEDGER_HOST=127.0.0.1",
].join("\n")));
assert.equal(missingEnv.ok, false, "missing_db_env_must_fail_closed");
assert(missingEnv.missing.includes("MEDOPL_POSTGRES_LEDGER_PASSWORD"), "missing_password_must_be_reported");

const gateZero = validatePostgresLedgerEnv(parsePostgresLedgerEnv(baseEnv({
  RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION: "0",
})));
assert.equal(gateZero.ok, false, "run_gate_zero_must_fail_closed");
assert(gateZero.errors.includes("RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION_must_be_1"), "run_gate_zero_reason");

const forbidden = validatePostgresLedgerEnv(parsePostgresLedgerEnv(`${baseEnv()}\nKUBECONFIG=/tmp/proof\nTENCENT_MUTATION_SECRET_KEY=proof\nPACKAGE_D_DEPLOY_ENV=proof`));
assert.equal(forbidden.ok, false, "forbidden_env_must_fail_closed");
assert.deepEqual(forbidden.forbidden.sort(), [
  "KUBECONFIG",
  "PACKAGE_D_DEPLOY_ENV",
  "TENCENT_MUTATION_SECRET_KEY",
], "forbidden_keys_report");

const validConfig = validatePostgresLedgerEnv(parsePostgresLedgerEnv(baseEnv()));
assert.equal(validConfig.ok, true, "valid_env_must_pass_local_contract");
assert.equal(validConfig.config.executionGate, "1", "execution_gate");
assert.equal(validConfig.config.database, "medopl", "database_name");
assert.equal(validConfig.config.password, "db-password-proof", "raw_password_stays_internal");
const redacted = redactPostgresLedgerConfig(validConfig.config);
assert.equal(redacted.password, "[redacted]", "password_must_be_redacted");
assert.equal(redacted.connectionUrl, "[not-used]", "db_url_must_not_be_required");
assert.equal(JSON.stringify(redacted).includes("db-password-proof"), false, "redacted_config_must_not_include_password");

const driverAdapter = createPackageCPostgresDriverAdapter();
let missingDriverError = null;
try {
  await driverAdapter.connect(validConfig.config);
} catch (error) {
  missingDriverError = error;
}
assert.equal(missingDriverError?.message, "package_c_postgres_ledger_pg_driver_missing", "missing_pg_driver_must_fail_closed_without_fake_success");

const missingConfirmation = runCli(["--operation-id", "op-proof"]);
assert.notEqual(missingConfirmation.status, 0, "cli_must_require_prepare_only_confirmation");
assert(missingConfirmation.stderr.includes("package_c_postgres_ledger_prepare_only_confirmation_required"), "cli_missing_confirmation_reason");
assertNoSensitiveOutput(missingConfirmation.stdout + missingConfirmation.stderr, "cli_missing_confirmation_output");

const forbiddenCli = runCli(["--prepare-only", "--confirm-db-preflight-only", "--ledger-env-file", "/tmp/proof.env", "--operation-id", "op-proof", "--kubectl"]);
assert.notEqual(forbiddenCli.status, 0, "cli_must_reject_kubectl_arg");
assert(forbiddenCli.stderr.includes("package_c_postgres_ledger_forbidden_arg:--kubectl"), "cli_forbidden_arg_reason");

const adapter = createFakeAdapter();
const sink = createPackageCPostgresLedgerSink({ config: validConfig.config, adapter });
assert.equal(sink.mode, "postgres_execution");
assert.equal(sink.productionPostgresWrite, true);
await sink.preflight();
await sink.createResourceBinding({
  tenantId: "tenant-a",
  accountId: "account-a",
  workspaceId: "workspace-a",
  resourceBindingId: "rb-a",
  billingAttributionId: "ba-a",
  serverPlanId: "starter_2c4g_10gb",
  workspaceStorageGb: 10,
  cloudProvider: "tencent",
  region: "na-siliconvalley",
  clusterId: "cls-fi097sy4",
  nodePoolId: "",
  nodePoolName: "medopl-tenant-rb-a",
  status: "requested",
  createdAt: "2026-06-14T00:00:00.000Z",
  operationId: "op-a",
  canonicalOwnershipSource: "postgres_resource_binding_ledger",
  cloudTagSupport: "tke_nodepool_unsupported",
});
await sink.appendCloudOperationEvent({
  operationId: "op-a",
  resourceBindingId: "rb-a",
  tenantId: "tenant-a",
  accountId: "account-a",
  workspaceId: "workspace-a",
  billingAttributionId: "ba-a",
  operationType: "package_c_create_release_canary",
  serverPlanId: "starter_2c4g_10gb",
  workspaceStorageGb: 10,
  status: "requested",
  cloudProvider: "tencent",
  region: "na-siliconvalley",
  clusterId: "cls-fi097sy4",
  nodePoolId: "",
  nodePoolName: "medopl-tenant-rb-a",
  cloudTagSupport: "tke_nodepool_unsupported",
  canonicalOwnershipSource: "postgres_resource_binding_ledger",
  createdAt: "2026-06-14T00:00:00.000Z",
});
await sink.updateNodePoolId("rb-a", "np-tenant-a", "created");
await sink.updateLifecycleStatus("rb-a", "ready");
await sink.markReleased("rb-a", "2026-06-14T00:05:00.000Z");
await sink.markFailed("rb-a");
await sink.markCleanupRequired("rb-a");
await sink.close();

const sqlText = adapter.calls.map((call) => call.sql || "").join("\n");
assert(sqlText.includes("resource_bindings"), "resource_binding_insert_sql");
assert(sqlText.includes("cloud_operations"), "cloud_operation_upsert_sql");
assert(sqlText.includes("UPDATE"), "resource_binding_update_sql");
assert.equal(adapter.calls.some((call) => JSON.stringify(call).includes("np-cbk784r8")), false, "sink_must_not_write_protected_pool");
assertNoSensitiveOutput(JSON.stringify(adapter.calls), "adapter_calls");

const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-package-c-postgres-ledger-sink-"));
try {
  const reportDir = path.join(tmp, "reports");
  const envFile = path.join(tmp, "postgres-ledger.env");
  await writeFile(envFile, baseEnv());
  const prepareAdapter = createFakeAdapter();
  const prepareSummary = await runPackageCPostgresLedgerPrepareOnly({
    envFile,
    reportDir,
    operationId: "op-postgres-ledger-prepare-only-proof",
    adapter: prepareAdapter,
  });
  assert.equal(prepareSummary.ok, true, "prepare_only_ok");
  assert.equal(prepareSummary.mode, "postgres_ledger_prepare_only", "prepare_only_mode");
  assert.equal(prepareSummary.boundary.productionPostgresWrite, false, "prepare_only_must_not_claim_business_write");
  assert.equal(prepareSummary.boundary.validatesWritePermission, true, "prepare_only_write_permission_check");
  assert.equal(prepareSummary.redactionAudit.passwordRedacted, true, "prepare_only_password_redacted");
  assert.equal(prepareSummary.requiredTables.includes("resource_bindings"), true, "prepare_only_resource_bindings_table");
  assert.equal(prepareSummary.requiredTables.includes("cloud_operations"), true, "prepare_only_cloud_operations_table");
  assertNoSensitiveOutput(JSON.stringify(prepareSummary), "prepare_summary");
  const evidence = JSON.parse(await readFile(prepareSummary.summaryPath, "utf8"));
  assert.equal(evidence.ok, true, "prepare_evidence_ok");
  assertNoSensitiveOutput(JSON.stringify(evidence), "prepare_evidence");
  assert.equal(prepareAdapter.calls.some((call) => String(call.sql || "").includes("INSERT INTO resource_bindings")), false, "prepare_only_must_not_write_business_rows");

  const missingDriverSummary = await runPackageCPostgresLedgerPrepareOnly({
    envContent: baseEnv(),
    reportDir,
    operationId: "op-postgres-ledger-prepare-only-missing-driver-proof",
  });
  assert.equal(missingDriverSummary.ok, false, "prepare_only_without_driver_must_fail_closed");
  assert.equal(missingDriverSummary.failure.code, "package_c_postgres_ledger_pg_driver_missing", "prepare_only_missing_driver_reason");
  assertNoSensitiveOutput(JSON.stringify(missingDriverSummary), "missing_driver_summary");

  let forbiddenEnvFileError = null;
  try {
    await runPackageCPostgresLedgerPrepareOnly({
      envFile: path.join(tmp, "package-d-deploy.env"),
      reportDir,
      operationId: "op-postgres-ledger-forbidden-env-file-proof",
      adapter: createFakeAdapter(),
    });
  } catch (error) {
    forbiddenEnvFileError = error;
  }
  assert.equal(forbiddenEnvFileError?.message, "package_c_postgres_ledger_env_file_forbidden", "prepare_only_must_reject_package_d_env_file");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_package_c_postgres_ledger_sink_local_gate",
  canClaim: [
    "Package C PostgreSQL ledger sink has explicit execution gate",
    "prepare-only validates reachability/schema/write permission without business rows",
    "evidence redacts DB password and URL",
  ],
}, null, 2));
