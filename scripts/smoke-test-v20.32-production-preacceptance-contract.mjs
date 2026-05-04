import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scriptPath = "scripts/live-test-v20.32-production-preacceptance.mjs";
const source = await readFile(scriptPath, "utf8");

function mustMatch(pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

mustMatch(/\bRUN_V20_32_PREACCEPTANCE\b/, "preacceptance_must_be_opt_in");
mustMatch(/env\(["']RUN_V20_32_PREACCEPTANCE["']\)\s*!==\s*["']1["']/, "preacceptance_must_require_run_flag_equal_1");
mustMatch(/https:\/\/portal\.medopl\.cn/, "preacceptance_must_default_to_fixed_portal_host");
mustMatch(/https:\/\/opl\.medopl\.cn/, "preacceptance_must_default_to_fixed_opl_host");
mustMatch(/https:\/\/trace\.medopl\.cn/, "preacceptance_must_default_to_fixed_trace_host");
mustMatch(/\bassertFixedHosts\b/, "preacceptance_must_validate_fixed_hosts");
mustMatch(/\bV20_32_CONNECT_HOST\b/, "preacceptance_must_support_connect_host_transport");
mustMatch(/--host-resolver-rules/, "preacceptance_must_support_browser_host_resolver_rules");
mustNotMatch(/portal-v20-32\.\$\{baseDomain\}/, "preacceptance_must_not_require_new_portal_dns");
mustNotMatch(/opl-v20-32\.\$\{baseDomain\}/, "preacceptance_must_not_require_new_opl_dns");

for (const route of [
  "/portal/app/overview",
  "/portal/app/packages",
  "/portal/app/resources",
  "/portal/app/workspace",
  "/portal/app/billing",
  "/portal/app/trace",
  "/portal/app/admin/dashboard",
  "/portal/app/admin/alerts",
  "/portal/app/admin/users",
  "/portal/app/admin/groups",
  "/portal/app/admin/usage",
  "/portal/app/admin/billing-ops",
  "/portal/app/admin/system",
  "/portal/app/admin/ops",
  "/portal/app/admin/sandboxes",
  "/portal/app/admin/audit",
]) {
  mustMatch(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `preacceptance_must_cover_route:${route}`);
}

for (const api of [
  "/portal/api/overview",
  "/portal/api/lab-packages",
  "/portal/api/my/resources",
  "/portal/api/workspace",
  "/portal/api/billing",
  "/portal/api/session-traces",
  "/portal/api/admin/overview",
  "/portal/api/admin/alerts",
  "/portal/api/admin/users",
  "/portal/api/admin/groups",
  "/portal/api/admin/usage",
  "/portal/api/admin/billing-ops",
  "/portal/api/admin/system",
  "/portal/api/admin/ops",
  "/portal/api/admin/sandboxes",
  "/portal/api/admin/audit",
]) {
  mustMatch(new RegExp(api.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `preacceptance_must_probe_api:${api}`);
}

mustMatch(/expectedUserNav/, "preacceptance_must_check_user_navigation_links");
mustMatch(/expectedAdminNav/, "preacceptance_must_check_admin_navigation_links");
mustMatch(/forbiddenPrimaryLinks/, "preacceptance_must_reject_legacy_primary_links");
mustMatch(/\/portal\/opl/, "preacceptance_must_check_portal_opl_jump");
mustMatch(/\bportalToOplJumpLatencyMs\b/, "preacceptance_must_record_portal_opl_jump_latency");
mustMatch(/\bloginLatencyMs\b/, "preacceptance_must_record_login_latency");
mustMatch(/\bmaxPageLatencyMs\b/, "preacceptance_must_record_page_latency_summary");
mustMatch(/\bmaxApiLatencyMs\b/, "preacceptance_must_record_api_latency_summary");
mustMatch(/\btracePageLatencyMs\b/, "preacceptance_must_record_trace_page_latency");
mustMatch(/\bV20_32_PREACCEPTANCE_CONTENT_TIMEOUT_MS\b/, "preacceptance_must_wait_for_page_business_text");
mustMatch(/waitForFunction[\s\S]*requiredText/, "preacceptance_must_wait_for_required_page_text");
mustMatch(/no_cvm_create_delete_no_model_message/, "preacceptance_must_be_non_resource_mutating_by_default");
mustMatch(/V20_32_EXPECTED_BUILD_TAG/, "preacceptance_must_check_expected_build_tag");
mustMatch(/verifyPortalBuildTag/, "preacceptance_must_verify_portal_build_tag");
mustMatch(/cookie\|authorization\|q-ak\|x-cos-security-token\|providerKey\|password\|secret\|token/i, "preacceptance_must_redact_sensitive_names");
mustNotMatch(/delete-node-pool/, "preacceptance_must_not_delete_node_pool");
mustNotMatch(/resource-orders\/provision/, "preacceptance_must_not_provision_resources");
mustNotMatch(/opl-launch\/messages/, "preacceptance_must_not_send_model_message");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.32_production_preacceptance_static",
  scriptPath,
}, null, 2));
