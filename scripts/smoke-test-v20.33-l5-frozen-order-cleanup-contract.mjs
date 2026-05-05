import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scriptPath = "scripts/live-test-v20.33-l5-frozen-order-cleanup.mjs";
const source = await readFile(scriptPath, "utf8");

function mustMatch(pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

mustMatch(/\bRUN_V20_33_L5_CLEANUP\b/, "l5_cleanup_must_be_opt_in");
mustMatch(/env\(["']RUN_V20_33_L5_CLEANUP["']\)\s*!==\s*["']1["']/, "l5_cleanup_gate_must_require_flag_equal_1");
mustMatch(/\bV20_33_ENV_FILE\b/, "l5_cleanup_must_support_env_files");
mustMatch(/\bV20_33_SECRETS_ENV_FILE\b/, "l5_cleanup_must_support_secrets_env_files");
mustMatch(/https:\/\/portal\.medopl\.cn/, "l5_cleanup_must_default_to_official_portal_host");
mustMatch(/\bassertOfficialPortalHost\b/, "l5_cleanup_must_validate_official_portal_host");
mustMatch(/\bverifyPortalBuildTag\b/, "l5_cleanup_must_verify_deployed_build");
mustMatch(/\bV20_33_L5_CLEANUP_RESOURCE_ORDER_ID\b/, "l5_cleanup_must_require_explicit_order_id");
mustMatch(/\bV20_33_L5_CLEANUP_IDEMPOTENCY_KEY\b/, "l5_cleanup_must_require_explicit_idempotency_key");
mustMatch(/v20\.33-l5-cleanup:\$\{config\.resourceOrderId\}/, "l5_cleanup_idempotency_must_be_bound_to_order_id");
mustMatch(/\bV20_33_PORTAL_INTERNAL_AUTH_TOKEN\b/, "l5_cleanup_must_require_internal_token");
mustMatch(/x-portal-internal-token/, "l5_cleanup_must_use_internal_auth_header");
mustMatch(/\/portal\/internal\/resource-orders\/release/, "l5_cleanup_must_call_internal_release");
mustMatch(/releasePreauth:\s*true/, "l5_cleanup_must_explicitly_release_preauth");
mustMatch(/\/portal\/api\/admin\/customer-accounting\/detail/, "l5_cleanup_must_verify_accounting_detail");
mustMatch(/cleanup_order_must_start_frozen/, "l5_cleanup_must_assert_start_state");
mustMatch(/cleanup_must_write_preauth_release_ledger/, "l5_cleanup_must_assert_release_ledger");
mustMatch(/cleanup_active_freeze_after_release_mismatch/, "l5_cleanup_must_assert_active_freeze_zero");
mustMatch(/\bREAD_ENDPOINTS\b/, "l5_cleanup_must_publish_read_endpoint_inventory");
mustMatch(/\bMUTATING_ENDPOINTS\b/, "l5_cleanup_must_publish_mutating_endpoint_inventory");
mustMatch(/internal_release_only_releasePreauth_true_no_cloud_provisioner/, "l5_cleanup_must_disclose_mutation_boundary");
mustMatch(/\bcreateEvidenceRecorder\b/, "l5_cleanup_must_write_evidence");
mustMatch(/\bV20_33_CONNECT_HOST\b/, "l5_cleanup_must_support_transport_host_override");
mustMatch(/hostname:\s*target\.hostname/, "l5_cleanup_direct_transport_must_set_target_hostname");
mustMatch(/path:\s*`\$\{target\.pathname\}\$\{target\.search\}`/, "l5_cleanup_direct_transport_must_set_target_path");
mustMatch(/\bservername:\s*target\.hostname\b/, "l5_cleanup_transport_must_keep_original_sni_hostname");
mustMatch(/\bheaders:\s*\{[\s\S]{0,200}host:\s*target\.host\b/, "l5_cleanup_transport_must_keep_original_host_header");
mustNotMatch(/requestTarget:\s*target,/, "l5_cleanup_direct_transport_must_not_spread_url_object");

mustNotMatch(/resource-orders\/provision/, "l5_cleanup_must_not_provision_resources");
mustNotMatch(/resource-orders\/delete-node-pool/, "l5_cleanup_must_not_delete_node_pool");
mustNotMatch(/scaleToZero|scale-to-zero|scale_to_zero/, "l5_cleanup_must_not_scale_cloud_resources");
mustNotMatch(/portal\/admin\/recharge/, "l5_cleanup_must_not_recharge_wallets");
mustNotMatch(/portal\/api\/storage\/orders/, "l5_cleanup_must_not_create_storage_orders");
mustNotMatch(/workspace\/files\/upload-url/, "l5_cleanup_must_not_upload_workspace_files");
mustNotMatch(/\bRUN_V20_33_FULL_LOOP\b/, "l5_cleanup_must_not_enable_full_loop");
mustNotMatch(/\bV20_33_CONFIRM_DELETE\b/, "l5_cleanup_must_not_depend_on_delete_confirmation");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_l5_frozen_order_cleanup_static",
  scriptPath,
}, null, 2));
