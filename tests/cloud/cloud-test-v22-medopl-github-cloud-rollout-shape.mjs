import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateReview } from "../../scripts/v22-workflow-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readRepoJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function git(args) {
  return spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function listItems(manifest) {
  assert.equal(manifest.kind, "List", "deploy_manifest_must_be_kubernetes_list");
  assert(Array.isArray(manifest.items), "deploy_manifest_items_missing");
  return manifest.items;
}

function findItem(items, kind, name) {
  return items.find((item) => item.kind === kind && item.metadata?.name === name);
}

function assertNoRawSecretValues(source, label) {
  for (const forbidden of [
    "postgres://",
    "postgresql://",
    "BEGIN OPENSSH PRIVATE KEY",
    "BEGIN RSA PRIVATE KEY",
    "eyJ",
  ]) {
    assert.equal(source.includes(forbidden), false, `${label}_must_not_embed_raw_secret:${forbidden}`);
  }
  for (const forbiddenPattern of [
    /\b(?:SecretId|SecretKey|DATABASE_URL)\s*[:=]\s*['"][^'"]{8,}['"]/u,
    /\b(?:TOKEN|PASSWORD|PRIVATE_KEY)\s*[:=]\s*['"][^'"]{8,}['"]/iu,
  ]) {
    assert.equal(forbiddenPattern.test(source), false, `${label}_must_not_embed_raw_secret_pattern:${forbiddenPattern}`);
  }
}

function sectionBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert(start >= 0, `workflow_section_start_missing:${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert(end > start, `workflow_section_end_missing:${endMarker}`);
  return source.slice(start, end);
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

const manifestSource = await readRepoFile("deploy/medopl-cloud/medopl.k8s.json");
assertNoRawSecretValues(manifestSource, "medopl_k8s_manifest");
const manifest = JSON.parse(manifestSource);
const items = listItems(manifest);

const namespace = findItem(items, "Namespace", "medopl");
assert(namespace, "medopl_namespace_missing");
assert.equal(namespace.metadata.labels["app.kubernetes.io/name"], "medopl", "namespace_label_mismatch");

const deployment = findItem(items, "Deployment", "medopl-control-plane");
assert(deployment, "medopl_deployment_missing");
assert.equal(deployment.metadata.namespace, "medopl", "deployment_namespace_mismatch");
assert.equal(deployment.spec.replicas, 1, "deployment_replicas_must_start_at_one");
assert.deepEqual(
  deployment.spec.template.spec.nodeSelector,
  { "medopl.cn/workload": "medopl" },
  "deployment_must_target_medopl_node_pool_label",
);
assert.deepEqual(
  deployment.spec.template.spec.imagePullSecrets,
  [{ name: "tcr-pull-secret" }],
  "deployment_must_use_tcr_pull_secret_ref_only",
);

const container = deployment.spec.template.spec.containers.find((item) => item.name === "control-plane");
assert(container, "medopl_control_plane_container_missing");
assert.match(
  container.image,
  /^uswccr\.ccs\.tencentyun\.com\/medopl\/medopl-go-backend:[A-Za-z0-9_.-]+$/u,
  "medopl_image_must_use_tcr_medopl_repo",
);
assert.equal(container.ports.find((item) => item.name === "http")?.containerPort, 8080, "container_port_must_be_8080");
assert.equal(container.readinessProbe?.httpGet?.path, "/readyz", "readiness_probe_must_use_readyz");
assert.equal(container.readinessProbe?.httpGet?.port, 8080, "readiness_probe_must_use_8080");
assert.equal(container.livenessProbe?.httpGet?.path, "/healthz", "liveness_probe_must_use_healthz");
assert.equal(container.livenessProbe?.httpGet?.port, 8080, "liveness_probe_must_use_8080");
const portalStaticRoot = (container.env || []).find((item) => item.name === "MEDOPL_PORTAL_STATIC_ROOT");
assert.equal(
  portalStaticRoot?.value,
  "/app/portal",
  "portal_public_entry_must_serve_repo_native_frontend_from_backend_image",
);

const envNames = new Set((container.env || []).map((item) => item.name));
for (const expected of [
  "MEDOPL_ENV",
  "MEDOPL_PUBLIC_BASE_URL",
  "OPL_WEBUI_PUBLIC_BASE_URL",
  "PORTAL_OPL_PROVIDER_SECRET_ROOT",
  "MEDOPL_PORTAL_STATIC_ROOT",
  "DATABASE_URL",
]) {
  assert(envNames.has(expected), `container_env_missing:${expected}`);
}
const providerSecretRoot = (container.env || []).find((item) => item.name === "PORTAL_OPL_PROVIDER_SECRET_ROOT");
assert.equal(
  providerSecretRoot.value,
  "/tmp/medopl-runtime/provider-secrets",
  "provider_secret_root_must_use_explicit_writable_runtime_path",
);
const providerSecretMount = (container.volumeMounts || []).find((item) => item.name === "medopl-runtime-state");
assert(providerSecretMount, "provider_secret_runtime_volume_mount_missing");
assert.equal(providerSecretMount.mountPath, "/tmp/medopl-runtime", "provider_secret_runtime_mount_path_mismatch");
assert.equal(providerSecretMount.readOnly, undefined, "provider_secret_runtime_mount_must_be_writable");
const runtimeVolume = (deployment.spec.template.spec.volumes || []).find((item) => item.name === "medopl-runtime-state");
assert(runtimeVolume, "provider_secret_runtime_volume_missing");
assert.deepEqual(runtimeVolume.emptyDir, {}, "provider_secret_runtime_volume_must_be_empty_dir");
const databaseUrl = (container.env || []).find((item) => item.name === "DATABASE_URL");
assert.deepEqual(
  databaseUrl.valueFrom?.secretKeyRef,
  { name: "medopl-postgres", key: "DATABASE_URL" },
  "database_url_must_use_secret_ref",
);

const service = findItem(items, "Service", "medopl-control-plane");
assert(service, "medopl_service_missing");
assert.equal(service.metadata.namespace, "medopl", "service_namespace_mismatch");
assert.equal(service.spec.type, "NodePort", "service_must_start_as_nodeport_for_qcloud_ingress");
assert.equal(service.spec.ports.find((item) => item.name === "http")?.targetPort, 8080, "service_target_port_must_be_8080");

const ingress = findItem(items, "Ingress", "medopl");
assert(ingress, "medopl_ingress_missing");
assert.equal(ingress.metadata.namespace, "medopl", "ingress_namespace_mismatch");
assert.equal(ingress.spec.ingressClassName, "qcloud", "ingress_must_use_qcloud_class");
assert.equal(
  ingress.metadata.annotations?.["ingress.cloud.tencent.com/listen-ports"],
  "[{\"HTTP\":80},{\"HTTPS\":443}]",
  "ingress_must_enable_http_and_https_listeners_for_redirect_probe",
);
assert.equal(
  ingress.metadata.annotations?.["ingress.cloud.tencent.com/auto-rewrite"],
  "true",
  "ingress_must_enable_qcloud_http_to_https_rewrite",
);
assert.equal(
  ingress.metadata.annotations?.["ingress.cloud.tencent.com/rewrite-support"],
  "true",
  "ingress_must_enable_qcloud_rewrite_support",
);
assert(ingress.spec.tls?.some((entry) => entry.hosts?.includes("portal.medopl.cn")), "ingress_tls_must_include_medopl_host");
assert(ingress.spec.rules?.some((rule) => rule.host === "portal.medopl.cn"), "ingress_rule_must_include_medopl_host");

const rolloutSource = await readRepoFile("scripts/cloud-rollout/medopl.mjs");
const backendDockerfile = await readRepoFile("services/medopl-go-backend/Dockerfile");
assertNoRawSecretValues(rolloutSource, "medopl_rollout_helper");
assert(
  backendDockerfile.includes("FROM node:22-bookworm-slim AS portal-build") &&
    backendDockerfile.includes("services/portal/frontend") &&
    backendDockerfile.includes("npm run build") &&
    backendDockerfile.includes("COPY --from=portal-build") &&
    backendDockerfile.includes("/app/portal"),
  "backend_image_must_bundle_repo_native_portal_frontend_static_assets",
);
for (const expected of [
  "portal.medopl.cn",
  "uswccr.ccs.tencentyun.com/medopl/medopl-go-backend",
  "MEDOPL_IMAGE",
  "MEDOPL_NAMESPACE",
  "kubectl",
  "--availability-probe",
]) {
  assert(rolloutSource.includes(expected), `rollout_helper_contract_missing:${expected}`);
}
assert(
  rolloutSource.includes("process.exit(summary.ok ? 0 : 1)") || rolloutSource.includes("process.exitCode = summary.ok ? 0 : 1"),
  "availability_probe_must_fail_closed_when_go_health_contract_fails",
);
assert(
  rolloutSource.includes("body.status === \"ok\"") && rolloutSource.includes("body.service === \"medopl-go-backend\""),
  "availability_probe_must_validate_go_backend_health_json_not_static_html",
);
assert(
  rolloutSource.includes("runPortalEntryProbe") &&
    rolloutSource.includes("portal_entry_probe_must_validate_portal_html") &&
    rolloutSource.includes("MedOPL Portal"),
  "availability_probe_must_validate_portal_html_entry_not_only_backend_health",
);
assert(
  rolloutSource.includes("runHttpRedirectProbe") &&
    rolloutSource.includes("http_redirect_probe_must_validate_https_redirect"),
  "availability_probe_must_validate_http_to_https_redirect",
);
assert(
  rolloutSource.includes("JSON.parse(result.stdout)") && rolloutSource.includes("health_probe_must_validate_go_backend_health_json"),
  "post_rollout_health_probe_must_validate_go_backend_health_json_not_static_html",
);
assert(
  rolloutSource.includes("MEDOPL_HEALTH_PROBE_RETRIES") && rolloutSource.includes("MEDOPL_HEALTH_PROBE_DELAY_MS"),
  "post_rollout_health_probe_must_have_bounded_retry_controls",
);
assert(
  rolloutSource.includes("runHealthProbeWithRetry") && rolloutSource.includes("lastHealthProbeError"),
  "post_rollout_health_probe_must_retry_transient_public_ingress_convergence",
);
assert(
  rolloutSource.includes("runRoutingDiagnostics()"),
  "post_rollout_must_run_routing_diagnostics_before_public_health_probe",
);
assert(
  rolloutSource.includes("kubectl get service") && rolloutSource.includes("kubectl get ingress") && rolloutSource.includes("kubectl get endpoints"),
  "rollout_diagnostics_must_capture_service_ingress_endpoints",
);
assert(
  rolloutSource.includes("dns resolution") && rolloutSource.includes("getent"),
  "rollout_diagnostics_must_capture_public_dns_without_tls_bypass",
);

const releaseImage = await readRepoFile(".github/workflows/release-image.yml");
const cloudRollout = await readRepoFile(".github/workflows/cloud-rollout.yml");
const productionApplyJob = sectionBetween(cloudRollout, "  production-apply:", "  production-rollback:");
assertNoRawSecretValues(releaseImage, "release_image_workflow");
assertNoRawSecretValues(cloudRollout, "cloud_rollout_workflow");
assert.equal(cloudRollout.includes("medopl.medopl.cn"), false, "cloud_rollout_must_not_reference_retired_medopl_host");
assert.equal(releaseImage.includes("workflow_run:"), false, "release_image_must_not_auto_push_after_verify");
assert.equal(releaseImage.includes("docker/build-push-action"), false, "release_image_build_push_must_go_through_cloud_goal_runner");
assert.equal(releaseImage.includes("docker/setup-buildx-action"), false, "release_image_must_not_bypass_goal_runner_with_buildx_action");
assert.equal(
  countOccurrences(releaseImage, "npm run cloud:goal -- --operation build_push"),
  1,
  "release_image_must_build_push_once_through_goal_runner",
);
assert(
  releaseImage.indexOf("Image metadata") < releaseImage.indexOf("npm run cloud:goal:preflight -- --operation build_push"),
  "release_image_must_set_image_ref_before_build_push_preflight",
);
assert(
  releaseImage.indexOf("npm run cloud:goal:preflight -- --operation build_push") < releaseImage.indexOf("npm run cloud:goal -- --operation build_push"),
  "release_image_must_preflight_build_push_before_receipt_runner_build_push",
);
for (const expected of [
  "runs-on: [self-hosted, tencent-cloud, medopl]",
  "workflow_dispatch:",
  "environment: production",
  "V22_CONTAINER_BUILD_PUSH_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_CONTAINER_BUILD_PUSH_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation build_push --execute --confirm-current-session-authorization",
  "TCR_ID: ${{ secrets.TCR_USERNAME }}",
  "TCR_SECRET: ${{ secrets.TCR_PASSWORD }}",
  "npm run cloud:goal:preflight -- --operation build_push",
  "npm run cloud:goal -- --operation build_push",
  "sudo -n docker",
  "services/medopl-go-backend/Dockerfile",
  "V22_CONTAINER_BUILD_CONTEXT: .",
  "V22_CONTAINER_DOCKERFILE: services/medopl-go-backend/Dockerfile",
  "uswccr.ccs.tencentyun.com/medopl/medopl-go-backend",
]) {
  assert(releaseImage.includes(expected), `release_image_workflow_missing:${expected}`);
}
for (const expected of [
  "runs-on: [self-hosted, tencent-cloud, medopl]",
  "environment: production",
  "KUBECONFIG_CONTENT: ${{ secrets.KUBECONFIG }}",
  "TENCENT_MUTATION_SECRET_ID: ${{ secrets.TENCENT_MUTATION_SECRET_ID }}",
  "TENCENT_MUTATION_SECRET_KEY: ${{ secrets.TENCENT_MUTATION_SECRET_KEY }}",
  "DATABASE_URL: ${{ secrets.DATABASE_URL }}",
  "TENCENT_MUTATION_TKE_CLUSTER_ID: ${{ vars.TENCENT_MUTATION_TKE_CLUSTER_ID }}",
  "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID: ${{ vars.TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID }}",
  "TENCENT_MUTATION_COS_BUCKET: ${{ vars.TENCENT_MUTATION_COS_BUCKET }}",
  "TENCENT_MUTATION_COS_REGION: ${{ vars.TENCENT_MUTATION_COS_REGION }}",
  "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT: ${{ vars.TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT }}",
  "TENCENT_MUTATION_REGIONS: ${{ vars.TENCENT_MUTATION_REGIONS }}",
  "V22_TENCENT_RUNTIME_USE_OFFICIAL_SDK: \"1\"",
  "V22_TENCENT_STORAGE_USE_COS_SDK: \"1\"",
  "V22_TENCENT_STORAGE_DELETE_PROBE: \"1\"",
  "V22_MEDOPL_BILLING_AUDIT_USE_POSTGRES: \"1\"",
  "V22_TENCENT_RUNTIME_PROVISIONING_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_TENCENT_RUNTIME_PROVISIONING_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation tenant_runtime_provisioning --execute --confirm-current-session-authorization",
  "V22_TENCENT_STORAGE_LIFECYCLE_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_TENCENT_STORAGE_LIFECYCLE_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation storage_lifecycle --execute --confirm-current-session-authorization",
  "V22_MEDOPL_BILLING_AUDIT_WRITEBACK_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_MEDOPL_BILLING_AUDIT_WRITEBACK_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation billing_audit_writeback --execute --confirm-current-session-authorization",
  "V22_TENCENT_MUTATION_SECRET_FILE: .runtime/v22-cloud-authorization/run-v22-001/mutation.env",
  "V22_TENCENT_RUNTIME_PLAN_FILE: .runtime/v22-cloud-authorization/run-v22-001/runtime-plan.json",
  "V22_TENCENT_STORAGE_PLAN_FILE: .runtime/v22-cloud-authorization/run-v22-001/storage-plan.json",
  "V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE: .runtime/v22-cloud-authorization/run-v22-001/billing-audit-request.json",
  "npm ci",
  "V22_KUBERNETES_APPLY_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_KUBERNETES_APPLY_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation kubectl --execute --confirm-current-session-authorization",
  "V22_MEDOPL_DEPLOY_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_MEDOPL_DEPLOY_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation deploy --execute --confirm-current-session-authorization",
  "V22_OPL_WEBUI_CONSUMER_CANARY_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_OPL_WEBUI_CONSUMER_CANARY_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation live_test --execute --confirm-current-session-authorization",
  "V22_MEDOPL_DEPLOY_PLAN_FILE: .runtime/v22-cloud-authorization/run-v22-001/medopl-deploy-plan.json",
  "Create Goal F receipt inputs",
  "npm run cloud:goal:preflight -- --operation tenant_runtime_provisioning",
  "npm run cloud:goal:preflight -- --operation storage_lifecycle",
  "npm run cloud:goal:preflight -- --operation billing_audit_writeback",
  "npm run cloud:goal -- --operation tenant_runtime_provisioning",
  "npm run cloud:goal -- --operation storage_lifecycle",
  "npm run cloud:goal -- --operation billing_audit_writeback",
  "Create deploy plan",
  "npm run cloud:goal:preflight -- --operation kubectl",
  "npm run cloud:goal:preflight -- --operation deploy",
  "npm run cloud:goal:preflight -- --operation live_test",
  "npm run cloud:goal -- --operation kubectl",
  "npm run cloud:goal -- --operation deploy",
  "npm run cloud:goal -- --operation live_test",
  "npm run cloud:goal -- --manifest-only",
  "npm run verify:cloud-release-candidate",
  "actions/upload-artifact@v4",
  ".runtime/v22-cloud-authorization/run-v22-001/receipt-manifest.json",
  "node scripts/cloud-rollout/medopl.mjs --apply",
  "MEDOPL_BASE_URL: https://portal.medopl.cn",
  "V22_MEDOPL_PUBLIC_BASE_URL: https://portal.medopl.cn",
  "MEDOPL_HTTP_BASE_URL: http://portal.medopl.cn",
  "\"publicBaseUrl\": \"https://portal.medopl.cn\"",
]) {
  assert(cloudRollout.includes(expected), `cloud_rollout_workflow_missing:${expected}`);
}
for (const expected of [
  "V22_TENCENT_RUNTIME_PROVISIONING_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_TENCENT_RUNTIME_PROVISIONING_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation tenant_runtime_provisioning --execute --confirm-current-session-authorization",
  "V22_TENCENT_STORAGE_LIFECYCLE_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_TENCENT_STORAGE_LIFECYCLE_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation storage_lifecycle --execute --confirm-current-session-authorization",
  "V22_MEDOPL_BILLING_AUDIT_WRITEBACK_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_MEDOPL_BILLING_AUDIT_WRITEBACK_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation billing_audit_writeback --execute --confirm-current-session-authorization",
  "V22_TENCENT_MUTATION_SECRET_FILE: .runtime/v22-cloud-authorization/run-v22-001/mutation.env",
  "V22_TENCENT_RUNTIME_PLAN_FILE: .runtime/v22-cloud-authorization/run-v22-001/runtime-plan.json",
  "V22_TENCENT_STORAGE_PLAN_FILE: .runtime/v22-cloud-authorization/run-v22-001/storage-plan.json",
  "V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE: .runtime/v22-cloud-authorization/run-v22-001/billing-audit-request.json",
  "V22_TENCENT_RUNTIME_USE_OFFICIAL_SDK: \"1\"",
  "V22_TENCENT_STORAGE_USE_COS_SDK: \"1\"",
  "V22_TENCENT_STORAGE_DELETE_PROBE: \"1\"",
  "V22_MEDOPL_BILLING_AUDIT_USE_POSTGRES: \"1\"",
  "V22_KUBERNETES_APPLY_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_KUBERNETES_APPLY_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation kubectl --execute --confirm-current-session-authorization",
  "V22_MEDOPL_DEPLOY_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_MEDOPL_DEPLOY_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation deploy --execute --confirm-current-session-authorization",
  "V22_OPL_WEBUI_CONSUMER_CANARY_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_OPL_WEBUI_CONSUMER_CANARY_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation live_test --execute --confirm-current-session-authorization",
  "V22_MEDOPL_DEPLOY_PLAN_FILE: .runtime/v22-cloud-authorization/run-v22-001/medopl-deploy-plan.json",
  "mkdir -p \"$(dirname \"$V22_TENCENT_MUTATION_SECRET_FILE\")\"",
  "cat > \"$V22_TENCENT_RUNTIME_PLAN_FILE\" <<'JSON'",
  "cat > \"$V22_TENCENT_STORAGE_PLAN_FILE\" <<'JSON'",
  "cat > \"$V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE\" <<'JSON'",
  "TENCENT_MUTATION_TKE_CLUSTER_ID=${TENCENT_MUTATION_TKE_CLUSTER_ID}",
  "TENCENT_MUTATION_COS_BUCKET=${TENCENT_MUTATION_COS_BUCKET}",
  "mkdir -p \"$(dirname \"$V22_MEDOPL_DEPLOY_PLAN_FILE\")\"",
]) {
  assert(productionApplyJob.includes(expected), `production_apply_workflow_missing:${expected}`);
}
assert.equal(cloudRollout.includes("${{ runner.temp }}"), false, "cloud_rollout_must_not_use_runner_context_in_job_env");
assert(
  countOccurrences(cloudRollout, "fetch-depth: 0") >= 4,
  "cloud_rollout_checkout_must_fetch_full_history_for_cloud_rc_git_ancestor_gate",
);
assert(
  productionApplyJob.includes("fetch-depth: 0"),
  "production_apply_checkout_must_fetch_full_history_for_cloud_rc_gate",
);
assert(
  productionApplyJob.indexOf("npm ci") < productionApplyJob.indexOf("Create Goal F receipt inputs"),
  "production_apply_must_install_dependencies_before_goal_f_receipt_inputs",
);
assert(
  productionApplyJob.indexOf("Create Goal F receipt inputs") < productionApplyJob.indexOf("npm run cloud:goal:preflight -- --operation tenant_runtime_provisioning"),
  "production_apply_must_create_goal_f_receipt_inputs_before_runtime_preflight",
);
assert(
  productionApplyJob.indexOf("npm run cloud:goal -- --operation tenant_runtime_provisioning") < productionApplyJob.indexOf("npm run cloud:goal -- --operation storage_lifecycle"),
  "production_apply_must_write_runtime_receipt_before_storage_receipts",
);
assert(
  productionApplyJob.indexOf("npm run cloud:goal -- --operation storage_lifecycle") < productionApplyJob.indexOf("npm run cloud:goal -- --operation billing_audit_writeback"),
  "production_apply_must_write_storage_release_receipts_before_billing_audit_receipts",
);
assert(
  productionApplyJob.indexOf("npm run cloud:goal -- --operation billing_audit_writeback") < productionApplyJob.indexOf("Create deploy plan"),
  "production_apply_must_write_billing_audit_receipts_before_deploy_plan",
);
assert(
  productionApplyJob.indexOf("Create deploy plan") < productionApplyJob.indexOf("npm run cloud:goal:preflight -- --operation kubectl"),
  "production_apply_must_create_deploy_plan_before_kubectl_preflight",
);
assert(
  productionApplyJob.indexOf("npm run cloud:goal -- --operation kubectl") < productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --apply"),
  "production_apply_must_apply_manifest_receipt_before_rollout_apply",
);
assert(
  productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --apply") < productionApplyJob.indexOf("npm run cloud:goal -- --operation deploy"),
  "production_apply_must_write_deploy_receipt_after_rollout_apply",
);
assert(
  productionApplyJob.indexOf("npm run cloud:goal -- --operation deploy") < productionApplyJob.indexOf("npm run cloud:goal -- --operation live_test"),
  "production_apply_must_write_live_test_receipt_after_deploy_receipt",
);
assert(
  productionApplyJob.indexOf("npm run cloud:goal -- --operation live_test") < productionApplyJob.indexOf("npm run cloud:goal -- --manifest-only"),
  "production_apply_must_generate_manifest_after_live_test_receipt",
);
assert(
  productionApplyJob.indexOf("npm run cloud:goal -- --manifest-only") < productionApplyJob.indexOf("npm run verify:cloud-release-candidate"),
  "production_apply_must_verify_cloud_rc_after_manifest",
);
assert.equal(cloudRollout.includes("runs-on: ubuntu-latest\n    environment: production"), false, "production_mutation_must_not_run_on_github_hosted_runner");

const packageJson = JSON.parse(await readRepoFile("package.json"));
assert.equal(packageJson.scripts["cloud:rollout:dry-run"], "node scripts/cloud-rollout/medopl.mjs", "cloud_rollout_dry_run_script_missing");
assert.equal(packageJson.scripts["cloud:rollout:availability"], "node scripts/cloud-rollout/medopl.mjs --availability-probe", "cloud_rollout_availability_script_missing");

const goalCurrent = await readRepoJson("tests/fixtures/v22/goal-current.json");
assert.equal(
  goalCurrent.last_landed_commit,
  goalCurrent.latest_landed_closeout?.landed_commit,
  "goal_current_must_sync_latest_landed_commit",
);
const landedAncestor = git(["merge-base", "--is-ancestor", goalCurrent.last_landed_commit, "HEAD"]);
assert.equal(landedAncestor.status, 0, `goal_current_landed_commit_must_be_head_ancestor:${landedAncestor.stderr}`);

const review = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  branchName: "feat/v22-medopl-github-cloud-rollout",
  changedFiles: [
    "deploy/medopl-cloud/medopl.k8s.json",
    ".github/workflows/cloud-rollout.yml",
    ".github/workflows/release-image.yml",
    "scripts/cloud-rollout/medopl.mjs",
    "tests/cloud/cloud-test-v22-medopl-github-cloud-rollout-shape.mjs",
  ],
  changedStatuses: new Map([
    ["deploy/medopl-cloud/medopl.k8s.json", "A"],
    [".github/workflows/cloud-rollout.yml", "A"],
    [".github/workflows/release-image.yml", "A"],
    ["scripts/cloud-rollout/medopl.mjs", "A"],
    ["tests/cloud/cloud-test-v22-medopl-github-cloud-rollout-shape.mjs", "A"],
  ]),
  addedLines: [],
  missingLocalCommandReferences: [],
});
assert.equal(review.ok, true, `review_gate_must_allow_tested_medopl_deploy_shape:${JSON.stringify(review.findings, null, 2)}`);
assert.equal(
  evaluateReview({
    base: "origin/recovery/platform-v22-trunk",
    branchName: "feat/v22-medopl-github-cloud-rollout",
    changedFiles: ["deploy/legacy/raw-kubeconfig.yaml"],
    changedStatuses: new Map([["deploy/legacy/raw-kubeconfig.yaml", "A"]]),
    addedLines: [],
    missingLocalCommandReferences: [],
  }).ok,
  false,
  "review_gate_must_keep_unscoped_deploy_paths_blocked",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_medopl_github_cloud_rollout_shape",
  canClaim: [
    "MedOPL has a repo-native deployable Kubernetes shape",
    "GitHub rollout is scoped to self-hosted Tencent runner",
    "production mutation still requires environment approval, kubeconfig secret and cloud goal receipts",
  ],
  cannotClaim: [
    "runner is already registered in GitHub",
    "TKE private API is reachable from this machine",
    "production deployment has completed",
  ],
}, null, 2));
