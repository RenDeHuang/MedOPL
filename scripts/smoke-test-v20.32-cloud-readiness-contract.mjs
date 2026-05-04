import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scriptPath = "scripts/check-v20.32-cloud-readiness.mjs";

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

const source = await readFile(scriptPath, "utf8");

mustMatch(source, /READ_ONLY_KUBECTL_COMMANDS/, "cloud_readiness_must_centralize_read_only_kubectl_commands");
mustMatch(source, /docker["']\s*,\s*\[\s*["']--version["']\s*\]/, "cloud_readiness_must_check_docker_version");
mustMatch(source, /docker["']\s*,\s*\[\s*["']info["']\s*\]/, "cloud_readiness_must_check_docker_daemon_read_only");
mustMatch(source, /kubectl["']\s*,\s*\[\s*["']version["']\s*,\s*["']--client["']\s*\]/, "cloud_readiness_must_check_kubectl_client");
mustMatch(source, /["']config["']\s*,\s*["']current-context["']/, "cloud_readiness_must_check_kubectl_context");
mustMatch(source, /["']cluster-info["']/, "cloud_readiness_must_probe_cluster_info");
mustMatch(source, /["']get["']\s*,\s*["']ns["']/, "cloud_readiness_must_read_namespaces");
mustMatch(source, /["']get["']\s*,\s*["']nodes["']/, "cloud_readiness_must_read_nodes");
mustMatch(source, /["']auth["']\s*,\s*["']can-i["']\s*,\s*["']create["']\s*,\s*["']deployments["']/, "cloud_readiness_must_check_deployment_create_permission_by_auth_can_i");
mustMatch(source, /["']auth["']\s*,\s*["']can-i["']\s*,\s*["']delete["']\s*,\s*["']deployments["']/, "cloud_readiness_must_check_deployment_delete_permission_by_auth_can_i");
mustMatch(source, /["']auth["']\s*,\s*["']can-i["']\s*,\s*["']create["']\s*,\s*["']jobs["']/, "cloud_readiness_must_check_runtime_job_create_permission_by_auth_can_i");

mustMatch(source, /resolvePlan/, "cloud_readiness_must_reuse_tke_build_plan_resolver");
mustMatch(source, /renderTkeManifests/, "cloud_readiness_must_render_manifests_to_scratch_dir_only");
mustMatch(source, /--tag["']\s*,\s*["']opl-v20\.32["']/, "cloud_readiness_must_use_v20_32_tag");
mustMatch(source, /--manifest-out-dir["']\s*,\s*["']deploy\/tke-package\/rendered-v20\.32-plan["']/, "cloud_readiness_must_use_v20_32_render_plan_dir");
mustMatch(source, /--runner-workload-image/, "cloud_readiness_must_require_explicit_runner_workload_image");
mustMatch(source, /TCR_PASSWORD[\s\S]{0,160}TCR_SECRET/, "cloud_readiness_must_accept_tcr_secret_as_local_password_mapping");
mustMatch(source, /isGitTracked/, "cloud_readiness_must_reject_tracked_non_example_env_files");

mustMatch(source, /portal\.medopl\.cn/, "cloud_readiness_must_keep_fixed_portal_host");
mustMatch(source, /opl\.medopl\.cn/, "cloud_readiness_must_keep_fixed_opl_host");
mustMatch(source, /trace\.medopl\.cn/, "cloud_readiness_must_keep_fixed_trace_host");
mustNotMatch(source, /portal-v20-32\.\$\{baseDomain\}/, "cloud_readiness_must_not_require_new_portal_dns");
mustNotMatch(source, /opl-v20-32\.\$\{baseDomain\}/, "cloud_readiness_must_not_require_new_opl_dns");

mustMatch(source, /FORBIDDEN_MUTATING_KUBECTL_VERBS/, "cloud_readiness_must_define_forbidden_mutating_kubectl_verbs");
mustMatch(source, /assertReadOnlyKubectlCommands/, "cloud_readiness_must_assert_kubectl_commands_are_read_only");
mustMatch(source, /cookie\|authorization\|q-ak\|x-cos-security-token\|providerKey\|password\|secret\|token/i, "cloud_readiness_must_redact_sensitive_names");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.32_cloud_readiness_static",
  scriptPath,
}, null, 2));
