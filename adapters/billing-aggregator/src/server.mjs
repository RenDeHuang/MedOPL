import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { access, readFile, readdir, writeFile, stat, mkdir, appendFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createHash, createHmac, randomUUID } from "node:crypto";
import pg from "pg";

const PORT = Number(process.env.PORT || 3001);
const OPENCOST_BASE_URL = (process.env.OPENCOST_BASE_URL || "").trim();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../");
const portalDbFile = path.join(repoRoot, ".runtime", "portal", "portal-db.json");
const medRunsRoot = path.join(repoRoot, ".runtime", "med-autoscience", "runs");
const medWorkspacesRoot = path.join(repoRoot, ".runtime", "med-autoscience", "workspaces");
const codexRuntimeEventsFile = path.join(repoRoot, ".runtime", "codex-runtime-gateway", "events.jsonl");
const runtimeRoot = path.join(repoRoot, ".runtime", "billing-aggregator");
const reconcileEventsFile = path.join(runtimeRoot, "events.jsonl");
const CPU_CORE_HOUR_RATE = Number(process.env.CPU_CORE_HOUR_RATE || "0.12");
const GPU_HOUR_RATE = Number(process.env.GPU_HOUR_RATE || "2.00");
const STORAGE_GB_DAY_RATE = Number(process.env.STORAGE_GB_DAY_RATE || "0.02");
const DEFAULT_CPU_CORES = Number(process.env.DEFAULT_CPU_CORES || "0.5");
const DEFAULT_GPU_COUNT = Number(process.env.DEFAULT_GPU_COUNT || "0");
const AUTO_RECONCILE_ENABLED = String(process.env.AUTO_RECONCILE_ENABLED || "1") !== "0";
const AUTO_RECONCILE_INTERVAL_MS = Number(process.env.AUTO_RECONCILE_INTERVAL_MS || "600000");
const AUTO_RECONCILE_WINDOW = String(process.env.AUTO_RECONCILE_WINDOW || "168h").trim() || "168h";
const BILLING_RECONCILE_ONCE = String(process.env.BILLING_RECONCILE_ONCE || "0") === "1";
const TENCENT_CLOUD_SECRET_ID = String(process.env.TENCENT_CLOUD_SECRET_ID || "").trim();
const TENCENT_CLOUD_SECRET_KEY = String(process.env.TENCENT_CLOUD_SECRET_KEY || "").trim();
const TENCENT_CLOUD_TOKEN = String(process.env.TENCENT_CLOUD_TOKEN || "").trim();
const TENCENT_CLOUD_REGION = String(process.env.TENCENT_CLOUD_REGION || "ap-guangzhou").trim();
const TENCENT_BILLING_ENABLED = String(process.env.TENCENT_BILLING_ENABLED || "0") === "1";
const TENCENT_BILLING_REQUIRED = String(process.env.TENCENT_BILLING_REQUIRED || "0") === "1";
const TENCENT_BILLING_ENDPOINT = String(process.env.TENCENT_BILLING_ENDPOINT || "billing.tencentcloudapi.com").trim();
const TENCENT_BILLING_VERSION = String(process.env.TENCENT_BILLING_VERSION || "2018-07-09").trim();
const TENCENT_BILLING_MAX_PAGES = Math.max(1, Number(process.env.TENCENT_BILLING_MAX_PAGES || 20));
const TENCENT_BILLING_PAGE_SIZE = Math.min(100, Math.max(1, Number(process.env.TENCENT_BILLING_PAGE_SIZE || 100)));
const TENCENT_PRICE_ENABLED = String(process.env.TENCENT_PRICE_ENABLED || "0") === "1";
const TENCENT_CVM_ENDPOINT = String(process.env.TENCENT_CVM_ENDPOINT || "cvm.tencentcloudapi.com").trim();
const TENCENT_CVM_VERSION = String(process.env.TENCENT_CVM_VERSION || "2017-03-12").trim();
const TENCENT_PRICE_IMAGE_ID = String(process.env.TENCENT_PRICE_IMAGE_ID || "").trim();
const SERVER_PLAN_CATALOG_JSON = String(process.env.SERVER_PLAN_CATALOG_JSON || "[]").trim();
const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "cancelled", "canceled", "timed_out", "completed"]);
const PORTAL_STORAGE_MODE = String(process.env.PORTAL_STORAGE_MODE || "postgres_redis").trim().toLowerCase();
const PORTAL_POSTGRES_URL = process.env.PORTAL_POSTGRES_URL || "postgres://postgres:postgres@127.0.0.1:5432/med_meta";
const PORTAL_DB_NAMESPACE = process.env.PORTAL_DB_NAMESPACE || "portal";

let reconcileState = {
  lastRunAt: "",
  lastWindow: "",
  lastScope: "all",
  lastReconciledCount: 0,
  lastExactCount: 0,
  lastEstimatedCount: 0,
  lastAdjustmentCount: 0,
  lastError: "",
};

let reconcileLoopRunning = false;
let portalPool = null;

function storageMode() {
  return PORTAL_STORAGE_MODE === "postgres_redis" ? "postgres_redis" : "json";
}

function portalTable(name) {
  return `${PORTAL_DB_NAMESPACE}_${name}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

function tencentCloudConfigured() {
  return Boolean(TENCENT_CLOUD_SECRET_ID && TENCENT_CLOUD_SECRET_KEY);
}

function parseJsonEnv(raw, fallback) {
  if (!String(raw || "").trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function parseWindowHours(windowValue = "168h") {
  const raw = String(windowValue || "").trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)(h|d)$/);
  if (!match) return 168;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 168;
  return match[2] === "d" ? value * 24 : value;
}

function formatTencentTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    "-",
    pad(date.getUTCMonth() + 1),
    "-",
    pad(date.getUTCDate()),
    " ",
    pad(date.getUTCHours()),
    ":",
    pad(date.getUTCMinutes()),
    ":",
    pad(date.getUTCSeconds()),
  ].join("");
}

function windowDateRange(windowValue = "168h") {
  const end = new Date();
  const begin = new Date(end.getTime() - parseWindowHours(windowValue) * 3_600_000);
  return { begin, end };
}

function tencentMonthlyWindowRanges(windowValue = "168h") {
  const { begin, end } = windowDateRange(windowValue);
  const ranges = [];
  let cursor = new Date(begin);

  while (cursor.getTime() <= end.getTime()) {
    const nextMonthStart = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 0, 0, 0));
    const rangeEnd = new Date(Math.min(end.getTime(), nextMonthStart.getTime() - 1000));
    ranges.push({
      beginTime: formatTencentTime(cursor),
      endTime: formatTencentTime(rangeEnd),
    });
    cursor = new Date(rangeEnd.getTime() + 1000);
  }

  return ranges;
}

function firstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeTags(rawTags) {
  if (!rawTags) return {};
  if (Array.isArray(rawTags)) {
    return Object.fromEntries(rawTags.map((tag) => [
      firstString(tag.TagKey, tag.Key, tag.tagKey, tag.key),
      firstString(tag.TagValue, tag.Value, tag.tagValue, tag.value),
    ]).filter(([key]) => key));
  }
  if (typeof rawTags === "object") {
    return Object.fromEntries(Object.entries(rawTags).map(([key, value]) => [key, String(value ?? "")]));
  }
  return {};
}

async function callTencentCloud({ endpoint, service, action, version, region, payload = {} }) {
  if (!tencentCloudConfigured()) {
    const error = new Error("tencent_cloud_credentials_not_configured");
    error.status = 503;
    throw error;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const body = JSON.stringify(payload);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${endpoint}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256(body),
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const secretDate = hmac(`TC3${TENCENT_CLOUD_SECRET_KEY}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = hmac(secretSigning, stringToSign, "hex");
  const authorization = `TC3-HMAC-SHA256 Credential=${TENCENT_CLOUD_SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    authorization,
    "content-type": "application/json; charset=utf-8",
    host: endpoint,
    "x-tc-action": action,
    "x-tc-region": region,
    "x-tc-timestamp": String(timestamp),
    "x-tc-version": version,
  };
  if (TENCENT_CLOUD_TOKEN) headers["x-tc-token"] = TENCENT_CLOUD_TOKEN;

  const response = await fetch(`https://${endpoint}`, {
    method: "POST",
    headers,
    body,
  });
  const result = await response.json().catch(() => ({}));
  const apiError = result?.Response?.Error;
  if (!response.ok || apiError) {
    const error = new Error(apiError?.Message || `tencent_cloud_${action}_failed:${response.status}`);
    error.status = response.status;
    error.code = apiError?.Code || "";
    error.payload = result;
    throw error;
  }
  return result.Response || result;
}

async function ensurePortalPool() {
  if (!portalPool) {
    const { Pool } = pg;
    portalPool = new Pool({ connectionString: PORTAL_POSTGRES_URL });
  }
  return portalPool;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

async function exists(file) {
  try {
    await access(file, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readPortalDb() {
  if (storageMode() === "postgres_redis") {
    const pool = await ensurePortalPool();
    const [walletsRes, ledgerRes] = await Promise.all([
      pool.query(`SELECT * FROM ${portalTable("wallets")}`),
      pool.query(`SELECT * FROM ${portalTable("ledger_entries")} ORDER BY created_at ASC`),
    ]);
    return {
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
        reason: row.reason || "",
        operatorId: row.operator_id || "",
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      })),
    };
  }
  if (!(await exists(portalDbFile))) return null;
  return JSON.parse(await readFile(portalDbFile, "utf8"));
}

async function writePortalDb(db) {
  if (storageMode() === "postgres_redis") {
    const pool = await ensurePortalPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of db.wallets || []) {
        await client.query(
          `INSERT INTO ${portalTable("wallets")} (user_id,balance,updated_at)
           VALUES ($1,$2,$3)
           ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = EXCLUDED.updated_at`,
          [row.userId, Number(row.balance || 0), row.updatedAt || new Date().toISOString()],
        );
      }

      const existingRes = await client.query(`SELECT id FROM ${portalTable("ledger_entries")}`);
      const existing = new Set(existingRes.rows.map((row) => row.id));
      for (const row of db.ledger || []) {
        if (existing.has(row.id)) continue;
        await client.query(
          `INSERT INTO ${portalTable("ledger_entries")} (id,user_id,run_id,workspace_id,type,amount,reason,operator_id,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            row.id,
            row.userId || "",
            row.runId || "",
            row.workspaceId || "",
            row.type || "",
            Number(row.amount || 0),
            row.reason || "",
            row.operatorId || "",
            row.createdAt || new Date().toISOString(),
          ],
        );
      }
      await client.query("COMMIT");
      return;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  await writeFile(portalDbFile, JSON.stringify(db, null, 2), "utf8");
}

async function logRuntimeEvent(event) {
  await mkdir(runtimeRoot, { recursive: true });
  await appendFile(reconcileEventsFile, `${JSON.stringify({ occurredAt: new Date().toISOString(), ...event })}\n`, "utf8");
}

async function readRuns() {
  const runs = [];

  if (await exists(medRunsRoot)) {
    const files = await readdir(medRunsRoot);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        runs.push(JSON.parse(await readFile(path.join(medRunsRoot, file), "utf8")));
      } catch {}
    }
  }

  if (await exists(codexRuntimeEventsFile)) {
    try {
      const raw = await readFile(codexRuntimeEventsFile, "utf8");
      const lines = raw.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.type !== "codex_runtime_run") continue;
          runs.push({
            runId: event.runId,
            customerId: event.portalUserId,
            userId: event.portalUserId,
            workspaceId: event.workspaceId,
            createdAt: event.occurredAt,
            updatedAt: event.occurredAt,
            status: Number(event.exitCode || 0) === 0 ? "completed" : "failed",
            source: "codex_runtime",
            exitCode: Number(event.exitCode || 0),
          });
        } catch {}
      }
    } catch {}
  }

  const deduped = new Map();
  for (const run of runs) {
    const key = run.runId || randomUUID();
    const existing = deduped.get(key);
    if (!existing || String(run.createdAt || "") > String(existing.createdAt || "")) {
      deduped.set(key, run);
    }
  }
  return [...deduped.values()];
}

async function collectWorkspaceBytes(dir) {
  if (!(await exists(dir))) return 0;
  const entries = await readdir(dir, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await collectWorkspaceBytes(full);
      continue;
    }
    if (entry.isFile()) {
      total += (await stat(full)).size;
    }
  }
  return total;
}

function completionTimestamp(run) {
  const condition = run?.k8sStatus?.conditions?.find?.((item) => item.type === "Complete" && item.status === "True");
  return condition?.lastTransitionTime || condition?.lastProbeTime || run?.updatedAt || run?.createdAt || null;
}

async function estimateRunCosts(customerId) {
  const runs = await readRuns();
  const estimated = [];
  for (const run of runs) {
    if (!isCompletedRun(run)) continue;
    if (customerId && run.customerId !== customerId && run.userId !== customerId) continue;

    const createdAt = new Date(run.createdAt || Date.now());
    const completedAt = new Date(completionTimestamp(run) || Date.now());
    const durationHours = Math.max(0.001, (completedAt.getTime() - createdAt.getTime()) / 3_600_000);
    const workspaceRoot = path.join(medWorkspacesRoot, run.customerId || run.userId || "", run.workspaceId || "");
    const storageBytes = await collectWorkspaceBytes(workspaceRoot);
    const storageGbDays = Math.max(0, storageBytes / (1024 ** 3)) * (durationHours / 24);

    const cpuCost = DEFAULT_CPU_CORES * durationHours * CPU_CORE_HOUR_RATE;
    const gpuCost = DEFAULT_GPU_COUNT * durationHours * GPU_HOUR_RATE;
    const pvCost = storageGbDays * STORAGE_GB_DAY_RATE;
    const totalCost = cpuCost + gpuCost + pvCost;

    estimated.push({
      runId: run.runId,
      workspaceId: run.workspaceId || "unknown-workspace",
      customerId: run.customerId || run.userId || null,
      start: run.createdAt || null,
      end: completionTimestamp(run),
      cpuCost,
      gpuCost,
      pvCost,
      totalCost,
      pricingSource: "estimated",
      breakdown: {
        durationHours,
        cpuCores: DEFAULT_CPU_CORES,
        gpuCount: DEFAULT_GPU_COUNT,
        storageBytes
      }
    });
  }
  return estimated;
}

function parseCpuCores(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  if (raw.endsWith("m")) return Number(raw.slice(0, -1)) / 1000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseGpuCount(manifest = "") {
  const match = String(manifest).match(/nvidia\.com\/gpu:\s*["']?([0-9.]+)["']?/i);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function exactRequestedRunCosts(customerId = "", workspaceId = "") {
  const runs = await readRuns();
  const exact = [];

  for (const run of runs) {
    if (!isCompletedRun(run)) continue;
    if (customerId && run.customerId !== customerId && run.userId !== customerId) continue;
    if (workspaceId && run.workspaceId !== workspaceId) continue;
    if (!run.manifestPath || !(await exists(run.manifestPath))) continue;

    let manifest = "";
    try {
      manifest = await readFile(run.manifestPath, "utf8");
    } catch {
      continue;
    }

    const cpuRequestMatch = manifest.match(/requests:\s*[\r\n]+\s*cpu:\s*["']?([^"'\r\n]+)["']?/i);
    const cpuCores = parseCpuCores(cpuRequestMatch?.[1] || "");
    const gpuCount = parseGpuCount(manifest);
    if (cpuCores <= 0 && gpuCount <= 0) continue;

    const createdAt = new Date(run.createdAt || Date.now());
    const completedAt = new Date(completionTimestamp(run) || Date.now());
    const durationHours = Math.max(0.001, (completedAt.getTime() - createdAt.getTime()) / 3_600_000);
    const workspaceRoot = path.join(medWorkspacesRoot, run.customerId || run.userId || "", run.workspaceId || "");
    const storageBytes = await collectWorkspaceBytes(workspaceRoot);
    const storageGbDays = Math.max(0, storageBytes / (1024 ** 3)) * (durationHours / 24);

    const cpuCost = cpuCores * durationHours * CPU_CORE_HOUR_RATE;
    const gpuCost = gpuCount * durationHours * GPU_HOUR_RATE;
    const pvCost = storageGbDays * STORAGE_GB_DAY_RATE;
    const totalCost = cpuCost + gpuCost + pvCost;

    exact.push({
      runId: run.runId,
      workspaceId: run.workspaceId || "unknown-workspace",
      customerId: run.customerId || run.userId || null,
      start: run.createdAt || null,
      end: completionTimestamp(run),
      cpuCost,
      gpuCost,
      pvCost,
      totalCost,
      pricingSource: "K8s requested resources exact",
      breakdown: {
        durationHours,
        cpuCores,
        gpuCount,
        storageBytes
      }
    });
  }

  return exact;
}

function asEntries(data) {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data.flatMap((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return Object.values(item);
      }
      return [];
    });
  }

  if (typeof data === "object") {
    return Object.values(data);
  }

  return [];
}

function filterEntries(entries, customerId, workspaceId = "") {
  return entries.filter((entry) => {
    const props = entry?.properties || {};
    const customerOk = !customerId || props["label:customer_id"] === customerId || props.customer_id === customerId || entry?.name?.includes(customerId);
    const workspaceOk = !workspaceId || props["label:workspace_id"] === workspaceId || props.workspace_id === workspaceId || entry?.name?.includes(workspaceId);
    return customerOk && workspaceOk;
  });
}

function explainRuns(entries) {
  const grouped = new Map();

  for (const entry of entries) {
    const props = entry?.properties || {};
    const runId = props["label:run_id"] || props.run_id || entry?.name || "unknown-run";
    const workspaceId = props["label:workspace_id"] || props.workspace_id || "unknown-workspace";
    const customerId = props["label:customer_id"] || props.customer_id || null;
    const current = grouped.get(runId) || {
      runId,
      workspaceId,
      customerId,
      start: entry?.start || null,
      end: entry?.end || null,
      cpuCost: 0,
      gpuCost: 0,
      pvCost: 0,
      totalCost: 0,
      sources: []
    };

    current.cpuCost += Number(entry?.cpuCost || 0);
    current.gpuCost += Number(entry?.gpuCost || 0);
    current.pvCost += Number(entry?.pvCost || 0);
    current.totalCost += Number(entry?.totalCost || 0);
    current.sources.push(entry?.name || "allocation");
    grouped.set(runId, current);
  }

  return [...grouped.values()].sort((a, b) => Number(b.totalCost || 0) - Number(a.totalCost || 0));
}

function summarize(entries, customerId, workspaceId = "") {
  const filtered = filterEntries(entries, customerId, workspaceId);
  const filteredRuns = explainRuns(filtered);

  const totals = filtered.reduce(
    (acc, entry) => {
      acc.cpuCost += Number(entry?.cpuCost || 0);
      acc.gpuCost += Number(entry?.gpuCost || 0);
      acc.pvCost += Number(entry?.pvCost || 0);
      acc.totalCost += Number(entry?.totalCost || 0);
      return acc;
    },
    { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 }
  );

  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    itemCount: filtered.length,
    totals,
    runs: filteredRuns,
    items: filtered.map((entry) => ({
      name: entry?.name || null,
      start: entry?.start || null,
      end: entry?.end || null,
      cpuCost: Number(entry?.cpuCost || 0),
      gpuCost: Number(entry?.gpuCost || 0),
      pvCost: Number(entry?.pvCost || 0),
      totalCost: Number(entry?.totalCost || 0),
      properties: entry?.properties || {}
    }))
  };
}

function summaryFromEstimatedRuns(runs, customerId) {
  const totals = runs.reduce(
    (acc, item) => {
      acc.cpuCost += Number(item.cpuCost || 0);
      acc.gpuCost += Number(item.gpuCost || 0);
      acc.pvCost += Number(item.pvCost || 0);
      acc.totalCost += Number(item.totalCost || 0);
      return acc;
    },
    { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 }
  );

  return {
    customerId: customerId || null,
    source: "metering_pending",
    cloudSource: "local_metering",
    itemCount: runs.length,
    totals,
    runs,
    items: runs.map((item) => ({
      name: item.runId,
      start: item.start,
      end: item.end,
      cpuCost: item.cpuCost,
      gpuCost: item.gpuCost,
      pvCost: item.pvCost,
      totalCost: item.totalCost,
      properties: {
        customer_id: item.customerId,
        workspace_id: item.workspaceId,
        run_id: item.runId,
        pricing_source: item.pricingSource,
        duration_hours: item.breakdown.durationHours,
        cpu_cores: item.breakdown.cpuCores,
        gpu_count: item.breakdown.gpuCount,
        storage_bytes: item.breakdown.storageBytes
      }
    }))
  };
}

async function fetchAllocation(windowValue, aggregateValue = "") {
  if (!OPENCOST_BASE_URL) {
    throw new Error("Missing OPENCOST_BASE_URL");
  }

  const url = new URL("/allocation", OPENCOST_BASE_URL);
  url.searchParams.set("window", windowValue || "7d");
  if (aggregateValue) {
    url.searchParams.set("aggregate", aggregateValue);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenCost request failed with status ${response.status}`);
  }

  return response.json();
}

function tencentBillRows(response) {
  const rows =
    response?.DetailSet ||
    response?.DetailList ||
    response?.BillDetailSet ||
    response?.BillDetailList ||
    response?.Response?.DetailSet ||
    [];
  return Array.isArray(rows) ? rows : [];
}

function normalizeTencentBillRow(row = {}) {
  const tags = normalizeTags(row.Tags || row.Tag || row.ResourceTags || row.TagSet);
  const tenantId = firstString(tags.tenant_id, tags.tenantId, tags.customer_id, tags.customerId, row.TenantId, row.CustomerId);
  const workspaceId = firstString(tags.workspace_id, tags.workspaceId, row.WorkspaceId);
  const runId = firstString(tags.run_id, tags.runId, row.RunId);
  const hasExactRunAttribution = Boolean(tenantId && workspaceId && runId);
  const resourceId = firstString(row.ResourceId, row.InstanceId, row.ResourceName, row.ResourceIdName);
  const product = firstString(row.BusinessCodeName, row.ProductCodeName, row.ProductName, row.BusinessCode);
  const component = firstString(row.ComponentCodeName, row.BillingItemCodeName, row.ComponentName, row.ItemName);
  const region = firstString(row.RegionName, row.Region, row.RegionId);
  const zone = firstString(row.ZoneName, row.Zone);
  const cost = firstNumber(
    row.RealTotalCost,
    row.RealCost,
    row.CashPayAmount,
    row.TotalCost,
    row.Cost,
    row.BillAmount,
  );

  return {
    runId: runId || resourceId || randomUUID(),
    workspaceId: workspaceId || "unattributed",
    customerId: tenantId || "",
    tenantId: tenantId || "",
    start: firstString(row.FeeBeginTime, row.BeginTime, row.SettleBeginTime, row.PayTime, row.CreatedTime),
    end: firstString(row.FeeEndTime, row.EndTime, row.SettleEndTime, row.PayTime, row.CreatedTime),
    cpuCost: 0,
    gpuCost: 0,
    pvCost: 0,
    totalCost: cost,
    pricingSource: hasExactRunAttribution ? "tencent_cloud_bill" : "tencent_cloud_bill_unattributed",
    hasExactRunAttribution,
    properties: {
      pricing_source: hasExactRunAttribution ? "tencent_cloud_bill" : "tencent_cloud_bill_unattributed",
      cloud_source: "tencent_cloud",
      attribution_state: hasExactRunAttribution ? "run_attributed" : "unattributed",
      tenant_id: tenantId,
      customer_id: tenantId,
      workspace_id: workspaceId,
      run_id: runId,
      resource_id: resourceId,
      product,
      component,
      region,
      zone,
      tags,
      raw: row,
    },
  };
}

function summaryFromTencentBillRows(rows, customerId = "", workspaceId = "") {
  const normalized = rows.map(normalizeTencentBillRow).filter((item) => {
    const customerOk = !customerId || item.customerId === customerId || item.properties.tags?.customer_id === customerId;
    const workspaceOk = !workspaceId || item.workspaceId === workspaceId || item.properties.tags?.workspace_id === workspaceId;
    return customerOk && workspaceOk;
  });

  const grouped = new Map();
  for (const item of normalized) {
    const key = item.runId || item.properties.resource_id || randomUUID();
    const current = grouped.get(key) || {
      runId: item.runId,
      workspaceId: item.workspaceId,
      customerId: item.customerId,
      start: item.start,
      end: item.end,
      cpuCost: 0,
      gpuCost: 0,
      pvCost: 0,
      totalCost: 0,
      sources: [],
      pricingSource: item.pricingSource,
      hasExactRunAttribution: item.hasExactRunAttribution,
      properties: {
        pricing_source: item.pricingSource,
        cloud_source: "tencent_cloud",
        attribution_state: item.hasExactRunAttribution ? "run_attributed" : "unattributed",
        customer_id: item.customerId,
        tenant_id: item.tenantId,
        workspace_id: item.workspaceId,
        run_id: item.runId,
      },
    };
    current.totalCost += Number(item.totalCost || 0);
    current.sources.push(item.properties.resource_id || item.properties.product || "tencent_bill_detail");
    if (!current.start || String(item.start || "") < String(current.start)) current.start = item.start || current.start;
    if (!current.end || String(item.end || "") > String(current.end)) current.end = item.end || current.end;
    grouped.set(key, current);
  }

  const runs = [...grouped.values()].sort((a, b) => Number(b.totalCost || 0) - Number(a.totalCost || 0));
  const exactRunCount = runs.filter((item) => item.pricingSource === "tencent_cloud_bill").length;
  const unattributedRunCount = runs.length - exactRunCount;
  const totals = runs.reduce((acc, item) => {
    acc.totalCost += Number(item.totalCost || 0);
    return acc;
  }, { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 });

  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    source: exactRunCount > 0 ? "tencent_cloud_bill" : "tencent_cloud_bill_unattributed",
    cloudSource: "tencent_cloud",
    itemCount: runs.length,
    exactRunCount,
    unattributedRunCount,
    totals,
    runs,
    items: runs.map((item) => ({
      name: item.runId,
      start: item.start,
      end: item.end,
      cpuCost: item.cpuCost,
      gpuCost: item.gpuCost,
      pvCost: item.pvCost,
      totalCost: item.totalCost,
      pricingSource: item.pricingSource,
      properties: item.properties,
    })),
  };
}

async function fetchTencentBillSummary(customerId = "", workspaceId = "", windowValue = "168h") {
  if (!TENCENT_BILLING_ENABLED) {
    const error = new Error("tencent_billing_disabled");
    error.status = 503;
    throw error;
  }
  const rows = [];
  for (const range of tencentMonthlyWindowRanges(windowValue)) {
    let rangeRows = 0;
    for (let page = 0; page < TENCENT_BILLING_MAX_PAGES; page += 1) {
      const response = await callTencentCloud({
        endpoint: TENCENT_BILLING_ENDPOINT,
        service: "billing",
        action: "DescribeBillDetail",
        version: TENCENT_BILLING_VERSION,
        region: TENCENT_CLOUD_REGION,
        payload: {
          Offset: page * TENCENT_BILLING_PAGE_SIZE,
          Limit: TENCENT_BILLING_PAGE_SIZE,
          BeginTime: range.beginTime,
          EndTime: range.endTime,
        },
      });
      const billRows = tencentBillRows(response);
      rows.push(...billRows);
      rangeRows += billRows.length;
      const total = Number(response.Total || response.TotalCount || 0);
      if (!total || rangeRows >= total || billRows.length < TENCENT_BILLING_PAGE_SIZE) break;
      if (page + 1 >= TENCENT_BILLING_MAX_PAGES && rangeRows < total) {
        const error = new Error(`tencent_billing_detail_truncated:${rangeRows}/${total}`);
        error.status = 502;
        throw error;
      }
    }
  }
  return summaryFromTencentBillRows(rows, customerId, workspaceId);
}

function serverPlanCatalog() {
  const parsed = parseJsonEnv(SERVER_PLAN_CATALOG_JSON, []);
  return Array.isArray(parsed) ? parsed : [];
}

function normalizeTencentPrice(response = {}) {
  const price = response.Price || response.InstancePrice || response;
  const instancePrice = price.InstancePrice || price;
  return {
    currency: firstString(price.Currency, instancePrice.Currency, "CNY"),
    originalPrice: firstNumber(instancePrice.OriginalPrice, price.OriginalPrice),
    discountPrice: firstNumber(instancePrice.DiscountPrice, price.DiscountPrice, instancePrice.UnitPrice, price.UnitPrice),
    unitPrice: firstNumber(instancePrice.UnitPrice, price.UnitPrice, instancePrice.DiscountPrice, price.DiscountPrice),
    raw: response,
  };
}

async function quoteTencentServerPlan(plan) {
  if (!TENCENT_PRICE_ENABLED) {
    return { priceStatus: "disabled", salable: false, reason: "tencent_price_disabled" };
  }
  if (!tencentCloudConfigured()) {
    return { priceStatus: "not_configured", salable: false, reason: "tencent_cloud_credentials_not_configured" };
  }
  if (!plan.zone || !plan.instanceType) {
    return { priceStatus: "invalid_plan", salable: false, reason: "zone_and_instanceType_required" };
  }
  const imageId = firstString(plan.imageId, TENCENT_PRICE_IMAGE_ID);
  if (!imageId) {
    return { priceStatus: "invalid_plan", salable: false, reason: "imageId_or_TENCENT_PRICE_IMAGE_ID_required" };
  }
  try {
    const response = await callTencentCloud({
      endpoint: TENCENT_CVM_ENDPOINT,
      service: "cvm",
      action: "InquiryPriceRunInstances",
      version: TENCENT_CVM_VERSION,
      region: plan.region || TENCENT_CLOUD_REGION,
      payload: {
        InstanceChargeType: plan.instanceChargeType || "POSTPAID_BY_HOUR",
        Placement: { Zone: plan.zone },
        InstanceType: plan.instanceType,
        ImageId: imageId,
        SystemDisk: plan.systemDisk || {
          DiskType: plan.systemDiskType || "CLOUD_BSSD",
          DiskSize: Number(plan.systemDiskSize || 50),
        },
        DataDisks: Array.isArray(plan.dataDisks) ? plan.dataDisks : [],
        InternetAccessible: plan.internetAccessible || { InternetChargeType: "TRAFFIC_POSTPAID_BY_HOUR", InternetMaxBandwidthOut: 1 },
        InstanceCount: 1,
      },
    });
    return {
      priceStatus: "quoted",
      salable: true,
      ...normalizeTencentPrice(response),
    };
  } catch (error) {
    return {
      priceStatus: "quote_failed",
      salable: false,
      reason: String(error.message || error),
      code: error.code || "",
    };
  }
}

async function listServerPlans() {
  const plans = serverPlanCatalog();
  const items = [];
  for (const plan of plans) {
    const quote = plan.provider === "tencent" || !plan.provider
      ? await quoteTencentServerPlan(plan)
      : { priceStatus: "external_provider", salable: false, reason: "unsupported_provider" };
    items.push({
      id: firstString(plan.id, plan.serverPlanId, plan.instanceType),
      name: firstString(plan.name, plan.instanceType),
      provider: plan.provider || "tencent",
      region: plan.region || TENCENT_CLOUD_REGION,
      zone: plan.zone || "",
      instanceType: plan.instanceType || "",
      cpu: Number(plan.cpu || 0),
      memoryGb: Number(plan.memoryGb || plan.memory || 0),
      gpu: Number(plan.gpu || plan.gpuCount || 0),
      nodePool: plan.nodePool || "",
      runtimeClass: plan.runtimeClass || "",
      minBillableHours: Number(plan.minBillableHours || 1),
      riskFactor: Number(plan.riskFactor || 1.2),
      reservationFloor: Number(plan.reservationFloor || 0),
      ...quote,
    });
  }
  return {
    ok: true,
    source: "tencent_cloud_price",
    configured: tencentCloudConfigured(),
    priceEnabled: TENCENT_PRICE_ENABLED,
    catalogCount: plans.length,
    items,
  };
}

function labelValue(entry, key) {
  const props = entry?.properties || {};
  const labels = props.labels || {};
  return (
    labels[key] ||
    props[`label:${key}`] ||
    props[key] ||
    null
  );
}

function summaryFromRawAllocations(entries, customerId = "", workspaceId = "") {
  const grouped = new Map();

  for (const entry of entries) {
    const runId = labelValue(entry, "run_id");
    const entryCustomerId = labelValue(entry, "customer_id");
    const entryWorkspaceId = labelValue(entry, "workspace_id");

    if (!runId || !entryCustomerId || !entryWorkspaceId) continue;
    if (customerId && entryCustomerId !== customerId) continue;
    if (workspaceId && entryWorkspaceId !== workspaceId) continue;

    const current = grouped.get(runId) || {
      runId,
      workspaceId: entryWorkspaceId,
      customerId: entryCustomerId,
      start: entry?.start || null,
      end: entry?.end || null,
      cpuCost: 0,
      gpuCost: 0,
      pvCost: 0,
      totalCost: 0,
      sources: []
    };

    current.cpuCost += Number(entry?.cpuCost || 0);
    current.gpuCost += Number(entry?.gpuCost || 0);
    current.pvCost += Number(entry?.pvCost || 0);
    current.totalCost += Number(entry?.totalCost || 0);
    current.sources.push(entry?.name || "allocation");

    if (!current.start || String(entry?.start || "") < String(current.start)) current.start = entry?.start || current.start;
    if (!current.end || String(entry?.end || "") > String(current.end)) current.end = entry?.end || current.end;

    grouped.set(runId, current);
  }

  const runs = [...grouped.values()].sort((a, b) => Number(b.totalCost || 0) - Number(a.totalCost || 0));
  const totals = runs.reduce((acc, item) => {
    acc.cpuCost += Number(item.cpuCost || 0);
    acc.gpuCost += Number(item.gpuCost || 0);
    acc.pvCost += Number(item.pvCost || 0);
    acc.totalCost += Number(item.totalCost || 0);
    return acc;
  }, { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 });

  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    itemCount: runs.length,
    totals,
    runs,
    items: runs.map((item) => ({
      name: item.runId,
      start: item.start,
      end: item.end,
      cpuCost: item.cpuCost,
      gpuCost: item.gpuCost,
      pvCost: item.pvCost,
      totalCost: item.totalCost,
      properties: {
        customer_id: item.customerId,
        workspace_id: item.workspaceId,
        run_id: item.runId,
        pricing_source: "OpenCost raw allocation"
      }
    }))
  };
}

async function fetchExactSummary(customerId = "", workspaceId = "", windowValue = "7d") {
  if (TENCENT_BILLING_ENABLED) {
    try {
      const tencentSummary = await fetchTencentBillSummary(customerId, workspaceId, windowValue);
      if (tencentSummary.runs.length > 0 || TENCENT_BILLING_REQUIRED) {
        return tencentSummary;
      }
    } catch (error) {
      if (TENCENT_BILLING_REQUIRED) {
        throw error;
      }
    }
  }

  const aggregated = await fetchAllocation(windowValue, "label:customer_id,label:workspace_id,label:run_id");
  const aggregatedSummary = summarize(asEntries(aggregated?.data), customerId, workspaceId);
  if (aggregatedSummary.runs.length > 0) {
    aggregatedSummary.source = "opencost_pending";
    aggregatedSummary.cloudSource = "opencost";
    return aggregatedSummary;
  }

  const raw = await fetchAllocation(windowValue);
  const rawSummary = summaryFromRawAllocations(asEntries(raw?.data), customerId, workspaceId);
  if (rawSummary.runs.length > 0) {
    rawSummary.source = "opencost_pending";
    rawSummary.cloudSource = "opencost";
    return rawSummary;
  }

  const k8sExact = await exactRequestedRunCosts(customerId, workspaceId);
  if (k8sExact.length > 0) {
    const summary = summaryFromEstimatedRuns(k8sExact, customerId);
    summary.source = "metering_pending";
    summary.cloudSource = "local_requested_resources";
    return summary;
  }

  aggregatedSummary.source = "unavailable";
  aggregatedSummary.cloudSource = TENCENT_BILLING_ENABLED ? "tencent_cloud_unmatched" : "not_connected";
  return aggregatedSummary;
}

function isCompletedRun(run) {
  const status = String(run?.status || "").toLowerCase();
  if (TERMINAL_RUN_STATUSES.has(status)) {
    return true;
  }
  return Boolean(
    run?.k8sStatus?.succeeded ||
      run?.k8sStatus?.conditions?.some?.((item) => ["Complete", "Failed"].includes(item.type) && item.status === "True")
  );
}

function systemLedgerEntriesForRun(db, runId) {
  return (db.ledger || []).filter((entry) => {
    if (entry.runId !== runId) return false;
    if (entry.type === "resource_charge") return true;
    return entry.source === "auto_reconcile" && (entry.type === "refund" || entry.type === "makeup_charge");
  });
}

async function reconcileCharges(customerId, workspaceId, windowValue) {
  const db = await readPortalDb();
  if (!db) throw new Error("Missing portal DB");

  let summary;
  try {
    summary = await fetchExactSummary(customerId || "", workspaceId || "", windowValue || "7d");
  } catch {
    const estimated = (await estimateRunCosts(customerId)).filter((item) => !workspaceId || item.workspaceId === workspaceId);
    summary = summaryFromEstimatedRuns(estimated, customerId);
  }
  const runs = await readRuns();
  const exactMap = summary.source === "tencent_cloud_bill"
    ? new Map(summary.runs.map((item) => [item.runId, { ...item, pricingSource: "tencent_cloud_bill" }]))
    : new Map();
  const estimatedRuns = (await estimateRunCosts(customerId)).filter((item) => !workspaceId || item.workspaceId === workspaceId);
  const estimatedMap = new Map(estimatedRuns.map((item) => [item.runId, { ...item, pricingSource: "metering_pending" }]));

  const results = [];
  let exactCount = 0;
  let estimatedCount = 0;
  let adjustmentCount = 0;
  const candidateRuns = runs.filter((run) => {
    if (!isCompletedRun(run)) return false;
    if (customerId && run.customerId !== customerId && run.userId !== customerId) return false;
    if (workspaceId && run.workspaceId !== workspaceId) return false;
    return true;
  });

  for (const run of candidateRuns) {
    const runCost = exactMap.get(run.runId) || estimatedMap.get(run.runId);
    if (!runCost || !runCost.customerId) continue;
    if (!isCompletedRun(run)) continue;

    if (runCost.pricingSource !== "tencent_cloud_bill") {
      estimatedCount += 1;
      results.push({
        runId: runCost.runId,
        workspaceId: runCost.workspaceId,
        action: "pending_exact_bill",
        pricingSource: runCost.pricingSource,
      });
      continue;
    }

    const wallet = db.wallets?.find((item) => item.userId === runCost.customerId);
    if (!wallet) continue;

    const systemEntries = systemLedgerEntriesForRun(db, runCost.runId);
    const baseCharge = systemEntries.find((entry) => entry.type === "resource_charge");

    if (!baseCharge) {
      wallet.balance = Number(wallet.balance || 0) - Number(runCost.totalCost || 0);
      wallet.updatedAt = new Date().toISOString();

      db.ledger.push({
        id: randomUUID(),
        userId: runCost.customerId,
        runId: runCost.runId,
        workspaceId: runCost.workspaceId,
        type: "resource_charge",
        amount: -Number(runCost.totalCost || 0),
        source: "tencent_cloud",
        breakdown: {
          cpuCost: Number(runCost.cpuCost || 0),
          gpuCost: Number(runCost.gpuCost || 0),
          pvCost: Number(runCost.pvCost || 0),
          totalCost: Number(runCost.totalCost || 0)
        },
        createdAt: new Date().toISOString()
      });

      exactCount += 1;

      results.push({
        runId: runCost.runId,
        workspaceId: runCost.workspaceId,
        action: "charged",
        charged: Number(runCost.totalCost || 0),
        newBalance: wallet.balance,
        pricingSource: runCost.pricingSource
      });

      continue;
    }

    const currentNetCharge = -systemEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const targetNetCharge = Number(runCost.totalCost || 0);
    const delta = Number((targetNetCharge - currentNetCharge).toFixed(6));

    if (Math.abs(delta) < 0.000001) {
      exactCount += 1;
      continue;
    }

    const entry =
      delta > 0
        ? {
            id: randomUUID(),
            userId: runCost.customerId,
            runId: runCost.runId,
            workspaceId: runCost.workspaceId,
            type: "makeup_charge",
            amount: -Math.abs(delta),
            reason: "auto_reconcile_tencent_bill_delta",
            source: "auto_reconcile",
            createdAt: new Date().toISOString(),
            breakdown: {
              targetTotalCost: targetNetCharge,
              previousNetCharge: currentNetCharge,
              delta: Math.abs(delta)
            }
          }
        : {
            id: randomUUID(),
            userId: runCost.customerId,
            runId: runCost.runId,
            workspaceId: runCost.workspaceId,
            type: "refund",
            amount: Math.abs(delta),
            reason: "auto_reconcile_tencent_bill_delta",
            source: "auto_reconcile",
            createdAt: new Date().toISOString(),
            breakdown: {
              targetTotalCost: targetNetCharge,
              previousNetCharge: currentNetCharge,
              delta: Math.abs(delta)
            }
          };

    wallet.balance = Number(wallet.balance || 0) + Number(entry.amount || 0);
    wallet.updatedAt = new Date().toISOString();
    db.ledger.push(entry);
    exactCount += 1;
    adjustmentCount += 1;

    results.push({
      runId: runCost.runId,
      workspaceId: runCost.workspaceId,
      action: entry.type,
      adjustment: Math.abs(delta),
      targetTotalCost: targetNetCharge,
      previousNetCharge: currentNetCharge,
      newBalance: wallet.balance,
      pricingSource: runCost.pricingSource
    });
  }

  await writePortalDb(db);
  reconcileState = {
    lastRunAt: new Date().toISOString(),
    lastWindow: windowValue || "7d",
    lastScope: workspaceId ? `workspace:${workspaceId}` : (customerId || "all"),
    lastReconciledCount: results.length,
    lastExactCount: exactCount,
    lastEstimatedCount: estimatedCount,
    lastAdjustmentCount: adjustmentCount,
    lastError: "",
  };
  await logRuntimeEvent({ type: "billing_reconcile_completed", ...reconcileState });
  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    reconciledCount: results.length,
    exactCount,
    estimatedCount,
    adjustmentCount,
    results
  };
}

async function listPendingRuns(customerId = "", workspaceId = "", windowValue = "7d") {
  let summary;
  try {
    summary = await fetchExactSummary(customerId || "", workspaceId || "", windowValue || "7d");
  } catch {
    summary = { runs: [], items: [], totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 } };
  }

  const runs = await readRuns();
  const exactRunIds = summary.source === "tencent_cloud_bill"
    ? new Set(summary.runs.map((item) => item.runId))
    : new Set();
  const db = await readPortalDb();
  const ledger = db?.ledger || [];
  const pending = runs
    .filter((run) => isCompletedRun(run))
    .filter((run) => !customerId || run.customerId === customerId || run.userId === customerId)
    .filter((run) => !workspaceId || run.workspaceId === workspaceId)
    .filter((run) => !exactRunIds.has(run.runId))
    .map((run) => ({
      runId: run.runId,
      customerId: run.customerId || run.userId || "",
      workspaceId: run.workspaceId || "",
      createdAt: run.createdAt || null,
      completedAt: completionTimestamp(run),
      status: run.status || (isCompletedRun(run) ? "completed" : "unknown"),
      pendingHours: Math.max(0, ((Date.now()) - Date.parse(completionTimestamp(run) || run.createdAt || Date.now())) / 3600000),
      pricingSource: "metering pending",
      chargeState: ledger.some((entry) => entry.runId === run.runId && entry.type === "resource_charge") ? "estimated_charged" : "unbilled"
    }))
    .sort((a, b) => Number(b.pendingHours || 0) - Number(a.pendingHours || 0));

  const riskByUserMap = new Map();
  const riskByWorkspaceMap = new Map();
  for (const item of pending) {
    const currentUser = riskByUserMap.get(item.customerId) || {
      customerId: item.customerId,
      pendingCount: 0,
      oldestPendingHours: 0,
      estimatedChargedCount: 0,
    };
    currentUser.pendingCount += 1;
    currentUser.oldestPendingHours = Math.max(currentUser.oldestPendingHours, Number(item.pendingHours || 0));
    if (item.chargeState === "estimated_charged") currentUser.estimatedChargedCount += 1;
    riskByUserMap.set(item.customerId, currentUser);

    const workspaceKey = `${item.customerId}:${item.workspaceId}`;
    const currentWorkspace = riskByWorkspaceMap.get(workspaceKey) || {
      customerId: item.customerId,
      workspaceId: item.workspaceId,
      pendingCount: 0,
      oldestPendingHours: 0,
      estimatedChargedCount: 0,
    };
    currentWorkspace.pendingCount += 1;
    currentWorkspace.oldestPendingHours = Math.max(currentWorkspace.oldestPendingHours, Number(item.pendingHours || 0));
    if (item.chargeState === "estimated_charged") currentWorkspace.estimatedChargedCount += 1;
    riskByWorkspaceMap.set(workspaceKey, currentWorkspace);
  }

  const riskByUser = [...riskByUserMap.values()]
    .sort((a, b) => b.pendingCount - a.pendingCount || b.oldestPendingHours - a.oldestPendingHours)
    .slice(0, 10);

  const riskByWorkspace = [...riskByWorkspaceMap.values()]
    .sort((a, b) => b.pendingCount - a.pendingCount || b.oldestPendingHours - a.oldestPendingHours)
    .slice(0, 10);

  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    pendingCount: pending.length,
    oldestPendingHours: pending[0] ? Number(pending[0].pendingHours.toFixed(2)) : 0,
    runs: pending,
    riskByUser,
    riskByWorkspace
  };
}

function renderHtml(summary, windowValue) {
  const rows = summary.runs
    .map((item) => {
      return `<tr>
<td>${item.runId}</td>
<td>${item.workspaceId}</td>
<td>${item.cpuCost.toFixed(4)}</td>
<td>${item.gpuCost.toFixed(4)}</td>
<td>${item.pvCost.toFixed(4)}</td>
<td>${item.totalCost.toFixed(4)}</td>
</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Billing</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #111; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 16px 0 24px; }
      .card { border: 1px solid #ddd; border-radius: 10px; padding: 16px; background: #fff; }
      .label { font-size: 12px; color: #666; margin-bottom: 8px; }
      .value { font-size: 24px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; border-bottom: 1px solid #eee; padding: 10px 8px; font-size: 14px; }
    </style>
  </head>
  <body>
    <h1>资源开支</h1>
    <p>时间窗口：${windowValue}</p>
    <div class="grid">
      <div class="card"><div class="label">CPU</div><div class="value">${summary.totals.cpuCost.toFixed(4)}</div></div>
      <div class="card"><div class="label">GPU</div><div class="value">${summary.totals.gpuCost.toFixed(4)}</div></div>
      <div class="card"><div class="label">PVC / 存储</div><div class="value">${summary.totals.pvCost.toFixed(4)}</div></div>
      <div class="card"><div class="label">总计</div><div class="value">${summary.totals.totalCost.toFixed(4)}</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Run</th>
          <th>任务空间</th>
          <th>CPU</th>
          <th>GPU</th>
          <th>PVC</th>
      <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://local");

  if (url.pathname === "/healthz") {
    sendJson(res, 200, {
      ok: true,
      opencostBaseUrl: OPENCOST_BASE_URL || null,
      tencentBillingEnabled: TENCENT_BILLING_ENABLED,
      tencentPriceEnabled: TENCENT_PRICE_ENABLED,
      tencentCloudConfigured: tencentCloudConfigured(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/server-plans") {
    try {
      sendJson(res, 200, await listServerPlans());
    } catch (error) {
      sendJson(res, 502, { ok: false, error: String(error.message || error) });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/reconcile") {
    try {
      const body = await parseBody(req);
      const result = await reconcileCharges(body.customer_id || "", body.workspace_id || "", body.window || "7d");
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: String(error) });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    sendJson(res, 200, {
      ok: true,
      opencostBaseUrl: OPENCOST_BASE_URL || null,
      pricingSourcePriority: ["tencent_cloud_bill", "opencost_pending", "metering_pending"],
      tencentBillingEnabled: TENCENT_BILLING_ENABLED,
      tencentBillingRequired: TENCENT_BILLING_REQUIRED,
      tencentPriceEnabled: TENCENT_PRICE_ENABLED,
      tencentCloudConfigured: tencentCloudConfigured(),
      tencentRegion: TENCENT_CLOUD_REGION,
      serverPlanCatalogCount: serverPlanCatalog().length,
      autoReconcileEnabled: AUTO_RECONCILE_ENABLED,
      autoReconcileIntervalMs: AUTO_RECONCILE_INTERVAL_MS,
      autoReconcileWindow: AUTO_RECONCILE_WINDOW,
      reconcileState,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/pending") {
    try {
      const customerId = url.searchParams.get("customer_id") || "";
      const workspaceId = url.searchParams.get("workspace_id") || "";
      const windowValue = url.searchParams.get("window") || "7d";
      const result = await listPendingRuns(customerId, workspaceId, windowValue);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: String(error) });
    }
    return;
  }

  if (url.pathname !== "/" && url.pathname !== "/billing") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  try {
    const windowValue = url.searchParams.get("window") || "7d";
    const customerId = url.searchParams.get("customer_id") || "";
    const workspaceId = url.searchParams.get("workspace_id") || "";
    let summary;
    try {
      summary = await fetchExactSummary(customerId, workspaceId, windowValue);
    } catch (error) {
      if (!customerId) {
        throw error;
      }
      summary = summaryFromEstimatedRuns(
        (await estimateRunCosts(customerId)).filter((item) => !workspaceId || item.workspaceId === workspaceId),
        customerId
      );
    }
    if (customerId && summary.runs.length === 0) {
      summary = summaryFromEstimatedRuns(
        (await estimateRunCosts(customerId)).filter((item) => !workspaceId || item.workspaceId === workspaceId),
        customerId
      );
    }

    if ((req.headers.accept || "").includes("application/json")) {
      sendJson(res, 200, summary);
      return;
    }

    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderHtml(summary, windowValue));
  } catch (error) {
    sendJson(res, 502, { error: String(error) });
  }
});

server.listen(PORT, () => {
  console.log(`billing-aggregator listening on :${PORT}`);
});

async function runAutoReconcileLoop() {
  if (!AUTO_RECONCILE_ENABLED || reconcileLoopRunning) {
    return;
  }
  reconcileLoopRunning = true;
  try {
    await reconcileCharges("", "", AUTO_RECONCILE_WINDOW);
  } catch (error) {
    reconcileState = {
      ...reconcileState,
      lastRunAt: new Date().toISOString(),
      lastWindow: AUTO_RECONCILE_WINDOW,
      lastScope: "all",
      lastError: String(error),
    };
    await logRuntimeEvent({ type: "billing_reconcile_failed", error: String(error), ...reconcileState });
  } finally {
    reconcileLoopRunning = false;
  }
}

if (BILLING_RECONCILE_ONCE) {
  runAutoReconcileLoop()
    .then(() => process.exit(reconcileState.lastError ? 1 : 0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else if (AUTO_RECONCILE_ENABLED) {
  setTimeout(() => {
    runAutoReconcileLoop().catch(() => {});
  }, 1500);
  setInterval(() => {
    runAutoReconcileLoop().catch(() => {});
  }, AUTO_RECONCILE_INTERVAL_MS);
}
