import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scriptPath = "scripts/live-test-v20.33-l5-frozen-order-audit.mjs";
const source = await readFile(scriptPath, "utf8");

function mustMatch(pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

mustMatch(/\bRUN_V20_33_L5_AUDIT\b/, "l5_audit_must_be_opt_in");
mustMatch(/env\(["']RUN_V20_33_L5_AUDIT["']\)\s*!==\s*["']1["']/, "l5_audit_gate_must_require_flag_equal_1");
mustMatch(/\bV20_33_ENV_FILE\b/, "l5_audit_must_support_env_files");
mustMatch(/\bV20_33_SECRETS_ENV_FILE\b/, "l5_audit_must_support_secrets_env_files");
mustMatch(/https:\/\/portal\.medopl\.cn/, "l5_audit_must_default_to_official_portal_host");
mustMatch(/\bassertOfficialPortalHost\b/, "l5_audit_must_validate_official_portal_host");
mustMatch(/\bverifyPortalBuildTag\b/, "l5_audit_must_verify_deployed_build");
mustMatch(/\/portal\/api\/admin\/users/, "l5_audit_must_read_admin_users");
mustMatch(/\/portal\/api\/admin\/customer-accounting\/detail/, "l5_audit_must_read_customer_accounting_detail");
mustMatch(/\bV20_33_L5_AUDIT_USER_QUERY\b/, "l5_audit_must_allow_user_query");
mustMatch(/\bV20_33_L5_AUDIT_USER_ID\b/, "l5_audit_must_allow_explicit_user_id");
mustMatch(/\bV20_33_L5_AUDIT_RESOURCE_ORDER_ID\b/, "l5_audit_must_allow_explicit_order_id");
mustMatch(/\blatestFailedLoopEvidence\b/, "l5_audit_must_link_failed_l5_evidence");
mustMatch(/\bauditWindowFromEvidence\b/, "l5_audit_must_derive_time_window_from_failed_l5_evidence");
mustMatch(/\bfrozenResourceOrders\b/, "l5_audit_must_report_frozen_orders");
mustMatch(/\brelevantLedger\b/, "l5_audit_must_report_order_ledger_entries");
mustMatch(/\bauthSideEffect:\s*["']portal_session_cookie_only["']/, "l5_audit_must_disclose_auth_session_side_effect");
mustMatch(/\bREAD_ONLY_ENDPOINTS\b/, "l5_audit_must_publish_read_only_endpoint_inventory");
mustMatch(/\bcreateEvidenceRecorder\b/, "l5_audit_must_write_evidence");
mustMatch(/\bV20_33_CONNECT_HOST\b/, "l5_audit_must_support_transport_host_override");
mustMatch(/hostname:\s*target\.hostname/, "l5_audit_direct_transport_must_set_target_hostname");
mustMatch(/path:\s*`\$\{target\.pathname\}\$\{target\.search\}`/, "l5_audit_direct_transport_must_set_target_path");
mustMatch(/\bservername:\s*target\.hostname\b/, "l5_audit_transport_must_keep_original_sni_hostname");
mustMatch(/\bheaders:\s*\{[\s\S]{0,200}host:\s*target\.host\b/, "l5_audit_transport_must_keep_original_host_header");
mustNotMatch(/requestTarget:\s*target,/, "l5_audit_direct_transport_must_not_spread_url_object");

mustNotMatch(/resource-orders\/provision/, "l5_audit_must_not_provision_resources");
mustNotMatch(/resource-orders\/delete-node-pool/, "l5_audit_must_not_delete_node_pool");
mustNotMatch(/resource-orders\/release/, "l5_audit_must_not_release_orders");
mustNotMatch(/portal\/admin\/recharge/, "l5_audit_must_not_recharge_wallets");
mustNotMatch(/portal\/api\/storage\/orders/, "l5_audit_must_not_create_storage_orders");
mustNotMatch(/workspace\/files\/upload-url/, "l5_audit_must_not_upload_workspace_files");
mustNotMatch(/\bRUN_V20_33_FULL_LOOP\b/, "l5_audit_must_not_enable_full_loop");
mustNotMatch(/\bV20_33_CONFIRM_DELETE\b/, "l5_audit_must_not_depend_on_delete_confirmation");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_l5_frozen_order_audit_static",
  scriptPath,
}, null, 2));
