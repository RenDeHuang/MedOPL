import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const migrateEntrypoint = path.join(repoRoot, "services", "portal", "src", "migrate-schema.mjs");
const schemaEntrypoint = path.join(repoRoot, "services", "portal", "src", "state", "portal-store-schema.mjs");
const schemaHealthEntrypoint = path.join(repoRoot, "services", "portal", "src", "state", "portal-schema-health.mjs");
const schemaMigratorEntrypoint = path.join(repoRoot, "services", "portal", "src", "state", "portal-schema-migrator.mjs");
const runtimeSuiteEntrypoint = path.join(repoRoot, "scripts", "smoke-test-v22-portal-runtime-suite.mjs");
const adminEmail = "zitadel-admin@zitadel.localhost";
const adminPassword = "Password1!";
const userEmail = "portal-storage-mode-user@example.test";
const userPassword = "Password123!";

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function withRuntime(fn) {
  const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-storage-mode-"));
  try {
    return await fn(runtimeRoot);
  } finally {
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
  }
}

function cookieHeaderFrom(response, name) {
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  assert(match, `${name}_cookie_required`);
  assert(setCookie.includes("HttpOnly"), `${name}_cookie_must_be_http_only`);
  return `${name}=${match[1]}`;
}

async function waitFor(url, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    assert.equal(child.exitCode, null, `portal_process_exited:${child.exitCode}`);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0 && response.status < 500) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    sleep(1500).then(() => false),
  ]);
  if (!exited) child.kill("SIGKILL");
}

async function postForm(url, form, { cookie = "" } = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(form).toString(),
    redirect: "manual",
  });
}

async function postJson(url, payload, { cookie = "" } = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
    redirect: "manual",
  });
}

async function getJson(url, { cookie = "" } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
    },
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function queryPostgres({ postgresUrl, sql, values = [] }) {
  const pg = await import("pg");
  const { Pool } = pg.default;
  const pool = new Pool({ connectionString: postgresUrl });
  try {
    return await pool.query(sql, values);
  } finally {
    await pool.end();
  }
}

async function login(baseUrl, email, password) {
  const response = await postForm(`${baseUrl}/login`, { email, password });
  assert.equal(response.status, 302, `login_must_redirect:${email}`);
  return cookieHeaderFrom(response, "portal_session");
}

function firstNonAdminUser(usersPayload) {
  return (usersPayload.items || []).find((item) => item.role !== "admin" && item.email === userEmail);
}

function balanceFor(usersPayload, userId) {
  const user = (usersPayload.items || []).find((item) => item.id === userId);
  assert(user, `admin_user_missing:${userId}`);
  return Number(user.balance || 0);
}

function auditContains(auditPayload, pattern) {
  return (auditPayload.items || []).some((item) => JSON.stringify(item).includes(pattern));
}

async function assertRepoStorageContracts() {
  const [schemaSource, schemaHealthSource, schemaMigratorSource, runtimeSuiteSource] = await Promise.all([
    readFile(schemaEntrypoint, "utf8"),
    readFile(schemaHealthEntrypoint, "utf8"),
    readFile(schemaMigratorEntrypoint, "utf8"),
    readFile(runtimeSuiteEntrypoint, "utf8"),
  ]);
  for (const indexName of [
    "ledger_entries_idempotency_key_uidx",
    "lab_subscriptions_idempotency_key_uidx",
    "lab_package_events_idempotency_key_uidx",
    "lab_storage_addons_idempotency_key_uidx",
    "lab_daily_charges_idempotency_key_uidx",
  ]) {
    assert(schemaSource.includes(indexName), `schema_unique_index_required:${indexName}`);
  }
  assert(schemaMigratorSource.includes("BEGIN"), "schema_migration_must_begin_transaction");
  assert(schemaMigratorSource.includes("COMMIT"), "schema_migration_must_commit_transaction");
  assert(schemaMigratorSource.includes("ROLLBACK"), "schema_migration_must_rollback_transaction");
  assert(!schemaHealthSource.includes("portal_pg_connection_required:"), "schema_health_must_not_expose_raw_pg_error_message");
  assert(!schemaMigratorSource.includes("portal_pg_connection_required:"), "schema_migrator_must_not_expose_raw_pg_error_message");
  assert(runtimeSuiteSource.includes("smoke-test-v22-portal-storage-mode-local-closure.mjs"), "runtime_suite_must_include_storage_mode_smoke");
}

function spawnNode(entrypoint, env) {
  const child = spawn(process.execPath, [entrypoint], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-12000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-12000);
  });
  return { child, readOutput: () => ({ stdout, stderr }) };
}

async function runNodeOnce(entrypoint, env) {
  const { child, readOutput } = spawnNode(entrypoint, env);
  const code = await new Promise((resolve) => child.once("exit", resolve));
  return { code, ...readOutput() };
}

async function ensurePortReachable(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function canRunPostgresRedisPositiveClosure({ runtimeRoot, postgresUrl, redisUrl }) {
  const migrateResult = await runNodeOnce(migrateEntrypoint, {
    NODE_ENV: "test",
    PORTAL_RUNTIME_ROOT: runtimeRoot,
    PORTAL_STORAGE_MODE: "postgres_redis",
    PORTAL_OIDC_ENABLED: "0",
    PORTAL_IDENTITY_SYNC_MODE: "local",
    PORTAL_ALLOW_REGISTRATION: "1",
    PORTAL_ADMIN_EMAIL: adminEmail,
    PORTAL_ADMIN_PASSWORD: adminPassword,
    PORTAL_ADMIN_NAME: "Portal Admin",
    PORTAL_POSTGRES_URL: postgresUrl,
    PORTAL_REDIS_URL: redisUrl,
  });
  if (migrateResult.code === 0) return true;
  assert.match(
    `${migrateResult.stdout}\n${migrateResult.stderr}`,
    /portal_pg_connection_required|portal_redis_connection_required|portal_schema_not_ready|ECONNREFUSED|Connection terminated unexpectedly/i,
    "postgres_redis_unavailable_must_fail_closed_with_known_reason",
  );
  return false;
}

async function runClosureSuite({
  runtimeRoot,
  storageMode,
  postgresUrl = "",
  redisUrl = "",
  migrateSchema = false,
}) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const commonEnv = {
    NODE_ENV: "test",
    PORT: String(port),
    PORTAL_RUNTIME_ROOT: runtimeRoot,
    PORTAL_STORAGE_MODE: storageMode,
    PORTAL_OIDC_ENABLED: "0",
    PORTAL_IDENTITY_SYNC_MODE: "local",
    PORTAL_ALLOW_REGISTRATION: "1",
    PORTAL_ADMIN_EMAIL: adminEmail,
    PORTAL_ADMIN_PASSWORD: adminPassword,
    PORTAL_ADMIN_NAME: "Portal Admin",
  };
  if (postgresUrl) commonEnv.PORTAL_POSTGRES_URL = postgresUrl;
  if (redisUrl) commonEnv.PORTAL_REDIS_URL = redisUrl;

  if (migrateSchema) {
    const migrateResult = await runNodeOnce(migrateEntrypoint, commonEnv);
    assert.equal(migrateResult.code, 0, `portal_schema_migration_must_succeed:${migrateResult.stderr || migrateResult.stdout}`);
  }

  const { child: portal, readOutput } = spawnNode(portalEntrypoint, commonEnv);
  try {
    await waitFor(`${baseUrl}/healthz`, portal);

    const adminCookie = await login(baseUrl, adminEmail, adminPassword);
    const createUser = await postForm(`${baseUrl}/portal/admin/create-user`, {
      name: "Portal Storage Mode User",
      email: userEmail,
      password: userPassword,
      redirectTo: "/admin/users",
    }, { cookie: adminCookie });
    assert.equal(createUser.status, 302, "admin_create_user_must_redirect");

    const usersAfterCreate = await getJson(`${baseUrl}/portal/api/admin/users`, { cookie: adminCookie });
    assert.equal(usersAfterCreate.response.status, 200, "admin_users_after_create_must_return_200");
    const targetUser = firstNonAdminUser(usersAfterCreate.json);
    assert(targetUser?.id, "created_user_must_appear_in_admin_users_api");
    assert.equal(balanceFor(usersAfterCreate.json, targetUser.id), 0, "created_user_balance_must_start_zero");

    const recharge = await postForm(`${baseUrl}/portal/admin/recharge`, {
      userId: targetUser.id,
      amount: "120",
      redirectTo: "/admin/users",
      idempotencyKey: `${storageMode}-recharge-user-120`,
    }, { cookie: adminCookie });
    assert.equal(recharge.status, 302, "admin_recharge_must_redirect");

    const replayRecharge = await postForm(`${baseUrl}/portal/admin/recharge`, {
      userId: targetUser.id,
      amount: "120",
      redirectTo: "/admin/users",
      idempotencyKey: `${storageMode}-recharge-user-120`,
    }, { cookie: adminCookie });
    assert.equal(replayRecharge.status, 302, "admin_recharge_replay_must_redirect");

    const refund = await postForm(`${baseUrl}/portal/admin/ledger-adjust`, {
      userId: targetUser.id,
      actionType: "refund",
      amount: "30",
      reason: "storage mode closure smoke",
      redirectTo: "/admin/users",
      idempotencyKey: `${storageMode}-refund-user-30`,
    }, { cookie: adminCookie });
    assert.equal(refund.status, 302, "admin_refund_must_redirect");

    const replayRefund = await postForm(`${baseUrl}/portal/admin/ledger-adjust`, {
      userId: targetUser.id,
      actionType: "refund",
      amount: "30",
      reason: "storage mode closure smoke",
      redirectTo: "/admin/users",
      idempotencyKey: `${storageMode}-refund-user-30`,
    }, { cookie: adminCookie });
    assert.equal(replayRefund.status, 302, "admin_refund_replay_must_redirect");

    const usersAfterLedgerReplay = await getJson(`${baseUrl}/portal/api/admin/users`, { cookie: adminCookie });
    assert.equal(balanceFor(usersAfterLedgerReplay.json, targetUser.id), 150, "ledger_idempotency_replay_must_not_duplicate_balance");

    const saveAnnouncement = await postForm(`${baseUrl}/portal/admin/announcements/save`, {
      title: `${storageMode}-公告`,
      content: "公告保存、发布、删除必须能被 API 读回。",
      status: "inactive",
      pinned: "0",
      redirectTo: "/admin/alerts",
    }, { cookie: adminCookie });
    assert.equal(saveAnnouncement.status, 302, "announcement_save_must_redirect");

    const announcementsAfterSave = await getJson(`${baseUrl}/portal/api/announcements?mode=all`, { cookie: adminCookie });
    const savedAnnouncement = (announcementsAfterSave.json.items || []).find((item) => item.title === `${storageMode}-公告`);
    assert(savedAnnouncement?.id, "announcement_save_must_be_visible_in_api");

    const publishAnnouncement = await postForm(`${baseUrl}/portal/admin/announcements/toggle`, {
      id: savedAnnouncement.id,
      actionType: "activate",
      redirectTo: "/admin/alerts",
    }, { cookie: adminCookie });
    assert.equal(publishAnnouncement.status, 302, "announcement_publish_must_redirect");

    const userCookie = await login(baseUrl, userEmail, userPassword);
    const activatePackage = await postJson(`${baseUrl}/portal/api/lab-packages/activate`, {
      packageId: "starter_2c4g_10gb",
      workspaceId: "default",
      idempotencyKey: `${storageMode}-lab-package-activate`,
    }, { cookie: userCookie });
    assert.equal(activatePackage.status, 201, "lab_package_activate_must_create_subscription");

    const replayActivatePackage = await postJson(`${baseUrl}/portal/api/lab-packages/activate`, {
      packageId: "starter_2c4g_10gb",
      workspaceId: "default",
      idempotencyKey: `${storageMode}-lab-package-activate`,
    }, { cookie: userCookie });
    assert.ok([200, 201].includes(replayActivatePackage.status), "lab_package_activate_replay_must_return_success");

    const subscription = await getJson(`${baseUrl}/portal/api/lab-subscription?workspaceId=default`, { cookie: userCookie });
    assert.equal(subscription.response.status, 200, "lab_subscription_must_return_200");
    assert.equal(subscription.json.currentPackageId, "starter_2c4g_10gb", "lab_subscription_must_reflect_activation");

    const audit = await getJson(`${baseUrl}/portal/api/admin/audit`, { cookie: adminCookie });
    assert.equal(audit.response.status, 200, "admin_audit_must_return_200");
    assert(auditContains(audit.json, "ledger_adjusted"), "audit_must_contain_ledger_adjusted");

    return {
      adminCookie,
      announcementId: savedAnnouncement.id,
      baseUrl,
      port,
      targetUserId: targetUser.id,
    };
  } catch (error) {
    const output = readOutput();
    error.message = `${error.message}\nstdout:\n${output.stdout}\nstderr:\n${output.stderr}`;
    throw error;
  } finally {
    await stopChild(portal);
  }
}

async function verifyPersistedState({
  runtimeRoot,
  storageMode,
  postgresUrl = "",
  redisUrl = "",
  announcementId = "",
  targetUserId = "",
}) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(port),
    PORTAL_RUNTIME_ROOT: runtimeRoot,
    PORTAL_STORAGE_MODE: storageMode,
    PORTAL_OIDC_ENABLED: "0",
    PORTAL_IDENTITY_SYNC_MODE: "local",
    PORTAL_ALLOW_REGISTRATION: "1",
    PORTAL_ADMIN_EMAIL: adminEmail,
    PORTAL_ADMIN_PASSWORD: adminPassword,
    PORTAL_ADMIN_NAME: "Portal Admin",
  };
  if (postgresUrl) env.PORTAL_POSTGRES_URL = postgresUrl;
  if (redisUrl) env.PORTAL_REDIS_URL = redisUrl;

  const { child: portal, readOutput } = spawnNode(portalEntrypoint, env);
  try {
    await waitFor(`${baseUrl}/healthz`, portal);
    const adminCookie = await login(baseUrl, adminEmail, adminPassword);
    const userCookie = await login(baseUrl, userEmail, userPassword);

    const users = await getJson(`${baseUrl}/portal/api/admin/users`, { cookie: adminCookie });
    assert.equal(balanceFor(users.json, targetUserId), 150, "persisted_balance_must_survive_restart");

    const announcements = await getJson(`${baseUrl}/portal/api/announcements?mode=all`, { cookie: adminCookie });
    const announcement = (announcements.json.items || []).find((item) => item.id === announcementId);
    assert(announcement, "persisted_announcement_must_survive_restart");
    assert.equal(announcement.status, "active", "persisted_announcement_status_mismatch");

    const subscription = await getJson(`${baseUrl}/portal/api/lab-subscription?workspaceId=default`, { cookie: userCookie });
    assert.equal(subscription.json.currentPackageId, "starter_2c4g_10gb", "persisted_subscription_must_survive_restart");

    const audit = await getJson(`${baseUrl}/portal/api/admin/audit`, { cookie: adminCookie });
    assert(auditContains(audit.json, "ledger_adjusted"), "persisted_audit_must_survive_restart");
  } catch (error) {
    const output = readOutput();
    error.message = `${error.message}\nstdout:\n${output.stdout}\nstderr:\n${output.stderr}`;
    throw error;
  } finally {
    await stopChild(portal);
  }
}

async function expectFailClosedWithoutSchema({ runtimeRoot, postgresUrl, redisUrl }) {
  const port = await freePort();
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(port),
    PORTAL_RUNTIME_ROOT: runtimeRoot,
    PORTAL_STORAGE_MODE: "postgres_redis",
    PORTAL_POSTGRES_URL: postgresUrl,
    PORTAL_REDIS_URL: redisUrl,
    PORTAL_OIDC_ENABLED: "0",
    PORTAL_IDENTITY_SYNC_MODE: "local",
    PORTAL_ALLOW_REGISTRATION: "1",
    PORTAL_ADMIN_EMAIL: adminEmail,
    PORTAL_ADMIN_PASSWORD: adminPassword,
    PORTAL_ADMIN_NAME: "Portal Admin",
  };
  const { child, readOutput } = spawnNode(portalEntrypoint, env);
  const code = await new Promise((resolve) => child.once("exit", resolve));
  const { stdout, stderr } = readOutput();
  assert.notEqual(code, 0, "postgres_redis_without_schema_must_fail_closed");
  assert.match(`${stdout}\n${stderr}`, /portal_schema_not_ready|portal_schema_missing_tables|portal_pg_connection_required|portal_redis_connection_required/, "postgres_redis_fail_closed_message_mismatch");
}

async function expectFailClosedWithoutConnections({ runtimeRoot }) {
  const migrate = await runNodeOnce(migrateEntrypoint, {
    NODE_ENV: "test",
    PORTAL_RUNTIME_ROOT: runtimeRoot,
    PORTAL_STORAGE_MODE: "postgres_redis",
    PORTAL_OIDC_ENABLED: "0",
    PORTAL_IDENTITY_SYNC_MODE: "local",
    PORTAL_ALLOW_REGISTRATION: "1",
    PORTAL_ADMIN_EMAIL: adminEmail,
    PORTAL_ADMIN_PASSWORD: adminPassword,
    PORTAL_ADMIN_NAME: "Portal Admin",
    PORTAL_POSTGRES_URL: "",
    PORTAL_REDIS_URL: "",
  });
  assert.notEqual(migrate.code, 0, "postgres_redis_missing_connections_must_fail_closed");
  assert.match(`${migrate.stdout}\n${migrate.stderr}`, /portal_pg_connection_required|portal_redis_connection_required|ERR_INVALID_URL/, "missing_connection_error_message_mismatch");
}

await assertRepoStorageContracts();

const postgresReachable = await ensurePortReachable(5432);
const redisReachable = await ensurePortReachable(6379);
const localPostgresUrl = String(process.env.PORTAL_POSTGRES_URL || "postgres://postgres:postgres@127.0.0.1:5432/med_meta");
const localRedisUrl = String(process.env.PORTAL_REDIS_URL || "redis://127.0.0.1:6379");

await withRuntime(async (runtimeRoot) => {
  await runClosureSuite({ runtimeRoot, storageMode: "json" }).then((state) =>
    verifyPersistedState({
      runtimeRoot,
      storageMode: "json",
      announcementId: state.announcementId,
      targetUserId: state.targetUserId,
    }));
});

await withRuntime(async (runtimeRoot) => {
  await expectFailClosedWithoutConnections({ runtimeRoot });
});

await withRuntime(async (runtimeRoot) => {
  if (postgresReachable && redisReachable) {
    await expectFailClosedWithoutSchema({
      runtimeRoot,
      postgresUrl: localPostgresUrl,
      redisUrl: localRedisUrl,
    });
    const localPositiveAvailable = await canRunPostgresRedisPositiveClosure({
      runtimeRoot,
      postgresUrl: localPostgresUrl,
      redisUrl: localRedisUrl,
    });
    if (!localPositiveAvailable) return;
    const state = await runClosureSuite({
      runtimeRoot,
      storageMode: "postgres_redis",
      postgresUrl: localPostgresUrl,
      redisUrl: localRedisUrl,
      migrateSchema: false,
    });
    await verifyPersistedState({
      runtimeRoot,
      storageMode: "postgres_redis",
      postgresUrl: localPostgresUrl,
      redisUrl: localRedisUrl,
      announcementId: state.announcementId,
      targetUserId: state.targetUserId,
    });
    const indexResult = await queryPostgres({
      postgresUrl: localPostgresUrl,
      sql: `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'portal_ledger_entries_idempotency_key_uidx',
            'portal_lab_subscriptions_idempotency_key_uidx',
            'portal_lab_package_events_idempotency_key_uidx',
            'portal_lab_storage_addons_idempotency_key_uidx',
            'portal_lab_daily_charges_idempotency_key_uidx'
          )
      `,
    });
    assert.equal(indexResult.rows.length, 5, "postgres_idempotency_unique_indexes_required");
  }
});

const runtimeData = await withRuntime(async (runtimeRoot) => {
  await runClosureSuite({ runtimeRoot, storageMode: "json" });
  return JSON.parse(await readFile(path.join(runtimeRoot, "portal-db.json"), "utf8"));
});
assert.equal(Array.isArray(runtimeData.ledger), true, "json_runtime_db_must_contain_ledger_array");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_storage_mode_local_closure",
  checked: [
    "json_mode_admin_action_closure",
    "json_mode_idempotency_replay",
    "json_mode_restart_persistence",
    "postgres_redis_missing_connection_fail_closed",
    ...(postgresReachable && redisReachable ? [
      "postgres_redis_schema_fail_closed",
      "postgres_redis_local_admin_action_closure",
      "postgres_redis_idempotency_replay",
      "postgres_redis_idempotency_unique_indexes",
      "postgres_redis_restart_persistence",
    ] : []),
  ],
  localServices: {
    postgres: postgresReachable,
    redis: redisReachable,
  },
}, null, 2));
