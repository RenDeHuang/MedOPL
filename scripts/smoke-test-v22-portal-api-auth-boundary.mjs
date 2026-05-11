import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { createPortalHttpDispatcher } = await import("../services/portal/src/app/portal-http-dispatcher.mjs");

const dispatcherSource = await readFile("services/portal/src/app/portal-http-dispatcher.mjs", "utf8");
const apiClientSource = await readFile("services/portal/frontend/src/api/client.ts", "utf8");

assert(dispatcherSource.includes("function isPortalApiRequest"), "portal_dispatcher_must_detect_api_requests");
assert(dispatcherSource.includes('url.pathname.startsWith("/portal/api/")'), "portal_api_detection_must_cover_portal_api_prefix");
assert(dispatcherSource.includes('url.pathname === "/portal/api"'), "portal_api_detection_must_cover_portal_api_root");
assert(dispatcherSource.includes('sendJson(res, { ok: false, error: "unauthenticated", loginUrl: "/login" }, 401)'), "portal_api_unauthenticated_must_return_json_401");
assert(dispatcherSource.includes('res.writeHead(302, { Location: "/login"'), "portal_shell_unauthenticated_must_keep_login_redirect");
assert(apiClientSource.includes('baseURL: "/portal/api"'), "portal_frontend_api_client_must_use_portal_api_base");
assert(apiClientSource.includes("apiClient.interceptors.response.use"), "portal_frontend_api_client_must_handle_auth_response_boundary");
assert(apiClientSource.includes("authRedirectStarted"), "portal_frontend_api_client_must_dedupe_auth_redirects");
assert(apiClientSource.includes('data?.error === "unauthenticated"'), "portal_frontend_api_client_must_only_redirect_on_unauthenticated_error");
assert(apiClientSource.includes("window.location.assign(loginUrl)"), "portal_frontend_api_client_must_redirect_to_contract_login_url");

function responseRecorder() {
  return {
    statusCode: 0,
    payload: null,
    headers: {},
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = headers;
    },
    end() {},
  };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

const apiRes = responseRecorder();
let currentUserCalled = false;
const dispatcher = createPortalHttpDispatcher({
  buildBillingDetailsPayload: async () => ({}),
  buildBillingPayload: async () => ({}),
  buildBillingSummaryPayload: async () => ({}),
  buildOverviewPayload: async () => ({}),
  buildPortalHealthPayload: () => ({ ok: true }),
  buildWorkspacePayload: async () => ({}),
  currentUser: async () => {
    currentUserCalled = true;
    throw new Error("current_user_must_not_run_for_unauthenticated_api");
  },
  frontendDistRoot: "",
  guessContentType: () => "text/plain",
  handleAuthRoutes: async () => false,
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
  layoutV2: (_title, body) => body,
  logPortalEvent: async () => {},
  parseForm: () => ({}),
  path: { join: (...parts) => parts.join("/") },
  readBillingRequestOptions: () => ({}),
  readBody: async () => Buffer.from(""),
  readOverviewRequestOptions: () => ({}),
  sendHtml: () => {},
  sendJson,
  sendStaticAsset: async () => {},
  slugify: (value) => String(value || ""),
  writeDb: async () => {},
});

await dispatcher({ method: "GET", url: "/portal/api/me", headers: {} }, apiRes);
assert.equal(currentUserCalled, false, "unauthenticated_api_must_not_read_full_user_state_before_401");
assert.equal(apiRes.statusCode, 401, "unauthenticated_api_must_return_401_without_full_state_read");
assert.deepEqual(apiRes.payload, { ok: false, error: "unauthenticated", loginUrl: "/login" }, "unauthenticated_api_payload_mismatch");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_api_auth_boundary",
  apiUnauthenticatedStatus: 401,
  shellUnauthenticatedRedirect: "/login",
}, null, 2));
