import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEvidenceRecorder, nowIso, redactSensitiveEvidence, sanitizeText } from "./lib/v20.33-evidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.33-l5-frozen-order-cleanup");
const evidenceRecorder = createEvidenceRecorder({ evidenceDir, contract: "v20.33_l5_frozen_order_cleanup" });

const READ_ENDPOINTS = Object.freeze([
  "/healthz",
  "/portal/api/admin/users",
  "/portal/api/admin/customer-accounting/detail",
]);

const MUTATING_ENDPOINTS = Object.freeze([
  "/portal/internal/resource-orders/release",
]);

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
  const startedAt = Date.now();
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
          latencyMs: Date.now() - startedAt,
          bodyText: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", (error) => reject(new Error(`request_failed:${sanitizeUrl(url)}:${String(error.message || error)}`)));
    req.setTimeout(options.timeoutMs || 120_000, () => req.destroy(new Error("timeout")));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function requestJson(url, options = {}) {
  const { response, latencyMs, bodyText } = await requestNodeText(url, options);
  let json = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {}
  return { response, latencyMs, bodyText, json };
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
  assert.equal(parsed.protocol, "https:", "l5_cleanup_portal_base_url_must_use_https");
  assert.equal(parsed.hostname, "portal.medopl.cn", "l5_cleanup_portal_host_must_be_official_host");
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function entryOrderId(entry = {}) {
  return String(entry.resourceOrderId || entry.resource_order_id || entry.orderId || entry.order_id || "").trim();
}

function ledgerAmountCents(entry = {}) {
  if (Number.isFinite(Number(entry.amountCents))) return Number(entry.amountCents);
  return cents(entry.amount);
}

function summarizeLedgerEntry(entry = {}) {
  return {
    id: entry.id || "",
    type: entry.type || "",
    resourceOrderId: entryOrderId(entry),
    amountCents: ledgerAmountCents(entry),
    createdAt: entry.createdAt || entry.created_at || "",
    reason: entry.reason || "",
  };
}

function summarizeOrder(order = {}) {
  return {
    id: order.id || "",
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
  };
}

function orderSnapshot(detail = {}, resourceOrderId) {
  const orders = Array.isArray(detail?.activeResourceOrders) ? detail.activeResourceOrders : [];
  const order = orders.find((item) => String(item.id || "") === resourceOrderId) || null;
  const ledger = Array.isArray(detail?.ledger) ? detail.ledger : [];
  const relevantLedger = ledger
    .filter((entry) => entryOrderId(entry) === resourceOrderId)
    .map(summarizeLedgerEntry);
  const holdCents = relevantLedger
    .filter((entry) => entry.type === "preauth_hold")
    .reduce((sum, entry) => sum + Math.abs(Number(entry.amountCents || 0)), 0);
  const releaseCents = relevantLedger
    .filter((entry) => entry.type === "preauth_release")
    .reduce((sum, entry) => sum + Math.abs(Number(entry.amountCents || 0)), 0);
  return {
    found: Boolean(order),
    order: order ? summarizeOrder(order) : null,
    relevantLedger,
    activeFreezeCents: Math.max(0, holdCents - releaseCents),
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

async function findOrderOwner(config, adminCookie) {
  const users = await fetchCandidateUsers(config, adminCookie);
  for (const user of users) {
    const userId = String(user.id || "").trim();
    if (!userId) continue;
    const detail = await apiJson(
      config,
      `/portal/api/admin/customer-accounting/detail?userId=${encodeURIComponent(userId)}`,
      adminCookie,
    );
    const snapshot = orderSnapshot(detail, config.resourceOrderId);
    if (snapshot.found) {
      return {
        user: {
          id: userId,
          email: user.email || "",
          balance: Number(user.balance || 0),
        },
        snapshot,
      };
    }
  }
  return null;
}

async function releaseFrozenOrder(config) {
  const body = JSON.stringify({
    resourceOrderId: config.resourceOrderId,
    runId: config.cleanupRunId,
    releasePreauth: true,
    idempotencyKey: config.idempotencyKey,
    reason: "v20.33_l5_failed_loop_frozen_order_cleanup",
  });
  const { response, bodyText, json } = await requestJson(`${config.portalBaseUrl}/portal/internal/resource-orders/release`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body)),
      "x-portal-internal-token": config.internalAuthToken,
    },
    body,
    timeoutMs: config.timeoutMs,
  });
  assert(response.status >= 200 && response.status < 300, `internal_release_failed:${summarizeStatus(response.status, bodyText)}`);
  assert(json?.ok === true, `internal_release_not_ok:${sanitizeText(bodyText).slice(0, 260)}`);
  return {
    status: response.status,
    resourceOrderId: json.resourceOrderId || config.resourceOrderId,
    releasedAmount: Number(json.releasedAmount || 0),
    orderStatus: json.order?.status || "",
  };
}

function buildConfig() {
  const portalBaseUrl = trimTrailingSlash(env("V20_33_PORTAL_BASE_URL", "https://portal.medopl.cn"));
  return {
    portalBaseUrl,
    expectedBuildTag: env("V20_33_EXPECTED_BUILD_TAG", "opl-v20.33"),
    adminEmail: env("V20_33_ADMIN_EMAIL", env("PORTAL_ADMIN_EMAIL")),
    adminPassword: env("V20_33_ADMIN_PASSWORD", env("PORTAL_ADMIN_PASSWORD")),
    internalAuthToken: env("V20_33_PORTAL_INTERNAL_AUTH_TOKEN", env("PORTAL_INTERNAL_AUTH_TOKEN")),
    userQuery: env("V20_33_L5_CLEANUP_USER_QUERY", "test-v20-33"),
    userId: env("V20_33_L5_CLEANUP_USER_ID"),
    resourceOrderId: env("V20_33_L5_CLEANUP_RESOURCE_ORDER_ID"),
    cleanupRunId: env("V20_33_L5_CLEANUP_RUN_ID", "v20.33-l5-frozen-order-cleanup"),
    idempotencyKey: env("V20_33_L5_CLEANUP_IDEMPOTENCY_KEY"),
    timeoutMs: positiveIntEnv("V20_33_HTTP_TIMEOUT_MS", 120_000),
    maxPages: positiveIntEnv("V20_33_L5_CLEANUP_MAX_PAGES", 5),
  };
}

function assertRequiredConfig(config) {
  const missing = [
    ["V20_33_ADMIN_EMAIL", config.adminEmail],
    ["V20_33_ADMIN_PASSWORD", config.adminPassword],
    ["V20_33_PORTAL_INTERNAL_AUTH_TOKEN", config.internalAuthToken],
    ["V20_33_L5_CLEANUP_RESOURCE_ORDER_ID", config.resourceOrderId],
  ].filter(([, value]) => !value).map(([name]) => name);
  assert.equal(missing.length, 0, `missing_required_env:${missing.join(",")}`);
  assert.equal(
    config.idempotencyKey,
    `v20.33-l5-cleanup:${config.resourceOrderId}`,
    "V20_33_L5_CLEANUP_IDEMPOTENCY_KEY_must_match_resource_order_id",
  );
}

async function main() {
  await loadConfiguredEnvFiles();
  const config = buildConfig();
  assertOfficialPortalHost(config.portalBaseUrl);

  if (env("RUN_V20_33_L5_CLEANUP") !== "1") {
    const payload = {
      ok: true,
      status: "skip",
      reason: "RUN_V20_33_L5_CLEANUP_not_enabled",
      host: sanitizeUrl(config.portalBaseUrl),
      readEndpoints: READ_ENDPOINTS,
      mutatingEndpoints: MUTATING_ENDPOINTS,
      mutationBoundary: "internal_release_only_releasePreauth_true_no_cloud_provisioner",
      requiredEnv: [
        "RUN_V20_33_L5_CLEANUP",
        "V20_33_ENV_FILE",
        "V20_33_SECRETS_ENV_FILE",
        "V20_33_ADMIN_EMAIL",
        "V20_33_ADMIN_PASSWORD",
        "V20_33_PORTAL_INTERNAL_AUTH_TOKEN",
        "V20_33_L5_CLEANUP_RESOURCE_ORDER_ID",
        "V20_33_L5_CLEANUP_IDEMPOTENCY_KEY",
      ],
      ts: nowIso(),
    };
    payload.evidencePath = await evidenceRecorder.writeEvidence(payload);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  assertRequiredConfig(config);
  const build = await verifyPortalBuildTag(config);
  const adminCookie = await loginPortalSession(config);
  const before = await findOrderOwner(config, adminCookie);
  assert(before, `cleanup_order_not_visible_to_admin:${config.resourceOrderId}`);
  assert.equal(before.snapshot.order.status, "frozen", `cleanup_order_must_start_frozen:${before.snapshot.order.status}`);
  assert(before.snapshot.activeFreezeCents > 0, "cleanup_order_must_have_active_preauth_freeze");

  const release = await releaseFrozenOrder(config);
  assert.equal(release.orderStatus, "released", `cleanup_order_must_release:${release.orderStatus}`);

  const after = await findOrderOwner(config, adminCookie);
  assert(after, `cleanup_order_missing_after_release:${config.resourceOrderId}`);
  assert.equal(after.snapshot.order.status, "released", `cleanup_order_status_after_release_mismatch:${after.snapshot.order.status}`);
  assert.equal(after.snapshot.activeFreezeCents, 0, `cleanup_active_freeze_after_release_mismatch:${after.snapshot.activeFreezeCents}`);
  assert(
    after.snapshot.relevantLedger.some((entry) => entry.type === "preauth_release" && entry.amountCents > 0),
    "cleanup_must_write_preauth_release_ledger",
  );

  const result = {
    ok: true,
    status: "cleaned",
    host: sanitizeUrl(config.portalBaseUrl),
    build,
    resourceOrderId: config.resourceOrderId,
    readEndpoints: READ_ENDPOINTS,
    mutatingEndpoints: MUTATING_ENDPOINTS,
    mutationBoundary: "internal_release_only_releasePreauth_true_no_cloud_provisioner",
    before,
    release,
    after,
    ts: nowIso(),
  };
  const evidencePath = await evidenceRecorder.writeEvidence(redactSensitiveEvidence(result));
  console.log(JSON.stringify({ ...result, evidencePath }, null, 2));
}

main().catch(async (error) => {
  const failure = {
    ok: false,
    status: "failed",
    error: sanitizeText(String(error?.message || error)),
    readEndpoints: READ_ENDPOINTS,
    mutatingEndpoints: MUTATING_ENDPOINTS,
    mutationBoundary: "internal_release_only_releasePreauth_true_no_cloud_provisioner",
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
