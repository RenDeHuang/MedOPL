import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const liveScriptPath = "scripts/live-test-v20.33-isolated-full-loop.mjs";

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

const source = await readFile(liveScriptPath, "utf8");

mustMatch(source, /\bRUN_V20_33_FULL_LOOP\b/, "full_loop_gate_must_be_opt_in");
mustMatch(source, /env\(["']RUN_V20_33_FULL_LOOP["']\)\s*!==\s*["']1["']/, "full_loop_gate_must_require_run_flag_equal_1");
mustMatch(source, /\bassertFixedHostsAndIsolatedTransport\b/, "full_loop_gate_must_validate_fixed_hosts_and_isolated_transport");
mustMatch(source, /https:\/\/portal\.medopl\.cn/, "full_loop_gate_must_default_to_fixed_portal_host");
mustMatch(source, /https:\/\/opl\.medopl\.cn/, "full_loop_gate_must_default_to_fixed_opl_host");
mustMatch(source, /\bV20_33_ISOLATED_TRANSPORT_CONFIRMED\b/, "full_loop_gate_must_require_isolated_transport_confirmation");
mustMatch(source, /\bV20_33_EXPECTED_BUILD_TAG\b/, "full_loop_gate_must_require_expected_build_tag");
mustMatch(source, /\bverifyPortalBuildTag\b/, "full_loop_gate_must_verify_portal_build_before_mutation");
mustNotMatch(source, /portal-v20-33\.\$\{baseDomain\}/, "full_loop_gate_must_not_require_new_portal_dns");
mustNotMatch(source, /opl-v20-33\.\$\{baseDomain\}/, "full_loop_gate_must_not_require_new_opl_dns");
mustMatch(source, /\bV20_33_CONFIRM_DELETE\b/, "full_loop_gate_must_require_explicit_delete_confirmation");

const requiredStages = [
  "admin_login",
  "admin_user_create",
  "admin_user_lookup",
  "wallet_topup",
  "portal_login",
  "storage_order",
  "workspace_upload",
  "server_plan_select",
  "resource_quote",
  "resource_freeze",
  "resource_provision",
  "user_resources",
  "opl_native_login",
  "opl_session_bind",
  "opl_message",
  "opl_file_run",
  "workspace_download",
  "billing_trace",
  "delete_node_pool",
  "billing_stop_observe",
  "t0_120min_checkpoint",
  "t1_audit_checkpoint",
];

for (const stage of requiredStages) {
  mustMatch(source, new RegExp(stage), `full_loop_gate_must_include_stage:${stage}`);
}

const requiredRoutes = [
  "/portal/admin/create-user",
  "/portal/admin/recharge",
  "/portal/api/me",
  "/portal/api/storage/orders",
  "/portal/api/workspace/files/upload-url",
  "/portal/api/workspace/files/download-url",
  "/portal/api/resource-orders/quote",
  "/portal/api/resource-orders/freeze",
  "/portal/api/resource-orders/provision",
  "/portal/api/my/resources",
  "/portal/api/billing",
  "/portal/api/session-traces",
  "/portal/api/resource-orders/delete-node-pool",
  "/api/auth/login",
];

for (const route of requiredRoutes) {
  mustMatch(source, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `full_loop_gate_must_reference_route:${route}`);
}

const requiredEnvNames = [
  "V20_33_PORTAL_BASE_URL",
  "V20_33_OPL_BASE_URL",
  "V20_33_ADMIN_EMAIL",
  "V20_33_ADMIN_PASSWORD",
  "V20_33_GFLABTOKEN",
  "V20_33_RECHARGE_AMOUNT",
  "V20_33_STORAGE_GB",
  "V20_33_SERVER_PLAN_ID",
  "V20_33_BILLING_OBSERVE_MINUTES",
];

for (const name of requiredEnvNames) {
  mustMatch(source, new RegExp(`\\b${name}\\b`), `full_loop_gate_must_reference_env:${name}`);
}

mustMatch(source, /\bV20_33_CONNECT_HOST\b/, "full_loop_gate_must_support_transport_host_override_for_isolated_staging");
mustMatch(source, /\bV20_33_CONNECT_PORT\b/, "full_loop_gate_must_support_transport_port_override_for_isolated_staging");
mustMatch(source, /\bV20_33_ALLOW_INSECURE_TLS\b/, "full_loop_gate_must_require_explicit_insecure_tls_opt_in");
mustMatch(source, /\bservername:\s*target\.hostname\b/, "transport_override_must_keep_original_sni_hostname");
mustMatch(source, /\bheaders:\s*\{[\s\S]{0,200}host:\s*target\.host\b/, "transport_override_must_keep_original_host_header");
mustMatch(source, /\brequestOptionsFor\b/, "transport_override_must_build_single_request_options_object");
mustMatch(source, /\btransport\.request\(requestOptions\b/, "transport_request_must_use_node_supported_options_callback_signature");
mustNotMatch(source, /\btransport\.request\([^,\n]+,\s*\{[\s\S]{0,260},\s*\(res\)\s*=>/, "transport_request_must_not_mix_url_object_options_callback_signature");
mustMatch(source, /\bparseEnvFileContent\b/, "full_loop_gate_must_parse_env_files_without_shell_source");
mustMatch(source, /\bV20_33_ENV_FILE\b/, "full_loop_gate_must_accept_non_shell_env_file");

mustMatch(source, /\bresourceorderid\b/, "full_loop_gate_must_assert_resourceorderid_tag");
mustMatch(source, /\brunid\b/, "full_loop_gate_must_assert_runid_tag");
mustMatch(source, /\bserverplanid\b/, "full_loop_gate_must_assert_serverplanid_tag");
mustMatch(source, /\btenantid\b/, "full_loop_gate_must_assert_tenantid_tag");
mustMatch(source, /\bworkspaceid\b/, "full_loop_gate_must_assert_workspaceid_tag");
mustMatch(source, /\brunStage\b/, "full_loop_gate_must_record_uniform_stage_timing");
mustMatch(source, /\bstartedAt\b/, "full_loop_gate_must_record_stage_started_at");
mustMatch(source, /\bendedAt\b/, "full_loop_gate_must_record_stage_ended_at");
mustMatch(source, /\blatencyMs\b/, "full_loop_gate_must_record_stage_latency_ms");
mustMatch(source, /\bcostRisk\b/, "full_loop_gate_must_record_stage_cost_risk");
mustMatch(source, /\bfirstReplyLatencyMs\b/, "full_loop_gate_must_record_opl_first_reply_latency");
mustMatch(source, /\bcompleteReplyLatencyMs\b/, "full_loop_gate_must_record_opl_complete_reply_latency");
mustMatch(source, /\binspectResourceOrderVisibility\b/, "full_loop_gate_must_inspect_resource_order_visibility_before_provision");
mustMatch(source, /"resource_order_visibility"/, "full_loop_gate_must_record_resource_order_visibility_stage");
mustMatch(source, /\bexpectedResourceOrderId\b/, "full_loop_gate_must_record_expected_resource_order_id_in_diagnostics");
mustMatch(source, /\bvisibleInResourceOrders\b/, "full_loop_gate_must_record_resource_order_list_visibility");
mustMatch(source, /\bresourceOrderStatus\b/, "full_loop_gate_must_record_resource_order_status_before_provision");
mustMatch(source, /resource_provision[\s\S]{0,900}preProvisionVisibility/, "full_loop_gate_must_attach_pre_provision_visibility_to_provision_stage");
mustMatch(source, /\bdestroyCvmInstances\b/, "full_loop_gate_must_delete_cvm_instances_when_confirmed");
mustMatch(source, /delete-node-pool/, "full_loop_gate_must_use_delete_node_pool_confirmation");
mustNotMatch(source, /deleteNodePoolPayload[\s\S]{0,240}nodePoolId/, "full_loop_gate_must_not_send_client_node_pool_id_to_delete");
mustMatch(source, /cookie\|authorization\|q-ak\|x-cos-security-token\|providerKey\|password\|secret\|token/i, "full_loop_gate_must_redact_sensitive_names");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_isolated_full_loop_static",
  liveScriptPath,
}, null, 2));
