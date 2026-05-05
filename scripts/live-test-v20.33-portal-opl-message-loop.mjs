import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEvidenceRecorder } from "./lib/v20.33-evidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "v20.33-portal-opl-message-loop");
const evidenceRecorder = createEvidenceRecorder({ evidenceDir, contract: "v20.33_portal_opl_message_loop" });
const requiredEnv = [
  "PORTAL_LIVE_EMAIL",
  "PORTAL_LIVE_PASSWORD",
  "OPL_LIVE_EMAIL",
  "OPL_LIVE_PASSWORD",
  "OPL_LIVE_GFLABTOKEN",
];
const LOGIN_GATEWAY_RETRY_STATUSES = new Set([502, 504]);

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function sanitizeUrl(value = "") {
  try {
    const parsed = new URL(String(value || ""));
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return String(value || "").replace(/[?#].*$/, "");
  }
}

function baseUrl(value = "") {
  return sanitizeUrl(value).replace(/\/$/, "");
}

function assertFixedHostsAndIsolatedTransport({ portalBaseUrl, oplBaseUrl }) {
  const connectHost = env("V20_33_CONNECT_HOST");
  const confirmed = boolEnv("V20_33_ISOLATED_TRANSPORT_CONFIRMED");
  const portal = new URL(portalBaseUrl);
  const opl = new URL(oplBaseUrl);
  assert.equal(portal.protocol, "https:", "portal_must_use_https");
  assert.equal(opl.protocol, "https:", "opl_must_use_https");
  assert.equal(portal.hostname, "portal.medopl.cn", "portal_host_must_be_fixed_official_host");
  assert.equal(opl.hostname, "opl.medopl.cn", "opl_host_must_be_fixed_official_host");
  assert.equal(confirmed, true, "V20_33_ISOLATED_TRANSPORT_CONFIRMED_must_be_true");
  assert(connectHost, "V20_33_CONNECT_HOST_required_for_fixed_host_isolated_transport");
}

function assertFixedHost(value = "", label = "host") {
  const parsed = new URL(value);
  assert.equal(parsed.protocol, "https:", `${label}_must_use_https`);
  if (label === "portal") {
    assert.equal(parsed.hostname, "portal.medopl.cn", "portal_host_must_be_fixed_official_host");
  }
  if (label === "opl") {
    assert.equal(parsed.hostname, "opl.medopl.cn", "opl_host_must_be_fixed_official_host");
  }
}

function sanitizeText(value = "") {
  return String(value || "")
    .replace(/\b(cookie|authorization|q-ak|x-cos-security-token|providerKey)\b[^,\n]*/gi, "$1=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[redacted]");
}

function nowIso() {
  return new Date().toISOString();
}

async function writeEvidence(payload) {
  return evidenceRecorder.writeEvidence(payload);
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

function positiveIntEnv(name, fallback) {
  const parsed = Number(env(name));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function transportOptionsFor(target, headers = {}) {
  const connectHost = env("V20_33_CONNECT_HOST");
  const connectPort = positiveIntEnv("V20_33_CONNECT_PORT", Number(target.port || (target.protocol === "https:" ? 443 : 80)));
  const allowInsecureTls = boolEnv("V20_33_ALLOW_INSECURE_TLS");
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
    req.setTimeout(options.timeoutMs || 120_000, () => req.destroy(new Error("timeout")));
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

async function verifyPortalBuildTag(portalBaseUrl, expectedBuildTag) {
  const { response, bodyText, json } = await requestJson(`${portalBaseUrl}/healthz`, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  assert(response.status >= 200 && response.status < 300, `portal_healthz_failed:${response.status}:${sanitizeText(bodyText).slice(0, 160)}`);
  const buildTag = String(json?.build?.sha || json?.buildTag || json?.version || "").trim();
  assert.equal(buildTag, expectedBuildTag, `portal_build_tag_mismatch:${buildTag || "missing"}`);
  return { buildTag, expectedBuildTag };
}

function browserLaunchOptions() {
  const connectHost = env("V20_33_CONNECT_HOST");
  const connectPort = positiveIntEnv("V20_33_CONNECT_PORT", 443);
  const proxy = env("V20_33_BROWSER_PROXY");
  const args = [];
  if (connectHost && !proxy) {
    args.push(`--host-resolver-rules=MAP portal.medopl.cn ${connectHost}:${connectPort},MAP opl.medopl.cn ${connectHost}:${connectPort}`);
  }
  return {
    headless: true,
    ...(args.length ? { args } : {}),
    ...(proxy ? { proxy: { server: proxy } } : {}),
  };
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

async function loginPortalSessionCookie(baseUrl, email, password) {
  const retries = positiveIntEnv("V20_33_LOGIN_GATEWAY_RETRIES", 3);
  let lastResult = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { response, bodyText } = await requestNodeText(`${baseUrl}/login`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password }).toString(),
    });
    const cookie = cookieFromSetCookie(response.headers["set-cookie"], "portal_session");
    if (cookie) return cookie;
    lastResult = { response, bodyText };
    if (!LOGIN_GATEWAY_RETRY_STATUSES.has(response.status) || attempt === retries) break;
    await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
  }
  throw new Error(`portal_session_cookie_missing:${lastResult?.response?.status || 0}:${sanitizeText(lastResult?.bodyText || "").slice(0, 160)}`);
}

async function getPageText(page) {
  const body = page.locator("body");
  return body.innerText({ timeout: 10_000 });
}

async function loginPortal(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const emailInput = page.locator('input[type="email"]:visible, input[name="username"]:visible, input[name="loginName"]:visible').first();
  const passwordInput = page.locator('input[type="password"]:visible').first();
  await emailInput.fill(email, { timeout: 15_000 });
  await passwordInput.fill(password, { timeout: 15_000 });
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {}),
    page.locator('button[type="submit"]:visible').first().click(),
  ]);
  await page.waitForTimeout(2_000);
}

async function loginOpl(page, baseUrl, email, password, apiKey) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(1_500);
  const bodyText = await getPageText(page).catch(() => "");
  if (/login|登录/i.test(bodyText)) {
    const loginLink = page.locator('a[href="/login"], a[href*="/auth/oidc/login"], a:has-text("登录")').first();
    if (await loginLink.count().catch(() => 0)) {
      await loginLink.click().catch(() => {});
      await page.waitForTimeout(1_500);
    }
  }
  const emailInput = page.locator('input[type="email"]:visible, input[name="email"]:visible, input[name="username"]:visible').first();
  const passwordInput = page.locator('input[type="password"]:visible').first();
  if (await emailInput.count().catch(() => 0)) {
    await emailInput.fill(email, { timeout: 15_000 });
  }
  if (await passwordInput.count().catch(() => 0)) {
    await passwordInput.fill(password, { timeout: 15_000 });
  }
  const apiKeyInput = page.locator('input[name="providerKey"], input[name="apiKey"], textarea[name="providerKey"], textarea[name="apiKey"]').first();
  if (await apiKeyInput.count().catch(() => 0)) {
    await apiKeyInput.fill(apiKey, { timeout: 15_000 });
  }
  const submit = page.locator('button[type="submit"]:visible').first();
  if (await submit.count().catch(() => 0)) {
    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {}),
      submit.click(),
    ]);
  }
  await page.waitForTimeout(2_500);
}

async function enterOplFromPortal(page, portalBaseUrl, oplBaseUrl, apiKey) {
  const response = await page.goto(`${portalBaseUrl}/portal/opl`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const status = response?.status?.() || 0;
  if (status >= 400) {
    const title = await page.title().catch(() => "");
    const body = await getPageText(page).catch(() => "");
    throw new Error(`portal_opl_launch_failed:${status}:${title}:${body.slice(0, 160)}`);
  }
  const enterTimeoutMs = positiveIntEnv("V20_33_OPL_ENTER_TIMEOUT_MS", 60_000);
  if (!page.url().startsWith(oplBaseUrl)) {
    await page.waitForURL(
      (url) => String(url.href || "").startsWith(oplBaseUrl),
      { timeout: enterTimeoutMs },
    ).catch(async (error) => {
      if (page.url().startsWith(oplBaseUrl)) return;
      const body = await getPageText(page).catch(() => "");
      throw new Error(`portal_opl_launch_did_not_reach_opl:${sanitizeUrl(page.url())}:${sanitizeText(body).slice(0, 240)}:${String(error.message || error).split("\n")[0]}`);
    });
  }
  const finalUrl = sanitizeUrl(page.url());
  if (!page.url().startsWith(oplBaseUrl)) {
    throw new Error(`portal_opl_launch_did_not_reach_opl:${finalUrl}`);
  }
  const providerPanelHandled = await handleLaunchProviderPanel(page, apiKey, { timeoutMs: 10_000 });
  if (providerPanelHandled) return { finalUrl };
  const apiKeyInput = page.locator('input[name="providerKey"], input[name="apiKey"], textarea[name="providerKey"], textarea[name="apiKey"]').first();
  if (await apiKeyInput.count().catch(() => 0)) {
    await apiKeyInput.fill(apiKey, { timeout: 15_000 });
    const submit = page.locator('button[type="submit"]:visible').first();
    if (await submit.count().catch(() => 0)) {
      await Promise.all([
        page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {}),
        submit.click(),
      ]);
      await page.waitForTimeout(2_500);
    }
  }
  return { finalUrl };
}

async function handleLaunchProviderPanel(page, apiKey, { timeoutMs = 0 } = {}) {
  const panel = page.locator("[data-opl-launch-provider-panel]").first();
  if (timeoutMs > 0) {
    await panel.waitFor({ state: "visible", timeout: timeoutMs }).catch(() => {});
  }
  if (!(await panel.count().catch(() => 0))) return false;
  if (!(await panel.isVisible().catch(() => false))) return false;
  const input = panel.locator('[data-opl-provider-key], input[name="apiKey"], textarea[name="apiKey"]').first();
  await input.fill(apiKey, { timeout: 15_000 });
  await Promise.all([
    panel.waitFor({ state: "detached", timeout: 30_000 }).catch(async () => {
      await panel.waitFor({ state: "hidden", timeout: 10_000 });
    }),
    panel.locator('button[type="submit"], button:has-text("继续"), button').first().click(),
  ]);
  return true;
}

async function findReplyLocator(page) {
  const selectors = [
    '[data-testid="assistant-reply"]',
    '[data-testid="message-reply"]',
    '[role="log"]',
    '.assistant-message',
    '.message.assistant',
    '.reply',
    'main',
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count().catch(() => 0)) return { selector, locator };
  }
  return { selector: "body", locator: page.locator("body") };
}

async function waitForOplMessageResponse(page, action) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/portal-adapter/api/opl-launch/messages") && response.request().method() === "POST",
    { timeout: 150_000 },
  );
  await action();
  const response = await responsePromise;
  const bodyText = await response.text().catch(() => "");
  let payload = null;
  try {
    payload = bodyText ? JSON.parse(bodyText) : null;
  } catch {}
  return {
    status: response.status(),
    payload,
    bodyText,
  };
}

function assertLiveMessagePayload(messageResult = {}) {
  assert(messageResult.status >= 200 && messageResult.status < 300, `opl_message_response_failed:${messageResult.status}:${sanitizeText(messageResult.bodyText || "").slice(0, 160)}`);
  const payload = messageResult.payload || {};
  const reply = String(payload.message?.reply || payload.reply || payload.response || payload.text || "").trim();
  const messageId = String(payload.message?.messageId || payload.message?.runId || payload.artifact?.messageId || "").trim();
  const artifactName = String(payload.artifact?.name || "").trim();
  assert.equal(payload.ok, true, "opl_message_response_must_be_ok");
  assert(reply, "opl_message_response_reply_missing");
  assert(messageId, "opl_message_response_message_id_missing");
  assert(artifactName, "opl_message_response_artifact_missing");
  return {
    messageId,
    artifactName,
    messageReplyPreview: sanitizeText(reply).slice(0, 160),
  };
}

if (env("RUN_V20_33_LIVE") !== "1") {
  evidenceRecorder.addStage("portal_opl_message_skip", {
    blockingUser: false,
    userVisibleState: "v20.33 Portal to OPL message loop is waiting for explicit RUN_V20_33_LIVE opt-in",
  });
  const payload = {
    ok: true,
    status: "skip",
    reason: "RUN_V20_33_LIVE_not_enabled",
  };
  payload.evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const missing = requiredEnv.filter((name) => !env(name));
if (missing.length > 0) {
  const payload = {
    ok: false,
    status: "failed",
    reason: `missing_required_env:${missing.join(",")}`,
    requiredEnv,
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exit(1);
}

let playwrightPkg = null;
try {
  playwrightPkg = await loadPlaywright();
} catch (error) {
  const payload = {
    ok: false,
    status: "failed",
    reason: sanitizeText(error instanceof Error ? error.message : String(error)),
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exit(1);
}

const { chromium } = playwrightPkg.chromium ? playwrightPkg : playwrightPkg.default;
const portalBaseUrl = baseUrl(env("V20_33_PORTAL_BASE_URL", env("PORTAL_LIVE_BASE_URL", "https://portal.medopl.cn")));
const oplBaseUrl = baseUrl(env("V20_33_OPL_BASE_URL", env("OPL_LIVE_BASE_URL", "https://opl.medopl.cn")));
const expectedBuildTag = env("V20_33_EXPECTED_BUILD_TAG", "opl-v20.33");
assertFixedHostsAndIsolatedTransport({ portalBaseUrl, oplBaseUrl });
assertFixedHost(portalBaseUrl, "portal");
assertFixedHost(oplBaseUrl, "opl");
const email = env("PORTAL_LIVE_EMAIL");
const password = env("PORTAL_LIVE_PASSWORD");
const oplEmail = env("OPL_LIVE_EMAIL");
const oplPassword = env("OPL_LIVE_PASSWORD");
const apiKey = env("OPL_LIVE_GFLABTOKEN");
const messageText = env("V20_33_LIVE_MESSAGE", "请回复：v20.33 portal->opl live gate ok");

const portalBuild = await verifyPortalBuildTag(portalBaseUrl, expectedBuildTag);
evidenceRecorder.addStage("portal_build", {
  blockingUser: false,
  userVisibleState: "Portal build tag verified before OPL message loop",
  buildTag: portalBuild.buildTag,
});
const browser = await chromium.launch(browserLaunchOptions());
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  ignoreHTTPSErrors: true,
});
const portalCookie = await loginPortalSessionCookie(portalBaseUrl, email, password);
evidenceRecorder.addStage("portal_login", {
  blockingUser: false,
  userVisibleState: "Portal session cookie established before entering OPL",
});
await context.addCookies([{
  name: portalCookie.name,
  value: portalCookie.value,
  domain: new URL(portalBaseUrl).hostname,
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
}]);
const page = await context.newPage();

const startedAt = nowIso();
const evidence = {
  host: {
    portal: portalBaseUrl,
    opl: oplBaseUrl,
  },
  portalBuild,
  startedAt,
  loginAt: "",
  messageSentAt: "",
  firstReplyAt: "",
  completeReplyAt: "",
  firstReplyLatencyMs: 0,
  completeReplyLatencyMs: 0,
  sanitizedSelectorsUsed: [],
  status: "running",
};

try {
  const oplEntry = await enterOplFromPortal(page, portalBaseUrl, oplBaseUrl, apiKey);
  evidence.oplEntry = oplEntry;
  evidenceRecorder.addStage("opl_enter", {
    blockingUser: false,
    userVisibleState: "OPL opened from Portal and provider key panel cleared",
    finalUrl: oplEntry.finalUrl,
  });
  if (!page.url().startsWith(oplBaseUrl)) {
    await loginOpl(page, oplBaseUrl, oplEmail, oplPassword, apiKey);
  }
  evidence.loginAt = nowIso();

  const messageInput = page.locator('textarea, input[type="text"], input[name="message"], input[name="prompt"]').first();
  const sendButton = page.locator([
    "button.send-button-custom",
    'button[aria-label="Send"]',
    'button[aria-label="发送"]',
    '[data-testid="send-button"]',
    'button:has-text("发送")',
    'button:has-text("Send")',
    'button[type="submit"]',
  ].join(", ")).first();
  const inputSelector = await messageInput.evaluate((el) => el.matches("textarea") ? "textarea" : el.getAttribute("name") || el.tagName.toLowerCase()).catch(() => "unknown");
  const buttonSelector = await sendButton.evaluate((el) => el.tagName.toLowerCase()).catch(() => "unknown");
  evidence.sanitizedSelectorsUsed.push(sanitizeText(`messageInput:${inputSelector}`), sanitizeText(`sendButton:${buttonSelector}`));

  await messageInput.fill(messageText, { timeout: 15_000 });
  await handleLaunchProviderPanel(page, apiKey, { timeoutMs: 3_000 });
  evidence.messageSentAt = nowIso();
  const sendStarted = Date.now();
  const messageResult = await waitForOplMessageResponse(page, async () => {
    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {}),
      sendButton.click(),
    ]);
  });
  const messageEvidence = assertLiveMessagePayload(messageResult);
  evidence.firstReplyAt = nowIso();
  evidence.completeReplyAt = evidence.firstReplyAt;
  evidence.firstReplyLatencyMs = Date.now() - sendStarted;
  evidence.completeReplyLatencyMs = evidence.firstReplyLatencyMs;
  evidenceRecorder.addStage("opl_message", {
    blockingUser: false,
    userVisibleState: "OPL returned a live adapter message reply",
    latencyMs: evidence.completeReplyLatencyMs,
    firstReplyLatencyMs: evidence.firstReplyLatencyMs,
    completeReplyLatencyMs: evidence.completeReplyLatencyMs,
  });
  evidence.status = "done";
  evidence.messageId = sanitizeText(messageEvidence.messageId);
  evidence.artifactName = sanitizeText(messageEvidence.artifactName);
  evidence.messageReplyPreview = messageEvidence.messageReplyPreview;

  assert.equal(evidence.status, "done", "opl_reply_must_be_non_empty");
  assert(evidence.firstReplyLatencyMs > 0, "first_reply_latency_must_be_positive");
  assert(evidence.completeReplyLatencyMs >= evidence.firstReplyLatencyMs, "complete_reply_latency_must_not_precede_first_reply");

  const serializedEvidence = JSON.stringify(evidence);
  assert.doesNotMatch(serializedEvidence, /cookie|authorization|q-ak|x-cos-security-token|providerKey/i, "evidence_must_not_expose_sensitive_fields");

  const payload = {
    ok: true,
    status: "live",
    evidence,
  };
  payload.evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify(payload, null, 2));
} catch (error) {
  evidence.status = "failed";
  evidence.error = sanitizeText(error instanceof Error ? error.message : String(error));
  const payload = {
    ok: false,
    status: "failed",
    evidence,
  };
  payload.evidencePath = await writeEvidence(payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}
