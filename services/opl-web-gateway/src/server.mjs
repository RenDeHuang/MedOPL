import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || process.env.OPL_WEB_GATEWAY_PORT || 18789);
const OPL_WEB_UPSTREAM_URL = String(process.env.OPL_WEB_UPSTREAM_URL || process.env.OPL_WEB_URL || "http://127.0.0.1:13030").replace(/\/$/, "");
const PORTAL_OPL_ADAPTER_URL = String(process.env.PORTAL_OPL_ADAPTER_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const BASE_URL = String(process.env.OPL_WEB_GATEWAY_PUBLIC_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const LAUNCH_SCRIPT_PATH = "/portal-launch.js";
const ADAPTER_PREFIX = "/portal-adapter";
const LAUNCH_COOKIE = "opl_portal_launch";

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function copyHeaders(headers) {
  const next = {};
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === "content-encoding") continue;
    if (key.toLowerCase() === "content-length") continue;
    next[key] = value;
  }
  return next;
}

function parseCookies(cookieHeader = "") {
  const cookies = {};
  for (const part of String(cookieHeader || "").split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    cookies[rawName] = decodeURIComponent(rawValue.join("=") || "");
  }
  return cookies;
}

function buildLaunchCookie(launchToken) {
  return `${LAUNCH_COOKIE}=${encodeURIComponent(launchToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`;
}

function clearLaunchCookie() {
  return `${LAUNCH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function appendSetCookie(headers, cookieValue) {
  const current = headers["set-cookie"];
  if (!current) {
    headers["set-cookie"] = cookieValue;
    return;
  }
  headers["set-cookie"] = Array.isArray(current) ? [...current, cookieValue] : [current, cookieValue];
}

function buildTargetUrl(reqUrl, upstreamBase, prefix = "") {
  const incoming = new URL(reqUrl, BASE_URL);
  const target = new URL(upstreamBase);
  let pathname = incoming.pathname;
  if (prefix && pathname.startsWith(prefix)) {
    pathname = pathname.slice(prefix.length) || "/";
  }
  target.pathname = `${target.pathname.replace(/\/$/, "")}${pathname}`;
  target.search = incoming.search;
  return target;
}

function sanitizeProxyHeaders(headers, target) {
  const next = { ...headers };
  delete next.host;
  delete next.connection;
  delete next["content-length"];
  next.host = target.host;
  return next;
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks) : null;
}

async function fetchPortalBootstrap(launchToken) {
  const url = new URL("/api/opl-launch/bootstrap", `${PORTAL_OPL_ADAPTER_URL}/`);
  url.searchParams.set("launch_token", launchToken);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `portal_bootstrap_failed:${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function normalizePortalUser(bootstrap) {
  const portal = bootstrap?.portal || {};
  const launch = bootstrap?.launch || {};
  const id = portal.portalUserId || portal.userId || launch.portalUserId || "";
  const email = portal.portalUserEmail || portal.userEmail || launch.portalUserEmail || "";
  const name = portal.portalUserName || portal.userName || launch.portalUserName || "";
  if (!id) return null;
  return {
    id,
    username: email || name || id,
    email,
    name: name || email || id,
    source: "portal-launch",
  };
}

async function handleAuthUser(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  const launchToken = cookies[LAUNCH_COOKIE] || "";
  if (!launchToken) return false;

  try {
    const bootstrap = await fetchPortalBootstrap(launchToken);
    const user = normalizePortalUser(bootstrap);
    if (!user) {
      res.writeHead(502, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-cache, no-store, must-revalidate",
        "set-cookie": clearLaunchCookie(),
      });
      res.end(JSON.stringify({
        success: false,
        error: "portal_user_missing",
      }, null, 2));
      return true;
    }

    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
    });
    res.end(JSON.stringify({
      success: true,
      user,
      portal: bootstrap.portal || {},
      workspace: bootstrap.workspace || {},
    }, null, 2));
    return true;
  } catch (error) {
    res.writeHead(error.status === 401 ? 401 : 502, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      "set-cookie": clearLaunchCookie(),
    });
    res.end(JSON.stringify({
      success: false,
      error: error.status === 401 ? "launch_token_invalid" : "portal_bootstrap_failed",
      message: String(error.message || error),
      detail: error.payload || null,
    }, null, 2));
    return true;
  }
}

function injectLaunchScript(html) {
  if (html.includes(LAUNCH_SCRIPT_PATH)) return html;
  const tag = `<script type="module" src="${LAUNCH_SCRIPT_PATH}"></script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `    ${tag}\n  </head>`);
  }
  return `${tag}\n${html}`;
}

async function proxy(req, res, upstreamBase, prefix = "") {
  const target = buildTargetUrl(req.url || "/", upstreamBase, prefix);
  const body = await readRequestBody(req);
  const response = await fetch(target, {
    method: req.method || "GET",
    headers: sanitizeProxyHeaders(req.headers, target),
    body,
    redirect: "manual",
  });

  const headers = copyHeaders(response.headers);
  const incoming = new URL(req.url || "/", BASE_URL);
  const launchToken = incoming.searchParams.get("launch_token") || "";
  if (!prefix && launchToken) appendSetCookie(headers, buildLaunchCookie(launchToken));
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const html = injectLaunchScript(await response.text());
    headers["content-type"] = contentType;
    headers["cache-control"] = "no-cache, no-store, must-revalidate";
    res.writeHead(response.status, headers);
    res.end(html);
    return;
  }

  res.writeHead(response.status, headers);
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}

function portalLaunchClientScript() {
  return `
const STATE_KEY = "portal.opl.launch";
const BOOTSTRAP_KEY = "portal.opl.bootstrap";

function readStoredState() {
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStoredState(state) {
  try {
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {}
}

function readStoredBootstrap() {
  try {
    const raw = window.sessionStorage.getItem(BOOTSTRAP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredBootstrap(bootstrap) {
  try {
    window.sessionStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(bootstrap));
  } catch {}
}

function stripLaunchQuery() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("launch_token") && !url.searchParams.has("portal_adapter_url")) return;
    url.searchParams.delete("launch_token");
    url.searchParams.delete("portal_adapter_url");
    window.history.replaceState({}, document.title, url.toString());
  } catch {}
}

function resolveLaunchState() {
  const params = new URLSearchParams(window.location.search);
  const stored = readStoredState();
  const launchToken = params.get("launch_token") || stored.launchToken || "";
  const requestedAdapterUrl = params.get("portal_adapter_url") || stored.requestedAdapterUrl || "";
  if (!launchToken) return null;
  const state = {
    launchToken,
    requestedAdapterUrl,
    adapterUrl: "/portal-adapter",
    gatewayUrl: window.location.origin,
    receivedAt: new Date().toISOString()
  };
  writeStoredState(state);
  return state;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    },
    credentials: "same-origin"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(url + " failed " + response.status + ": " + JSON.stringify(payload));
  }
  return payload;
}

function requireLaunchState() {
  const state = readStoredState();
  if (!state.launchToken) {
    throw new Error("Portal launch token is not available.");
  }
  return state;
}

function buildPortalApi() {
  return {
    get state() {
      return readStoredState();
    },
    get bootstrap() {
      return readStoredBootstrap();
    },
    async refreshBootstrap() {
      const state = requireLaunchState();
      const bootstrap = await fetchJson(state.adapterUrl + "/api/opl-launch/bootstrap?launch_token=" + encodeURIComponent(state.launchToken));
      writeStoredBootstrap(bootstrap);
      return bootstrap;
    },
    async startRun(input = {}) {
      const state = requireLaunchState();
      return fetchJson(state.adapterUrl + "/api/opl-launch/runs", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          launchToken: input.launchToken || input.launch_token || state.launchToken
        })
      });
    },
    async getRunStatus(runId) {
      if (!runId) throw new Error("runId is required.");
      const state = requireLaunchState();
      return fetchJson(state.adapterUrl + "/api/opl-launch/runs/" + encodeURIComponent(runId) + "/status");
    },
    async getArtifacts(runId) {
      if (!runId) throw new Error("runId is required.");
      const state = requireLaunchState();
      return fetchJson(state.adapterUrl + "/api/opl-launch/runs/" + encodeURIComponent(runId) + "/artifacts");
    }
  };
}

window.__OPL_PORTAL__ = window.__OPL_PORTAL__ || buildPortalApi();

function resolveOplModuleClickTarget(event) {
  const target = event && event.target;
  const closest = target && typeof target.closest === "function"
    ? target.closest('[data-testid^="opl-module-pill-"], [data-opl-module-id]')
    : null;
  if (!closest || typeof closest.getAttribute !== "function") return null;
  const moduleId = String(
    closest.getAttribute("data-opl-module-id") ||
    String(closest.getAttribute("data-testid") || "").replace(/^opl-module-pill-/, "")
  ).toLowerCase();
  if (!["mas", "mag", "rca"].includes(moduleId)) return null;
  return {
    moduleId,
    label: String(closest.textContent || moduleId).trim()
  };
}

function dispatchPortalRunEvent(type, detail) {
  try {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  } catch {}
}

function installNativeRunBridge() {
  if (window.__OPL_PORTAL_NATIVE_RUN_BRIDGE_INSTALLED__) return;
  if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  window.__OPL_PORTAL_NATIVE_RUN_BRIDGE_INSTALLED__ = true;
  document.addEventListener("click", (event) => {
    const module = resolveOplModuleClickTarget(event);
    if (!module) return;
    window.__OPL_PORTAL__.startRun({
      agentId: module.moduleId,
      toolName: "opl-native-ui",
      source: "opl-web-native-ui-click",
      input: {
        moduleId: module.moduleId,
        label: module.label
      }
    })
      .then((run) => dispatchPortalRunEvent("opl:portal-run-started", { module, run }))
      .catch((error) => dispatchPortalRunEvent("opl:portal-run-error", {
        module,
        error: String(error && error.message ? error.message : error)
      }));
  }, true);
}

window.__OPL_PORTAL__.installNativeRunBridge = installNativeRunBridge;

async function initializePortalLaunch() {
  const state = resolveLaunchState();
  if (!state) return;
  const bootstrapUrl = state.adapterUrl + "/api/opl-launch/bootstrap?launch_token=" + encodeURIComponent(state.launchToken);
  const bootstrap = await fetchJson(bootstrapUrl);
  writeStoredBootstrap(bootstrap);

  const launch = bootstrap.launch || {};
  const portal = bootstrap.portal || {};
  const workspace = bootstrap.workspace || {};
  const sessionBind = await fetchJson(state.adapterUrl + "/api/opl-launch/sessions/bind", {
    method: "POST",
    body: JSON.stringify({
      launchToken: state.launchToken,
      workspaceId: portal.workspaceId || launch.workspaceId || "",
      workspaceSessionId: portal.workspaceSessionId || launch.workspaceSessionId || "",
      runtimeSessionId: portal.runtimeSessionId || launch.runtimeSessionId || "",
      oplSessionId: "opl-web:" + (launch.launchId || portal.runtimeSessionId || Date.now()),
      workspacePath: workspace.workspacePath || launch.workspacePath || "",
      source: "opl-web-gateway",
      userAgent: window.navigator.userAgent
    })
  });

  window.__OPL_PORTAL_LAUNCH__ = { state, bootstrap, sessionBind };
  window.__OPL_PORTAL__ = window.__OPL_PORTAL__ || buildPortalApi();
  window.__OPL_PORTAL__.installNativeRunBridge = installNativeRunBridge;
  installNativeRunBridge();
  window.dispatchEvent(new CustomEvent("opl:portal-launch-ready", {
    detail: window.__OPL_PORTAL_LAUNCH__
  }));
  stripLaunchQuery();
}

initializePortalLaunch().catch((error) => {
  console.error("[opl-web-gateway] Portal launch initialization failed", error);
  window.__OPL_PORTAL_LAUNCH_ERROR__ = String(error && error.message ? error.message : error);
  window.dispatchEvent(new CustomEvent("opl:portal-launch-error", {
    detail: window.__OPL_PORTAL_LAUNCH_ERROR__
  }));
});
`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", BASE_URL);
    if (req.method === "GET" && url.pathname === "/healthz") {
      sendJson(res, 200, {
        ok: true,
        service: "opl-web-gateway",
        baseUrl: BASE_URL,
        upstream: OPL_WEB_UPSTREAM_URL,
        portalAdapter: PORTAL_OPL_ADAPTER_URL,
      });
      return;
    }
    if (req.method === "GET" && url.pathname === LAUNCH_SCRIPT_PATH) {
      res.writeHead(200, {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-cache, no-store, must-revalidate",
      });
      res.end(portalLaunchClientScript());
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/auth/user") {
      if (await handleAuthUser(req, res)) return;
    }
    if (url.pathname === ADAPTER_PREFIX || url.pathname.startsWith(`${ADAPTER_PREFIX}/`)) {
      await proxy(req, res, PORTAL_OPL_ADAPTER_URL, ADAPTER_PREFIX);
      return;
    }
    await proxy(req, res, OPL_WEB_UPSTREAM_URL);
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      service: "opl-web-gateway",
      message: String(error.message || error),
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({
    ok: true,
    service: "opl-web-gateway",
    port: PORT,
    baseUrl: BASE_URL,
    upstream: OPL_WEB_UPSTREAM_URL,
    portalAdapter: PORTAL_OPL_ADAPTER_URL,
  }, null, 2));
});
