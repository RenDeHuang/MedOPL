import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEvidenceRecorder } from "./lib/v20.33-evidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.34-portal-component-click-matrix");
const evidenceRecorder = createEvidenceRecorder({ evidenceDir, contract: "v20.34_portal_component_click_matrix" });

const routes = Object.freeze([
  { path: "/overview", requiredText: "总览" },
  { path: "/packages", requiredText: "套餐" },
  { path: "/resources", requiredText: "我的资源" },
  { path: "/workspace", requiredText: "工作空间" },
  { path: "/billing", requiredText: "账单" },
  { path: "/trace", requiredText: "轨迹" },
  { path: "/admin/dashboard", requiredText: "运营总台" },
  { path: "/admin/users", requiredText: "用户管理" },
  { path: "/admin/billing-ops", requiredText: "客户账务" },
  { path: "/admin/usage", requiredText: "账单归因" },
  { path: "/admin/alerts", requiredText: "告警中心" },
  { path: "/admin/trace", requiredText: "轨迹" },
  { path: "/admin/system", requiredText: "系统状态" },
  { path: "/admin/ops", requiredText: "云资源状态" },
  { path: "/admin/audit", requiredText: "审计" },
]);

const dangerousTextPattern = /删除|销毁|停费|充值|退款|禁用|启用|开通|升级|扩容|创建|归档|恢复|提交|保存|发布|下线|上线|置顶|更多/i;
const mutatingTagPattern = /form|submit|danger|primary/i;

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

function transportOptionsFor(target, headers = {}) {
  const connectHost = env("V20_34_CONNECT_HOST", env("V20_33_CONNECT_HOST"));
  const connectPort = positiveIntEnv("V20_34_CONNECT_PORT", Number(target.port || (target.protocol === "https:" ? 443 : 80)));
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
    rejectUnauthorized: !boolEnv("V20_34_ALLOW_INSECURE_TLS") && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
    servername: target.hostname,
  };
}

async function requestNodeText(url, options = {}) {
  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  const startedAt = Date.now();
  const transportOptions = transportOptionsFor(target, options.headers || {});
  return new Promise((resolve, reject) => {
    const req = transport.request({
      ...transportOptions.requestTarget,
      method: options.method || "GET",
      headers: transportOptions.headers,
      rejectUnauthorized: transportOptions.rejectUnauthorized,
      servername: transportOptions.servername,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => resolve({
        status: res.statusCode || 0,
        headers: res.headers,
        bodyText: Buffer.concat(chunks).toString("utf8"),
        latencyMs: Date.now() - startedAt,
      }));
    });
    req.on("error", reject);
    req.setTimeout(options.timeoutMs || 90_000, () => req.destroy(new Error("timeout")));
    if (options.body) req.write(options.body);
    req.end();
  });
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

function browserLaunchOptions() {
  const connectHost = env("V20_34_CONNECT_HOST", env("V20_33_CONNECT_HOST"));
  const connectPort = positiveIntEnv("V20_34_CONNECT_PORT", 443);
  const proxy = env("V20_34_BROWSER_PROXY", env("V20_33_BROWSER_PROXY"));
  const args = [];
  if (connectHost && !proxy) args.push(`--host-resolver-rules=MAP portal.medopl.cn ${connectHost}:${connectPort}`);
  return {
    headless: true,
    ...(args.length ? { args } : {}),
    ...(proxy ? { proxy: { server: proxy } } : {}),
  };
}

async function loginPortalBrowser(context, config) {
  const page = await context.newPage();
  try {
    await page.goto(`${config.portalBaseUrl}/login`, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
    await page.locator('input[type="email"], input[name="email"], input[name="username"]').first().fill(config.email, { timeout: 15_000 });
    await page.locator('input[type="password"]').first().fill(config.password, { timeout: 15_000 });
    await Promise.all([
      page.waitForURL((url) => String(url.pathname || "").startsWith("/portal/app"), { timeout: 30_000 }).catch(() => {}),
      page.locator('button[type="submit"], button:has-text("登录")').first().click({ timeout: 15_000 }),
    ]);
    await page.goto(`${config.portalBaseUrl}/portal/app/overview`, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
    await page.waitForFunction(() => String(document.body?.innerText || "").includes("MedOPL"), null, { timeout: 15_000 });
    return true;
  } finally {
    await page.close().catch(() => {});
  }
}

async function waitForRouteReady(page, route, timeoutMs) {
  await page.locator("body").waitFor({ state: "visible", timeout: Math.min(timeoutMs, 10_000) });
  await page.waitForFunction(
    (requiredText) => String(document.body?.innerText || "").includes(requiredText),
    route.requiredText,
    { timeout: Math.min(timeoutMs, 20_000) },
  );
}

async function interactiveControls(page) {
  return page.evaluate(() => {
    const selectorFor = (node, idx) => {
      if (node.id) return `#${CSS.escape(node.id)}`;
      const label = String(node.textContent || node.getAttribute("aria-label") || "").trim();
      const tagName = String(node.tagName || "").toLowerCase();
      if (tagName === "button" && label) return `button:has-text("${label.replace(/"/g, '\\"').slice(0, 60)}")`;
      if (tagName === "a" && label) return `a:has-text("${label.replace(/"/g, '\\"').slice(0, 60)}")`;
      return `${tagName}:nth-of-type(${idx + 1})`;
    };
    const nodes = Array.from(document.querySelectorAll("button,[role='button'],a[href],summary,select,input[type='checkbox'],input[type='radio']"));
    return nodes.map((node, idx) => ({
      selector: selectorFor(node, idx),
      tagName: String(node.tagName || "").toLowerCase(),
      text: String(node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
      ariaLabel: String(node.getAttribute("aria-label") || "").trim(),
      href: String(node.getAttribute("href") || "").trim(),
      type: String(node.getAttribute("type") || "").trim(),
      disabled: Boolean(node.disabled || node.getAttribute("aria-disabled") === "true"),
      className: String(node.className || ""),
    }));
  });
}

function controlRisk(control = {}) {
  const probe = `${control.text} ${control.ariaLabel} ${control.href} ${control.type} ${control.className}`;
  if (dangerousTextPattern.test(probe)) return "dangerous_or_billing";
  if (control.type === "submit" || mutatingTagPattern.test(probe)) return "mutation_candidate";
  return "read_only";
}

async function clickControl(page, control, config) {
  if (control.disabled) return { attempted: false, result: "disabled" };
  const risk = controlRisk(control);
  try {
    let dialogSeen = false;
    page.once("dialog", async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss().catch(() => {});
    });
    await page.locator(control.selector).first().click({ timeout: config.clickTimeoutMs, noWaitAfter: true });
    await page.waitForTimeout(200);
    return {
      attempted: true,
      result: risk === "dangerous_or_billing" && dialogSeen ? "confirmation_dismissed" : "clicked",
      risk,
      confirmationBoundary: risk === "dangerous_or_billing" ? "二次确认已触发并取消" : "",
      url: sanitizeUrl(page.url()),
    };
  } catch (error) {
    return { attempted: true, result: "click_failed", risk, error: sanitizeText(String(error.message || error)).split("\n")[0] };
  }
}

async function routeClickMatrix(page, route, config) {
  await page.goto(`/portal/app${route.path}`, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
  await waitForRouteReady(page, route, config.timeoutMs);
  const controls = await interactiveControls(page);
  const results = [];
  for (const control of controls) {
    const beforeUrl = page.url();
    const click = await clickControl(page, control, config);
    results.push({
      control: {
        tagName: control.tagName,
        text: control.text || control.ariaLabel || control.href || control.selector,
        disabled: control.disabled,
      },
      ...click,
    });
    if (sanitizeUrl(page.url()) !== sanitizeUrl(beforeUrl)) {
      await page.goto(`/portal/app${route.path}`, { waitUntil: "domcontentloaded", timeout: config.timeoutMs }).catch(() => {});
      await waitForRouteReady(page, route, config.timeoutMs).catch(() => {});
    }
  }
  return {
    path: route.path,
    requiredText: route.requiredText,
    controlCount: controls.length,
    clickedCount: results.filter((item) => item.result === "clicked").length,
    confirmationBoundaryCount: results.filter((item) => item.result === "confirmation_dismissed").length,
    disabledCount: results.filter((item) => item.result === "disabled").length,
    failedCount: results.filter((item) => item.result === "click_failed").length,
    results,
  };
}

async function writeEvidence(payload) {
  return evidenceRecorder.writeEvidence(payload);
}

async function main() {
  const config = {
    portalBaseUrl: baseUrl("V20_34_PORTAL_BASE_URL", env("V20_33_PORTAL_BASE_URL", "https://portal.medopl.cn")),
    email: env("V20_34_PORTAL_EMAIL", env("V20_33_PORTAL_EMAIL", env("PORTAL_ADMIN_EMAIL"))),
    password: env("V20_34_PORTAL_PASSWORD", env("V20_33_PORTAL_PASSWORD", env("PORTAL_ADMIN_PASSWORD"))),
    timeoutMs: positiveIntEnv("V20_34_COMPONENT_CLICK_TIMEOUT_MS", 60_000),
    clickTimeoutMs: positiveIntEnv("V20_34_COMPONENT_CLICK_CONTROL_TIMEOUT_MS", 2_000),
    exerciseConfirmationBoundary: true,
  };

  assert.equal(new URL(config.portalBaseUrl).hostname, "portal.medopl.cn", "portal_host_must_be_official");
  const dryRun = boolEnv("RUN_V20_34_COMPONENT_CLICK_DRY_RUN");
  if (env("RUN_V20_34_COMPONENT_CLICK_MATRIX") !== "1") {
    const payload = {
      ok: dryRun,
      skipped: true,
      reason: "missing_required_env_or_gate_closed",
      requiredEnv: dryRun ? "RUN_V20_34_COMPONENT_CLICK_MATRIX=1" : "RUN_V20_34_COMPONENT_CLICK_MATRIX=1 或 RUN_V20_34_COMPONENT_CLICK_DRY_RUN=1",
      routes: routes.map((route) => route.path),
      evidencePolicy: "live run writes .runtime/v20.34-portal-component-click-matrix/*.json",
    };
    const evidencePath = await writeEvidence(payload);
    console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
    if (!dryRun) process.exitCode = 1;
    return;
  }
  if (!config.email || !config.password) {
    throw new Error("missing_V20_34_PORTAL_EMAIL_or_V20_34_PORTAL_PASSWORD");
  }

  const login = await loginPortalSessionCookie(config.portalBaseUrl, config.email, config.password);
  const playwrightPkg = await loadPlaywright();
  const { chromium } = playwrightPkg.chromium ? playwrightPkg : playwrightPkg.default;
  const browser = await chromium.launch(browserLaunchOptions());
  const context = await browser.newContext({
    baseURL: config.portalBaseUrl,
    ignoreHTTPSErrors: boolEnv("V20_34_ALLOW_INSECURE_TLS"),
  });
  await loginPortalBrowser(context, config);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(sanitizeText(msg.text()).slice(0, 300));
  });
  page.on("pageerror", (error) => pageErrors.push(sanitizeText(String(error.message || error))));
  const matrix = [];
  try {
    for (const route of routes) matrix.push(await routeClickMatrix(page, route, config));
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const failedRoutes = matrix.filter((item) => item.failedCount > 0 || item.controlCount === 0);
  const payload = {
    ok: failedRoutes.length === 0 && consoleErrors.length === 0 && pageErrors.length === 0,
    skipped: false,
    login: { status: login.status, latencyMs: login.latencyMs },
    host: sanitizeUrl(config.portalBaseUrl),
    exerciseConfirmationBoundary: config.exerciseConfirmationBoundary,
    routeCount: routes.length,
    failedRoutes,
    consoleErrors,
    pageErrors,
    matrix,
  };
  const evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
  if (!payload.ok) process.exitCode = 1;
}

main().catch(async (error) => {
  const payload = {
    ok: false,
    error: sanitizeText(String(error.message || error)),
  };
  const evidencePath = await writeEvidence(payload).catch(() => "");
  console.error(JSON.stringify({ ...payload, evidencePath }, null, 2));
  process.exitCode = 1;
});
