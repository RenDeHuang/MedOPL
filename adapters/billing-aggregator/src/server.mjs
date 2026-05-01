import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyExactChargeForOrder,
  applySettlementAdjustmentForOrder,
  normalizeLedgerEntries,
  normalizeResourceOrder,
} from "./ledger-contract.mjs";

if (!String(process.env.SERVER_PLAN_CATALOG_JSON || "").trim()) {
  process.env.SERVER_PLAN_CATALOG_JSON = JSON.stringify([
    { id: "cpu-2c4g", name: "CPU 2C4G", provider: "tencent", region: "na-siliconvalley", zone: "na-siliconvalley-1", instanceType: "SA5.MEDIUM4", cpu: 2, memoryGb: 4, gpu: 0, salable: true, provisioningMode: "tke_node_pool_create", minBillableHours: 1, riskFactor: 1, reservationFloor: 0, storageRequest: "20Gi", storageLimit: "100Gi" },
    { id: "cpu-4c8g", name: "CPU 4C8G", provider: "tencent", region: "na-siliconvalley", zone: "na-siliconvalley-1", instanceType: "SA5.LARGE8", cpu: 4, memoryGb: 8, gpu: 0, salable: true, provisioningMode: "tke_node_pool_create", minBillableHours: 1, riskFactor: 1, reservationFloor: 0, storageRequest: "20Gi", storageLimit: "150Gi" },
    { id: "cpu-8c16g", name: "CPU 8C16G", provider: "tencent", region: "na-siliconvalley", zone: "na-siliconvalley-1", instanceType: "SA5.2XLARGE16", cpu: 8, memoryGb: 16, gpu: 0, salable: true, provisioningMode: "tke_node_pool_create", minBillableHours: 1, riskFactor: 1, reservationFloor: 0, storageRequest: "40Gi", storageLimit: "200Gi" },
    { id: "cpu-16c32g", name: "CPU 16C32G", provider: "tencent", region: "na-siliconvalley", zone: "na-siliconvalley-1", instanceType: "SA5.4XLARGE32", cpu: 16, memoryGb: 32, gpu: 0, salable: true, provisioningMode: "tke_node_pool_create", minBillableHours: 1, riskFactor: 1, reservationFloor: 0, storageRequest: "80Gi", storageLimit: "300Gi" }
  ]);
}
import { access, readFile, readdir, writeFile, stat, mkdir, appendFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { buildCosBillReader } from "./cos-bill-reader.mjs";

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
const BILLING_RECONCILE_CUSTOMER_ID = String(process.env.BILLING_RECONCILE_CUSTOMER_ID || "").trim();
const BILLING_RECONCILE_WORKSPACE_ID = String(process.env.BILLING_RECONCILE_WORKSPACE_ID || "").trim();
const BILLING_RECONCILE_WINDOW = String(process.env.BILLING_RECONCILE_WINDOW || AUTO_RECONCILE_WINDOW).trim() || AUTO_RECONCILE_WINDOW;
const TENCENT_CLOUD_SECRET_ID = String(process.env.TENCENT_CLOUD_SECRET_ID || process.env.TENCENTCLOUD_SECRET_ID || "").trim();
const TENCENT_CLOUD_SECRET_KEY = String(process.env.TENCENT_CLOUD_SECRET_KEY || process.env.TENCENTCLOUD_SECRET_KEY || "").trim();
const TENCENT_CLOUD_TOKEN = String(process.env.TENCENT_CLOUD_TOKEN || "").trim();
const TENCENT_DEFAULT_IMAGE_ID = "img-487zeit5";
const TENCENT_CLOUD_REGION = String(process.env.TENCENT_CLOUD_REGION || "na-siliconvalley").trim();
const TENCENT_BILLING_ENABLED = String(process.env.TENCENT_BILLING_ENABLED || "0") === "1";
const TENCENT_BILLING_REQUIRED = String(process.env.TENCENT_BILLING_REQUIRED || "0") === "1";
const TENCENT_BILLING_ENDPOINT = String(process.env.TENCENT_BILLING_ENDPOINT || "billing.tencentcloudapi.com").trim();
const TENCENT_BILLING_VERSION = String(process.env.TENCENT_BILLING_VERSION || "2018-07-09").trim();
const TENCENT_BILLING_MAX_PAGES = Math.max(1, Number(process.env.TENCENT_BILLING_MAX_PAGES || 20));
const TENCENT_BILLING_PAGE_SIZE = Math.min(100, Math.max(1, Number(process.env.TENCENT_BILLING_PAGE_SIZE || 100)));
const TENCENT_PRICE_ENABLED = String(process.env.TENCENT_PRICE_ENABLED || "0") === "1";
const TENCENT_CVM_ENDPOINT = String(process.env.TENCENT_CVM_ENDPOINT || "cvm.tencentcloudapi.com").trim();
const TENCENT_CVM_VERSION = String(process.env.TENCENT_CVM_VERSION || "2017-03-12").trim();
const TENCENT_PRICE_IMAGE_ID = String(process.env.TENCENT_PRICE_IMAGE_ID || TENCENT_DEFAULT_IMAGE_ID).trim();
const TENCENT_PRICE_IMAGE_SOURCE = process.env.TENCENT_PRICE_IMAGE_ID ? "env" : "siliconvalley_ubuntu_22_04_fallback";
const TENCENT_PLAN_DISCOVERY_ENABLED = String(process.env.TENCENT_PLAN_DISCOVERY_ENABLED || "").trim() === "1";
const TENCENT_PLAN_DISCOVERY_ZONES = String(process.env.TENCENT_PLAN_DISCOVERY_ZONES || "").trim();
const TENCENT_PLAN_DISCOVERY_CHARGE_TYPE = String(process.env.TENCENT_PLAN_DISCOVERY_CHARGE_TYPE || "POSTPAID_BY_HOUR").trim();
const TENCENT_PLAN_DISCOVERY_MAX = Number(process.env.TENCENT_PLAN_DISCOVERY_MAX || 80);
const SERVER_PLAN_CACHE_TTL_MS = Math.max(0, Number(process.env.SERVER_PLAN_CACHE_TTL_MS || 300000));
const TENCENT_COS_BILL_BUCKET = String(process.env.TENCENT_COS_BILL_BUCKET || "opl-1410708315").trim();
const TENCENT_COS_BILL_REGION = String(process.env.TENCENT_COS_BILL_REGION || TENCENT_CLOUD_REGION).trim();
const TENCENT_COS_BILL_PREFIX = Object.prototype.hasOwnProperty.call(process.env, "TENCENT_COS_BILL_PREFIX")
  ? String(process.env.TENCENT_COS_BILL_PREFIX || "").trim()
  : "daily/";
const TENCENT_COS_BILL_ENDPOINT = String(process.env.TENCENT_COS_BILL_ENDPOINT || "").trim();
const TENCENT_COS_SECRET_ID = String(process.env.TENCENT_COS_SECRET_ID || process.env.TENCENT_COS_BILL_SECRET_ID || "").trim();
const TENCENT_COS_SECRET_KEY = String(process.env.TENCENT_COS_SECRET_KEY || process.env.TENCENT_COS_BILL_SECRET_KEY || "").trim();
const TENCENT_REQUIRED_COST_TAGS = ["resource_order_id", "run_id", "server_plan_id", "tenant_id", "workspace_id"];
const TENCENT_COST_TAG_ALIASES = {
  resource_order_id: ["resourceorderid", "resource-order-id"],
  run_id: ["runid", "run-id"],
  server_plan_id: ["serverplanid", "server-plan-id"],
  tenant_id: ["tenantid", "tenant-id"],
  workspace_id: ["workspaceid", "workspace-id"],
};

const cosBillReader = buildCosBillReader({
  bucket: TENCENT_COS_BILL_BUCKET,
  region: TENCENT_COS_BILL_REGION,
  prefix: TENCENT_COS_BILL_PREFIX,
  endpoint: TENCENT_COS_BILL_ENDPOINT,
  secretId: TENCENT_COS_SECRET_ID || TENCENT_CLOUD_SECRET_ID,
  secretKey: TENCENT_COS_SECRET_KEY || TENCENT_CLOUD_SECRET_KEY,
});

function buildCosBillStatus() {
  return {
    ok: Boolean(TENCENT_COS_BILL_BUCKET && TENCENT_COS_BILL_REGION),
    credentialsConfigured: cosBillReader.configured(),
    source: "tencent_cloud_cos_bill_delivery",
    bucket: TENCENT_COS_BILL_BUCKET,
    region: TENCENT_COS_BILL_REGION,
    prefix: TENCENT_COS_BILL_PREFIX,
    endpoint: cosBillReader.endpoint,
    deliveryConfigured: Boolean(TENCENT_COS_BILL_BUCKET && TENCENT_COS_BILL_REGION),
    note: "COS bill files are used for daily reconciliation. Exact cost must come from Tencent bill detail or COS bill files.",
  };
}

function parseCli(argv = []) {
  const args = [...argv];
  const command = args[0] && !String(args[0]).startsWith("-") ? String(args.shift()).trim().toLowerCase() : "";
  const options = {
    customerId: "",
    workspaceId: "",
    window: "",
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = String(args[index] || "").trim();
    const next = String(args[index + 1] || "").trim();
    if (!token) continue;
    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }
    if (token === "--customer-id" || token === "--customer") {
      options.customerId = next;
      index += 1;
      continue;
    }
    if (token.startsWith("--customer-id=") || token.startsWith("--customer=")) {
      options.customerId = token.split("=").slice(1).join("=").trim();
      continue;
    }
    if (token === "--workspace-id" || token === "--workspace") {
      options.workspaceId = next;
      index += 1;
      continue;
    }
    if (token.startsWith("--workspace-id=") || token.startsWith("--workspace=")) {
      options.workspaceId = token.split("=").slice(1).join("=").trim();
      continue;
    }
    if (token === "--window") {
      options.window = next;
      index += 1;
      continue;
    }
    if (token.startsWith("--window=")) {
      options.window = token.split("=").slice(1).join("=").trim();
      continue;
    }
    throw new Error(`Unknown billing-aggregator argument: ${token}`);
  }

  return { command, options };
}

const cliArgs = parseCli(process.argv.slice(2));
if (cliArgs.command && !new Set(["serve", "reconcile", "billing-reconcile"]).has(cliArgs.command)) {
  throw new Error(`Unsupported billing-aggregator command: ${cliArgs.command}`);
}
const BILLING_RECONCILE_COMMAND = new Set(["reconcile", "billing-reconcile"]).has(cliArgs.command) || BILLING_RECONCILE_ONCE;
const BILLING_RECONCILE_TARGET = {
  customerId: cliArgs.options.customerId || BILLING_RECONCILE_CUSTOMER_ID,
  workspaceId: cliArgs.options.workspaceId || BILLING_RECONCILE_WORKSPACE_ID,
  window: cliArgs.options.window || BILLING_RECONCILE_WINDOW,
};

function firstNonEmpty(...values) {
  return values
    .map((value) => String(value ?? "").trim().replace(/^"(.*)"$/s, "$1").trim())
    .find((value) => value && value !== "-" && value.toLowerCase() !== "null" && value.toLowerCase() !== "n/a") || "";
}

function moneyNumber(value, fallback = 0) {
  const normalized = String(value ?? "").trim().replace(/,/g, "");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function billTagValue(row = {}, key = "") {
  const camel = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
  const tagKeys = [
    key,
    ...(TENCENT_COST_TAG_ALIASES[key] || []),
    camel,
    pascal,
    `tag:${key}`,
    `Tag:${key}`,
    `tag_${key}`,
    `Tag_${key}`,
  ];
  for (const alias of TENCENT_COST_TAG_ALIASES[key] || []) {
    tagKeys.push(`标签键:${alias}`, `标签:${alias}`, `标签键:${alias.toLowerCase()}`, `标签:${alias.toLowerCase()}`);
  }
  tagKeys.push(`标签键:${key}`, `标签:${key}`, `标签键:${camel}`, `标签:${camel}`, `标签键:${pascal}`, `标签:${pascal}`);
  for (const candidate of tagKeys) {
    const value = firstNonEmpty(row[candidate], row.tags?.[candidate], row.Tags?.[candidate], row.tags?.[key], row.Tags?.[key]);
    if (value) return value;
  }
  return "";
}

function rowHasRequiredCostTags(row = {}) {
  return TENCENT_REQUIRED_COST_TAGS.every((key) => Boolean(billTagValue(row, key)));
}

function normalizeCosBillRow(row = {}) {
  const totalCost = moneyNumber(firstNonEmpty(
    row.totalCost,
    row.TotalCost,
    row.RealTotalCost,
    row.realTotalCost,
    row.Cost,
    row.cost,
    row["优惠后总价(元)"],
    row["现金支付(元)"],
    row["原价(元)"],
  ));
  return {
    ...row,
    totalCost,
    resourceOrderId: billTagValue(row, "resource_order_id"),
    runId: billTagValue(row, "run_id"),
    serverPlanId: billTagValue(row, "server_plan_id"),
    tenantId: billTagValue(row, "tenant_id"),
    workspaceId: billTagValue(row, "workspace_id"),
    attributed: rowHasRequiredCostTags(row),
    pricingSource: "tencent_cos_daily_bill",
  };
}

async function buildCosBillFilesPayload() {
  const status = buildCosBillStatus();
  try {
    const files = await cosBillReader.listFiles({ maxKeys: 50 });
    return {
      ...status,
      readable: true,
      lastReadAt: new Date().toISOString(),
      fileCount: files.length,
      files,
    };
  } catch (error) {
    return {
      ...status,
      readable: false,
      lastReadAt: new Date().toISOString(),
      error: String(error.message || error),
      errorStatus: error.status || null,
    };
  }
}

async function buildCosBillReconcilePayload() {
  const status = buildCosBillStatus();
  try {
    const parsed = await cosBillReader.parseLatestFile();
    const rows = parsed.rows.map(normalizeCosBillRow);
    const attributed = rows.filter((row) => row.attributed);
    const unattributed = rows.filter((row) => !row.attributed);
    return {
      ...status,
      ok: true,
      reconciled: false,
      preview: true,
      hasAttributableRows: attributed.length > 0,
      exactSource: "tencent_cos_daily_bill",
      lastReadAt: new Date().toISOString(),
      latestFile: parsed.latest,
      parsedRowCount: rows.length,
      attributedCount: attributed.length,
      unattributedCount: unattributed.length,
      totalCost: Number(attributed.reduce((sum, row) => sum + Number(row.totalCost || 0), 0).toFixed(5)),
      items: attributed.slice(0, 200),
      unattributed: unattributed.slice(0, 100),
    };
  } catch (error) {
    return {
      ...status,
      ok: false,
      reconciled: false,
      lastReadAt: new Date().toISOString(),
      error: String(error.message || error),
      errorStatus: error.status || null,
    };
  }
}

function buildAttributionPayload(items = [], resourceOrderId = "") {
  const normalizedResourceOrderId = String(resourceOrderId || "").trim();
  const related = items.filter((item) => normalizedResourceOrderId && JSON.stringify(item || {}).includes(normalizedResourceOrderId));
  const unattributed = items.filter((item) => {
    const text = JSON.stringify(item || {});
    return !TENCENT_REQUIRED_COST_TAGS.every((key) => text.includes(key));
  });
  const totalCost = related.reduce((sum, item) => sum + Number(item.totalCost || item.TotalCost || item.realTotalCost || item.RealTotalCost || 0), 0);
  return {
    ok: true,
    source: "tencent_cloud_bill_attribution",
    resourceOrderId: normalizedResourceOrderId,
    requiredTags: TENCENT_REQUIRED_COST_TAGS,
    relatedCount: related.length,
    unattributedCount: unattributed.length,
    totalCost: Number(totalCost.toFixed(5)),
    items: related.slice(0, 100),
    unattributed: unattributed.slice(0, 50),
  };
}

async function collectAttributionItems(url) {
  const customerId = String(url?.searchParams?.get("customer_id") || "").trim();
  const workspaceId = String(url?.searchParams?.get("workspace_id") || "").trim();
  const windowValue = String(url?.searchParams?.get("window") || "720h").trim() || "720h";
  const exact = await fetchExactSummary(customerId, workspaceId, windowValue);
  return [
    ...(Array.isArray(exact?.runs) ? exact.runs : []),
    ...(Array.isArray(exact?.items) ? exact.items : []),
    ...(Array.isArray(exact?.unattributed?.items) ? exact.unattributed.items : []),
  ];
}
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

const cloudRuntimeState = {
  lastDiscoveryAt: "",
  lastDiscoveryError: null,
  lastQuoteAt: "",
  lastQuoteError: null,
  lastBillQueryAt: "",
  lastBillQueryError: null,
};
let serverPlanCache = {
  expiresAt: 0,
  payload: null,
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

function scrubCloudErrorText(value) {
  return String(value || "")
    .replace(/AKID[A-Za-z0-9]+/g, "[redacted-secret-id]")
    .replace(/(SecretId|SecretKey|TENCENT_CLOUD_SECRET_ID|TENCENT_CLOUD_SECRET_KEY)\s*[:=]\s*[^,\s"}]+/gi, "$1=[redacted]")
    .slice(0, 500);
}

function sanitizeCloudError(error) {
  if (!error) return null;
  return {
    message: scrubCloudErrorText(error.message || error),
    code: scrubCloudErrorText(error.code || ""),
    status: Number(error.status || 0),
  };
}

function cloudErrorMessage(error) {
  const sanitized = sanitizeCloudError(error);
  if (!sanitized) return "";
  return sanitized.code ? `${sanitized.code}:${sanitized.message}` : sanitized.message;
}

function markCloudState(kind, error = null) {
  const now = new Date().toISOString();
  if (kind === "discovery") {
    cloudRuntimeState.lastDiscoveryAt = now;
    cloudRuntimeState.lastDiscoveryError = sanitizeCloudError(error);
  }
  if (kind === "quote") {
    cloudRuntimeState.lastQuoteAt = now;
    cloudRuntimeState.lastQuoteError = sanitizeCloudError(error);
  }
  if (kind === "bill") {
    cloudRuntimeState.lastBillQueryAt = now;
    cloudRuntimeState.lastBillQueryError = sanitizeCloudError(error);
  }
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
    const { Pool } = await import("pg");
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
    const [walletsRes, ledgerRes, resourceOrdersRes] = await Promise.all([
      pool.query(`SELECT * FROM ${portalTable("wallets")}`),
      pool.query(`SELECT * FROM ${portalTable("ledger_entries")} ORDER BY created_at ASC`),
      pool.query(`SELECT * FROM ${portalTable("resource_orders")}`),
    ]);
    return {
      wallets: walletsRes.rows.map((row) => ({
        userId: row.user_id,
        balance: Number(row.balance || 0),
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      })),
      ledger: normalizeLedgerEntries(ledgerRes.rows.map((row) => ({
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
        reason: row.reason || "",
        operatorId: row.operator_id || "",
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      }))),
      resourceOrders: resourceOrdersRes.rows.map((row) => normalizeResourceOrder({
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        portalUserId: row.portal_user_id,
        workspaceId: row.workspace_id,
        workspaceSessionId: row.workspace_session_id,
        runId: row.run_id,
        billingAccountId: row.portal_user_id || row.user_id || row.tenant_id,
        status: row.status,
        serverPlanId: row.server_plan_id,
        region: row.region,
        zone: row.zone,
        cpu: row.cpu,
        memoryGb: row.memory_gb,
        gpuType: row.gpu_type,
        gpuCount: row.gpu_count,
        storagePlanId: row.storage_plan_id,
        storageSizeGb: row.storage_size_gb,
        retentionPolicy: row.retention_policy,
        estimatedHours: row.estimated_hours,
        autoStopAt: row.auto_stop_at,
        quoteId: row.quote_id,
        freezeId: row.freeze_id,
        provisionRequestId: row.provision_request_id,
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
      })).filter(Boolean),
    };
  }
  if (!(await exists(portalDbFile))) return null;
  const db = JSON.parse(await readFile(portalDbFile, "utf8"));
  db.ledger = normalizeLedgerEntries(db.ledger || []);
  db.resourceOrders = (Array.isArray(db.resourceOrders) ? db.resourceOrders : []).map((row) => normalizeResourceOrder(row)).filter(Boolean);
  return db;
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
          `INSERT INTO ${portalTable("ledger_entries")} (id,tenant_id,user_id,run_id,workspace_id,order_id,type,amount,currency,source_type,source_id,idempotency_key,reason,operator_id,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            row.id,
            row.tenantId || row.userId || "",
            row.userId || "",
            row.runId || "",
            row.workspaceId || "",
            row.resourceOrderId || row.orderId || "",
            row.type || "",
            Number(row.amount || 0),
            row.currency || "CNY",
            row.sourceType || "",
            row.sourceId || "",
            row.idempotencyKey || "",
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

async function pendingRequestedRunCosts(customerId = "", workspaceId = "") {
  const runs = await readRuns();
  const pending = [];

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

    pending.push({
      runId: run.runId,
      workspaceId: run.workspaceId || "unknown-workspace",
      customerId: run.customerId || run.userId || null,
      start: run.createdAt || null,
      end: completionTimestamp(run),
      cpuCost,
      gpuCost,
      pvCost,
      totalCost,
      pricingSource: "k8s_requested_resources_pending",
      breakdown: {
        durationHours,
        cpuCores,
        gpuCount,
        storageBytes
      }
    });
  }

  return pending;
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

function summaryFromPendingRuns(runs, customerId) {
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

function zeroTotals() {
  return { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
}

function buildUnavailableSummary(customerId = "", workspaceId = "", source = "unavailable", cloudSource = "not_connected") {
  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    source,
    cloudSource,
    itemCount: 0,
    totals: zeroTotals(),
    runs: [],
    items: [],
  };
}

function buildUnattributedSummary(items, customerId = "", workspaceId = "") {
  const rows = Array.isArray(items) ? items : [];
  const totals = rows.reduce((acc, item) => {
    acc.cpuCost += Number(item.cpuCost || 0);
    acc.gpuCost += Number(item.gpuCost || 0);
    acc.pvCost += Number(item.pvCost || 0);
    acc.totalCost += Number(item.totalCost || 0);
    return acc;
  }, zeroTotals());

  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    source: "tencent_cloud_bill_unattributed",
    cloudSource: "tencent_cloud",
    itemCount: rows.length,
    totals,
    runs: rows,
    items: rows.map((item) => ({
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

function buildBillingEnvelope({ customerId = "", workspaceId = "", exactSummary = null, pendingSummary = null, unattributedSummary = null }) {
  const exact = exactSummary && Array.isArray(exactSummary.runs) && exactSummary.runs.length > 0
    ? exactSummary
    : null;
  const pending = pendingSummary && Array.isArray(pendingSummary.runs) && pendingSummary.runs.length > 0
    ? pendingSummary
    : null;
  const unattributed = unattributedSummary || buildUnattributedSummary([], customerId, workspaceId);
  const chargeBasis = exact ? "exact" : (pending ? "pending" : "unavailable");
  const primary = exact || pending || buildUnavailableSummary(customerId, workspaceId);

  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    source: primary.source,
    cloudSource: primary.cloudSource,
    chargeBasis,
    exactAvailable: Boolean(exact),
    settlement: {
      ready: Boolean(exact),
      mode: "exact_only",
      reason: exact ? "tencent_cloud_bill" : "pending_exact_bill",
    },
    itemCount: primary.itemCount || 0,
    totals: primary.totals || zeroTotals(),
    runs: primary.runs || [],
    items: primary.items || [],
    exact: exact || buildUnavailableSummary(customerId, workspaceId, "exact_unavailable", TENCENT_BILLING_ENABLED ? "tencent_cloud_unmatched" : "not_connected"),
    pending: pending || buildUnavailableSummary(customerId, workspaceId, "pending_unavailable", OPENCOST_BASE_URL ? "opencost_unmatched" : "local_metering_unmatched"),
    unattributed,
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
  const resourceOrderId = firstString(tags.resource_order_id, tags.resourceOrderId, row.ResourceOrderId);
  const serverPlanId = firstString(tags.server_plan_id, tags.serverPlanId, row.ServerPlanId);
  const tenantId = firstString(tags.tenant_id, tags.tenantId, tags.customer_id, tags.customerId, row.TenantId, row.CustomerId);
  const workspaceId = firstString(tags.workspace_id, tags.workspaceId, row.WorkspaceId);
  const runId = firstString(tags.run_id, tags.runId, row.RunId);
  const hasExactRunAttribution = Boolean(resourceOrderId && serverPlanId && tenantId && workspaceId && runId);
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
    resourceOrderId: resourceOrderId || "",
    serverPlanId: serverPlanId || "",
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
      resource_order_id: resourceOrderId,
      server_plan_id: serverPlanId,
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

function groupTencentBillRuns(rows) {
  const grouped = new Map();
  for (const item of rows) {
    const key = item.runId || item.properties.resource_id || randomUUID();
    const current = grouped.get(key) || {
      runId: item.runId,
      resourceOrderId: item.resourceOrderId,
      serverPlanId: item.serverPlanId,
      workspaceId: item.workspaceId,
      customerId: item.customerId,
      tenantId: item.tenantId,
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
        resource_order_id: item.resourceOrderId,
        server_plan_id: item.serverPlanId,
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
  return [...grouped.values()].sort((a, b) => Number(b.totalCost || 0) - Number(a.totalCost || 0));
}

function summaryFromTencentBillRows(rows, customerId = "", workspaceId = "") {
  const normalized = rows.map(normalizeTencentBillRow).filter((item) => {
    const customerOk = !customerId || item.customerId === customerId || item.properties.tags?.customer_id === customerId;
    const workspaceOk = !workspaceId || item.workspaceId === workspaceId || item.properties.tags?.workspace_id === workspaceId;
    return customerOk && workspaceOk;
  });

  const exactRuns = groupTencentBillRuns(normalized.filter((item) => item.hasExactRunAttribution));
  const unattributedRuns = groupTencentBillRuns(normalized.filter((item) => !item.hasExactRunAttribution));
  const totals = exactRuns.reduce((acc, item) => {
    acc.totalCost += Number(item.totalCost || 0);
    return acc;
  }, zeroTotals());
  const unattributed = buildUnattributedSummary(unattributedRuns, customerId, workspaceId);

  return {
    customerId: customerId || null,
    workspaceId: workspaceId || null,
    source: exactRuns.length > 0 ? "tencent_cloud_bill" : (unattributedRuns.length > 0 ? "tencent_cloud_bill_unattributed" : "tencent_cloud_bill"),
    cloudSource: "tencent_cloud",
    itemCount: exactRuns.length,
    exactRunCount: exactRuns.length,
    unattributedRunCount: unattributedRuns.length,
    totals,
    runs: exactRuns,
    items: exactRuns.map((item) => ({
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
    unattributed,
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

function normalizeStringMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [String(key || "").trim(), String(entry ?? "").trim()])
      .filter(([key, entry]) => key && entry),
  );
}

function normalizeTolerations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      key: firstString(item.key),
      operator: firstString(item.operator, "Equal"),
      value: firstString(item.value),
      effect: firstString(item.effect),
    }))
    .filter((item) => item.key);
}

function commaList(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeServerPlanQuery(input = {}) {
  return {
    region: firstString(input.region),
    zone: firstString(input.zone),
    cpu: parseOptionalNumber(input.cpu),
    memoryGb: parseOptionalNumber(input.memoryGb ?? input.memory),
  };
}

function buildTencentDiscoveryFilters(query = {}) {
  const filters = [
    {
      Name: "instance-charge-type",
      Values: [TENCENT_PLAN_DISCOVERY_CHARGE_TYPE],
    },
  ];
  const zones = commaList(firstString(query.zone, TENCENT_PLAN_DISCOVERY_ZONES));
  if (zones.length) filters.push({ Name: "zone", Values: zones });
  return filters;
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

function hasSoldOutMarker(statusCategory = "", soldOutReason = "") {
  const category = String(statusCategory || "").trim().toLowerCase();
  const reason = String(soldOutReason || "").trim();
  if (reason) return true;
  const normalized = category.replace(/[^a-z0-9]+/g, "");
  if (["enoughstock", "normalstock", "instock"].includes(normalized)) return false;
  return [
    "soldout",
    "stockout",
    "outofstock",
    "nostock",
    "understock",
    "insufficient",
    "shortage",
    "inventoryshortage",
  ].some((marker) => normalized.includes(marker))
    || category.includes("sold out")
    || category.includes("out of stock")
    || category.includes("库存不足")
    || category.includes("无库存")
    || category.includes("售罄");
}

function normalizeTencentDiscoveredPlan(item = {}, region = TENCENT_CLOUD_REGION) {
  const zone = firstString(item.Zone, item.zone);
  const instanceType = firstString(item.InstanceType, item.instanceType);
  const cpu = firstNumber(item.CPU, item.Cpu, item.cpu);
  const memoryGb = firstNumber(item.Memory, item.memory);
  const gpu = firstNumber(item.Gpu, item.GPU, item.GpuCount, item.GPUCount, 0);
  const price = normalizeTencentPrice({ Price: item.Price || item.InstancePrice || {} });
  const availabilityStatus = firstString(item.Status, item.InstanceTypeState, "UNKNOWN").toUpperCase();
  const statusCategory = firstString(item.StatusCategory, item.StatusCategoryName);
  const soldOutReason = firstString(item.SoldOutReason);
  const hourlyPrice = firstNumber(price.discountPrice, price.unitPrice, price.originalPrice);
  const hasPrice = Boolean(price.unitPrice || price.discountPrice);
  const canOrder = availabilityStatus === "SELL" && hasPrice && !hasSoldOutMarker(statusCategory, soldOutReason);
  return {
    id: `tencent-${zone}-${instanceType}`.replace(/[^a-zA-Z0-9._-]+/g, "-"),
    name: firstString(item.TypeName, item.InstanceFamily, instanceType),
    provider: "tencent",
    region,
    zone,
    instanceType,
    cpu,
    memoryGb,
    gpu,
    gpuCount: gpu,
    nodePool: "",
    runtimeClass: "",
    nodeSelector: {},
    tolerations: [],
    cpuRequest: cpu ? `${cpu * 1000}m` : "",
    cpuLimit: cpu ? `${cpu * 1000}m` : "",
    memoryRequest: memoryGb ? `${memoryGb}Gi` : "",
    memoryLimit: memoryGb ? `${memoryGb}Gi` : "",
    storageRequest: "",
    storageLimit: "",
    minBillableHours: 1,
    riskFactor: 1.2,
    reservationFloor: 0,
    priceStatus: hasPrice ? "quoted" : "discovered",
    availabilityStatus,
    statusCategory,
    soldOutReason,
    hourlyPrice,
    canOrder,
    salable: canOrder,
    reason: canOrder ? "" : firstString(soldOutReason, statusCategory, hasPrice ? availabilityStatus : "price_not_available"),
    provisioningMode: "schedule_to_node_pool",
    selectionNote: "腾讯云发现的可售规格；节点池和 runtimeClass 可由平台目录覆盖。",
    source: "tencent_cloud_discovery",
    pricingSource: "tencent_cloud_zone_instance_catalog",
    priceUpdatedAt: new Date().toISOString(),
    ...price,
  };
}

async function discoverTencentServerPlans(query = {}) {
  if (!TENCENT_PLAN_DISCOVERY_ENABLED) return [];
  if (!tencentCloudConfigured()) return [];
  const targetRegion = firstString(query.region, TENCENT_CLOUD_REGION);
  try {
    const response = await callTencentCloud({
      endpoint: TENCENT_CVM_ENDPOINT,
      service: "cvm",
      action: "DescribeZoneInstanceConfigInfos",
      version: TENCENT_CVM_VERSION,
      region: targetRegion,
      payload: {
        Filters: buildTencentDiscoveryFilters(query),
      },
    });
    const items = Array.isArray(response.InstanceTypeQuotaSet) ? response.InstanceTypeQuotaSet : [];
    const limit = Number.isFinite(TENCENT_PLAN_DISCOVERY_MAX) && TENCENT_PLAN_DISCOVERY_MAX > 0 ? TENCENT_PLAN_DISCOVERY_MAX : 80;
    markCloudState("discovery");
    return items
      .map((item) => normalizeTencentDiscoveredPlan(item, targetRegion))
      .filter((item) => item.instanceType && item.zone)
      .slice(0, limit);
  } catch (error) {
    markCloudState("discovery", error);
    throw error;
  }
}

function overlayCatalogOnDiscovered(discovered = [], catalog = []) {
  const map = new Map(discovered.map((item) => [`${item.zone}:${item.instanceType}`, item]));
  for (const plan of catalog) {
    const key = `${plan.zone || ""}:${plan.instanceType || ""}`;
    const current = key.trim() !== ":" ? map.get(key) : null;
    if (current) {
      map.set(key, { ...current, ...plan, id: firstString(plan.id, current.id), source: "tencent_cloud_discovery+platform_catalog" });
    } else {
      map.set(firstString(plan.id, plan.instanceType, randomUUID()), plan);
    }
  }
  return Array.from(map.values());
}

function planMatchesQuery(plan, query = {}) {
  const normalized = normalizeServerPlanQuery(query);
  if (normalized.region && String(plan.region || "").trim() !== normalized.region) return false;
  if (normalized.zone && String(plan.zone || "").trim() !== normalized.zone) return false;
  if (normalized.cpu !== null && Number(plan.cpu || 0) !== normalized.cpu) return false;
  if (normalized.memoryGb !== null && Number(plan.memoryGb || plan.memory || 0) !== normalized.memoryGb) return false;
  return true;
}

async function quoteTencentServerPlan(plan) {
  if (!TENCENT_PRICE_ENABLED) {
    markCloudState("quote", new Error("tencent_price_disabled"));
    return { priceStatus: "disabled", salable: false, reason: "tencent_price_disabled" };
  }
  if (!tencentCloudConfigured()) {
    markCloudState("quote", new Error("tencent_cloud_credentials_not_configured"));
    return { priceStatus: "not_configured", salable: false, reason: "tencent_cloud_credentials_not_configured" };
  }
  if (!plan.zone || !plan.instanceType) {
    markCloudState("quote", new Error("zone_and_instanceType_required"));
    return { priceStatus: "invalid_plan", salable: false, reason: "zone_and_instanceType_required" };
  }
  const imageId = firstString(plan.imageId, TENCENT_PRICE_IMAGE_ID);
  if (!imageId) {
    markCloudState("quote", new Error("imageId_or_TENCENT_PRICE_IMAGE_ID_required"));
    return { priceStatus: "invalid_plan", salable: false, reason: "imageId_or_TENCENT_PRICE_IMAGE_ID_required" };
  }
  try {
    const payload = {
      InstanceChargeType: plan.instanceChargeType || "POSTPAID_BY_HOUR",
      Placement: { Zone: plan.zone },
      InstanceType: plan.instanceType,
      ImageId: imageId,
      SystemDisk: plan.systemDisk || {
        DiskType: plan.systemDiskType || "CLOUD_BSSD",
        DiskSize: Number(plan.systemDiskSize || 50),
      },
      InternetAccessible: plan.internetAccessible || { InternetChargeType: "TRAFFIC_POSTPAID_BY_HOUR", InternetMaxBandwidthOut: 1 },
      InstanceCount: 1,
    };
    if (Array.isArray(plan.dataDisks) && plan.dataDisks.length > 0) {
      payload.DataDisks = plan.dataDisks;
    }
    const response = await callTencentCloud({
      endpoint: TENCENT_CVM_ENDPOINT,
      service: "cvm",
      action: "InquiryPriceRunInstances",
      version: TENCENT_CVM_VERSION,
      region: plan.region || TENCENT_CLOUD_REGION,
      payload,
    });
    return {
      priceStatus: "quoted",
      salable: true,
      imageId,
      imageSource: plan.imageId ? "server_plan" : TENCENT_PRICE_IMAGE_SOURCE,
      imageRegion: plan.region || TENCENT_CLOUD_REGION,
      ...normalizeTencentPrice(response),
    };
  } catch (error) {
    markCloudState("quote", error);
    return {
      priceStatus: "quote_failed",
      salable: false,
      reason: sanitizeCloudError(error)?.message || "tencent_quote_failed",
      code: error.code || "",
    };
  }
}

function buildTencentCloudStatus({ items = [], catalog = [], discovered = [] } = {}) {
  const quotedCount = items.filter((item) => item.priceStatus === "quoted").length;
  const salableCount = items.filter((item) => item.salable || item.canOrder).length;
  const automaticProvisionCount = items.filter((item) => {
    const mode = String(item.provisioningMode || "").toLowerCase();
    return ["tke_node_pool", "tke_node_pool_create", "tke_node_pool_scale", "cvm_instance"].includes(mode);
  }).length;
  return {
    provider: "tencent_cloud",
    region: TENCENT_CLOUD_REGION,
    tokenConfigured: Boolean(TENCENT_CLOUD_TOKEN),
    price: {
      enabled: TENCENT_PRICE_ENABLED,
      imageConfigured: Boolean(TENCENT_PRICE_IMAGE_ID),
      imageId: TENCENT_PRICE_IMAGE_ID,
      imageSource: TENCENT_PRICE_IMAGE_SOURCE,
      imageRegion: TENCENT_CLOUD_REGION,
      endpoint: TENCENT_CVM_ENDPOINT,
      catalogConfigured: catalog.length > 0,
      catalogCount: catalog.length,
      discoveryEnabled: TENCENT_PLAN_DISCOVERY_ENABLED,
      discoveryZonesConfigured: Boolean(TENCENT_PLAN_DISCOVERY_ZONES),
      discoveredCount: discovered.length,
      quotedCount,
      salableCount,
      lastDiscoveryAt: cloudRuntimeState.lastDiscoveryAt,
      lastDiscoveryError: cloudRuntimeState.lastDiscoveryError,
      lastQuoteAt: cloudRuntimeState.lastQuoteAt,
      lastQuoteError: cloudRuntimeState.lastQuoteError,
    },
    billing: {
      enabled: TENCENT_BILLING_ENABLED,
      required: TENCENT_BILLING_REQUIRED,
      endpoint: TENCENT_BILLING_ENDPOINT,
      exactBillingSource: "DescribeBillDetail",
      lastBillQueryAt: cloudRuntimeState.lastBillQueryAt,
      lastBillQueryError: cloudRuntimeState.lastBillQueryError,
    },
    provisioning: {
      source: "resource_provisioner",
      automaticProvisionCount,
      existingNodePoolCount: items.length - automaticProvisionCount,
      note: automaticProvisionCount > 0
        ? "存在需要 Resource Provisioner 调用 TKE 的可售规格。"
        : "当前可售规格会调度到现有节点池；自动开通需要 nodePool payload。",
    },
    readiness: {
      cloudAccountConnected: tencentCloudConfigured(),
      realPriceReady: tencentCloudConfigured() && TENCENT_PRICE_ENABLED && Boolean(TENCENT_PRICE_IMAGE_ID) && quotedCount > 0,
      exactBillReady: tencentCloudConfigured() && TENCENT_BILLING_ENABLED,
      catalogReady: catalog.length > 0,
      serverPlansReady: salableCount > 0,
    },
    credentialsConfigured: tencentCloudConfigured(),
    priceEnabled: TENCENT_PRICE_ENABLED,
    billingEnabled: TENCENT_BILLING_ENABLED,
    billingRequired: TENCENT_BILLING_REQUIRED,
    tencentRegion: TENCENT_CLOUD_REGION,
    priceImageConfigured: Boolean(TENCENT_PRICE_IMAGE_ID),
    catalogConfigured: catalog.length > 0,
    discoveryEnabled: TENCENT_PLAN_DISCOVERY_ENABLED,
    lastQuoteAt: cloudRuntimeState.lastQuoteAt,
    lastQuoteError: cloudErrorMessage(cloudRuntimeState.lastQuoteError),
    lastBillQueryAt: cloudRuntimeState.lastBillQueryAt,
    lastBillQueryError: cloudErrorMessage(cloudRuntimeState.lastBillQueryError),
    exactBillingSource: TENCENT_BILLING_ENABLED ? "tencent_cloud_bill" : "not_configured",
    pendingSource: OPENCOST_BASE_URL ? "opencost_pending" : "metering_pending",
  };
}

function filterServerPlansPayload(payload, query = {}, options = {}) {
  const normalized = normalizeServerPlanQuery(query);
  const items = Array.isArray(payload?.items) ? payload.items.filter((item) => planMatchesQuery(item, normalized)) : [];
  const result = {
    ...payload,
    items,
    candidateCount: items.length,
    orderableCount: items.filter((item) => item.canOrder || item.salable).length,
    filter: normalized,
  };
  if (options.cacheHit) {
    result.cache = {
      hit: true,
      ttlMs: SERVER_PLAN_CACHE_TTL_MS,
      expiresAt: new Date(serverPlanCache.expiresAt).toISOString(),
    };
  }
  return result;
}

async function listServerPlans(query = {}) {
  if (serverPlanCache.payload && SERVER_PLAN_CACHE_TTL_MS > 0 && Date.now() < serverPlanCache.expiresAt) {
    return filterServerPlansPayload(serverPlanCache.payload, query, { cacheHit: true });
  }
  const catalog = serverPlanCatalog();
  let discovered = [];
  try {
    discovered = await discoverTencentServerPlans(query);
  } catch {
    discovered = [];
  }
  const plans = TENCENT_PLAN_DISCOVERY_ENABLED
    ? overlayCatalogOnDiscovered(discovered, catalog)
    : catalog;
  const items = [];
  for (const plan of plans) {
    const hasCloudDiscoveryPrice = String(plan.source || "").startsWith("tencent_cloud_discovery") && plan.priceStatus;
    const quote = hasCloudDiscoveryPrice
      ? {}
      : (plan.provider === "tencent" || !plan.provider
        ? await quoteTencentServerPlan(plan)
        : { priceStatus: "external_provider", salable: false, reason: "unsupported_provider" });
    if (quote.priceStatus === "quoted") markCloudState("quote");
    const availabilityStatus = firstString(plan.availabilityStatus, plan.status, quote.availabilityStatus).toUpperCase();
    const statusCategory = firstString(plan.statusCategory, quote.statusCategory);
    const soldOutReason = firstString(plan.soldOutReason, quote.soldOutReason);
    const hourlyPrice = firstNumber(
      quote.discountPrice,
      quote.unitPrice,
      quote.originalPrice,
      plan.hourlyPrice,
      plan.discountPrice,
      plan.unitPrice,
      plan.originalPrice,
    );
    const hasPrice = hourlyPrice > 0;
    const canOrder = hasSoldOutMarker(statusCategory, soldOutReason)
      ? false
      : availabilityStatus
        ? availabilityStatus === "SELL" && hasPrice
        : Boolean((plan.canOrder ?? plan.salable ?? quote.salable) && hasPrice);
    items.push({
      id: firstString(plan.id, plan.serverPlanId, plan.instanceType),
      name: firstString(plan.name, plan.instanceType),
      provider: plan.provider || "tencent",
      region: plan.region || firstString(query.region, TENCENT_CLOUD_REGION),
      zone: plan.zone || "",
      instanceType: plan.instanceType || "",
      cpu: Number(plan.cpu || 0),
      memoryGb: Number(plan.memoryGb || plan.memory || 0),
      gpu: Number(plan.gpu || plan.gpuCount || 0),
      nodePool: plan.nodePool || "",
      runtimeClass: plan.runtimeClass || "",
      nodeSelector: normalizeStringMap(plan.nodeSelector),
      tolerations: normalizeTolerations(plan.tolerations),
      cpuRequest: firstString(plan.cpuRequest, plan.resources?.requests?.cpu),
      cpuLimit: firstString(plan.cpuLimit, plan.resources?.limits?.cpu),
      memoryRequest: firstString(plan.memoryRequest, plan.resources?.requests?.memory),
      memoryLimit: firstString(plan.memoryLimit, plan.resources?.limits?.memory),
      gpuCount: Number(plan.gpuCount ?? plan.gpu ?? 0),
      storageRequest: firstString(plan.storageRequest, plan.resources?.requests?.["ephemeral-storage"]),
      storageLimit: firstString(plan.storageLimit, plan.resources?.limits?.["ephemeral-storage"]),
      minBillableHours: Number(plan.minBillableHours || 1),
      riskFactor: Number(plan.riskFactor || 1.2),
      reservationFloor: Number(plan.reservationFloor || 0),
      tkeClusterId: firstString(plan.tkeClusterId, plan.clusterId),
      nodePoolId: firstString(plan.nodePoolId),
      nodePoolCreatePayload: plan.nodePoolCreatePayload || null,
      nodePoolScalePayload: plan.nodePoolScalePayload || plan.nodePoolModifyPayload || null,
      provisionerPayload: plan.provisionerPayload || plan.provisioningPayload || null,
      systemDisk: plan.systemDisk || null,
      dataDisks: Array.isArray(plan.dataDisks) ? plan.dataDisks : [],
      internetAccessible: plan.internetAccessible || null,
      provisioningMode: firstString(plan.provisioningMode, "schedule_to_node_pool"),
      selectionNote: firstString(plan.selectionNote, "选择后会按规格资源和节点选择器调度到集群。"),
      source: plan.source || "platform_catalog",
      availabilityStatus,
      statusCategory,
      soldOutReason,
      hourlyPrice,
      canOrder,
      ...quote,
      salable: canOrder,
      currency: firstString(quote.currency, plan.currency, "CNY"),
      pricingSource: firstString(quote.priceStatus === "quoted" ? "tencent_cloud_inquiry_price_run_instances" : "", plan.pricingSource, plan.source, "tencent_cloud_catalog"),
      reason: canOrder ? "" : firstString(soldOutReason, quote.reason, plan.reason, statusCategory, availabilityStatus, "server_plan_unavailable"),
      priceUpdatedAt: new Date().toISOString(),
      quotedAt: new Date().toISOString(),
    });
  }
  const payload = {
    ok: true,
    source: discovered.length > 0 ? "tencent_cloud_live_catalog" : "tencent_cloud_platform_catalog",
    configured: tencentCloudConfigured(),
    priceEnabled: TENCENT_PRICE_ENABLED,
    discoveryEnabled: TENCENT_PLAN_DISCOVERY_ENABLED,
    discoveredCount: discovered.length,
    catalogCount: catalog.length,
    cloudStatus: buildTencentCloudStatus({ items, catalog, discovered }),
    items,
  };
  if (SERVER_PLAN_CACHE_TTL_MS > 0 && items.some((item) => item.priceStatus === "quoted")) {
    serverPlanCache = {
      expiresAt: Date.now() + SERVER_PLAN_CACHE_TTL_MS,
      payload,
    };
  }
  return filterServerPlansPayload(payload, query);
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
      markCloudState("bill");
      if (tencentSummary.runs.length > 0 || tencentSummary.unattributed?.itemCount > 0 || TENCENT_BILLING_REQUIRED) {
        return tencentSummary;
      }
    } catch (error) {
      markCloudState("bill", error);
      if (TENCENT_BILLING_REQUIRED) {
        throw error;
      }
    }
  }

  return buildUnavailableSummary(
    customerId,
    workspaceId,
    "exact_unavailable",
    TENCENT_BILLING_ENABLED ? "tencent_cloud_unmatched" : "not_connected",
  );
}

async function fetchPendingSummary(customerId = "", workspaceId = "", windowValue = "7d") {
  if (OPENCOST_BASE_URL) {
    try {
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
    } catch {}
  }

  const requestedPending = await pendingRequestedRunCosts(customerId, workspaceId);
  if (requestedPending.length > 0) {
    const summary = summaryFromPendingRuns(requestedPending, customerId);
    summary.source = "metering_pending";
    summary.cloudSource = "local_requested_resources";
    return summary;
  }

  return buildUnavailableSummary(
    customerId,
    workspaceId,
    "pending_unavailable",
    OPENCOST_BASE_URL ? "opencost_unmatched" : "local_metering_unmatched",
  );
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
  return normalizeLedgerEntries(db?.ledger || []).filter((entry) => {
    if (entry.runId !== runId) return false;
    if (entry.type === "exact_resource_charge") return true;
    return entry.sourceType === "auto_reconcile" && (entry.type === "refund" || entry.type === "makeup_charge");
  });
}

function systemLedgerNetCharge(entries = []) {
  return Number(entries.reduce((sum, entry) => {
    const amount = Math.abs(Number(entry.amount || 0));
    if (entry.type === "exact_resource_charge" || entry.type === "makeup_charge") {
      return sum + amount;
    }
    if (entry.type === "refund") {
      return sum - amount;
    }
    return sum;
  }, 0).toFixed(6));
}

function exactSettlementSourceId(runCost = {}) {
  return `tencent_cloud_bill:${String(runCost.resourceOrderId || runCost.runId || "unknown").trim()}`;
}

function resolveResourceOrderForReconcile(db, run, runCost) {
  const orders = Array.isArray(db?.resourceOrders) ? db.resourceOrders : [];
  const resourceOrderId = String(runCost?.resourceOrderId || "").trim();
  if (resourceOrderId) {
    const direct = orders.find((item) => item.id === resourceOrderId);
    if (direct) return direct;
  }

  const runId = String(runCost?.runId || run?.runId || "").trim();
  const workspaceId = String(runCost?.workspaceId || run?.workspaceId || "").trim();
  const customerId = String(runCost?.customerId || run?.customerId || run?.userId || "").trim();
  const matchByRun = orders.filter((item) => item.runId === runId && item.workspaceId === workspaceId && [item.userId, item.portalUserId, item.tenantId].includes(customerId));
  if (matchByRun.length === 1) {
    return matchByRun[0];
  }

  if (!resourceOrderId || !runId || !workspaceId || !customerId) {
    return null;
  }

  return normalizeResourceOrder({
    id: resourceOrderId,
    tenantId: String(runCost?.tenantId || customerId).trim() || customerId,
    userId: customerId,
    portalUserId: customerId,
    workspaceId,
    runId,
    billingAccountId: customerId,
    status: "reconciling",
    serverPlanId: String(runCost?.serverPlanId || "").trim(),
    currency: "CNY",
    pricingSource: String(runCost?.pricingSource || "tencent_cloud_bill").trim(),
    priceUpdatedAt: new Date().toISOString(),
    createdAt: String(run?.createdAt || new Date().toISOString()).trim(),
    updatedAt: new Date().toISOString(),
  });
}

async function reconcileCharges(customerId, workspaceId, windowValue) {
  const db = await readPortalDb();
  if (!db) throw new Error("Missing portal DB");

  const summary = await fetchExactSummary(customerId || "", workspaceId || "", windowValue || "7d");
  const runs = await readRuns();
  const exactMap = new Map((summary.runs || []).map((item) => [item.runId, { ...item, pricingSource: "tencent_cloud_bill" }]));

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
    const runCost = exactMap.get(run.runId);
    if (!runCost || !runCost.customerId) {
      estimatedCount += 1;
      results.push({
        runId: run.runId,
        workspaceId: run.workspaceId || "",
        action: "pending_exact_bill",
        pricingSource: "exact_unavailable",
      });
      continue;
    }
    if (!isCompletedRun(run)) continue;

    const wallet = db.wallets?.find((item) => item.userId === runCost.customerId);
    if (!wallet) {
      results.push({
        runId: run.runId,
        workspaceId: run.workspaceId || "",
        action: "wallet_missing",
        pricingSource: runCost.pricingSource,
      });
      continue;
    }

    const order = resolveResourceOrderForReconcile(db, run, runCost);
    if (!order) {
      results.push({
        runId: run.runId,
        workspaceId: run.workspaceId || "",
        action: "resource_order_missing",
        pricingSource: runCost.pricingSource,
      });
      continue;
    }

    const systemEntries = systemLedgerEntriesForRun(db, runCost.runId);
    const baseCharge = systemEntries.find((entry) => entry.type === "exact_resource_charge");

    if (!baseCharge) {
      applyExactChargeForOrder(db, {
        user: { id: runCost.customerId },
        order,
        exactCost: Number(runCost.totalCost || 0),
        sourceId: exactSettlementSourceId(runCost),
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

    const currentNetCharge = systemLedgerNetCharge(systemEntries);
    const targetNetCharge = Number(runCost.totalCost || 0);
    const delta = Number((targetNetCharge - currentNetCharge).toFixed(6));

    if (Math.abs(delta) < 0.000001) {
      exactCount += 1;
      continue;
    }

    const adjustmentType = delta > 0 ? "makeup_charge" : "refund";
    applySettlementAdjustmentForOrder(db, {
      user: { id: runCost.customerId },
      order,
      type: adjustmentType,
      amount: Math.abs(delta),
      sourceId: `${exactSettlementSourceId(runCost)}:${targetNetCharge.toFixed(2)}`,
      reason: "auto_reconcile_tencent_bill_delta",
    });
    exactCount += 1;
    adjustmentCount += 1;

    results.push({
      runId: runCost.runId,
      workspaceId: runCost.workspaceId,
      action: adjustmentType,
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
    settlementMode: "exact_only",
    unattributedSummary: summary.unattributed || buildUnattributedSummary([], customerId || "", workspaceId || ""),
    results
  };
}

async function listPendingRuns(customerId = "", workspaceId = "", windowValue = "7d") {
  const summary = await fetchExactSummary(customerId || "", workspaceId || "", windowValue || "7d");
  let pendingSummary = buildUnavailableSummary(customerId || "", workspaceId || "", "pending_unavailable", "local_metering_unmatched");
  try {
    pendingSummary = await fetchPendingSummary(customerId || "", workspaceId || "", windowValue || "7d");
  } catch {}

  const runs = await readRuns();
  const exactRunIds = new Set((summary.runs || []).map((item) => item.runId));
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
      chargeState: systemLedgerEntriesForRun({ ledger }, run.runId).some((entry) => entry.type === "exact_resource_charge") ? "charged_from_exact_bill" : "unbilled"
    }))
    .sort((a, b) => Number(b.pendingHours || 0) - Number(a.pendingHours || 0));

  const riskByUserMap = new Map();
  const riskByWorkspaceMap = new Map();
  for (const item of pending) {
    const currentUser = riskByUserMap.get(item.customerId) || {
      customerId: item.customerId,
      pendingCount: 0,
      oldestPendingHours: 0,
      chargedFromExactBillCount: 0,
    };
    currentUser.pendingCount += 1;
    currentUser.oldestPendingHours = Math.max(currentUser.oldestPendingHours, Number(item.pendingHours || 0));
    if (item.chargeState === "charged_from_exact_bill") currentUser.chargedFromExactBillCount += 1;
    riskByUserMap.set(item.customerId, currentUser);

    const workspaceKey = `${item.customerId}:${item.workspaceId}`;
    const currentWorkspace = riskByWorkspaceMap.get(workspaceKey) || {
      customerId: item.customerId,
      workspaceId: item.workspaceId,
      pendingCount: 0,
      oldestPendingHours: 0,
      chargedFromExactBillCount: 0,
    };
    currentWorkspace.pendingCount += 1;
    currentWorkspace.oldestPendingHours = Math.max(currentWorkspace.oldestPendingHours, Number(item.pendingHours || 0));
    if (item.chargeState === "charged_from_exact_bill") currentWorkspace.chargedFromExactBillCount += 1;
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
    pendingSummary,
    exactSummary: summary,
    unattributedSummary: summary.unattributed || buildUnattributedSummary([], customerId, workspaceId),
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
      cloudStatus: buildTencentCloudStatus({ catalog: serverPlanCatalog() }),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/billing/cos/status") {
    const status = buildCosBillStatus();
    try {
      const files = cosBillReader.configured() ? await cosBillReader.listFiles({ maxKeys: 5 }) : [];
      sendJson(res, 200, {
        ...status,
        readable: cosBillReader.configured(),
        latestFile: files[0] || null,
        fileCount: files.length,
        lastReadAt: cosBillReader.configured() ? new Date().toISOString() : "",
      });
    } catch (error) {
      sendJson(res, 200, {
        ...status,
        readable: false,
        lastReadAt: new Date().toISOString(),
        error: String(error.message || error),
        errorStatus: error.status || null,
      });
    }
    return;
  }
  if (req.method === "GET" && url.pathname === "/billing/cos/files") {
    sendJson(res, 200, await buildCosBillFilesPayload());
    return;
  }
  if (req.method === "POST" && url.pathname === "/billing/cos/reconcile") {
    sendJson(res, 200, await buildCosBillReconcilePayload());
    return;
  }
  if (req.method === "GET" && url.pathname === "/billing/attribution") {
    const resourceOrderId = String(url.searchParams.get("resourceOrderId") || url.searchParams.get("resource_order_id") || "").trim();
    const items = await collectAttributionItems(url).catch(() => []);
    sendJson(res, 200, buildAttributionPayload(items, resourceOrderId));
    return;
  }
  if (req.method === "GET" && url.pathname === "/server-plans") {
    try {
      sendJson(res, 200, await listServerPlans({
        region: url.searchParams.get("region") || "",
        zone: url.searchParams.get("zone") || "",
        cpu: url.searchParams.get("cpu") || "",
        memoryGb: url.searchParams.get("memoryGb") || url.searchParams.get("memory") || "",
      }));
    } catch (error) {
      sendJson(res, 502, {
        ok: false,
        error: cloudErrorMessage(error) || "server_plans_unavailable",
        cloudStatus: buildTencentCloudStatus({ catalog: serverPlanCatalog() }),
      });
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
    const cloudStatus = buildTencentCloudStatus({ catalog: serverPlanCatalog() });
    sendJson(res, 200, {
      ok: true,
      opencostBaseUrl: OPENCOST_BASE_URL || null,
      exactSources: ["tencent_cloud_bill"],
      pendingSources: ["opencost_pending", "metering_pending"],
      tencentBillingEnabled: TENCENT_BILLING_ENABLED,
      tencentBillingRequired: TENCENT_BILLING_REQUIRED,
      tencentPriceEnabled: TENCENT_PRICE_ENABLED,
      tencentCloudConfigured: tencentCloudConfigured(),
      tencentRegion: TENCENT_CLOUD_REGION,
      credentialsConfigured: cloudStatus.credentialsConfigured,
      priceEnabled: cloudStatus.priceEnabled,
      billingEnabled: cloudStatus.billingEnabled,
      billingRequired: cloudStatus.billingRequired,
      priceImageConfigured: cloudStatus.priceImageConfigured,
      catalogConfigured: cloudStatus.catalogConfigured,
      lastQuoteAt: cloudStatus.lastQuoteAt,
      lastQuoteError: cloudStatus.lastQuoteError,
      lastBillQueryAt: cloudStatus.lastBillQueryAt,
      lastBillQueryError: cloudStatus.lastBillQueryError,
      exactBillingSource: cloudStatus.exactBillingSource,
      pendingSource: cloudStatus.pendingSource,
      serverPlanCatalogCount: serverPlanCatalog().length,
      cloudStatus,
      autoReconcileEnabled: AUTO_RECONCILE_ENABLED,
      autoReconcileIntervalMs: AUTO_RECONCILE_INTERVAL_MS,
      autoReconcileWindow: AUTO_RECONCILE_WINDOW,
      reconcileState,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/cloud/status") {
    sendJson(res, 200, {
      ok: true,
      cloudStatus: buildTencentCloudStatus({ catalog: serverPlanCatalog() }),
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
    const exactSummary = await fetchExactSummary(customerId, workspaceId, windowValue);
    let pendingSummary = buildUnavailableSummary(customerId, workspaceId, "pending_unavailable", "local_metering_unmatched");
    try {
      pendingSummary = await fetchPendingSummary(customerId, workspaceId, windowValue);
    } catch {}
    const summary = buildBillingEnvelope({
      customerId,
      workspaceId,
      exactSummary,
      pendingSummary,
      unattributedSummary: exactSummary.unattributed || buildUnattributedSummary([], customerId, workspaceId),
    });

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

function printCliUsage() {
  console.log([
    "Usage:",
    "  node src/server.mjs",
    "  node src/server.mjs reconcile [--customer-id <id>] [--workspace-id <id>] [--window <range>]",
  ].join("\n"));
}

async function runSingleReconcile({ customerId = "", workspaceId = "", windowValue = AUTO_RECONCILE_WINDOW } = {}) {
  try {
    return await reconcileCharges(customerId, workspaceId, windowValue);
  } catch (error) {
    reconcileState = {
      ...reconcileState,
      lastRunAt: new Date().toISOString(),
      lastWindow: windowValue || AUTO_RECONCILE_WINDOW,
      lastScope: workspaceId ? `workspace:${workspaceId}` : (customerId || "all"),
      lastError: String(error),
    };
    await logRuntimeEvent({ type: "billing_reconcile_failed", error: String(error), ...reconcileState });
    throw error;
  }
}

async function runAutoReconcileLoop() {
  if (!AUTO_RECONCILE_ENABLED || reconcileLoopRunning) {
    return;
  }
  reconcileLoopRunning = true;
  try {
    await runSingleReconcile({ windowValue: AUTO_RECONCILE_WINDOW });
  } finally {
    reconcileLoopRunning = false;
  }
}

if (cliArgs.options.help) {
  printCliUsage();
  process.exit(0);
}

if (BILLING_RECONCILE_COMMAND) {
  runSingleReconcile({
    customerId: BILLING_RECONCILE_TARGET.customerId,
    workspaceId: BILLING_RECONCILE_TARGET.workspaceId,
    windowValue: BILLING_RECONCILE_TARGET.window,
  })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(reconcileState.lastError ? 1 : 0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  server.listen(PORT, () => {
    console.log(`billing-aggregator listening on :${PORT}`);
  });
}

if (!BILLING_RECONCILE_COMMAND && AUTO_RECONCILE_ENABLED) {
  setTimeout(() => {
    runAutoReconcileLoop().catch(() => {});
  }, 1500);
  setInterval(() => {
    runAutoReconcileLoop().catch(() => {});
  }, AUTO_RECONCILE_INTERVAL_MS);
}
