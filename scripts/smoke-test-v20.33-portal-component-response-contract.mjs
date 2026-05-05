import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scriptPath = "scripts/live-test-v20.33-portal-component-response.mjs";
const routerPath = "services/portal/frontend/src/router/index.ts";
const apiPath = "services/portal/frontend/src/api/portal.ts";
const script = await readFile(scriptPath, "utf8");
const router = await readFile(routerPath, "utf8");
const api = await readFile(apiPath, "utf8");

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

const routeMatches = [...router.matchAll(/\{\s*path:\s*"([^"]+)"/g)].map((match) => match[1]);
assert.equal(routeMatches.length, 23, "portal_router_must_currently_define_23_routes_including_root_redirect");
assert.equal(routeMatches.filter((route) => route !== "/").length, 22, "portal_router_must_currently_define_22_renderable_routes");

const exportedApiFunctions = [...api.matchAll(/export async function\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]);
assert.equal(exportedApiFunctions.length, 60, "portal_api_must_currently_export_60_functions");

mustMatch(script, /\bRUN_V20_33_COMPONENT_RESPONSE\b/, "component_response_gate_must_be_opt_in");
mustMatch(script, /env\(["']RUN_V20_33_COMPONENT_RESPONSE["']\)\s*!==\s*["']1["']/, "component_response_gate_must_require_run_flag_equal_1");
mustMatch(script, /https:\/\/portal\.medopl\.cn/, "component_response_must_default_to_official_portal_host");
mustMatch(script, /\bV20_33_EXPECTED_BUILD_TAG\b/, "component_response_must_verify_v20_33_build_tag");
mustMatch(script, /\bassertFixedHosts\b/, "component_response_must_validate_official_host");
mustMatch(script, /\bV20_33_CONNECT_HOST\b/, "component_response_must_support_isolated_transport_host_mapping");
mustMatch(script, /--host-resolver-rules/, "component_response_must_support_browser_host_resolver_rules");
mustMatch(script, /\bPORTAL_RENDERABLE_ROUTES\b/, "component_response_must_define_full_route_inventory");
mustMatch(script, /\bPORTAL_SHARED_COMPONENTS\b/, "component_response_must_define_shared_component_inventory");
mustMatch(script, /\bEXPECTED_API_FUNCTION_COUNT\s*=\s*60\b/, "component_response_must_record_60_api_function_inventory");
mustMatch(script, /\bEXPECTED_ROUTE_COUNT\s*=\s*23\b/, "component_response_must_record_23_router_route_inventory");
mustMatch(script, /\bEXPECTED_RENDERABLE_ROUTE_COUNT\s*=\s*22\b/, "component_response_must_record_22_renderable_route_inventory");
mustMatch(script, /\bEXPECTED_SHARED_COMPONENT_COUNT\s*=\s*8\b/, "component_response_must_record_8_shared_component_inventory");
mustMatch(script, /\bresolveDynamicRouteTargets\b/, "component_response_must_resolve_admin_dynamic_routes_from_live_data");
mustMatch(script, /\binspectInteractiveControls\b/, "component_response_must_inspect_buttons_links_forms_and_dialogs");
mustMatch(script, /\bclickSafeControl\b/, "component_response_must_exercise_safe_controls");
mustMatch(script, /\bunsafeMutationPatterns\b/, "component_response_must_classify_unsafe_mutations");
mustMatch(script, /\bskippedUnsafeControls\b/, "component_response_must_report_skipped_unsafe_controls");
mustMatch(script, /\bcomponentCoverage\b/, "component_response_must_report_component_coverage");
mustMatch(script, /\binactiveSourceComponents\b/, "component_response_must_report_inactive_source_components");
mustMatch(script, /\bfullSourceComponentResponseOk\b/, "component_response_must_report_strict_source_component_response_status");
mustMatch(script, /\bexpectedRuntime\b/, "component_response_must_distinguish_runtime_mounted_components");
mustMatch(script, /\bsourceUsageCount\b/, "component_response_must_count_component_source_usage");
mustMatch(script, /\brouteCoverage\b/, "component_response_must_report_route_coverage");
mustMatch(script, /\bapiInventory\b/, "component_response_must_report_api_inventory");
mustNotMatch(script, /resource-orders\/provision/, "component_response_must_not_provision_resources");
mustNotMatch(script, /delete-node-pool/, "component_response_must_not_delete_node_pool");
mustNotMatch(script, /portal\/admin\/recharge/, "component_response_must_not_recharge_wallets");
mustNotMatch(script, /opl-launch\/messages/, "component_response_must_not_send_model_messages");

for (const route of routeMatches.filter((item) => item !== "/")) {
  mustMatch(script, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `component_response_must_cover_route:${route}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_portal_component_response_static",
  scriptPath,
  routeCount: routeMatches.length,
  renderableRouteCount: routeMatches.filter((route) => route !== "/").length,
  apiFunctionCount: exportedApiFunctions.length,
}, null, 2));
