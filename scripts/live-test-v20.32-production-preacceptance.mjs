import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.32-production-preacceptance");
const sensitivePattern = /cookie|authorization|q-ak|x-cos-security-token|providerKey|password|secret|token/i;
const secretValueKeyPattern = /cookie|authorization|q-ak|x-cos-security-token|providerKey|password|secret|token/i;

export const V20_32_PREACCEPTANCE_USER_PAGES = Object.freeze([
  Object.freeze({ page: "overview", route: "/portal/app/overview", apiSource: "/portal/api/overview", requiredText: "总览" }),
  Object.freeze({ page: "packages", route: "/portal/app/packages", apiSource: "/portal/api/lab-packages", requiredText: "套餐" }),
  Object.freeze({ page: "resources", route: "/portal/app/resources", apiSource: "/portal/api/my/resources", requiredText: "资源" }),
  Object.freeze({ page: "workspace", route: "/portal/app/workspace", apiSource: "/portal/api/workspace", requiredText: "工作空间" }),
  Object.freeze({ page: "billing", route: "/portal/app/billing", apiSource: "/portal/api/billing", requiredText: "账单" }),
  Object.freeze({ page: "trace", route: "/portal/app/trace", apiSource: "/portal/api/session-traces", requiredText: "轨迹" }),
]);

export const V20_32_PREACCEPTANCE_ADMIN_PAGES = Object.freeze([
  Object.freeze({ page: "admin_dashboard", route: "/portal/app/admin/dashboard", apiSource: "/portal/api/admin/overview", requiredText: "运行资源" }),
  Object.freeze({ page: "admin_alerts", route: "/portal/app/admin/alerts", apiSource: "/portal/api/admin/alerts", requiredText: "告警" }),
  Object.freeze({ page: "admin_users", route: "/portal/app/admin/users", apiSource: "/portal/api/admin/users", requiredText: "用户" }),
  Object.freeze({ page: "admin_groups", route: "/portal/app/admin/groups", apiSource: "/portal/api/admin/groups", requiredText: "分组" }),
  Object.freeze({ page: "admin_usage", route: "/portal/app/admin/usage", apiSource: "/portal/api/admin/usage", requiredText: "账单" }),
  Object.freeze({ page: "admin_billing_ops", route: "/portal/app/admin/billing-ops", apiSource: "/portal/api/admin/billing-ops", requiredText: "客户账务" }),
  Object.freeze({ page: "admin_system", route: "/portal/app/admin/system", apiSource: "/portal/api/admin/system", requiredText: "系统" }),
  Object.freeze({ page: "admin_ops", route: "/portal/app/admin/ops", apiSource: "/portal/api/admin/ops", requiredText: "云资源" }),
  Object.freeze({ page: "admin_sandboxes", route: "/portal/app/admin/sandboxes", apiSource: "/portal/api/admin/sandboxes", requiredText: "沙箱" }),
  Object.freeze({ page: "admin_audit", route: "/portal/app/admin/audit", apiSource: "/portal/api/admin/audit", requiredText: "审计" }),
]);

const expectedUserNav = Object.freeze(["/overview", "/packages", "/resources", "/workspace", "/billing", "/trace"]);
const expectedAdminNav = Object.freeze(["/admin/dashboard", "/admin/billing-ops", "/admin/usage", "/admin/users", "/admin/system", "/admin/ops"]);
const forbiddenPrimaryLinks = Object.freeze([
  "/portal/servers",
  "/portal/app/servers",
  "/portal/api/workbench/launch",
  "/portal/admin/docs/pricing-rules",
  "/portal/admin/docs/final-gap",
]);

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function nowIso() {
  return new Date().toISOString();
}

function positiveIntEnv(name, fallback) {
  const parsed = Number(env(name));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function baseUrl(name, fallback) {
  return env(name, fallback).replace(/\/+$/, "");
}

function sanitizeText(value = "") {
  return String(value || "")
    .replace(/\b(cookie|authorization|q-ak|x-cos-security-token|providerKey|password|secret|token)\b[^,\n]*/gi, "$1=[redacted]")
    .replace(/\b(?:AKID|eyJ|sk-|ghp_)[A-Za-z0-9_-]{16,}\b/g, "[redacted]");
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

function sanitizeEvidence(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeEvidence(item));
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? sanitizeText(value) : value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    secretValueKeyPattern.test(key) ? "[redacted]" : sanitizeEvidence(item),
  ]));
}

async function writeEvidence(payload) {
  await mkdir(evidenceDir, { recursive: true });
  const filePath = path.join(evidenceDir, `${nowIso().replace(/[:.]/g, "-")}.json`);
  await writeFile(filePath, `${JSON.stringify(sanitizeEvidence(payload), null, 2)}\n`, "utf8");
  return filePath;
}

async function loadPlaywright() {
  const candidates = [
    path.join(repoRoot, ".runtime", "browser-test", "node_modules", "playwright", "index.js"),
    path.join(repoRoot, "node_modules", "playwright", "index.js"),
  ];
  for (const candidate of candidates) {
    try {
      return await import(candidate);
    } catch {}
  }
  throw new Error("playwright_not_found");
}

function assertFixedHosts({ portalBaseUrl, oplBaseUrl, traceBaseUrl }) {
  const portal = new URL(portalBaseUrl);
  const opl = new URL(oplBaseUrl);
  const trace = new URL(traceBaseUrl);
  assert.equal(portal.protocol, "https:", "portal_must_use_https");
  assert.equal(opl.protocol, "https:", "opl_must_use_https");
  assert.equal(trace.protocol, "https:", "trace_must_use_https");
  assert.equal(portal.hostname, "portal.medopl.cn", "portal_host_must_be_fixed_official_host");
  assert.equal(opl.hostname, "opl.medopl.cn", "opl_host_must_be_fixed_official_host");
  assert.equal(trace.hostname, "trace.medopl.cn", "trace_host_must_be_fixed_official_host");
  if (boolEnv("V20_32_REQUIRE_ISOLATED_TRANSPORT")) {
    assert.equal(boolEnv("V20_32_ISOLATED_TRANSPORT_CONFIRMED"), true, "V20_32_ISOLATED_TRANSPORT_CONFIRMED_must_be_true");
    assert(env("V20_32_CONNECT_HOST"), "V20_32_CONNECT_HOST_required_when_isolated_transport_required");
  }
}

function transportOptionsFor(target, headers = {}) {
  const connectHost = env("V20_32_CONNECT_HOST");
  const connectPort = positiveIntEnv("V20_32_CONNECT_PORT", Number(target.port || (target.protocol === "https:" ? 443 : 80)));
  const allowInsecureTls = boolEnv("V20_32_ALLOW_INSECURE_TLS");
  if (!connectHost) {
    return {
      requestTarget: target,
      headers,
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
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
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 400,
          status: res.statusCode || 0,
          headers: res.headers,
          bodyText: Buffer.concat(chunks).toString("utf8"),
          latencyMs: Date.now() - startedAt,
        });
      });
    });
    req.on("error", (error) => reject(new Error(`request_failed:${sanitizeUrl(url)}:${String(error.message || error)}`)));
    req.setTimeout(options.timeoutMs || positiveIntEnv("V20_32_PREACCEPTANCE_HTTP_TIMEOUT_MS", 120_000), () => req.destroy(new Error("timeout")));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function requestJson(url, options = {}) {
  const result = await requestNodeText(url, options);
  let json = null;
  try {
    json = result.bodyText ? JSON.parse(result.bodyText) : null;
  } catch {}
  return { ...result, json };
}

function cookieFromSetCookie(headers, name) {
  const all = Array.isArray(headers) ? headers : headers ? [headers] : [];
  for (const header of all) {
    const cookie = String(header || "").split(";")[0] || "";
    const [cookieName, ...value] = cookie.split("=");
    if (cookieName === name && value.length) return { name: cookieName, value: value.join("=") };
  }
  return null;
}

async function loginPortalSessionCookie(portalBaseUrl, email, password) {
  const body = new URLSearchParams({ email, password }).toString();
  const result = await requestNodeText(`${portalBaseUrl}/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(Buffer.byteLength(body)),
    },
    body,
  });
  const cookie = cookieFromSetCookie(result.headers["set-cookie"], "portal_session");
  assert(cookie, `portal_session_cookie_missing:${result.status}:${sanitizeText(result.bodyText).slice(0, 160)}`);
  return {
    cookie,
    status: result.status,
    latencyMs: result.latencyMs,
  };
}

async function verifyPortalBuildTag(portalBaseUrl, expectedBuildTag) {
  const result = await requestJson(`${portalBaseUrl}/healthz`, { headers: { accept: "application/json" } });
  assert(result.status >= 200 && result.status < 300, `portal_healthz_failed:${result.status}`);
  const buildTag = String(result.json?.build?.sha || result.json?.buildTag || result.json?.version || "").trim();
  assert.equal(buildTag, expectedBuildTag, `portal_build_tag_mismatch:${buildTag || "missing"}`);
  return { buildTag, expectedBuildTag, latencyMs: result.latencyMs };
}

function browserLaunchOptions() {
  const connectHost = env("V20_32_CONNECT_HOST");
  const connectPort = positiveIntEnv("V20_32_CONNECT_PORT", 443);
  const proxy = env("V20_32_BROWSER_PROXY");
  const args = [];
  if (connectHost && !proxy) {
    args.push(`--host-resolver-rules=MAP portal.medopl.cn ${connectHost}:${connectPort},MAP opl.medopl.cn ${connectHost}:${connectPort},MAP trace.medopl.cn ${connectHost}:${connectPort}`);
  }
  return {
    headless: true,
    ...(args.length ? { args } : {}),
    ...(proxy ? { proxy: { server: proxy } } : {}),
  };
}

async function apiProbe(config, cookieHeader, item) {
  const result = await requestJson(`${config.portalBaseUrl}${item.apiSource}`, {
    headers: { cookie: cookieHeader, accept: "application/json" },
  });
  return {
    page: item.page,
    apiSource: item.apiSource,
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    latencyMs: result.latencyMs,
    bodyKeys: result.json && typeof result.json === "object" ? Object.keys(result.json).slice(0, 8) : [],
  };
}

async function renderPage(page, config, item) {
  const consoleErrors = [];
  const onConsole = (message) => {
    if (message.type() === "error") consoleErrors.push(sanitizeText(message.text()).slice(0, 300));
  };
  page.on("console", onConsole);
  const startedAt = Date.now();
  try {
    const response = await page.goto(`${config.portalBaseUrl}${item.route}`, {
      waitUntil: "domcontentloaded",
      timeout: config.browserTimeoutMs,
    });
    await page.waitForLoadState("networkidle", { timeout: config.networkIdleTimeoutMs }).catch(() => {});
    await page.waitForFunction(
      ({ requiredText }) => {
        const text = document.body?.innerText || "";
        return requiredText ? text.includes(requiredText) : text.trim().length > 0;
      },
      { requiredText: item.requiredText || "" },
      { timeout: config.browserContentTimeoutMs },
    ).catch(() => {});
    const text = sanitizeText(await page.locator("body").innerText({ timeout: 10_000 }).catch(() => ""));
    const anchors = await page.locator("a[href]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("href") || "").filter(Boolean),
    ).catch(() => []);
    const blockingText = /\b502\b|Bad Gateway|Cannot GET|Application error|ReferenceError|TypeError/i.test(text);
    return {
      page: item.page,
      route: item.route,
      ok: Boolean((response?.status?.() || 0) < 500 && text.trim().length > 0 && !blockingText && consoleErrors.length === 0),
      status: response?.status?.() || 0,
      latencyMs: Date.now() - startedAt,
      textLength: text.trim().length,
      requiredTextFound: item.requiredText ? text.includes(item.requiredText) : true,
      consoleErrorCount: consoleErrors.length,
      consoleErrors,
      blockingText,
      anchors: anchors.slice(0, 80),
    };
  } finally {
    page.off("console", onConsole);
  }
}

function checkNavigation(anchors = []) {
  const normalized = new Set(anchors.map((href) => {
    if (href.startsWith("/portal/app/")) return href.slice("/portal/app".length).replace(/[?#].*$/, "");
    return href.replace(/[?#].*$/, "");
  }));
  const missingUser = expectedUserNav.filter((href) => !normalized.has(href));
  const missingAdmin = expectedAdminNav.filter((href) => !normalized.has(href));
  const forbidden = anchors.filter((href) => forbiddenPrimaryLinks.some((item) => href.includes(item)));
  return {
    ok: missingUser.length === 0 && missingAdmin.length === 0 && forbidden.length === 0,
    expectedUserNav,
    expectedAdminNav,
    missingUser,
    missingAdmin,
    forbidden,
  };
}

async function verifyPortalOplJump(page, config) {
  const startedAt = Date.now();
  const response = await page.goto(`${config.portalBaseUrl}/portal/opl`, {
    waitUntil: "domcontentloaded",
    timeout: config.browserTimeoutMs,
  });
  await page.waitForTimeout(1_500);
  const currentUrl = page.url();
  return {
    ok: currentUrl.startsWith(config.oplBaseUrl),
    status: response?.status?.() || 0,
    latencyMs: Date.now() - startedAt,
    finalHost: new URL(currentUrl).hostname,
    source: "/portal/opl",
  };
}

async function verifyTraceBusinessPage(page, config) {
  const startedAt = Date.now();
  const response = await page.goto(config.traceBaseUrl, {
    waitUntil: "domcontentloaded",
    timeout: config.browserTimeoutMs,
  });
  const text = sanitizeText(await page.locator("body").innerText({ timeout: 10_000 }).catch(() => ""));
  return {
    ok: (response?.status?.() || 0) < 500 && text.trim().length > 0,
    status: response?.status?.() || 0,
    latencyMs: Date.now() - startedAt,
    textLength: text.trim().length,
    path: "/",
  };
}

function summarizeExperience(payload) {
  const pageLatencies = payload.pages.map((item) => Number(item.latencyMs || 0)).filter((item) => item >= 0);
  const apiLatencies = payload.apiProbes.map((item) => Number(item.latencyMs || 0)).filter((item) => item >= 0);
  return {
    loginLatencyMs: payload.login.latencyMs,
    pageCount: payload.pages.length,
    slowestPage: payload.pages.reduce((slowest, item) => Number(item.latencyMs || 0) > Number(slowest.latencyMs || 0) ? item : slowest, payload.pages[0] || {}),
    maxPageLatencyMs: Math.max(0, ...pageLatencies),
    maxApiLatencyMs: Math.max(0, ...apiLatencies),
    portalToOplJumpLatencyMs: payload.portalOplJump.latencyMs,
    tracePageLatencyMs: payload.traceBusiness.latencyMs,
    note: "该验收不创建或删除 CVM，不执行模型消息；OPL 回复耗时由 live-test-v20.32-portal-opl-message-loop.mjs 记录。",
  };
}

if (env("RUN_V20_32_PREACCEPTANCE") !== "1") {
  const payload = {
    ok: true,
    status: "skip",
    reason: "RUN_V20_32_PREACCEPTANCE_not_enabled",
    requiredEnv: [
      "RUN_V20_32_PREACCEPTANCE",
      "PORTAL_LIVE_EMAIL",
      "PORTAL_LIVE_PASSWORD",
      "V20_32_EXPECTED_BUILD_TAG",
    ],
    userPages: V20_32_PREACCEPTANCE_USER_PAGES,
    adminPages: V20_32_PREACCEPTANCE_ADMIN_PAGES,
    costRisk: "no_cvm_create_delete_no_model_message",
  };
  payload.evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const config = {
  portalBaseUrl: baseUrl("V20_32_PORTAL_BASE_URL", "https://portal.medopl.cn"),
  oplBaseUrl: baseUrl("V20_32_OPL_BASE_URL", "https://opl.medopl.cn"),
  traceBaseUrl: baseUrl("V20_32_TRACE_BASE_URL", "https://trace.medopl.cn"),
  expectedBuildTag: env("V20_32_EXPECTED_BUILD_TAG", "opl-v20.32"),
  browserTimeoutMs: positiveIntEnv("V20_32_PREACCEPTANCE_BROWSER_TIMEOUT_MS", 120_000),
  networkIdleTimeoutMs: positiveIntEnv("V20_32_PREACCEPTANCE_NETWORKIDLE_TIMEOUT_MS", 8_000),
  browserContentTimeoutMs: positiveIntEnv("V20_32_PREACCEPTANCE_CONTENT_TIMEOUT_MS", 45_000),
};

const email = env("PORTAL_LIVE_EMAIL", env("PORTAL_ADMIN_EMAIL"));
const password = env("PORTAL_LIVE_PASSWORD", env("PORTAL_ADMIN_PASSWORD"));
assert(email, "PORTAL_LIVE_EMAIL_or_PORTAL_ADMIN_EMAIL_required");
assert(password, "PORTAL_LIVE_PASSWORD_or_PORTAL_ADMIN_PASSWORD_required");
assertFixedHosts(config);

let browser = null;
let context = null;
const evidence = {
  status: "running",
  startedAt: nowIso(),
  finishedAt: "",
  hosts: {
    portal: sanitizeUrl(config.portalBaseUrl),
    opl: sanitizeUrl(config.oplBaseUrl),
    trace: sanitizeUrl(config.traceBaseUrl),
  },
  costRisk: "no_cvm_create_delete_no_model_message",
  portalBuild: {},
  login: {},
  apiProbes: [],
  pages: [],
  navigation: {},
  portalOplJump: {},
  traceBusiness: {},
  experience: {},
};

try {
  evidence.portalBuild = await verifyPortalBuildTag(config.portalBaseUrl, config.expectedBuildTag);
  const login = await loginPortalSessionCookie(config.portalBaseUrl, email, password);
  evidence.login = { ok: true, status: login.status, latencyMs: login.latencyMs, email };
  const cookieHeader = `${login.cookie.name}=${login.cookie.value}`;

  evidence.apiProbes = await Promise.all(
    [...V20_32_PREACCEPTANCE_USER_PAGES, ...V20_32_PREACCEPTANCE_ADMIN_PAGES].map((item) => apiProbe(config, cookieHeader, item)),
  );

  const playwrightPkg = await loadPlaywright();
  const { chromium } = playwrightPkg.chromium ? playwrightPkg : playwrightPkg.default;
  browser = await chromium.launch(browserLaunchOptions());
  context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    ignoreHTTPSErrors: true,
  });
  await context.addCookies([{
    name: login.cookie.name,
    value: login.cookie.value,
    domain: new URL(config.portalBaseUrl).hostname,
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  }]);
  const page = await context.newPage();

  for (const item of [...V20_32_PREACCEPTANCE_USER_PAGES, ...V20_32_PREACCEPTANCE_ADMIN_PAGES]) {
    evidence.pages.push(await renderPage(page, config, item));
  }
  const overview = evidence.pages.find((item) => item.page === "overview") || {};
  evidence.navigation = checkNavigation(overview.anchors || []);
  evidence.portalOplJump = await verifyPortalOplJump(page, config);
  evidence.traceBusiness = await verifyTraceBusinessPage(page, config);
  evidence.experience = summarizeExperience(evidence);

  evidence.status = "done";
  evidence.finishedAt = nowIso();
  const ok = evidence.apiProbes.every((item) => item.ok) &&
    evidence.pages.every((item) => item.ok && item.requiredTextFound) &&
    evidence.navigation.ok &&
    evidence.portalOplJump.ok &&
    evidence.traceBusiness.ok;
  const payload = {
    ok,
    status: ok ? "live" : "failed",
    contract: "v20.32_production_preacceptance",
    evidence,
  };
  payload.evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify(sanitizeEvidence(payload), null, 2));
  if (!ok) process.exitCode = 1;
} catch (error) {
  evidence.status = "failed";
  evidence.finishedAt = nowIso();
  evidence.error = sanitizeText(error instanceof Error ? error.message : String(error));
  const payload = {
    ok: false,
    status: "failed",
    contract: "v20.32_production_preacceptance",
    evidence,
  };
  payload.evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify(sanitizeEvidence(payload), null, 2));
  process.exitCode = 1;
} finally {
  await context?.close?.().catch(() => {});
  await browser?.close?.().catch(() => {});
}
