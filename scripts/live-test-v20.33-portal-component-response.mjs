import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createEvidenceRecorder } from "./lib/v20.33-evidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.33-portal-component-response");
const evidenceRecorder = createEvidenceRecorder({ evidenceDir, contract: "v20.33_portal_component_response" });

const EXPECTED_ROUTE_COUNT = 23;
const EXPECTED_RENDERABLE_ROUTE_COUNT = 22;
const EXPECTED_API_FUNCTION_COUNT = 60;
const EXPECTED_SHARED_COMPONENT_COUNT = 8;

const PORTAL_RENDERABLE_ROUTES = Object.freeze([
  Object.freeze({ path: "/overview", requiredText: "总览" }),
  Object.freeze({ path: "/packages", requiredText: "套餐" }),
  Object.freeze({ path: "/resources", requiredText: "资源" }),
  Object.freeze({ path: "/workspace", requiredText: "工作空间" }),
  Object.freeze({ path: "/opl-launch", requiredText: "OPL" }),
  Object.freeze({ path: "/advanced/servers", requiredText: "服务器", admin: true }),
  Object.freeze({ path: "/billing", requiredText: "账单" }),
  Object.freeze({ path: "/trace", requiredText: "轨迹" }),
  Object.freeze({ path: "/admin/dashboard", requiredText: "运行总台", admin: true }),
  Object.freeze({ path: "/admin/users", requiredText: "用户", admin: true }),
  Object.freeze({ path: "/admin/trace", requiredText: "轨迹", admin: true }),
  Object.freeze({ path: "/admin/user", requiredText: "用户详情", admin: true, dynamic: true }),
  Object.freeze({ path: "/admin/groups", requiredText: "分组", admin: true }),
  Object.freeze({ path: "/admin/workspace", requiredText: "工作空间", admin: true, dynamic: true }),
  Object.freeze({ path: "/admin/run", requiredText: "运行", admin: true, dynamic: true }),
  Object.freeze({ path: "/admin/billing-ops", requiredText: "账单对账与调整", admin: true }),
  Object.freeze({ path: "/admin/alerts", requiredText: "告警中心", admin: true }),
  Object.freeze({ path: "/admin/usage", requiredText: "使用记录", admin: true }),
  Object.freeze({ path: "/admin/system", requiredText: "系统", admin: true }),
  Object.freeze({ path: "/admin/ops", requiredText: "云资源", admin: true }),
  Object.freeze({ path: "/admin/sandboxes", requiredText: "沙箱", admin: true }),
  Object.freeze({ path: "/admin/audit", requiredText: "审计日志", admin: true }),
]);

const PORTAL_SHARED_COMPONENTS = Object.freeze([
  Object.freeze({
    name: "AppLayout",
    sourcePath: "services/portal/frontend/src/layouts/AppLayout.vue",
    usageHints: ["@/layouts/AppLayout.vue", "@/layouts/AppLayout"],
    expectedRuntime: true,
  }),
  Object.freeze({
    name: "AppHeader",
    sourcePath: "services/portal/frontend/src/layouts/AppHeader.vue",
    usageHints: ["@/layouts/AppHeader.vue", "@/layouts/AppHeader", "<AppHeader"],
    expectedRuntime: true,
  }),
  Object.freeze({
    name: "AppSidebar",
    sourcePath: "services/portal/frontend/src/layouts/AppSidebar.vue",
    usageHints: ["@/layouts/AppSidebar.vue", "@/layouts/AppSidebar", "<AppSidebar"],
    expectedRuntime: true,
  }),
  Object.freeze({
    name: "BaseDialog",
    sourcePath: "services/portal/frontend/src/components/common/BaseDialog.vue",
    usageHints: ["@/components/common/BaseDialog.vue", "@/components/common/BaseDialog", "<BaseDialog"],
    expectedRuntime: true,
  }),
  Object.freeze({
    name: "AnnouncementDialog(common)",
    sourcePath: "services/portal/frontend/src/components/common/AnnouncementDialog.vue",
    usageHints: ["@/components/common/AnnouncementDialog.vue", "@/components/common/AnnouncementDialog"],
    expectedRuntime: true,
  }),
  Object.freeze({
    name: "AnnouncementDialog(overview)",
    sourcePath: "services/portal/frontend/src/components/overview/AnnouncementDialog.vue",
    usageHints: ["@/components/overview/AnnouncementDialog.vue", "@/components/overview/AnnouncementDialog"],
    expectedRuntime: false,
  }),
  Object.freeze({
    name: "MetricCard",
    sourcePath: "services/portal/frontend/src/components/common/MetricCard.vue",
    usageHints: ["@/components/common/MetricCard.vue", "@/components/common/MetricCard", "<MetricCard"],
    expectedRuntime: true,
  }),
  Object.freeze({
    name: "ChartCard",
    sourcePath: "services/portal/frontend/src/components/charts/ChartCard.vue",
    usageHints: ["@/components/charts/ChartCard.vue", "@/components/charts/ChartCard", "<ChartCard"],
    expectedRuntime: false,
  }),
]);

const unsafeMutationPatterns = Object.freeze([
  /\b(create|provision|apply|submit|confirm|save|start|stop|restart|terminate|destroy)\b/i,
  /\b(delete|remove|drop|purge|reset|recharge|top[- ]?up)\b/i,
  /\b(充值|删除|销毁|重置|提交|创建|开通|启动|停止)\b/,
]);

const skippedUnsafeControls = [];
const componentCoverage = {
  sharedComponents: PORTAL_SHARED_COMPONENTS.map((component) => ({
    name: component.name,
    sourcePath: component.sourcePath,
    expectedRuntime: component.expectedRuntime,
    sourceUsageCount: 0,
    usedInSource: false,
    covered: false,
    response: "not_checked",
  })),
  routeControlSummary: [],
};
const routeCoverage = [];
const apiInventory = {
  expectedApiFunctionCount: EXPECTED_API_FUNCTION_COUNT,
  actualApiFunctionCount: 0,
  functionNamesSample: [],
};

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
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

function nonNegativeIntEnv(name, fallback) {
  const parsed = Number(env(name));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function baseUrl(name, fallback) {
  return env(name, fallback).replace(/\/+$/, "");
}

function sanitizeText(value = "") {
  return String(value || "")
    .replace(/\b(cookie|authorization|password|secret|token)\b[^,\n]*/gi, "$1=[redacted]")
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
  if (!value || typeof value !== "object") return typeof value === "string" ? sanitizeText(value) : value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeEvidence(item)]));
}

async function writeEvidence(payload) {
  return evidenceRecorder.writeEvidence(sanitizeEvidence(payload));
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

async function listFilesRecursive(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(fullPath));
    } else if (entry.isFile() && /\.(vue|ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function assertFixedHosts({ portalBaseUrl }) {
  const portal = new URL(portalBaseUrl);
  assert.equal(portal.protocol, "https:", "portal_must_use_https");
  assert.equal(portal.hostname, "portal.medopl.cn", "portal_host_must_be_fixed_official_host");
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
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
      },
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
    req.setTimeout(options.timeoutMs || positiveIntEnv("V20_33_COMPONENT_RESPONSE_HTTP_TIMEOUT_MS", 120_000), () => req.destroy(new Error("timeout")));
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
  return { cookie, status: result.status, latencyMs: result.latencyMs };
}

async function loginPortalBrowser(context, config) {
  const page = await context.newPage();
  try {
    await page.goto(`${config.portalBaseUrl}/login`, { waitUntil: "domcontentloaded", timeout: config.browserTimeoutMs });
    await page.locator('input[type="email"], input[name="email"], input[name="username"]').first().fill(config.email, { timeout: 15_000 });
    await page.locator('input[type="password"]').first().fill(config.password, { timeout: 15_000 });
    await Promise.all([
      page.waitForURL((url) => String(url.pathname || "").startsWith("/portal/app"), { timeout: 30_000 }).catch(() => {}),
      page.locator('button[type="submit"], button:has-text("登录")').first().click({ timeout: 15_000 }),
    ]);
    await page.goto(`${config.portalBaseUrl}/portal/app/overview`, { waitUntil: "domcontentloaded", timeout: config.browserTimeoutMs });
    await page.waitForFunction(() => String(document.body?.innerText || "").includes("MedOPL"), null, { timeout: 15_000 });
    const me = await page.evaluate(async () => {
      const response = await fetch("/portal/api/me", { credentials: "same-origin" });
      return { status: response.status, text: await response.text() };
    });
    assert(me.status >= 200 && me.status < 300, `browser_login_me_failed:${me.status}:${sanitizeText(me.text).slice(0, 160)}`);
    return { ok: true, meStatus: me.status };
  } finally {
    await page.close().catch(() => {});
  }
}

async function verifyPortalBuildTag(portalBaseUrl, expectedBuildTag) {
  const result = await requestJson(`${portalBaseUrl}/healthz`, { headers: { accept: "application/json" } });
  assert(result.status >= 200 && result.status < 300, `portal_healthz_failed:${result.status}`);
  const buildTag = String(result.json?.build?.sha || result.json?.buildTag || result.json?.version || "").trim();
  assert.equal(buildTag, expectedBuildTag, `portal_build_tag_mismatch:${buildTag || "missing"}`);
  return { buildTag, expectedBuildTag, latencyMs: result.latencyMs };
}

function browserLaunchOptions() {
  const connectHost = env("V20_33_CONNECT_HOST");
  const connectPort = positiveIntEnv("V20_33_CONNECT_PORT", 443);
  const proxy = env("V20_33_BROWSER_PROXY");
  const args = [];
  if (connectHost && !proxy) {
    args.push(`--host-resolver-rules=MAP portal.medopl.cn ${connectHost}:${connectPort}`);
  }
  return {
    headless: true,
    ...(args.length ? { args } : {}),
    ...(proxy ? { proxy: { server: proxy } } : {}),
  };
}

async function resolveDynamicRouteTargets(config, cookieHeader) {
  const users = await requestJson(`${config.portalBaseUrl}/portal/api/admin/users?page=1&page_size=10`, {
    headers: { cookie: cookieHeader, accept: "application/json" },
  });
  const usage = await requestJson(`${config.portalBaseUrl}/portal/api/admin/usage?page=1&page_size=20`, {
    headers: { cookie: cookieHeader, accept: "application/json" },
  });
  const firstUser = (users.json?.items || []).find((item) => item?.id);
  let firstWorkspace = null;
  if (firstUser?.id) {
    const portrait = await requestJson(`${config.portalBaseUrl}/portal/api/admin/user?userId=${encodeURIComponent(firstUser.id)}`, {
      headers: { cookie: cookieHeader, accept: "application/json" },
    });
    firstWorkspace = (portrait.json?.workspaces || []).find((item) => item?.slug);
  }
  const firstRun = (usage.json?.items || []).find((item) => item?.runId);
  return {
    "/admin/user": firstUser?.id ? `/admin/user?userId=${encodeURIComponent(firstUser.id)}` : "/admin/user",
    "/admin/workspace": firstUser?.id && firstWorkspace?.slug ? `/admin/workspace?userId=${encodeURIComponent(firstUser.id)}&workspaceId=${encodeURIComponent(firstWorkspace.slug)}` : "/admin/workspace",
    "/admin/run": firstRun?.runId ? `/admin/run?runId=${encodeURIComponent(firstRun.runId)}` : "/admin/run",
    "/admin/trace": firstRun?.traceId ? `/admin/trace?traceId=${encodeURIComponent(firstRun.traceId)}` : "/admin/trace",
  };
}

function unsafeControlReason(control) {
  const probe = `${control.tagName || ""} ${control.text || ""} ${control.ariaLabel || ""} ${control.href || ""} ${control.name || ""}`.trim();
  for (const pattern of unsafeMutationPatterns) {
    if (pattern.test(probe)) return `matched:${pattern}`;
  }
  return "";
}

function safeControlReason(control) {
  const text = String(control.text || control.ariaLabel || "").trim();
  if (/^(关闭|取消|刷新|应用筛选|重置|上一页|下一页|详情|查看)$/i.test(text)) {
    return "allowlisted_text";
  }
  return "";
}

async function clickSafeControl(page, control, timeoutMs) {
  if (!control.selector) return { clicked: false, reason: "no_selector" };
  try {
    const locator = page.locator(control.selector).first();
    await locator.scrollIntoViewIfNeeded({ timeout: Math.min(timeoutMs, 1_000) }).catch(() => {});
    await locator.click({ timeout: timeoutMs, noWaitAfter: true });
    await page.waitForTimeout(200);
    return { clicked: true };
  } catch (error) {
    return { clicked: false, reason: sanitizeText(String(error?.message || error)) };
  }
}

async function closeVisibleDialogs(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dialog = page.locator("[role='dialog'], dialog, .fixed.inset-0.z-\\[100\\]").first();
    if (!(await dialog.count().catch(() => 0))) return;
    if (!(await dialog.isVisible().catch(() => false))) return;
    const closeButton = page.locator("button:has-text('关闭'), button:has-text('取消'), button:has-text('我已了解')").first();
    if (await closeButton.count().catch(() => 0)) {
      await closeButton.click({ timeout: 3_000 }).catch(() => {});
    } else {
      await page.keyboard.press("Escape").catch(() => {});
    }
    await page.waitForTimeout(150);
  }
}

async function verifyHeaderDialogs(page) {
  const results = [];
  for (const label of ["帮助", "公告"]) {
    const button = page.locator(`button:has-text('${label}')`).first();
    const visible = await button.isVisible().catch(() => false);
    const result = { label, visible, opened: false, closed: false };
    if (visible) {
      await button.click({ timeout: 5_000 });
      const dialog = page.locator("[role='dialog'], dialog, .fixed.inset-0.z-\\[100\\]").first();
      result.opened = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
      await closeVisibleDialogs(page);
      result.closed = !(await dialog.isVisible().catch(() => false));
    }
    results.push(result);
  }
  return results;
}

async function verifyHeaderInteractions(page) {
  const dialogs = await verifyHeaderDialogs(page);
  const themeButton = page.locator("#theme-toggle").first();
  const theme = { visible: false, changed: false };
  if (await themeButton.isVisible().catch(() => false)) {
    theme.visible = true;
    const before = await page.evaluate(() => document.documentElement.dataset.theme || "");
    await themeButton.click({ timeout: 3_000 });
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => document.documentElement.dataset.theme || "");
    theme.changed = before !== after;
  }
  const userMenuButton = page.locator("header button").filter({ hasText: /ZITADEL|当前用户|Admin|User/i }).first();
  const userMenu = { visible: false, opened: false, closed: false };
  if (await userMenuButton.count().catch(() => 0)) {
    userMenu.visible = await userMenuButton.isVisible().catch(() => false);
    if (userMenu.visible) {
      await userMenuButton.click({ timeout: 3_000 });
      userMenu.opened = await page.locator("a[href*='/logout']").first().isVisible({ timeout: 3_000 }).catch(() => false);
      await page.keyboard.press("Escape").catch(() => {});
      await page.mouse.click(20, 20).catch(() => {});
      await page.waitForTimeout(150);
      userMenu.closed = !(await page.locator("a[href*='/logout']").first().isVisible().catch(() => false));
    }
  }
  return { dialogs, theme, userMenu };
}

async function verifySidebarNavigation(page) {
  const billingLink = page.locator("aside a").filter({ hasText: "账单" }).first();
  const result = { visible: false, navigated: false, finalUrl: "" };
  result.visible = await billingLink.isVisible().catch(() => false);
  if (!result.visible) return result;
  await billingLink.click({ timeout: 3_000 });
  await page.waitForURL((url) => String(url.pathname || "").endsWith("/billing"), { timeout: 8_000 });
  await page.waitForFunction(() => String(document.body?.innerText || "").includes("账单"), null, { timeout: 8_000 });
  result.navigated = true;
  result.finalUrl = sanitizeUrl(page.url());
  return result;
}

async function verifyMountedComponentResponses(page, config) {
  await page.goto("/portal/app/overview", { waitUntil: "domcontentloaded", timeout: config.browserTimeoutMs });
  await waitForRouteReady(page, { requiredText: "账户与任务总览" }, config.browserTimeoutMs);
  const header = await verifyHeaderInteractions(page);
  const sidebar = await verifySidebarNavigation(page);
  await page.goto("/portal/app/overview", { waitUntil: "domcontentloaded", timeout: config.browserTimeoutMs });
  await waitForRouteReady(page, { requiredText: "账户与任务总览" }, config.browserTimeoutMs);
  const metricLabels = ["钱包余额", "运行中预扣", "可用额度", "活跃订单"];
  const metricCard = {
    labels: metricLabels,
    visibleCount: 0,
  };
  for (const label of metricLabels) {
    if (await page.locator(`text=${label}`).first().isVisible().catch(() => false)) metricCard.visibleCount += 1;
  }
  const layoutTitleVisible = await page.locator("header h1").filter({ hasText: "MedOPL" }).first().isVisible().catch(() => false);
  const headerVisible = await page.locator("header").first().isVisible().catch(() => false);
  const sidebarVisible = await page.locator("aside").first().isVisible().catch(() => false);

  return {
    AppLayout: { covered: layoutTitleVisible, response: layoutTitleVisible ? "title_visible" : "title_missing" },
    AppHeader: {
      covered: headerVisible && header.theme.changed && header.userMenu.opened,
      response: header,
    },
    AppSidebar: {
      covered: sidebarVisible && sidebar.navigated,
      response: sidebar,
    },
    BaseDialog: {
      covered: header.dialogs.some((item) => item.opened && item.closed),
      response: header.dialogs,
    },
    "AnnouncementDialog(common)": {
      covered: header.dialogs.some((item) => item.label === "帮助" && item.opened && item.closed),
      response: header.dialogs.find((item) => item.label === "帮助") || null,
    },
    MetricCard: {
      covered: metricCard.visibleCount === metricLabels.length,
      response: metricCard,
    },
  };
}

async function inspectInteractiveControls(page, routePath, config) {
  const controls = await page.evaluate(() => {
    const toNodeInfo = (node, idx) => {
      const tagName = String(node.tagName || "").toLowerCase();
      const text = String(node.textContent || "").trim().slice(0, 80);
      const ariaLabel = String(node.getAttribute?.("aria-label") || "").trim().slice(0, 80);
      const href = String(node.getAttribute?.("href") || "").trim();
      const name = String(node.getAttribute?.("name") || "").trim();
      const selector = node.id
        ? `#${CSS.escape(node.id)}`
        : `${tagName}${node.className ? `.${String(node.className).trim().split(/\s+/).slice(0, 2).map((v) => CSS.escape(v)).join(".")}` : ""}:nth-of-type(${Math.max(1, idx + 1)})`;
      return { tagName, text, ariaLabel, href, name, selector };
    };
    const buttons = Array.from(document.querySelectorAll("button,[role='button']")).map((node, idx) => toNodeInfo(node, idx));
    const links = Array.from(document.querySelectorAll("a[href]")).map((node, idx) => toNodeInfo(node, idx));
    const inputs = Array.from(document.querySelectorAll("input,textarea")).map((node, idx) => toNodeInfo(node, idx));
    const selects = Array.from(document.querySelectorAll("select")).map((node, idx) => toNodeInfo(node, idx));
    const dialogs = Array.from(document.querySelectorAll("dialog,[role='dialog']")).map((node, idx) => toNodeInfo(node, idx));
    return { buttons, links, inputs, selects, dialogs };
  });

  const allClickables = [...controls.buttons];
  const clickSamples = [];
  for (const control of allClickables.slice(0, config.safeClickSampleLimit)) {
    if (/^(帮助|公告)$/i.test(String(control.text || control.ariaLabel || "").trim())) {
      skippedUnsafeControls.push({ route: routePath, control, reason: "tested_by_header_dialog_contract" });
      continue;
    }
    const reason = unsafeControlReason(control);
    if (reason) {
      skippedUnsafeControls.push({ route: routePath, control, reason });
      continue;
    }
    const allowed = safeControlReason(control);
    if (!allowed) {
      skippedUnsafeControls.push({ route: routePath, control, reason: "not_in_safe_allowlist" });
      continue;
    }
    const click = await clickSafeControl(page, control, config.safeClickTimeoutMs);
    clickSamples.push({ control: { tagName: control.tagName, text: control.text, href: control.href }, allowed, ...click });
    await closeVisibleDialogs(page);
  }

  return {
    count: {
      buttons: controls.buttons.length,
      links: controls.links.length,
      inputs: controls.inputs.length,
      selects: controls.selects.length,
      dialogs: controls.dialogs.length,
    },
    clickSamples,
  };
}

async function waitForRouteReady(page, route, timeoutMs) {
  await page.locator("body").waitFor({ state: "visible", timeout: Math.min(timeoutMs, 10_000) });
  if (!route.requiredText) {
    await page.waitForFunction(
      () => String(document.body?.innerText || "").trim().length > 80,
      null,
      { timeout: Math.min(timeoutMs, 12_000) },
    );
    return;
  }
  await page.waitForFunction(
    (requiredText) => String(document.body?.innerText || "").includes(requiredText),
    route.requiredText,
    { timeout: Math.min(timeoutMs, 20_000) },
  );
}

async function collectApiInventory() {
  const apiPath = path.join(repoRoot, "services/portal/frontend/src/api/portal.ts");
  const source = await readFile(apiPath, "utf8");
  const names = [...source.matchAll(/export async function\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  apiInventory.actualApiFunctionCount = names.length;
  apiInventory.functionNamesSample = names.slice(0, 20);
}

async function collectComponentUsageInventory() {
  const sourceRoot = path.join(repoRoot, "services/portal/frontend/src");
  const files = await listFilesRecursive(sourceRoot);
  const contents = await Promise.all(files.map(async (filePath) => ({
    relativePath: path.relative(repoRoot, filePath).replace(/\\/g, "/"),
    text: await readFile(filePath, "utf8"),
  })));
  for (const item of componentCoverage.sharedComponents) {
    const contract = PORTAL_SHARED_COMPONENTS.find((component) => component.name === item.name);
    const sourceText = contents
      .filter((file) => file.relativePath !== item.sourcePath)
      .map((file) => file.text)
      .join("\n");
    const usageCount = (contract?.usageHints || []).reduce((count, hint) => {
      return count + sourceText.split(hint).length - 1;
    }, 0);
    item.sourceUsageCount = usageCount;
    item.usedInSource = usageCount > 0;
    if (!item.expectedRuntime && !item.usedInSource) {
      item.response = "not_mounted_in_current_portal";
    }
  }
}

function markSharedCoverage(routePath, routeResult) {
  const summaryText = `${routePath} ${routeResult.requiredText || ""}`.toLowerCase();
  for (const item of componentCoverage.sharedComponents) {
    if (!item.expectedRuntime) continue;
    if (item.name === "AppLayout" || item.name === "AppHeader" || item.name === "AppSidebar") item.covered = true;
    if (summaryText.includes("总览") && item.name === "AnnouncementDialog(overview)") item.covered = true;
    if (summaryText.includes("公告") && item.name === "AnnouncementDialog(common)") item.covered = true;
    if (summaryText.includes("总览") && item.name === "MetricCard") item.covered = true;
    if ((routeResult.headerDialogs || []).some((dialog) => dialog.label === "公告" && dialog.opened) && item.name === "AnnouncementDialog(common)") item.covered = true;
    if ((routeResult.headerDialogs || []).some((dialog) => dialog.opened) && item.name === "BaseDialog") item.covered = true;
    if (routeResult.controlCount.dialogs > 0 && item.name === "BaseDialog") item.covered = true;
  }
}

function skippedPayload(config, reason, extra = {}) {
  return {
    ok: true,
    skipped: true,
    reason,
    model: "gpt-5.3-codex",
    host: sanitizeUrl(config.portalBaseUrl),
    V20_33_EXPECTED_BUILD_TAG: config.expectedBuildTag || "",
    ...extra,
  };
}

async function main() {
  await loadConfiguredEnvFiles();

  const config = {
    portalBaseUrl: baseUrl("V20_33_PORTAL_BASE_URL", "https://portal.medopl.cn"),
    email: env("V20_33_PORTAL_EMAIL", env("PORTAL_LIVE_EMAIL", env("V20_33_ADMIN_EMAIL", env("PORTAL_ADMIN_EMAIL")))),
    password: env("V20_33_PORTAL_PASSWORD", env("PORTAL_LIVE_PASSWORD", env("V20_33_ADMIN_PASSWORD", env("PORTAL_ADMIN_PASSWORD")))),
    expectedBuildTag: env("V20_33_EXPECTED_BUILD_TAG"),
    browserTimeoutMs: positiveIntEnv("V20_33_COMPONENT_RESPONSE_BROWSER_TIMEOUT_MS", 60_000),
    routeSettleMs: positiveIntEnv("V20_33_COMPONENT_RESPONSE_ROUTE_SETTLE_MS", 800),
    safeClickSampleLimit: nonNegativeIntEnv("V20_33_COMPONENT_RESPONSE_SAFE_CLICK_SAMPLE_LIMIT", 3),
    safeClickTimeoutMs: positiveIntEnv("V20_33_COMPONENT_RESPONSE_SAFE_CLICK_TIMEOUT_MS", 1_500),
  };

  assert.equal(PORTAL_RENDERABLE_ROUTES.length, EXPECTED_RENDERABLE_ROUTE_COUNT, "portal_renderable_routes_inventory_mismatch");
  assert.equal(PORTAL_SHARED_COMPONENTS.length, EXPECTED_SHARED_COMPONENT_COUNT, "portal_shared_components_inventory_mismatch");
  assertFixedHosts({ portalBaseUrl: config.portalBaseUrl });
  await collectApiInventory();
  await collectComponentUsageInventory();
  assert.equal(apiInventory.actualApiFunctionCount, EXPECTED_API_FUNCTION_COUNT, "portal_api_function_inventory_mismatch");
  assert.equal(EXPECTED_ROUTE_COUNT, EXPECTED_RENDERABLE_ROUTE_COUNT + 1, "route_count_contract_mismatch");

  if (env("RUN_V20_33_COMPONENT_RESPONSE") !== "1") {
    const payload = skippedPayload(config, "run_flag_not_enabled", { requiredEnv: "RUN_V20_33_COMPONENT_RESPONSE=1" });
    const evidencePath = await writeEvidence({ ts: nowIso(), ...payload });
    console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
    return;
  }

  if (!config.email || !config.password || !config.expectedBuildTag) {
    const payload = skippedPayload(config, "missing_live_credentials_or_expected_build_tag", {
      requiredEnv: ["V20_33_PORTAL_EMAIL", "V20_33_PORTAL_PASSWORD", "V20_33_EXPECTED_BUILD_TAG"],
    });
    const evidencePath = await writeEvidence({ ts: nowIso(), ...payload });
    console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
    return;
  }

  const build = await verifyPortalBuildTag(config.portalBaseUrl, config.expectedBuildTag);
  const login = await loginPortalSessionCookie(config.portalBaseUrl, config.email, config.password);
  const cookieHeader = `${login.cookie.name}=${login.cookie.value}`;
  const dynamicTargets = await resolveDynamicRouteTargets(config, cookieHeader);

  const playwrightPkg = await loadPlaywright();
  const { chromium } = playwrightPkg.chromium ? playwrightPkg : playwrightPkg.default;
  const browser = await chromium.launch(browserLaunchOptions());
  const context = await browser.newContext({
    baseURL: config.portalBaseUrl,
    ignoreHTTPSErrors: boolEnv("V20_33_ALLOW_INSECURE_TLS"),
  });
  const browserLogin = await loginPortalBrowser(context, config);
  const componentPage = await context.newPage();
  try {
    const componentResponses = await verifyMountedComponentResponses(componentPage, config);
    for (const item of componentCoverage.sharedComponents) {
      const response = componentResponses[item.name];
      if (!response) continue;
      item.covered = Boolean(response.covered);
      item.response = response.response;
    }
  } finally {
    await componentPage.close().catch(() => {});
  }

  const consoleErrors = [];
  const pageErrors = [];

  try {
    for (const route of PORTAL_RENDERABLE_ROUTES) {
      const page = await context.newPage();
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(`${route.path}:${sanitizeText(msg.text()).slice(0, 300)}`);
      });
      page.on("pageerror", (error) => pageErrors.push(`${route.path}:${sanitizeText(String(error?.message || error))}`));
      const target = route.dynamic ? (dynamicTargets[route.path] || route.path) : route.path;
      try {
        const response = await page.goto(`/portal/app${target}`, {
          waitUntil: "domcontentloaded",
          timeout: config.browserTimeoutMs,
        });
        await waitForRouteReady(page, route, config.browserTimeoutMs);
        await page.waitForTimeout(config.routeSettleMs);
        const bodyText = sanitizeText(await page.locator("body").innerText().catch(() => ""));
        const nonEmpty = bodyText.trim().length > 80;
        const headerDialogs = route.path === "/overview" ? await verifyHeaderDialogs(page) : [];
        const controls = await inspectInteractiveControls(page, route.path, config);
        const item = {
          path: route.path,
          target,
          status: response?.status?.() || 0,
          nonEmpty,
          requiredText: route.requiredText,
          requiredTextFound: route.requiredText ? bodyText.includes(route.requiredText) : true,
          controlCount: controls.count,
          clickSamples: controls.clickSamples,
          headerDialogs,
        };
        routeCoverage.push(item);
        componentCoverage.routeControlSummary.push({
          route: route.path,
          buttons: controls.count.buttons,
          links: controls.count.links,
          inputs: controls.count.inputs,
          selects: controls.count.selects,
          dialogs: controls.count.dialogs,
        });
        markSharedCoverage(route.path, item);
      } catch (error) {
        const bodyText = sanitizeText(await page.locator("body").innerText().catch(() => ""));
        const controls = await inspectInteractiveControls(page, route.path, config).catch(() => ({
          count: { buttons: 0, links: 0, inputs: 0, selects: 0, dialogs: 0 },
          clickSamples: [],
        }));
        const item = {
          path: route.path,
          target,
          url: sanitizeUrl(page.url()),
          status: 0,
          nonEmpty: bodyText.trim().length > 80,
          requiredText: route.requiredText,
          requiredTextFound: route.requiredText ? bodyText.includes(route.requiredText) : true,
          error: sanitizeText(String(error?.message || error)).split("\n")[0],
          bodyPreview: bodyText.slice(0, 260),
          controlCount: controls.count,
          clickSamples: controls.clickSamples,
          headerDialogs: [],
        };
        routeCoverage.push(item);
        componentCoverage.routeControlSummary.push({
          route: route.path,
          buttons: controls.count.buttons,
          links: controls.count.links,
          inputs: controls.count.inputs,
          selects: controls.count.selects,
          dialogs: controls.count.dialogs,
        });
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const failedRoutes = routeCoverage.filter((item) =>
    !(item.status >= 200 && item.status < 400 && item.nonEmpty && item.requiredTextFound && !item.error)
  );
  const missingSharedComponents = componentCoverage.sharedComponents.filter((item) => item.expectedRuntime && !item.covered);
  const inactiveSourceComponents = componentCoverage.sharedComponents.filter((item) => !item.expectedRuntime && !item.usedInSource);

  const result = {
    ok: failedRoutes.length === 0 && missingSharedComponents.length === 0 && consoleErrors.length === 0 && pageErrors.length === 0,
    skipped: false,
    model: "gpt-5.3-codex",
    host: sanitizeUrl(config.portalBaseUrl),
    V20_33_EXPECTED_BUILD_TAG: config.expectedBuildTag,
    build,
    login: { status: login.status, latencyMs: login.latencyMs, browserLogin },
    routeInventory: {
      expectedRouteCount: EXPECTED_ROUTE_COUNT,
      expectedRenderableRouteCount: EXPECTED_RENDERABLE_ROUTE_COUNT,
      actualRenderableRouteCount: PORTAL_RENDERABLE_ROUTES.length,
    },
    apiInventory,
    componentCoverage,
    inactiveSourceComponents,
    fullSourceComponentResponseOk: inactiveSourceComponents.length === 0 && missingSharedComponents.length === 0,
    failedRoutes,
    missingSharedComponents,
    routeCoverage,
    skippedUnsafeControls,
    consoleErrorCount: consoleErrors.length,
    pageErrorCount: pageErrors.length,
    consoleErrors: consoleErrors.slice(0, 50),
    pageErrors: pageErrors.slice(0, 50),
    ts: nowIso(),
  };

  const evidencePath = await writeEvidence(result);
  console.log(JSON.stringify({ ...result, evidencePath }, null, 2));
}

main().catch(async (error) => {
  const failure = {
    ok: false,
    model: "gpt-5.3-codex",
    error: sanitizeText(String(error?.message || error)),
    ts: nowIso(),
  };
  try {
    const evidencePath = await writeEvidence(failure);
    console.error(JSON.stringify({ ...failure, evidencePath }, null, 2));
  } catch {
    console.error(JSON.stringify(failure, null, 2));
  }
  process.exitCode = 1;
});
