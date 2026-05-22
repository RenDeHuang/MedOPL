import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "../domain/portal-auth.mjs";
import { createGflabBoundProviderConfig } from "../domain/provider-config.mjs";
import { ensurePublicSiteSettings } from "../domain/portal-public-settings.mjs";
import { createPortalWorkflowFacade } from "../services/portal-workflow-facade.service.mjs";

const OPL_ENTRY_PREFLIGHT_PATH = "/opl/entry/preflight";
const OPL_INTERNAL_AUTH_PATH = "/internal/opl/auth/login";
const PORTAL_AUTH_SUCCESS_LOCATION = "/overview";

export function isRegistrationEnabled(db) {
  return db?.settings?.allowRegistration !== false;
}

export function normalizeAuthEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function findUserByEmail(db, email) {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) return null;
  return db.users.find((item) => normalizeAuthEmail(item.email) === normalizedEmail) || null;
}

export function sanitizePortalUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    authSource: user.authSource || "local",
  };
}

export function authenticatePortalPasswordUser(db, email, password, { isBlockedUserStatus } = {}) {
  const found = findUserByEmail(db, email);
  if (!found) {
    return {
      ok: false,
      status: 401,
      error: "invalid_credentials",
      message: "账号或密码错误。",
    };
  }
  if (!found.passwordHash) {
    return {
      ok: false,
      status: 409,
      error: "password_login_unavailable",
      message: "当前账号没有本地密码，请使用统一身份登录。",
      user: found,
    };
  }
  if (!verifyPassword(password, found.passwordHash)) {
    return {
      ok: false,
      status: 401,
      error: "invalid_credentials",
      message: "账号或密码错误。",
      user: found,
    };
  }
  if (isBlockedUserStatus?.(found.status)) {
    return {
      ok: false,
      status: 403,
      error: "account_blocked",
      message: "当前账号已被禁用，请联系管理员。",
      user: found,
    };
  }
  return { ok: true, user: found };
}

export function createPortalSession(db, user, authSource = user.authSource || "local") {
  const sessionId = randomUUID();
  db.sessions.push({
    id: sessionId,
    userId: user.id,
    createdAt: new Date().toISOString(),
    authSource,
  });
  return sessionId;
}

export async function createPortalUserRecord(db, form, {
  authSource = "local",
  defaultTaskTitle,
  ensureTaskSpace,
  ensureUserCommercialState,
} = {}) {
  const name = String(form.name || "").trim();
  const email = normalizeAuthEmail(form.email);
  const password = String(form.password || "");

  if (!name || !email || !password) {
    return { ok: false, status: 400, message: "姓名、邮箱和密码不能为空。" };
  }
  if (password.length < 8) {
    return { ok: false, status: 400, message: "密码至少需要 8 位。" };
  }
  if (findUserByEmail(db, email)) {
    return { ok: false, status: 409, message: "该邮箱已存在，请直接登录。" };
  }

  const createdAt = new Date().toISOString();
  const createdUser = {
    id: randomUUID(),
    email,
    name,
    role: "user",
    status: "active",
    currentTaskSlug: "",
    preferences: { theme: "light" },
    passwordHash: hashPassword(password),
    createdAt,
    authSource,
  };
  ensureUserCommercialState(createdUser, { grantTrial: true });
  db.users.push(createdUser);
  db.wallets.push({
    userId: createdUser.id,
    balance: 0,
    updatedAt: createdAt,
  });
  return { ok: true, user: createdUser };
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function brandHeader(db, title) {
  const settings = ensurePublicSiteSettings(db || {});
  const logo = settings.siteLogo
    ? `<img src="${escapeHtml(settings.siteLogo)}" alt="${escapeHtml(settings.siteName)}" style="width:48px;height:48px;border-radius:12px;object-fit:contain;border:1px solid rgba(92,126,168,.22);background:#fff;" />`
    : `<div style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--accent);color:#fff;font-weight:700;">${escapeHtml(settings.siteName.slice(0, 1) || "M")}</div>`;
  return `<div class="hero"><div style="display:flex;align-items:center;gap:14px;">${logo}<div><h1>${escapeHtml(title || settings.siteName)}</h1><p>${escapeHtml(settings.siteSubtitle)}</p></div></div></div>`;
}

export function renderPortalLoginPage(db, options = {}) {
  const registrationEnabled = isRegistrationEnabled(db);
  const note = options.note
    ? `<p class="hint">${options.note}</p>`
    : registrationEnabled
      ? `<p class="hint">还没有账号？<a href="/register">注册新账号</a></p>`
      : `<p class="hint">当前关闭自由注册，请联系管理员。</p>`;
  return `${brandHeader(db, "登录")}<div class="card"><form method="post" action="/login"><p><input name="email" type="email" autocomplete="username" placeholder="邮箱" required /></p><p><input name="password" type="password" autocomplete="current-password" placeholder="密码" required /></p><p><button type="submit">登录</button></p></form>${note}<p class="hint"><a href="/home">返回首页</a></p></div>`;
}

export function renderPortalRegisterPage(db, message = "") {
  const messageBlock = message ? `<p class="hint">${message}</p>` : "";
  return `${brandHeader(db, "注册账号")}<div class="card"><form method="post" action="/register"><p><input name="name" type="text" autocomplete="name" placeholder="姓名" required /></p><p><input name="email" type="email" autocomplete="email" placeholder="邮箱" required /></p><p><input name="password" type="password" autocomplete="new-password" placeholder="密码，至少 8 位" minlength="8" required /></p><p><button type="submit">创建账号</button></p></form>${messageBlock}<p class="hint"><a href="/login">返回登录</a></p></div>`;
}

function oplEntryPreflightLoginBody({ providerBound = false } = {}) {
  const apiKeyRequired = providerBound ? "" : " required";
  const boundHint = providerBound
    ? "gflabtoken 模型调用密钥已绑定，可留空继续进入 OPL 工作台。"
    : "请输入你自己的 gflabtoken API Key；它只进入后端密钥边界，不会返回前端。已绑定用户可留空继续进入 OPL 工作台。";
  return `<div class="hero"><h1>OPL 工作台登录</h1></div><div class="card"><form method="post" action="${OPL_ENTRY_PREFLIGHT_PATH}"><p><label>账号/邮箱<br /><input name="email" type="email" autocomplete="username" required /></label></p><p><label>密码<br /><input name="password" type="password" autocomplete="current-password" required /></label></p><p><label>gflabtoken API Key<br /><input name="apiKey" type="password" autocomplete="off"${apiKeyRequired} /></label></p><p class="hint">${boundHint}</p><p><button type="submit">进入 OPL 工作台</button></p></form></div>`;
}

function isOplEntryPreflightPath(pathname = "") {
  return pathname === OPL_ENTRY_PREFLIGHT_PATH || pathname === OPL_INTERNAL_AUTH_PATH;
}

function parseOplEntryPreflightPayload(req, bodyText = "", parseForm) {
  const source = String(bodyText || "").trim();
  if (!source) return {};
  const contentType = String(req.headers?.["content-type"] || "").toLowerCase();
  if (contentType.includes("application/json") || source.startsWith("{")) return JSON.parse(source);
  return parseForm(source);
}

function oplEntryProviderApiKey(payload = {}, normalizeProviderApiKey) {
  return normalizeProviderApiKey(
    payload.apiKey ||
    payload.api_key ||
    payload.providerApiKey ||
    payload.provider_api_key ||
    payload.gflabtoken ||
    payload.gflabToken ||
    ""
  );
}

function boundStatusText(value = "") {
  const status = String(value || "").trim();
  return status || "bound";
}

function findBoundGflabProviderKeyBinding(db = {}, user = {}, workspaceId = "") {
  const bindings = Array.isArray(db.providerKeyBindings) ? db.providerKeyBindings : [];
  return [...bindings].reverse().find((binding) => {
    if (String(binding.provider || "gflabtoken") !== "gflabtoken") return false;
    if (String(binding.userId || "") !== String(user.id || "")) return false;
    if (workspaceId && String(binding.workspaceId || "") && String(binding.workspaceId) !== workspaceId) return false;
    if (!String(binding.providerKeyRef || binding.providerConfigSecretRef || "")) return false;
    const status = boundStatusText(binding.boundStatus || binding.status || binding.providerConfigStatus);
    return status === "bound" || status === "configured";
  }) || null;
}

function upsertGflabProviderKeyBinding(db = {}, user = {}, workspaceId = "", providerConfigResult = {}) {
  if (!Array.isArray(db.providerKeyBindings)) db.providerKeyBindings = [];
  const providerKeyRef = String(providerConfigResult.providerKeyRef || providerConfigResult.providerConfigSecretRef || "").trim();
  const existing = findBoundGflabProviderKeyBinding(db, user, workspaceId);
  const now = new Date().toISOString();
  if (existing) {
    existing.providerKeyRef = providerKeyRef || existing.providerKeyRef;
    existing.providerConfigSecretRef = providerKeyRef || existing.providerConfigSecretRef || existing.providerKeyRef;
    existing.boundStatus = "bound";
    existing.providerConfigStatus = "configured";
    existing.updatedAt = now;
    return existing;
  }
  const binding = {
    id: `provider-binding-${randomUUID()}`,
    tenantId: String(user.tenantId || ""),
    userId: String(user.id || ""),
    workspaceId,
    provider: "gflabtoken",
    providerKeyRef,
    providerConfigSecretRef: providerKeyRef,
    boundStatus: "bound",
    providerConfigStatus: "configured",
    createdAt: now,
    updatedAt: now,
  };
  db.providerKeyBindings.push(binding);
  return binding;
}

function providerKeyPublicPayload(binding = {}) {
  binding = binding || {};
  const providerKeyRef = String(binding.providerKeyRef || binding.providerConfigSecretRef || "").trim();
  return {
    provider: "gflabtoken",
    providerBound: Boolean(providerKeyRef),
    providerKeyRef,
    boundStatus: boundStatusText(binding.boundStatus || binding.providerConfigStatus),
  };
}

function oidcStateCookie() {
  return "portal_oidc_state";
}

function buildOidcAuthorizeUrl(state, prompt = "", portalOidc = {}) {
  const url = new URL("/oauth/v2/authorize", `${portalOidc.issuer}/`);
  url.searchParams.set("client_id", portalOidc.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", portalOidc.scope);
  url.searchParams.set("redirect_uri", portalOidc.redirectUri);
  url.searchParams.set("state", state);
  if (prompt) url.searchParams.set("prompt", prompt);
  return url.toString();
}

export function createPortalAuthRuntimeHandler({
  clearCookie,
  createGflabProviderConfig,
  defaultTaskTitle,
  ensureTaskSpace,
  ensureUserCommercialState,
  exchangeOidcCode,
  fetchOidcUserInfo,
  isBlockedUserStatus,
  layoutV2,
  logPortalEvent,
  normalizeProviderApiKey,
  oplLaunchService,
  workflowFacade = createPortalWorkflowFacade(),
  parseCookies,
  parseForm,
  portalInternalAuthAllowed,
  portalOidc,
  readBody,
  redactProviderConfig,
  sendHtml,
  sendJson,
  setCookie,
  writeDb,
}) {
  async function persistAuthSession(db) {
    if (typeof writeDb.persistPortalSessions === "function") {
      await writeDb.persistPortalSessions(db);
      return;
    }
    await writeDb(db);
  }

  async function registerLocalPortalUser(db, form) {
    if (!isRegistrationEnabled(db)) {
      return { ok: false, status: 403, title: "注册已关闭", message: "当前关闭自由注册，请联系管理员。" };
    }

    const result = await createPortalUserRecord(db, form, {
      authSource: "local",
      defaultTaskTitle,
      ensureTaskSpace,
      ensureUserCommercialState,
    });
    if (!result.ok) {
      return { ...result, title: "注册失败" };
    }
    await logPortalEvent({
      type: "user_registered",
      userId: result.user.id,
      operatorId: result.user.id,
      email: result.user.email,
    });
    return { ok: true, user: result.user };
  }

  return async function handlePortalAuthRoutes({ req, res, url, db }) {
    if (req.method === "GET" && url.pathname === "/register") {
      if (portalOidc.enabled) {
        sendHtml(res, layoutV2("注册", renderPortalRegisterPage(db), null));
        return true;
      }
      if (!isRegistrationEnabled(db)) {
        sendHtml(res, layoutV2("注册已关闭", renderPortalLoginPage(db), null), 403);
        return true;
      }
      sendHtml(res, layoutV2("注册", renderPortalRegisterPage(db), null));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/register") {
      const form = parseForm((await readBody(req)).toString("utf8"));
      const result = await registerLocalPortalUser(db, form);
      if (!result.ok) {
        const body = result.status === 403 ? renderPortalLoginPage(db, { note: result.message }) : renderPortalRegisterPage(db, result.message);
        sendHtml(res, layoutV2(result.title, body, null), result.status);
        return true;
      }
      const sessionId = createPortalSession(db, result.user, "local");
      await writeDb(db);
      setCookie(res, "portal_session", sessionId);
      res.writeHead(302, { Location: PORTAL_AUTH_SUCCESS_LOCATION });
      res.end();
      return true;
    }

    if (req.method === "GET" && url.pathname === "/login") {
      sendHtml(res, layoutV2("登录", renderPortalLoginPage(db), null));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/login") {
      const form = parseForm((await readBody(req)).toString("utf8"));
      const authResult = authenticatePortalPasswordUser(db, form.email, form.password, { isBlockedUserStatus });
      if (!authResult.ok) {
        sendHtml(res, layoutV2("登录失败", `<div class="card">${authResult.message}</div>`, null), authResult.status);
        return true;
      }
      const sessionId = createPortalSession(db, authResult.user, "local");
      await persistAuthSession(db);
      setCookie(res, "portal_session", sessionId);
      res.writeHead(302, { Location: PORTAL_AUTH_SUCCESS_LOCATION });
      res.end();
      return true;
    }

    if (req.method === "GET" && isOplEntryPreflightPath(url.pathname)) {
      if (!portalInternalAuthAllowed(req)) {
        sendHtml(res, `<div class="card">internal auth token mismatch</div>`, 403);
        return true;
      }
      sendHtml(res, layoutV2("OPL 工作台登录", oplEntryPreflightLoginBody({
        providerBound: url.searchParams.get("providerBound") === "1",
      }), null));
      return true;
    }

    if (req.method === "POST" && isOplEntryPreflightPath(url.pathname)) {
      if (!portalInternalAuthAllowed(req)) {
        sendJson(res, { ok: false, error: "forbidden", message: "internal auth token mismatch" }, 403);
        return true;
      }
      const bodyText = (await readBody(req)).toString("utf8");
      let payload = {};
      try {
        payload = parseOplEntryPreflightPayload(req, bodyText, parseForm);
      } catch {
        sendJson(res, { ok: false, error: "invalid_payload", message: "request body must be json or form data" }, 400);
        return true;
      }

      const email = String(payload.email || payload.username || payload.loginName || "").trim();
      const password = String(payload.password || "").trim();
      const taskSlug = String(payload.task || payload.workspaceId || payload.taskSlug || "").trim();
      const providerApiKey = oplEntryProviderApiKey(payload, normalizeProviderApiKey);
      if (!email || !password) {
        sendJson(res, { ok: false, error: "invalid_credentials", message: "邮箱和密码不能为空。" }, 400);
        return true;
      }
      if (!taskSlug) {
        sendJson(res, {
          ok: false,
          error: "workspace_id_required",
          message: "必须指定要进入的工作空间。",
        }, 422);
        return true;
      }

      const authResult = authenticatePortalPasswordUser(db, email, password, { isBlockedUserStatus });
      if (!authResult.ok) {
        if (authResult.user) {
          await logPortalEvent({
            type: "opl_native_login_rejected",
            userId: authResult.user.id,
            source: "opl-web-gateway",
            reason: authResult.error,
          });
        }
        sendJson(res, {
          ok: false,
          error: authResult.error,
          message: authResult.message,
        }, authResult.status);
        return true;
      }

      const user = authResult.user;
      const existingBinding = findBoundGflabProviderKeyBinding(db, user, taskSlug);
      if (!providerApiKey && !existingBinding) {
        sendJson(res, {
          ok: false,
          error: "provider_api_key_required",
          message: "请输入你自己的 gflabtoken API Key 后再进入 OPL。",
        }, 400);
        return true;
      }

      const providerConfigResult = providerApiKey
        ? createGflabProviderConfig({
          userId: user.id,
          workspaceId: taskSlug,
          apiKey: providerApiKey,
        })
        : createGflabBoundProviderConfig({
          userId: user.id,
          workspaceId: taskSlug,
          providerKeyRef: existingBinding.providerKeyRef || existingBinding.providerConfigSecretRef,
          providerConfigSecretRef: existingBinding.providerConfigSecretRef || existingBinding.providerKeyRef,
        });
      if (!providerConfigResult.ok) {
        sendJson(res, {
          ok: false,
          error: providerConfigResult.error,
          message: providerConfigResult.message,
        }, 400);
        return true;
      }
      const launchResult = await workflowFacade.runOplLaunchCommand({
        payload: {
          source: "opl-native-login",
          taskSlug,
          userId: user.id,
        },
        execute: () => oplLaunchService.prepareLaunch({
          db,
          user,
          taskSlug,
          requireRealOplWeb: true,
          source: "opl-native-login",
          providerConfig: providerConfigResult.providerConfig,
          providerConfigSecretRef: providerConfigResult.providerConfigSecretRef,
          providerKeyPayload: providerApiKey
            ? {
              provider: "gflabtoken",
              source: "user_input",
              apiKey: providerApiKey,
            }
            : null,
        }),
      });
      if (!launchResult.ok) {
        sendJson(res, {
          ok: false,
          error: launchResult.error,
          message: launchResult.message || "",
          reasons: launchResult.reasons || [],
        }, launchResult.status || 500);
        return true;
      }

      const providerBinding = providerApiKey
        ? upsertGflabProviderKeyBinding(db, user, taskSlug, providerConfigResult)
        : existingBinding;
      if (providerApiKey) await writeDb(db);

      sendJson(res, {
        ok: true,
        user: sanitizePortalUser(user),
        launchToken: launchResult.launch.launchToken || "",
        launch: launchResult.launch,
        workspace: launchResult.taskSpace,
        workspaceSession: launchResult.workspaceSession,
        runtimeSession: {
          runtimeSessionId: launchResult.launch.runtimeSessionId || "",
          oplSessionId: launchResult.launch.oplSessionId || "",
        },
        ...providerKeyPublicPayload(providerBinding),
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/auth/oidc/login") {
      const state = randomUUID();
      clearCookie(res, oidcStateCookie());
      setCookie(res, oidcStateCookie(), state);
      const prompt = url.searchParams.get("prompt") === "login" ? "login" : "";
      res.writeHead(302, { Location: buildOidcAuthorizeUrl(state, prompt, portalOidc) });
      res.end();
      return true;
    }

    if (req.method === "GET" && url.pathname === "/auth/oidc/callback") {
      const cookies = parseCookies(req.headers.cookie);
      const state = String(url.searchParams.get("state") || "");
      const code = String(url.searchParams.get("code") || "");
      if (!state || !code || cookies[oidcStateCookie()] !== state) {
        sendHtml(res, layoutV2("登录失败", `<div class="card">统一登录校验失败，请重试。</div>`, null), 400);
        return true;
      }
      const token = await exchangeOidcCode(code);
      const accessToken = String(token.access_token || "");
      if (!accessToken) {
        sendHtml(res, layoutV2("登录失败", `<div class="card">无法完成统一登录，请稍后再试。</div>`, null), 502);
        return true;
      }
      const profile = await fetchOidcUserInfo(accessToken);
      const email = String(profile.email || profile.preferred_username || "").toLowerCase();
      if (!email) {
        sendHtml(res, layoutV2("登录失败", `<div class="card">统一身份没有返回可用邮箱。</div>`, null), 400);
        return true;
      }
      let portalUser = db.users.find((item) => String(item.email || "").toLowerCase() === email);
      if (!portalUser) {
        portalUser = {
          id: randomUUID(),
          email,
          name: String(profile.name || profile.preferred_username || email).trim(),
          role: "user",
          status: "active",
          currentTaskSlug: "",
          preferences: { theme: "light" },
          passwordHash: "",
          createdAt: new Date().toISOString(),
          authSource: "zitadel_oidc",
        };
        ensureUserCommercialState(portalUser, { grantTrial: true });
        db.users.push(portalUser);
        db.wallets.push({ userId: portalUser.id, balance: 0, updatedAt: new Date().toISOString() });
        await logPortalEvent({ type: "user_provisioned_from_zitadel", userId: portalUser.id, email });
      }
      if (isBlockedUserStatus(portalUser.status)) {
        sendHtml(res, layoutV2("登录失败", `<div class="card">当前账号已被禁用，请联系管理员。</div>`, null), 403);
        return true;
      }
      const sessionId = createPortalSession(db, portalUser, "zitadel_oidc");
      await writeDb(db);
      clearCookie(res, oidcStateCookie());
      setCookie(res, "portal_session", sessionId);
      res.writeHead(302, { Location: PORTAL_AUTH_SUCCESS_LOCATION });
      res.end();
      return true;
    }

    if (req.method === "GET" && url.pathname === "/logout") {
      clearCookie(res, "portal_session");
      clearCookie(res, oidcStateCookie());
      clearCookie(res, "workspace_session");
      clearCookie(res, "refreshToken");
      clearCookie(res, "token_provider");
      res.writeHead(302, { Location: "/login?force_login=1" });
      res.end();
      return true;
    }

    return false;
  };
}
