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

export function normalizeLoginCredentials(payload = {}) {
  return {
    email: String(payload.email || payload.username || payload.loginName || payload.identifier || "").trim(),
    password: String(payload.password || payload.passcode || "").trim(),
    task: String(payload.task || payload.workspaceId || payload.taskSlug || "").trim(),
    redirectTo: String(payload.redirectTo || payload.redirect || "").trim(),
  };
}

export async function portalNativeLogin(credentials) {
  const response = await fetch(new URL("/internal/opl/auth/login", `${PORTAL_INTERNAL_URL}/`), {
    method: "POST",
    headers: {
      ...buildPortalInternalHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify(credentials),
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
    id: user.id,
    email: user.email,
    name: user.name || user.email || user.id,
    role: "user",
    profile_image_url: "",
    token: launchToken,
    token_type: "Bearer",
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
      message: String(error.message || error),
      detail: error.payload || null,
    }, null, 2));
    return true;
  }
}

export function isNativeLoginRequest(req, url) {
  return String(req.method || "GET").toUpperCase() === "POST" && NATIVE_LOGIN_PATHS.includes(url.pathname);
}

export function wantsHtmlLoginResponse(req, contentType = "") {
  const accept = String(req.headers.accept || "").toLowerCase();
  return String(contentType || "").toLowerCase().includes("application/x-www-form-urlencoded") || accept.includes("text/html");
}

export function isOpenWebUiAuthPath(pathname = "") {
  return String(pathname || "").startsWith("/api/v1/auths/");
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
    sendJson(res, 400, {
      success: false,
      error: "invalid_request",
      message: "login payload format is invalid",
    });
    return true;
  }

  const credentials = normalizeLoginCredentials(payload);
  const htmlMode = wantsHtmlLoginResponse(req, contentType);
  if (!credentials.email || !credentials.password) {
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

  try {
    const login = await portalNativeLogin(credentials);
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
    const user = {
      id: login.user?.id || "",
      username: login.user?.email || login.user?.name || "",
      email: login.user?.email || "",
      name: login.user?.name || login.user?.email || "",
      source: "portal-native-login",
    };
    const payload = isOpenWebUiAuthPath(url.pathname)
      ? buildOpenWebUiAuthPayload({
          user,
          launchToken: login.launchToken,
          bootstrap: {
            portal: login.launch || {},
            workspace: login.workspace || {},
          },
        })
      : {
          success: true,
          user,
          token: login.launchToken,
          token_type: "Bearer",
          launchToken: login.launchToken,
          launch: login.launch || {},
          workspace: login.workspace || {},
          workspaceSession: login.workspaceSession || {},
          runtimeSession: login.runtimeSession || {},
        };
    res.end(JSON.stringify(payload, null, 2));
    return true;
  } catch (error) {
    const status = Number(error.status || 502);
    const result = {
      success: false,
      error: error.payload?.error || "portal_native_login_failed",
      message: error.payload?.message || String(error.message || error),
      reasons: error.payload?.reasons || [],
    };
    if (htmlMode) {
      res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html><body>${escapeHtml(result.message)}</body></html>`);
      return true;
    }
    sendJson(res, status, result);
    return true;
  }
}
