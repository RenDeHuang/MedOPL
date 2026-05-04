import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scriptPath = "scripts/check-v20.32-production-readiness.mjs";

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

const source = await readFile(scriptPath, "utf8");

mustMatch(source, /\bRUN_V20_32_PRODUCTION_READINESS\b/, "production_readiness_must_be_opt_in");
mustMatch(source, /env\(["']RUN_V20_32_PRODUCTION_READINESS["']\)\s*!==\s*["']1["']/, "production_readiness_must_require_run_flag_equal_1");
mustMatch(source, /\bV20_32_FULL_LOOP_EVIDENCE_FILE\b/, "production_readiness_must_require_full_loop_evidence_file");
mustMatch(source, /\bV20_32_EXPECTED_BUILD_TAG\b/, "production_readiness_must_accept_expected_build_tag");
mustMatch(source, /opl-v20\.32/, "production_readiness_must_default_to_v20_32_build_tag");
mustMatch(source, /\bV20_32_PRODUCTION_HOSTS_CONFIRMED\b/, "production_readiness_must_require_fixed_production_host_confirmation");
mustMatch(source, /\bV20_32_ROLLBACK_PLAN_CONFIRMED\b/, "production_readiness_must_require_rollback_plan_confirmation");

mustMatch(source, /portal\.medopl\.cn/, "production_readiness_must_check_fixed_portal_host");
mustMatch(source, /opl\.medopl\.cn/, "production_readiness_must_check_fixed_opl_host");
mustMatch(source, /trace\.medopl\.cn/, "production_readiness_must_check_fixed_trace_host");
mustNotMatch(source, /portal-v20-32\.\$\{baseDomain\}/, "production_readiness_must_not_require_new_portal_dns");
mustNotMatch(source, /opl-v20-32\.\$\{baseDomain\}/, "production_readiness_must_not_require_new_opl_dns");

for (const stage of [
  "admin_user_create",
  "wallet_topup",
  "portal_login",
  "storage_order",
  "workspace_upload",
  "resource_quote",
  "resource_freeze",
  "resource_provision",
  "user_resources",
  "opl_message",
  "opl_file_run",
  "workspace_download",
  "billing_trace",
  "delete_node_pool",
  "post_delete_resource_binding",
  "billing_stop_observe",
  "t0_120min_checkpoint",
]) {
  mustMatch(source, new RegExp(stage), `production_readiness_must_require_full_loop_stage:${stage}`);
}

mustMatch(source, /\bresourceorderid\b/, "production_readiness_must_check_resourceorderid_tag");
mustMatch(source, /\brunid\b/, "production_readiness_must_check_runid_tag");
mustMatch(source, /\bserverplanid\b/, "production_readiness_must_check_serverplanid_tag");
mustMatch(source, /\btenantid\b/, "production_readiness_must_check_tenantid_tag");
mustMatch(source, /\bworkspaceid\b/, "production_readiness_must_check_workspaceid_tag");
mustMatch(source, /\bstorageBillingStoppedAt\b/, "production_readiness_must_require_storage_billing_stop_evidence");
mustMatch(source, /\bretentionCleanupAfterAt\b/, "production_readiness_must_require_storage_retention_evidence");
mustMatch(source, /\brequireStageTiming\b/, "production_readiness_must_require_stage_timing_validator");
mustMatch(source, /\bstage_startedAt_missing\b/, "production_readiness_must_require_stage_started_at");
mustMatch(source, /\bstage_endedAt_missing\b/, "production_readiness_must_require_stage_ended_at");
mustMatch(source, /\bstage_latencyMs_missing\b/, "production_readiness_must_require_stage_latency_ms");
mustMatch(source, /\bfirstReplyLatencyMs\b/, "production_readiness_must_require_opl_first_reply_latency_evidence");
mustMatch(source, /\bcompleteReplyLatencyMs\b/, "production_readiness_must_require_opl_complete_reply_latency_evidence");
mustMatch(source, /\btraceCount\b/, "production_readiness_must_require_trace_evidence");
mustMatch(source, /\bartifactCount\b/, "production_readiness_must_require_artifact_evidence");
mustMatch(source, /\bsizeBytes\b/, "production_readiness_must_require_download_evidence");

mustMatch(source, /\/healthz/, "production_readiness_must_probe_healthz");
mustMatch(source, /checkProductionHosts/, "production_readiness_must_probe_production_hosts");
mustMatch(source, /validateFullLoopEvidence/, "production_readiness_must_validate_full_loop_evidence");
mustMatch(source, /T\+1 COS exact attribution deferred|t_plus_1_cos_exact_attribution_deferred/, "production_readiness_must_explicitly_defer_t_plus_1_cos_exact_attribution");
mustMatch(source, /cookie\|authorization\|q-ak\|x-cos-security-token\|providerKey\|password\|secret\|token/i, "production_readiness_must_redact_sensitive_names");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.32_production_readiness_static",
  scriptPath,
}, null, 2));
