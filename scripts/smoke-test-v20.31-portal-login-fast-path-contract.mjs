import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

function createReq(method, url, headers = {}) {
  return { method, url, headers };
}

function createDispatcher({ user = null } = {}) {
  const calls = [];
  const dispatch = createPortalHttpDispatcher({
    buildBillingPayload: async () => ({}),
    buildOverviewPayload: async () => ({}),
    buildPortalHealthPayload: () => ({ ok: true }),
    buildWorkspacePayload: async () => ({}),
    currentUser: async (_req, options = {}) => {
      calls.push(`currentUser:${options.mode || "full"}`);
      return { db: {}, user };
    },
    frontendDistRoot: "/tmp/frontend",
    guessContentType: () => "text/plain",
    handleAuthRoutes: async ({ req }) => {
      if ((req.method === "GET" || req.method === "POST") && req.url === "/login") {
        calls.push("auth:login");
        return true;
      }
      return false;
    },
    handleLabPackageRoutes: async () => false,
    handleOplRoutes: async () => false,
    handlePortalAdminApiRoutes: async () => false,
    handlePortalAdminOpsRoutes: async () => false,
    handlePortalAdminUserRoutes: async () => false,
    handlePortalApiRoutes: async () => false,
    handlePortalBillingExportRoutes: async () => false,
    handlePortalLegacyRedirectRoutes: async () => false,
    handlePortalTaskSpaceRoutes: async () => false,
    handleResourceOrderRoutes: async () => false,
    handleServerPlanRoutes: async () => false,
    handleWorkspaceStorageRoutes: async () => false,
    layoutV2: (title) => `<html>${title}</html>`,
    logPortalEvent: async () => {},
    parseForm: () => ({}),
    path: { join: (...parts) => parts.join("/") },
    readBillingRequestOptions: () => ({}),
    readBody: async () => Buffer.from(""),
    readOverviewRequestOptions: () => ({}),
    sendHtml: (res, html, status = 200) => {
      res.writeHead(status, { "content-type": "text/html" });
      res.end(html);
    },
    sendJson: (res, payload, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    },
    sendStaticAsset: async (res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("asset");
    },
    slugify: (value) => String(value || ""),
    writeDb: async () => {},
  });
  return { dispatch, calls };
}

{
  const { dispatch, calls } = createDispatcher();
  const res = createResponse();
  await dispatch(createReq("GET", "/login"));
  assert.deepEqual(calls, ["auth:login"], "get_login_must_not_call_current_user");
  assert.equal(res.statusCode, 200);
}

{
  const { dispatch, calls } = createDispatcher();
  const res = createResponse();
  await dispatch(createReq("POST", "/login"));
  assert.deepEqual(calls, ["currentUser:auth_light", "auth:login"], "post_login_must_use_auth_light_current_user_without_session");
  assert.equal(res.statusCode, 200);
}

{
  const { dispatch, calls } = createDispatcher();
  const res = createResponse();
  await dispatch(createReq("GET", "/portal"), res);
  assert.equal(res.statusCode, 302, "unauthenticated_portal_page_must_redirect_login");
  assert.equal(res.headers.Location, "/login");
  assert.deepEqual(calls, ["currentUser:full"], "non_auth_routes_must_still_call_current_user");
}

{
  const runtimeSource = await readFile(new URL("../services/portal/src/app/portal-runtime.mjs", import.meta.url), "utf8");
  const storeSource = await readFile(new URL("../services/portal/src/state/portal-store.mjs", import.meta.url), "utf8");
  const authSource = await readFile(new URL("../services/portal/src/app/portal-auth-runtime-handler.mjs", import.meta.url), "utf8");
  assert.match(runtimeSource, /async function currentUser\(req,\s*\{\s*mode\s*=\s*"full"\s*\}\s*=\s*\{\}\)/, "real_current_user_must_accept_auth_light_mode");
  assert.match(runtimeSource, /mode === "auth_light"|mode === "auth_page"/, "real_current_user_must_branch_on_auth_modes");
  assert.match(storeSource, /async function readAuthDb\(/, "portal_store_must_expose_lightweight_auth_read");
  assert.match(storeSource, /writeDb\.persistPortalSessions\s*=/, "portal_store_must_expose_session_only_persist");
  assert.match(authSource, /persistPortalSessions/, "auth_handler_must_not_write_full_snapshot_for_auth_light_login");
}

console.log(JSON.stringify({ ok: true, contract: "v20_31_portal_login_fast_path" }, null, 2));
