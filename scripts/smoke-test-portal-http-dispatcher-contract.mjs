import assert from "node:assert/strict";

const { createPortalHttpDispatcher } = await import("../services/portal/src/app/portal-http-dispatcher.mjs");

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = "") {
      this.body += String(body || "");
      this.ended = true;
    },
  };
}

function createReq(method, url) {
  return {
    method,
    url,
    headers: {},
  };
}

function createDispatcher(overrides = {}) {
  const calls = [];
  const deps = {
    buildBillingPayload: async () => ({ kind: "billing" }),
    buildOverviewPayload: async () => ({ kind: "overview" }),
    buildPortalHealthPayload: () => ({ ok: true }),
    buildWorkspacePayload: async () => ({ kind: "workspace" }),
    currentUser: async () => {
      calls.push("currentUser");
      return {
        db: { sessions: [] },
        user: { id: "user-1", currentTaskSlug: "default", preferences: {} },
      };
    },
    frontendDistRoot: "/tmp/frontend",
    guessContentType: () => "text/plain",
    handleAuthRoutes: async () => false,
    handleOplRoutes: async () => false,
    handlePortalAdminApiRoutes: async () => false,
    handlePortalAdminOpsRoutes: async () => false,
    handlePortalAdminUserRoutes: async () => false,
    handlePortalApiRoutes: async () => false,
    handlePortalBillingExportRoutes: async () => false,
    handlePortalLegacyRedirectRoutes: async () => false,
    handlePortalTaskSpaceRoutes: async () => false,
    handleResourceOrderRoutes: async ({ user }) => {
      calls.push(user ? "resourceOrder:auth" : "resourceOrder:anon");
      return false;
    },
    handleServerPlanRoutes: async () => false,
    handleWorkspaceStorageRoutes: async () => false,
    layoutV2: (title, body) => `<html><title>${title}</title>${body}</html>`,
    logPortalEvent: async (event) => calls.push(`event:${event.type}`),
    parseForm: () => ({ theme: "dark" }),
    path: {
      join: (...parts) => parts.join("/"),
    },
    readBillingRequestOptions: () => ({ page: "billing" }),
    readBody: async () => Buffer.from(""),
    readOverviewRequestOptions: () => ({ page: "overview" }),
    sendHtml: (res, html, statusCode = 200) => {
      res.writeHead(statusCode, { "content-type": "text/html" });
      res.end(html);
    },
    sendJson: (res, payload, statusCode = 200) => {
      res.writeHead(statusCode, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    },
    sendStaticAsset: async (res, filePath, contentType) => {
      calls.push(`static:${filePath}:${contentType}`);
      res.writeHead(200, { "content-type": contentType });
      res.end("static");
    },
    slugify: (value) => String(value || "").toLowerCase(),
    writeDb: async () => calls.push("writeDb"),
    ...overrides,
  };
  return {
    calls,
    dispatch: createPortalHttpDispatcher(deps),
  };
}

{
  const { calls, dispatch } = createDispatcher();
  const res = createResponse();
  await dispatch(createReq("GET", "/healthz"), res);
  assert.equal(res.statusCode, 200, "healthz_must_return_200");
  assert.deepEqual(calls, [], "healthz_must_not_read_current_user");
}

{
  const { calls, dispatch } = createDispatcher();
  const res = createResponse();
  await dispatch(createReq("GET", "/assets/app.js"), res);
  assert.deepEqual(calls, ["static:/tmp/frontend/assets/app.js:text/plain"], "assets_must_serve_before_auth");
}

{
  const { calls, dispatch } = createDispatcher({
    currentUser: async () => {
      calls.push("currentUser");
      return { db: {}, user: null };
    },
  });
  const res = createResponse();
  await dispatch(createReq("GET", "/portal"), res);
  assert.equal(res.statusCode, 302, "anonymous_user_must_redirect_to_login");
  assert.equal(res.headers.Location, "/login", "anonymous_redirect_target_must_be_login");
  assert.deepEqual(calls, ["currentUser", "resourceOrder:anon"], "anonymous_resource_order_routes_must_run_before_login_redirect");
}

{
  const { calls, dispatch } = createDispatcher({
    handleAuthRoutes: async () => {
      calls.push("auth");
      return true;
    },
  });
  const res = createResponse();
  await dispatch(createReq("GET", "/login"), res);
  assert.equal(res.statusCode, 200, "auth_handler_must_short_circuit");
  assert.deepEqual(calls, ["currentUser", "auth"], "auth_routes_must_run_before_anonymous_resource_order");
}

{
  const { calls, dispatch } = createDispatcher({
    handleOplRoutes: async () => {
      calls.push("opl");
      return false;
    },
    handleWorkspaceStorageRoutes: async () => {
      calls.push("storage");
      return false;
    },
    handlePortalApiRoutes: async () => {
      calls.push("portalApi");
      return false;
    },
  });
  const res = createResponse();
  await dispatch(createReq("POST", "/portal/api/theme"), res);
  assert.equal(JSON.parse(res.body).theme, "dark", "theme_route_must_update_theme");
  assert.deepEqual(
    calls,
    ["currentUser", "resourceOrder:anon", "opl", "storage", "portalApi", "writeDb", "event:theme_changed"],
    "authenticated_dispatch_order_must_remain_stable_before_theme_route",
  );
}

console.log(JSON.stringify({
  ok: true,
  contract: "portal_http_dispatcher",
}, null, 2));
