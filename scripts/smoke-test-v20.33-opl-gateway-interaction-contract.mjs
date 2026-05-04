import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const launchClient = await readFile("services/opl-web-gateway/src/launch-client-script.mjs", "utf8");
const config = await readFile("services/opl-web-gateway/src/config.mjs", "utf8");
const proxy = await readFile("services/opl-web-gateway/src/proxy.mjs", "utf8");
const server = await readFile("services/opl-web-gateway/src/server.mjs", "utf8");

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

for (const marker of ["portal_launch_ready_ms", "opl_dom_ready_ms", "opl_first_interaction_ms"]) {
  mustMatch(launchClient + config, new RegExp(marker), `gateway_must_expose_timing_marker:${marker}`);
}

mustMatch(launchClient, /\bperformance\.now\(\)/, "launch_client_must_use_browser_performance_clock");
mustMatch(launchClient, /\bmarkOplTelemetry\b/, "launch_client_must_have_telemetry_marker_function");
mustMatch(launchClient, /window\.__OPL_PORTAL_TIMING__/, "launch_client_must_publish_timing_state");
mustMatch(launchClient, /opl:portal-telemetry/, "launch_client_must_dispatch_telemetry_event");
mustMatch(launchClient, /portal_launch_ready_ms[\s\S]*opl_dom_ready_ms[\s\S]*opl_first_interaction_ms/, "launch_client_must_order_beginner_timing_markers");

mustMatch(launchClient, /\bensureLaunchProviderKey\b/, "launch_client_must_keep_provider_key_binding");
mustMatch(launchClient, /\bsendMessage\b/, "launch_client_must_keep_send_action_bridge");
mustMatch(launchClient, /\binstallNativeMessageBridge\b/, "launch_client_must_keep_native_message_bridge");
mustMatch(launchClient, /\bconsumeNativeMessageEvent\b[\s\S]*markFirstInteraction/, "native_message_send_must_mark_first_interaction");
mustMatch(launchClient, /\binstallNativeRunBridge\b[\s\S]*markFirstInteraction/, "native_module_click_must_mark_first_interaction");
mustMatch(launchClient, /window\.__OPL_PORTAL__\.markFirstInteraction/, "stable_browser_api_must_expose_first_interaction_marker");

mustNotMatch(launchClient + proxy + server, /one-person-lab-upstream|patch-package|npm\s+patch|git\s+apply|upstream\s+patch/i, "gateway_must_not_patch_upstream");

mustMatch(proxy, /response\.body\.getReader\(\)/, "http_proxy_must_stream_response_body");
mustMatch(proxy, /contentType\.includes\("text\/html"\)/, "http_proxy_may_only_inject_html");
mustMatch(proxy, /\bproxyUpgrade\b/, "gateway_must_keep_websocket_upgrade_proxy");
mustMatch(server, /\bADAPTER_PREFIX\b[\s\S]*PORTAL_OPL_ADAPTER_URL[\s\S]*OPL_WEB_UPSTREAM_URL/, "server_must_keep_adapter_and_upstream_routes_separate");

mustMatch(config, /\bgatewayInteractionTargets\b/, "status_payload_must_expose_gateway_interaction_targets");
mustMatch(config, /domReadyMs:\s*5000/, "status_payload_must_expose_dom_ready_target");
mustMatch(config, /firstInteractionMs:\s*8000/, "status_payload_must_expose_first_interaction_target");
mustMatch(config, /firstReplyMs:\s*10000/, "status_payload_must_expose_first_reply_target");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_opl_gateway_interaction",
}, null, 2));
