import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEvidenceRecorder, nowIso, redactSensitiveEvidence, sanitizeText } from "./lib/v20.33-evidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.33-l5-frozen-order-audit");
const evidenceRecorder = createEvidenceRecorder({ evidenceDir, contract: "v20.33_l5_frozen_order_audit" });

const READ_ONLY_ENDPOINTS = Object.freeze([
  "/healthz",
  "/portal/api/admin/users",
  "/portal/api/admin/customer-accounting/detail",
]);

const DEFAULT_QUERY = "test-v20-33";
const DEFAULT_FAILED_LOOP_DIR = path.join(repoRoot, ".runtime", "v20.33-isolated-full-loop");

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function positiveIntEnv(name, fallback) {
  const parsed = Number(env(name));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlash(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function parseEnvFileContent(source = "") {
  const values = {};
  for (const rawLine of String(source || "").replace(/^\uFEFF/, "").split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*[=:]\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function envFileList(value = "") {
  return String(value || "")
    .split(/[,:]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadEnvFileIntoProcess(filePath) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
  const parsed = parseEnvFileContent(await readFile(absolute, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

async function loadConfiguredEnvFiles() {
  const files = [
    ...envFileList(process.env.V20_33_ENV_FILE),
    ...envFileList(process.env.V20_33_SECRETS_ENV_FILE),
  ];
  for (const filePath of files) {
    await loadEnvFileIntoProcess(filePath);
  }
}

function sanitizeUrl(value = "") {
  try {
    const parsed = new URL(String(value || ""));
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return String(value || "").replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}

function transportOptionsFor(target, headers = {}) {
  const connectHost = env("V20_33_CONNECT_HOST");
  const connectPort = positiveIntEnv("V20_33_CONNECT_PORT", Number(target.port || (target.protocol === "https:" ? 443 : 80)));
  const allowInsecureTls = boolEnv("V20_33_ALLOW_INSECURE_TLS");
  if (!connectHost) {
    return {
      requestTarget: {
        protocol: target.protocol,
        hostname: target.hostname,
        port: Number(target.port || (target.protocol === "https:" ? 443 : 80)),
        path: `${target.pathname}${target.search}`,
      },
      headers,
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
      servername: target.hostname,
    };
  }
  return {
    requestTarget: {
      protocol: target.protocol,
      hostname: connectHost,
      port: connectPort,
      path: `${target.pathname}${target.search}`,
    },
    headers: { ...headers, host: target.host },
    rejectUnauthorized: !allowInsecureTls && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
    servername: target.hostname,
  };
}

function requestOptionsFor(target, options = {}) {
  const transportOptions = transportOptionsFor(target, options.headers || {});
  return {
    ...transportOptions.requestTarget,
    method: options.method || "GET",
    headers: transportOptions.headers,
    rejectUnauthorized: transportOptions.rejectUnauthorized,
    servername: transportOptions.servername,
  };
}

async function requestNodeText(url, options = {}) {
  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  const timeoutMs = options.timeoutMs || 120_000;
  const requestOptions = requestOptionsFor(target, options);
  return new Promise((resolve, reject) => {
    const req = transport.request(requestOptions, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        resolve({
          response: {
            status: res.statusCode || 0,
            headers: res.headers,
          },
          bodyText: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", (error) => reject(new Error(`request_failed:${sanitizeUrl(url)}:${String(error.message || error)}`)));
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function requestJson(url, options = {}) {
  const { response, bodyText } = await requestNodeText(url, options);
  let json = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {}
  return { response, bodyText, json };
}

function summarizeStatus(status, bodyText = "") {
  return `${status}:${sanitizeText(String(bodyText || "").slice(0, 260))}`;
}

async function apiJson(config, pathname, cookie, options = {}) {
  const headers = {
    accept: "application/json",
    ...(cookie ? { cookie } : {}),
    ...(options.headers || {}),
  };
  const { response, bodyText, json } = await requestJson(`${config.portalBaseUrl}${pathname}`, {
    method: "GET",
    headers,
    timeoutMs: options.timeoutMs || config.timeoutMs,
  });
  assert(response.status >= 200 && response.status < 300, `portal_read_api_failed:${pathname}:${summarizeStatus(response.status, bodyText)}`);
  return json;
}

function extractCookie(setCookie, name) {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const header of headers) {
    const cookie = String(header || "").split(";")[0] || "";
    const [cookieName, ...value] = cookie.split("=");
    if (cookieName === name && value.length) return `${cookieName}=${value.join("=")}`;
  }
  return "";
}

async function postForm(config, pathname, cookie, form) {
  const body = new URLSearchParams(form).toString();
  return requestNodeText(`${config.portalBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(Buffer.byteLength(body)),
      ...(cookie ? { cookie } : {}),
    },
    body,
    timeoutMs: config.timeoutMs,
  });
}

async function loginPortalSession(config) {
  const { response, bodyText } = await postForm(config, "/login", "", {
    email: config.adminEmail,
    password: config.adminPassword,
  });
  const cookie = extractCookie(response.headers["set-cookie"], "portal_session");
  assert([302, 303].includes(response.status), `admin_login_failed:${summarizeStatus(response.status, bodyText)}`);
  assert(cookie.includes("portal_session="), "portal_session_cookie_missing");
  return cookie;
}

async function verifyPortalBuildTag(config) {
  const { response, bodyText, json } = await requestJson(`${config.portalBaseUrl}/healthz`, {
    method: "GET",
    headers: { accept: "application/json" },
    timeoutMs: config.timeoutMs,
  });
  assert(response.status >= 200 && response.status < 300, `portal_healthz_failed:${summarizeStatus(response.status, bodyText)}`);
  const buildTag = String(json?.build?.sha || json?.buildTag || json?.version || "").trim();
  if (config.expectedBuildTag) {
    assert.equal(buildTag, config.expectedBuildTag, `portal_build_tag_mismatch:${buildTag || "missing"}`);
  }
  return { buildTag, expectedBuildTag: config.expectedBuildTag };
}

function assertOfficialPortalHost(portalBaseUrl) {
  const parsed = new URL(portalBaseUrl);
  assert.equal(parsed.protocol, "https:", "l5_audit_portal_base_url_must_use_https");
  assert.equal(parsed.hostname, "portal.medopl.cn", "l5_audit_portal_host_must_be_official_host");
}

async function latestFailedLoopEvidence() {
  const explicit = env("V20_33_L5_AUDIT_FAILED_EVIDENCE_PATH");
  const files = explicit
    ? [path.isAbsolute(explicit) ? explicit : path.resolve(repoRoot, explicit)]
    : (await readdir(DEFAULT_FAILED_LOOP_DIR).catch(() => []))
      .filter((file) => file.endsWith(".json"))
      .sort()
      .reverse()
      .map((file) => path.join(DEFAULT_FAILED_LOOP_DIR, file));

  for (const filePath of files) {
    try {
      const payload = JSON.parse(await readFile(filePath, "utf8"));
      const evidence = payload.evidence || payload;
      const failed = payload.ok === false || evidence.status === "failed" || payload.status === "failed";
      const provisionStage = (evidence.stages || payload.stages || []).find((stage) => stage.stage === "resource_provision" && stage.ok === false);
      if (failed && provisionStage) {
        return {
          path: filePath,
          startedAt: evidence.startedAt || payload.startedAt || "",
          finishedAt: evidence.finishedAt || payload.finishedAt || "",
          failureStageAt: provisionStage.at || provisionStage.endedAt || "",
          failureError: provisionStage.error || evidence.error || payload.error || "",
        };
      }
    } catch {}
  }
  return null;
}

function auditWindowFromEvidence(evidence) {
  const fallbackStartedAt = "2026-05-04T23:40:00.000Z";
  const fallbackFinishedAt = "2026-05-05T00:10:00.000Z";
  const startedMs = Date.parse(evidence?.startedAt || fallbackStartedAt);
  const finishedMs = Date.parse(evidence?.finishedAt || evidence?.failureStageAt || fallbackFinishedAt);
  return {
    startedAt: new Date((Number.isFinite(startedMs) ? startedMs : Date.parse(fallbackStartedAt)) - 20 * 60_000).toISOString(),
    finishedAt: new Date((Number.isFinite(finishedMs) ? finishedMs : Date.parse(fallbackFinishedAt)) + 20 * 60_000).toISOString(),
  };
}

function withinWindow(value, window) {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) && ms >= Date.parse(window.startedAt) && ms <= Date.parse(window.finishedAt);
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function ledgerAmountCents(entry = {}) {
  if (Number.isFinite(Number(entry.amountCents))) return Number(entry.amountCents);
  return cents(entry.amount);
}

function summarizeLedger(entries = [], orderIds = new Set()) {
  const byType = {};
  const relevant = [];
  for (const entry of entries) {
    const type = String(entry.type || "").trim() || "unknown";
    byType[type] = (byType[type] || 0) + 1;
    const resourceOrderId = String(entry.resourceOrderId || entry.resource_order_id || entry.orderId || entry.order_id || "").trim();
    if (resourceOrderId && orderIds.has(resourceOrderId)) {
      relevant.push({
        id: entry.id,
        type,
        resourceOrderId,
        amountCents: ledgerAmountCents(entry),
        createdAt: entry.createdAt || entry.created_at || "",
        reason: entry.reason || "",
      });
    }
  }
  return {
    total: entries.length,
    byType,
    relevant,
  };
}

function summarizeOrder(order = {}) {
  return {
    id: order.id,
    status: String(order.status || ""),
    userId: order.userId || order.portalUserId || "",
    tenantId: order.tenantId || "",
    workspaceId: order.workspaceId || "",
    runId: order.runId || "",
    serverPlanId: order.serverPlanId || "",
    quoteAmountCents: cents(order.quoteAmount),
    freezeAmountCents: cents(order.freezeAmount),
    freezeId: order.freezeId || "",
    createdAt: order.createdAt || "",
    updatedAt: order.updatedAt || "",
    idempotencyKey: order.idempotencyKey || "",
  };
}

function summarizeDetail(user, detail, window, targetOrderId = "") {
  const orders = Array.isArray(detail?.activeResourceOrders) ? detail.activeResourceOrders : [];
  const orderIds = new Set(orders.map((order) => String(order.id || "").trim()).filter(Boolean));
  const targetOrder = targetOrderId
    ? orders.find((order) => String(order.id || "") === targetOrderId) || null
    : null;
  const frozenOrders = orders.filter((order) => String(order.status || "").toLowerCase() === "frozen");
  const windowOrders = orders.filter((order) => withinWindow(order.createdAt || order.updatedAt, window));
  const ledger = Array.isArray(detail?.ledger) ? detail.ledger : [];
  return {
    user: {
      id: user.id || detail?.userId || "",
      email: user.email || "",
      createdAt: user.createdAt || "",
      balance: Number(user.balance || 0),
    },
    wallet: detail?.wallet || {},
    activeResourceOrderCount: orders.length,
    frozenResourceOrderCount: frozenOrders.length,
    windowResourceOrderCount: windowOrders.length,
    targetOrderVisible: targetOrderId ? Boolean(targetOrder) : null,
    activeResourceOrders: orders.map(summarizeOrder),
    frozenResourceOrders: frozenOrders.map(summarizeOrder),
    windowResourceOrders: windowOrders.map(summarizeOrder),
    ledger: summarizeLedger(ledger, orderIds),
    workspaceFileCount: Array.isArray(detail?.workspaceFiles) ? detail.workspaceFiles.length : 0,
    sessionTraceCount: Array.isArray(detail?.sessionTraces) ? detail.sessionTraces.length : 0,
  };
}

async function fetchCandidateUsers(config, adminCookie) {
  const users = [];
  const seen = new Set();
  const query = encodeURIComponent(config.userQuery);
  for (let page = 1; page <= config.maxPages; page += 1) {
    const payload = await apiJson(
      config,
      `/portal/api/admin/users?page=${page}&page_size=20&email=${query}`,
      adminCookie,
    );
    const items = Array.isArray(payload?.items) ? payload.items : [];
    for (const item of items) {
      const id = String(item.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      users.push(item);
    }
    if (items.length < 20 || page >= Number(payload?.pagination?.totalPages || page)) break;
  }
  const explicitUserId = config.userId;
  if (explicitUserId && !seen.has(explicitUserId)) {
    const payload = await apiJson(
      config,
      `/portal/api/admin/users?page=1&page_size=20&userId=${encodeURIComponent(explicitUserId)}`,
      adminCookie,
    );
    for (const item of Array.isArray(payload?.items) ? payload.items : []) {
      const id = String(item.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      users.push(item);
    }
  }
  return users;
}

function buildConfig() {
  const portalBaseUrl = trimTrailingSlash(env("V20_33_PORTAL_BASE_URL", "https://portal.medopl.cn"));
  return {
    portalBaseUrl,
    expectedBuildTag: env("V20_33_EXPECTED_BUILD_TAG", "opl-v20.33"),
    adminEmail: env("V20_33_ADMIN_EMAIL", env("PORTAL_ADMIN_EMAIL")),
    adminPassword: env("V20_33_ADMIN_PASSWORD", env("PORTAL_ADMIN_PASSWORD")),
    userQuery: env("V20_33_L5_AUDIT_USER_QUERY", DEFAULT_QUERY),
    userId: env("V20_33_L5_AUDIT_USER_ID"),
    resourceOrderId: env("V20_33_L5_AUDIT_RESOURCE_ORDER_ID"),
    timeoutMs: positiveIntEnv("V20_33_HTTP_TIMEOUT_MS", 120_000),
    maxPages: positiveIntEnv("V20_33_L5_AUDIT_MAX_PAGES", 5),
  };
}

function assertRequiredConfig(config) {
  const missing = [
    ["V20_33_ADMIN_EMAIL", config.adminEmail],
    ["V20_33_ADMIN_PASSWORD", config.adminPassword],
  ].filter(([, value]) => !value).map(([name]) => name);
  assert.equal(missing.length, 0, `missing_required_env:${missing.join(",")}`);
}

async function main() {
  await loadConfiguredEnvFiles();
  const config = buildConfig();
  assertOfficialPortalHost(config.portalBaseUrl);

  if (env("RUN_V20_33_L5_AUDIT") !== "1") {
    const payload = {
      ok: true,
      status: "skip",
      reason: "RUN_V20_33_L5_AUDIT_not_enabled",
      host: sanitizeUrl(config.portalBaseUrl),
      readOnlyEndpoints: READ_ONLY_ENDPOINTS,
      authSideEffect: "portal_session_cookie_only",
      requiredEnv: [
        "RUN_V20_33_L5_AUDIT",
        "V20_33_ENV_FILE",
        "V20_33_SECRETS_ENV_FILE",
        "V20_33_ADMIN_EMAIL",
        "V20_33_ADMIN_PASSWORD",
      ],
      ts: nowIso(),
    };
    payload.evidencePath = await evidenceRecorder.writeEvidence(payload);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  assertRequiredConfig(config);
  const failedEvidence = await latestFailedLoopEvidence();
  const auditWindow = auditWindowFromEvidence(failedEvidence);
  const build = await verifyPortalBuildTag(config);
  const adminCookie = await loginPortalSession(config);
  const users = await fetchCandidateUsers(config, adminCookie);
  const details = [];

  for (const user of users) {
    const userId = String(user.id || "").trim();
    if (!userId) continue;
    const detail = await apiJson(
      config,
      `/portal/api/admin/customer-accounting/detail?userId=${encodeURIComponent(userId)}`,
      adminCookie,
    );
    details.push(summarizeDetail(user, detail, auditWindow, config.resourceOrderId));
  }

  const suspectUsers = details.filter((item) =>
    item.windowResourceOrderCount > 0 ||
    item.frozenResourceOrderCount > 0 ||
    (config.resourceOrderId && item.targetOrderVisible)
  );
  const frozenOrders = suspectUsers.flatMap((item) =>
    item.frozenResourceOrders.map((order) => ({
      ...order,
      ownerUserId: item.user.id,
      ownerEmail: item.user.email,
      wallet: item.wallet,
      relevantLedger: item.ledger.relevant.filter((entry) => entry.resourceOrderId === order.id),
    }))
  );
  const targetOrderFound = config.resourceOrderId
    ? suspectUsers.some((item) => item.targetOrderVisible)
    : null;

  const result = {
    ok: true,
    status: "audited",
    model: "gpt-5.3-codex",
    host: sanitizeUrl(config.portalBaseUrl),
    build,
    failedEvidence,
    auditWindow,
    userQuery: config.userQuery,
    userCount: users.length,
    suspectUserCount: suspectUsers.length,
    frozenOrderCount: frozenOrders.length,
    targetOrderId: config.resourceOrderId || "",
    targetOrderFound,
    readOnlyEndpoints: READ_ONLY_ENDPOINTS,
    authSideEffect: "portal_session_cookie_only",
    suspectUsers,
    frozenOrders,
    ts: nowIso(),
  };

  const evidencePath = await evidenceRecorder.writeEvidence(redactSensitiveEvidence(result));
  console.log(JSON.stringify({ ...result, evidencePath }, null, 2));
}

main().catch(async (error) => {
  const failure = {
    ok: false,
    status: "failed",
    model: "gpt-5.3-codex",
    error: sanitizeText(String(error?.message || error)),
    ts: nowIso(),
  };
  try {
    const evidencePath = await evidenceRecorder.writeEvidence(failure);
    console.error(JSON.stringify({ ...failure, evidencePath }, null, 2));
  } catch {
    console.error(JSON.stringify(failure, null, 2));
  }
  process.exitCode = 1;
});
