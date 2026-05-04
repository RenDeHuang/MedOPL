import { appendFile, mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient as createRedisClient } from "redis";
import { createPortalStoreHealth } from "./portal-store-health.mjs";
import { createPortalStoreMigrations } from "./portal-store-migrations.mjs";
import { createPortalAccountingStore } from "./portal-accounting-store.mjs";
import { createPortalWorkspaceStore } from "./portal-workspace-store.mjs";
import { createPortalResourceOrderStore } from "./portal-resource-order-store.mjs";
import { createPortalLabBillingStore } from "./portal-lab-billing-store.mjs";
import { runPortalSchemaMigration } from "./portal-schema-migrator.mjs";
import { assertPortalSchemaReady } from "./portal-schema-health.mjs";
import {
  readPortalPostgresSnapshot,
  writePortalPostgresSnapshot,
} from "./portal-store-postgres-persistence.mjs";
import { createPortalStoreSchema } from "./portal-store-schema.mjs";
import {
  adminSeed,
  BILLING_SERVICE_URL,
  BUILD_SHA,
  BUILD_TIME,
  codexRuntimeEventsFile,
  codexRuntimeRoot,
  dataFile,
  eventsFile,
  HARBOR_URL,
  LANGFUSE_URL,
  medRunsRoot,
  medWorkspaceRoot,
  MINIO_API_URL,
  MINIO_CONSOLE_URL,
  OPENCOST_UI_URL,
  OPL_RUNTIME_MODE,
  OPL_RUNTIME_TIMEOUT_MS,
  OPL_WEB_URL,
  OPL_WEBUI_AUTH_MODE,
  PORTAL_ADMIN_SEED_BALANCE,
  PORTAL_DB_NAMESPACE,
  PORTAL_IDENTITY_SYNC_MODE,
  PORTAL_OIDC_ENABLED,
  PORTAL_OPL_ADAPTER_URL,
  PORTAL_POSTGRES_URL,
  PORTAL_PUBLIC_URL,
  PORTAL_REDIS_URL,
  PORTAL_STORAGE_MODE,
  runtimeRoot,
  TENCENT_BILLING_ENABLED,
  TENCENT_BILLING_REQUIRED,
} from "../config/portal-config.mjs";

export function createPortalStore({
  atomicWriteJson,
  exists,
  hashPassword,
  normalizeAnnouncementRecord,
  normalizeLedgerEntries,
  normalizeServerPlanSelection,
  ensureResourceOrderCollections,
  ensureLabSubscriptionCollections,
  ensureUserCommercialState,
  ensureWorkspaceStorageCollections,
  sanitizeTaskTitle,
  getTaskPath,
}) {
  let dbWriteChain = Promise.resolve();
  let pgPool = null;
  let redisClient = null;
  let storageInfraPromise = null;
  let accountingStore = null;
  let workspaceStore = null;
  let resourceOrderStore = null;
  let labBillingStore = null;
  const {
    initializePostgresSchema,
    pgTableName,
  } = createPortalStoreSchema({ namespace: PORTAL_DB_NAMESPACE });
  const {
    buildPortalHealthPayload: buildHealthPayload,
  } = createPortalStoreHealth({
    buildSha: BUILD_SHA,
    buildTime: BUILD_TIME,
    identity: {
      ssoMode: PORTAL_OIDC_ENABLED ? "oidc" : "local",
      identitySyncMode: PORTAL_IDENTITY_SYNC_MODE,
      oplWebAuthMode: OPL_WEBUI_AUTH_MODE,
    },
    billing: {
      mode: TENCENT_BILLING_ENABLED ? "tencent-cloud-billing" : "disabled",
      required: TENCENT_BILLING_REQUIRED,
      serviceUrl: BILLING_SERVICE_URL || null,
    },
    runtime: {
      portalPublicUrl: PORTAL_PUBLIC_URL || null,
      oplWebUrl: OPL_WEB_URL || null,
      portalAdapterUrl: PORTAL_OPL_ADAPTER_URL || null,
      oplRuntimeMode: OPL_RUNTIME_MODE,
      timeoutMs: OPL_RUNTIME_TIMEOUT_MS,
    },
    storage: {
      runtimeRoot,
      dataFile,
      eventsFile,
      medWorkspaceRoot,
      medRunsRoot,
      codexRuntimeRoot,
      codexRuntimeEventsFile,
    },
    links: {
      minioApiUrl: MINIO_API_URL || null,
      minioConsoleUrl: MINIO_CONSOLE_URL || null,
      opencostUiUrl: OPENCOST_UI_URL || null,
      harborUrl: HARBOR_URL || null,
      langfuseUrl: LANGFUSE_URL || null,
    },
  });
  const {
    buildSeedDb,
    migrateDb,
  } = createPortalStoreMigrations({
    adminSeed,
    adminSeedBalance: PORTAL_ADMIN_SEED_BALANCE,
    hashPassword,
    normalizeAnnouncementRecord,
    normalizeLedgerEntries,
    normalizeServerPlanSelection,
    ensureResourceOrderCollections,
    ensureLabSubscriptionCollections,
    ensureUserCommercialState,
    ensureWorkspaceStorageCollections,
    sanitizeTaskTitle,
    getTaskPath,
  });

  async function withDbWriteLock(task) {
    const run = dbWriteChain.then(task, task);
    dbWriteChain = run.catch(() => {});
    return run;
  }

  function storageMode() {
    return PORTAL_STORAGE_MODE === "postgres_redis" ? "postgres_redis" : "json";
  }

  function buildPortalHealthPayload() {
    return buildHealthPayload({ storageMode });
  }

  async function ensurePgPool() {
    if (!pgPool) {
      const { Pool } = pg;
      pgPool = new Pool({ connectionString: PORTAL_POSTGRES_URL });
    }
    return pgPool;
  }

  async function ensureRedis() {
    if (!redisClient) {
      redisClient = createRedisClient({ url: PORTAL_REDIS_URL });
      redisClient.on("error", (error) => console.error("portal redis error", error));
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
    }
    return redisClient;
  }

  function getAccountingStore() {
    if (!accountingStore) {
      if (!pgPool) {
        throw new Error("portal_accounting_store_requires_pg_pool");
      }
      accountingStore = createPortalAccountingStore({
        pool: pgPool,
        pgTableName,
        randomUUID,
      });
    }
    return accountingStore;
  }

  function getWorkspaceStore() {
    if (!workspaceStore) {
      if (!pgPool) {
        throw new Error("portal_workspace_store_requires_pg_pool");
      }
      workspaceStore = createPortalWorkspaceStore({
        pool: pgPool,
        pgTableName,
      });
    }
    return workspaceStore;
  }

  function getResourceOrderStore() {
    if (!resourceOrderStore) {
      if (!pgPool) {
        throw new Error("portal_resource_order_store_requires_pg_pool");
      }
      resourceOrderStore = createPortalResourceOrderStore({
        pool: pgPool,
        pgTableName,
      });
    }
    return resourceOrderStore;
  }

  function getLabBillingStore() {
    if (!labBillingStore) {
      if (!pgPool) {
        throw new Error("portal_lab_billing_store_requires_pg_pool");
      }
      labBillingStore = createPortalLabBillingStore({
        pool: pgPool,
        pgTableName,
      });
    }
    return labBillingStore;
  }

  async function ensureJsonDb() {
    await mkdir(runtimeRoot, { recursive: true });
    await mkdir(medWorkspaceRoot, { recursive: true });
    await mkdir(medRunsRoot, { recursive: true });
    if (await exists(dataFile)) return;
    const adminId = randomUUID();
    const seed = {
      users: [
        {
          id: adminId,
          email: adminSeed.email,
          name: adminSeed.name,
          role: "admin",
          status: "active",
          currentTaskSlug: "default",
          preferences: { theme: "light" },
          passwordHash: hashPassword(adminSeed.password),
          createdAt: new Date().toISOString(),
        },
      ],
      sessions: [],
      wallets: [{ userId: adminId, balance: PORTAL_ADMIN_SEED_BALANCE, updatedAt: new Date().toISOString() }],
      ledger: [],
      taskSpaces: [],
      workspaceSessions: [],
      resourceOrders: [],
      resourceOrderEvents: [],
      storageOrders: [],
      workspaceFiles: [],
      labSubscriptions: [],
      labPackageEvents: [],
      labStorageAddons: [],
      labDailyCharges: [],
      userSandboxes: [],
      groups: [],
      settings: {
        allowRegistration: String(process.env.PORTAL_ALLOW_REGISTRATION || "1") !== "0",
        announcements: [],
      },
    };
    await atomicWriteJson(dataFile, seed);
  }

  async function ensureStorageInfra() {
    if (!storageInfraPromise) {
      storageInfraPromise = initializeStorageInfra().catch((error) => {
        storageInfraPromise = null;
        throw error;
      });
    }
    return storageInfraPromise;
  }

  async function initializeStorageInfra() {
    await mkdir(runtimeRoot, { recursive: true });
    await mkdir(medWorkspaceRoot, { recursive: true });
    await mkdir(medRunsRoot, { recursive: true });
    if (storageMode() === "json") {
      await ensureJsonDb();
      return;
    }
    const pool = await ensurePgPool();
    await ensureRedis();
    await assertPortalSchemaReady({
      pool,
      pgTableName,
      targetVersion: "v20.32",
    });
    getAccountingStore();
    getWorkspaceStore();
    getResourceOrderStore();
    getLabBillingStore();
  }

  async function migrateLegacyAuditEvents(pool) {
    if (!(await exists(eventsFile))) return;
    const rawEvents = await readFile(eventsFile, "utf8");
    const lines = rawEvents.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        await pool.query(`INSERT INTO ${pgTableName("audit_events")} (id,type,user_id,operator_id,workspace_id,run_id,detail_json,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
          randomUUID(),
          String(event.type || ""),
          String(event.userId || ""),
          String(event.operatorId || ""),
          String(event.workspaceId || ""),
          String(event.runId || ""),
          JSON.stringify(event),
          String(event.occurredAt || new Date().toISOString()),
        ]);
      } catch {}
    }
  }

  async function readJsonDb() {
    let raw = await readFile(dataFile, "utf8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await dbWriteChain.catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 80));
      raw = await readFile(dataFile, "utf8");
      parsed = JSON.parse(raw);
    }
    const { db, changed } = await migrateDb(parsed);
    if (changed) await withDbWriteLock(() => atomicWriteJson(dataFile, db));
    return db;
  }

  async function seedPostgresIfEmpty(pool) {
    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM ${pgTableName("users")}`);
    if (Number(countRes.rows[0]?.count || 0)) return;
    let seed;
    let migrateEvents = false;
    if (await exists(dataFile)) {
      seed = JSON.parse(await readFile(dataFile, "utf8"));
      seed = (await migrateDb(seed)).db;
      migrateEvents = await exists(eventsFile);
    } else {
      seed = buildSeedDb();
    }
    await writeDb(seed);
    if (migrateEvents) {
      await migrateLegacyAuditEvents(pool);
    }
  }

  async function readDb() {
    await ensureStorageInfra();
    await dbWriteChain.catch(() => {});
    if (storageMode() === "json") {
      return readJsonDb();
    }
    const pool = await ensurePgPool();
    const redis = await ensureRedis();
    await seedPostgresIfEmpty(pool);
    const db = await readPortalPostgresSnapshot({
      pool,
      redis,
      pgTableName,
      namespace: PORTAL_DB_NAMESPACE,
      normalizeServerPlanSelection,
    });
    const { db: migrated, changed } = await migrateDb(db);
    if (changed) {
      await writeDb(migrated);
    }
    return migrated;
  }

  async function readAuthDb() {
    await ensureStorageInfra();
    if (storageMode() === "json") {
      return readJsonDb();
    }
    const pool = await ensurePgPool();
    const redis = await ensureRedis();
    await seedPostgresIfEmpty(pool);
    const [usersRes, settingsRes] = await Promise.all([
      pool.query(`SELECT id,email,name,role,status,password_hash,current_task_slug,group_id,preferences_json,created_at FROM ${pgTableName("users")}`),
      pool.query(`SELECT key,value_json FROM ${pgTableName("portal_settings")}`),
    ]);
    const sessionKeys = await redis.keys(`${PORTAL_DB_NAMESPACE}:session:*`);
    const sessionValues = sessionKeys.length ? await redis.mGet(sessionKeys) : [];
    const sessions = sessionValues.map((value) => {
      try {
        return JSON.parse(String(value || ""));
      } catch {
        return null;
      }
    }).filter((value) => value && typeof value === "object");
    return {
      users: usersRes.rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        status: row.status,
        passwordHash: row.password_hash,
        currentTaskSlug: row.current_task_slug,
        groupId: row.group_id,
        preferences: row.preferences_json || { theme: "light" },
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      })),
      sessions,
      wallets: [],
      taskSpaces: [],
      workspaceSessions: [],
      resourceOrders: [],
      resourceOrderEvents: [],
      storageOrders: [],
      workspaceFiles: [],
      labSubscriptions: [],
      labPackageEvents: [],
      labStorageAddons: [],
      labDailyCharges: [],
      userSandboxes: [],
      groups: [],
      settings: Object.fromEntries(settingsRes.rows.map((row) => [row.key, row.value_json])),
    };
  }

  async function writeDb(db) {
    await withDbWriteLock(async () => {
      if (storageMode() === "json") {
        await atomicWriteJson(dataFile, db);
        return;
      }
      const pool = await ensurePgPool();
      const redis = await ensureRedis();
      await writePortalPostgresSnapshot({
        pool,
        redis,
        pgTableName,
        namespace: PORTAL_DB_NAMESPACE,
        db,
        normalizeLedgerEntries,
        normalizeServerPlanSelection,
        atomicWriteJson,
        dataFile,
      });
    });
  }

  async function persistPortalSessions(db) {
    await ensureStorageInfra();
    if (storageMode() === "json") {
      await writeDb(db);
      return;
    }
    const redis = await ensureRedis();
    for (const session of db.sessions || []) {
      if (!session?.id) continue;
      await redis.set(`${PORTAL_DB_NAMESPACE}:session:${session.id}`, JSON.stringify(session), { EX: 7 * 24 * 60 * 60 });
    }
  }

  async function logPortalEvent(event) {
    const payload = { occurredAt: new Date().toISOString(), ...event };
    await mkdir(runtimeRoot, { recursive: true });
    await appendFile(eventsFile, `${JSON.stringify(payload)}\n`, "utf8");
    if (storageMode() === "postgres_redis") {
      const pool = await ensurePgPool();
      await pool.query(`INSERT INTO ${pgTableName("audit_events")} (id,type,user_id,operator_id,workspace_id,run_id,detail_json,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
        randomUUID(),
        String(event.type || ""),
        String(event.userId || ""),
        String(event.operatorId || ""),
        String(event.workspaceId || ""),
        String(event.runId || ""),
        JSON.stringify(event),
        payload.occurredAt,
      ]);
    }
  }

  async function topupWallet(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      throw new Error("portal_accounting_store_unavailable_for_storage_mode");
    }
    return getAccountingStore().topupWallet(params);
  }

  async function refundWallet(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      throw new Error("portal_accounting_store_unavailable_for_storage_mode");
    }
    return getAccountingStore().refundWallet(params);
  }

  async function makeupChargeWallet(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      throw new Error("portal_accounting_store_unavailable_for_storage_mode");
    }
    return getAccountingStore().makeupChargeWallet(params);
  }

  async function upsertWorkspaceFile(params) {
    await ensureStorageInfra();
    return getWorkspaceStore().upsertWorkspaceFile(params);
  }

  async function upsertStorageOrder(params) {
    await ensureStorageInfra();
    return getWorkspaceStore().upsertStorageOrder(params);
  }

  async function upsertTaskSpace(params) {
    await ensureStorageInfra();
    return getWorkspaceStore().upsertTaskSpace(params);
  }

  async function persistResourceOrderState(params) {
    await ensureStorageInfra();
    if (storageMode() === "postgres_redis") {
      return getResourceOrderStore().persistResourceOrderState(params);
    }
    return writeDb(params?.db || {});
  }

  async function persistLabBillingState(params) {
    await ensureStorageInfra();
    if (storageMode() !== "postgres_redis") {
      throw new Error("portal_lab_billing_store_unavailable_for_storage_mode");
    }
    return getLabBillingStore().persistLabBillingState(params);
  }

  async function migratePortalSchema() {
    const pool = await ensurePgPool();
    return runPortalSchemaMigration({
      pool,
      initializePostgresSchema,
      pgTableName,
      targetVersion: "v20.32",
    });
  }

  writeDb.topupWallet = topupWallet;
  writeDb.refundWallet = refundWallet;
  writeDb.makeupChargeWallet = makeupChargeWallet;
  writeDb.persistPortalSessions = persistPortalSessions;
  if (storageMode() === "postgres_redis") {
    writeDb.upsertStorageOrder = upsertStorageOrder;
    writeDb.upsertTaskSpace = upsertTaskSpace;
    writeDb.upsertWorkspaceFile = upsertWorkspaceFile;
    writeDb.persistResourceOrderState = persistResourceOrderState;
    writeDb.persistLabBillingState = persistLabBillingState;
  }

  async function readPortalEvents(limit = 120) {
    if (storageMode() === "postgres_redis") {
      const pool = await ensurePgPool();
      const result = await pool.query(`SELECT * FROM ${pgTableName("audit_events")} ORDER BY occurred_at DESC LIMIT $1`, [limit]);
      return result.rows.map((row) => ({
        occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
        type: row.type,
        userId: row.user_id,
        operatorId: row.operator_id,
        workspaceId: row.workspace_id,
        runId: row.run_id,
        ...row.detail_json,
      }));
    }
    if (!(await exists(eventsFile))) return [];
    const raw = await readFile(eventsFile, "utf8");
    return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-limit).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean).reverse();
  }

  return {
    buildPortalHealthPayload,
    ensureStorageInfra,
    logPortalEvent,
    migratePortalSchema,
    readAuthDb,
    readDb,
    readPortalEvents,
    storageMode,
    persistLabBillingState,
    persistResourceOrderState,
    refundWallet,
    makeupChargeWallet,
    topupWallet,
    upsertStorageOrder,
    upsertTaskSpace,
    upsertWorkspaceFile,
    writeDb,
  };
}
