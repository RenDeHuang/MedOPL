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

function createDispatcher({ user = { id: "user-1", currentTaskSlug: "default", preferences: {} } } = {}) {
  const calls = [];
  const dispatch = createPortalHttpDispatcher({
    buildBillingPayload: async () => {
      calls.push("buildBillingPayload");
      return {};
    },
    buildOverviewPayload: async () => {
      calls.push("buildOverviewPayload");
      return {};
    },
    buildPortalHealthPayload: () => ({ ok: true }),
    buildWorkspacePayload: async () => {
      calls.push("buildWorkspacePayload");
      return {};
    },
    currentUser: async (_req, options = {}) => {
      calls.push(`currentUser:${options.mode || "full"}`);
      if ((options.mode || "full") === "full") return { db: { kind: "full" }, user };
      return { db: { kind: "auth" }, user };
    },
    frontendDistRoot: "/tmp/frontend",
    guessContentType: () => "text/html; charset=utf-8",
    handleAuthRoutes: async () => false,
    handleLabPackageRoutes: async () => {
      calls.push("labPackageRoutes");
      return false;
    },
    handleOplRoutes: async () => {
      calls.push("oplRoutes");
      return false;
    },
    handlePortalAdminApiRoutes: async () => {
      calls.push("adminApiRoutes");
      return false;
    },
    handlePortalAdminOpsRoutes: async () => {
      calls.push("adminOpsRoutes");
      return false;
    },
    handlePortalAdminUserRoutes: async () => {
      calls.push("adminUserRoutes");
      return false;
    },
    handlePortalApiRoutes: async () => {
      calls.push("portalApiRoutes");
      return false;
    },
    handlePortalBillingExportRoutes: async () => false,
    handlePortalLegacyRedirectRoutes: async () => false,
    handlePortalTaskSpaceRoutes: async () => false,
    handleResourceOrderRoutes: async ({ user: routeUser }) => {
      calls.push(routeUser ? "resourceOrderRoutes:auth" : "resourceOrderRoutes:anon");
      return false;
    },
    handleServerPlanRoutes: async () => {
      calls.push("serverPlanRoutes");
      return false;
    },
    handleWorkspaceStorageRoutes: async () => {
      calls.push("workspaceStorageRoutes");
      return false;
    },
    layoutV2: (title, body) => `<html><title>${title}</title>${body}</html>`,
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
    sendStaticAsset: async (res, filePath, contentType) => {
      calls.push(`static:${filePath}:${contentType}`);
      res.writeHead(200, { "content-type": contentType });
      res.end("<!doctype html><div id=\"app\"></div>");
    },
    slugify: (value) => String(value || ""),
    writeDb: async () => {},
  });
  return { calls, dispatch };
}

{
  const { calls, dispatch } = createDispatcher();
  const res = createResponse();
  await dispatch(createReq("GET", "/portal/app/overview", { cookie: "portal_session=session-1" }), res);
  assert.equal(res.statusCode, 200, "portal_app_shell_must_return_200_for_authenticated_user");
  assert.deepEqual(
    calls,
    ["currentUser:shell", "static:/tmp/frontend/index.html:text/html; charset=utf-8"],
    "portal_app_shell_must_not_enter_full_db_or_business_handlers_before_serving_index",
  );
}

{
  const { calls, dispatch } = createDispatcher({ user: null });
  const res = createResponse();
  await dispatch(createReq("GET", "/portal/app/resources"), res);
  assert.equal(res.statusCode, 302, "anonymous_portal_app_shell_must_redirect_login");
  assert.equal(res.headers.Location, "/login", "anonymous_portal_app_shell_redirect_target");
  assert.deepEqual(
    calls,
    ["currentUser:shell"],
    "anonymous_portal_app_shell_must_only_use_shell_auth_before_redirect",
  );
}

{
  const { calls, dispatch } = createDispatcher();
  const res = createResponse();
  await dispatch(createReq("GET", "/portal/api/overview", { cookie: "portal_session=session-1" }), res);
  assert.equal(res.statusCode, 200, "portal_api_overview_must_still_work");
  assert.deepEqual(
    calls.slice(0, 2),
    ["currentUser:full", "resourceOrderRoutes:anon"],
    "portal_api_must_keep_full_user_context",
  );
  assert(calls.includes("buildOverviewPayload"), "portal_api_overview_must_still_build_payload");
}

{
  const runtimeSource = await readFile(new URL("../services/portal/src/app/portal-runtime.mjs", import.meta.url), "utf8");
  const dispatcherSource = await readFile(new URL("../services/portal/src/app/portal-http-dispatcher.mjs", import.meta.url), "utf8");
  assert.match(runtimeSource, /mode === "shell"/, "current_user_must_support_shell_mode");
  assert.match(runtimeSource, /\bauth_ms\b/, "current_user_must_record_auth_ms_timing");
  assert.match(dispatcherSource, /\bshell_ms\b/, "dispatcher_must_record_shell_ms_timing");
  assert.match(runtimeSource, /\bfull_user_ms\b/, "current_user_must_record_full_user_ms_timing");
  assert.match(dispatcherSource, /isPortalAppShellRequest/, "dispatcher_must_name_portal_app_shell_fast_path");
  assert.match(dispatcherSource, /currentUser\(req,\s*\{\s*mode:\s*"shell"\s*\}\)/, "portal_app_shell_must_call_current_user_shell_mode");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_portal_shell_fast_path",
}, null, 2));
