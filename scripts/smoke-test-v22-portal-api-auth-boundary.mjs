import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_api_auth_boundary",
  apiUnauthenticatedStatus: 401,
  shellUnauthenticatedRedirect: "/login",
}, null, 2));
