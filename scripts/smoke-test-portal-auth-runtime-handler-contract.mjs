import assert from "node:assert/strict";

const { createPortalAuthRuntimeHandler } = await import("../services/portal/src/app/portal-auth-runtime-handler.mjs");
const { hashPassword } = await import("../services/portal/src/domain/portal-auth.mjs");

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: "",
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = "") {
      this.body += String(body || "");
    },
  };
}

function createRequest(method, path, body = "", headers = {}) {
  return {
    req: { method, headers, [Symbol.asyncIterator]: async function* iterator() { if (body) yield Buffer.from(body); } },
    res: createResponseRecorder(),
    url: new URL(path, "http://portal.local"),
  };
}

const cookies = [];
const events = [];
const db = {
  settings: { allowRegistration: true },
  sessions: [],
  users: [{
    id: "user-1",
    email: "alice@example.test",
    name: "Alice",
    role: "user",
    status: "active",
    passwordHash: hashPassword("Password123!"),
    currentTaskSlug: "default",
    preferences: { theme: "light" },
  }],
  wallets: [],
};

const handleAuthRoutes = createPortalAuthRuntimeHandler({
  clearCookie: (res, name) => {
    cookies.push(["clear", name]);
    res.headers[`clear-${name}`] = "1";
  },
  createGflabProviderConfig: () => ({ ok: false, error: "not_used", message: "not used" }),
  defaultTaskTitle: (slug) => slug,
  ensureTaskSpace: async () => ({}),
  ensureUserCommercialState: () => {},
  fetchOidcUserInfo: async () => ({}),
  isBlockedUserStatus: (status) => String(status || "active") === "disabled",
  layoutV2: (title, body) => `<title>${title}</title>${body}`,
  logPortalEvent: async (event) => events.push(event),
  normalizeProviderApiKey: (value) => String(value || "").trim(),
  oplLaunchService: { prepareLaunch: async () => ({ ok: false, status: 500 }) },
  parseCookies: (cookieHeader = "") => Object.fromEntries(String(cookieHeader || "").split(";").map((item) => item.trim().split("=")).filter(([key]) => key)),
  parseForm: (text) => Object.fromEntries(new URLSearchParams(text)),
  portalOidc: {
    clientId: "portal-client",
    clientSecret: "secret",
    enabled: false,
    issuer: "https://issuer.example.test",
    redirectUri: "https://portal.example.test/auth/oidc/callback",
    scope: "openid profile email",
  },
  portalInternalAuthAllowed: () => true,
  readBody: async (req) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
  },
  redactProviderConfig: () => ({}),
  runZitadelAdminUser: async () => ({ synced: false }),
  sendHtml: (res, html, status = 200) => {
    res.statusCode = status;
    res.body = html;
  },
  sendJson: (res, payload, status = 200) => {
    res.statusCode = status;
    res.body = JSON.stringify(payload);
  },
  setCookie: (res, name, value) => {
    cookies.push(["set", name, value]);
    res.headers[`set-${name}`] = value;
  },
  writeDb: async () => {},
});

let request = createRequest("GET", "/login");
let handled = await handleAuthRoutes({ ...request, db });
assert.equal(handled, true, "local_login_page_must_be_handled");
assert.equal(request.res.statusCode, 200, "local_login_page_must_return_200");
assert.equal(request.res.body.includes("action=\"/login\""), true, "local_login_page_must_render_form");

request = createRequest("POST", "/login", new URLSearchParams({ email: "alice@example.test", password: "Password123!" }).toString());
handled = await handleAuthRoutes({ ...request, db });
assert.equal(handled, true, "local_login_post_must_be_handled");
assert.equal(request.res.statusCode, 302, "local_login_post_must_redirect");
assert.equal(request.res.headers.Location, "/portal", "local_login_post_must_redirect_portal");
assert.equal(db.sessions.length, 1, "local_login_post_must_create_session");
assert.equal(cookies.some(([kind, name]) => kind === "set" && name === "portal_session"), true, "local_login_post_must_set_session_cookie");

request = createRequest("GET", "/logout");
handled = await handleAuthRoutes({ ...request, db });
assert.equal(handled, true, "logout_must_be_handled");
assert.equal(request.res.statusCode, 302, "logout_must_redirect");
assert.equal(cookies.some(([kind, name]) => kind === "clear" && name === "portal_session"), true, "logout_must_clear_session_cookie");

request = createRequest("GET", "/portal/not-auth");
handled = await handleAuthRoutes({ ...request, db });
assert.equal(handled, false, "unmatched_route_must_not_be_claimed");

console.log(JSON.stringify({
  ok: true,
  contract: "portal_auth_runtime_handler",
}, null, 2));
