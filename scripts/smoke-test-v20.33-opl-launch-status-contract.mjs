import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routes = await readFile("services/portal/src/routes/opl.routes.mjs", "utf8");
const service = await readFile("services/portal/src/services/opl-launch.service.mjs", "utf8");
const featureHandlers = await readFile("services/portal/src/app/portal-feature-runtime-handlers.mjs", "utf8");
const router = await readFile("services/portal/frontend/src/router/index.ts", "utf8");
const view = await readFile("services/portal/frontend/src/views/opl/OplLaunchView.vue", "utf8");
const api = await readFile("services/portal/frontend/src/api/portal.ts", "utf8");
const runtimeBridge = await readFile("services/opl-runtime-bridge/src/runtime-bridge-launch.mjs", "utf8");

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

for (const stage of ["workspace_ready", "provider_key_bound", "session_created", "gateway_ready", "opl_opening"]) {
  mustMatch(routes + service + view + runtimeBridge, new RegExp(stage), `opl_launch_must_reference_stage:${stage}`);
}

mustMatch(service, /\bcreateLaunchIntent\b/, "launch_service_must_create_launch_intent");
mustMatch(service, /\bgetLaunchStatus\b/, "launch_service_must_expose_launch_status");
mustMatch(service, /\bupdateLaunchStage\b/, "launch_service_must_update_launch_stage");
mustMatch(service, /\buserVisibleState\b/, "launch_service_must_record_user_visible_state");
mustMatch(service, /\bblockingUser\b/, "launch_service_must_record_blocking_user");

mustMatch(routes, /launch-status/, "routes_must_expose_launch_status_api_path");
mustMatch(routes, /\?<launchId>/, "routes_must_capture_launch_status_id");
mustMatch(routes, /\bhandleOplLaunchStatusApi\b/, "routes_must_handle_launch_status_api");
mustMatch(routes, /status\.userId !== user\.id/, "routes_must_scope_launch_status_to_current_user");
mustNotMatch(routes, /\.catch\(\(\) => \{\}\)/, "portal_opl_page_must_not_swallow_launch_errors");
mustMatch(routes, /opl_launch_prepare_background_failed/, "routes_must_record_background_launch_failure_event");
mustMatch(routes, /catch \(eventError\)/, "routes_must_handle_background_failure_event_write_errors");
mustMatch(routes, /\/portal\/app\/opl-launch\?launchId=/, "portal_opl_page_must_redirect_to_preparation_view");
mustNotMatch(routes, /if \(!result\.ok\)[\s\S]{0,260}res\.writeHead\(302,\s*\{\s*Location:\s*result\.launch\.oplWebUrl/, "portal_opl_page_must_not_block_then_redirect_directly");

mustMatch(featureHandlers, /\bcreateOplRoutes\b[\s\S]*\bwriteDb\b/, "feature_handlers_must_pass_write_db_to_opl_routes");
mustMatch(router, /\/opl-launch/, "frontend_router_must_include_opl_launch_route");
mustMatch(router, /OplLaunchView\.vue/, "frontend_router_must_load_opl_launch_view");

mustMatch(view, /\bfetchOplLaunchStatus\b/, "launch_view_must_poll_status_endpoint_by_user_action_cycle");
mustMatch(view, /\bwindow\.location\.assign\(status\.value\.oplWebUrl\)/, "launch_view_must_redirect_when_opl_ready");
mustMatch(view, /\bworkspace_ready\b[\s\S]*\bprovider_key_bound\b[\s\S]*\bsession_created\b[\s\S]*\bgateway_ready\b[\s\S]*\bopl_opening\b/, "launch_view_must_render_ordered_stages");
mustNotMatch(view, /kubectl|YAML|RBAC|nodePool|TKE|CVM/, "launch_view_must_not_show_internal_infra_terms");

mustMatch(api, /\bexport interface OplLaunchStatusPayload\b/, "api_must_define_opl_launch_status_payload");
mustMatch(api, /\bexport async function fetchOplLaunchStatus\b/, "api_must_export_launch_status_fetcher");
mustMatch(api, /apiClient\.get<OplLaunchStatusPayload>\(`\/opl\/launch-status\/\$\{encodeURIComponent\(launchId\)\}`\)/, "api_must_fetch_launch_status_by_id");

mustMatch(runtimeBridge, /\blaunchStatus\b/, "runtime_bridge_launch_state_must_include_launch_status");
mustMatch(runtimeBridge, /\bworkspace_ready\b/, "runtime_bridge_must_record_workspace_ready_stage");
mustMatch(runtimeBridge, /\bsession_created\b/, "runtime_bridge_must_record_session_created_stage");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_opl_launch_status",
}, null, 2));
