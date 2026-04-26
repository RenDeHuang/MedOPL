import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || process.env.OPL_WEB_GATEWAY_PORT || 18789);
const OPL_WEB_UPSTREAM_URL = String(process.env.OPL_WEB_UPSTREAM_URL || process.env.OPL_WEB_URL || "http://127.0.0.1:13030").replace(/\/$/, "");
const PORTAL_OPL_ADAPTER_URL = String(process.env.PORTAL_OPL_ADAPTER_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const PORTAL_PUBLIC_URL = String(process.env.PORTAL_PUBLIC_URL || "").replace(/\/$/, "");
const PORTAL_INTERNAL_URL = String(process.env.PORTAL_INTERNAL_URL || PORTAL_PUBLIC_URL || "http://127.0.0.1:17080").replace(/\/$/, "");
const PORTAL_INTERNAL_AUTH_TOKEN = String(process.env.PORTAL_INTERNAL_AUTH_TOKEN || "").trim();
const BASE_URL = String(process.env.OPL_WEB_GATEWAY_PUBLIC_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const BUILD_SHA = String(process.env.BUILD_SHA || "dev").trim() || "dev";
const BUILD_TIME = String(process.env.BUILD_TIME || "unknown").trim() || "unknown";
const OPL_WEBUI_AUTH_MODE = String(process.env.OPL_WEBUI_AUTH_MODE || "unknown").trim() || "unknown";
const LAUNCH_SCRIPT_PATH = "/portal-launch.js";
const ADAPTER_PREFIX = "/portal-adapter";
const LAUNCH_COOKIE = "opl_portal_launch";
const NATIVE_LOGIN_PATHS = String(process.env.OPL_NATIVE_LOGIN_PATHS || "/api/auth/signin,/api/auth/login,/api/v1/auths/signin,/api/v1/auths/login,/auth/login,/login")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const NATIVE_AUTH_USER_PATHS = new Set([
  "/api/auth/user",
  "/api/v1/auths/",
  "/api/v1/auths/me",
  "/api/v1/auths/user",
]);

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

function resolveLaunchToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const cookieToken = cookies[LAUNCH_COOKIE] || "";
  if (cookieToken) return cookieToken;
  const authorization = String(req.headers.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function buildLaunchCookie(launchToken) {
  return `${LAUNCH_COOKIE}=${encodeURIComponent(launchToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`;
}

function clearLaunchCookie() {
  return `${LAUNCH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function buildPortalContinueUrl() {
  if (!PORTAL_PUBLIC_URL) return null;
  return `${PORTAL_PUBLIC_URL}/portal/opl`;
}

function buildStatusPayload() {
  return {
    ok: true,
    service: "opl-web-gateway",
    build: {
      sha: BUILD_SHA,
      time: BUILD_TIME,
    },
    identity: {
      ssoMode: "portal-identity-bridge",
      upstreamAuthMode: OPL_WEBUI_AUTH_MODE,
      directEntryPolicy: "portal-native-login-or-launch",
      launchCookieName: LAUNCH_COOKIE,
      authUserWithoutLaunchStatus: 401,
      websocketProxy: true,
      openFromPortalUrl: buildPortalContinueUrl(),
      nativeLoginPaths: NATIVE_LOGIN_PATHS,
    },
    runtime: {
      gatewayPublicUrl: BASE_URL,
      upstreamUrl: OPL_WEB_UPSTREAM_URL,
      portalAdapterUrl: PORTAL_OPL_ADAPTER_URL,
      portalPublicUrl: PORTAL_PUBLIC_URL || null,
      portalInternalUrl: PORTAL_INTERNAL_URL || null,
    },
  };
}

function buildDirectEntryState(overrides = {}) {
  return {
    active: true,
    authenticated: false,
    authMode: "portal-identity-bridge",
    portalLaunchRequired: true,
    launchCookieName: LAUNCH_COOKIE,
    portalPublicUrl: PORTAL_PUBLIC_URL || null,
    openFromPortalUrl: buildPortalContinueUrl(),
    reason: "portal_login_or_launch_required",
    message: "Sign in with your Portal account or open OPL from Portal.",
    ...overrides,
  };
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

function buildPortalInternalHeaders() {
  return {
    accept: "application/json",
    ...(PORTAL_INTERNAL_AUTH_TOKEN ? { "x-portal-internal-token": PORTAL_INTERNAL_AUTH_TOKEN } : {}),
  };
}

function parseLoginPayload(contentType = "", rawBody = "") {
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

function normalizeLoginCredentials(payload = {}) {
  return {
    email: String(payload.email || payload.username || payload.loginName || payload.identifier || "").trim(),
    password: String(payload.password || payload.passcode || "").trim(),
    task: String(payload.task || payload.workspaceId || payload.taskSlug || "").trim(),
    redirectTo: String(payload.redirectTo || payload.redirect || "").trim(),
  };
}

async function portalNativeLogin(credentials) {
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

function buildOpenWebUiAuthPayload({ user, launchToken, bootstrap = {} }) {
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

async function handleAuthUser(req, res, { openWebUi = false } = {}) {
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

function isNativeLoginRequest(req, url) {
  return String(req.method || "GET").toUpperCase() === "POST" && NATIVE_LOGIN_PATHS.includes(url.pathname);
}

function wantsHtmlLoginResponse(req, contentType = "") {
  const accept = String(req.headers.accept || "").toLowerCase();
  return String(contentType || "").toLowerCase().includes("application/x-www-form-urlencoded") || accept.includes("text/html");
}

function isOpenWebUiAuthPath(pathname = "") {
  return String(pathname || "").startsWith("/api/v1/auths/");
}

async function handleNativeLogin(req, res, url) {
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

function injectLaunchScript(html, directEntry) {
  if (html.includes(LAUNCH_SCRIPT_PATH)) return html;
  const metaTag = `<meta name="opl-portal-direct-entry" content="${directEntry ? "1" : "0"}">`;
  const scriptTag = `<script type="module" src="${LAUNCH_SCRIPT_PATH}"></script>`;
  const directEntryMarkup = directEntry ? buildNativeLoginEntryMarkup() : "";
  if (html.includes("</head>")) {
    html = html.replace("</head>", `    ${metaTag}\n    ${scriptTag}\n  </head>`);
  }
  if (directEntryMarkup && html.includes("</body>")) {
    html = html.replace("</body>", `${directEntryMarkup}\n  </body>`);
  } else if (directEntryMarkup) {
    html = `${html}\n${directEntryMarkup}`;
  }
  if (html.includes(metaTag) || html.includes(scriptTag)) return html;
  return `${metaTag}\n${scriptTag}\n${html}`;
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildDirectEntryMarkup() {
  const continueUrl = buildPortalContinueUrl();
  const button = continueUrl
    ? `<a class="opl-portal-entry__button" data-opl-portal-continue-link href="${escapeHtml(continueUrl)}">使用 Portal 继续</a>`
    : `<span class="opl-portal-entry__button opl-portal-entry__button--disabled" data-opl-portal-continue-link>使用 Portal 继续</span>`;
  return `
<section id="opl-portal-direct-entry" class="opl-portal-entry" aria-live="polite">
  <style>
    .opl-portal-entry {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #0b1020;
      color: #e5eefc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .opl-portal-entry__panel {
      width: min(520px, 100%);
      padding: 32px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.96);
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.45);
    }
    .opl-portal-entry__eyebrow {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #93c5fd;
    }
    .opl-portal-entry__title {
      margin: 0 0 12px;
      font-size: 28px;
      line-height: 1.2;
      color: #f8fafc;
    }
    .opl-portal-entry__copy {
      margin: 0 0 24px;
      font-size: 15px;
      line-height: 1.7;
      color: #cbd5e1;
    }
    .opl-portal-entry__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      font-weight: 600;
      text-decoration: none;
    }
    .opl-portal-entry__button--disabled {
      background: #334155;
      color: #cbd5e1;
      cursor: default;
    }
    .opl-portal-entry__hint {
      margin: 16px 0 0;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
  <div class="opl-portal-entry__panel">
    <p class="opl-portal-entry__eyebrow">One Person Lab</p>
    <h1 class="opl-portal-entry__title">请先通过 Portal 打开工作台</h1>
    <p class="opl-portal-entry__copy">当前 OPL Web 不接受原生账号登录。请从 Portal 登录后继续，这样当前用户、workspace、session、trace 和存储归属都会绑定到 Portal 身份。</p>
    ${button}
    <p class="opl-portal-entry__hint">${continueUrl ? `继续入口：${escapeHtml(continueUrl)}` : "未配置 Portal 公开地址，请联系管理员设置 PORTAL_PUBLIC_URL。"}</p>
  </div>
</section>`;
}

function buildNativeLoginEntryMarkup() {
  const continueUrl = buildPortalContinueUrl();
  const button = continueUrl
    ? `<a class="opl-portal-entry__button" data-opl-portal-continue-link href="${escapeHtml(continueUrl)}">返回 Portal</a>`
    : `<span class="opl-portal-entry__button opl-portal-entry__button--disabled" data-opl-portal-continue-link>返回 Portal</span>`;
  return `
<section id="opl-portal-direct-entry" class="opl-portal-entry" aria-live="polite">
  <style>
    .opl-portal-entry {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 0;
      background: transparent;
      pointer-events: none;
      color: #e5eefc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .opl-portal-entry__panel {
      width: min(360px, calc(100vw - 32px));
      padding: 20px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.96);
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.45);
      pointer-events: auto;
    }
    .opl-portal-entry__eyebrow {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #93c5fd;
    }
    .opl-portal-entry__title {
      margin: 0 0 10px;
      font-size: 18px;
      line-height: 1.3;
      color: #f8fafc;
    }
    .opl-portal-entry__copy {
      margin: 0 0 16px;
      font-size: 13px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    .opl-portal-entry__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      font-weight: 600;
      text-decoration: none;
    }
    .opl-portal-entry__button--disabled {
      background: #334155;
      color: #cbd5e1;
      cursor: default;
    }
    .opl-portal-entry__hint {
      margin: 16px 0 0;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
  <div class="opl-portal-entry__panel">
    <p class="opl-portal-entry__eyebrow">One Person Lab</p>
    <h1 class="opl-portal-entry__title">使用 Portal 账号登录</h1>
    <p class="opl-portal-entry__copy">可以直接在当前登录框输入 Portal 邮箱和密码，也可以回 Portal 进入工作台。</p>
    ${button}
    <p class="opl-portal-entry__hint">${continueUrl ? `继续入口：${escapeHtml(continueUrl)}` : "未配置 Portal 公开地址，请联系管理员设置 PORTAL_PUBLIC_URL。"}</p>
  </div>
</section>`;
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
  const hasLaunchCookie = Boolean(parseCookies(req.headers.cookie || "")[LAUNCH_COOKIE]);
  const directEntry = !launchToken && !hasLaunchCookie;
  if (!prefix && launchToken) appendSetCookie(headers, buildLaunchCookie(launchToken));
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const html = injectLaunchScript(await response.text(), directEntry);
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

function writeRawHttpResponse(socket, response, head = null) {
  const statusCode = response.statusCode || 502;
  const statusMessage = response.statusMessage || "Bad Gateway";
  const lines = [`HTTP/1.1 ${statusCode} ${statusMessage}`];
  for (const [key, value] of Object.entries(response.headers || {})) {
    if (Array.isArray(value)) {
      for (const item of value) lines.push(`${key}: ${item}`);
    } else if (value !== undefined) {
      lines.push(`${key}: ${value}`);
    }
  }
  socket.write(`${lines.join("\r\n")}\r\n\r\n`);
  if (head?.length) socket.write(head);
}

function writeUpgradeFailure(socket, statusCode, message) {
  if (socket.destroyed) return;
  socket.write([
    `HTTP/1.1 ${statusCode} ${message}`,
    "content-type: text/plain; charset=utf-8",
    "connection: close",
    "",
    message,
  ].join("\r\n"));
  socket.destroy();
}

function proxyUpgrade(req, socket, head, upstreamBase, prefix = "") {
  const target = buildTargetUrl(req.url || "/", upstreamBase, prefix);
  const client = target.protocol === "https:" ? https : http;
  const headers = sanitizeProxyHeaders(req.headers, target);
  headers.connection = "Upgrade";
  headers.upgrade = req.headers.upgrade || "websocket";

  const upstream = client.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (target.protocol === "https:" ? 443 : 80),
    method: req.method || "GET",
    path: `${target.pathname}${target.search}`,
    headers,
  });

  upstream.on("upgrade", (response, upstreamSocket, upstreamHead) => {
    writeRawHttpResponse(socket, response, upstreamHead);
    if (head?.length) upstreamSocket.write(head);
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });

  upstream.on("response", (response) => {
    writeRawHttpResponse(socket, response);
    response.resume();
    socket.destroy();
  });

  upstream.on("error", (error) => {
    writeUpgradeFailure(socket, 502, String(error.message || error));
  });

  upstream.end();
}

function portalLaunchClientScript() {
  return `
const STATE_KEY = "portal.opl.launch";
const BOOTSTRAP_KEY = "portal.opl.bootstrap";
const DIRECT_ENTRY_DEFAULT = ${JSON.stringify(buildDirectEntryState())};

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

function updateDirectEntryState(overrides = {}) {
  const next = {
    ...DIRECT_ENTRY_DEFAULT,
    ...window.__OPL_PORTAL_DIRECT_ENTRY__,
    ...overrides
  };
  window.__OPL_PORTAL_DIRECT_ENTRY__ = next;
  syncDirectEntryShell(next);
  return next;
}

function syncDirectEntryShell(state) {
  try {
    if (!document || typeof document.getElementById !== "function") return;
    const shell = document.getElementById("opl-portal-direct-entry");
    if (!shell) return;
    shell.style.display = state && state.active && shouldShowDirectEntryShell() ? "flex" : "none";
    if (typeof shell.querySelector !== "function") return;
    const link = shell.querySelector("[data-opl-portal-continue-link]");
    if (!link) return;
    if (state && state.openFromPortalUrl && typeof link.setAttribute === "function") {
      link.setAttribute("href", state.openFromPortalUrl);
    }
  } catch {}
}

function shouldShowDirectEntryShell() {
  try {
    const hash = String(window.location.hash || "").toLowerCase();
    const path = String(window.location.pathname || "").toLowerCase();
    if (!hash || hash === "#" || hash === "#/") return true;
    return hash.includes("login") || hash.includes("signin") || path.includes("login") || path.includes("auth");
  } catch {
    return true;
  }
}

function refreshDirectEntryShell() {
  syncDirectEntryShell(window.__OPL_PORTAL_DIRECT_ENTRY__ || DIRECT_ENTRY_DEFAULT);
}

function installDirectEntryRouteWatcher() {
  const refreshSoon = () => setTimeout(refreshDirectEntryShell, 0);
  try {
    if (window.history && typeof window.history.pushState === "function") {
      const pushState = window.history.pushState.bind(window.history);
      window.history.pushState = (...args) => {
        const result = pushState(...args);
        refreshSoon();
        return result;
      };
    }
    if (window.history && typeof window.history.replaceState === "function") {
      const replaceState = window.history.replaceState.bind(window.history);
      window.history.replaceState = (...args) => {
        const result = replaceState(...args);
        refreshSoon();
        return result;
      };
    }
  } catch {}
  if (typeof window.addEventListener === "function") {
    window.addEventListener("hashchange", refreshDirectEntryShell);
    window.addEventListener("popstate", refreshDirectEntryShell);
  }
  if (typeof window.setInterval === "function") {
    window.setInterval(refreshDirectEntryShell, 1000);
  }
}

function resolveInjectedDirectEntryFlag() {
  try {
    if (!document || typeof document.querySelector !== "function") return false;
    const meta = document.querySelector('meta[name="opl-portal-direct-entry"]');
    return Boolean(meta && typeof meta.getAttribute === "function" && meta.getAttribute("content") === "1");
  } catch {
    return false;
  }
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
    throw new Error("Portal launch token is not available. Open OPL Web from Portal.");
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
window.__OPL_PORTAL_REFRESH_DIRECT_ENTRY__ = refreshDirectEntryShell;
installDirectEntryRouteWatcher();

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
  const injectedDirectEntry = resolveInjectedDirectEntryFlag();
  updateDirectEntryState({
    active: injectedDirectEntry,
    reason: injectedDirectEntry ? "portal_launch_required" : "portal_launch_pending"
  });
  const state = resolveLaunchState();
  if (!state) {
    updateDirectEntryState({
      active: true,
      reason: injectedDirectEntry ? "portal_launch_required" : "portal_launch_missing"
    });
    return;
  }
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
  updateDirectEntryState({
    active: false,
    authenticated: true,
    reason: "portal_launch_active"
  });
  installNativeRunBridge();
  window.dispatchEvent(new CustomEvent("opl:portal-launch-ready", {
    detail: window.__OPL_PORTAL_LAUNCH__
  }));
  stripLaunchQuery();
}

initializePortalLaunch().catch((error) => {
  console.error("[opl-web-gateway] Portal launch initialization failed", error);
  window.__OPL_PORTAL_LAUNCH_ERROR__ = String(error && error.message ? error.message : error);
  updateDirectEntryState({
    active: true,
    authenticated: false,
    reason: "portal_launch_error",
    error: window.__OPL_PORTAL_LAUNCH_ERROR__
  });
  window.dispatchEvent(new CustomEvent("opl:portal-launch-error", {
    detail: window.__OPL_PORTAL_LAUNCH_ERROR__
  }));
});
`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", BASE_URL);
    if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/status")) {
      sendJson(res, 200, buildStatusPayload());
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
    if (req.method === "GET" && NATIVE_AUTH_USER_PATHS.has(url.pathname)) {
      if (await handleAuthUser(req, res, { openWebUi: isOpenWebUiAuthPath(url.pathname) })) return;
    }
    if (await handleNativeLogin(req, res, url)) return;
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

server.on("upgrade", (req, socket, head) => {
  try {
    const url = new URL(req.url || "/", BASE_URL);
    if (url.pathname === ADAPTER_PREFIX || url.pathname.startsWith(`${ADAPTER_PREFIX}/`)) {
      proxyUpgrade(req, socket, head, PORTAL_OPL_ADAPTER_URL, ADAPTER_PREFIX);
      return;
    }
    proxyUpgrade(req, socket, head, OPL_WEB_UPSTREAM_URL);
  } catch (error) {
    writeUpgradeFailure(socket, 502, String(error.message || error));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({
    ...buildStatusPayload(),
    port: PORT,
  }, null, 2));
});
