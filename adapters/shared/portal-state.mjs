import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const PORTAL_POSTGRES_URL = String(process.env.PORTAL_POSTGRES_URL || "postgres://postgres:postgres@127.0.0.1:5432/med_meta").trim();
const PORTAL_REDIS_URL = String(process.env.PORTAL_REDIS_URL || "redis://127.0.0.1:6379").trim();
const PORTAL_DB_NAMESPACE = String(process.env.PORTAL_DB_NAMESPACE || "portal").trim() || "portal";
const PORTAL_STORAGE_MODE = String(process.env.PORTAL_STORAGE_MODE || "postgres_redis").trim().toLowerCase();
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const portalRuntimeRoot = path.join(repoRoot, ".runtime", "portal");
const portalJsonDbFile = path.join(portalRuntimeRoot, "portal-db.json");

let pgPool = null;
let redisClient = null;
const VALID_WORKSPACE_SESSION_STATUSES = new Set(["active", "revoked", "archived", "deleted", "deleting"]);

function storageMode() {
  return PORTAL_STORAGE_MODE === "json" ? "json" : "postgres_redis";
}

function table(name) {
  return `${PORTAL_DB_NAMESPACE}_${name}`;
}

async function readJsonDb() {
  try {
    const raw = await readFile(portalJsonDbFile, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      wallets: Array.isArray(parsed.wallets) ? parsed.wallets : [],
      workspaceSessions: Array.isArray(parsed.workspaceSessions) ? parsed.workspaceSessions : [],
      userSandboxes: Array.isArray(parsed.userSandboxes) ? parsed.userSandboxes : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    };
  } catch {
    return {
      users: [],
      sessions: [],
      wallets: [],
      workspaceSessions: [],
      userSandboxes: [],
      groups: [],
    };
  }
}

async function writeJsonDb(db) {
  await mkdir(portalRuntimeRoot, { recursive: true });
  await writeFile(portalJsonDbFile, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

async function pool() {
  if (!pgPool) {
    const pg = await import("pg");
    const { Pool } = pg;
    pgPool = new Pool({ connectionString: PORTAL_POSTGRES_URL });
  }
  return pgPool;
}

async function redis() {
  if (!redisClient) {
    const { createClient: createRedisClient } = await import("redis");
    redisClient = createRedisClient({ url: PORTAL_REDIS_URL });
    redisClient.on("error", (error) => console.error("portal-state redis error", error));
    await redisClient.connect();
  }
  return redisClient;
}

function iso(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

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

function normalizeWorkspaceSession(session) {
  if (!session || typeof session !== "object") return null;
  const id = String(session.id || "").trim();
  const userId = String(session.userId || "").trim();
  const workspaceId = String(session.workspaceId || "").trim();
  const status = String(session.status || "").trim().toLowerCase();
  const createdAt = String(session.createdAt || "").trim();
  const lastUsedAt = String(session.lastUsedAt || "").trim();
  const expiresAt = String(session.expiresAt || "").trim();
  const sessionType = String(session.sessionType || "opl_session").trim() || "opl_session";
  if (!id || !userId || !workspaceId || !VALID_WORKSPACE_SESSION_STATUSES.has(status)) return null;
  if (!isValidDateValue(createdAt) || !isValidDateValue(lastUsedAt) || !isValidDateValue(expiresAt)) return null;
  return {
    ...session,
    id,
    userId,
    workspaceId,
    workspaceTitle: String(session.workspaceTitle || workspaceId).trim() || workspaceId,
    sessionType,
    status,
    source: String(session.source || "portal-workspace-entry").trim() || "portal-workspace-entry",
    createdAt: createdAt || new Date().toISOString(),
    lastUsedAt: lastUsedAt || createdAt || new Date().toISOString(),
    expiresAt: expiresAt || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  };
}

async function quarantineWorkspaceSession(store, sessionId, raw, reason) {
  const suffix = String(sessionId || "").trim() || `${Date.now()}`;
  await store.set(`${PORTAL_DB_NAMESPACE}:quarantine:workspace_session:${suffix}`, JSON.stringify({
    sessionId: suffix,
    raw: String(raw || ""),
    reason,
    quarantinedAt: new Date().toISOString(),
  }), { EX: 7 * 24 * 60 * 60 }).catch(() => {});
  if (sessionId) {
    await store.del(`${PORTAL_DB_NAMESPACE}:workspace_session:${sessionId}`).catch(() => {});
  }
}

export async function getPortalUserById(userId) {
  if (!userId) return null;
  if (storageMode() === "json") {
    const db = await readJsonDb();
    return db.users.find((item) => item.id === userId) || null;
  }
  const db = await pool();
  const res = await db.query(`SELECT * FROM ${table("users")} WHERE id = $1 LIMIT 1`, [userId]);
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    passwordHash: row.password_hash,
    currentTaskSlug: row.current_task_slug,
    groupId: row.group_id,
    preferences: row.preferences_json || { theme: "dark" },
    createdAt: iso(row.created_at),
  };
}

export async function getPortalUserByEmail(email) {
  if (!email) return null;
  if (storageMode() === "json") {
    const db = await readJsonDb();
    return db.users.find((item) => String(item.email || "").toLowerCase() === String(email).toLowerCase()) || null;
  }
  const db = await pool();
  const res = await db.query(`SELECT * FROM ${table("users")} WHERE lower(email) = lower($1) LIMIT 1`, [email]);
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    passwordHash: row.password_hash,
    currentTaskSlug: row.current_task_slug,
    groupId: row.group_id,
    preferences: row.preferences_json || { theme: "dark" },
    createdAt: iso(row.created_at),
  };
}

export async function getWalletByUserId(userId) {
  if (!userId) return { balance: 0 };
  if (storageMode() === "json") {
    const db = await readJsonDb();
    return db.wallets.find((item) => item.userId === userId) || { userId, balance: 0 };
  }
  const db = await pool();
  const res = await db.query(`SELECT * FROM ${table("wallets")} WHERE user_id = $1 LIMIT 1`, [userId]);
  const row = res.rows[0];
  if (!row) return { balance: 0 };
  return {
    userId: row.user_id,
    balance: Number(row.balance || 0),
    updatedAt: iso(row.updated_at),
  };
}

export async function getPortalSession(sessionId) {
  if (!sessionId) return null;
  if (storageMode() === "json") {
    const db = await readJsonDb();
    return db.sessions.find((item) => item.id === sessionId) || null;
  }
  const store = await redis();
  const raw = await store.get(`${PORTAL_DB_NAMESPACE}:session:${sessionId}`);
  return raw ? safeJsonParse(raw) : null;
}

export async function getWorkspaceSession(sessionId, userId = "") {
  if (!sessionId) return null;
  if (storageMode() === "json") {
    const db = await readJsonDb();
    const session = normalizeWorkspaceSession(db.workspaceSessions.find((item) => item.id === sessionId));
    if (!session) return null;
    if (userId && session.userId !== userId) return null;
    if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) return null;
    return session;
  }
  const store = await redis();
  const raw = await store.get(`${PORTAL_DB_NAMESPACE}:workspace_session:${sessionId}`);
  if (!raw) return null;
  const parsed = safeJsonParse(raw);
  const session = normalizeWorkspaceSession(parsed);
  if (!session) {
    await quarantineWorkspaceSession(store, sessionId, raw, "invalid_workspace_session");
    return null;
  }
  if (userId && session.userId !== userId) return null;
  if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) return null;
  return session;
}

export async function listActiveWorkspaceSessionsByUser(userId) {
  if (storageMode() === "json") {
    const db = await readJsonDb();
    return db.workspaceSessions
      .map((item) => normalizeWorkspaceSession(item))
      .filter(Boolean)
      .filter((session) =>
        session.userId === userId &&
        session.status === "active" &&
        (!session.expiresAt || Date.parse(session.expiresAt) > Date.now()),
      );
  }
  const store = await redis();
  const keys = await store.keys(`${PORTAL_DB_NAMESPACE}:workspace_session:*`);
  if (!keys.length) return [];
  const values = await store.mGet(keys);
  const sessions = [];
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const raw = values[index];
    if (!raw) continue;
    const sessionId = String(key || "").split(":").pop() || "";
    const parsed = safeJsonParse(raw);
    const session = normalizeWorkspaceSession(parsed);
    if (!session) {
      await quarantineWorkspaceSession(store, sessionId, raw, "invalid_workspace_session");
      continue;
    }
    if (
      session.userId === userId &&
      session.status === "active" &&
      (!session.expiresAt || Date.parse(session.expiresAt) > Date.now())
    ) {
      sessions.push(session);
    }
  }
  return sessions;
}

export async function upsertUserSandbox(record) {
  if (storageMode() === "json") {
    const db = await readJsonDb();
    db.userSandboxes = Array.isArray(db.userSandboxes) ? db.userSandboxes : [];
    const index = db.userSandboxes.findIndex((item) => item.id === record.id);
    if (index >= 0) db.userSandboxes[index] = { ...db.userSandboxes[index], ...record };
    else db.userSandboxes.push({ ...record });
    await writeJsonDb(db);
    return;
  }
  const db = await pool();
  await db.query(
    `INSERT INTO ${table("user_sandboxes")} (id,user_id,runtime_type,container_name,namespace,image_tag,status,last_workspace_id,last_run_id,last_error,last_active_at,updated_at,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       runtime_type = EXCLUDED.runtime_type,
       container_name = EXCLUDED.container_name,
       namespace = EXCLUDED.namespace,
       image_tag = EXCLUDED.image_tag,
       status = EXCLUDED.status,
       last_workspace_id = EXCLUDED.last_workspace_id,
       last_run_id = EXCLUDED.last_run_id,
       last_error = EXCLUDED.last_error,
       last_active_at = EXCLUDED.last_active_at,
       updated_at = EXCLUDED.updated_at`,
    [
      record.id,
      record.userId,
      record.runtimeType,
      record.containerName,
      record.namespace,
      record.imageTag,
      record.status,
      record.lastWorkspaceId || "",
      record.lastRunId || "",
      record.lastError || "",
      record.lastActiveAt,
      record.updatedAt,
      record.createdAt,
    ],
  );
}

export async function getGroupById(groupId) {
  if (!groupId) return null;
  if (storageMode() === "json") {
    const db = await readJsonDb();
    return db.groups.find((item) => item.id === groupId) || null;
  }
  const db = await pool();
  const res = await db.query(`SELECT * FROM ${table("groups")} WHERE id = $1 LIMIT 1`, [groupId]);
  const row = res.rows[0];
  if (!row) return null;
  return {
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
    createdAt: iso(row.created_at),
  };
}
