import {
  LAUNCH_COOKIE,
  NATIVE_LOGIN_PATHS,
  PORTAL_INTERNAL_AUTH_TOKEN,
  PORTAL_INTERNAL_URL,
  PORTAL_OPL_ADAPTER_URL,
  buildDirectEntryState,
} from "./config.mjs";
import { parseCookies, readRequestBody, sendJson } from "./http-utils.mjs";
import { escapeHtml } from "./html-injection.mjs";

export function resolveLaunchToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const cookieToken = cookies[LAUNCH_COOKIE] || "";
  if (cookieToken) return cookieToken;
  const authorization = String(req.headers.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export function buildLaunchCookie(launchToken) {
  return `${LAUNCH_COOKIE}=${encodeURIComponent(launchToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`;
}

export function clearLaunchCookie() {
  return `${LAUNCH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function fetchPortalBootstrap(launchToken) {
  const url = new URL("/api/opl-launch/bootstrap", `${PORTAL_OPL_ADAPTER_URL}/`);
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${launchToken}`,
    },
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

export function buildPortalInternalHeaders() {
  return {
    accept: "application/json",
    ...(PORTAL_INTERNAL_AUTH_TOKEN ? { "x-portal-internal-token": PORTAL_INTERNAL_AUTH_TOKEN } : {}),
  };
}

export function parseLoginPayload(contentType = "", rawBody = "") {
  const normalizedType = String(contentType || "").toLowerCase();
  if (!rawBody) return {};
  if (normalizedType.includes("application/json")) {
    return JSON.parse(rawBody);
  }
  if (normalizedType.includes("application/x-www-form-urlencoded") || normalizedType.includes("multipart/form-data") || normalizedType.includes("text/plain")) {
    return Object.fromEntries(new URLSearchParams(rawBody).entries());
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    return Object.fromEntries(new URLSearchParams(rawBody).entries());
  }
}

function objectPayload(value) {
  return value && typeof value === "object" ? value : {};
}

function stringValue(value = "") {
  return String(value || "").trim();
}

function firstString(source = {}, keys = []) {
  for (const key of keys) {
    const value = stringValue(source[key]);
    if (value) return value;
  }
  return "";
}

function normalizeLoginMode(payload = {}, launchScope = {}) {
  return (
    firstString(launchScope, ["mode"]) ||
    firstString(payload, ["mode", "launchMode", "launch_mode"]) ||
    "api_only"
  ).toLowerCase();
}

export function normalizeLoginCredentials(payload = {}) {
  const rawLaunchScope = objectPayload(payload.launchScope);
  return {
    email: firstString(payload, ["email", "username", "loginName", "identifier"]),
    password: firstString(payload, ["password", "passcode"]),
    task: firstString(payload, ["task", "workspaceId", "taskSlug"]),
    redirectTo: firstString(payload, ["redirectTo", "redirect"]),
    mode: normalizeLoginMode(payload, rawLaunchScope) || "api_only",
    workspaceId: firstString(rawLaunchScope, ["workspaceId"]) || firstString(payload, ["workspaceId", "workspace_id", "task", "taskSlug"]),
    resourceBindingId: firstString(rawLaunchScope, ["resourceBindingId"]) || firstString(payload, ["resourceBindingId", "resource_binding_id"]),
    apiKey: firstString(payload, [
      "apiKey",
      "api_key",
      "oplProviderApiKey",
      "opl_provider_api_key",
      "providerApiKey",
      "provider_api_key",
      "gflabtoken",
      "gflabToken",
    ]),
  };
}

function normalizeRuntimeMode(value = "") {
  return value === "full_runtime" ? "full_runtime" : "api_only";
}

function portalNativeLoginPayload(credentials) {
  const mode = credentials.mode === "full_runtime" ? "full_runtime" : "api_only";
  const requestPayload = {
    email: credentials.email,
    password: credentials.password,
    task: credentials.task,
    apiKey: credentials.apiKey,
    mode,
  };
  if (mode !== "full_runtime") {
    return requestPayload;
  }
  const workspaceId = credentials.workspaceId || credentials.task || "";
  const resourceBindingId = credentials.resourceBindingId || "";
  return {
    ...requestPayload,
    workspaceId,
    resourceBindingId,
    launchScope: { mode, workspaceId, resourceBindingId },
  };
}

export async function portalNativeLogin(credentials) {
  const response = await fetch(new URL("/internal/opl/auth/login", `${PORTAL_INTERNAL_URL}/`), {
    method: "POST",
    headers: {
      ...buildPortalInternalHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify(portalNativeLoginPayload({
      ...credentials,
      mode: normalizeRuntimeMode(credentials.mode),
    })),
    redirect: "manual",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok || !payload?.launchToken) {
    const error = new Error(payload?.message || payload?.error || `portal_native_login_failed:${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function normalizePortalUser(bootstrap) {
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

export function buildOpenWebUiAuthPayload({ user, launchToken, bootstrap = {} }) {
  return {
    success: true,
    id: user.id,
    user,
    email: user.email,
    name: user.name || user.email || user.id,
    role: "user",
    profile_image_url: "",
    authenticated: Boolean(launchToken),
    source: user.source || "portal-launch",
    portal: bootstrap.portal || {},
    workspace: bootstrap.workspace || {},
  };
}

export async function handleAuthUser(req, res, { openWebUi = false } = {}) {
  const launchToken = resolveLaunchToken(req);
  if (!launchToken) {
    sendJson(res, 401, {
      success: false,
      detail: "Not authenticated",
      error: "unauthenticated",
      ...buildDirectEntryState(),
    });
    return true;
  }

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

    const payload = openWebUi
      ? buildOpenWebUiAuthPayload({ user, launchToken, bootstrap })
      : {
          success: true,
          user,
          authenticated: true,
          portal: bootstrap.portal || {},
          workspace: bootstrap.workspace || {},
        };
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
    });
    res.end(JSON.stringify(payload, null, 2));
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
      message: error.status === 401 ? "launch token is invalid" : "portal bootstrap failed",
    }, null, 2));
    return true;
  }
}

export function isNativeLoginRequest(req, url) {
  return String(req.method || "GET").toUpperCase() === "POST" && NATIVE_LOGIN_PATHS.includes(url.pathname);
}

export function wantsHtmlLoginResponse(req, contentType = "") {
  const accept = String(req.headers.accept || "").toLowerCase();
  if (accept.includes("application/json")) return false;
  return String(contentType || "").toLowerCase().includes("application/x-www-form-urlencoded") || accept.includes("text/html");
}

export function isOpenWebUiAuthPath(pathname = "") {
  return String(pathname || "").startsWith("/api/v1/auths/");
}

function sendInvalidLoginPayload(res) {
  sendJson(res, 400, {
    success: false,
    error: "invalid_request",
    message: "login payload format is invalid",
  });
  return true;
}

function sendMissingCredentials(res, htmlMode) {
  if (htmlMode) {
    res.writeHead(401, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body>账号或密码不能为空。</body></html>");
    return true;
  }
  sendJson(res, 401, {
    success: false,
    error: "invalid_credentials",
    message: "account and password are required",
  });
  return true;
}

function portalNativeLoginUser(login = {}) {
  return {
    id: login.user?.id || "",
    username: login.user?.email || login.user?.name || "",
    email: login.user?.email || "",
    name: login.user?.name || login.user?.email || "",
    source: "portal-native-login",
  };
}

function redactedLaunchUrl(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    url.searchParams.delete("launch_token");
    url.searchParams.delete("runtime_token");
    url.searchParams.delete("token");
    return url.toString();
  } catch {
    return text
      .replace(/([?&])launch_token=[^&#]*/gi, "$1launch_token=[redacted]")
      .replace(/([?&])runtime_token=[^&#]*/gi, "$1runtime_token=[redacted]")
      .replace(/([?&])token=[^&#]*/gi, "$1token=[redacted]");
  }
}

function publicLaunchPayload(launch = {}) {
  return {
    launchId: launch.launchId || "",
    runtimeSessionId: launch.runtimeSessionId || "",
    oplSessionId: launch.oplSessionId || "",
    workspaceId: launch.workspaceId || "",
    workspaceSessionId: launch.workspaceSessionId || "",
    runtimeUrl: launch.runtimeUrl || "",
    oplWebUrl: redactedLaunchUrl(launch.oplWebUrl || ""),
    bootstrapUrl: redactedLaunchUrl(launch.bootstrapUrl || ""),
    providerKeyRef: launch.providerKeyRef || "",
    launchScope: launch.launchScope || null,
  };
}

function portalNativeLoginSuccessPayload({ login, user, url }) {
  if (isOpenWebUiAuthPath(url.pathname)) {
    return buildOpenWebUiAuthPayload({
      user,
      launchToken: login.launchToken,
      bootstrap: {
        portal: publicLaunchPayload(login.launch || {}),
        workspace: login.workspace || {},
      },
    });
  }
  return {
    success: true,
    user,
    authenticated: true,
    launch: publicLaunchPayload(login.launch || {}),
    workspace: login.workspace || {},
    workspaceSession: login.workspaceSession || {},
    runtimeSession: login.runtimeSession || {},
  };
}

function sendNativeLoginSuccess(res, { credentials, htmlMode, login, url }) {
  const cookie = buildLaunchCookie(login.launchToken);
  if (htmlMode) {
    res.writeHead(302, {
      location: credentials.redirectTo || "/",
      "set-cookie": cookie,
      "cache-control": "no-cache, no-store, must-revalidate",
    });
    res.end();
    return true;
  }
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-cache, no-store, must-revalidate",
    "set-cookie": cookie,
  });
  const user = portalNativeLoginUser(login);
  const payload = portalNativeLoginSuccessPayload({ login, user, url });
  res.end(JSON.stringify(payload, null, 2));
  return true;
}

function sendNativeLoginFailure(res, error, htmlMode) {
  const status = Number(error.status || 502);
  const result = {
    success: false,
    error: error.payload?.error || "portal_native_login_failed",
    message: error.status === 401 ? "invalid credentials" : "portal native login failed",
  };
  if (htmlMode) {
    res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html><body>${escapeHtml(result.message)}</body></html>`);
    return true;
  }
  sendJson(res, status, result);
  return true;
}

export async function handleNativeLogin(req, res, url) {
  if (!isNativeLoginRequest(req, url)) return false;

  const rawBodyBuffer = await readRequestBody(req);
  const rawBody = rawBodyBuffer ? rawBodyBuffer.toString("utf8") : "";
  const contentType = String(req.headers["content-type"] || "");
  let payload = {};
  try {
    payload = parseLoginPayload(contentType, rawBody);
  } catch {
    return sendInvalidLoginPayload(res);
  }

  const credentials = normalizeLoginCredentials(payload);
  const htmlMode = wantsHtmlLoginResponse(req, contentType);
  if (!credentials.email || !credentials.password) {
    return sendMissingCredentials(res, htmlMode);
  }

  try {
    const login = await portalNativeLogin(credentials);
    return sendNativeLoginSuccess(res, { credentials, htmlMode, login, url });
  } catch (error) {
    return sendNativeLoginFailure(res, error, htmlMode);
  }
}
