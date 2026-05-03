import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "../domain/portal-auth.mjs";

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
    currentTaskSlug: "default",
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
  await ensureTaskSpace(db, createdUser, "default", defaultTaskTitle("default"));
  return { ok: true, user: createdUser };
}

function localLoginBody(db, options = {}) {
  const registrationEnabled = isRegistrationEnabled(db);
  const note = options.note
    ? `<p class="hint">${options.note}</p>`
    : registrationEnabled
      ? `<p class="hint">还没有账号？<a href="/register">注册新账号</a></p>`
      : `<p class="hint">当前关闭自由注册，请联系管理员。</p>`;
  return `<div class="hero"><h1>统一门户</h1></div><div class="card"><form method="post" action="/login"><p><input name="email" type="email" placeholder="邮箱" required /></p><p><input name="password" type="password" placeholder="密码" required /></p><p><button type="submit">登录</button></p></form>${note}</div>`;
}

function localRegisterBody(message = "") {
  const messageBlock = message ? `<p class="hint">${message}</p>` : "";
  return `<div class="hero"><h1>注册账号</h1></div><div class="card"><form method="post" action="/register"><p><input name="name" type="text" placeholder="姓名" required /></p><p><input name="email" type="email" placeholder="邮箱" required /></p><p><input name="password" type="password" placeholder="密码，至少 8 位" minlength="8" required /></p><p><button type="submit">创建账号</button></p></form>${messageBlock}<p class="hint"><a href="/login">返回登录</a></p></div>`;
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
  async function registerLocalPortalUser(db, form) {
    if (portalOidc.enabled) {
      return { ok: false, status: 400, title: "注册不可用", message: "统一身份模式下不提供本地注册。" };
    }
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
        res.writeHead(302, { Location: "/login" });
        res.end();
        return true;
      }
      if (!isRegistrationEnabled(db)) {
        sendHtml(res, layoutV2("注册已关闭", localLoginBody(db), null), 403);
        return true;
      }
      sendHtml(res, layoutV2("注册", localRegisterBody(), null));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/register") {
      if (portalOidc.enabled) {
        res.writeHead(302, { Location: "/login" });
        res.end();
        return true;
      }
      const form = parseForm((await readBody(req)).toString("utf8"));
      const result = await registerLocalPortalUser(db, form);
      if (!result.ok) {
        const body = result.status === 403 ? localLoginBody(db, { note: result.message }) : localRegisterBody(result.message);
        sendHtml(res, layoutV2(result.title, body, null), result.status);
        return true;
      }
      const sessionId = createPortalSession(db, result.user, "local");
      await writeDb(db);
      setCookie(res, "portal_session", sessionId);
      res.writeHead(302, { Location: "/portal" });
      res.end();
      return true;
    }

    if (req.method === "GET" && url.pathname === "/login") {
      if (!portalOidc.enabled) {
        sendHtml(res, layoutV2("登录", localLoginBody(db), null));
        return true;
      }
      const loginHref = url.searchParams.get("force_login") === "1" ? "/auth/oidc/login?prompt=login" : "/auth/oidc/login";
      sendHtml(res, layoutV2("统一登录", `<div class="hero"><h1>统一登录</h1></div><div class="card"><p><a href="${loginHref}">使用统一账号登录</a></p><p class="hint">${isRegistrationEnabled(db) ? "如需新账号，请先在统一身份侧注册。" : "当前关闭自由注册，请联系管理员。"}</p></div>`, null));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/login") {
      if (portalOidc.enabled) {
        res.writeHead(302, { Location: "/auth/oidc/login" });
        res.end();
        return true;
      }
      const form = parseForm((await readBody(req)).toString("utf8"));
      const authResult = authenticatePortalPasswordUser(db, form.email, form.password, { isBlockedUserStatus });
      if (!authResult.ok) {
        sendHtml(res, layoutV2("登录失败", `<div class="card">${authResult.message}</div>`, null), authResult.status);
        return true;
      }
      const sessionId = createPortalSession(db, authResult.user, "local");
      await writeDb(db);
      setCookie(res, "portal_session", sessionId);
      res.writeHead(302, { Location: "/portal" });
      res.end();
      return true;
    }

    if (req.method === "POST" && url.pathname === "/internal/opl/auth/login") {
      if (!portalInternalAuthAllowed(req)) {
        sendJson(res, { ok: false, error: "forbidden", message: "internal auth token mismatch" }, 403);
        return true;
      }
      const bodyText = (await readBody(req)).toString("utf8");
      let payload = {};
      try {
        payload = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        sendJson(res, { ok: false, error: "invalid_json", message: "request body must be json" }, 400);
        return true;
      }

      const email = String(payload.email || payload.username || payload.loginName || "").trim();
      const password = String(payload.password || "").trim();
      const taskSlug = String(payload.task || payload.workspaceId || payload.taskSlug || "default").trim();
      const providerApiKey = normalizeProviderApiKey(
        payload.apiKey ||
        payload.api_key ||
        payload.experimentalBearerToken ||
        payload.experimental_bearer_token ||
        payload.providerApiKey ||
        payload.provider_api_key ||
        payload.gflabtoken ||
        payload.gflabToken ||
        ""
      );
      if (!email || !password) {
        sendJson(res, { ok: false, error: "invalid_credentials", message: "邮箱和密码不能为空。" }, 400);
        return true;
      }
      if (!providerApiKey) {
        sendJson(res, {
          ok: false,
          error: "provider_api_key_required",
          message: "请输入 gflabtoken API key 后再进入 OPL。",
        }, 400);
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
      const providerConfigResult = createGflabProviderConfig({
        userId: user.id,
        workspaceId: taskSlug,
        apiKey: providerApiKey,
      });
      if (!providerConfigResult.ok) {
        sendJson(res, {
          ok: false,
          error: providerConfigResult.error,
          message: providerConfigResult.message,
        }, 400);
        return true;
      }
      const launchResult = await oplLaunchService.prepareLaunch({
        db,
        user,
        taskSlug,
        requireRealOplWeb: true,
        source: "opl-native-login",
        providerConfig: providerConfigResult.providerConfig,
        providerConfigSecretRef: providerConfigResult.providerConfigSecretRef,
        providerKeyPayload: {
          provider: "gflabtoken",
          source: "user_input",
          apiKey: providerApiKey,
        },
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
        ...redactProviderConfig(providerConfigResult),
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
          currentTaskSlug: "default",
          preferences: { theme: "light" },
          passwordHash: "",
          createdAt: new Date().toISOString(),
          authSource: "zitadel_oidc",
        };
        ensureUserCommercialState(portalUser, { grantTrial: true });
        db.users.push(portalUser);
        db.wallets.push({ userId: portalUser.id, balance: 0, updatedAt: new Date().toISOString() });
        await ensureTaskSpace(db, portalUser, "default", defaultTaskTitle("default"));
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
      res.writeHead(302, { Location: "/portal" });
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
