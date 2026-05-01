import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loginPortalOidc } from "./lib/portal-oidc-playwright.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  assert(value, `${name}_required`);
  return value;
}

function optionalEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

function prepareTraceEnabled() {
  return String(process.env.PORTAL_RECOVERY_PREPARE_TRACE || "").trim() === "1";
}

function traceStep(label, details = {}) {
  if (!prepareTraceEnabled()) return;
  const safeDetails = Object.fromEntries(
    Object.entries(details)
      .filter(([key]) => !/password|secret|token|authorization|cookie/i.test(key))
      .map(([key, value]) => [key, value]),
  );
  console.error(JSON.stringify({
    event: "portal_recovery_prepare_step",
    label,
    ...safeDetails,
  }));
}

function summarizeStatus(status, bodyText = "") {
  return `${status}:${String(bodyText || "").slice(0, 240)}`;
}

function splitSetCookie(headerValue = "") {
  return String(headerValue || "")
    .split(/,\s*(?=[^ ;]+=)/)
    .map((item) => item.split(";")[0]?.trim() || "")
    .filter(Boolean);
}

function cookieHeaderFromSetCookie(headerValue, names = []) {
  const cookies = splitSetCookie(headerValue);
  const filtered = names.length
    ? cookies.filter((cookie) => names.some((name) => cookie.startsWith(`${name}=`)))
    : cookies;
  return filtered.join("; ");
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

function randomPassword() {
  return `T${randomBytes(12).toString("base64url")}9!a`;
}

function nowStamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function normalizeCookieHeader(cookies = []) {
  return cookies.map((item) => `${item.name}=${item.value}`).join("; ");
}

async function loadPlaywright() {
  const repoRoot = process.cwd();
  const candidates = [
    process.env.PLAYWRIGHT_ENTRY,
    path.join(repoRoot, ".runtime", "browser-test", "node_modules", "playwright", "index.js"),
    path.join(repoRoot, "node_modules", "playwright", "index.js"),
    path.join(process.env.HOME || "", ".codex", "skills", "gstack", "browse", "node_modules", "playwright", "index.js"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const mod = await import(pathToFileURL(candidate).href);
      return mod.default || mod;
    } catch {}
  }
  throw new Error(`playwright_not_found:${candidates.join(",")}`);
}

async function loginLocal({ baseUrl, email, password, timeoutMs }) {
  const body = new URLSearchParams({ email, password }).toString();
  const { response, bodyText } = await requestNodeText(`${baseUrl}/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(Buffer.byteLength(body)),
    },
    body,
    timeoutMs,
  });
  const cookie = extractCookie(response.headers["set-cookie"], "portal_session");
  assert(response.status === 302, `portal_local_login_failed:${summarizeStatus(response.status, bodyText)}`);
  assert(cookie.includes("portal_session="), "portal_session_cookie_missing_after_local_login");
  return cookie;
}

async function loginOidc({ baseUrl, email, password, timeoutMs }) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_BIN || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 960 },
    });
    const page = await context.newPage();
    await loginPortalOidc(page, { baseUrl, email, password, timeoutMs });
    await page.waitForURL((url) => url.href.startsWith(`${baseUrl}/portal`), { timeout: timeoutMs });
    const cookies = await context.cookies(baseUrl);
    const cookieHeader = normalizeCookieHeader(cookies.filter((item) => item.name === "portal_session"));
    assert(cookieHeader.includes("portal_session="), "portal_session_cookie_missing_after_oidc_login");
    return cookieHeader;
  } finally {
    await browser.close();
  }
}

async function createPortalSessionCookie({ baseUrl, loginMode, email, password, timeoutMs }) {
  if (loginMode === "local") return loginLocal({ baseUrl, email, password, timeoutMs });
  if (loginMode === "oidc") return loginOidc({ baseUrl, email, password, timeoutMs });
  throw new Error(`unsupported_login_mode:${loginMode}`);
}

async function requestText(url, options = {}) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs || 120_000),
      ...options,
    });
    const bodyText = await response.text();
    return { response, bodyText };
  } catch (error) {
    throw new Error(`request_failed:${url}:${String(error.message || error)}`);
  }
}

async function requestNodeText(url, options = {}) {
  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  const timeoutMs = options.timeoutMs || 120_000;
  return new Promise((resolve, reject) => {
    const req = transport.request(target, {
      method: options.method || "GET",
      headers: options.headers || {},
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
    }, (res) => {
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
    req.on("error", (error) => reject(new Error(`request_failed:${url}:${String(error.message || error)}`)));
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function requestJson(url, options = {}) {
  const { response, bodyText } = await requestText(url, options);
  let json = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {}
  return { response, bodyText, json };
}

async function apiJson(config, pathname, cookie, options = {}) {
  const url = `${config.baseUrl}${pathname}`;
  const method = options.method || "GET";
  const headers = {
    accept: "application/json",
    ...(cookie ? { cookie } : {}),
    ...(options.headers || {}),
  };
  if (options.body != null && !headers["content-length"]) {
    headers["content-length"] = String(Buffer.byteLength(String(options.body)));
  }
  if (method !== "GET" || options.body != null) {
    const { response, bodyText } = await requestNodeText(url, {
      method,
      headers,
      body: options.body,
      timeoutMs: options.timeoutMs,
    });
    let json = null;
    try {
      json = bodyText ? JSON.parse(bodyText) : null;
    } catch {}
    assert(response.status >= 200 && response.status < 300, `portal_api_failed:${pathname}:${summarizeStatus(response.status, bodyText)}`);
    return json;
  }

  const { response, bodyText, json } = await requestJson(url, {
    headers,
    method,
    body: options.body,
    timeoutMs: options.timeoutMs,
  });
  assert(response.status >= 200 && response.status < 300, `portal_api_failed:${pathname}:${summarizeStatus(response.status, bodyText)}`);
  return json;
}

async function postForm(config, pathname, cookie, form) {
  const body = new URLSearchParams(form).toString();
  return requestNodeText(`${config.baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(Buffer.byteLength(body)),
      ...(cookie ? { cookie } : {}),
    },
    body,
    timeoutMs: 120_000,
  });
}

function assertTestScopedEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  assert(normalized.startsWith("test-"), `fixture_email_must_start_with_test_prefix:${normalized}`);
  assert(normalized.endsWith("@example.test"), `fixture_email_must_use_example_test_domain:${normalized}`);
  return normalized;
}

function assertTestScopedWorkspaceId(workspaceId) {
  const normalized = String(workspaceId || "").trim().toLowerCase();
  assert(normalized.startsWith("test-"), `fixture_workspace_must_start_with_test_prefix:${normalized}`);
  return normalized;
}

function makeFixtureIdentity() {
  const stamp = Date.now().toString(36);
  const shortId = randomBytes(3).toString("hex");
  const slug = `test-v19-${stamp}-${shortId}`.slice(0, 40);
  const email = `test-${slug}@example.test`;
  return {
    slug,
    email,
    name: `test ${slug}`,
    password: randomPassword(),
    fileRelativePath: `fixtures/${slug}/input.txt`,
    fileContents: [
      "portal recovery fixture",
      `slug=${slug}`,
      `createdAt=${new Date().toISOString()}`,
    ].join("\n"),
  };
}

async function ensureAdminSession(config) {
  return createPortalSessionCookie({
    baseUrl: config.baseUrl,
    loginMode: config.adminLoginMode,
    email: config.adminEmail,
    password: config.adminPassword,
    timeoutMs: config.loginTimeoutMs,
  });
}

async function createPortalUserViaAdmin(config, adminCookie, fixture) {
  const { response, bodyText } = await postForm(config, "/portal/admin/create-user", adminCookie, {
    redirectTo: "/portal/app/admin/users",
    email: fixture.email,
    name: fixture.name,
    password: fixture.password,
    role: "user",
    status: "active",
  });
  if (response.status === 302) return { ok: true };
  if (response.status === 502) {
    throw new Error(`oidc_identity_admin_blocked:${summarizeStatus(response.status, bodyText)}`);
  }
  if (response.status === 400 || response.status === 409) {
    throw new Error(`portal_create_user_rejected:${summarizeStatus(response.status, bodyText)}`);
  }
  throw new Error(`portal_create_user_failed:${summarizeStatus(response.status, bodyText)}`);
}

async function findAdminUser(config, adminCookie, email) {
  const payload = await apiJson(
    config,
    `/portal/api/admin/users?page_size=500&email=${encodeURIComponent(email)}`,
    adminCookie,
  );
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const found = items.find((item) => String(item.email || "").toLowerCase() === String(email || "").toLowerCase());
  assert(found, `created_user_not_visible_in_admin_api:${email}`);
  return found;
}

async function rechargePortalUser(config, adminCookie, userId, amount) {
  const { response, bodyText } = await postForm(config, "/portal/admin/recharge", adminCookie, {
    redirectTo: "/portal/app/admin/users",
    userId,
    amount: String(amount),
  });
  assert(response.status === 302, `portal_admin_recharge_failed:${summarizeStatus(response.status, bodyText)}`);
}

async function createStorageOrder(config, userCookie, workspaceId, storageSizeGb) {
  const payload = await apiJson(config, "/portal/api/storage/orders", userCookie, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      storageSizeGb,
      storagePlanId: `cos-${storageSizeGb}gb`,
    }),
  });
  assert(payload?.order?.workspaceId === workspaceId, `storage_order_workspace_mismatch:${stableJson(payload)}`);
  assert(payload?.entitlement?.enabled === true, `storage_order_entitlement_not_enabled:${stableJson({
    workspaceId,
    orderStatus: payload?.order?.status || "",
    orderWorkspaceId: payload?.order?.workspaceId || "",
    entitlement: payload?.entitlement || null,
  })}`);
  return payload;
}

async function assertStorageEntitlement(config, userCookie, workspaceId) {
  const payload = await apiJson(
    config,
    `/portal/api/storage/entitlement?workspaceId=${encodeURIComponent(workspaceId)}`,
    userCookie,
  );
  assert(payload?.workspaceId === workspaceId, `storage_entitlement_workspace_mismatch:${stableJson(payload)}`);
  assert(payload?.entitlement?.enabled === true, `storage_entitlement_not_enabled:${stableJson({
    workspaceId,
    entitlement: payload?.entitlement || null,
  })}`);
  return payload;
}

function multipartBody(boundary, fields = [], file = null) {
  const chunks = [];
  for (const [name, value] of fields) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, "utf8"));
  }
  if (file) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName || "file"}"; filename="${file.fileName}"\r\nContent-Type: ${file.contentType}\r\n\r\n`, "utf8"));
    chunks.push(Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer || "", "utf8"));
    chunks.push(Buffer.from("\r\n", "utf8"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  return Buffer.concat(chunks);
}

async function uploadWorkspaceFile(config, userCookie, workspaceId, fixture) {
  const uploadUrl = await apiJson(config, "/portal/api/workspace/files/upload-url", userCookie, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      kind: "inputs",
      relativePath: fixture.fileRelativePath,
      fileName: path.basename(fixture.fileRelativePath),
    }),
  });
  const boundary = `----portal-recovery-${randomBytes(8).toString("hex")}`;
  const body = multipartBody(boundary, [], {
    fileName: path.basename(fixture.fileRelativePath),
    contentType: "text/plain; charset=utf-8",
    buffer: Buffer.from(fixture.fileContents, "utf8"),
  });
  const { response, bodyText, json } = await requestJson(`${config.baseUrl}${uploadUrl.url}`, {
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      cookie: userCookie,
    },
    body,
  });
  assert(response.status === 200, `portal_signed_upload_failed:${summarizeStatus(response.status, bodyText)}`);
  assert(String(json?.file?.relativePath || "") === fixture.fileRelativePath, `workspace_file_relative_path_mismatch:${stableJson(json)}`);
  return json;
}

function chooseSalableServerPlan(payload, preferredPlanId = "") {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (preferredPlanId) {
    const matched = items.find((item) => String(item.id || "") === preferredPlanId);
    assert(matched, `preferred_server_plan_not_found:${preferredPlanId}`);
    assert(matched.salable === true, `preferred_server_plan_not_salable:${preferredPlanId}`);
    return matched;
  }
  const salable = items.filter((item) => item?.salable === true);
  assert(salable.length > 0, "salable_server_plan_missing");
  return salable[0];
}

async function selectServerPlan(config, userCookie, workspaceId, planId) {
  await apiJson(config, "/portal/api/server-plans/select", userCookie, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      task: workspaceId,
      planId,
    }),
  });
}

async function createFrozenOrder(config, userCookie, workspaceId, plan) {
  const quote = await apiJson(config, "/portal/api/resource-orders/quote", userCookie, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      task: workspaceId,
      serverPlanId: plan.id,
      storagePlanId: "workspace-default",
      storageSizeGb: config.storageSizeGb,
      estimatedHours: 1,
    }),
  });
  const resourceOrderId = String(quote?.resourceOrderId || quote?.order?.id || "");
  assert(resourceOrderId, `quoted_resource_order_id_missing:${stableJson(quote)}`);
  const freeze = await apiJson(config, "/portal/api/resource-orders/freeze", userCookie, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      resourceOrderId,
    }),
  });
  assert(String(freeze?.order?.status || freeze?.status || "").toLowerCase() === "frozen", `resource_order_not_frozen:${stableJson(freeze)}`);
  return freeze;
}

async function createLaunchTrace(config, userCookie, workspaceId) {
  const payload = await apiJson(config, "/portal/api/opl/launch", userCookie, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task: workspaceId }),
    timeoutMs: 60_000,
  });
  assert(payload?.launchToken, `opl_launch_token_missing:${stableJson(payload)}`);
  assert(String(payload?.workspace?.slug || payload?.workspaceId || workspaceId) === workspaceId, `opl_launch_workspace_mismatch:${stableJson(payload)}`);
  return payload;
}

async function traceAdapterTraceAvailability(launchPayload = {}, workspaceId = "", userId = "") {
  if (!prepareTraceEnabled()) return;
  const adapterUrl = String(
    launchPayload?.launch?.portalAdapterUrl ||
    launchPayload?.portalAdapterUrl ||
    "",
  ).replace(/\/$/, "");
  if (!adapterUrl) {
    traceStep("adapter_trace_probe_skipped", { reason: "adapter_url_missing", workspaceId });
    return;
  }
  try {
    const { response, bodyText, json } = await requestJson(`${adapterUrl}/api/trace-links`, {
      timeoutMs: 20_000,
    });
    const items = Array.isArray(json?.items) ? json.items : [];
    traceStep("adapter_trace_probe", {
      workspaceId,
      userId,
      status: response.status,
      traceCount: items.filter((item) => String(item.workspaceId || "") === workspaceId).length,
      userTraceCount: items.filter((item) => String(item.portalUserId || "") === userId).length,
      workspaceUserTraceCount: items.filter((item) =>
        String(item.workspaceId || "") === workspaceId && String(item.portalUserId || "") === userId
      ).length,
      totalTraceCount: items.length,
      bodySize: bodyText.length,
    });
  } catch (error) {
    traceStep("adapter_trace_probe_failed", { workspaceId, error: String(error.message || error).slice(0, 500) });
  }
}

async function poll(config, task, label) {
  const deadline = Date.now() + config.pollTimeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      return await task();
    } catch (error) {
      lastError = String(error.message || error);
      traceStep(`${label}_poll_retry`, { error: lastError.slice(0, 500) });
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollMs));
  }
  throw new Error(`${label}_timeout:${lastError}`);
}

async function collectFixtureState(config, userCookie, workspaceId) {
  const [me, billing, workspaceStorage, orders, sessions, traces] = await Promise.all([
    apiJson(config, "/portal/api/me", userCookie),
    apiJson(config, "/portal/api/billing", userCookie),
    apiJson(config, `/portal/api/workspace/storage?task=${encodeURIComponent(workspaceId)}`, userCookie),
    apiJson(config, "/portal/api/resource-orders", userCookie),
    apiJson(config, "/portal/api/sessions?page_size=200", userCookie),
    apiJson(config, `/portal/api/session-traces?workspaceId=${encodeURIComponent(workspaceId)}&page_size=200`, userCookie, { timeoutMs: 60_000 }),
  ]);
  return { me, billing, workspaceStorage, orders, sessions, traces };
}

function resolvePreparedIdentifiers(state, workspaceId, relativePath, workspaceSessionId = "") {
  const order = (state.orders?.items || []).find((item) => String(item.workspaceId || "") === workspaceId);
  assert(order, `prepared_resource_order_missing:${workspaceId}`);
  const file = (state.workspaceStorage?.metadata || []).find((item) => String(item.relativePath || "") === relativePath);
  assert(file, `prepared_workspace_file_missing:${relativePath}`);
  const traces = (state.traces?.items || []).filter((item) => String(item.workspaceId || "") === workspaceId);
  const trace = workspaceSessionId
    ? traces.find((item) =>
        String(item.workspaceSessionId || "") === workspaceSessionId ||
        String(item.sessionId || "") === workspaceSessionId ||
        String(item.runtimeSessionId || "") === workspaceSessionId
      )
    : traces[0];
  assert(trace, `prepared_trace_missing:${workspaceId}`);
  const sessions = Array.isArray(state.sessions?.sessions) ? state.sessions.sessions : [];
  const session = workspaceSessionId
    ? sessions.find((item) => String(item.workspaceSessionId || item.sessionId || "") === workspaceSessionId)
    : sessions.find((item) => String(item.workspaceId || "") === workspaceId);
  assert(session, `prepared_workspace_session_missing:${workspaceId}`);
  return {
    resourceOrderId: String(order.id || order.resourceOrderId || ""),
    fileRelativePath: String(file.relativePath || ""),
    traceSessionId: String(trace.sessionId || trace.workspaceSessionId || trace.runId || ""),
    workspaceSessionId: String(session.workspaceSessionId || session.sessionId || ""),
  };
}

async function writeFixtureFile(config, fixture, prepared, state) {
  const runtimeDir = path.join(process.cwd(), ".runtime", "portal", "live-recovery-fixtures");
  await mkdir(runtimeDir, { recursive: true });
  const filePath = path.join(runtimeDir, `${fixture.slug}.json`);
  const secretPath = path.join(runtimeDir, `${fixture.slug}.password`);
  await writeFile(secretPath, `${fixture.password}\n`, "utf8");
  const payload = {
    createdAt: new Date().toISOString(),
    mode: "portal_restart_recovery_fixture",
    loginMode: config.userLoginMode,
    env: {
      PORTAL_BASE_URL: config.baseUrl,
      PORTAL_TEST_LOGIN: config.userLoginMode,
      PORTAL_RECOVERY_USER_EMAIL: fixture.email,
      PORTAL_RECOVERY_WORKSPACE_ID: prepared.workspaceId,
      PORTAL_RECOVERY_RESOURCE_ORDER_ID: prepared.resourceOrderId,
      PORTAL_RECOVERY_FILE_RELATIVE_PATH: prepared.fileRelativePath,
      PORTAL_RECOVERY_TRACE_SESSION_ID: prepared.traceSessionId,
      PORTAL_RECOVERY_WORKSPACE_SESSION_ID: prepared.workspaceSessionId,
    },
    secretFiles: {
      PORTAL_RECOVERY_USER_PASSWORD: secretPath,
    },
    prepared: {
      userId: String(state.me?.id || ""),
      userEmail: fixture.email,
      workspaceId: prepared.workspaceId,
      resourceOrderId: prepared.resourceOrderId,
      fileRelativePath: prepared.fileRelativePath,
      traceSessionId: prepared.traceSessionId,
      workspaceSessionId: prepared.workspaceSessionId,
      walletBalance: Number(state.billing?.wallet?.balance || 0),
      traceCount: Array.isArray(state.traces?.items) ? state.traces.items.length : 0,
    },
  };
  await writeFile(filePath, `${stableJson(payload)}\n`, "utf8");
  return { filePath, secretPath, payload };
}

function buildConfig() {
  assert(String(process.env.RUN_PORTAL_RECOVERY_LIVE || "").trim() === "1", "RUN_PORTAL_RECOVERY_LIVE_must_equal_1");
  return {
    baseUrl: trimTrailingSlash(optionalEnv("PORTAL_BASE_URL", "https://portal.medopl.cn")),
    adminLoginMode: optionalEnv("PORTAL_ADMIN_LOGIN_MODE", optionalEnv("PORTAL_TEST_LOGIN", "oidc")).toLowerCase(),
    userLoginMode: optionalEnv("PORTAL_TEST_LOGIN", "oidc").toLowerCase(),
    adminEmail: requiredEnv("PORTAL_ADMIN_EMAIL"),
    adminPassword: requiredEnv("PORTAL_ADMIN_PASSWORD"),
    loginTimeoutMs: positiveInt(process.env.PORTAL_RECOVERY_LOGIN_TIMEOUT_MS, 120_000),
    storageSizeGb: positiveInt(process.env.PORTAL_RECOVERY_STORAGE_SIZE_GB, 10),
    rechargeAmount: positiveInt(process.env.PORTAL_RECOVERY_RECHARGE_AMOUNT, 1000),
    preferredServerPlanId: optionalEnv("PORTAL_RECOVERY_SERVER_PLAN_ID"),
    pollMs: positiveInt(process.env.PORTAL_RECOVERY_POLL_MS, 3_000),
    pollTimeoutMs: positiveInt(process.env.PORTAL_RECOVERY_PREPARE_TIMEOUT_MS, 180_000),
  };
}

async function main() {
  const config = buildConfig();
  const fixture = makeFixtureIdentity();
  fixture.email = assertTestScopedEmail(fixture.email);
  traceStep("fixture_identity_created", { email: fixture.email, workspaceId: fixture.slug });
  const adminCookie = await ensureAdminSession(config);
  traceStep("admin_session_ready", { loginMode: config.adminLoginMode });
  await createPortalUserViaAdmin(config, adminCookie, fixture);
  traceStep("portal_user_created", { email: fixture.email });
  const createdUser = await findAdminUser(config, adminCookie, fixture.email);
  traceStep("portal_user_visible", { userId: createdUser.id, email: fixture.email });
  await rechargePortalUser(config, adminCookie, createdUser.id, config.rechargeAmount);
  traceStep("portal_user_recharged", { userId: createdUser.id, amount: config.rechargeAmount });

  const userCookie = await createPortalSessionCookie({
    baseUrl: config.baseUrl,
    loginMode: config.userLoginMode,
    email: fixture.email,
    password: fixture.password,
    timeoutMs: config.loginTimeoutMs,
  });
  traceStep("user_session_ready", { email: fixture.email, loginMode: config.userLoginMode });
  const me = await apiJson(config, "/portal/api/me", userCookie);
  assert(String(me?.email || "").toLowerCase() === fixture.email, `prepared_user_login_identity_mismatch:${stableJson(me)}`);
  traceStep("user_identity_verified", { userId: me?.id || "", email: fixture.email });

  const workspaceId = assertTestScopedWorkspaceId(fixture.slug);
  const storageOrderPayload = await createStorageOrder(config, userCookie, workspaceId, config.storageSizeGb);
  const storageEntitlementPayload = await assertStorageEntitlement(config, userCookie, workspaceId);
  traceStep("storage_order_created", {
    workspaceId,
    storageSizeGb: config.storageSizeGb,
    orderStatus: storageOrderPayload.order?.status || "",
    entitlementEnabled: storageEntitlementPayload.entitlement?.enabled === true,
  });
  await uploadWorkspaceFile(config, userCookie, workspaceId, fixture);
  traceStep("workspace_file_uploaded", { workspaceId, relativePath: fixture.fileRelativePath });

  const serverPlans = await apiJson(config, `/portal/api/server-plans?task=${encodeURIComponent(workspaceId)}`, userCookie);
  const selectedPlan = chooseSalableServerPlan(serverPlans, config.preferredServerPlanId);
  traceStep("server_plan_selected", { workspaceId, serverPlanId: selectedPlan.id });
  await selectServerPlan(config, userCookie, workspaceId, selectedPlan.id);
  traceStep("server_plan_saved", { workspaceId, serverPlanId: selectedPlan.id });
  const frozenOrder = await createFrozenOrder(config, userCookie, workspaceId, selectedPlan);
  traceStep("resource_order_frozen", { workspaceId, resourceOrderId: frozenOrder?.order?.id || frozenOrder?.resourceOrderId || "" });
  const launch = await createLaunchTrace(config, userCookie, workspaceId);
  traceStep("opl_launch_created", { workspaceId });
  await traceAdapterTraceAvailability(launch, workspaceId, String(me?.id || ""));

  const workspaceSessionId = String(
    launch?.workspaceSession?.id ||
    launch?.workspaceSession?.workspaceSessionId ||
    "",
  );
  const state = await poll(config, async () => {
    traceStep("fixture_state_poll", { workspaceId, workspaceSessionId });
    const snapshot = await collectFixtureState(config, userCookie, workspaceId);
    const prepared = resolvePreparedIdentifiers(snapshot, workspaceId, fixture.fileRelativePath, workspaceSessionId);
    return { snapshot, prepared };
  }, "portal_fixture_prepare");

  const stored = await writeFixtureFile(config, fixture, { ...state.prepared, workspaceId }, state.snapshot);
  traceStep("fixture_file_written", { fixtureFile: stored.filePath, workspaceId });
  const preview = { ...stored.payload.env, PORTAL_RECOVERY_USER_PASSWORD: "***redacted***" };

  console.log(JSON.stringify({
    ok: true,
    fixtureFile: stored.filePath,
    passwordFile: stored.secretPath,
    user: {
      id: createdUser.id,
      email: fixture.email,
    },
    workspaceId,
    resourceOrderStatus: String(frozenOrder?.order?.status || ""),
    serverPlanId: selectedPlan.id,
    previewEnv: preview,
    nextCommand: `RUN_PORTAL_RECOVERY_LIVE=1 PORTAL_RECOVERY_FIXTURE_FILE=${JSON.stringify(stored.filePath)} node scripts/live-test-v19-postgres-redis-restart-recovery.mjs`,
  }, null, 2));
}

main().catch((error) => {
  const message = String(error.message || error);
  const blocker = message.startsWith("oidc_identity_admin_blocked:")
    ? {
        ok: false,
        blocker: "oidc_identity_admin_blocked",
        detail: message.slice("oidc_identity_admin_blocked:".length),
        required: [
          "PORTAL_ADMIN_EMAIL",
          "PORTAL_ADMIN_PASSWORD",
          "deployed /portal/admin/create-user with working OIDC identity sync",
        ],
      }
    : {
        ok: false,
        error: message,
      };
  console.error(JSON.stringify(blocker, null, 2));
  process.exitCode = 1;
});
