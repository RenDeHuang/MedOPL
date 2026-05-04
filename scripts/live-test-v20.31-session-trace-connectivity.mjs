import assert from "node:assert/strict";

function env(name) {
  return String(process.env[name] || "").trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function pickBaseUrl(primary, legacy, fallback) {
  const value = env(primary) || env(legacy) || fallback;
  return value.replace(/\/+$/, "");
}

function sanitizeUrl(value = "") {
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return String(value || "").replace(/[?#].*$/, "");
  }
}

function redactText(value = "") {
  return String(value || "")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/\b(?:X-Amz|x-amz|X-Goog|x-goog|signature|token|access_token|id_token|session|cookie)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]");
}

function getBuildTag(headers) {
  return headers.get("x-build-tag") || headers.get("x-release") || headers.get("x-version") || "unknown";
}

function getCorrelationId(headers, fallback) {
  return headers.get("x-correlation-id") || headers.get("x-request-id") || headers.get("traceparent") || fallback;
}

function parseSetCookie(setCookie) {
  if (!setCookie) return [];
  return setCookie
    .split(/,(?=[^;]+=[^;]+)/g)
    .map((item) => item.split(";")[0].trim())
    .filter(Boolean);
}

function cookieHeader(cookies = []) {
  return cookies.join("; ");
}

function buildTagFromBody(text) {
  try {
    const payload = JSON.parse(text || "{}");
    return String(payload?.build?.sha || payload?.buildTag || payload?.version || "");
  } catch {
    return "";
  }
}

function fetchSuccessPayload(response, responseText, start) {
  return {
    ok: response.ok,
    status: response.status,
    latencyMs: Date.now() - start,
    buildTag: buildTagFromBody(responseText) || getBuildTag(response.headers),
    correlationId: getCorrelationId(response.headers, `trace-${Date.now()}`),
    body: responseText,
  };
}

function fetchFailurePayload(error, start) {
  return {
    ok: false,
    status: 0,
    latencyMs: Date.now() - start,
    buildTag: "unknown",
    correlationId: `trace-${Date.now()}`,
    reason: redactText(error instanceof Error ? error.message : String(error)),
  };
}

async function timedFetch(url, init, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const responseText = await response.text();
    return fetchSuccessPayload(response, responseText, start);
  } catch (error) {
    return fetchFailurePayload(error, start);
  } finally {
    clearTimeout(timer);
  }
}

async function probeService(baseUrl, paths) {
  for (const path of paths) {
    const result = await timedFetch(`${baseUrl}${path}`, { method: "GET", redirect: "manual" });
    if (result.ok || (result.status >= 200 && result.status < 500)) return { ...result, path, url: sanitizeUrl(`${baseUrl}${path}`) };
  }
  const fallback = await timedFetch(`${baseUrl}${paths[0]}`, { method: "GET", redirect: "manual" });
  return { ...fallback, path: paths[0], url: sanitizeUrl(`${baseUrl}${paths[0]}`) };
}

async function portalLogin(baseUrl, email, password) {
  const body = new URLSearchParams({ email, password });
  const result = await timedFetch(`${baseUrl}/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "text/html,application/xhtml+xml,application/json",
    },
    body,
    redirect: "manual",
  });
  const cookies = parseSetCookie(result.headers?.get?.("set-cookie") || "");
  return {
    ok: result.ok || result.status === 302,
    status: result.status,
    latencyMs: result.latencyMs,
    buildTag: result.buildTag,
    correlationId: result.correlationId,
    hasCookie: cookies.length > 0,
    cookies,
    reason: result.reason || "",
  };
}

if (!boolEnv("RUN_V20_31_LIVE")) {
  console.log(JSON.stringify({
    ok: true,
    status: "skip",
    reason: "RUN_V20_31_LIVE_not_enabled",
  }, null, 2));
  process.exit(0);
}

const portalBaseUrl = pickBaseUrl("PORTAL_BASE_URL", "V20_31_PORTAL_BASE_URL", "https://portal.medopl.cn");
const traceBaseUrl = pickBaseUrl("TRACE_BASE_URL", "V20_31_TRACE_BASE_URL", "https://trace.medopl.cn");
const adminEmail = env("PORTAL_ADMIN_EMAIL");
const adminPassword = env("PORTAL_ADMIN_PASSWORD");
const runId = env("V20_31_LIVE_RUN_ID");
const workspaceId = env("V20_31_LIVE_WORKSPACE_ID");

if (!adminEmail || !adminPassword) {
  const payload = {
    ok: false,
    status: "live",
    suite: "v20.31_session_trace_connectivity",
    evidence: {
      connected: false,
      reason: "PORTAL_ADMIN_EMAIL_and_PORTAL_ADMIN_PASSWORD_required_in_live_mode",
    },
  };
  console.log(JSON.stringify(payload, null, 2));
  assert.equal(payload.ok, true, payload.evidence.reason);
}

const loginResult = await portalLogin(portalBaseUrl, adminEmail, adminPassword);
const authHeaders = {
  accept: "application/json",
  cookie: cookieHeader(loginResult.cookies || []),
};

const meResult = loginResult.ok
  ? await timedFetch(`${portalBaseUrl}/portal/api/me`, {
      method: "GET",
      headers: authHeaders,
      redirect: "manual",
    })
  : {
      ok: false,
      status: 0,
      latencyMs: 0,
      buildTag: loginResult.buildTag,
      correlationId: loginResult.correlationId,
      reason: "portal_login_failed_or_cookie_missing",
      body: "",
      headers: new Headers(),
    };

let sessionTracesUrl = `${portalBaseUrl}/portal/api/session-traces`;
const query = new URLSearchParams();
if (runId) query.set("runId", runId);
if (workspaceId) query.set("workspaceId", workspaceId);
if (query.size > 0) sessionTracesUrl += `?${query.toString()}`;

const sessionTracesResult = loginResult.ok
  ? await timedFetch(sessionTracesUrl, {
      method: "GET",
      headers: authHeaders,
      redirect: "manual",
    })
  : {
      ok: false,
      status: 0,
      latencyMs: 0,
      buildTag: loginResult.buildTag,
      correlationId: loginResult.correlationId,
      reason: "portal_login_failed_or_cookie_missing",
      body: "",
      headers: new Headers(),
    };

const traceSiteResult = await probeService(traceBaseUrl, ["/healthz", "/"]);

let tracesCount = 0;
if (sessionTracesResult.body) {
  try {
    const payload = JSON.parse(sessionTracesResult.body || "{}");
    if (Array.isArray(payload)) tracesCount = payload.length;
    else if (Array.isArray(payload?.items)) tracesCount = payload.items.length;
    else if (Array.isArray(payload?.data)) tracesCount = payload.data.length;
  } catch {
    tracesCount = 0;
  }
}

const connected = Boolean(meResult.ok && sessionTracesResult.ok && traceSiteResult.ok && tracesCount > 0);

function publicResult(result) {
  return {
    ok: result.ok,
    status: result.status,
    latencyMs: result.latencyMs,
    buildTag: result.buildTag,
    correlationId: result.correlationId,
    reason: redactText(result.reason || ""),
  };
}

const payload = {
  ok: connected,
  status: "live",
  suite: "v20.31_session_trace_connectivity",
  evidence: {
    connected,
    tracesCount,
    filters: {
      runId: runId || "",
      workspaceId: workspaceId || "",
    },
    portalLogin: {
      ...publicResult(loginResult),
      hasCookie: loginResult.hasCookie,
    },
    portalMe: { ...publicResult(meResult) },
    portalSessionTraces: { ...publicResult(sessionTracesResult) },
    traceSite: {
      ...publicResult(traceSiteResult),
      path: traceSiteResult.path,
      url: traceSiteResult.url,
    },
  },
};

console.log(JSON.stringify(payload, null, 2));
assert.equal(connected, true, "no_session_trace_evidence");
