import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile, access, readdir, stat, appendFile, rename } from "node:fs/promises";
import { constants as fsConstants, createReadStream, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { createClient as createRedisClient } from "redis";
import { createBillingClient } from "./integrations/billing-client.mjs";
import { createHarborRegistryClient } from "./integrations/harbor-registry-client.mjs";
import { createLangfuseTraceClient } from "./integrations/langfuse-trace-client.mjs";
import { createMinioStorageClient } from "./integrations/minio-storage-client.mjs";
import { createOplAdapterClient } from "./integrations/opl-adapter-client.mjs";
import { createOplRoutes } from "./routes/opl.routes.mjs";
import { createOplLaunchService } from "./services/opl-launch.service.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../");
const portalWorkdir = path.resolve(__dirname, "..");
const publicRoot = path.join(__dirname, "public");
const frontendDistRoot = path.join(portalWorkdir, "frontend", "dist");
const runtimeRoot = path.join(repoRoot, ".runtime", "portal");
const dataFile = path.join(runtimeRoot, "portal-db.json");
const eventsFile = path.join(runtimeRoot, "events.jsonl");
const medWorkspaceRoot = path.join(repoRoot, ".runtime", "med-autoscience", "workspaces");
const medRunsRoot = path.join(repoRoot, ".runtime", "med-autoscience", "runs");
const codexRuntimeRoot = path.join(repoRoot, ".runtime", "codex-runtime-gateway");
const codexRuntimeEventsFile = path.join(codexRuntimeRoot, "events.jsonl");
const syncWorkspaceToMinioScriptRelative = path.join("..", "..", "scripts", "sync-workspace-file-to-minio.ps1");

const PORT = Number(process.env.PORT || 17080);
const PORTAL_STORAGE_MODE = String(process.env.PORTAL_STORAGE_MODE || "json").trim().toLowerCase();
const PORTAL_POSTGRES_URL = String(process.env.PORTAL_POSTGRES_URL || "postgres://postgres:postgres@127.0.0.1:5432/med_meta").trim();
const PORTAL_REDIS_URL = String(process.env.PORTAL_REDIS_URL || "redis://127.0.0.1:6379").trim();
const PORTAL_DB_NAMESPACE = String(process.env.PORTAL_DB_NAMESPACE || "portal").trim() || "portal";
const PORTAL_OPL_ADAPTER_URL = String(process.env.PORTAL_OPL_ADAPTER_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const OPL_WEB_URL = String(process.env.OPL_WEB_URL || "").replace(/\/$/, "");
const OPL_RUNTIME_TIMEOUT_MS = Number(process.env.OPL_RUNTIME_TIMEOUT_MS || 10000);
const LANGFUSE_URL = process.env.LANGFUSE_URL || "http://127.0.0.1:13000";
const OPENCOST_UI_URL = process.env.OPENCOST_UI_URL || "http://127.0.0.1:30090";
const KUBESPHERE_URL = process.env.KUBESPHERE_URL || "";
const RANCHER_URL = process.env.RANCHER_URL || "https://127.0.0.1:30443";
const HARBOR_URL = process.env.HARBOR_URL || "http://127.0.0.1:30095";
const HARBOR_API_URL = process.env.HARBOR_API_URL || HARBOR_URL;
const HARBOR_ENABLED = String(process.env.HARBOR_ENABLED || "").trim() === "1";
const HARBOR_USERNAME = process.env.HARBOR_USERNAME || "admin";
const HARBOR_PASSWORD = process.env.HARBOR_PASSWORD || "HarborAdmin123!";
const MINIO_CONSOLE_URL = process.env.MINIO_CONSOLE_URL || "http://127.0.0.1:30092";
const SHOW_LEGACY_KUBESPHERE = String(process.env.SHOW_LEGACY_KUBESPHERE || "").trim() === "1";
const MINIO_API_URL = process.env.MINIO_API_URL || "http://127.0.0.1:30091";
const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || "http://127.0.0.1:3311";
const mcBinary = path.join(repoRoot, ".runtime", "tools", "mc.exe");
const execFileAsync = promisify(execFile);

const adminSeed = {
  email: process.env.PORTAL_ADMIN_EMAIL || "zitadel-admin@zitadel.localhost",
  password: process.env.PORTAL_ADMIN_PASSWORD || "Password1!",
  name: process.env.PORTAL_ADMIN_NAME || "ZITADEL Admin",
};
const PORTAL_ADMIN_SEED_BALANCE = Number(process.env.PORTAL_ADMIN_SEED_BALANCE || 100);

const PORTAL_OIDC_ENABLED = String(process.env.PORTAL_OIDC_ENABLED || "1") !== "0";
const PORTAL_OIDC_ISSUER = process.env.PORTAL_OIDC_ISSUER || "https://auth.localhost:18443";
const PORTAL_OIDC_CLIENT_ID = process.env.PORTAL_OIDC_CLIENT_ID || "368843754573922307";
const PORTAL_OIDC_CLIENT_SECRET = process.env.PORTAL_OIDC_CLIENT_SECRET || "ddulXe78YePwKC2fYyVATNutBJS50BPhnSJutOxmplWm4chYeOiyusvwxUbx8iFM";
const PORTAL_OIDC_REDIRECT_URI = process.env.PORTAL_OIDC_REDIRECT_URI || "http://127.0.0.1:17080/auth/oidc/callback";
const PORTAL_OIDC_SCOPE = process.env.PORTAL_OIDC_SCOPE || "openid profile email";
const PORTAL_IDENTITY_SYNC_MODE = String(process.env.PORTAL_IDENTITY_SYNC_MODE || (PORTAL_OIDC_ENABLED ? "zitadel" : "local")).trim().toLowerCase();
const ZITADEL_ADMIN_USER_SCRIPT = path.join(repoRoot, "scripts", "zitadel-admin-user.mjs");

let dbWriteChain = Promise.resolve();
let pgPool = null;
let redisClient = null;

function normalizeBaseUrl(value, suffixes = []) {
  const parsed = new URL(value);
  for (const suffix of suffixes) {
    if (parsed.pathname.endsWith(suffix)) {
      parsed.pathname = parsed.pathname.slice(0, -suffix.length) || "/";
      break;
    }
  }
  if (!parsed.pathname) parsed.pathname = "/";
  return parsed.toString().replace(/\/$/, "");
}

function hashPassword(password) {
  return scryptSync(password, "portal-salt-v1", 64).toString("hex");
}

function verifyPassword(password, hashed) {
  const a = Buffer.from(hashPassword(password), "hex");
  const b = Buffer.from(hashed, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

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

function assertProductionSecret(name, value, defaults = []) {
  if (String(process.env.NODE_ENV || "").toLowerCase() !== "production") return;
  const normalized = String(value || "").trim();
  if (!normalized || defaults.includes(normalized)) {
    throw new Error(`production_config_invalid:${name}`);
  }
}

function validateProductionConfig() {
  assertProductionSecret("PORTAL_ADMIN_PASSWORD", adminSeed.password, ["Password1!"]);
  if (PORTAL_OIDC_ENABLED) {
    assertProductionSecret("PORTAL_OIDC_CLIENT_SECRET", PORTAL_OIDC_CLIENT_SECRET, ["ddulXe78YePwKC2fYyVATNutBJS50BPhnSJutOxmplWm4chYeOiyusvwxUbx8iFM"]);
  }
  if (HARBOR_ENABLED) {
    assertProductionSecret("HARBOR_PASSWORD", HARBOR_PASSWORD, ["HarborAdmin123!"]);
  }
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "task";
}

function looksLikeCorruptedTitle(value) {
  const text = String(value || "");
  const markers = new Set(["\u934a", "\u934f", "\u93c3", "\u6d60", "\u7eef", "\u9425", "\u6ae4", "\u9473", "\u95ab", "\u95c2", "\u7490", "\u5a23", "\u6769", "\u7ff1"]);
  let hits = 0;
  for (const char of text) {
    if (markers.has(char)) hits += 1;
    if (hits >= 2) return true;
  }
  return false;
}

function sanitizeTaskTitle(slug, title) {
  const normalizedSlug = slugify(slug || "default");
  const raw = String(title || "").trim();
  const normalizedRaw = raw.toLowerCase();
  if (["dup validation", "dup-validation", "mas"].includes(normalizedRaw)) {
    return "MAS";
  }
  if (!raw || raw === "????" || raw.includes("Workspace") || looksLikeCorruptedTitle(raw)) {
    return normalizedSlug === "default" ? "默认任务空间" : normalizedSlug;
  }
  return raw;
}

function defaultTaskTitle(slug = "default") {
  const normalizedSlug = slugify(slug || "default");
  return normalizedSlug === "default" ? "默认任务空间" : normalizedSlug;
}

function taskStatusLabel(status = "active") {
  const normalized = String(status || "active").toLowerCase();
  if (normalized === "archived") return "已归档";
  if (normalized === "deleted") return "已删除";
  if (normalized === "deleting") return "删除中";
  return "运行中";
}

function taskStatusClass(status = "active") {
  const normalized = String(status || "active").toLowerCase();
  if (normalized === "archived") return "warn";
  if (normalized === "deleted" || normalized === "deleting") return "danger";
  return "ok";
}

function sandboxStatusLabel(status = "unknown") {
  const normalized = String(status || "unknown").toLowerCase();
  if (normalized === "running") return "运行中";
  if (normalized === "idle") return "空闲";
  if (normalized === "hibernated") return "休眠";
  if (normalized === "terminated") return "已回收";
  if (normalized === "error") return "异常";
  if (normalized === "provisioning") return "启动中";
  return "未知";
}

function humanizeStatus(status = "unknown") {
  const normalized = String(status || "unknown").toLowerCase();
  if (["completed", "success", "finished"].includes(normalized)) return "已完成";
  if (normalized === "running") return "运行中";
  if (normalized === "active") return "活跃";
  if (normalized === "failed" || normalized === "error") return "失败";
  if (normalized === "archived") return "已归档";
  if (normalized === "disabled") return "已禁用";
  return String(status || "未知");
}

function userTheme(user) {
  const theme = String(user?.preferences?.theme || "light").toLowerCase();
  return ["dark", "light"].includes(theme) ? theme : "light";
}

function activeUserStatus(status = "active") {
  const normalized = String(status || "active").toLowerCase();
  return ["disabled", "deleted"].includes(normalized) ? normalized : "active";
}

function isBlockedUserStatus(status = "active") {
  return ["disabled", "deleted"].includes(activeUserStatus(status));
}

function normalizeAnnouncementScope(scope = "all") {
  const normalized = String(scope || "all").toLowerCase();
  return ["all", "user", "admin"].includes(normalized) ? normalized : "all";
}

function normalizeAnnouncementStatus(status = "active") {
  const normalized = String(status || "active").toLowerCase();
  return ["active", "inactive"].includes(normalized) ? normalized : "active";
}

function normalizeAnnouncementRecord(record) {
  if (!record || typeof record !== "object") return null;
  const title = String(record.title || "").trim();
  const content = String(record.content || "").trim();
  if (!title || !content) return null;
  const updatedAt = String(record.updatedAt || record.createdAt || new Date().toISOString());
  return {
    id: String(record.id || randomUUID()),
    title,
    content,
    scope: normalizeAnnouncementScope(record.scope),
    status: normalizeAnnouncementStatus(record.status),
    pinned: Boolean(record.pinned),
    createdAt: String(record.createdAt || updatedAt),
    updatedAt,
    operatorId: String(record.operatorId || ""),
  };
}

function announcementRows(db, viewer = null) {
  const rows = Array.isArray(db?.settings?.announcements)
    ? db.settings.announcements.map(normalizeAnnouncementRecord).filter(Boolean)
    : [];
  const viewerRole = String(viewer?.role || "user").toLowerCase();
  return rows
    .filter((item) => {
      if (!viewer) return true;
      if (viewerRole === "admin") {
        return item.scope === "all" || item.scope === "admin";
      }
      return item.scope === "all" || item.scope === "user";
    })
    .sort((a, b) => {
      if (Number(b.pinned) !== Number(a.pinned)) return Number(b.pinned) - Number(a.pinned);
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
}

function visibleAnnouncementRows(db, viewer = null) {
  return announcementRows(db, viewer).filter((item) => item.status === "active");
}

function formatDateTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDateOnly(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const billingClient = createBillingClient({ billingServiceUrl: BILLING_SERVICE_URL });
const minioStorageClient = createMinioStorageClient({
  repoRoot,
  portalWorkdir,
  mcBinary,
  minioApiUrl: MINIO_API_URL,
  syncWorkspaceToMinioScriptRelative,
  formatDateTime,
});
const harborRegistryClient = createHarborRegistryClient({
  harborApiUrl: HARBOR_API_URL,
  username: HARBOR_USERNAME,
  password: HARBOR_PASSWORD,
  formatDateTime,
});
const langfuseTraceClient = createLangfuseTraceClient({
  repoRoot,
  langfuseUrl: LANGFUSE_URL,
  formatDateTime,
});
const oplAdapterClient = createOplAdapterClient({
  adapterUrl: PORTAL_OPL_ADAPTER_URL,
  oplWebUrl: OPL_WEB_URL,
  timeoutMs: OPL_RUNTIME_TIMEOUT_MS,
  formatDateTime,
});
const oplLaunchService = createOplLaunchService({
  evaluateUserPolicy,
  findTaskSpace,
  ensureTaskSpace,
  ensureWorkspaceSession,
  createOplLaunch,
  defaultTaskTitle,
  logPortalEvent,
  writeDb,
});
const handleOplRoutes = createOplRoutes({
  appendCookie,
  layoutV2,
  oplLaunchService,
  readBody,
  sendHtml,
  sendJson,
  slugify,
  workspaceSessionCookie,
});

function isRegistrationEnabled(db) {
  return db?.settings?.allowRegistration !== false;
}

function userStatusLabel(status = "active") {
  return String(status || "active").toLowerCase() === "disabled" ? "已禁用" : "正常";
}

function chartDateKey(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function seriesForRecentDays(days) {
  const labels = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    labels.push(d.toISOString().slice(0, 10));
  }
  return labels;
}

function summarizeRunStatus(runs = []) {
  return runs.reduce((acc, run) => {
    const key = isRunTerminal(run) ? "completed" : "running";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { running: 0, completed: 0 });
}

function groupBillingByDay(items = [], days = 7) {
  const labels = seriesForRecentDays(days);
  const base = Object.fromEntries(labels.map((label) => [label, { total: 0, cpu: 0, gpu: 0, storage: 0 }]));
  for (const item of items) {
    const key = chartDateKey(item?.end || item?.start || item?.createdAt);
    if (!base[key]) continue;
    base[key].total += Number(item?.totalCost || 0);
    base[key].cpu += Number(item?.cpuCost || 0);
    base[key].gpu += Number(item?.gpuCost || 0);
    base[key].storage += Number(item?.pvCost || 0);
  }
  return {
    labels,
    total: labels.map((label) => Number(base[label].total.toFixed(5))),
    cpu: labels.map((label) => Number(base[label].cpu.toFixed(5))),
    gpu: labels.map((label) => Number(base[label].gpu.toFixed(5))),
    storage: labels.map((label) => Number(base[label].storage.toFixed(5))),
  };
}

function safeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

async function exists(file) {
  try {
    await access(file, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function atomicWriteJson(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  const content = JSON.stringify(value, null, 2);
  await writeFile(tmp, content, "utf8");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rename(tmp, file);
      return;
    } catch (error) {
      if (attempt === 4) {
        await writeFile(file, content, "utf8");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1)));
    }
  }
}

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
      user_id text NOT NULL,
      run_id text NOT NULL,
      workspace_id text NOT NULL,
      type text NOT NULL,
      amount numeric NOT NULL,
      reason text NOT NULL,
      operator_id text NOT NULL,
      created_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ${pgTableName("task_spaces")} (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      slug text NOT NULL,
      title text NOT NULL,
      path text NOT NULL,
      status text NOT NULL,
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

  for (const key of ["users", "sessions", "wallets", "ledger", "workspaceSessions", "userSandboxes", "groups"]) {
    if (!Array.isArray(db[key])) {
      db[key] = [];
      changed = true;
    }
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

  const [usersRes, walletsRes, ledgerRes, taskSpacesRes, sandboxesRes, groupsRes, settingsRes, eventsRes] = await Promise.all([
    pool.query(`SELECT * FROM ${pgTableName("users")}`),
    pool.query(`SELECT * FROM ${pgTableName("wallets")}`),
    pool.query(`SELECT * FROM ${pgTableName("ledger_entries")}`),
    pool.query(`SELECT * FROM ${pgTableName("task_spaces")}`),
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
      userId: row.user_id,
      runId: row.run_id,
      workspaceId: row.workspace_id,
      type: row.type,
      amount: Number(row.amount || 0),
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
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      archivedAt: row.archived_at instanceof Date ? row.archived_at.toISOString() : row.archived_at,
      deletedAt: row.deleted_at instanceof Date ? row.deleted_at.toISOString() : row.deleted_at,
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
      for (const row of db.ledger || []) {
        await client.query(`INSERT INTO ${pgTableName("ledger_entries")} (id,user_id,run_id,workspace_id,type,amount,reason,operator_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
          row.id, row.userId || "", row.runId || "", row.workspaceId || "", row.type || "", Number(row.amount || 0), row.reason || "", row.operatorId || "", row.createdAt || new Date().toISOString(),
        ]);
      }
      await client.query(`DELETE FROM ${pgTableName("task_spaces")}`);
      for (const row of db.taskSpaces || []) {
        await client.query(`INSERT INTO ${pgTableName("task_spaces")} (id,user_id,slug,title,path,status,created_at,updated_at,archived_at,deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
          row.id, row.userId, row.slug, row.title, row.path, row.status, row.createdAt || new Date().toISOString(), row.updatedAt || row.createdAt || new Date().toISOString(), row.archivedAt || null, row.deletedAt || null,
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

async function sendStaticAsset(res, filePath, contentType) {
  if (!(await exists(filePath))) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
    return;
  }
  const body = await readFile(filePath);
  res.writeHead(200, { "content-type": contentType, "cache-control": "no-cache" });
  res.end(body);
}

function guessContentType(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

function parseCookies(header) {
  const cookies = {};
  for (const part of String(header || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key) continue;
    cookies[key] = rest.join("=");
  }
  return cookies;
}

function appendCookie(res, cookieValue) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }
  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current, cookieValue]);
    return;
  }
  res.setHeader("Set-Cookie", [current, cookieValue]);
}

function setCookie(res, name, value) {
  appendCookie(res, `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`);
}

function clearCookie(res, name) {
  appendCookie(res, `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

function getTaskPath(userId, taskSlug) {
  return path.join(medWorkspaceRoot, userId, taskSlug);
}

function nextTaskSlug(db, userId, requestedTitle) {
  const baseSlug = slugify(requestedTitle || "task");
  const existing = new Set(
    db.taskSpaces.filter((item) => item.userId === userId).map((item) => item.slug),
  );
  if (!existing.has(baseSlug)) return baseSlug;
  let counter = 2;
  while (existing.has(`${baseSlug}-${counter}`)) counter += 1;
  return `${baseSlug}-${counter}`;
}

function safeRelativePath(value) {
  const normalized = path.normalize(String(value || "")).replace(/^([/\\])+/, "");
  if (!normalized || normalized === "." || normalized.startsWith("..") || path.isAbsolute(normalized)) return "";
  return normalized;
}

async function listFilesRecursive(rootDir, currentDir = rootDir, prefix = "") {
  try {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const relative = prefix ? path.join(prefix, entry.name) : entry.name;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listFilesRecursive(rootDir, fullPath, relative)));
      } else if (entry.isFile()) {
        files.push({ name: relative.replaceAll("\\", "/"), fullPath });
      }
    }
    return files.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function listTaskSpacesForUser(db, userId) {
  return db.taskSpaces
    .filter((item) => item.userId === userId && item.status !== "deleted")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .map((item) => ({
      ...item,
      title: sanitizeTaskTitle(item.slug || "default", item.title || ""),
    }));
}

function findTaskSpace(db, userId, slug) {
  const normalized = slugify(slug || "default");
  return db.taskSpaces.find((item) => item.userId === userId && item.slug === normalized) || null;
}

function currentTaskSpaceForUser(db, user) {
  return findTaskSpace(db, user.id, user.currentTaskSlug || "default");
}

function isRunTerminal(run) {
  const status = String(run?.status || "").toLowerCase();
  if (["succeeded", "failed", "cancelled", "timed_out", "completed"].includes(status)) return true;
  if (run?.k8sStatus?.succeeded) return true;
  const conditions = Array.isArray(run?.k8sStatus?.conditions) ? run.k8sStatus.conditions : [];
  return conditions.some((item) => ["Complete", "Failed"].includes(item?.type) && item?.status === "True");
}

async function hasActiveRuns(userId, workspaceId) {
  const runs = await collectRunsForTask(userId, workspaceId);
  return runs.some((run) => !isRunTerminal(run));
}

function hasActiveWorkspaceSession(db, userId, workspaceId) {
  const now = Date.now();
  return db.workspaceSessions.some((item) =>
    item.userId === userId &&
    item.workspaceId === workspaceId &&
    item.status === "active" &&
    (!item.expiresAt || Date.parse(item.expiresAt) > now),
  );
}

async function ensureTaskSpace(db, user, slug = "default", title = "Default Task") {
  const normalized = slugify(slug);
  const existing = db.taskSpaces.find((item) => item.userId === user.id && item.slug === normalized);
  if (existing) return existing;
  const taskSpace = {
    id: randomUUID(),
    userId: user.id,
    slug: normalized,
    title: sanitizeTaskTitle(normalized, title),
    path: getTaskPath(user.id, normalized),
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.taskSpaces.push(taskSpace);
  await mkdir(path.join(taskSpace.path, "inputs"), { recursive: true });
  await mkdir(path.join(taskSpace.path, "outputs"), { recursive: true });
  await mkdir(path.join(taskSpace.path, "logs"), { recursive: true });
  await mkdir(path.join(taskSpace.path, "runtime"), { recursive: true });
  await mkdir(path.join(taskSpace.path, "work"), { recursive: true });
  await ensureWorkspaceMinioSkeleton(user.id, taskSpace.slug, taskSpace.path);
  if (!user.currentTaskSlug) user.currentTaskSlug = taskSpace.slug;
  await logPortalEvent({ type: "workspace_created", userId: user.id, workspaceId: taskSpace.slug, title: taskSpace.title });
  return taskSpace;
}

async function archiveTaskSpace(db, user, taskSpace) {
  taskSpace.status = "archived";
  taskSpace.archivedAt = new Date().toISOString();
  taskSpace.updatedAt = taskSpace.archivedAt;
  if (user.currentTaskSlug === taskSpace.slug) {
    const fallback = listTaskSpacesForUser(db, user.id).find((item) => item.slug !== taskSpace.slug && item.status === "active");
    user.currentTaskSlug = fallback?.slug || "default";
  }
  await logPortalEvent({ type: "workspace_archived", userId: user.id, workspaceId: taskSpace.slug, title: taskSpace.title });
}

async function restoreTaskSpace(db, user, taskSpace) {
  taskSpace.status = "active";
  delete taskSpace.archivedAt;
  taskSpace.updatedAt = new Date().toISOString();
  user.currentTaskSlug = taskSpace.slug;
  await logPortalEvent({ type: "workspace_restored", userId: user.id, workspaceId: taskSpace.slug, title: taskSpace.title });
}

async function markTaskSpaceDeleted(db, user, taskSpace) {
  taskSpace.status = "deleted";
  taskSpace.deletedAt = new Date().toISOString();
  taskSpace.updatedAt = taskSpace.deletedAt;
  db.workspaceSessions = db.workspaceSessions.map((item) => {
    if (item.userId === user.id && item.workspaceId === taskSpace.slug && item.status === "active") {
      return { ...item, status: "revoked", revokedAt: new Date().toISOString() };
    }
    return item;
  });
  if (user.currentTaskSlug === taskSpace.slug) {
    const fallback = listTaskSpacesForUser(db, user.id).find((item) => item.slug !== taskSpace.slug && item.status === "active");
    user.currentTaskSlug = fallback?.slug || "default";
  }
  await logPortalEvent({ type: "workspace_deleted", userId: user.id, workspaceId: taskSpace.slug, title: taskSpace.title });
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

function workspaceSessionCookie() {
  return "workspace_session";
}

function clearWorkspaceSession(res) {
  clearCookie(res, workspaceSessionCookie());
}

function readWorkspaceSession(db, sessionId, userId = "") {
  if (!sessionId) return null;
  const now = Date.now();
  const match = db.workspaceSessions.find((item) => item.id === sessionId && item.status === "active");
  if (!match) return null;
  if (match.expiresAt && Date.parse(match.expiresAt) <= now) return null;
  if (userId && match.userId !== userId) return null;
  return match;
}

async function ensureWorkspaceSession(db, user, taskSpace) {
  const active = db.workspaceSessions.find((item) =>
    item.userId === user.id &&
    item.workspaceId === taskSpace.slug &&
    item.status === "active" &&
    (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()),
  );
  if (active) {
    active.lastUsedAt = new Date().toISOString();
    return active;
  }
  const session = {
    id: randomUUID(),
    userId: user.id,
    workspaceId: taskSpace.slug,
    workspaceTitle: taskSpace.title,
    sessionType: "opl_session",
    status: "active",
    source: "portal-workspace-entry",
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  };
  db.workspaceSessions.push(session);
  await logPortalEvent({ type: "workspace_session_created", userId: user.id, workspaceId: taskSpace.slug, workspaceSessionId: session.id });
  return session;
}

function latestActiveWorkspaceSession(db, userId, workspaceId) {
  return db.workspaceSessions
    .filter((item) =>
      item.userId === userId &&
      item.workspaceId === workspaceId &&
      item.status === "active" &&
      (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()),
    )
    .sort((a, b) => String(b.lastUsedAt || b.createdAt || "").localeCompare(String(a.lastUsedAt || a.createdAt || "")))[0] || null;
}

async function currentUser(req) {
  const db = await readDb();
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.portal_session;
  if (!sessionId) return { db, user: null };
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session) return { db, user: null };
  return { db, user: db.users.find((item) => item.id === session.userId) || null };
}

function oidcStateCookie() {
  return "portal_oidc_state";
}

function buildOidcAuthorizeUrl(state, prompt = "") {
  const url = new URL("/oauth/v2/authorize", `${PORTAL_OIDC_ISSUER}/`);
  url.searchParams.set("client_id", PORTAL_OIDC_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", PORTAL_OIDC_SCOPE);
  url.searchParams.set("redirect_uri", PORTAL_OIDC_REDIRECT_URI);
  url.searchParams.set("state", state);
  if (prompt) url.searchParams.set("prompt", prompt);
  return url.toString();
}

async function curlJson(args = []) {
  const { stdout } = await execFileAsync("curl.exe", ["-k", "-sS", ...args], {
    cwd: repoRoot,
    timeout: 60000,
    maxBuffer: 1024 * 1024 * 4,
  });
  return JSON.parse(String(stdout || "{}"));
}

async function exchangeOidcCode(code) {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: PORTAL_OIDC_REDIRECT_URI,
  }).toString();
  return curlJson([
    "-u", `${PORTAL_OIDC_CLIENT_ID}:${PORTAL_OIDC_CLIENT_SECRET}`,
    "-H", "content-type: application/x-www-form-urlencoded",
    "-d", form,
    `${PORTAL_OIDC_ISSUER}/oauth/v2/token`,
  ]);
}

async function fetchOidcUserInfo(accessToken) {
  return curlJson([
    "-H", `Authorization: Bearer ${accessToken}`,
    `${PORTAL_OIDC_ISSUER}/oidc/v1/userinfo`,
  ]);
}

async function runZitadelAdminUser(args = []) {
  if (PORTAL_IDENTITY_SYNC_MODE === "local") {
    return { synced: false, source: "portal_local_identity" };
  }
  if (PORTAL_IDENTITY_SYNC_MODE !== "zitadel") {
    throw new Error(`Unsupported PORTAL_IDENTITY_SYNC_MODE: ${PORTAL_IDENTITY_SYNC_MODE}`);
  }
  await access(ZITADEL_ADMIN_USER_SCRIPT, fsConstants.R_OK);
  await execFileAsync("node", [ZITADEL_ADMIN_USER_SCRIPT, ...args], {
    cwd: repoRoot,
    timeout: 180000,
    maxBuffer: 1024 * 1024 * 4,
  });
  return { synced: true, source: "zitadel_portal_sync" };
}

function sendHtml(res, html, status = 200) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendJson(res, payload, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function parseForm(body) {
  const params = new URLSearchParams(body);
  const obj = {};
  for (const [key, value] of params.entries()) obj[key] = value;
  return obj;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function layoutV2(title, body, user, options = {}) {
  const page = options.page || "default";
  const bootstrap = safeJsonForHtml(options.bootstrap || {});
  const theme = userTheme(user);
  const isAdminPage = page.startsWith("admin");
  const navItems = user ? [
    { href: "/portal", label: "首页", active: page === "overview" },
    { href: "/portal/opl", label: "OPL 工作台", active: page === "default" || page === "workspace" },
    { href: "/portal/workspace", label: "任务空间", active: page === "workspace" },
    { href: "/portal/billing", label: "账单", active: page === "billing" },
    ...(user.role === "admin" ? [{ href: "/portal/admin", label: "管理后台", active: isAdminPage }] : []),
  ] : [];
  const adminItems = user?.role === "admin" ? [
    { href: "/portal/admin", label: "仪表盘", active: page === "admin-dashboard" || page === "admin" },
    { href: "/portal/admin/alerts", label: "告警中心", active: page === "admin-alerts" },
    { href: "/portal/admin/users", label: "用户管理", active: page === "admin-users" || page === "admin-user-more" },
    { href: "/portal/admin/groups", label: "分组与订阅", active: page === "admin-groups" },
    { href: "/portal/admin/usage", label: "使用记录", active: page === "admin-usage" },
    { href: "/portal/admin/billing-ops", label: "计费运维", active: page === "admin-billing-ops" },
    { href: "/portal/admin/system", label: "系统入口", active: page === "admin-system" },
    { href: "/portal/admin/ops", label: "运维监控", active: page === "admin-ops" },
    { href: "/portal/admin/sandboxes", label: "沙箱与分发", active: page === "admin-sandboxes" },
    { href: "/portal/admin/audit", label: "审计日志", active: page === "admin-audit" },
  ] : [];
  const chrome = user ? `
    <div class="app-shell">
      <aside class="app-sidebar">
        <div class="brand-block">
          <div class="brand-title">Portal</div>
          <div class="brand-subtitle">${user.role === "admin" ? "商用运营后台" : "研究工作台"}</div>
        </div>
        <div class="sidebar-group">
          <div class="sidebar-heading">主导航</div>
          ${navItems.map((item) => `<a class="sidebar-link ${item.active ? "active" : ""}" href="${item.href}">${item.label}</a>`).join("")}
        </div>
        ${adminItems.length ? `<div class="sidebar-group">
          <div class="sidebar-heading">管理后台</div>
          ${adminItems.map((item) => `<a class="sidebar-link ${item.active ? "active" : ""}" href="${item.href}">${item.label}</a>`).join("")}
        </div>` : ""}
        <div class="sidebar-group sidebar-meta">
          <div class="sidebar-heading">账户</div>
          <div class="sidebar-user">${user.name || user.email}</div>
          <div class="sidebar-email">${user.email}</div>
        </div>
        <div class="sidebar-actions">
          <button id="theme-toggle" type="button" class="sidebar-button">切换主题</button>
          <a href="/logout" class="sidebar-link subtle">退出登录</a>
        </div>
      </aside>
      <main class="app-main">${body}</main>
    </div>
  ` : `<div class="auth-shell">${body}</div>`;

  return `<!doctype html>
  <html lang="zh-CN" data-theme="${theme}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${title}</title>
      <style>
        :root {
          --bg: #06111c;
          --sidebar: rgba(5, 12, 23, .92);
          --panel: rgba(10,18,34,.84);
          --panel-border: rgba(92,126,168,.22);
          --text: #eef6ff;
          --muted: #8ca3c3;
          --accent: #29c8ff;
          --accent-2: #52f1c7;
          --success: #65ffbf;
          --warning: #ffd666;
          --danger: #ff6b81;
          --shadow: 0 24px 70px rgba(0,0,0,.35);
        }
        html[data-theme="light"] {
          --bg: #eef5ff;
          --sidebar: rgba(255,255,255,.94);
          --panel: rgba(255,255,255,.92);
          --panel-border: rgba(92,126,168,.18);
          --text: #0f2746;
          --muted: #5f7799;
          --accent: #1368ff;
          --accent-2: #00a884;
          --success: #00a884;
          --warning: #d99700;
          --danger: #d64563;
          --shadow: 0 24px 60px rgba(31,58,104,.12);
        }
        body {
          font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
          margin: 0;
          min-height: 100vh;
          color: var(--text);
          background:
            radial-gradient(circle at top left, rgba(56,214,255,.18), transparent 28%),
            radial-gradient(circle at top right, rgba(101,255,191,.14), transparent 24%),
            linear-gradient(180deg, #04101d 0%, #07111f 45%, #040a14 100%);
        }
        html[data-theme="light"] body {
          background:
            radial-gradient(circle at top left, rgba(19,104,255,.12), transparent 28%),
            radial-gradient(circle at top right, rgba(0,168,132,.10), transparent 24%),
            linear-gradient(180deg, #f7fbff 0%, #eef5ff 45%, #e8f0fb 100%);
        }
        .app-shell { display: grid; grid-template-columns: 268px minmax(0, 1fr); min-height: 100vh; }
        .app-sidebar {
          background: var(--sidebar);
          border-right: 1px solid var(--panel-border);
          padding: 28px 18px 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          position: sticky;
          top: 0;
          height: 100vh;
          box-sizing: border-box;
          backdrop-filter: blur(18px);
        }
        .app-main { padding: 28px; min-width: 0; }
        .auth-shell { max-width: 720px; margin: 0 auto; padding: 56px 28px; }
        .brand-block { padding: 8px 10px 18px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .brand-title { font-size: 22px; font-weight: 700; letter-spacing: .03em; }
        .brand-subtitle { color: var(--muted); font-size: 13px; margin-top: 8px; }
        .sidebar-group { display: flex; flex-direction: column; gap: 6px; }
        .sidebar-heading { color: var(--muted); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; padding: 0 10px 6px; }
        .sidebar-link {
          display: flex;
          align-items: center;
          min-height: 44px;
          border-radius: 14px;
          padding: 0 12px;
          color: var(--text);
          background: rgba(255,255,255,.02);
          border: 1px solid transparent;
          transition: background .2s ease, border-color .2s ease, transform .2s ease;
        }
        .sidebar-link:hover { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.08); transform: translateX(2px); }
        .sidebar-link.active { background: linear-gradient(135deg, rgba(41,200,255,.16), rgba(82,241,199,.12)); border-color: rgba(41,200,255,.36); }
        .sidebar-link.subtle { margin-top: 4px; }
        .sidebar-meta {
          margin-top: auto;
          border-top: 1px solid rgba(255,255,255,.08);
          padding-top: 18px;
        }
        .sidebar-user { font-weight: 600; padding: 0 10px 4px; }
        .sidebar-email { color: var(--muted); font-size: 13px; padding: 0 10px; word-break: break-all; }
        .sidebar-actions { display: flex; flex-direction: column; gap: 10px; }
        .sidebar-button {
          width: 100%;
          min-height: 44px;
          border-radius: 14px;
        }
        .hero { margin-bottom: 22px; padding: 28px; border-radius: 22px; background: linear-gradient(135deg, rgba(10,18,34,.92), rgba(7,17,31,.82)); border: 1px solid rgba(56,214,255,.18); box-shadow: var(--shadow); }
        html[data-theme="light"] .hero { background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(239,246,255,.96)); border-color: rgba(19,104,255,.12); }
        .hero h1 { margin: 0 0 8px; font-size: 34px; letter-spacing: .02em; }
        .hero p { margin: 0; color: var(--muted); }
        .card { background: var(--panel); border: 1px solid var(--panel-border); border-radius: 18px; padding: 20px; margin-bottom: 18px; box-shadow: var(--shadow); min-width: 0; }
        .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
        .grid-2 { display: grid; grid-template-columns: 1fr; gap: 18px; }
        .grid-dashboard { display: grid; grid-template-columns: 2fr 1.2fr; gap: 18px; align-items: start; }
        .grid-dashboard.equal { grid-template-columns: 1fr 1fr; align-items: stretch; }
        .stack-lg { display: grid; gap: 18px; }
        .metric { padding: 18px; border-radius: 16px; background: linear-gradient(180deg, rgba(16,29,51,.86), rgba(8,15,28,.92)); border: 1px solid rgba(56,214,255,.12); }
        html[data-theme="light"] .metric { background: linear-gradient(180deg, rgba(255,255,255,.94), rgba(243,248,255,.98)); border-color: rgba(19,104,255,.10); }
        .metric small { display: block; color: var(--muted); margin-bottom: 8px; }
        .metric strong { font-size: 28px; }
        input, button, select, textarea { font: inherit; padding: 11px 13px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; width: 100%; box-sizing: border-box; background: rgba(6,13,24,.82); color: var(--text); }
        html[data-theme="light"] input, html[data-theme="light"] button, html[data-theme="light"] select, html[data-theme="light"] textarea { background: rgba(255,255,255,.92); border-color: rgba(19,104,255,.12); }
        button { cursor: pointer; width: auto; background: linear-gradient(135deg, rgba(56,214,255,.18), rgba(101,255,191,.16)); border-color: rgba(101,255,191,.28); color: var(--text); }
        a { color: var(--accent); text-decoration: none; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,.08); text-align: left; }
        th { color: var(--muted); font-weight: 500; white-space: nowrap; }
        td { vertical-align: top; }
        code { background: rgba(255,255,255,.08); padding: 2px 6px; border-radius: 6px; }
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); font-size: 12px; }
        .status-badge.ok { border-color: rgba(101,255,191,.28); background: rgba(101,255,191,.12); }
        .status-badge.warn { border-color: rgba(255,214,102,.28); background: rgba(255,214,102,.12); }
        .status-badge.danger { border-color: rgba(255,107,129,.28); background: rgba(255,107,129,.12); }
        .action-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .action-row form { margin: 0; }
        .section-head { display: flex; justify-content: space-between; align-items: end; gap: 12px; margin-bottom: 14px; }
        .section-head h2, .card h2 { margin: 0; }
        .section-head .hint { margin-left: auto; }
        .button-danger { background: linear-gradient(135deg, rgba(255,107,129,.18), rgba(255,107,129,.12)); border-color: rgba(255,107,129,.32); }
        .chart { width: 100%; min-height: 320px; }
        .chart-sm { min-height: 260px; }
        .chart-lg { min-height: 380px; }
        .explain { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .hint { color: var(--muted); font-size: 13px; }
        .list { margin: 0; padding-left: 18px; }
        .table-wrap { overflow: auto; max-height: 360px; }
        .page-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; }
        .system-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; }
        .system-card { display: grid; gap: 10px; min-height: 180px; }
        .system-card .status-badge { width: fit-content; }
        .metric-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
        .metric-grid-6 { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 18px; }
        .muted-chip { display: inline-flex; align-items: center; min-height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.08); color: var(--muted); }
        .portal-dialog { width: min(720px, calc(100vw - 32px)); border: 1px solid var(--panel-border); border-radius: 18px; background: var(--panel); color: var(--text); box-shadow: var(--shadow); padding: 20px; }
        .portal-dialog::backdrop { background: rgba(1, 7, 16, .72); backdrop-filter: blur(6px); }
        .dialog-close-row { display: flex; justify-content: flex-end; margin-bottom: 12px; }
        .user-modal-panel { display: grid; gap: 12px; }
        @media (max-width: 980px) {
          .app-shell { grid-template-columns: 1fr; }
          .app-sidebar { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--panel-border); }
          .app-main { padding: 18px; }
          .grid-dashboard { grid-template-columns: 1fr; }
          .grid { grid-template-columns: 1fr 1fr; }
          .metric-grid-4, .metric-grid-6 { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 720px) {
          .grid { grid-template-columns: 1fr; }
          .metric-grid-4, .metric-grid-6 { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      ${chrome}
      <script id="portal-bootstrap" type="application/json">${bootstrap}</script>
      <script>window.__PORTAL_PAGE__=${JSON.stringify(page)};</script>
    </body>
  </html>`;
}

function layout(title, body, user, options = {}) {
  return layoutV2(title, body, user, options);
}

function readBillingRequestOptions(url) {
  return {
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    pageSize: url.searchParams.get("page_size"),
    tasksPage: url.searchParams.get("tasks_page"),
    ledgerPage: url.searchParams.get("ledger_page"),
    runsPage: url.searchParams.get("runs_page"),
  };
}

function readOverviewRequestOptions(url) {
  return {
    tasksPage: url.searchParams.get("tasks_page"),
    runsPage: url.searchParams.get("runs_page"),
  };
}

function readWorkspaceRequestOptions(url) {
  return {
    task: url.searchParams.get("task"),
    tasksPage: url.searchParams.get("tasks_page"),
    runsPage: url.searchParams.get("runs_page"),
    inputsPage: url.searchParams.get("inputs_page"),
    outputsPage: url.searchParams.get("outputs_page"),
  };
}

function readSessionsRequestOptions(url) {
  return {
    page: url.searchParams.get("page"),
    pageSize: url.searchParams.get("page_size"),
    limit: url.searchParams.get("limit"),
  };
}

function readTracesRequestOptions(url) {
  return {
    userId: url.searchParams.get("userId"),
    workspaceId: url.searchParams.get("workspaceId"),
    runId: url.searchParams.get("runId"),
    sessionId: url.searchParams.get("sessionId"),
    status: url.searchParams.get("status"),
    page: url.searchParams.get("page"),
    pageSize: url.searchParams.get("page_size"),
    limit: url.searchParams.get("limit"),
  };
}

async function fetchBillingSummary(customerId, workspaceId = "", windowValue = "24h") {
  return billingClient.fetchSummary(customerId, workspaceId, windowValue);
}

async function ensureWorkspaceMinioSkeleton(userId, taskSlug, taskPath) {
  return minioStorageClient.ensureWorkspaceSkeleton(userId, taskSlug, taskPath);
}

async function fetchPendingSummary(customerId = "", workspaceId = "", windowValue = "168h") {
  return billingClient.fetchPendingSummary(customerId, workspaceId, windowValue);
}

async function fetchBillingStatus() {
  return billingClient.fetchStatus();
}

async function fetchMinioSummary() {
  return minioStorageClient.fetchSummary();
}

async function fetchHarborSummary() {
  return harborRegistryClient.fetchSummary();
}

async function createOplLaunch({ user, taskSpace, workspaceSession, requireRealOplWeb = false }) {
  return oplAdapterClient.createLaunch({ user, taskSpace, workspaceSession, requireRealOplWeb });
}

async function fetchLangfuseSummary() {
  return langfuseTraceClient.fetchSummary();
}

function workspaceChatSessionsForUser(db, user, limit = 20) {
  return (db.workspaceSessions || [])
    .filter((item) => item.userId === user.id)
    .sort((a, b) => String(b.lastUsedAt || b.createdAt || "").localeCompare(String(a.lastUsedAt || a.createdAt || "")))
    .slice(0, limit)
    .map((item) => ({
      sessionId: item.id,
      sessionType: "mas",
      source: "portal_workspace_sessions",
      type: "live",
      userId: item.userId,
      userName: user.name || user.email || "",
      email: user.email || "",
      workspaceId: item.workspaceId || "",
      workspaceSessionId: item.id,
      lastUsedAt: item.lastUsedAt || item.createdAt || "",
      expiresAt: item.expiresAt || "",
      status: item.status || "unknown",
    }));
}

async function fetchTraceRows({ userId = "", workspaceId = "", runId = "", limit = 20 } = {}) {
  return langfuseTraceClient.fetchTraceRows({ userId, workspaceId, runId, limit });
}

async function fetchOplAdapterRuns() {
  return oplAdapterClient.fetchRuns();
}

async function fetchOplAdapterTraceRows({ userId = "", workspaceId = "", runId = "", limit = 200 } = {}) {
  return oplAdapterClient.fetchTraceRows({ userId, workspaceId, runId, limit });
}

async function fetchOplAdapterCosts({ userId = "", workspaceId = "", runId = "" } = {}) {
  return oplAdapterClient.fetchCosts({ userId, workspaceId, runId });
}

async function fetchWorkspaceStorageSnapshot(taskSpace) {
  const inputDir = path.join(taskSpace.path, "inputs");
  const outputDir = path.join(taskSpace.path, "outputs");
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  const files = await listFilesRecursive(inputDir);
  const outputs = await listFilesRecursive(outputDir);
  const inputBytes = (await Promise.all(files.map((item) => stat(item.fullPath).then((meta) => meta.size).catch(() => 0)))).reduce((sum, item) => sum + item, 0);
  const outputBytes = (await Promise.all(outputs.map((item) => stat(item.fullPath).then((meta) => meta.size).catch(() => 0)))).reduce((sum, item) => sum + item, 0);
  return {
    source: "workspace_file_system",
    type: "live",
    workspaceId: taskSpace.slug,
    inputsCount: files.length,
    outputsCount: outputs.length,
    inputBytes,
    outputBytes,
    files,
    outputs,
  };
}

async function fetchWorkspaceMinioState(userId, taskSlug) {
  return minioStorageClient.fetchWorkspaceState(userId, taskSlug);
}

async function fetchHarborImageRows(limit = 50) {
  return harborRegistryClient.fetchImageRows(limit);
}

async function probe(url) {
  if (!url) return { ok: false, status: "未配置" };
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { redirect: "manual" });
    return { ok: true, status: String(response.status), responseMs: Date.now() - startedAt };
  } catch {
    return { ok: false, status: "不可达", responseMs: Date.now() - startedAt };
  }
}

async function handleUpload(req, res, user) {
  const url = new URL(req.url || "/", "http://local");
  const taskSlug = slugify(url.searchParams.get("task") || "default");
  const contentType = String(req.headers["content-type"] || "");
  const match = contentType.match(/boundary=(.+)$/);
  if (!match) {
    sendHtml(res, layoutV2("上传失败", `<div class="card">上传请求缺少 multipart boundary。</div>`, user), 400);
    return;
  }

  const body = await readBody(req);
  const text = body.toString("binary");
  const parts = text.split(`--${match[1]}`).filter((part) => part.includes("filename="));
  const { db } = await currentUser(req);
  const taskSpace = await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
  if (taskSpace.status !== "active") {
    sendHtml(res, layoutV2("任务空间不可上传", `<div class="card"><h2>当前任务空间不可上传</h2><p class="hint">只有 active 状态的任务空间才能继续上传文件与发起新运行。</p></div>`, user), 409);
    return;
  }

  const inputDir = path.join(taskSpace.path, "inputs");
  await mkdir(inputDir, { recursive: true });
  let fileCount = 0;
  for (const part of parts) {
    const nameMatch = part.match(/filename="([^"]+)"/);
    if (!nameMatch) continue;
    const filename = nameMatch[1];
    const splitIndex = part.indexOf("\r\n\r\n");
    if (splitIndex === -1) continue;
    const content = part.slice(splitIndex + 4, part.lastIndexOf("\r\n"));
    const targetFile = path.join(inputDir, filename);
    await writeFile(targetFile, Buffer.from(content, "binary"));
    fileCount += 1;
    await syncWorkspaceFileToMinio(user.id, taskSpace.slug, "inputs", targetFile, filename);
  }
  await logPortalEvent({ type: "workspace_input_uploaded", userId: user.id, workspaceId: taskSpace.slug, fileCount });
  await writeDb(db);
  res.writeHead(302, { Location: `/portal/workspace?task=${encodeURIComponent(taskSpace.slug)}` });
  res.end();
}

async function syncWorkspaceFileToMinio(userId, taskSlug, kind, filePath, relativePath = "") {
  return minioStorageClient.syncWorkspaceFile(userId, taskSlug, kind, filePath, relativePath);
}

async function readDirSafe(dir) {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function createZipFromDir(sourceDir, outFile) {
  await execFileAsync("powershell", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${outFile}' -Force`,
  ], { timeout: 60000, maxBuffer: 1024 * 1024 });
}

function sendFile(res, filePath, downloadName, contentType = "application/octet-stream") {
  res.writeHead(200, {
    "content-type": contentType,
    "content-disposition": `attachment; filename="${downloadName}"`,
  });
  createReadStream(filePath).pipe(res);
}

async function collectRunsForUser(userId) {
  const items = [];
  const files = await readDirSafe(medRunsRoot);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const json = JSON.parse(await readFile(path.join(medRunsRoot, file), "utf8"));
      if (json.userId === userId || json.customerId === userId) items.push(json);
    } catch {}
  }
  if (await exists(codexRuntimeEventsFile)) {
    try {
      const raw = await readFile(codexRuntimeEventsFile, "utf8");
      const lines = raw.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.type !== "codex_runtime_run") continue;
          if (event.portalUserId !== userId) continue;
          items.push({
            runId: event.runId,
            userId: event.portalUserId,
            customerId: event.portalUserId,
            workspaceId: event.workspaceId,
            workspaceSessionId: event.workspaceSessionId || "",
            status: Number(event.exitCode || 0) === 0 ? "completed" : "failed",
            exitCode: Number(event.exitCode || 0),
            createdAt: event.occurredAt,
            source: "codex_runtime",
            stdoutFile: event.stdoutFile || "",
            stderrFile: event.stderrFile || "",
          });
        } catch {}
      }
    } catch {}
  }
  const deduped = new Map();
  for (const item of items) {
    const key = item?.runId || randomUUID();
    const existing = deduped.get(key);
    if (!existing || String(item.createdAt || "") > String(existing.createdAt || "")) {
      deduped.set(key, item);
    }
  }
  const merged = [...deduped.values()];
  merged.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return merged;
}

async function evaluateUserPolicy(db, user) {
  const group = db.groups.find((item) =>
    item.id === user.groupId &&
    String(item.status || "active").toLowerCase() === "active",
  ) || null;
  const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
  const concurrentRuns = (await collectRunsForUser(user.id)).filter((run) => !isRunTerminal(run)).length;
  const workspaceCount = db.taskSpaces.filter((item) =>
    item.userId === user.id &&
    !["deleted", "deleting"].includes(String(item.status || "").toLowerCase()),
  ).length;

  const allowMas = group ? group.allowMas !== false : true;
  let allowWorkspaceCreate = group ? group.allowWorkspaceCreate !== false : true;
  const blocks = [];

  if (isBlockedUserStatus(user.status)) {
    blocks.push("当前账号已被禁用");
  }

  if (group) {
    const balanceFloor = Number(group.balanceFloor || 0);
    if (balanceFloor > 0 && Number(wallet.balance || 0) < balanceFloor) {
      blocks.push(`当前余额低于分组门槛（${balanceFloor.toFixed(2)}）`);
    }

    const maxConcurrentRuns = Number(group.maxConcurrentRuns || 0);
    if (maxConcurrentRuns > 0 && concurrentRuns >= maxConcurrentRuns) {
      blocks.push(`已达到分组并发运行上限（${maxConcurrentRuns}）`);
    }

    const maxWorkspaces = Number(group.maxWorkspaces || 0);
    if (maxWorkspaces > 0 && workspaceCount >= maxWorkspaces) {
      allowWorkspaceCreate = false;
    }
  }

  return {
    group,
    wallet,
    concurrentRuns,
    workspaceCount,
    allowMas,
    allowWorkspaceCreate,
    blocks,
    blocked: blocks.length > 0,
  };
}

function groupNameById(db, groupId = "") {
  if (!groupId) return "";
  const group = db.groups.find((item) => item.id === groupId);
  return group?.name || "";
}

async function collectRunsForTask(userId, workspaceId) {
  const runs = await collectRunsForUser(userId);
  return runs.filter((item) => item.workspaceId === workspaceId);
}

function summarizeTaskRuns(runs) {
  const latestRun = runs[0] || null;
  const completed = runs.filter((run) => isRunTerminal(run)).length;
  return { latestRun, totalRuns: runs.length, completed };
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function microMoney(value) {
  return Number(value || 0).toFixed(5);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function parseHourWindow(value) {
  const raw = String(value || "").trim();
  if (!/^\d+h$/.test(raw)) return null;
  const hours = Number(raw.slice(0, -1));
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

function withinHourWindow(isoString, hours) {
  if (!hours) return true;
  const ts = Date.parse(String(isoString || ""));
  if (!Number.isFinite(ts)) return false;
  return ts >= Date.now() - hours * 60 * 60 * 1000;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePageSize(value) {
  const parsed = parsePositiveInt(value, 5);
  return [5, 10, 20].includes(parsed) ? parsed : 5;
}

function paginateRows(rows = [], pageValue = 1, pageSizeValue = 5) {
  const total = rows.length;
  const pageSize = normalizePageSize(pageSizeValue);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(parsePositiveInt(pageValue, 1), 1), totalPages);
  const start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}

function taskCostSummary(taskSlug, runs, billingItems) {
  const runIds = new Set(runs.filter((run) => run.workspaceId === taskSlug).map((run) => run.runId));
  const related = billingItems.filter((item) => {
    const runId = item?.properties?.["label:run_id"] || item?.properties?.run_id || "";
    return runIds.has(runId);
  });
  return related.reduce((acc, item) => {
    acc.cpuCost += Number(item?.cpuCost || 0);
    acc.gpuCost += Number(item?.gpuCost || 0);
    acc.pvCost += Number(item?.pvCost || 0);
    acc.totalCost += Number(item?.totalCost || 0);
    return acc;
  }, { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 });
}

function rangeBounds(rangeKey = "today", fromValue = "", toValue = "") {
  const now = new Date();
  if (rangeKey === "custom") {
    const from = new Date(String(fromValue || ""));
    const to = new Date(String(toValue || ""));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { start: null, end: null };
    to.setHours(23, 59, 59, 999);
    return { start: from, end: to };
  }
  if (rangeKey === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  if (rangeKey === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
}

function withinDateRange(value, range) {
  if (!range?.start || !range?.end) return true;
  const ts = Date.parse(String(value || ""));
  if (!Number.isFinite(ts)) return false;
  return ts >= range.start.getTime() && ts <= range.end.getTime();
}

function netSpent(entries = []) {
  return Number((-entries.reduce((sum, item) => {
    if (!["resource_charge", "makeup_charge", "refund"].includes(item.type)) return sum;
    return sum + Number(item.amount || 0);
  }, 0)).toFixed(5));
}

async function buildOverviewPayload(db, user, options = {}) {
  const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
  const tasks = listTaskSpacesForUser(db, user.id);
  const runs = await collectRunsForUser(user.id);
  const billing = await fetchBillingSummary(user.id, "", "168h");
  const items = billing?.items || [];
  const taskTitleMap = new Map(tasks.map((task) => [task.slug, task.title]));
  const todayRange = rangeBounds("today");
  const todayCost = items
    .filter((item) => withinDateRange(item?.end || item?.start || item?.createdAt, todayRange))
    .reduce((sum, item) => sum + Number(item?.totalCost || 0), 0);

  const taskRows = tasks.map((task) => ({
    slug: task.slug,
    title: task.title,
    status: task.status,
    runCount: runs.filter((run) => run.workspaceId === task.slug).length,
    updatedAt: formatDateTime(task.updatedAt || task.createdAt || ""),
  }));

  const latestRunsAll = runs.map((run) => ({
    runId: run.runId,
    workspaceId: run.workspaceId,
    workspaceTitle: taskTitleMap.get(run.workspaceId) || run.workspaceId || "-",
    status: isRunTerminal(run) ? "completed" : (run.status || "running"),
    createdAt: run.createdAt || "",
    displayTime: formatDateTime(run.createdAt || ""),
  }));

  const taskPagination = paginateRows(taskRows, options.tasksPage, 5);
  const latestRunsPagination = paginateRows(latestRunsAll, options.runsPage, 5);

  return {
    kpis: {
      accountStatus: activeUserStatus(user.status),
      balance: Number(wallet.balance || 0),
      todayCost: Number(todayCost.toFixed(5)),
      historicalCost: netSpent(db.ledger.filter((item) => item.userId === user.id)),
      activeTasks: tasks.filter((item) => item.status === "active").length,
      workspaceCount: tasks.filter((item) => !["deleted", "deleting"].includes(String(item.status || "").toLowerCase())).length,
      runCount: runs.length,
    },
    taskCards: taskPagination.rows,
    taskPagination: {
      page: taskPagination.page,
      pageSize: taskPagination.pageSize,
      total: taskPagination.total,
      totalPages: taskPagination.totalPages,
    },
    latestRuns: latestRunsPagination.rows,
    latestRunsPagination: {
      page: latestRunsPagination.page,
      pageSize: latestRunsPagination.pageSize,
      total: latestRunsPagination.total,
      totalPages: latestRunsPagination.totalPages,
    },
  };
}

async function buildBillingPayload(db, user, options = {}) {
  const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
  const pageSize = normalizePageSize(options.pageSize);
  const fromValue = String(options.from || "").trim();
  const toValue = String(options.to || "").trim();
  const rangeKey = fromValue || toValue ? "custom" : "30d";
  const fallbackStart = new Date();
  fallbackStart.setDate(fallbackStart.getDate() - 29);
  const normalizedFrom = fromValue || formatDateOnly(fallbackStart);
  const normalizedTo = toValue || formatDateOnly(new Date());
  const range = rangeBounds(rangeKey, normalizedFrom, normalizedTo);
  const billing = await fetchBillingSummary(user.id, "", "720h");
  const items = billing?.items || [];
  const runs = await collectRunsForUser(user.id);
  const filteredItems = items.filter((item) => withinDateRange(item?.end || item?.start || item?.createdAt, range));
  const filteredRuns = runs.filter((run) => withinDateRange(run.createdAt || "", range));
  const filteredLedger = db.ledger
    .filter((item) => item.userId === user.id)
    .filter((item) => withinDateRange(item.createdAt || "", range))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const totals = filteredItems.reduce((acc, item) => {
    acc.cpuCost += Number(item?.cpuCost || 0);
    acc.gpuCost += Number(item?.gpuCost || 0);
    acc.pvCost += Number(item?.pvCost || 0);
    acc.totalCost += Number(item?.totalCost || 0);
    return acc;
  }, { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 });

  const taskCostsAll = listTaskSpacesForUser(db, user.id).map((task) => {
    const taskTotals = taskCostSummary(task.slug, filteredRuns, filteredItems);
    return {
      slug: task.slug,
      title: task.title,
      totalCost: Number(taskTotals.totalCost || 0),
      cpuCost: Number(taskTotals.cpuCost || 0),
      gpuCost: Number(taskTotals.gpuCost || 0),
      storageCost: Number(taskTotals.pvCost || 0),
      runCount: filteredRuns.filter((run) => run.workspaceId === task.slug).length,
    };
  }).sort((a, b) => b.totalCost - a.totalCost);

  const allRunCosts = filteredRuns.map((run) => {
    const related = filteredItems.find((item) => item?.properties?.["label:run_id"] === run.runId || item?.properties?.run_id === run.runId || item?.name?.includes(run.runId));
    const pricingSource = related?.properties?.["label:pricing_source"] || related?.properties?.pricing_source || (related ? "OpenCost aggregated" : "metering pending");
    return {
      runId: run.runId,
      workspaceId: run.workspaceId,
      cpuCost: Number(related?.cpuCost || 0),
      gpuCost: Number(related?.gpuCost || 0),
      storageCost: Number(related?.pvCost || 0),
      totalCost: Number(related?.totalCost || 0),
      startedAt: related?.start || run.createdAt || "",
      endedAt: related?.end || "",
      pricingSource,
      runStatus: run.status || (isRunTerminal(run) ? "completed" : "running"),
    };
  }).sort((a, b) => String(b.endedAt || b.startedAt || "").localeCompare(String(a.endedAt || a.startedAt || "")));

  const taskPagination = paginateRows(taskCostsAll, options.tasksPage, pageSize);
  const ledgerPagination = paginateRows(filteredLedger, options.ledgerPage, pageSize);
  const runPagination = paginateRows(allRunCosts, options.runsPage, pageSize);
  return {
    wallet: {
      balance: Number(wallet.balance || 0),
    },
    totals,
    summary: {
      selectedCost: Number(totals.totalCost.toFixed(5)),
      runCount: filteredRuns.length,
      workspaceCount: taskCostsAll.filter((item) => item.runCount > 0 || item.totalCost > 0).length,
    },
    breakdown: {
      cpuCost: Number(totals.cpuCost.toFixed(5)),
      gpuCost: Number(totals.gpuCost.toFixed(5)),
      storageCost: Number(totals.pvCost.toFixed(5)),
      vpnCost: 0,
      trafficCost: 0,
      otherCloudCost: 0,
      cloudSource: "not_connected",
    },
    taskCosts: taskPagination.rows,
    taskPagination: {
      page: taskPagination.page,
      pageSize: taskPagination.pageSize,
      total: taskPagination.total,
      totalPages: taskPagination.totalPages,
    },
    runCosts: runPagination.rows,
    runPagination: {
      page: runPagination.page,
      pageSize: runPagination.pageSize,
      total: runPagination.total,
      totalPages: runPagination.totalPages,
    },
    ledger: ledgerPagination.rows,
    ledgerPagination: {
      page: ledgerPagination.page,
      pageSize: ledgerPagination.pageSize,
      total: ledgerPagination.total,
      totalPages: ledgerPagination.totalPages,
    },
    filter: {
      range: rangeKey,
      from: normalizedFrom,
      to: normalizedTo,
    },
    trend: groupBillingByDay(filteredItems, 7),
    todayCost: Number(filteredItems
      .filter((item) => withinDateRange(item?.end || item?.start || item?.createdAt, rangeBounds("today")))
      .reduce((sum, item) => sum + Number(item?.totalCost || 0), 0)
      .toFixed(5)),
  };
}

async function buildWorkspacePayload(db, user, taskSlug, options = {}) {
  const currentTask = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
  const current = {
    ...currentTask,
    title: sanitizeTaskTitle(currentTask.slug || "default", currentTask.title || ""),
  };
  const allTasks = listTaskSpacesForUser(db, user.id);
  const inputDir = path.join(current.path, "inputs");
  const outputDir = path.join(current.path, "outputs");
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  const files = await listFilesRecursive(inputDir);
  const outputs = await listFilesRecursive(outputDir);
  const userRuns = await collectRunsForUser(user.id);
  const runs = userRuns.filter((item) => item.workspaceId === current.slug);
  const billing = await fetchBillingSummary(user.id, current.slug, "168h");
  const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
  const events = (await readPortalEvents(200)).filter((event) => event.userId === user.id && (!event.workspaceId || event.workspaceId === current.slug));
  const activeSession = latestActiveWorkspaceSession(db, user.id, current.slug);
  const runPagination = paginateRows(runs, options.runsPage, 5);
  const filePagination = paginateRows(files, options.inputsPage, 5);
  const outputPagination = paginateRows(outputs, options.outputsPage, 5);
  const taskPagination = paginateRows(allTasks, options.tasksPage, 5);
  const billingAll = await fetchBillingSummary(user.id, "", "168h");
  const pagedTasks = taskPagination.rows;
  const taskCards = await Promise.all(pagedTasks.map(async (task) => {
    const taskFiles = await listFilesRecursive(path.join(task.path, "inputs"));
    const taskOutputs = await listFilesRecursive(path.join(task.path, "outputs"));
    const taskRuns = userRuns.filter((run) => run.workspaceId === task.slug);
    const taskTotals = taskCostSummary(task.slug, userRuns, billingAll?.items || []);
    return {
      slug: task.slug,
      title: task.title,
      status: task.status,
      inputs: taskFiles.length,
      outputs: taskOutputs.length,
      runs: taskRuns.length,
      totalCost: Number(taskTotals.totalCost || 0),
      updatedAt: formatDateTime(task.updatedAt || task.createdAt || ""),
    };
  }));
  return {
    workspace: {
      slug: current.slug,
      title: current.title,
      status: current.status,
      createdAt: current.createdAt || null,
      archivedAt: current.archivedAt || null,
      deletedAt: current.deletedAt || null,
    },
    counts: {
      inputs: files.length,
      outputs: outputs.length,
      runs: runs.length,
      completedRuns: runs.filter((run) => isRunTerminal(run)).length,
    },
    costs: totals,
    runStatus: summarizeRunStatus(runs),
    activeSession: activeSession ? {
      id: activeSession.id,
      createdAt: activeSession.createdAt || null,
      lastUsedAt: activeSession.lastUsedAt || null,
      expiresAt: activeSession.expiresAt || null,
    } : null,
    recentRuns: runPagination.rows.map((run) => ({
      runId: run.runId,
      status: isRunTerminal(run) ? "completed" : (run.status || "running"),
      createdAt: formatDateTime(run.createdAt || ""),
    })),
    eventTimeline: events.slice(0, 16).map((event) => ({
      type: event.type,
      occurredAt: event.occurredAt,
      workspaceId: event.workspaceId || current.slug,
    })),
    distribution: {
      inputBytes: (await Promise.all(files.map((item) => stat(item.fullPath).then((meta) => meta.size).catch(() => 0)))).reduce((sum, item) => sum + item, 0),
      outputBytes: (await Promise.all(outputs.map((item) => stat(item.fullPath).then((meta) => meta.size).catch(() => 0)))).reduce((sum, item) => sum + item, 0),
    },
    tasks: taskCards,
    tasksPageRows: taskCards,
    tasksPagination: {
      page: taskPagination.page,
      pageSize: taskPagination.pageSize,
      total: taskPagination.total,
      totalPages: taskPagination.totalPages,
    },
    taskTreemap: taskCards.map((task) => ({
      name: task.title,
      value: Number((task.totalCost || 0) + task.inputs + task.outputs + task.runs) || 0.001,
      task,
    })),
    files: filePagination.rows,
    filesPagination: {
      page: filePagination.page,
      pageSize: filePagination.pageSize,
      total: filePagination.total,
      totalPages: filePagination.totalPages,
    },
    outputs: outputPagination.rows,
    outputsPagination: {
      page: outputPagination.page,
      pageSize: outputPagination.pageSize,
      total: outputPagination.total,
      totalPages: outputPagination.totalPages,
    },
    runsPagination: {
      page: runPagination.page,
      pageSize: runPagination.pageSize,
      total: runPagination.total,
      totalPages: runPagination.totalPages,
    },
  };
}

async function buildAdminOverviewPayload(db) {
  const users = db.users.filter((item) => item.role !== "admin" && activeUserStatus(item.status) !== "deleted");
  const billing = await fetchBillingSummary("", "", "168h");
  const items = billing?.items || [];
  const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
  const pending = await fetchPendingSummary("", "", "168h");
  const billingStatus = await fetchBillingStatus();
  const tasks = db.taskSpaces.filter((item) => item.status !== "deleted");
  const groups = Array.isArray(db.groups) ? db.groups : [];
  const todayRange = rangeBounds("today");
  const recentEvents = await readPortalEvents(240);
  const allRuns = [];
  for (const item of users) {
    allRuns.push(...(await collectRunsForUser(item.id)).map((run) => ({ ...run, userId: item.id, userName: item.name, userEmail: item.email })));
  }
  const serviceStatuses = await Promise.all([
    { name: "Portal OPL Adapter", url: new URL("/healthz", `${PORTAL_OPL_ADAPTER_URL}/`).toString() },
    { name: "Langfuse", url: LANGFUSE_URL },
    { name: "Rancher", url: RANCHER_URL },
    { name: "OpenCost", url: OPENCOST_UI_URL },
    { name: "Harbor", url: HARBOR_URL },
    { name: "MinIO", url: MINIO_CONSOLE_URL },
  ].filter((item) => item.url).map(async (item) => ({ ...item, probe: await probe(item.url) })));
  const [minioSummary, harborSummary, langfuseSummary] = await Promise.all([
    fetchMinioSummary(),
    fetchHarborSummary(),
    fetchLangfuseSummary(),
  ]);
  const securitySummary = securityConfigSummary();
  const performanceSummary = await runtimePerformanceSummary();

  const topUsers = users.map((item) => {
    const userItems = items.filter((entry) => {
      const props = entry?.properties || {};
      return props["label:customer_id"] === item.id || props.customer_id === item.id;
    });
    return {
      userId: item.id,
      name: item.name,
      email: item.email,
      totalCost: userItems.reduce((sum, entry) => sum + Number(entry?.totalCost || 0), 0),
      balance: Number((db.wallets.find((wallet) => wallet.userId === item.id)?.balance) || 0),
      status: item.status || "active",
      groupId: item.groupId || "",
    };
  }).sort((a, b) => b.totalCost - a.totalCost).slice(0, 10);

  const recentUsage = allRuns
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 12)
    .map((run) => ({
      runId: run.runId,
      userId: run.userId,
      userName: run.userName,
      workspaceId: run.workspaceId || "-",
      status: isRunTerminal(run) ? "completed" : (run.status || "running"),
      createdAt: formatDateTime(run.createdAt || ""),
    }));
  const usageRows = allRuns
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .map((run) => {
      const relatedItem = items.find((entry) => entry?.properties?.["label:run_id"] === run.runId || entry?.properties?.run_id === run.runId || entry?.name?.includes(run.runId));
      return {
        runId: run.runId,
        userId: run.userId,
        userName: run.userName,
        workspaceId: run.workspaceId || "-",
        status: isRunTerminal(run) ? "completed" : (run.status || "running"),
        createdAt: formatDateTime(run.createdAt || ""),
        cpuCost: Number(relatedItem?.cpuCost || 0),
        gpuCost: Number(relatedItem?.gpuCost || 0),
        storageCost: Number(relatedItem?.pvCost || 0),
        vpnCost: 0,
        trafficCost: 0,
        otherCloudCost: 0,
        totalCost: Number(relatedItem?.totalCost || 0),
      };
    });

  const warningEvents = recentEvents
    .filter((event) => /fail|error|denied|blocked|pending|reconcile/i.test(String(event.type || "")))
    .slice(0, 12);
  const lowBalanceUsers = users
    .map((entry) => {
      const wallet = db.wallets.find((wallet) => wallet.userId === entry.id) || { balance: 0 };
      return { userId: entry.id, name: entry.name, email: entry.email, balance: Number(wallet.balance || 0) };
    })
    .filter((entry) => entry.balance <= 0)
    .slice(0, 12);
  const failedRuns = allRuns
    .filter((run) => String(run.status || "").toLowerCase() === "failed")
    .slice(0, 12)
    .map((run) => ({
      runId: run.runId,
      userId: run.userId,
      userName: run.userName,
      workspaceId: run.workspaceId || "-",
      createdAt: formatDateTime(run.createdAt || ""),
    }));
  const unavailableServices = serviceStatuses.filter((item) => !item.probe.ok);
  const traceMissingRuns = allRuns
    .filter((run) => isRunTerminal(run))
    .slice(0, 40)
    .filter((run) => !(langfuseSummary?.available) ? false : true);
  const traceRows = langfuseSummary?.available ? (await fetchTraceRows({ limit: 200 })).rows || [] : [];
  const tracedRunIds = new Set(traceRows.map((item) => item.runId).filter(Boolean));
  const traceMissingAlerts = traceMissingRuns
    .filter((run) => run.runId && !tracedRunIds.has(run.runId))
    .slice(0, 12)
    .map((run) => ({
      severity: "warning",
      category: "trace",
      userId: run.userId,
      runId: run.runId,
      workspaceId: run.workspaceId || "-",
      title: "Run 缺少 Trace",
      detail: `${run.runId} 已完成但未找到 Langfuse trace`,
      occurredAt: formatDateTime(run.createdAt || ""),
      action: `/portal/admin/run?runId=${run.runId}`,
    }));
  const securityAlerts = securitySummary.checks
    .filter((item) => !item.healthy)
    .map((item) => ({
      severity: "danger",
      category: "security",
      title: `安全配置未收口：${item.key}`,
      detail: item.detail,
      occurredAt: "",
      action: `/portal/admin/system`,
    }));
  const performanceAlerts = [];
  if (performanceSummary.warmupTimeoutCount > 0) {
    performanceAlerts.push({
      severity: "warning",
      category: "performance",
      title: "MAS warmup 存在超时",
      detail: `最近检测到 ${performanceSummary.warmupTimeoutCount} 次 warmup 超时`,
      occurredAt: "",
      action: `/portal/admin/ops`,
    });
  }
  if (Number(performanceSummary.masFirstReplyApproxMs || 0) > 20000) {
    performanceAlerts.push({
      severity: "warning",
      category: "performance",
      title: "MAS 首次回复偏慢",
      detail: `最近成功样本平均约 ${performanceSummary.masFirstReplyApproxMs} ms`,
      occurredAt: "",
      action: `/portal/admin/ops`,
    });
  }
  const alerts = [
    ...securityAlerts,
    ...performanceAlerts,
    ...unavailableServices.map((item) => ({
      severity: "danger",
      category: "system",
      title: `${item.name} 不可达`,
      detail: `当前状态 ${item.probe.status}`,
      occurredAt: "",
      action: `/portal/admin/system`,
    })),
    ...traceMissingAlerts,
    ...failedRuns.map((run) => ({
      severity: "danger",
      category: "run",
      title: `${run.userName} 有失败运行`,
      userId: run.userId,
      runId: run.runId,
      workspaceId: run.workspaceId,
      detail: `失败 run：${run.runId}`,
      occurredAt: run.createdAt,
      action: `/portal/admin/run?runId=${run.runId}`,
    })),
    ...(pending?.runs || []).slice(0, 12).map((item) => ({
      severity: "warning",
      category: "pending",
      userId: item.customerId,
      runId: item.runId,
      workspaceId: item.workspaceId || "-",
      title: `Pending 计量待补齐`,
      detail: `${Number(item.pendingHours || 0).toFixed(2)} 小时未补齐`,
      occurredAt: formatDateTime(item.completedAt || item.createdAt || ""),
      action: `/portal/admin/billing-ops`,
    })),
    ...lowBalanceUsers.map((entry) => ({
      severity: "warning",
      category: "balance",
      title: `${entry.name} 余额不足`,
      userId: entry.userId,
      detail: `当前余额 ${money(entry.balance)}`,
      occurredAt: "",
      action: `/portal/admin/user?userId=${entry.userId}`,
    })),
  ].slice(0, 40);

  const systemMetrics = {
    hostname: os.hostname(),
    cpuCores: os.cpus().length,
    totalMemoryGb: Number((os.totalmem() / 1024 / 1024 / 1024).toFixed(1)),
    freeMemoryGb: Number((os.freemem() / 1024 / 1024 / 1024).toFixed(1)),
    uptimeHours: Number((os.uptime() / 3600).toFixed(1)),
    concurrentRuns: allRuns.filter((run) => !isRunTerminal(run)).length,
    activeSandboxes: db.userSandboxes.filter((item) => !["terminated", "error"].includes(String(item.status || "").toLowerCase())).length,
    activeWorkspaceSessions: db.workspaceSessions.filter((item) => item.status === "active" && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now())).length,
    dbMode: storageMode() === "postgres_redis" ? "Postgres / Redis" : "portal-db.json",
    redisStatus: process.env.REDIS_URL ? "已配置" : "未接入",
    opencostLinked: Boolean(billingStatus?.opencostBaseUrl),
  };

  return {
    kpis: {
      totalUsers: users.length,
      activeUsers: users.filter((item) => activeUserStatus(item.status) === "active").length,
      disabledUsers: users.filter((item) => activeUserStatus(item.status) !== "active").length,
      activeTasks: tasks.filter((item) => item.status === "active").length,
      archivedTasks: tasks.filter((item) => item.status === "archived").length,
      totalCost: Number(totals.totalCost || 0),
      workspaceTotal: tasks.length,
      todayRuns: allRuns.filter((run) => withinDateRange(run.createdAt || "", todayRange)).length,
      todayNewUsers: users.filter((item) => withinDateRange(item.createdAt || "", todayRange)).length,
      todayNewWorkspaces: tasks.filter((item) => withinDateRange(item.createdAt || "", todayRange)).length,
      totalRuns: allRuns.length,
      averageResponseMs: Number(performanceSummary.masFirstReplyApproxMs || 0),
      todayTotalCost: Number(items
        .filter((item) => withinDateRange(item?.end || item?.start || item?.createdAt, todayRange))
        .reduce((sum, item) => sum + Number(item?.totalCost || 0), 0)
        .toFixed(5)),
      historicalTotalCost: Number(totals.totalCost || 0),
    },
    pending: {
      count: Number(pending?.pendingCount || 0),
      oldestPendingHours: Number(pending?.oldestPendingHours || 0),
      riskByUser: Array.isArray(pending?.riskByUser) ? pending.riskByUser.slice(0, 8) : [],
      riskByWorkspace: Array.isArray(pending?.riskByWorkspace) ? pending.riskByWorkspace.slice(0, 8) : [],
    },
    trend: groupBillingByDay(items, 7),
    totals,
    topUsers,
    recentUsage,
    groups: groups.map((group) => ({
      ...group,
      memberCount: users.filter((user) => user.groupId === group.id).length,
    })),
    usageRows,
    ledgerSummary: {
      topup: db.ledger.filter((item) => item.type === "topup").reduce((sum, item) => sum + Number(item.amount || 0), 0),
      resourceCharge: db.ledger.filter((item) => item.type === "resource_charge").reduce((sum, item) => sum + Number(item.amount || 0), 0),
      refund: db.ledger.filter((item) => item.type === "refund").reduce((sum, item) => sum + Number(item.amount || 0), 0),
      makeupCharge: db.ledger.filter((item) => item.type === "makeup_charge").reduce((sum, item) => sum + Number(item.amount || 0), 0),
      entryCount: db.ledger.length,
    },
    pendingRuns: Array.isArray(pending?.runs) ? pending.runs.slice(0, 12) : [],
    billingSync: {
      autoReconcileEnabled: Boolean(billingStatus?.autoReconcileEnabled),
      autoReconcileWindow: billingStatus?.autoReconcileWindow || "168h",
      lastRunAt: billingStatus?.reconcileState?.lastRunAt || "",
      lastScope: billingStatus?.reconcileState?.lastScope || "all",
      lastReconciledCount: Number(billingStatus?.reconcileState?.lastReconciledCount || 0),
      lastExactCount: Number(billingStatus?.reconcileState?.lastExactCount || 0),
      lastEstimatedCount: Number(billingStatus?.reconcileState?.lastEstimatedCount || 0),
      lastAdjustmentCount: Number(billingStatus?.reconcileState?.lastAdjustmentCount || 0),
      lastError: billingStatus?.reconcileState?.lastError || "",
      opencostLinked: Boolean(billingStatus?.opencostBaseUrl),
    },
    warningEvents,
    alerts,
    auditRows: recentEvents.map((event) => ({
      type: event.type,
      userId: event.userId || "",
      operatorId: event.operatorId || "",
      workspaceId: event.workspaceId || "",
      occurredAt: formatDateTime(event.occurredAt),
      detail: JSON.stringify(event).slice(0, 240),
    })),
    systemMetrics,
    summaries: {
      opencost: {
        available: true,
        mode: "live",
        cpuCost: Number(totals.cpuCost || 0),
        gpuCost: Number(totals.gpuCost || 0),
        storageCost: Number(totals.pvCost || 0),
        totalCost: Number(totals.totalCost || 0),
        note: "数据来自 OpenCost / 账单聚合",
      },
      minio: minioSummary,
      harbor: {
        ...harborSummary,
        imageTagCount: new Set(db.userSandboxes.map((item) => item.imageTag).filter(Boolean)).size,
      },
      langfuse: langfuseSummary,
      oplRuntime: {
        available: true,
        mode: "status_only",
        adapterUrl: PORTAL_OPL_ADAPTER_URL,
        oplWebUrl: OPL_WEB_URL || "",
        note: OPL_WEB_URL
          ? "Portal 生成 launch context，并把用户带到真实 OPL Web；adapter 只负责内部合同转换"
          : "未配置 OPL_WEB_URL，Portal 不会回退到旧工作台路径",
      },
      rancher: {
        available: Boolean(RANCHER_URL),
        mode: "status_only",
        note: RANCHER_URL ? "当前仅展示入口与可达状态" : "未配置 Rancher 入口",
      },
      security: securitySummary,
      performance: performanceSummary,
    },
    sandboxes: db.userSandboxes
      .map((item) => {
        const targetUser = db.users.find((user) => user.id === item.userId) || {};
        return {
          ...item,
          userName: targetUser.name || targetUser.email || item.userId,
          updatedAtLabel: formatDateTime(item.updatedAt || item.lastActiveAt || item.createdAt || ""),
        };
      })
      .sort((a, b) => String(b.updatedAt || b.lastActiveAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.lastActiveAt || a.createdAt || ""))),
    serviceStatuses: serviceStatuses.map((item) => ({ name: item.name, status: item.probe.status, ok: item.probe.ok, responseMs: item.probe.responseMs || null })),
  };
}

function buildAdminUsersApiPayload(db, payload, options = {}) {
  const workspaceFilter = String(options.workspace || "").trim().toLowerCase();
  const idFilter = String(options.userId || "").trim().toLowerCase();
  const usernameFilter = String(options.username || "").trim().toLowerCase();
  const emailFilter = String(options.email || "").trim().toLowerCase();
  const keywordFilter = String(options.q || "").trim().toLowerCase();
  const users = db.users
    .filter((item) => item.role !== "admin")
    .filter((item) => activeUserStatus(item.status) !== "deleted")
    .map((item) => {
      const wallet = db.wallets.find((entry) => entry.userId === item.id) || { balance: 0 };
      const taskSpaces = db.taskSpaces.filter((task) => task.userId === item.id && String(task.status || "").toLowerCase() !== "deleted");
      const workspaceSessions = db.workspaceSessions.filter((session) => session.userId === item.id);
      const latestWorkspaceSessionAt = workspaceSessions
        .map((session) => String(session.lastUsedAt || session.createdAt || ""))
        .sort((a, b) => b.localeCompare(a))[0] || "";
      const latestPortalSessionAt = db.sessions
        .filter((session) => session.userId === item.id)
        .map((session) => String(session.createdAt || ""))
        .sort((a, b) => b.localeCompare(a))[0] || "";
      const latestTaskAt = taskSpaces
        .map((task) => String(task.updatedAt || task.createdAt || ""))
        .sort((a, b) => b.localeCompare(a))[0] || "";
      const lastActiveAt = [latestPortalSessionAt, latestWorkspaceSessionAt, latestTaskAt, String(item.createdAt || "")]
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a))[0] || "";
      const lastUsedAt = [latestWorkspaceSessionAt, latestTaskAt]
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a))[0] || "";
      return {
        ...item,
        status: activeUserStatus(item.status),
        balance: Number(wallet.balance || 0),
        taskCount: taskSpaces.length,
        groupName: groupNameById(db, item.groupId || ""),
        lastActiveAt: lastActiveAt ? formatDateTime(lastActiveAt) : "",
        lastUsedAt: lastUsedAt ? formatDateTime(lastUsedAt) : "",
        workspaceSlugs: taskSpaces.map((task) => task.slug),
      };
    })
    .filter((item) => {
      const haystack = `${item.id} ${item.name} ${item.email} ${(item.workspaceSlugs || []).join(" ")}`.toLowerCase();
      if (workspaceFilter && !(item.workspaceSlugs || []).some((slug) => String(slug || "").toLowerCase().includes(workspaceFilter))) return false;
      if (idFilter && !String(item.id || "").toLowerCase().includes(idFilter)) return false;
      if (usernameFilter && !String(item.name || "").toLowerCase().includes(usernameFilter)) return false;
      if (emailFilter && !String(item.email || "").toLowerCase().includes(emailFilter)) return false;
      if (keywordFilter && !haystack.includes(keywordFilter)) return false;
      return true;
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const pagination = paginateRows(users, options.page, normalizePageSize(options.pageSize || 5));
  const financeRows = db.ledger
    .filter((item) => ["topup", "refund", "makeup_charge"].includes(item.type))
    .slice()
    .reverse()
    .slice(0, 50)
    .map((item) => {
      const targetUser = db.users.find((user) => user.id === item.userId) || {};
      return {
        id: item.id,
        userId: item.userId,
        userName: targetUser.name || item.userId,
        type: item.type,
        amount: Number(item.amount || 0),
        createdAt: item.createdAt,
        reason: item.reason || "",
      };
    });
  return {
    items: pagination.rows,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
    allowRegistration: isRegistrationEnabled(db),
    financeRows,
    groups: db.groups.map((group) => ({ id: group.id, name: group.name })),
    kpis: payload.kpis,
  };
}

function buildAdminGroupsApiPayload(db, payload) {
  return {
    groups: payload.groups || [],
    users: db.users
      .filter((item) => item.role !== "admin")
      .map((item) => ({ id: item.id, name: item.name, email: item.email, groupId: item.groupId || "" })),
  };
}

function buildAdminUsageApiPayload(payload, options = {}) {
  const pagination = paginateRows(payload.usageRows || [], options.page, normalizePageSize(options.pageSize || 10));
  return {
    items: pagination.rows,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
  };
}

function buildAdminBillingOpsApiPayload(db, payload) {
  return {
    billingSync: payload.billingSync,
    pending: payload.pending,
    pendingRuns: payload.pendingRuns || [],
    warningEvents: payload.warningEvents || [],
    summaries: payload.summaries,
    users: db.users.filter((item) => item.role !== "admin").map((item) => ({ id: item.id, name: item.name, email: item.email })),
    workspaces: db.taskSpaces.filter((item) => item.status !== "deleted").map((item) => ({ slug: item.slug, title: sanitizeTaskTitle(item.slug, item.title) })),
    adjustments: db.ledger
      .filter((item) => item.type === "refund" || item.type === "makeup_charge")
      .slice(-20)
      .reverse()
      .map((item) => {
        const targetUser = db.users.find((entry) => entry.id === item.userId) || {};
        return {
          type: item.type,
          userId: item.userId,
          userName: targetUser.name || item.userId,
          amount: Number(item.amount || 0),
          runId: item.runId || "",
          workspaceId: item.workspaceId || "",
          reason: item.reason || "",
          createdAt: item.createdAt,
        };
      }),
  };
}

function buildAdminSystemApiPayload(payload) {
  return {
    serviceStatuses: payload.serviceStatuses || [],
    summaries: payload.summaries || {},
    systemMetrics: payload.systemMetrics || {},
  };
}

function buildAdminOpsApiPayload(payload) {
  return {
    serviceStatuses: payload.serviceStatuses || [],
    systemMetrics: payload.systemMetrics || {},
    pending: payload.pending || {},
    warningEvents: payload.warningEvents || [],
    alerts: payload.alerts || [],
    summaries: payload.summaries || {},
  };
}

function buildAdminSandboxesApiPayload(payload) {
  return {
    items: payload.sandboxes || [],
  };
}

function buildAdminAuditApiPayload(payload, options = {}) {
  const pagination = paginateRows(payload.auditRows || [], options.page, normalizePageSize(options.pageSize || 10));
  return {
    items: pagination.rows,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
  };
}

async function buildAdminUserPortraitApiPayload(db, userId = "") {
  const user = db.users.find((item) => item.id === userId && item.role !== "admin");
  if (!user) return null;

  const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
  const group = db.groups.find((item) => item.id === user.groupId) || null;
  const runs = (await collectRunsForUser(user.id))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const recentRuns = runs.slice(0, 8).map((run) => ({
    runId: run.runId || "",
    workspaceId: run.workspaceId || "",
    workspaceTitle: sanitizeTaskTitle(run.workspaceId || "", run.workspaceTitle || run.workspaceId || ""),
    status: isRunTerminal(run) ? "已完成" : humanizeStatus(run.status || "running"),
    createdAtLabel: formatDateTime(run.createdAt || ""),
  }));

  const billing = await fetchBillingSummary(user.id, "", "168h");
  const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
  const sessions = (db.sessions || [])
    .filter((session) => session.userId === user.id)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 8)
    .map((session) => ({
      sessionId: session.id,
      sessionType: "portal",
      source: session.authSource || "portal_session",
      type: "live",
      userId: user.id,
      userName: user.name || user.email || "",
      email: user.email || "",
      workspaceId: "",
      workspaceSessionId: "",
      lastUsedAt: session.createdAt || "",
      expiresAt: "",
      status: "active",
    }));
  const workspaceSessions = workspaceChatSessionsForUser(db, user, 8);
  const workspaces = listTaskSpacesForUser(db, user.id).slice(0, 8).map((item) => ({
    slug: item.slug,
    title: item.title,
    status: humanizeStatus(item.status),
    link: `/admin/workspace?userId=${encodeURIComponent(user.id)}&workspaceId=${encodeURIComponent(item.slug)}`,
  }));
  const userTraceRows = await fetchTraceRows({ userId: user.id, limit: 20 });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      balanceLabel: money(Number(wallet.balance || 0)),
      groupName: group?.name || "",
      createdAtLabel: formatDateTime(user.createdAt || ""),
    },
    recentRuns,
    costs: {
      cpuCost: Number(totals.cpuCost || 0),
      gpuCost: Number(totals.gpuCost || 0),
      storageCost: Number(totals.pvCost || 0),
      totalCost: Number(totals.totalCost || 0),
    },
    sessions: [...sessions, ...workspaceSessions].sort((a, b) => String(b.lastUsedAt || "").localeCompare(String(a.lastUsedAt || ""))).slice(0, 10),
    workspaces,
    trace: {
      source: userTraceRows.source,
      type: userTraceRows.type,
      count: Array.isArray(userTraceRows.rows) ? userTraceRows.rows.length : 0,
      latest: Array.isArray(userTraceRows.rows) && userTraceRows.rows.length ? userTraceRows.rows[0].startedAt || "" : "",
      rows: userTraceRows.rows || [],
    },
  };
}

async function buildAdminWorkspacePortraitApiPayload(db, userId = "", workspaceId = "") {
  const user = db.users.find((item) => item.id === userId);
  if (!user) return null;
  const taskSpace = db.taskSpaces.find((item) => item.userId === userId && item.slug === workspaceId);
  if (!taskSpace) return null;

  const recentRuns = (await collectRunsForTask(userId, workspaceId))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 8)
    .map((run) => ({
      runId: run.runId || "",
      status: isRunTerminal(run) ? "已完成" : humanizeStatus(run.status || "running"),
      createdAtLabel: formatDateTime(run.createdAt || ""),
    }));

  const activeSession = latestActiveWorkspaceSession(db, userId, workspaceId);
  const billing = await fetchBillingSummary(userId, workspaceId, "168h");
  const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
  const storage = await fetchWorkspaceStorageSnapshot(taskSpace);
  const minio = await fetchWorkspaceMinioState(userId, workspaceId);
  const traces = await fetchTraceRows({ workspaceId, limit: 20 });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    workspace: {
      slug: taskSpace.slug,
      title: taskSpace.title,
      status: taskSpace.status,
      statusLabel: humanizeStatus(taskSpace.status),
    },
    activeSession: activeSession ? {
      id: activeSession.id,
      createdAt: activeSession.createdAt || "",
      lastUsedAt: activeSession.lastUsedAt || "",
      expiresAt: activeSession.expiresAt || "",
    } : null,
    recentRuns,
    costs: {
      cpuCost: Number(totals.cpuCost || 0),
      gpuCost: Number(totals.gpuCost || 0),
      storageCost: Number(totals.pvCost || 0),
      totalCost: Number(totals.totalCost || 0),
    },
    storage: {
      source: storage.source,
      type: storage.type,
      inputsCount: storage.inputsCount,
      outputsCount: storage.outputsCount,
      inputBytes: storage.inputBytes,
      outputBytes: storage.outputBytes,
      outputs: (storage.outputs || []).slice(0, 10),
      files: (storage.files || []).slice(0, 10),
    },
    minio,
    trace: {
      source: traces.source,
      type: traces.type,
      count: Array.isArray(traces.rows) ? traces.rows.length : 0,
      rows: traces.rows || [],
    },
  };
}

async function buildAdminRunPortraitApiPayload(db, runId = "") {
  if (!runId) return null;
  const runs = [];
  for (const user of db.users) {
    runs.push(...(await collectRunsForUser(user.id)).map((run) => ({ ...run, user })));
  }
  const run = runs.find((item) => item.runId === runId);
  if (!run) return null;

  const billing = await fetchBillingSummary(run.user.id, run.workspaceId || "", "168h");
  const billedRun = (billing?.items || []).find((item) => {
    const props = item?.properties || {};
    return props["label:run_id"] === runId || props.run_id === runId || String(item?.name || "").includes(runId);
  });
  const traces = await fetchTraceRows({ runId, limit: 20 });
  const taskSpace = db.taskSpaces.find((item) => item.userId === run.user.id && item.slug === run.workspaceId);
  const storage = taskSpace ? await fetchWorkspaceStorageSnapshot(taskSpace) : null;
  const relatedOutputs = (storage?.outputs || []).filter((item) => item.name.includes(runId)).slice(0, 10);
  const workspaceSession = run.workspaceSessionId ? readWorkspaceSession(db, run.workspaceSessionId, run.user.id) : null;

  return {
    run: {
      runId,
      userId: run.user.id,
      userName: run.user.name || run.user.email || run.user.id,
      userEmail: run.user.email || "",
      workspaceId: run.workspaceId || "",
      workspaceTitle: sanitizeTaskTitle(run.workspaceId || "", run.workspaceTitle || run.workspaceId || ""),
      workspaceSessionId: run.workspaceSessionId || "",
      status: isRunTerminal(run) ? "已完成" : humanizeStatus(run.status || "running"),
      source: run.source || "",
    },
    billing: {
      cpuCost: Number(billedRun?.cpuCost || 0),
      gpuCost: Number(billedRun?.gpuCost || 0),
      storageCost: Number(billedRun?.pvCost || 0),
      totalCost: Number(billedRun?.totalCost || 0),
      pricingSource: String(billedRun?.properties?.pricing_source || billedRun?.properties?.["label:pricing_source"] || billedRun?.pricingSource || "未标注"),
      start: formatDateTime(billedRun?.start || run.createdAt || ""),
      end: formatDateTime(billedRun?.end || ""),
    },
    workspaceSession: workspaceSession ? {
      id: workspaceSession.id,
      status: workspaceSession.status,
      lastUsedAt: formatDateTime(workspaceSession.lastUsedAt || ""),
      expiresAt: formatDateTime(workspaceSession.expiresAt || ""),
    } : null,
    outputs: relatedOutputs,
    trace: {
      source: traces.source,
      type: traces.type,
      count: Array.isArray(traces.rows) ? traces.rows.length : 0,
      rows: traces.rows || [],
      available: Array.isArray(traces.rows) && traces.rows.length > 0,
    },
  };
}

function securityConfigSummary() {
  const checks = [
    {
      key: "PORTAL_ADMIN_PASSWORD",
      healthy: adminSeed.password !== "Password1!",
      detail: adminSeed.password !== "Password1!" ? "已覆盖默认管理员密码" : "仍在使用默认管理员密码",
    },
    {
      key: "PORTAL_OIDC_CLIENT_SECRET",
      healthy: PORTAL_OIDC_CLIENT_SECRET !== "ddulXe78YePwKC2fYyVATNutBJS50BPhnSJutOxmplWm4chYeOiyusvwxUbx8iFM",
      detail: PORTAL_OIDC_CLIENT_SECRET !== "ddulXe78YePwKC2fYyVATNutBJS50BPhnSJutOxmplWm4chYeOiyusvwxUbx8iFM" ? "OIDC client secret 已覆盖默认值" : "OIDC client secret 仍为默认值",
    },
    {
      key: "HARBOR_PASSWORD",
      healthy: HARBOR_PASSWORD !== "HarborAdmin123!",
      detail: HARBOR_PASSWORD !== "HarborAdmin123!" ? "Harbor 密码已覆盖默认值" : "Harbor 密码仍为默认值",
    },
    {
      key: "JWT_REFRESH_SECRET",
      healthy: String(process.env.JWT_REFRESH_SECRET || "").trim() !== "" && String(process.env.JWT_REFRESH_SECRET || "").trim() !== "replace-this-jwt-refresh-secret-64chars",
      detail: String(process.env.JWT_REFRESH_SECRET || "").trim() && String(process.env.JWT_REFRESH_SECRET || "").trim() !== "replace-this-jwt-refresh-secret-64chars" ? "JWT refresh secret 已配置" : "JWT refresh secret 缺失或仍为默认值",
    },
  ];
  const unhealthy = checks.filter((item) => !item.healthy);
  return {
    healthy: unhealthy.length === 0,
    failedCount: unhealthy.length,
    checks,
  };
}

async function runtimePerformanceSummary() {
  const runsDir = path.join(codexRuntimeRoot, "sessions");
  let eventRows = [];
  try {
    const raw = await readFile(codexRuntimeEventsFile, "utf8");
    eventRows = raw.split(/\r?\n/).filter(Boolean).slice(-400).map((line) => safeJsonParse(line)).filter(Boolean);
  } catch {}
  let files = [];
  try {
    files = await readdir(runsDir);
  } catch {}
  const metas = [];
  for (const file of files.filter((name) => name.endsWith(".json")).slice(-200)) {
    try {
      const parsed = JSON.parse(await readFile(path.join(runsDir, file), "utf8"));
      metas.push(parsed);
    } catch {}
  }
  const byRunId = new Map(metas.map((item) => [String(item.runId || ""), item]));
  const runtimeEvents = eventRows
    .filter((item) => item.type === "codex_runtime_run")
    .slice()
    .reverse();
  const completed = runtimeEvents.map((item) => {
    const meta = byRunId.get(String(item.runId || ""));
    const startedAt = Date.parse(String(meta?.createdAt || ""));
    const endedAt = Date.parse(String(item.occurredAt || ""));
    const durationMs = Number.isFinite(startedAt) && Number.isFinite(endedAt) ? Math.max(0, endedAt - startedAt) : null;
    return {
      runId: item.runId || "",
      workspaceId: item.workspaceId || "",
      workspaceSessionId: item.workspaceSessionId || "",
      exitCode: typeof item.exitCode === "number" ? item.exitCode : Number(item.exitCode || 0),
      durationMs,
      occurredAt: item.occurredAt || "",
    };
  }).filter((item) => item.durationMs != null);
  const successful = completed.filter((item) => item.exitCode === 0);
  const latestMas = successful.slice(-10);
  const avgMas = latestMas.length ? Math.round(latestMas.reduce((sum, item) => sum + Number(item.durationMs || 0), 0) / latestMas.length) : null;
  const warmups = eventRows.filter((item) => item.type === "codex_runtime_warmup").slice(-20);
  const slowWarmups = warmups.filter((item) => !item.runnerWarmup?.ok || String(item.runnerWarmup?.detail || "").toLowerCase().includes("timeout"));
  return {
    masFirstReplyApproxMs: avgMas,
    latestSuccessfulMasRuns: latestMas.slice(-5).reverse(),
    warmupTimeoutCount: slowWarmups.length,
    totalSuccessfulMasRuns: successful.length,
  };
}

async function collectAllRunsWithUsers(db) {
  const rows = [];
  for (const user of db.users.filter((item) => item.role !== "admin")) {
    const runs = await collectRunsForUser(user.id);
    rows.push(...runs.map((run) => ({ ...run, userId: user.id, userName: user.name || user.email || user.id, userEmail: user.email || "" })));
  }
  rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return rows;
}

function buildSessionsApiPayload(db) {
  const ordinarySessions = (db.sessions || []).map((session) => {
    const user = db.users.find((entry) => entry.id === session.userId) || {};
    return {
      sessionId: session.id,
      sessionType: "ordinary",
      userId: session.userId || "",
      userName: user.name || user.email || session.userId || "",
      userEmail: user.email || "",
      workspaceId: "",
      workspaceSessionId: "",
      lastUsedAt: session.createdAt || "",
      status: "active",
      source: session.authSource || "portal_session",
    };
  });
  const workspaceSessions = (db.workspaceSessions || []).map((session) => {
    const user = db.users.find((entry) => entry.id === session.userId) || {};
    return {
      sessionId: session.id,
      sessionType: "mas",
      userId: session.userId || "",
      userName: user.name || user.email || session.userId || "",
      userEmail: user.email || "",
      workspaceId: session.workspaceId || "",
      workspaceSessionId: session.id,
      lastUsedAt: session.lastUsedAt || session.createdAt || "",
      status: session.status || "active",
      source: session.source || "workspace_session",
    };
  });
  const items = [...workspaceSessions, ...ordinarySessions].sort((a, b) => String(b.lastUsedAt || "").localeCompare(String(a.lastUsedAt || "")));
  return {
    items,
    summary: {
      ordinary: ordinarySessions.filter((item) => item.status === "active").length,
      mas: workspaceSessions.filter((item) => item.status === "active").length,
      total: items.length,
    },
    dataSource: {
      ordinary: "portal sessions",
      mas: "workspace sessions",
    },
  };
}

async function buildRunsApiPayload(db, options = {}) {
  const runs = await collectAllRunsWithUsers(db);
  const filtered = runs.filter((item) => {
    if (options.runId && item.runId !== options.runId) return false;
    if (options.userId && item.userId !== options.userId) return false;
    if (options.workspaceId && item.workspaceId !== options.workspaceId) return false;
    return true;
  });
  const pagination = paginateRows(filtered, options.page, normalizePageSize(options.pageSize || 10));
  return {
    items: pagination.rows.map((run) => ({
      runId: run.runId || "",
      userId: run.userId || "",
      userName: run.userName || "",
      userEmail: run.userEmail || "",
      workspaceId: run.workspaceId || "",
      workspaceSessionId: run.workspaceSessionId || "",
      status: isRunTerminal(run) ? "completed" : (run.status || "running"),
      createdAt: run.createdAt || "",
      source: run.source || "",
    })),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
    dataSource: "runtime events + run artifacts",
  };
}

async function buildWorkspaceStorageApiPayload(db, user, taskSlug) {
  const task = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
  const payload = await buildWorkspacePayload(db, user, task.slug);
  return {
    workspaceId: payload.workspace.slug,
    inputsCount: payload.counts.inputs,
    outputsCount: payload.counts.outputs,
    inputBytes: payload.distribution.inputBytes,
    outputBytes: payload.distribution.outputBytes,
    minioSynced: true,
    lastSyncAt: new Date().toISOString(),
    dataSource: "workspace filesystem + minio sync pipeline",
  };
}

async function buildCostsSummaryApiPayload() {
  const billing = await fetchBillingSummary("", "", "168h");
  const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
  return {
    cpuCost: Number(totals.cpuCost || 0),
    gpuCost: Number(totals.gpuCost || 0),
    storageCost: Number(totals.pvCost || 0),
    totalCost: Number(totals.totalCost || 0),
    pricingSource: billing ? "opencost_aggregated" : "unavailable",
    dataSource: "billing-aggregator / OpenCost",
  };
}

async function buildWorkspaceCostsApiPayload(workspaceId = "") {
  const billing = await fetchBillingSummary("", workspaceId, "168h");
  const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
  return {
    workspaceId,
    cpuCost: Number(totals.cpuCost || 0),
    gpuCost: Number(totals.gpuCost || 0),
    storageCost: Number(totals.pvCost || 0),
    totalCost: Number(totals.totalCost || 0),
    pricingSource: billing ? "opencost_aggregated" : "unavailable",
    dataSource: "billing-aggregator / OpenCost",
  };
}

async function buildRunCostsApiPayload(runId = "") {
  const billing = await fetchBillingSummary("", "", "168h");
  const match = (billing?.items || []).find((item) => {
    const props = item?.properties || {};
    return props["label:run_id"] === runId || props.run_id === runId || String(item?.name || "").includes(runId);
  });
  return {
    runId,
    workspaceId: String(match?.properties?.["label:workspace_id"] || match?.properties?.workspace_id || ""),
    customerId: String(match?.properties?.["label:customer_id"] || match?.properties?.customer_id || ""),
    cpuCost: Number(match?.cpuCost || 0),
    gpuCost: Number(match?.gpuCost || 0),
    storageCost: Number(match?.pvCost || 0),
    totalCost: Number(match?.totalCost || 0),
    pricingSource: String(match?.properties?.pricing_source || match?.properties?.["label:pricing_source"] || "unavailable"),
    dataSource: match ? "billing-aggregator / OpenCost" : "unavailable",
  };
}

async function buildRegistrySummaryApiPayload(db) {
  const harbor = await fetchHarborSummary();
  return {
    ...harbor,
    imageTagCount: new Set((db.userSandboxes || []).map((item) => item.imageTag).filter(Boolean)).size,
    dataSource: harbor.available ? "Harbor API" : "Harbor probe",
  };
}

async function buildRegistryImagesApiPayload(db) {
  const items = (db.userSandboxes || [])
    .map((item) => ({
      userId: item.userId,
      containerName: item.containerName || "",
      namespace: item.namespace || "",
      imageTag: item.imageTag || "",
      status: item.status || "",
      lastWorkspaceId: item.lastWorkspaceId || "",
      updatedAt: item.updatedAt || item.lastActiveAt || "",
    }))
    .filter((item) => item.imageTag)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return {
    items,
    dataSource: "user sandboxes + Harbor naming",
  };
}

async function buildTraceSummaryApiPayload() {
  const summary = await fetchLangfuseSummary();
  return {
    ...summary,
    dataSource: summary.available ? "Langfuse ClickHouse" : "trace summary unavailable",
  };
}

async function buildTracesApiPayload(options = {}) {
  const summary = await fetchLangfuseSummary();
  return {
    filters: {
      userId: options.userId || "",
      workspaceId: options.workspaceId || "",
      runId: options.runId || "",
    },
    summary,
    items: [],
    dataSource: summary.available ? "Langfuse summary only; detailed trace drill-down pending" : "unavailable",
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://local");
  if (url.pathname === "/healthz") {
    sendJson(res, { ok: true });
    return;
  }
  if (req.method === "GET" && url.pathname.startsWith("/portal/app/assets/")) {
    const relative = url.pathname.replace("/portal/app/assets/", "");
    const filePath = path.join(frontendDistRoot, "assets", relative);
    await sendStaticAsset(res, filePath, guessContentType(filePath));
    return;
  }
  if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
    const relative = url.pathname.replace("/assets/", "");
    const filePath = path.join(frontendDistRoot, "assets", relative);
    await sendStaticAsset(res, filePath, guessContentType(filePath));
    return;
  }
  const { db, user } = await currentUser(req);
  if (req.method === "GET" && url.pathname === "/register") {
    res.writeHead(302, { Location: "/login" });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/register") {
    res.writeHead(302, { Location: "/login" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/login") {
    if (!PORTAL_OIDC_ENABLED) {
      sendHtml(res, layoutV2("登录", `<div class="hero"><h1>统一门户</h1></div><div class="card"><form method="post" action="/login"><p><input name="email" type="email" placeholder="邮箱" required /></p><p><input name="password" type="password" placeholder="密码" required /></p><p><button type="submit">登录</button></p></form></div>`, null));
      return;
    }
    const loginHref = url.searchParams.get("force_login") === "1" ? "/auth/oidc/login?prompt=login" : "/auth/oidc/login";
    sendHtml(res, layoutV2("统一登录", `<div class="hero"><h1>统一登录</h1></div><div class="card"><p><a href="${loginHref}">使用统一账号登录</a></p><p class="hint">${isRegistrationEnabled(db) ? "如需新账号，请先在统一身份侧注册。" : "当前关闭自由注册，请联系管理员。"}</p></div>`, null));
    return;
  }
  if (req.method === "POST" && url.pathname === "/login") {
    if (PORTAL_OIDC_ENABLED) {
      res.writeHead(302, { Location: "/auth/oidc/login" });
      res.end();
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const found = db.users.find((item) => item.email === form.email);
    if (!found || !verifyPassword(form.password, found.passwordHash)) {
      sendHtml(res, layoutV2("登录失败", `<div class="card">账号或密码错误。</div>`, null), 401);
      return;
    }
    if (isBlockedUserStatus(found.status)) {
      sendHtml(res, layoutV2("登录失败", `<div class="card">当前账号已被禁用，请联系管理员。</div>`, null), 403);
      return;
    }
    const sessionId = randomUUID();
    db.sessions.push({ id: sessionId, userId: found.id, createdAt: new Date().toISOString() });
    await writeDb(db);
    setCookie(res, "portal_session", sessionId);
    res.writeHead(302, { Location: "/portal" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/auth/oidc/login") {
    const state = randomUUID();
    clearCookie(res, oidcStateCookie());
    setCookie(res, oidcStateCookie(), state);
    const prompt = url.searchParams.get("prompt") === "login" ? "login" : "";
    res.writeHead(302, { Location: buildOidcAuthorizeUrl(state, prompt) });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/auth/oidc/callback") {
    const cookies = parseCookies(req.headers.cookie);
    const state = String(url.searchParams.get("state") || "");
    const code = String(url.searchParams.get("code") || "");
    if (!state || !code || cookies[oidcStateCookie()] !== state) {
      sendHtml(res, layoutV2("登录失败", `<div class="card">统一登录校验失败，请重试。</div>`, null), 400);
      return;
    }
    const token = await exchangeOidcCode(code);
    const accessToken = String(token.access_token || "");
    if (!accessToken) {
      sendHtml(res, layoutV2("登录失败", `<div class="card">无法完成统一登录，请稍后再试。</div>`, null), 502);
      return;
    }
    const profile = await fetchOidcUserInfo(accessToken);
    const email = String(profile.email || profile.preferred_username || "").toLowerCase();
    if (!email) {
      sendHtml(res, layoutV2("登录失败", `<div class="card">统一身份没有返回可用邮箱。</div>`, null), 400);
      return;
    }
    let portalUser = db.users.find((item) => String(item.email || "").toLowerCase() === email);
    if (!portalUser) {
      portalUser = {
        id: randomUUID(),
        email,
        name: String(profile.name || profile.preferred_username || email).trim(),
        role: "user",
        status: "active",
        currentTaskSlug: "default",
        preferences: { theme: "light" },
        passwordHash: "",
        createdAt: new Date().toISOString(),
        authSource: "zitadel_oidc",
      };
      db.users.push(portalUser);
      db.wallets.push({ userId: portalUser.id, balance: 0, updatedAt: new Date().toISOString() });
      await ensureTaskSpace(db, portalUser, "default", defaultTaskTitle("default"));
      await logPortalEvent({ type: "user_provisioned_from_zitadel", userId: portalUser.id, email });
    }
    if (isBlockedUserStatus(portalUser.status)) {
      sendHtml(res, layoutV2("登录失败", `<div class="card">当前账号已被禁用，请联系管理员。</div>`, null), 403);
      return;
    }
    const sessionId = randomUUID();
    db.sessions.push({ id: sessionId, userId: portalUser.id, createdAt: new Date().toISOString(), authSource: "zitadel_oidc" });
    await writeDb(db);
    clearCookie(res, oidcStateCookie());
    setCookie(res, "portal_session", sessionId);
    res.writeHead(302, { Location: "/portal" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/logout") {
    clearCookie(res, "portal_session");
    clearCookie(res, oidcStateCookie());
    clearCookie(res, "workspace_session");
    clearCookie(res, "refreshToken");
    clearCookie(res, "token_provider");
    res.writeHead(302, { Location: "/login?force_login=1" });
    res.end();
    return;
  }
  if (!user) {
    res.writeHead(302, { Location: "/login" });
    res.end();
    return;
  }
  if (await handleOplRoutes({ req, res, url, db, user })) return;
  if (req.method === "GET" && (url.pathname === "/portal/app" || url.pathname === "/portal/app/" || url.pathname.startsWith("/portal/app/"))) {
    await sendStaticAsset(res, path.join(frontendDistRoot, "index.html"), "text/html; charset=utf-8");
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/announcements") {
    const showAll = user.role === "admin" && String(url.searchParams.get("mode") || "").toLowerCase() === "all";
    sendJson(res, {
      items: showAll ? announcementRows(db) : visibleAnnouncementRows(db, user),
      source: "portal_settings",
      type: "live",
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/me") {
    const initials = String(user.name || user.email || "?")
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "U";
    sendJson(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: activeUserStatus(user.status),
      initials,
      currentTaskSlug: user.currentTaskSlug || "default",
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/sessions") {
    const requestOptions = readSessionsRequestOptions(url);
    const requestedUserId = String(url.searchParams.get("userId") || "").trim();
    const targetUser = requestedUserId && user.role === "admin"
      ? (db.users.find((item) => item.id === requestedUserId) || user)
      : user;
    const adapterRuns = await fetchOplAdapterRuns();
    const runsByWorkspaceSession = new Map();
    for (const run of adapterRuns.filter((item) => item.portalUserId === targetUser.id)) {
      const key = run.workspaceSessionId || "";
      if (!key) continue;
      const current = runsByWorkspaceSession.get(key);
      if (!current || String(run.createdAt || "").localeCompare(String(current.createdAt || "")) > 0) {
        runsByWorkspaceSession.set(key, run);
      }
    }
    const oplSessions = workspaceChatSessionsForUser(db, targetUser, Number(url.searchParams.get("limit") || 20))
      .map((session) => {
        const latestRun = runsByWorkspaceSession.get(session.workspaceSessionId);
        return latestRun ? {
          ...session,
          runtimeSessionId: latestRun.runtimeSessionId || "",
          runId: latestRun.runId || "",
          runStatus: latestRun.status || "",
          latencyMs: Number(latestRun.latencyMs || 0),
          tokenCount: Number(latestRun.tokenCount || 0),
          userAgent: latestRun.userAgent || "",
          source: "portal_workspace_sessions + portal_opl_adapter",
        } : session;
      });
    const rows = [...oplSessions]
      .sort((a, b) => String(b.lastUsedAt || b.expiresAt || "").localeCompare(String(a.lastUsedAt || a.expiresAt || "")));
    const pagination = paginateRows(rows, requestOptions.page, normalizePageSize(requestOptions.pageSize || 5));
    sendJson(res, {
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
      sessions: pagination.rows,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
      sources: {
        opl: { source: "portal_workspace_sessions + portal_opl_adapter", type: "live" },
      },
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/runs") {
    const requestedUserId = String(url.searchParams.get("userId") || "").trim();
    const workspaceId = String(url.searchParams.get("workspaceId") || "").trim();
    const runId = String(url.searchParams.get("runId") || "").trim();
    const targetUsers = requestedUserId && user.role === "admin"
      ? db.users.filter((item) => item.id === requestedUserId)
      : [user];
    const runs = [];
    for (const targetUser of targetUsers) {
      const rows = await collectRunsForUser(targetUser.id);
      runs.push(...rows.map((item) => ({
        runId: item.runId || "",
        workspaceId: item.workspaceId || "",
        workspaceSessionId: item.workspaceSessionId || "",
        userId: targetUser.id,
        userName: targetUser.name || targetUser.email || "",
        status: isRunTerminal(item) ? "completed" : (item.status || "running"),
        startedAt: formatDateTime(item.createdAt || ""),
        endedAt: isRunTerminal(item) ? formatDateTime(item.completedAt || item.createdAt || "") : "",
        source: item.source || "runtime_events",
        type: "live",
      })));
    }
    const adapterRuns = (await fetchOplAdapterRuns())
      .filter((item) => {
        if (requestedUserId && user.role === "admin") return item.portalUserId === requestedUserId;
        return item.portalUserId === user.id;
      })
      .map((item) => ({
        runId: item.runId || "",
        workspaceId: item.workspaceId || "",
        workspaceSessionId: item.workspaceSessionId || "",
        runtimeSessionId: item.runtimeSessionId || "",
        userId: item.portalUserId || "",
        userName: "",
        status: item.status || "",
        startedAt: formatDateTime(item.createdAt || ""),
        endedAt: item.finishedAt ? formatDateTime(item.finishedAt) : "",
        source: "portal_opl_adapter",
        type: "live",
        latencyMs: Number(item.latencyMs || 0),
        tokenCount: Number(item.tokenCount || 0),
        userAgent: item.userAgent || "",
        jobName: item.jobName || "",
        namespace: item.namespace || "",
      }));
    runs.push(...adapterRuns);
    const filtered = runs
      .filter((item) => !workspaceId || item.workspaceId === workspaceId)
      .filter((item) => !runId || item.runId === runId)
      .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
    sendJson(res, {
      runs: filtered,
      source: "runtime_events + portal_opl_adapter",
      type: "live",
      note: "数据来自 runtime 事件、Portal 运行记录与 Portal OPL adapter",
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/workspace/storage") {
    const taskSlug = slugify(url.searchParams.get("task") || user.currentTaskSlug || "default");
    const taskSpace = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    const storage = await fetchWorkspaceStorageSnapshot(taskSpace);
    const minio = await fetchWorkspaceMinioState(user.id, taskSpace.slug);
    sendJson(res, {
      workspaceId: taskSpace.slug,
      storage,
      minio,
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/costs/summary") {
    const summary = await fetchBillingSummary(user.id, "", String(url.searchParams.get("window") || "168h"));
    sendJson(res, {
      source: "billing_aggregator",
      type: summary ? "live" : "status_only",
      note: summary ? "数据来自账单聚合接口" : "账单聚合接口不可用",
      totals: summary?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
      items: summary?.items || [],
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/costs/workspace") {
    const workspaceId = String(url.searchParams.get("workspaceId") || url.searchParams.get("task") || "").trim();
    const summary = await fetchBillingSummary(user.id, workspaceId, String(url.searchParams.get("window") || "168h"));
    sendJson(res, {
      source: "billing_aggregator",
      type: summary ? "live" : "status_only",
      note: summary ? "数据来自 workspace 维度账单聚合接口" : "workspace 账单聚合接口不可用",
      workspaceId,
      totals: summary?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
      items: summary?.items || [],
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/costs/run") {
    const runId = String(url.searchParams.get("runId") || "").trim();
    const summary = await fetchBillingSummary(user.id, "", String(url.searchParams.get("window") || "168h"));
    const adapterCost = (await fetchOplAdapterCosts({ userId: user.id, runId }))[0] || null;
    if (adapterCost) {
      sendJson(res, {
        source: "portal_opl_adapter",
        type: "live",
        note: adapterCost.status === "pending" ? "run 成本已记录为 pending，等待 OpenCost/云账单对账" : "run 成本来自 Portal OPL adapter",
        runId,
        cost: {
          cpuCost: adapterCost.cpuCost,
          gpuCost: adapterCost.gpuCost,
          storageCost: adapterCost.storageCost,
          totalCost: adapterCost.totalCost,
          pricingSource: adapterCost.pricingSource,
          status: adapterCost.status,
        },
      });
      return;
    }
    const runCost = (summary?.items || []).find((item) => {
      const props = item?.properties || {};
      return props["label:run_id"] === runId || props.run_id === runId || item?.name === runId;
    }) || null;
    if (!runCost) {
      sendJson(res, {
        source: "billing_aggregator",
        type: "status_only",
        note: "未找到对应 run 成本记录",
        runId,
        cost: null,
      });
      return;
    }
    sendJson(res, {
      source: "billing_aggregator",
      type: "live",
      note: "数据来自 run 维度账单聚合结果",
      runId,
      cost: {
        cpuCost: Number(runCost.cpuCost || 0),
        gpuCost: Number(runCost.gpuCost || 0),
        storageCost: Number(runCost.pvCost || runCost.storageCost || 0),
        totalCost: Number(runCost.totalCost || 0),
        pricingSource: runCost?.properties?.pricing_source || runCost?.properties?.["label:pricing_source"] || "aggregated",
      },
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/registry/summary") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const summary = await fetchHarborSummary();
    sendJson(res, summary);
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/registry/images") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const images = await fetchHarborImageRows(Number(url.searchParams.get("limit") || 50));
    sendJson(res, images);
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/traces/summary") {
    const summary = await fetchLangfuseSummary();
    sendJson(res, summary);
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/traces") {
    const requestOptions = readTracesRequestOptions(url);
    const requestedUserId = String(requestOptions.userId || "").trim();
    const workspaceId = String(requestOptions.workspaceId || "").trim();
    const runId = String(requestOptions.runId || "").trim();
    const sessionId = String(requestOptions.sessionId || "").trim();
    const statusFilter = String(requestOptions.status || "").trim().toLowerCase();
    const userIdForTrace = requestedUserId && user.role === "admin" ? requestedUserId : "";
    const traces = await fetchTraceRows({
      userId: userIdForTrace,
      workspaceId,
      runId,
      limit: parsePositiveInt(requestOptions.limit, 200),
    });
    const adapterTraces = await fetchOplAdapterTraceRows({
      userId: userIdForTrace || (user.role === "admin" ? "" : user.id),
      workspaceId,
      runId,
      limit: parsePositiveInt(requestOptions.limit, 200),
    });
    const mergedRows = [...(adapterTraces.rows || []), ...(traces.rows || [])]
      .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
    const filteredRows = mergedRows
      .filter((item) => !sessionId || String(item.sessionId || item.workspaceSessionId || "").includes(sessionId))
      .filter((item) => !statusFilter || String(item.status || "").toLowerCase().includes(statusFilter));
    const pagination = paginateRows(filteredRows, requestOptions.page, normalizePageSize(requestOptions.pageSize || 5));
    sendJson(res, {
      filters: {
        userId: userIdForTrace,
        workspaceId,
        runId,
        sessionId,
        status: statusFilter,
      },
      summary: {
        available: traces.type === "live" || adapterTraces.type === "live",
        mode: adapterTraces.type === "live" ? "live" : traces.type,
        note: adapterTraces.type === "live" ? adapterTraces.note : (traces.note || ""),
        traceCount: filteredRows.length,
        latestTraceAt: filteredRows[0]?.startedAt || "",
        dataSource: adapterTraces.type === "live" ? `${adapterTraces.source} + ${traces.source}` : traces.source,
      },
      items: pagination.rows,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
      dataSource: traces.source,
      note: traces.note || "",
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/api/theme") {
    const form = parseForm((await readBody(req)).toString("utf8"));
    const theme = ["dark", "light"].includes(String(form.theme || "").toLowerCase()) ? String(form.theme).toLowerCase() : "light";
    user.preferences = user.preferences || {};
    user.preferences.theme = theme;
    await writeDb(db);
    await logPortalEvent({ type: "theme_changed", userId: user.id, theme });
    sendJson(res, { ok: true, theme });
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/overview") {
    sendJson(res, await buildOverviewPayload(db, user, readOverviewRequestOptions(url)));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/billing") {
    sendJson(res, await buildBillingPayload(db, user, readBillingRequestOptions(url)));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/workspace") {
    const taskSlug = slugify(url.searchParams.get("task") || user.currentTaskSlug || "default");
    sendJson(res, await buildWorkspacePayload(db, user, taskSlug));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/overview") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    sendJson(res, await buildAdminOverviewPayload(db));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/users") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const payload = await buildAdminOverviewPayload(db);
    sendJson(res, buildAdminUsersApiPayload(db, payload, {
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("page_size"),
      q: url.searchParams.get("q"),
      workspace: url.searchParams.get("workspace"),
      userId: url.searchParams.get("userId"),
      username: url.searchParams.get("username"),
      email: url.searchParams.get("email"),
    }));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/groups") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const payload = await buildAdminOverviewPayload(db);
    sendJson(res, buildAdminGroupsApiPayload(db, payload));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/usage") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const payload = await buildAdminOverviewPayload(db);
    sendJson(res, buildAdminUsageApiPayload(payload, {
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("page_size"),
    }));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/billing-ops") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const payload = await buildAdminOverviewPayload(db);
    sendJson(res, buildAdminBillingOpsApiPayload(db, payload));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/system") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const payload = await buildAdminOverviewPayload(db);
    sendJson(res, buildAdminSystemApiPayload(payload));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/ops") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const payload = await buildAdminOverviewPayload(db);
    sendJson(res, buildAdminOpsApiPayload(payload));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/sandboxes") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const payload = await buildAdminOverviewPayload(db);
    sendJson(res, buildAdminSandboxesApiPayload(payload));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/audit") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const payload = await buildAdminOverviewPayload(db);
    sendJson(res, buildAdminAuditApiPayload(payload, {
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("page_size"),
    }));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/alerts") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const payload = await buildAdminOverviewPayload(db);
    sendJson(res, { alerts: payload.alerts || [] });
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/user") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const userId = String(url.searchParams.get("userId") || "");
    const payload = await buildAdminUserPortraitApiPayload(db, userId);
    if (!payload) {
      sendJson(res, { error: "not_found" }, 404);
      return;
    }
    sendJson(res, payload);
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/workspace") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const userId = String(url.searchParams.get("userId") || "");
    const workspaceId = String(url.searchParams.get("workspaceId") || "");
    const payload = await buildAdminWorkspacePortraitApiPayload(db, userId, workspaceId);
    if (!payload) {
      sendJson(res, { error: "not_found" }, 404);
      return;
    }
    sendJson(res, payload);
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/api/admin/run") {
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return;
    }
    const runId = String(url.searchParams.get("runId") || "");
    const payload = await buildAdminRunPortraitApiPayload(db, runId);
    if (!payload) {
      sendJson(res, { error: "not_found" }, 404);
      return;
    }
    sendJson(res, payload);
    return;
  }
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/portal")) {
    res.writeHead(302, { Location: "/portal/app/overview" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/billing") {
    res.writeHead(302, { Location: `/portal/app/billing${url.search || ""}` });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/billing/export.csv") {
    const payload = await buildBillingPayload(db, user, readBillingRequestOptions(url));
    const lines = [
      ["runId", "workspaceId", "runStatus", "cpuCost", "gpuCost", "storageCost", "totalCost", "startedAt", "endedAt", "pricingSource"].join(","),
      ...payload.runCosts.map((item) => [
        csvEscape(item.runId),
        csvEscape(item.workspaceId),
        csvEscape(item.runStatus),
        csvEscape(microMoney(item.cpuCost)),
        csvEscape(microMoney(item.gpuCost)),
        csvEscape(microMoney(item.storageCost)),
        csvEscape(microMoney(item.totalCost)),
        csvEscape(item.startedAt || ""),
        csvEscape(item.endedAt || ""),
        csvEscape(item.pricingSource),
      ].join(",")),
    ];
    res.writeHead(200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"portal-billing-export.csv\"",
    });
    res.end(lines.join("\n"));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/billing/tasks-export.csv") {
    const payload = await buildBillingPayload(db, user, readBillingRequestOptions(url));
    const lines = [
      ["workspaceSlug", "workspaceTitle", "runCount", "cpuCost", "gpuCost", "storageCost", "totalCost"].join(","),
      ...payload.taskCosts.map((item) => [
        csvEscape(item.slug),
        csvEscape(item.title),
        csvEscape(item.runCount),
        csvEscape(microMoney(item.cpuCost)),
        csvEscape(microMoney(item.gpuCost)),
        csvEscape(microMoney(item.storageCost)),
        csvEscape(microMoney(item.totalCost)),
      ].join(",")),
    ];
    res.writeHead(200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"portal-billing-tasks-export.csv\"",
    });
    res.end(lines.join("\n"));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/workspace") {
    res.writeHead(302, { Location: `/portal/app/workspace${url.search || ""}` });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/app/admin/dashboard" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/dashboard") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/app/admin/dashboard" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/alerts") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/app/admin/alerts" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/users") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/app/admin/users" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/groups") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/app/admin/groups" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/usage") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/app/admin/usage" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/billing-ops") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/app/admin/billing-ops" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/system") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/app/admin/system" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/ops") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/app/admin/ops" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/sandboxes") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/app/admin/sandboxes" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/audit") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/app/admin/audit" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/user") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: `/portal/app/admin/user${url.search || ""}` });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/workspace") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: `/portal/app/admin/workspace${url.search || ""}` });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/run") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: `/portal/app/admin/run${url.search || ""}` });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/ledger-export.csv") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const billing = await fetchBillingSummary("", "", "168h");
    const items = billing?.items || [];
    const windowHours = parseHourWindow(url.searchParams.get("window"));
    const lines = [
      ["entryId", "type", "userId", "userName", "userEmail", "runId", "workspaceId", "amount", "createdAt", "operatorId", "reason", "pricingSource"].join(","),
      ...db.ledger.filter((entry) => withinHourWindow(entry.createdAt, windowHours)).map((entry) => {
        const targetUser = db.users.find((item) => item.id === entry.userId) || {};
        const related = items.find((item) => item?.properties?.["label:run_id"] === entry.runId || item?.properties?.run_id === entry.runId || item?.name?.includes(entry.runId || ""));
        const pricingSource = related ? "OpenCost aggregated" : (entry.type === "resource_charge" ? "metering pending" : "manual ledger");
        return [
          csvEscape(entry.id),
          csvEscape(entry.type),
          csvEscape(entry.userId),
          csvEscape(targetUser.name || ""),
          csvEscape(targetUser.email || ""),
          csvEscape(entry.runId || ""),
          csvEscape(entry.workspaceId || ""),
          csvEscape(entry.amount),
          csvEscape(entry.createdAt || ""),
          csvEscape(entry.operatorId || ""),
          csvEscape(entry.reason || ""),
          csvEscape(pricingSource),
        ].join(",");
      }),
    ];
    res.writeHead(200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"portal-admin-ledger-export.csv\"",
    });
    res.end(lines.join("\n"));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/user-summary-export.csv") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const billing = await fetchBillingSummary("", "", "168h");
    const items = billing?.items || [];
    const windowHours = parseHourWindow(url.searchParams.get("window"));
    const users = db.users.filter((item) => item.role !== "admin");
    const lines = [
      ["userId", "name", "email", "status", "taskCount", "balance", "ledgerTopup", "ledgerResourceCharge", "opencostTotalCost"].join(","),
      ...users.map((entry) => {
        const taskCount = db.taskSpaces.filter((item) => item.userId === entry.id && item.status !== "deleted").length;
        const balance = Number((db.wallets.find((wallet) => wallet.userId === entry.id)?.balance) || 0);
        const topup = db.ledger.filter((item) => item.userId === entry.id && item.type === "topup" && withinHourWindow(item.createdAt, windowHours)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const resourceCharge = db.ledger.filter((item) => item.userId === entry.id && item.type === "resource_charge" && withinHourWindow(item.createdAt, windowHours)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const opencostTotal = items.filter((item) => {
          const props = item?.properties || {};
          return props["label:customer_id"] === entry.id || props.customer_id === entry.id;
        }).filter((item) => withinHourWindow(item?.end || item?.start, windowHours)).reduce((sum, item) => sum + Number(item?.totalCost || 0), 0);
        return [
          csvEscape(entry.id),
          csvEscape(entry.name || ""),
          csvEscape(entry.email || ""),
          csvEscape(entry.status || "active"),
          csvEscape(taskCount),
          csvEscape(money(balance)),
          csvEscape(money(topup)),
          csvEscape(money(resourceCharge)),
          csvEscape(microMoney(opencostTotal)),
        ].join(",");
      }),
    ];
    res.writeHead(200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"portal-admin-user-summary-export.csv\"",
    });
    res.end(lines.join("\n"));
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/pending-export.csv") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const pending = await fetchPendingSummary("", "", "168h");
    const lines = [
      ["runId", "customerId", "userName", "userEmail", "workspaceId", "completedAt", "pendingHours", "pricingSource"].join(","),
      ...(pending?.runs || []).map((item) => {
        const targetUser = db.users.find((entry) => entry.id === item.customerId) || {};
        return [
          csvEscape(item.runId),
          csvEscape(item.customerId),
          csvEscape(targetUser.name || ""),
          csvEscape(targetUser.email || ""),
          csvEscape(item.workspaceId || ""),
          csvEscape(item.completedAt || item.createdAt || ""),
          csvEscape(Number(item.pendingHours || 0).toFixed(2)),
          csvEscape(item.pricingSource || "metering pending"),
        ].join(",");
      }),
    ];
    res.writeHead(200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"portal-admin-pending-export.csv\"",
    });
    res.end(lines.join("\n"));
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/ledger-adjust") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const actionType = String(form.actionType || "").trim();
    const targetUser = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const wallet = db.wallets.find((item) => item.userId === form.userId);
    const amount = Number(form.amount || 0);
    const reason = String(form.reason || "").trim();
    const redirectTo = String(form.redirectTo || "/portal/admin/billing-ops").trim();
    if (!targetUser || !wallet || !["refund", "makeup_charge"].includes(actionType) || !Number.isFinite(amount) || amount <= 0 || !reason) {
      sendHtml(res, layoutV2("账务调整失败", `<div class="card">参数错误，请检查用户、动作类型、金额和原因。</div>`, user), 400);
      return;
    }
    const signedAmount = actionType === "refund" ? Math.abs(amount) : -Math.abs(amount);
    wallet.balance += signedAmount;
    wallet.updatedAt = new Date().toISOString();
    db.ledger.push({
      id: randomUUID(),
      userId: targetUser.id,
      runId: String(form.runId || "").trim(),
      workspaceId: String(form.workspaceId || "").trim(),
      type: actionType,
      amount: signedAmount,
      reason,
      createdAt: new Date().toISOString(),
      operatorId: user.id,
    });
    await logPortalEvent({
      type: "ledger_adjusted",
      userId: targetUser.id,
      operatorId: user.id,
      actionType,
      amount: signedAmount,
      runId: String(form.runId || "").trim(),
      workspaceId: String(form.workspaceId || "").trim(),
      reason,
    });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/reconcile-billing") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const scopeType = String(form.scopeType || "all").trim();
    const windowValue = String(form.window || "24h").trim();
    const redirectTo = String(form.redirectTo || "/portal/admin/billing-ops").trim();
    const targetUser = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const workspace = db.taskSpaces.find((item) => item.slug === form.workspaceId);
    const requestBody = { window: windowValue };
    if (scopeType === "user" && targetUser) {
      requestBody.customer_id = targetUser.id;
    }
    if (scopeType === "workspace" && workspace) {
      requestBody.customer_id = workspace.userId;
      requestBody.workspace_id = workspace.slug;
    }
    let result = null;
    try {
      const response = await fetch(new URL("/reconcile", BILLING_SERVICE_URL), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      result = await response.json().catch(() => ({ error: `status=${response.status}` }));
      if (!response.ok) {
        throw new Error(result?.error || `billing_reconcile_failed:${response.status}`);
      }
    } catch (error) {
      sendHtml(res, layoutV2("补齐失败", `<div class="card"><h2>账单补齐失败</h2><p class="hint">${String(error)}</p></div>`, user), 500);
      return;
    }
    await logPortalEvent({
      type: "billing_reconcile_triggered",
      userId: user.id,
      scopeType,
      targetUserId: targetUser?.id || "",
      workspaceId: workspace?.slug || "",
      window: windowValue,
      reconciledCount: Number(result?.reconciledCount || 0),
    });
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/docs/pricing-rules") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/admin" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/admin/docs/final-gap") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    res.writeHead(302, { Location: "/portal/admin" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/workspace-session/current") {
    const cookies = parseCookies(req.headers.cookie);
    const session = readWorkspaceSession(db, cookies[workspaceSessionCookie()], user.id);
    sendJson(res, { ok: Boolean(session), workspaceSession: session });
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/tasks/switch") {
    const taskSlug = slugify(url.searchParams.get("task") || "default");
    const taskSpace = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    if (taskSpace.status === "active") user.currentTaskSlug = taskSpace.slug;
    await writeDb(db);
    res.writeHead(302, { Location: `/portal/workspace?task=${taskSlug}` });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/tasks/create") {
    const form = parseForm((await readBody(req)).toString("utf8"));
    const policy = await evaluateUserPolicy(db, user);
    if (!policy.allowWorkspaceCreate) {
      await logPortalEvent({ type: "policy_blocked_workspace_create", userId: user.id, groupId: policy.group?.id || "", reasons: ["当前分组不允许创建任务空间"] });
      sendHtml(res, layoutV2("策略限制", `<div class="card"><h2>当前分组不允许创建新任务空间</h2><p class="hint">请联系管理员调整分组策略。</p></div>`, user), 403);
      return;
    }
    if (policy.blocked) {
      await logPortalEvent({ type: "policy_blocked_workspace_create", userId: user.id, groupId: policy.group?.id || "", reasons: policy.blocks });
      sendHtml(res, layoutV2("策略限制", `<div class="card"><h2>当前账号暂时不能创建任务空间</h2><ul class="list">${policy.blocks.map((item) => `<li>${item}</li>`).join("")}</ul></div>`, user), 403);
      return;
    }
    const title = String(form.title || "").trim() || "New Task";
    const slug = nextTaskSlug(db, user.id, title);
    await ensureTaskSpace(db, user, slug, title);
    await writeDb(db);
    res.writeHead(302, { Location: `/portal/workspace?task=${slug}` });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/tasks/archive") {
    const form = parseForm((await readBody(req)).toString("utf8"));
    const taskSlug = slugify(form.task || user.currentTaskSlug || "default");
    const taskSpace = findTaskSpace(db, user.id, taskSlug);
    if (!taskSpace) {
      sendHtml(res, layoutV2("任务空间不存在", `<div class="card">未找到目标任务空间。</div>`, user), 404);
      return;
    }
    if (taskSpace.status !== "active") {
      sendHtml(res, layoutV2("无法归档", `<div class="card">只有 active 状态的任务空间可以归档。</div>`, user), 409);
      return;
    }
    await archiveTaskSpace(db, user, taskSpace);
    await writeDb(db);
    res.writeHead(302, { Location: `/portal/workspace?task=${taskSpace.slug}` });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/tasks/restore") {
    const form = parseForm((await readBody(req)).toString("utf8"));
    const taskSlug = slugify(form.task || "default");
    const taskSpace = findTaskSpace(db, user.id, taskSlug);
    if (!taskSpace) {
      sendHtml(res, layoutV2("任务空间不存在", `<div class="card">未找到目标任务空间。</div>`, user), 404);
      return;
    }
    if (taskSpace.status !== "archived") {
      sendHtml(res, layoutV2("无法恢复", `<div class="card">只有 archived 状态的任务空间可以恢复。</div>`, user), 409);
      return;
    }
    await restoreTaskSpace(db, user, taskSpace);
    await writeDb(db);
    res.writeHead(302, { Location: `/portal/workspace?task=${taskSpace.slug}` });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/tasks/delete") {
    const form = parseForm((await readBody(req)).toString("utf8"));
    const taskSlug = slugify(form.task || "default");
    const taskSpace = findTaskSpace(db, user.id, taskSlug);
    if (!taskSpace) {
      sendHtml(res, layoutV2("任务空间不存在", `<div class="card">未找到目标任务空间。</div>`, user), 404);
      return;
    }
    if (await hasActiveRuns(user.id, taskSpace.slug)) {
      sendHtml(res, layoutV2("无法删除", `<div class="card">当前任务空间仍有运行中的任务，暂时不能删除。</div>`, user), 409);
      return;
    }
    if (hasActiveWorkspaceSession(db, user.id, taskSpace.slug)) {
      sendHtml(res, layoutV2("无法删除", `<div class="card">当前任务空间仍绑定活跃 MAS 会话，请等待会话过期后再删除。</div>`, user), 409);
      return;
    }
    await markTaskSpaceDeleted(db, user, taskSpace);
    await writeDb(db);
    res.writeHead(302, { Location: "/portal/workspace" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/workspace/download-file") {
    const taskSlug = slugify(url.searchParams.get("task") || user.currentTaskSlug || "default");
    const kind = url.searchParams.get("kind") === "outputs" ? "outputs" : "inputs";
    const file = safeRelativePath(url.searchParams.get("file") || "");
    const taskSpace = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    const fullPath = path.join(taskSpace.path, kind, file);
    if (!(await exists(fullPath))) {
      sendHtml(res, layoutV2("文件不存在", `<div class="card">未找到要下载的文件。</div>`, user), 404);
      return;
    }
    sendFile(res, fullPath, file);
    return;
  }
  if (req.method === "GET" && url.pathname === "/portal/workspace/download-all") {
    const taskSlug = slugify(url.searchParams.get("task") || user.currentTaskSlug || "default");
    const kind = url.searchParams.get("kind") === "outputs" ? "outputs" : "inputs";
    const taskSpace = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    const sourceDir = path.join(taskSpace.path, kind);
    await mkdir(sourceDir, { recursive: true });
    const zipPath = path.join(runtimeRoot, `${user.id}-${taskSlug}-${kind}.zip`);
    await createZipFromDir(sourceDir, zipPath);
    sendFile(res, zipPath, `${taskSlug}-${kind}.zip`, "application/zip");
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/workspace/upload") {
    await handleUpload(req, res, user);
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/settings") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const redirectTo = String(form.redirectTo || "/portal/admin/users").trim();
    db.settings.allowRegistration = form.allowRegistration === "1";
    await logPortalEvent({ type: "portal_settings_updated", userId: user.id, allowRegistration: db.settings.allowRegistration });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/announcements/save") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const redirectTo = String(form.redirectTo || "/portal/app/admin/alerts").trim();
    const title = String(form.title || "").trim();
    const content = String(form.content || "").trim();
    if (!title || !content) {
      sendHtml(res, layoutV2("公告保存失败", `<div class="card">标题和内容不能为空。</div>`, user), 400);
      return;
    }
    db.settings.announcements = Array.isArray(db.settings.announcements) ? db.settings.announcements : [];
    const announcementId = String(form.id || "").trim();
    const rows = db.settings.announcements.map(normalizeAnnouncementRecord).filter(Boolean);
    const nextRecord = normalizeAnnouncementRecord({
      id: announcementId || randomUUID(),
      title,
      content,
      scope: form.scope || "all",
      status: form.status || "active",
      pinned: form.pinned === "1",
      createdAt: rows.find((item) => item.id === announcementId)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      operatorId: user.id,
    });
    if (!nextRecord) {
      sendHtml(res, layoutV2("公告保存失败", `<div class="card">公告格式无效。</div>`, user), 400);
      return;
    }
    const nextRows = rows.filter((item) => item.id !== nextRecord.id);
    if (nextRecord.pinned) {
      for (const row of nextRows) row.pinned = false;
    }
    nextRows.push(nextRecord);
    db.settings.announcements = nextRows.map(normalizeAnnouncementRecord).filter(Boolean);
    await logPortalEvent({ type: "announcement_saved", userId: user.id, announcementId: nextRecord.id, title: nextRecord.title });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/announcements/toggle") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const redirectTo = String(form.redirectTo || "/portal/app/admin/alerts").trim();
    const announcementId = String(form.id || "").trim();
    const action = String(form.actionType || "").trim();
    const rows = Array.isArray(db.settings.announcements) ? db.settings.announcements.map(normalizeAnnouncementRecord).filter(Boolean) : [];
    const target = rows.find((item) => item.id === announcementId);
    if (!target) {
      sendHtml(res, layoutV2("公告操作失败", `<div class="card">未找到目标公告。</div>`, user), 404);
      return;
    }
    if (action === "pin") {
      for (const row of rows) row.pinned = row.id === target.id;
    } else if (action === "activate") {
      target.status = "active";
    } else if (action === "deactivate") {
      target.status = "inactive";
    } else {
      sendHtml(res, layoutV2("公告操作失败", `<div class="card">不支持的公告动作。</div>`, user), 400);
      return;
    }
    target.updatedAt = new Date().toISOString();
    target.operatorId = user.id;
    db.settings.announcements = rows.map(normalizeAnnouncementRecord).filter(Boolean);
    await logPortalEvent({ type: "announcement_toggled", userId: user.id, announcementId: target.id, action });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/announcements/delete") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const redirectTo = String(form.redirectTo || "/portal/app/admin/alerts").trim();
    const announcementId = String(form.id || "").trim();
    const rows = Array.isArray(db.settings.announcements) ? db.settings.announcements.map(normalizeAnnouncementRecord).filter(Boolean) : [];
    db.settings.announcements = rows.filter((item) => item.id !== announcementId);
    await logPortalEvent({ type: "announcement_deleted", userId: user.id, announcementId });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/create-user") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const redirectTo = String(form.redirectTo || "/portal/admin/users").trim();
    if (db.users.find((item) => item.email === form.email)) {
      sendHtml(res, layoutV2("创建失败", `<div class="card">邮箱已存在。</div>`, user), 400);
      return;
    }
    let identitySync = { synced: false, source: "portal_local_identity" };
    try {
      identitySync = await runZitadelAdminUser([
        "create-user",
        form.email,
        form.name,
        form.password,
      ]);
    } catch (error) {
      const detail = String(error.stdout || error.stderr || error.message || error);
      sendHtml(res, layoutV2("创建失败", `<div class="card">ZITADEL 同步失败。<br/><code>${detail.slice(0, 400)}</code></div>`, user), 502);
      return;
    }
    const id = randomUUID();
    const created = { id, email: form.email, name: form.name, role: "user", status: "active", currentTaskSlug: "default", preferences: { theme: "light" }, passwordHash: hashPassword(form.password), createdAt: new Date().toISOString() };
    db.users.push(created);
    db.wallets.push({ userId: id, balance: 0, updatedAt: new Date().toISOString() });
    await ensureTaskSpace(db, created, "default", defaultTaskTitle("default"));
    await logPortalEvent({ type: "admin_created_user", userId: id, operatorId: user.id, email: created.email, authSource: identitySync.source });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/update-user") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const redirectTo = String(form.redirectTo || "/portal/app/admin/users").trim();
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin" && activeUserStatus(item.status) !== "deleted");
    if (!target) {
      sendHtml(res, layoutV2("更新失败", `<div class="card">未找到目标用户。</div>`, user), 404);
      return;
    }
    const nextEmail = String(form.email || target.email || "").trim().toLowerCase();
    const nextName = String(form.name || target.name || "").trim();
    const nextPassword = String(form.password || "").trim();
    if (!nextEmail || !nextName) {
      sendHtml(res, layoutV2("更新失败", `<div class="card">用户名和邮箱不能为空。</div>`, user), 400);
      return;
    }
    const duplicated = db.users.find((item) => item.id !== target.id && String(item.email || "").toLowerCase() === nextEmail);
    if (duplicated) {
      sendHtml(res, layoutV2("更新失败", `<div class="card">邮箱已被其他账户占用。</div>`, user), 400);
      return;
    }
    target.email = nextEmail;
    target.name = nextName;
    if (nextPassword) target.passwordHash = hashPassword(nextPassword);
    await logPortalEvent({ type: "user_profile_updated", userId: target.id, operatorId: user.id, email: target.email, name: target.name });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/groups/create") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const redirectTo = String(form.redirectTo || "/portal/admin/groups").trim();
    const name = String(form.name || "").trim();
    if (!name) {
      sendHtml(res, layoutV2("创建失败", `<div class="card">分组名称不能为空。</div>`, user), 400);
      return;
    }
    if (db.groups.some((group) => String(group.name || "").toLowerCase() === name.toLowerCase())) {
      sendHtml(res, layoutV2("创建失败", `<div class="card">分组名称已存在。</div>`, user), 400);
      return;
    }
    db.groups.push({
      id: randomUUID(),
      name,
      plan: String(form.plan || "").trim(),
      status: String(form.status || "active").trim(),
      balanceFloor: Number(form.balanceFloor || 0),
      maxWorkspaces: Number(form.maxWorkspaces || 0),
      maxConcurrentRuns: Number(form.maxConcurrentRuns || 0),
      cpuRequest: String(form.cpuRequest || "").trim(),
      cpuLimit: String(form.cpuLimit || "").trim(),
      memoryRequest: String(form.memoryRequest || "").trim(),
      memoryLimit: String(form.memoryLimit || "").trim(),
      gpuCount: Number(form.gpuCount || 0),
      storageRequest: String(form.storageRequest || "").trim(),
      storageLimit: String(form.storageLimit || "").trim(),
      allowMas: form.allowMas === "1",
      allowWorkspaceCreate: form.allowWorkspaceCreate === "1",
      createdAt: new Date().toISOString(),
    });
    await logPortalEvent({ type: "group_created", userId: user.id, groupName: name });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/groups/assign") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const redirectTo = String(form.redirectTo || "/portal/admin/groups").trim();
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const group = db.groups.find((item) => item.id === form.groupId);
    if (!target || !group) {
      sendHtml(res, layoutV2("分配失败", `<div class="card">用户或分组不存在。</div>`, user), 400);
      return;
    }
    target.groupId = group.id;
    await logPortalEvent({ type: "group_assigned", userId: target.id, operatorId: user.id, groupId: group.id });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/user-profile") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const nextEmail = String(form.email || "").trim().toLowerCase();
    const nextName = String(form.name || "").trim();
    if (!target || !nextEmail || !nextName) {
      sendHtml(res, layoutV2("保存失败", `<div class="card">参数不完整。</div>`, user), 400);
      return;
    }
    if (db.users.some((item) => item.id !== target.id && String(item.email || "").toLowerCase() === nextEmail)) {
      sendHtml(res, layoutV2("保存失败", `<div class="card">邮箱已存在。</div>`, user), 400);
      return;
    }
    try {
      await runZitadelAdminUser([
        "update-profile",
        target.email,
        nextEmail,
        nextName,
      ]);
    } catch (error) {
      const detail = String(error.stdout || error.stderr || error.message || error);
      sendHtml(res, layoutV2("同步失败", `<div class="card">ZITADEL 用户资料同步失败。<br/><code>${detail.slice(0, 400)}</code></div>`, user), 502);
      return;
    }
    target.name = nextName;
    target.email = nextEmail;
    await logPortalEvent({ type: "user_profile_updated", userId: target.id, operatorId: user.id, email: nextEmail });
    await writeDb(db);
    res.writeHead(302, { Location: `/portal/admin/user?userId=${target.id}` });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/user-password") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const password = String(form.password || "").trim();
    if (!target || password.length < 8) {
      sendHtml(res, layoutV2("保存失败", `<div class="card">密码至少 8 位。</div>`, user), 400);
      return;
    }
    try {
      await runZitadelAdminUser([
        "reset-password",
        target.email,
        password,
      ]);
    } catch (error) {
      const detail = String(error.stdout || error.stderr || error.message || error);
      sendHtml(res, layoutV2("同步失败", `<div class="card">ZITADEL 密码重置失败。<br/><code>${detail.slice(0, 400)}</code></div>`, user), 502);
      return;
    }
    target.passwordHash = hashPassword(password);
    await logPortalEvent({ type: "user_password_reset", userId: target.id, operatorId: user.id });
    await writeDb(db);
    res.writeHead(302, { Location: `/portal/admin/user?userId=${target.id}` });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/recharge") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const redirectTo = String(form.redirectTo || "/portal/admin/users").trim();
    const amount = Number(form.amount || 0);
    const wallet = db.wallets.find((item) => item.userId === form.userId);
    if (!wallet || !Number.isFinite(amount) || amount <= 0) {
      sendHtml(res, layoutV2("充值失败", `<div class="card">参数错误</div>`, user), 400);
      return;
    }
    wallet.balance += amount;
    wallet.updatedAt = new Date().toISOString();
    db.ledger.push({ id: randomUUID(), userId: form.userId, type: "topup", amount, createdAt: new Date().toISOString(), operatorId: user.id });
    await logPortalEvent({ type: "wallet_topped_up", userId: form.userId, operatorId: user.id, amount });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/user-delete") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const confirmEmail = String(form.confirmEmail || "").trim().toLowerCase();
    if (!target || confirmEmail !== String(target.email || "").toLowerCase()) {
      sendHtml(res, layoutV2("删除失败", `<div class="card">确认邮箱不匹配。</div>`, user), 400);
      return;
    }
    try {
      await runZitadelAdminUser([
        "delete",
        target.email,
      ]);
    } catch (error) {
      const detail = String(error.stdout || error.stderr || error.message || error);
      sendHtml(res, layoutV2("同步失败", `<div class="card">ZITADEL 删除用户失败。<br/><code>${detail.slice(0, 400)}</code></div>`, user), 502);
      return;
    }
    db.users = db.users.filter((item) => item.id !== target.id);
    db.sessions = db.sessions.filter((item) => item.userId !== target.id);
    db.wallets = db.wallets.filter((item) => item.userId !== target.id);
    db.workspaceSessions = db.workspaceSessions.filter((item) => item.userId !== target.id);
    db.userSandboxes = db.userSandboxes.filter((item) => item.userId !== target.id);
    db.taskSpaces = db.taskSpaces.filter((item) => item.userId !== target.id);
    await logPortalEvent({ type: "user_deleted", userId: target.id, operatorId: user.id, email: target.email });
    await writeDb(db);
    res.writeHead(302, { Location: "/portal/admin" });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/toggle-user") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const redirectTo = String(form.redirectTo || "/portal/admin").trim();
    const target = db.users.find((item) => item.id === form.userId);
    if (!target || target.role === "admin") {
      sendHtml(res, layoutV2("操作失败", `<div class="card">目标用户不存在或不可操作。</div>`, user), 400);
      return;
    }
    target.status = target.status === "disabled" ? "active" : "disabled";
    await logPortalEvent({ type: "user_status_changed", userId: target.id, operatorId: user.id, status: target.status });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/portal/admin/delete-user") {
    if (user.role !== "admin") {
      sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
      return;
    }
    const form = parseForm((await readBody(req)).toString("utf8"));
    const redirectTo = String(form.redirectTo || "/portal/app/admin/users").trim();
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    if (!target) {
      sendHtml(res, layoutV2("删除失败", `<div class="card">未找到目标用户。</div>`, user), 404);
      return;
    }
    target.status = "deleted";
    target.deletedAt = new Date().toISOString();
    db.sessions = db.sessions.filter((session) => session.userId !== target.id);
    for (const session of db.workspaceSessions.filter((entry) => entry.userId === target.id)) {
      session.status = "deleted";
      session.lastUsedAt = new Date().toISOString();
    }
    await logPortalEvent({ type: "user_deleted", userId: target.id, operatorId: user.id });
    await writeDb(db);
    res.writeHead(302, { Location: redirectTo });
    res.end();
    return;
  }
  sendHtml(res, layoutV2("未找到", `<div class="card">未找到对应页面。</div>`, user), 404);
});

ensureStorageInfra().then(() => {
  validateProductionConfig();
  server.listen(PORT, () => {
    console.log(`portal listening on :${PORT}`);
  });
});
