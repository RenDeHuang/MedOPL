import { mkdir, readFile, appendFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { createClient as createRedisClient } from "redis";
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
const VALID_WORKSPACE_SESSION_STATUSES = new Set(["active", "revoked", "archived", "deleted", "deleting"]);
function safeJsonParse(raw) {
  try {
    return JSON.parse(String(raw || ""));
  } catch {
    return null;
  }
}
function isValidDateValue(value) {
  if (!value) return true;
  return !Number.isNaN(Date.parse(String(value)));
}
function normalizeWorkspaceSessionValue(session) {
  if (!session || typeof session !== "object") return null;
  const id = String(session.id || "").trim();
  const userId = String(session.userId || "").trim();
  const workspaceId = String(session.workspaceId || "").trim();
  const status = String(session.status || "").trim().toLowerCase();
  const createdAt = String(session.createdAt || "").trim();
  const lastUsedAt = String(session.lastUsedAt || "").trim();
  const expiresAt = String(session.expiresAt || "").trim();
  if (!id || !userId || !workspaceId || !VALID_WORKSPACE_SESSION_STATUSES.has(status)) return null;
  if (!isValidDateValue(createdAt) || !isValidDateValue(lastUsedAt) || !isValidDateValue(expiresAt)) return null;
  return {
    id,
    userId,
    workspaceId,
    workspaceTitle: String(session.workspaceTitle || workspaceId).trim() || workspaceId,
    sessionType: String(session.sessionType || "opl_session").trim() || "opl_session",
    status,
    source: String(session.source || "portal-workspace-entry").trim() || "portal-workspace-entry",
    createdAt: createdAt || new Date().toISOString(),
    lastUsedAt: lastUsedAt || createdAt || new Date().toISOString(),
    expiresAt: expiresAt || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  };
}
function serializeWorkspaceSessionValue(session) {
  const normalized = normalizeWorkspaceSessionValue(session);
  if (!normalized) {
    throw new Error("workspace_session_invalid");
  }
  return JSON.stringify(normalized);
}
async function quarantineWorkspaceSessionRedisValue(redis, key, raw, reason) {
  const suffix = String(key || "").split(":").pop() || randomUUID();
  console.warn("workspace_session quarantined", { key, reason });
  await redis.set(`${PORTAL_DB_NAMESPACE}:quarantine:workspace_session:${suffix}`, JSON.stringify({
    key,
    raw: String(raw || ""),
    reason,
    quarantinedAt: new Date().toISOString(),
  }), { EX: 7 * 24 * 60 * 60 }).catch(() => {});
  if (key) {
    await redis.del(key).catch(() => {});
  }
}
export function createPortalStore({
  atomicWriteJson,
  exists,
  hashPassword,
  normalizeAnnouncementRecord,
  normalizeLedgerEntries,
  normalizeServerPlanSelection,
  ensureResourceOrderCollections,
  ensureUserCommercialState,
  ensureWorkspaceStorageCollections,
  sanitizeTaskTitle,
  getTaskPath,
}) {
  let dbWriteChain = Promise.resolve();
  let pgPool = null;
  let redisClient = null;
  let storageInfraPromise = null;
  function statSyncSafe(filePath) {
    try {
      const meta = statSync(filePath);
      return {
        size: meta.size,
        mtime: meta.mtime.toISOString(),
      };
    } catch {
      return { size: 0, mtime: "-" };
    }
  }
  function buildPortalHealthPayload() {
    return {
      ok: true,
      service: "portal",
      build: {
        sha: BUILD_SHA,
        time: BUILD_TIME,
      },
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
      resourceOrders: {
        enabled: true,
        states: ["quoted", "frozen", "provisioning", "running", "released", "reconciling", "settled"],
        exactBillingSource: "billing-aggregator:tencent_cloud_bill",
      },
      runtime: {
        portalPublicUrl: PORTAL_PUBLIC_URL || null,
        oplWebUrl: OPL_WEB_URL || null,
        portalAdapterUrl: PORTAL_OPL_ADAPTER_URL || null,
        oplRuntimeMode: OPL_RUNTIME_MODE,
        timeoutMs: OPL_RUNTIME_TIMEOUT_MS,
      },
      storage: {
        storageMode: storageMode(),
        runtimeRoot,
        dataFile: statSyncSafe(dataFile),
        eventsFile: statSyncSafe(eventsFile),
        medWorkspaceRoot,
        medRunsRoot,
        codexRuntimeRoot,
        codexRuntimeEventsFile: statSyncSafe(codexRuntimeEventsFile),
      },
      links: {
        minioApiUrl: MINIO_API_URL || null,
        minioConsoleUrl: MINIO_CONSOLE_URL || null,
        opencostUiUrl: OPENCOST_UI_URL || null,
        harborUrl: HARBOR_URL || null,
        langfuseUrl: LANGFUSE_URL || null,
      },
    };
  }
  async function withDbWriteLock(task) {
    const run = dbWriteChain.then(task, task);
    dbWriteChain = run.catch(() => {});
    return run;
  }
  function storageMode() {
    return PORTAL_STORAGE_MODE === "postgres_redis" ? "postgres_redis" : "json";
  }
  function pgTableName(name) {
    const ns = String(PORTAL_DB_NAMESPACE || "portal").replace(/[^a-zA-Z0-9_]+/g, "_");
    return `"${ns}_${name}"`;
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${pgTableName("users")} (
        id text PRIMARY KEY,
        email text NOT NULL,
        name text NOT NULL,
        role text NOT NULL,
        status text NOT NULL,
        password_hash text NOT NULL,
        current_task_slug text NOT NULL,
        group_id text NOT NULL,
        preferences_json jsonb NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("wallets")} (
        user_id text PRIMARY KEY,
        balance numeric NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("ledger_entries")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL DEFAULT '',
        user_id text NOT NULL,
        run_id text NOT NULL,
        workspace_id text NOT NULL,
        order_id text NOT NULL DEFAULT '',
        type text NOT NULL,
        amount numeric NOT NULL,
        currency text NOT NULL DEFAULT 'CNY',
        source_type text NOT NULL DEFAULT '',
        source_id text NOT NULL DEFAULT '',
        idempotency_key text NOT NULL DEFAULT '',
        reason text NOT NULL,
        operator_id text NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("resource_orders")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        portal_user_id text NOT NULL,
        workspace_id text NOT NULL,
        workspace_session_id text NOT NULL,
        run_id text NOT NULL,
        status text NOT NULL,
        server_plan_id text NOT NULL,
        region text NOT NULL,
        zone text NOT NULL,
        cpu numeric NOT NULL,
        memory_gb numeric NOT NULL,
        gpu_type text NOT NULL,
        gpu_count numeric NOT NULL,
        storage_plan_id text NOT NULL,
        storage_size_gb numeric NOT NULL,
        retention_policy text NOT NULL,
        estimated_hours numeric NOT NULL,
        auto_stop_at text NOT NULL,
        quote_id text NOT NULL,
        freeze_id text NOT NULL,
        provision_request_id text NOT NULL,
        cloud_resource_ids_json jsonb NOT NULL,
        currency text NOT NULL,
        unit_price numeric NOT NULL,
        min_billable_hours numeric NOT NULL,
        risk_factor numeric NOT NULL,
        quote_amount numeric NOT NULL,
        freeze_amount numeric NOT NULL,
        exact_cost numeric NULL,
        pricing_source text NOT NULL,
        price_updated_at text NOT NULL,
        idempotency_key text NOT NULL,
        failed_reason text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        settled_at timestamptz NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("resource_order_events")} (
        id text PRIMARY KEY,
        order_id text NOT NULL,
        event_type text NOT NULL,
        event_payload_json jsonb NOT NULL,
        actor_type text NOT NULL,
        actor_id text NOT NULL,
        idempotency_key text NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("storage_orders")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        status text NOT NULL,
        storage_plan_id text NOT NULL,
        storage_size_gb numeric NOT NULL,
        storage_backend text NOT NULL,
        retention_policy text NOT NULL,
        cos_prefix text NOT NULL,
        source_type text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz NULL,
        retention_cleanup_after_at text NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("workspace_files")} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        user_id text NOT NULL,
        workspace_id text NOT NULL,
        run_id text NOT NULL,
        kind text NOT NULL,
        name text NOT NULL,
        relative_path text NOT NULL,
        storage_key text NOT NULL,
        local_path text NOT NULL,
        size_bytes numeric NOT NULL,
        checksum text NOT NULL,
        content_type text NOT NULL,
        status text NOT NULL,
        source text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz NULL,
        retention_cleanup_after_at text NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("task_spaces")} (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        slug text NOT NULL,
        title text NOT NULL,
        path text NOT NULL,
        status text NOT NULL,
        server_plan_id text NOT NULL DEFAULT '',
        server_plan_region text NOT NULL DEFAULT '',
        server_plan_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        archived_at timestamptz NULL,
        deleted_at timestamptz NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("user_sandboxes")} (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        runtime_type text NOT NULL,
        container_name text NOT NULL,
        namespace text NOT NULL,
        image_tag text NOT NULL,
        status text NOT NULL,
        last_workspace_id text NOT NULL,
        last_run_id text NOT NULL,
        last_error text NOT NULL,
        last_active_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("groups")} (
        id text PRIMARY KEY,
        name text NOT NULL,
        plan text NOT NULL,
        status text NOT NULL,
        balance_floor numeric NOT NULL,
        max_workspaces integer NOT NULL,
        max_concurrent_runs integer NOT NULL,
        cpu_request text NOT NULL,
        cpu_limit text NOT NULL,
        memory_request text NOT NULL,
        memory_limit text NOT NULL,
        gpu_count integer NOT NULL,
        storage_request text NOT NULL,
        storage_limit text NOT NULL,
        allow_mas boolean NOT NULL,
        allow_workspace_create boolean NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("portal_settings")} (
        key text PRIMARY KEY,
        value_json jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${pgTableName("audit_events")} (
        id text PRIMARY KEY,
        type text NOT NULL,
        user_id text NOT NULL,
        operator_id text NOT NULL,
        workspace_id text NOT NULL,
        run_id text NOT NULL,
        detail_json jsonb NOT NULL,
        occurred_at timestamptz NOT NULL
      );
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS cpu_request text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS cpu_limit text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS memory_request text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS memory_limit text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS gpu_count integer NOT NULL DEFAULT 0;
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS storage_request text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("groups")} ADD COLUMN IF NOT EXISTS storage_limit text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("task_spaces")} ADD COLUMN IF NOT EXISTS server_plan_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("task_spaces")} ADD COLUMN IF NOT EXISTS server_plan_region text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("task_spaces")} ADD COLUMN IF NOT EXISTS server_plan_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE ${pgTableName("storage_orders")} ADD COLUMN IF NOT EXISTS retention_cleanup_after_at text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("workspace_files")} ADD COLUMN IF NOT EXISTS retention_cleanup_after_at text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS order_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CNY';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS source_id text NOT NULL DEFAULT '';
      ALTER TABLE ${pgTableName("ledger_entries")} ADD COLUMN IF NOT EXISTS idempotency_key text NOT NULL DEFAULT '';
    `);
  }
  function buildSeedDb() {
    const adminId = randomUUID();
    return {
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
          groupId: "",
        },
      ],
      sessions: [],
      wallets: [{ userId: adminId, balance: 0, updatedAt: new Date().toISOString() }],
      ledger: [],
      taskSpaces: [],
      workspaceSessions: [],
      resourceOrders: [],
      resourceOrderEvents: [],
      storageOrders: [],
      workspaceFiles: [],
      userSandboxes: [],
      groups: [],
      settings: {
        allowRegistration: String(process.env.PORTAL_ALLOW_REGISTRATION || "1") !== "0",
        announcements: [],
      },
    };
  }
  async function migrateDb(db) {
    let changed = false;
    for (const key of ["users", "sessions", "wallets", "ledger", "workspaceSessions", "resourceOrders", "resourceOrderEvents", "storageOrders", "workspaceFiles", "userSandboxes", "groups"]) {
      if (!Array.isArray(db[key])) {
        db[key] = [];
        changed = true;
      }
    }
    const resourceOrderStateBefore = JSON.stringify({
      ledger: db.ledger,
      resourceOrders: db.resourceOrders,
      resourceOrderEvents: db.resourceOrderEvents,
    });
    ensureResourceOrderCollections(db);
    if (JSON.stringify({
      ledger: db.ledger,
      resourceOrders: db.resourceOrders,
      resourceOrderEvents: db.resourceOrderEvents,
    }) !== resourceOrderStateBefore) {
      changed = true;
    }
    const workspaceStorageStateBefore = JSON.stringify({
      storageOrders: db.storageOrders,
      workspaceFiles: db.workspaceFiles,
    });
    ensureWorkspaceStorageCollections(db);
    if (JSON.stringify({
      storageOrders: db.storageOrders,
      workspaceFiles: db.workspaceFiles,
    }) !== workspaceStorageStateBefore) {
      changed = true;
    }
    if (!Array.isArray(db.taskSpaces)) {
      db.taskSpaces = (db.workspaces || []).map((item) => ({
        id: item.id || randomUUID(),
        userId: item.userId,
        slug: item.slug || "default",
        title: sanitizeTaskTitle(item.slug || "default", item.title || item.workspace_name || "Default Task"),
        path: item.path || item.workspace_root || getTaskPath(item.userId, item.slug || "default"),
        status: "active",
        createdAt: item.createdAt || item.created_at || new Date().toISOString(),
        updatedAt: item.updatedAt || item.updated_at || new Date().toISOString(),
      }));
      changed = true;
    }
    if (!db.settings || typeof db.settings !== "object") {
      db.settings = {
        allowRegistration: String(process.env.PORTAL_ALLOW_REGISTRATION || "1") !== "0",
        announcements: [],
      };
      changed = true;
    }
    if (!Array.isArray(db.settings.announcements)) {
      db.settings.announcements = [];
      changed = true;
    } else {
      const normalizedAnnouncements = db.settings.announcements.map(normalizeAnnouncementRecord).filter(Boolean);
      if (normalizedAnnouncements.length !== db.settings.announcements.length) {
        db.settings.announcements = normalizedAnnouncements;
        changed = true;
      }
    }
    const adminPasswordHash = hashPassword(adminSeed.password);
    let seededAdmin = db.users.find((item) => item.email === adminSeed.email && item.role === "admin");
    if (!seededAdmin) {
      seededAdmin = {
        id: randomUUID(),
        email: adminSeed.email,
        name: adminSeed.name,
        role: "admin",
        status: "active",
        currentTaskSlug: "default",
        preferences: { theme: "light" },
        passwordHash: adminPasswordHash,
        createdAt: new Date().toISOString(),
      };
      db.users.push(seededAdmin);
      db.wallets.push({ userId: seededAdmin.id, balance: PORTAL_ADMIN_SEED_BALANCE, updatedAt: new Date().toISOString() });
      changed = true;
    } else {
      if (seededAdmin.passwordHash !== adminPasswordHash) {
        seededAdmin.passwordHash = adminPasswordHash;
        changed = true;
      }
      if (!seededAdmin.preferences) {
        seededAdmin.preferences = { theme: "light" };
        changed = true;
      }
    }
    for (const user of db.users) {
      if (!user.status) {
        user.status = "active";
        changed = true;
      }
      if (!user.preferences || typeof user.preferences !== "object") {
        user.preferences = { theme: "light" };
        changed = true;
      }
      if (!user.preferences.theme) {
        user.preferences.theme = "light";
        changed = true;
      }
      if (!user.currentTaskSlug) {
        user.currentTaskSlug = "default";
        changed = true;
      }
      if (!("groupId" in user)) {
        user.groupId = "";
        changed = true;
      }
      if (ensureUserCommercialState(user, { grantTrial: false })) {
        changed = true;
      }
    }
    for (const group of db.groups) {
      if (!("balanceFloor" in group)) {
        group.balanceFloor = 0;
        changed = true;
      }
      if (!("maxWorkspaces" in group)) {
        group.maxWorkspaces = 0;
        changed = true;
      }
      if (!("maxConcurrentRuns" in group)) {
        group.maxConcurrentRuns = 0;
        changed = true;
      }
      if (!("allowMas" in group)) {
        group.allowMas = true;
        changed = true;
      }
      if (!("allowWorkspaceCreate" in group)) {
        group.allowWorkspaceCreate = true;
        changed = true;
      }
      if (!("cpuRequest" in group)) {
        group.cpuRequest = "";
        changed = true;
      }
      if (!("cpuLimit" in group)) {
        group.cpuLimit = "";
        changed = true;
      }
      if (!("memoryRequest" in group)) {
        group.memoryRequest = "";
        changed = true;
      }
      if (!("memoryLimit" in group)) {
        group.memoryLimit = "";
        changed = true;
      }
      if (!("gpuCount" in group)) {
        group.gpuCount = 0;
        changed = true;
      }
      if (!("storageRequest" in group)) {
        group.storageRequest = "";
        changed = true;
      }
      if (!("storageLimit" in group)) {
        group.storageLimit = "";
        changed = true;
      }
    }
    for (const taskSpace of db.taskSpaces) {
      const sanitizedTitle = sanitizeTaskTitle(taskSpace.slug, taskSpace.title);
      if (taskSpace.title !== sanitizedTitle) {
        taskSpace.title = sanitizedTitle;
        changed = true;
      }
      if (!taskSpace.status) {
        taskSpace.status = "active";
        changed = true;
      }
      if (!taskSpace.path) {
        taskSpace.path = getTaskPath(taskSpace.userId, taskSpace.slug || "default");
        changed = true;
      }
      const expectedTaskPath = getTaskPath(taskSpace.userId, taskSpace.slug || "default");
      if (path.normalize(String(taskSpace.path || "")) !== path.normalize(expectedTaskPath)) {
        taskSpace.path = expectedTaskPath;
        changed = true;
      }
      if (!taskSpace.createdAt) {
        taskSpace.createdAt = new Date().toISOString();
        changed = true;
      }
      if (!taskSpace.updatedAt) {
        taskSpace.updatedAt = taskSpace.createdAt;
        changed = true;
      }
      const normalizedServerPlan = normalizeServerPlanSelection(taskSpace.serverPlanSnapshot);
      if (JSON.stringify(normalizedServerPlan) !== JSON.stringify(taskSpace.serverPlanSnapshot || null)) {
        taskSpace.serverPlanSnapshot = normalizedServerPlan;
        changed = true;
      }
      const serverPlanId = normalizedServerPlan?.id || "";
      const serverPlanRegion = normalizedServerPlan?.region || "";
      if (String(taskSpace.serverPlanId || "") !== serverPlanId) {
        taskSpace.serverPlanId = serverPlanId;
        changed = true;
      }
      if (String(taskSpace.serverPlanRegion || "") !== serverPlanRegion) {
        taskSpace.serverPlanRegion = serverPlanRegion;
        changed = true;
      }
    }
    delete db.workspaces;
    return { db, changed };
  }
  async function readDb() {
    await ensureStorageInfra();
    await dbWriteChain.catch(() => {});
    if (storageMode() === "json") {
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
    const pool = await ensurePgPool();
    const redis = await ensureRedis();
    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM ${pgTableName("users")}`);
    if (!Number(countRes.rows[0]?.count || 0)) {
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
    }
    const [usersRes, walletsRes, ledgerRes, taskSpacesRes, resourceOrdersRes, resourceOrderEventsRes, storageOrdersRes, workspaceFilesRes, sandboxesRes, groupsRes, settingsRes, eventsRes] = await Promise.all([
      pool.query(`SELECT * FROM ${pgTableName("users")}`),
      pool.query(`SELECT * FROM ${pgTableName("wallets")}`),
      pool.query(`SELECT * FROM ${pgTableName("ledger_entries")}`),
      pool.query(`SELECT * FROM ${pgTableName("task_spaces")}`),
      pool.query(`SELECT * FROM ${pgTableName("resource_orders")}`),
      pool.query(`SELECT * FROM ${pgTableName("resource_order_events")}`),
      pool.query(`SELECT * FROM ${pgTableName("storage_orders")}`),
      pool.query(`SELECT * FROM ${pgTableName("workspace_files")}`),
      pool.query(`SELECT * FROM ${pgTableName("user_sandboxes")}`),
      pool.query(`SELECT * FROM ${pgTableName("groups")}`),
      pool.query(`SELECT * FROM ${pgTableName("portal_settings")}`),
      pool.query(`SELECT * FROM ${pgTableName("audit_events")} ORDER BY occurred_at DESC LIMIT 500`),
    ]);
    const sessionKeys = await redis.keys(`${PORTAL_DB_NAMESPACE}:session:*`);
    const workspaceSessionKeys = await redis.keys(`${PORTAL_DB_NAMESPACE}:workspace_session:*`);
    const [sessionValues, workspaceSessionValues] = await Promise.all([
      sessionKeys.length ? redis.mGet(sessionKeys) : [],
      workspaceSessionKeys.length ? redis.mGet(workspaceSessionKeys) : [],
    ]);
    const sessions = sessionKeys.map((key, index) => {
      const parsed = safeJsonParse(sessionValues[index]);
      return parsed && typeof parsed === "object" ? parsed : null;
    }).filter(Boolean);
    const workspaceSessions = [];
    for (let index = 0; index < workspaceSessionKeys.length; index += 1) {
      const key = workspaceSessionKeys[index];
      const raw = workspaceSessionValues[index];
      if (!raw) continue;
      const parsed = safeJsonParse(raw);
      if (!parsed || typeof parsed !== "object") {
        await quarantineWorkspaceSessionRedisValue(redis, key, raw, "invalid_json");
        continue;
      }
      const normalized = normalizeWorkspaceSessionValue(parsed);
      if (!normalized) {
        await quarantineWorkspaceSessionRedisValue(redis, key, raw, "invalid_workspace_session_shape");
        continue;
      }
      workspaceSessions.push(normalized);
    }
    const db = {
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
      wallets: walletsRes.rows.map((row) => ({
        userId: row.user_id,
        balance: Number(row.balance || 0),
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      })),
      ledger: ledgerRes.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id || row.user_id,
        userId: row.user_id,
        runId: row.run_id,
        workspaceId: row.workspace_id,
        orderId: row.order_id || "",
        type: row.type,
        amount: Number(row.amount || 0),
        currency: row.currency || "CNY",
        sourceType: row.source_type || "",
        sourceId: row.source_id || "",
        idempotencyKey: row.idempotency_key || "",
        reason: row.reason,
        operatorId: row.operator_id,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      })),
      taskSpaces: taskSpacesRes.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        slug: row.slug,
        title: row.title,
        path: row.path,
        status: row.status,
        serverPlanId: row.server_plan_id || "",
        serverPlanRegion: row.server_plan_region || "",
        serverPlanSnapshot: normalizeServerPlanSelection(row.server_plan_snapshot_json),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        archivedAt: row.archived_at instanceof Date ? row.archived_at.toISOString() : row.archived_at,
        deletedAt: row.deleted_at instanceof Date ? row.deleted_at.toISOString() : row.deleted_at,
      })),
      resourceOrders: resourceOrdersRes.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        portalUserId: row.portal_user_id,
        workspaceId: row.workspace_id,
        workspaceSessionId: row.workspace_session_id,
        runId: row.run_id,
        status: row.status,
        serverPlanId: row.server_plan_id,
        region: row.region,
        zone: row.zone,
        cpu: Number(row.cpu || 0),
        memoryGb: Number(row.memory_gb || 0),
        gpuType: row.gpu_type || "",
        gpuCount: Number(row.gpu_count || 0),
        storagePlanId: row.storage_plan_id || "",
        storageSizeGb: Number(row.storage_size_gb || 0),
        retentionPolicy: row.retention_policy || "",
        estimatedHours: Number(row.estimated_hours || 0),
        autoStopAt: row.auto_stop_at || "",
        quoteId: row.quote_id || "",
        freezeId: row.freeze_id || "",
        provisionRequestId: row.provision_request_id || "",
        cloudResourceIds: row.cloud_resource_ids_json || [],
        currency: row.currency || "CNY",
        unitPrice: Number(row.unit_price || 0),
        minBillableHours: Number(row.min_billable_hours || 1),
        riskFactor: Number(row.risk_factor || 1),
        quoteAmount: Number(row.quote_amount || 0),
        freezeAmount: Number(row.freeze_amount || 0),
        exactCost: row.exact_cost === null ? null : Number(row.exact_cost || 0),
        pricingSource: row.pricing_source || "",
        priceUpdatedAt: row.price_updated_at || "",
        idempotencyKey: row.idempotency_key || "",
        failedReason: row.failed_reason || "",
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        settledAt: row.settled_at instanceof Date ? row.settled_at.toISOString() : row.settled_at,
      })),
      resourceOrderEvents: resourceOrderEventsRes.rows.map((row) => ({
        id: row.id,
        orderId: row.order_id,
        eventType: row.event_type,
        eventPayload: row.event_payload_json || {},
        actorType: row.actor_type,
        actorId: row.actor_id,
        idempotencyKey: row.idempotency_key || "",
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      })),
      storageOrders: storageOrdersRes.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        workspaceId: row.workspace_id,
        status: row.status,
        storagePlanId: row.storage_plan_id,
        storageSizeGb: Number(row.storage_size_gb || 0),
        storageBackend: row.storage_backend || "cos",
        retentionPolicy: row.retention_policy || "order_lifecycle",
        cosPrefix: row.cos_prefix || "",
        sourceType: row.source_type || "",
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        deletedAt: row.deleted_at instanceof Date ? row.deleted_at.toISOString() : row.deleted_at,
        retentionCleanupAfterAt: row.retention_cleanup_after_at || "",
      })),
      workspaceFiles: workspaceFilesRes.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        workspaceId: row.workspace_id,
        runId: row.run_id || "",
        kind: row.kind,
        name: row.name,
        relativePath: row.relative_path,
        storageKey: row.storage_key,
        localPath: row.local_path,
        sizeBytes: Number(row.size_bytes || 0),
        checksum: row.checksum || "",
        contentType: row.content_type || "application/octet-stream",
        status: row.status || "active",
        source: row.source || "portal_upload",
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        deletedAt: row.deleted_at instanceof Date ? row.deleted_at.toISOString() : row.deleted_at,
        retentionCleanupAfterAt: row.retention_cleanup_after_at || "",
      })),
      workspaceSessions,
      userSandboxes: sandboxesRes.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        runtimeType: row.runtime_type,
        containerName: row.container_name,
        namespace: row.namespace,
        imageTag: row.image_tag,
        status: row.status,
        lastWorkspaceId: row.last_workspace_id,
        lastRunId: row.last_run_id,
        lastError: row.last_error,
        lastActiveAt: row.last_active_at instanceof Date ? row.last_active_at.toISOString() : row.last_active_at,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      })),
      groups: groupsRes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        plan: row.plan,
        status: row.status,
        balanceFloor: Number(row.balance_floor || 0),
        maxWorkspaces: Number(row.max_workspaces || 0),
        maxConcurrentRuns: Number(row.max_concurrent_runs || 0),
        cpuRequest: row.cpu_request || "",
        cpuLimit: row.cpu_limit || "",
        memoryRequest: row.memory_request || "",
        memoryLimit: row.memory_limit || "",
        gpuCount: Number(row.gpu_count || 0),
        storageRequest: row.storage_request || "",
        storageLimit: row.storage_limit || "",
        allowMas: Boolean(row.allow_mas),
        allowWorkspaceCreate: Boolean(row.allow_workspace_create),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      })),
      settings: Object.fromEntries(settingsRes.rows.map((row) => [row.key, row.value_json])),
      _auditEvents: eventsRes.rows.map((row) => ({
        id: row.id,
        type: row.type,
        userId: row.user_id,
        operatorId: row.operator_id,
        workspaceId: row.workspace_id,
        runId: row.run_id,
        occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
        ...row.detail_json,
      })),
    };
    const { db: migrated, changed } = await migrateDb(db);
    if (changed) {
      await writeDb(migrated);
    }
    return migrated;
  }
  async function writeDb(db) {
    await withDbWriteLock(async () => {
      if (storageMode() === "json") {
        await atomicWriteJson(dataFile, db);
        return;
      }
      const pool = await ensurePgPool();
      const redis = await ensureRedis();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM ${pgTableName("users")}`);
        for (const row of db.users || []) {
          await client.query(`INSERT INTO ${pgTableName("users")} (id,email,name,role,status,password_hash,current_task_slug,group_id,preferences_json,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
      row.id, row.email, row.name, row.role, row.status, row.passwordHash || "", row.currentTaskSlug || "default", row.groupId || "", JSON.stringify(row.preferences || { theme: "light" }), row.createdAt || new Date().toISOString(),
          ]);
        }
        await client.query(`DELETE FROM ${pgTableName("wallets")}`);
        for (const row of db.wallets || []) {
          await client.query(`INSERT INTO ${pgTableName("wallets")} (user_id,balance,updated_at) VALUES ($1,$2,$3)`, [row.userId, Number(row.balance || 0), row.updatedAt || new Date().toISOString()]);
        }
        await client.query(`DELETE FROM ${pgTableName("ledger_entries")}`);
        for (const row of normalizeLedgerEntries(db.ledger || [])) {
          await client.query(`INSERT INTO ${pgTableName("ledger_entries")} (id,tenant_id,user_id,run_id,workspace_id,order_id,type,amount,currency,source_type,source_id,idempotency_key,reason,operator_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [
            row.id,
            row.tenantId || row.userId || "",
            row.userId || "",
            row.runId || "",
            row.workspaceId || "",
            row.orderId || "",
            row.type || "",
            Number(row.amount || 0),
            row.currency || "CNY",
            row.sourceType || "",
            row.sourceId || "",
            row.idempotencyKey || "",
            row.reason || "",
            row.operatorId || "",
            row.createdAt || new Date().toISOString(),
          ]);
        }
        await client.query(`DELETE FROM ${pgTableName("task_spaces")}`);
        for (const row of db.taskSpaces || []) {
          await client.query(`INSERT INTO ${pgTableName("task_spaces")} (id,user_id,slug,title,path,status,server_plan_id,server_plan_region,server_plan_snapshot_json,created_at,updated_at,archived_at,deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
            row.id,
            row.userId,
            row.slug,
            row.title,
            row.path,
            row.status,
            row.serverPlanId || "",
            row.serverPlanRegion || "",
            JSON.stringify(normalizeServerPlanSelection(row.serverPlanSnapshot) || {}),
            row.createdAt || new Date().toISOString(),
            row.updatedAt || row.createdAt || new Date().toISOString(),
            row.archivedAt || null,
            row.deletedAt || null,
          ]);
        }
        await client.query(`DELETE FROM ${pgTableName("resource_orders")}`);
        for (const row of db.resourceOrders || []) {
          await client.query(`INSERT INTO ${pgTableName("resource_orders")} (id,tenant_id,user_id,portal_user_id,workspace_id,workspace_session_id,run_id,status,server_plan_id,region,zone,cpu,memory_gb,gpu_type,gpu_count,storage_plan_id,storage_size_gb,retention_policy,estimated_hours,auto_stop_at,quote_id,freeze_id,provision_request_id,cloud_resource_ids_json,currency,unit_price,min_billable_hours,risk_factor,quote_amount,freeze_amount,exact_cost,pricing_source,price_updated_at,idempotency_key,failed_reason,created_at,updated_at,settled_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)`, [
            row.id,
            row.tenantId || row.userId || "",
            row.userId || "",
            row.portalUserId || row.userId || "",
            row.workspaceId || "",
            row.workspaceSessionId || "",
            row.runId || "",
            row.status || "quoted",
            row.serverPlanId || "",
            row.region || "",
            row.zone || "",
            Number(row.cpu || 0),
            Number(row.memoryGb || 0),
            row.gpuType || "",
            Number(row.gpuCount || 0),
            row.storagePlanId || "",
            Number(row.storageSizeGb || 0),
            row.retentionPolicy || "",
            Number(row.estimatedHours || 1),
            row.autoStopAt || "",
            row.quoteId || "",
            row.freezeId || "",
            row.provisionRequestId || "",
            JSON.stringify(row.cloudResourceIds || []),
            row.currency || "CNY",
            Number(row.unitPrice || 0),
            Number(row.minBillableHours || 1),
            Number(row.riskFactor || 1),
            Number(row.quoteAmount || 0),
            Number(row.freezeAmount || 0),
            row.exactCost === null || row.exactCost === undefined ? null : Number(row.exactCost || 0),
            row.pricingSource || "",
            row.priceUpdatedAt || "",
            row.idempotencyKey || "",
            row.failedReason || "",
            row.createdAt || new Date().toISOString(),
            row.updatedAt || row.createdAt || new Date().toISOString(),
            row.settledAt || null,
          ]);
        }
        await client.query(`DELETE FROM ${pgTableName("resource_order_events")}`);
        for (const row of db.resourceOrderEvents || []) {
          await client.query(`INSERT INTO ${pgTableName("resource_order_events")} (id,order_id,event_type,event_payload_json,actor_type,actor_id,idempotency_key,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
            row.id,
            row.orderId || "",
            row.eventType || "",
            JSON.stringify(row.eventPayload || {}),
            row.actorType || "system",
            row.actorId || "",
            row.idempotencyKey || "",
            row.createdAt || new Date().toISOString(),
          ]);
        }
        await client.query(`DELETE FROM ${pgTableName("storage_orders")}`);
        for (const row of db.storageOrders || []) {
          await client.query(`INSERT INTO ${pgTableName("storage_orders")} (id,tenant_id,user_id,workspace_id,status,storage_plan_id,storage_size_gb,storage_backend,retention_policy,cos_prefix,source_type,created_at,updated_at,deleted_at,retention_cleanup_after_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [
            row.id,
            row.tenantId || row.userId || "",
            row.userId || "",
            row.workspaceId || "",
            row.status || "active",
            row.storagePlanId || "",
            Number(row.storageSizeGb || 0),
            row.storageBackend || "cos",
            row.retentionPolicy || "order_lifecycle",
            row.cosPrefix || "",
            row.sourceType || "portal_storage_order",
            row.createdAt || new Date().toISOString(),
            row.updatedAt || row.createdAt || new Date().toISOString(),
            row.deletedAt || null,
            row.retentionCleanupAfterAt || "",
          ]);
        }
        await client.query(`DELETE FROM ${pgTableName("workspace_files")}`);
        for (const row of db.workspaceFiles || []) {
          await client.query(`INSERT INTO ${pgTableName("workspace_files")} (id,tenant_id,user_id,workspace_id,run_id,kind,name,relative_path,storage_key,local_path,size_bytes,checksum,content_type,status,source,created_at,updated_at,deleted_at,retention_cleanup_after_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, [
            row.id,
            row.tenantId || row.userId || "",
            row.userId || "",
            row.workspaceId || "",
            row.runId || "",
            row.kind || "inputs",
            row.name || "",
            row.relativePath || "",
            row.storageKey || "",
            row.localPath || "",
            Number(row.sizeBytes || 0),
            row.checksum || "",
            row.contentType || "application/octet-stream",
            row.status || "active",
            row.source || "portal_upload",
            row.createdAt || new Date().toISOString(),
            row.updatedAt || row.createdAt || new Date().toISOString(),
            row.deletedAt || null,
            row.retentionCleanupAfterAt || "",
          ]);
        }
        await client.query(`DELETE FROM ${pgTableName("user_sandboxes")}`);
        for (const row of db.userSandboxes || []) {
          await client.query(`INSERT INTO ${pgTableName("user_sandboxes")} (id,user_id,runtime_type,container_name,namespace,image_tag,status,last_workspace_id,last_run_id,last_error,last_active_at,updated_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
            row.id, row.userId, row.runtimeType || "", row.containerName || "", row.namespace || "", row.imageTag || "", row.status || "", row.lastWorkspaceId || "", row.lastRunId || "", row.lastError || "", row.lastActiveAt || new Date().toISOString(), row.updatedAt || new Date().toISOString(), row.createdAt || new Date().toISOString(),
          ]);
        }
        await client.query(`DELETE FROM ${pgTableName("groups")}`);
        for (const row of db.groups || []) {
          await client.query(`INSERT INTO ${pgTableName("groups")} (id,name,plan,status,balance_floor,max_workspaces,max_concurrent_runs,cpu_request,cpu_limit,memory_request,memory_limit,gpu_count,storage_request,storage_limit,allow_mas,allow_workspace_create,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, [
            row.id, row.name, row.plan || "", row.status || "active", Number(row.balanceFloor || 0), Number(row.maxWorkspaces || 0), Number(row.maxConcurrentRuns || 0), row.cpuRequest || "", row.cpuLimit || "", row.memoryRequest || "", row.memoryLimit || "", Number(row.gpuCount || 0), row.storageRequest || "", row.storageLimit || "", row.allowMas !== false, row.allowWorkspaceCreate !== false, row.createdAt || new Date().toISOString(),
          ]);
        }
        await client.query(`DELETE FROM ${pgTableName("portal_settings")}`);
        for (const [key, value] of Object.entries(db.settings || {})) {
          await client.query(`INSERT INTO ${pgTableName("portal_settings")} (key,value_json) VALUES ($1,$2)`, [key, JSON.stringify(value)]);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      const sessionKeys = await redis.keys(`${PORTAL_DB_NAMESPACE}:session:*`);
      const workspaceSessionKeys = await redis.keys(`${PORTAL_DB_NAMESPACE}:workspace_session:*`);
      if (sessionKeys.length) await redis.del(sessionKeys);
      if (workspaceSessionKeys.length) await redis.del(workspaceSessionKeys);
      for (const item of db.sessions || []) {
        await redis.set(`${PORTAL_DB_NAMESPACE}:session:${item.id}`, JSON.stringify(item), { EX: 7 * 24 * 60 * 60 });
      }
      for (const item of db.workspaceSessions || []) {
        const payload = serializeWorkspaceSessionValue(item);
        const normalized = normalizeWorkspaceSessionValue(item);
        const ttl = normalized?.expiresAt ? Math.max(60, Math.floor((Date.parse(normalized.expiresAt) - Date.now()) / 1000)) : 12 * 60 * 60;
        await redis.set(`${PORTAL_DB_NAMESPACE}:workspace_session:${normalized.id}`, payload, { EX: ttl });
      }
      await atomicWriteJson(dataFile, {
        ...db,
        _storage: {
          mode: "postgres_redis",
          mirroredAt: new Date().toISOString(),
        },
      });
    });
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
    readDb,
    readPortalEvents,
    storageMode,
    writeDb,
  };
}
