import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const liveScriptPath = "scripts/live-test-v20.32-portal-opl-message-loop.mjs";

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function deploymentDoc(source, name) {
  const docs = String(source || "").split(/\n---\n/g);
  const found = docs.find((doc) =>
    /kind:\s*Deployment/.test(doc) &&
    new RegExp(`metadata:\\s*\\n\\s*name:\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(doc)
  );
  assert(found, `deployment_doc_missing:${name}`);
  return found;
}

const source = await readFile(liveScriptPath, "utf8");
const gatewayLaunchSource = await readFile("services/opl-web-gateway/src/launch-client-script.mjs", "utf8");
const platformConfig = await readFile("deploy/tke-package/manifests/01-platform-config.yaml", "utf8");
const runnerJobTemplate = await readFile("infra/kubernetes/job-template.yaml", "utf8");

mustMatch(source, /\bRUN_V20_32_LIVE\b/, "live_script_must_reference_run_v20_32_live");
mustMatch(source, /env\(["']RUN_V20_32_LIVE["']\)\s*!==\s*["']1["']/, "live_script_must_require_run_v20_32_live_equal_1");
mustMatch(source, /\bV20_32_PORTAL_BASE_URL\b/, "live_script_must_accept_v20_32_portal_base_url");
mustMatch(source, /\bV20_32_OPL_BASE_URL\b/, "live_script_must_accept_v20_32_opl_base_url");
mustMatch(source, /https:\/\/portal\.medopl\.cn/, "live_script_must_default_to_fixed_portal_host");
mustMatch(source, /https:\/\/opl\.medopl\.cn/, "live_script_must_default_to_fixed_opl_host");
mustMatch(source, /V20_32_ISOLATED_TRANSPORT_CONFIRMED/, "live_script_must_require_isolated_transport_confirmation");
mustMatch(source, /\bassertFixedHostsAndIsolatedTransport\b/, "live_script_must_validate_fixed_hosts_and_isolated_transport");
mustMatch(source, /\bV20_32_BROWSER_PROXY\b|\b--host-resolver-rules\b/, "live_script_must_support_browser_isolated_transport");
mustMatch(source, /\bverifyPortalBuildTag\b/, "live_script_must_verify_portal_build_before_browser_flow");
assert.doesNotMatch(
  source,
  /\bfetch\s*\(\s*`\$\{baseUrl\}\/login`/,
  "live_script_portal_login_must_use_isolated_transport_request_wrapper",
);
mustMatch(
  source,
  /loginPortalSessionCookie[\s\S]*?requestNodeText\(\s*`\$\{baseUrl\}\/login`/,
  "live_script_portal_login_must_use_request_node_text_for_connect_host",
);
mustMatch(
  source,
  /\bLOGIN_GATEWAY_RETRY_STATUSES\b[\s\S]*\b502\b[\s\S]*\b504\b/,
  "live_script_login_must_retry_only_gateway_502_504",
);
mustMatch(
  source,
  /\bV20_32_LOGIN_GATEWAY_RETRIES\b/,
  "live_script_login_gateway_retries_must_be_configurable",
);
mustMatch(
  source,
  /button\.send-button-custom/,
  "live_script_must_support_upstream_opl_icon_send_button",
);
mustMatch(
  source,
  /data-opl-launch-provider-panel/,
  "live_script_must_handle_direct_launch_provider_panel",
);
mustMatch(
  source,
  /\bhandleLaunchProviderPanel\b/,
  "live_script_must_submit_direct_launch_provider_panel_before_message",
);
mustMatch(
  source,
  /waitFor\(\s*\{\s*state:\s*["'](?:detached|hidden)["']/,
  "live_script_must_wait_for_direct_launch_provider_panel_to_clear",
);
mustMatch(
  source,
  /handleLaunchProviderPanel\(page,\s*apiKey,\s*\{\s*timeoutMs:\s*10_000\s*\}\)/,
  "live_script_must_wait_for_direct_launch_provider_panel_after_entering_opl",
);
mustMatch(
  source,
  /handleLaunchProviderPanel\(page,\s*apiKey,\s*\{\s*timeoutMs:\s*3_000\s*\}\)/,
  "live_script_must_recheck_direct_launch_provider_panel_before_sending",
);
mustMatch(
  gatewayLaunchSource,
  /function\s+ensureLaunchProviderKey/,
  "gateway_launch_bridge_must_collect_gflabtoken_for_portal_direct_launch",
);
mustMatch(
  gatewayLaunchSource,
  /data-opl-provider-key/,
  "gateway_launch_bridge_must_render_provider_key_input",
);
mustMatch(
  gatewayLaunchSource,
  /apiKey:\s*providerKey/,
  "gateway_launch_bridge_must_bind_provider_key_to_runtime_session",
);
mustMatch(
  gatewayLaunchSource,
  /\binstallNativeMessageBridge\b/,
  "gateway_launch_bridge_must_install_native_message_bridge",
);
mustMatch(
  gatewayLaunchSource,
  /send-button-custom/,
  "gateway_launch_bridge_must_target_upstream_send_button",
);
mustMatch(
  gatewayLaunchSource,
  /\.sendMessage\(/,
  "gateway_launch_bridge_must_call_portal_message_api",
);
mustMatch(
  gatewayLaunchSource,
  /addEventListener\(\s*["']submit["']/,
  "gateway_launch_bridge_must_capture_native_message_form_submit",
);
mustMatch(
  gatewayLaunchSource,
  /contenteditable/,
  "gateway_launch_bridge_must_read_contenteditable_message_inputs",
);
mustMatch(
  gatewayLaunchSource,
  /consumeNativeMessageEvent/,
  "gateway_launch_bridge_must_dedupe_click_and_submit",
);
assert.doesNotMatch(
  source,
  /LOGIN_GATEWAY_RETRY_STATUSES[\s\S]*\b401\b/,
  "live_script_login_must_not_retry_invalid_credentials",
);
assert.doesNotMatch(
  source,
  /\/正在\|loading\|\.\.\.\/i/,
  "live_script_must_not_treat_every_three_characters_as_loading",
);
assert.doesNotMatch(source, /assert\.notEqual\(parsed\.hostname,\s*["']portal\.medopl\.cn["']/, "live_script_must_allow_fixed_production_portal_host");
assert.doesNotMatch(source, /assert\.notEqual\(parsed\.hostname,\s*["']opl\.medopl\.cn["']/, "live_script_must_allow_fixed_production_opl_host");
assert.doesNotMatch(source, /portal-v20-32\.\$\{baseDomain\}/, "live_script_must_not_require_new_portal_dns");
assert.doesNotMatch(source, /opl-v20-32\.\$\{baseDomain\}/, "live_script_must_not_require_new_opl_dns");
mustMatch(source, /\bfirstReplyLatencyMs\b/, "live_script_must_measure_first_reply_latency_ms");
mustMatch(source, /\bcompleteReplyLatencyMs\b/, "live_script_must_measure_complete_reply_latency_ms");
mustMatch(source, /\bwaitForOplMessageResponse\b/, "live_script_must_wait_for_adapter_message_response");
mustMatch(source, /\/portal-adapter\/api\/opl-launch\/messages/, "live_script_must_observe_real_adapter_message_endpoint");
mustMatch(source, /\bassertLiveMessagePayload\b/, "live_script_must_validate_message_response_payload");
mustMatch(source, /messageReplyPreview/, "live_script_must_record_real_message_reply_preview");
assert.doesNotMatch(source, /const reply = await findReplyLocator\(page\);[\s\S]*?assert\.equal\(evidence\.status,\s*["']done["']/, "live_script_must_not_use_static_page_text_as_reply_success");
assert.doesNotMatch(source, /evidence\.[a-zA-Z0-9_]*\s*=\s*.*(?:cookie|authorization|q-ak|x-cos-security-token|providerKey)/i, "live_script_must_not_assign_sensitive_fields_to_evidence");
mustMatch(source, /cookie\|authorization\|q-ak\|x-cos-security-token\|providerKey/, "live_script_must_redact_sensitive_names");
mustMatch(source, /["'`]请回复：v20\.32[^\n]*["'`]|["'`]v20\.32[^\n]*消息[^\n]*["'`]/, "live_script_must_send_real_message_string");
mustMatch(platformConfig, /PORTAL_INTERNAL_URL:\s*"http:\/\/portal:17080"/, "tke_platform_config_must_route_gateway_internal_login_to_portal_service");
mustMatch(platformConfig, /PORTAL_INTERNAL_BASE_URL:\s*"http:\/\/portal:17080"/, "tke_platform_config_must_route_adapter_run_resource_order_preparation_to_portal_service");
mustMatch(platformConfig, /K8S_NAMESPACE:\s*"__NAMESPACE__"/, "runner_jobs_must_run_in_platform_namespace_to_mount_shared_runtime_pvc");
const workloads = await readFile("deploy/tke-package/manifests/05-platform-workloads.yaml", "utf8");
const gatewayDeployment = deploymentDoc(workloads, "opl-web-gateway");
const adapterDeployment = deploymentDoc(workloads, "portal-opl-adapter");
const runnerDeployment = deploymentDoc(workloads, "med-autoscience-runner");
mustMatch(
  gatewayDeployment,
  /name:\s*PORTAL_INTERNAL_AUTH_TOKEN[\s\S]*?secretKeyRef:[\s\S]*?name:\s*secret-portal[\s\S]*?key:\s*PORTAL_INTERNAL_AUTH_TOKEN/,
  "opl_web_gateway_must_use_the_portal_internal_auth_token_secret",
);
mustMatch(
  adapterDeployment,
  /name:\s*PORTAL_INTERNAL_AUTH_TOKEN[\s\S]*?secretKeyRef:[\s\S]*?name:\s*secret-portal[\s\S]*?key:\s*PORTAL_INTERNAL_AUTH_TOKEN/,
  "portal_opl_adapter_must_use_the_portal_internal_auth_token_secret_for_prepare_run",
);
mustMatch(
  runnerDeployment,
  /name:\s*PORTAL_POSTGRES_URL[\s\S]*?secretKeyRef:[\s\S]*?name:\s*portal-postgres-redis-secret[\s\S]*?key:\s*PORTAL_POSTGRES_URL/,
  "med_autoscience_runner_must_use_portal_postgres_secret",
);
mustMatch(
  runnerDeployment,
  /name:\s*PORTAL_REDIS_URL[\s\S]*?secretKeyRef:[\s\S]*?name:\s*portal-postgres-redis-secret[\s\S]*?key:\s*PORTAL_REDIS_URL/,
  "med_autoscience_runner_must_use_portal_redis_secret",
);
mustMatch(
  runnerJobTemplate,
  /persistentVolumeClaim:\s*\n\s*claimName:\s*portal-platform-runtime/,
  "runtime_job_must_mount_shared_portal_platform_runtime_pvc_for_artifacts",
);
mustMatch(
  runnerJobTemplate,
  /subPathExpr:\s*med-autoscience\/workspaces\/\$\(PORTAL_USER_ID\)\/\$\(WORKSPACE_ID\)\/outputs/,
  "runtime_job_must_mount_workspace_outputs_subpath_from_shared_runtime_pvc",
);
assert.doesNotMatch(
  runnerJobTemplate,
  /hostPath:/,
  "runtime_job_must_not_write_outputs_to_node_local_hostpath",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v20.32_portal_opl_message_loop_static",
  liveScriptPath,
}, null, 2));
