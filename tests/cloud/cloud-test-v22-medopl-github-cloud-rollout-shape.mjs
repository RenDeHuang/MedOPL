import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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

async function startAvailabilityProbeServer() {
  const child = spawn(process.execPath, ["-e", `
const { createServer } = require("node:http");
const server = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname === "/redirect/") {
    response.writeHead(302, { location: "HTTPS://127.0.0.1:" + request.socket.localPort + "/", connection: "close" });
    response.end("redirect");
    return;
  }
  if (url.pathname === "/") {
    response.writeHead(200, { "content-type": "text/html", connection: "close" });
    response.end('<!doctype html><title>MedOPL Portal</title><div id="root">MedOPL Portal</div><script src="/assets/app.js"></script>');
    return;
  }
  if (url.pathname === "/healthz" || url.pathname === "/readyz") {
    response.writeHead(200, { "content-type": "application/json", connection: "close" });
    response.end(JSON.stringify({ service: "medopl-go-backend", status: "ok" }));
    return;
  }
  response.writeHead(404, { connection: "close" });
  response.end("not found");
});
server.listen(0, "127.0.0.1", () => {
  process.stdout.write("READY " + server.address().port + "\\n");
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`], { stdio: ["ignore", "pipe", "pipe"] });
  const port = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("availability_probe_server_start_timeout")), 5000);
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
      const match = output.match(/READY (\d+)/u);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`availability_probe_server_exited:${code}`));
    });
  });
  return {
    port,
    close: () => new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill("SIGTERM");
    }),
  };
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
assert.equal(deployment.spec.template.spec.automountServiceAccountToken, false, "deployment_must_disable_service_account_token_automount");
assert.equal(deployment.spec.template.spec.serviceAccountName, "medopl-control-plane", "deployment_must_use_explicit_service_account");
assert.equal(deployment.spec.template.spec.securityContext?.runAsNonRoot, true, "pod_must_run_as_non_root");
assert.equal(deployment.spec.template.spec.securityContext?.seccompProfile?.type, "RuntimeDefault", "pod_must_use_runtime_default_seccomp");

const container = deployment.spec.template.spec.containers.find((item) => item.name === "control-plane");
assert(container, "medopl_control_plane_container_missing");
assert.equal(container.securityContext?.allowPrivilegeEscalation, false, "container_must_disable_privilege_escalation");
assert.equal(container.securityContext?.readOnlyRootFilesystem, true, "container_must_use_read_only_root_filesystem");
assert.deepEqual(container.securityContext?.capabilities?.drop, ["ALL"], "container_must_drop_all_capabilities");
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
  "MEDOPL_AUTH_TOKEN_SHA256",
  "MEDOPL_ADMIN_TOKEN_SHA256",
  "MEDOPL_WEBHOOK_SECRET_SHA256",
  "MEDOPL_SESSION_SIGNING_SECRET_SHA256",
  "MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256",
]) {
  assert(envNames.has(expected), `container_env_missing:${expected}`);
}
for (const name of ["MEDOPL_PRODUCTION_LAUNCH_ENABLED", "MEDOPL_PRODUCTION_EMERGENCY_STOP", "MEDOPL_PRODUCTION_LAUNCH_SCOPE", "MEDOPL_PRODUCTION_SYNTHETIC_TENANT_ID", "MEDOPL_PRODUCTION_SYNTHETIC_USER_ID", "MEDOPL_PRODUCTION_COST_GUARD_REF", "MEDOPL_PRODUCTION_LAUNCH_ENABLED_BY", "MEDOPL_PRODUCTION_MONITORING_OWNER", "MEDOPL_PRODUCTION_ROLLBACK_OWNER", "MEDOPL_PRODUCTION_DISABLE_COMMAND_REF"]) {
  assert.equal(envNames.has(name), false, `production_launch_approval_must_not_be_control_plane_runtime_env:${name}`);
}
assert.equal(manifestSource.includes("medopl-production-launch-safety"), false, "deploy_manifest_must_not_reference_production_launch_safety_secret");
assert.equal(manifestSource.includes("MEDOPL_CANARY_"), false, "deploy_manifest_must_not_reference_legacy_canary_safety_env");
assert.equal(manifestSource.includes("medopl-canary-admission"), false, "deploy_manifest_must_not_reference_legacy_canary_secret");
assert.equal(manifestSource.includes("tenant-goal-f-canary"), false, "deploy_manifest_must_not_embed_selected_tenant_value");
assert.equal(manifestSource.includes("user-goal-f-canary"), false, "deploy_manifest_must_not_embed_selected_user_value");
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
for (const name of ["MEDOPL_AUTH_TOKEN_SHA256", "MEDOPL_ADMIN_TOKEN_SHA256", "MEDOPL_WEBHOOK_SECRET_SHA256", "MEDOPL_SESSION_SIGNING_SECRET_SHA256", "MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256"]) {
  const item = (container.env || []).find((entry) => entry.name === name);
  assert.deepEqual(
    item?.valueFrom?.secretKeyRef,
    { name: "medopl-auth-boundary", key: name },
    `auth_boundary_hash_must_use_secret_ref:${name}`,
  );
}

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
assert(findItem(items, "ServiceAccount", "medopl-control-plane"), "minimal_service_account_missing");
const networkPolicy = findItem(items, "NetworkPolicy", "medopl-control-plane-ingress");
assert(networkPolicy, "medopl_network_policy_missing");
assert.equal(networkPolicy.metadata.namespace, "medopl", "network_policy_namespace_mismatch");
assert.deepEqual(networkPolicy.spec.podSelector, { matchLabels: { "app.kubernetes.io/name": "medopl" } }, "network_policy_must_target_medopl_pods");
assert.equal(networkPolicy.spec.policyTypes?.includes("Ingress"), true, "network_policy_must_define_ingress_policy");

const rolloutSource = await readRepoFile("scripts/cloud-rollout/medopl.mjs");
const backendDockerfile = await readRepoFile("services/medopl-go-backend/Dockerfile");
const commandRunnerSource = await readRepoFile("tests/support/cloud-prework/production-goal-command-runner.mjs");
assertNoRawSecretValues(rolloutSource, "medopl_rollout_helper");
assert(
  backendDockerfile.includes("FROM node:22-bookworm-slim AS portal-build") &&
    backendDockerfile.includes("services/portal/frontend") &&
    backendDockerfile.includes("npm run build") &&
    backendDockerfile.includes("COPY --from=portal-build") &&
    backendDockerfile.includes("/app/portal"),
  "backend_image_must_bundle_repo_native_portal_frontend_static_assets",
);
assert(
  backendDockerfile.includes("COPY --from=build /src/services/medopl-go-backend/migrations /app/migrations"),
  "backend_runtime_image_must_bundle_postgres_migrations_for_production_store_startup",
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
    rolloutSource.includes("http_redirect_probe_must_validate_https_redirect") &&
    rolloutSource.includes("parseURL(location)") &&
    rolloutSource.includes("redirectTarget?.protocol === \"https:\""),
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
  rolloutSource.includes("runRolloutFailureDiagnostics()") &&
    rolloutSource.includes("kubectl get deployment") &&
    rolloutSource.includes("kubectl get replicaset") &&
    rolloutSource.includes("kubectl describe pod") &&
    rolloutSource.includes("kubectl logs current") &&
    rolloutSource.includes("kubectl logs previous") &&
    rolloutSource.includes("--previous") &&
    rolloutSource.includes("kubectl get events"),
  "rollout_failure_must_capture_deployment_replicaset_pod_and_event_diagnostics",
);
assert.equal(rolloutSource.includes("kubectl rollout undo"), false, "rollback_must_not_use_implicit_revision_undo");
assert(
  rolloutSource.includes("manual_environment_approved_explicit_image_rollback") &&
    rolloutSource.includes("requireEnv(\"MEDOPL_IMAGE\")") &&
    rolloutSource.includes("setValidatedImage(process.env.MEDOPL_IMAGE)") &&
    rolloutSource.includes("kubectl set rollback image"),
  "rollback_must_use_explicit_allowed_image_target",
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
const g3BusinessClosure = await readRepoFile(".github/workflows/g3-business-closure.yml");
const productionApplyJob = sectionBetween(cloudRollout, "  production-apply:", "  production-rollback:");
const productionRollbackJob = sectionBetween(cloudRollout, "  production-rollback:", "  production-availability-probe-current:");
const workflowDispatchInputs = sectionBetween(cloudRollout, "    inputs:", "permissions:");
assertNoRawSecretValues(releaseImage, "release_image_workflow");
assertNoRawSecretValues(cloudRollout, "cloud_rollout_workflow");
assertNoRawSecretValues(g3BusinessClosure, "g3_business_closure_workflow");
for (const expected of [
  "name: G3 Business Closure",
  "workflow_dispatch:",
  "confirm_g3_business_closure",
  "prior_receipts_artifact_run_id", "prior_receipts_artifact_name",
  "runs-on: [self-hosted, tencent-cloud, medopl]",
  "environment: production",
  "DATABASE_URL: ${{ secrets.DATABASE_URL }}",
  "MEDOPL_WEBHOOK_SECRET: ${{ secrets.MEDOPL_WEBHOOK_SECRET }}",
  "MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256: ${{ secrets.MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256 }}",
  "V22_MEDOPL_PUBLIC_BASE_URL: https://portal.medopl.cn",
  "V22_OPL_WEBUI_CONSUMER_CANARY_URL: https://opl.medopl.cn",
  "V22_MEDOPL_BILLING_AUDIT_USE_POSTGRES: \"1\"",
  "V22_MEDOPL_LIVE_DB_PERSISTENCE_PROOF: \"1\"",
  "V22_MEDOPL_BILLING_AUDIT_WRITEBACK_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_MEDOPL_BILLING_AUDIT_WRITEBACK_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation billing_audit_writeback --execute --confirm-current-session-authorization",
  "V22_OPL_WEBUI_CONSUMER_CANARY_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_OPL_WEBUI_CONSUMER_CANARY_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation live_test --execute --confirm-current-session-authorization",
  "V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE: .runtime/v22-cloud-authorization/run-v22-001/billing-audit-request.json",
  "npm run cloud:goal:preflight -- --operation billing_audit_writeback",
  "npm run cloud:goal -- --operation billing_audit_writeback",
  "npm run cloud:goal:preflight -- --operation live_test",
  "npm run cloud:goal -- --operation live_test",
  "Download prior G3 receipt artifact", "actions/download-artifact@v4", "run-id: ${{ inputs.prior_receipts_artifact_run_id }}",
  "name: ${{ inputs.prior_receipts_artifact_name }}", "path: .runtime/g3-prior-receipts",
  "Restore prior G3 runtime/storage/release receipts",
  "No prior G3 artifact run id provided; using existing evidence sink only", "prior-g3-receipts",
  "tenant_runtime_provisioning.json", "storage_lifecycle.json", "receipt-manifest.json",
  "Validate G3 scoped business closure evidence",
  "missing_prior_g3_runtime_storage_receipts",
  "g3-business-closure-receipt.json",
  "\"kind\": \"medopl_g3_business_closure_receipt\"",
  "\"claim_scope\": \"g3_real_cloud_business_closure\"",
  "actions/setup-go@v5", "go-version: \"1.22.x\"", "npm run verify",
  "npm run repo:bloat",
  "npm run line:budget",
  "npm run gate:review",
  "actions/upload-artifact@v4",
  ".runtime/v22-cloud-authorization/run-v22-001/g3-business-closure-receipt.json",
  ".runtime/v22-cloud-authorization/run-v22-001/runtime_owner_receipt.json",
  ".runtime/v22-cloud-authorization/run-v22-001/storage_owner_receipt.json",
  ".runtime/v22-cloud-authorization/run-v22-001/release_owner_receipt.json",
]) {
  assert(g3BusinessClosure.includes(expected), `g3_business_closure_workflow_missing:${expected}`);
}
for (const forbidden of [
  "kubectl",
  "node scripts/cloud-rollout/medopl.mjs",
  "cloud:rollout",
  "npm run cloud:goal -- --operation deploy",
  "npm run cloud:goal -- --operation kubectl",
  "npm run cloud:goal -- --operation tenant_runtime_provisioning",
  "npm run cloud:goal -- --operation storage_lifecycle",
  "npm run cloud:goal -- --operation build_push",
  "KUBECONFIG",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
  "MEDOPL_CANARY_",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "npm run cloud:goal -- --manifest-only",
  "npm run verify:cloud-release-candidate",
  "npm run verify:production-complete-candidate",
  ".runtime/v22-cloud-authorization/run-v22-001/receipt-manifest.json",
]) {
  assert.equal(g3BusinessClosure.includes(forbidden), false, `g3_business_closure_workflow_must_not_include:${forbidden}`);
}
for (const [before, after, message] of [
  ["npm run cloud:goal -- --operation billing_audit_writeback", "npm run cloud:goal -- --operation live_test", "g3_business_closure_must_write_billing_audit_before_live_test"],
  ["npm run cloud:goal -- --operation live_test", "Restore prior G3 runtime/storage/release receipts", "g3_business_closure_must_restore_prior_receipts_after_live_test"],
  ["Restore prior G3 runtime/storage/release receipts", "Validate G3 scoped business closure evidence", "g3_business_closure_must_restore_prior_receipts_before_scoped_validation"],
  ["Validate G3 scoped business closure evidence", "Upload G3 redacted evidence", "g3_business_closure_must_upload_scoped_evidence_before_repo_verify"],
]) {
  assert(g3BusinessClosure.indexOf(before) < g3BusinessClosure.indexOf(after), message);
}
for (const expected of ["copyFileSync(found, target)", "runtime_owner_receipt", "storage_owner_receipt", "release_owner_receipt"]) {
  assert(g3BusinessClosure.includes(expected), "g3_business_closure_must_map_restored_prior_receipts_into_evidence_sink");
}
for (const expected of ["manifest.receipts", "JSON.stringify(receipt, null, 2)", "receipt_manifest"]) {
  assert(g3BusinessClosure.includes(expected), "g3_business_closure_must_restore_prior_receipts_from_manifest_artifact");
}
assert(g3BusinessClosure.includes("No prior G3 artifact run id provided; using existing evidence sink only") && g3BusinessClosure.includes("missing_prior_g3_runtime_storage_receipts"), "g3_business_closure_must_fail_fast_when_prior_receipts_remain_missing");
assert.equal(g3BusinessClosure.includes("gh run download"), false, "g3_business_closure_must_not_require_gh_cli_on_self_hosted_runner");
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
  "MEDOPL_AUTH_TOKEN_SHA256: ${{ secrets.MEDOPL_AUTH_TOKEN_SHA256 }}",
  "MEDOPL_ADMIN_TOKEN_SHA256: ${{ secrets.MEDOPL_ADMIN_TOKEN_SHA256 }}",
  "MEDOPL_WEBHOOK_SECRET_SHA256: ${{ secrets.MEDOPL_WEBHOOK_SECRET_SHA256 }}",
  "MEDOPL_WEBHOOK_SECRET: ${{ secrets.MEDOPL_WEBHOOK_SECRET }}",
  "MEDOPL_SESSION_SIGNING_SECRET_SHA256: ${{ secrets.MEDOPL_SESSION_SIGNING_SECRET_SHA256 }}",
  "MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256: ${{ secrets.MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256 }}",
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
  "V22_MEDOPL_LIVE_DB_PERSISTENCE_PROOF: \"1\"",
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
  "MEDOPL_SESSION_SIGNING_SECRET_SHA256: ${{ secrets.MEDOPL_SESSION_SIGNING_SECRET_SHA256 }}",
  "MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256: ${{ secrets.MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256 }}",
  "V22_PRODUCTION_LAUNCH_CONFIRMATION: ${{ inputs.confirm_production_launch }}",
  "V22_PRODUCTION_LAUNCH_SCOPE_INPUT: ${{ inputs.launch_scope }}",
  "V22_PRODUCTION_LAUNCH_EMERGENCY_STOP_INPUT: ${{ inputs.emergency_stop }}",
  "V22_PRODUCTION_LAUNCH_COST_GUARD_REF_INPUT: ${{ inputs.cost_guard_ref }}",
  "V22_PRODUCTION_LAUNCH_OPERATOR_INPUT: ${{ inputs.owner }}",
  "V22_PRODUCTION_LAUNCH_ROLLBACK_REF_INPUT: ${{ inputs.rollback_ref }}",
  "V22_PRODUCTION_GOAL_HTTP_TIMEOUT_MS: \"15000\"",
  "V22_MEDOPL_DEPLOY_PLAN_FILE: .runtime/v22-cloud-authorization/run-v22-001/medopl-deploy-plan.json",
  "Create Goal F receipt inputs",
  "npm run cloud:goal:preflight -- --operation tenant_runtime_provisioning",
  "npm run cloud:goal:preflight -- --operation storage_lifecycle",
  "npm run cloud:goal:preflight -- --operation billing_audit_writeback",
  "npm run cloud:goal -- --operation tenant_runtime_provisioning",
  "npm run cloud:goal -- --operation storage_lifecycle",
  "npm run cloud:goal -- --operation billing_audit_writeback",
  "Create deploy plan",
  "Validate workflow-dispatch production launch approval",
  "Write production launch approval receipt",
  "npm run cloud:goal:preflight -- --operation kubectl",
  "npm run cloud:goal:preflight -- --operation deploy",
  "npm run cloud:goal:preflight -- --operation live_test",
  "npm run cloud:goal -- --operation kubectl",
  "npm run cloud:goal -- --operation deploy",
  "npm run cloud:goal -- --operation live_test",
  "node scripts/cloud-rollout/medopl.mjs --availability-probe --soak",
  "node scripts/cloud-rollout/medopl.mjs --availability-probe --concurrency",
  "node scripts/cloud-rollout/medopl.mjs --rollback --drill",
  "node scripts/cloud-rollout/medopl.mjs --availability-probe --canary-window",
  "node scripts/cloud-rollout/medopl.mjs --availability-probe --alert-check",
  "MEDOPL_ALERT_ROUTE_REF: ${{ vars.MEDOPL_ALERT_ROUTE_REF }}",
  "node scripts/cloud-rollout/medopl.mjs --release-decision",
  "npm run cloud:goal -- --manifest-only",
  "npm run verify:cloud-release-candidate",
  "npm run verify:production-complete-candidate",
  "actions/upload-artifact@v4",
  ".runtime/v22-cloud-authorization/run-v22-001/receipt-manifest.json",
  "node scripts/cloud-rollout/medopl.mjs --apply",
  "MEDOPL_BASE_URL: https://portal.medopl.cn",
  "V22_MEDOPL_PUBLIC_BASE_URL: https://portal.medopl.cn",
  "MEDOPL_HTTP_BASE_URL: http://portal.medopl.cn",
  "MEDOPL_KUBECTL_ROLLOUT_TIMEOUT_SECONDS: \"420\"",
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
  "V22_MEDOPL_LIVE_DB_PERSISTENCE_PROOF: \"1\"",
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
  productionApplyJob.includes("MEDOPL_KUBECTL_ROLLOUT_TIMEOUT_SECONDS: \"420\""),
  "production_apply_must_use_extended_rollout_timeout",
);
assert(
  productionRollbackJob.includes("MEDOPL_KUBECTL_ROLLOUT_TIMEOUT_SECONDS: \"420\""),
  "production_rollback_must_use_extended_rollout_timeout",
);
assert(productionRollbackJob.includes("MEDOPL_HTTP_BASE_URL: http://portal.medopl.cn"), "production_rollback_must_keep_http_redirect_probe_context");
assert(["rollout_scope:", "default: production_launch", "- production_launch", "- g3_diagnostic"].every((item) => workflowDispatchInputs.includes(item)) && cloudRollout.includes("MEDOPL_ROLLOUT_SCOPE: ${{ inputs.rollout_scope }}"), "cloud_rollout_must_expose_explicit_rollout_scope_for_g3_diagnostic");
for (const expected of [
  "confirm_production_launch:",
  "default: deploy-current",
  "launch_scope:",
  "default: owner-created-or-approved-medopl-accounts",
  "emergency_stop:",
  "default: false",
  "cost_guard_ref:",
  "default: business-account-balance-plan-quota",
  "owner:",
  "default: huangrende",
  "rollback_ref:",
]) {
  assert(workflowDispatchInputs.includes(expected), `cloud_rollout_dispatch_input_missing:${expected}`);
}
for (const forbidden of [
  "${{ vars.MEDOPL_PRODUCTION_LAUNCH_ENABLED }}",
  "${{ vars.MEDOPL_PRODUCTION_EMERGENCY_STOP }}",
  "${{ vars.MEDOPL_PRODUCTION_LAUNCH_SCOPE }}",
  "${{ secrets.MEDOPL_PRODUCTION_SYNTHETIC_TENANT_ID }}",
  "${{ secrets.MEDOPL_PRODUCTION_SYNTHETIC_USER_ID }}",
  "${{ vars.MEDOPL_PRODUCTION_COST_GUARD_REF }}",
  "${{ vars.MEDOPL_PRODUCTION_LAUNCH_ENABLED_BY }}",
  "${{ vars.MEDOPL_PRODUCTION_MONITORING_OWNER }}",
  "${{ vars.MEDOPL_PRODUCTION_ROLLBACK_OWNER }}",
  "${{ vars.MEDOPL_PRODUCTION_DISABLE_COMMAND_REF }}",
]) {
  assert.equal(cloudRollout.includes(forbidden), false, `cloud_rollout_must_not_require_production_env_var_or_synthetic_secret:${forbidden}`);
}
assert.equal(countOccurrences(productionApplyJob, "if: ${{ inputs.rollout_scope != 'g3_diagnostic' }}"), 12, "g3_diagnostic_must_skip_production_launch_receipt_steps");
assert.equal(countOccurrences(productionApplyJob, "if: ${{ inputs.availability_probe && inputs.rollout_scope != 'g3_diagnostic' }}"), 12, "g3_diagnostic_must_skip_availability_production_complete_steps");
assert(["Kubernetes receipt lane\n        run: npm run cloud:goal -- --operation kubectl", "Rollout apply\n        run: node scripts/cloud-rollout/medopl.mjs --apply", "MedOPL availability probe\n        if: ${{ inputs.availability_probe }}"].every((item) => productionApplyJob.includes(item)), "g3_diagnostic_scope_must_keep_rollout_apply_and_no_secret_availability_probe_available");
assert(rolloutSource.includes("deploymentConvergedAfterRolloutStatusFailure") && rolloutSource.includes("rollout_status_failed_but_deployment_converged") && rolloutSource.includes("availableReplicas") && rolloutSource.includes("updatedReplicas"), "rollout_helper_must_not_fail_rollback_when_deployment_already_converged");
assert(
  productionApplyJob.includes("Validate production database secret shape") &&
    productionApplyJob.includes("new URL(raw)") &&
    productionApplyJob.includes("DATABASE_URL must be a valid postgres URL") &&
    productionApplyJob.includes("hostname") &&
    productionApplyJob.includes("port"),
  "production_apply_must_validate_database_url_shape_before_rollout",
);
assert(
  productionApplyJob.indexOf("Validate production database secret shape") < productionApplyJob.indexOf("Create Goal F receipt inputs"),
  "production_apply_must_validate_database_url_shape_before_goal_f_receipt_inputs",
);
assert(
  productionApplyJob.includes("Validate production database authentication source") &&
    productionApplyJob.includes("const pg = require(\"pg\")") &&
    productionApplyJob.includes("production postgres authentication source ok") &&
    productionApplyJob.includes("DATABASE_URL_REF") &&
    !productionApplyJob.includes("console.log(raw)"),
  "production_apply_must_validate_github_database_url_auth_before_syncing_incluster_secret",
);
assert(
  productionApplyJob.includes("Sync in-cluster database secret from production source") &&
    productionApplyJob.includes("kubectl --kubeconfig \"$TENCENT_DEPLOY_KUBECONFIG_REF\" --namespace medopl create secret generic medopl-postgres") &&
    productionApplyJob.includes("printf 'DATABASE_URL=%s\\n' \"$DATABASE_URL\" > \"$RUNNER_TEMP/medopl-postgres.env\"") &&
    productionApplyJob.includes("--from-env-file=\"$RUNNER_TEMP/medopl-postgres.env\"") &&
    productionApplyJob.includes("--dry-run=client -o yaml") &&
    productionApplyJob.includes("kubectl --kubeconfig \"$TENCENT_DEPLOY_KUBECONFIG_REF\" --namespace medopl apply -f -") &&
    !productionApplyJob.includes("echo \"$DATABASE_URL\""),
  "production_apply_must_sync_incluster_database_secret_from_github_production_source_without_printing_secret",
);
assert(
  productionApplyJob.includes("Sync in-cluster auth boundary secret from production source") &&
    productionApplyJob.includes("create secret generic medopl-auth-boundary") &&
    productionApplyJob.includes("MEDOPL_AUTH_TOKEN_SHA256=%s") &&
    productionApplyJob.includes("MEDOPL_ADMIN_TOKEN_SHA256=%s") &&
    productionApplyJob.includes("MEDOPL_WEBHOOK_SECRET_SHA256=%s") &&
    productionApplyJob.includes("MEDOPL_SESSION_SIGNING_SECRET_SHA256=%s") &&
    productionApplyJob.includes("MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256=%s") &&
    !productionApplyJob.includes("echo \"$MEDOPL_AUTH_TOKEN_SHA256\""),
  "production_apply_must_sync_auth_boundary_hashes_without_printing_secret",
);
assert(
  productionApplyJob.includes("Validate workflow-dispatch production launch approval") &&
    productionApplyJob.includes("confirm_production_launch must be deploy-current for production_launch apply") &&
    productionApplyJob.includes("Cloud Rollout workflow_dispatch plus GitHub production environment approval is the production launch approval gate") &&
    productionApplyJob.includes("emergency_stop=true blocks production_launch apply") &&
    productionApplyJob.includes("production launch approval input shape ok") &&
    !productionApplyJob.includes("MEDOPL_PRODUCTION_LAUNCH_ENABLED required") &&
    !productionApplyJob.includes("MEDOPL_PRODUCTION_SYNTHETIC_TENANT_ID required") &&
    !productionApplyJob.includes("MEDOPL_PRODUCTION_SYNTHETIC_USER_ID required"),
  "production_apply_must_validate_workflow_dispatch_approval_without_github_production_vars",
);
assert(
  productionApplyJob.includes("Write production launch approval receipt") &&
    productionApplyJob.includes("production-launch-approval-receipt.json") &&
    productionApplyJob.includes("\"approvalGate\": \"workflow_dispatch_plus_github_production_environment\"") &&
    productionApplyJob.includes("\"businessAdmission\": \"account_approved_plan_balance_quota\"") &&
    productionApplyJob.includes("\"costGuardRef\"") &&
    !productionApplyJob.includes("create secret generic medopl-production-launch-safety"),
  "production_apply_must_write_redacted_approval_receipt_from_inputs_without_syncing_runtime_secret",
);
assert(
  productionApplyJob.includes("Validate in-cluster database secret shape") &&
    productionApplyJob.includes("kubectl --kubeconfig") &&
    productionApplyJob.includes("get secret medopl-postgres") &&
    productionApplyJob.includes("jsonpath={.data.DATABASE_URL}") &&
    productionApplyJob.includes("Buffer.from(encoded.trim(), \"base64\")") &&
    productionApplyJob.includes("DATABASE_URL must be a valid postgres URL") &&
    productionApplyJob.includes("DATABASE_URL hostname must not include a port segment"),
  "production_apply_must_validate_incluster_database_secret_shape_before_rollout",
);
assert(
  productionApplyJob.indexOf("Validate production database secret shape") < productionApplyJob.indexOf("Validate production database authentication source") &&
    productionApplyJob.indexOf("Validate production database authentication source") < productionApplyJob.indexOf("Sync in-cluster database secret from production source") &&
    productionApplyJob.indexOf("Sync in-cluster database secret from production source") < productionApplyJob.indexOf("Validate in-cluster database secret shape"),
  "production_apply_must_validate_source_then_sync_secret_then_validate_incluster_shape",
);
assert(
  productionApplyJob.indexOf("Write kubeconfig file") < productionApplyJob.indexOf("Validate in-cluster database secret shape") &&
    productionApplyJob.indexOf("Validate in-cluster database secret shape") < productionApplyJob.indexOf("Runtime receipt preflight"),
  "production_apply_must_validate_incluster_database_secret_after_kubeconfig_before_receipts",
);
assert(
  productionApplyJob.includes("Validate in-cluster database secret authentication") &&
    productionApplyJob.includes("const pg = require(\"pg\")") &&
    productionApplyJob.includes("select 1 as ok") &&
    productionApplyJob.includes("in-cluster postgres authentication ok") &&
    productionApplyJob.includes("DATABASE_URL_REF") &&
    !productionApplyJob.includes("console.log(raw)"),
  "production_apply_must_validate_incluster_database_secret_auth_before_rollout",
);
assert(
  productionApplyJob.indexOf("Install Goal F runner dependencies") < productionApplyJob.indexOf("Validate in-cluster database secret authentication") &&
    productionApplyJob.indexOf("Validate in-cluster database secret authentication") < productionApplyJob.indexOf("Create Goal F receipt inputs"),
  "production_apply_must_validate_incluster_database_auth_after_dependencies_before_goal_f_receipts",
);
assert(
  productionApplyJob.indexOf("Sync in-cluster auth boundary secret from production source") < productionApplyJob.indexOf("Validate workflow-dispatch production launch approval") &&
    productionApplyJob.indexOf("Validate workflow-dispatch production launch approval") < productionApplyJob.indexOf("Write production launch approval receipt") &&
    productionApplyJob.indexOf("Write production launch approval receipt") < productionApplyJob.indexOf("Create Goal F receipt inputs"),
  "production_apply_must_record_workflow_dispatch_approval_before_goal_f_receipts_and_rollout",
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
  productionApplyJob.includes("V22_MEDOPL_LIVE_DB_PERSISTENCE_PROOF: \"1\"") &&
    commandRunnerSource.includes("/api/v22/users/prepare") &&
    commandRunnerSource.includes("/api/v22/billing/payment-orders") &&
    commandRunnerSource.includes("/api/v22/billing/payment-paid") &&
    commandRunnerSource.includes("X-MedOPL-Webhook-Secret") &&
    !commandRunnerSource.includes("path: \"/api/v22/users/credit\"") &&
    commandRunnerSource.includes("queryLiveDatabasePersistenceProof") &&
    commandRunnerSource.includes("databasePersistenceProof: true") &&
    commandRunnerSource.includes("workspaceRefHash") &&
    commandRunnerSource.includes("SELECT count(*)::int AS count FROM business_accounts WHERE workspace_id = $1") &&
    commandRunnerSource.includes("SELECT count(*)::int AS count FROM credit_events WHERE workspace_id = $1") &&
    commandRunnerSource.includes("SELECT count(*)::int AS count FROM files WHERE workspace_id = $1") &&
    commandRunnerSource.includes("SELECT count(*)::int AS count FROM runs WHERE workspace_id = $1") &&
    commandRunnerSource.includes("SELECT count(*)::int AS count FROM artifacts WHERE workspace_id = $1") &&
    commandRunnerSource.includes("SELECT count(*)::int AS count FROM control_plane_audit_events WHERE workspace_id = $1") &&
    commandRunnerSource.includes("SELECT count(*)::int AS count FROM billing_events WHERE workspace_id = $1"),
  "production_apply_live_test_must_prove_postgres_business_metadata_without_raw_workspace_payload",
);
assert(
  productionApplyJob.indexOf("npm run cloud:goal -- --operation live_test") < productionApplyJob.indexOf("npm run cloud:goal -- --manifest-only"),
  "production_apply_must_generate_manifest_after_live_test_receipt",
);
assert(
  productionApplyJob.indexOf("npm run cloud:goal -- --operation live_test") < productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --availability-probe --soak") &&
    productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --availability-probe --soak") < productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --availability-probe --concurrency") &&
    productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --availability-probe --concurrency") < productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --rollback --drill") &&
    productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --rollback --drill") < productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --availability-probe --canary-window") &&
    productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --availability-probe --canary-window") < productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --availability-probe --alert-check") &&
    productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --availability-probe --alert-check") < productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --release-decision") &&
    productionApplyJob.indexOf("node scripts/cloud-rollout/medopl.mjs --release-decision") < productionApplyJob.indexOf("npm run cloud:goal -- --manifest-only"),
  "production_apply_must_collect_operational_stability_receipts_before_manifest_only",
);
assert(
  productionApplyJob.indexOf("npm run cloud:goal -- --manifest-only") < productionApplyJob.indexOf("npm run verify:cloud-release-candidate"),
  "production_apply_must_verify_cloud_rc_after_manifest",
);
assert(
  productionApplyJob.indexOf("npm run verify:cloud-release-candidate") < productionApplyJob.indexOf("npm run verify:production-complete-candidate"),
  "production_apply_must_verify_production_complete_candidate_after_cloud_rc",
);
assert(
  productionApplyJob.indexOf("npm run verify:production-complete-candidate") < productionApplyJob.indexOf("actions/upload-artifact@v4"),
  "production_apply_must_upload_manifest_after_production_candidate_verify",
);
assert.equal(cloudRollout.includes("runs-on: ubuntu-latest\n    environment: production"), false, "production_mutation_must_not_run_on_github_hosted_runner");

const packageJson = JSON.parse(await readRepoFile("package.json"));
assert.equal(packageJson.scripts["cloud:rollout:dry-run"], "node scripts/cloud-rollout/medopl.mjs", "cloud_rollout_dry_run_script_missing");
assert.equal(packageJson.scripts["cloud:rollout:availability"], "node scripts/cloud-rollout/medopl.mjs --availability-probe", "cloud_rollout_availability_script_missing");
assert.equal(
  packageJson.scripts["verify:production-complete-candidate"],
  "node scripts/v22-verify.mjs package production-complete-candidate --base origin/recovery/platform-v22-trunk",
  "production_complete_candidate_script_missing",
);

const availabilityServer = await startAvailabilityProbeServer();
try {
  const { port } = availabilityServer;
  const availability = spawnSync(process.execPath, ["scripts/cloud-rollout/medopl.mjs", "--availability-probe"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      MEDOPL_BASE_URL: `http://127.0.0.1:${port}`,
      MEDOPL_HTTP_BASE_URL: `http://127.0.0.1:${port}/redirect`,
    },
  });
  assert.equal(availability.status, 0, `availability_probe_must_accept_case_insensitive_https_redirect:${availability.stderr || availability.stdout}`);
  const operationalRunId = `test-operational-stability-${process.pid}`;
  const operational = spawnSync(process.execPath, [
    "scripts/cloud-rollout/medopl.mjs",
    "--availability-probe",
    "--soak",
    "--concurrency",
    "--canary-window",
    "--alert-check",
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      V22_CLOUD_GOAL_RUN_ID: operationalRunId,
      MEDOPL_BASE_URL: `http://127.0.0.1:${port}`,
      MEDOPL_HTTP_BASE_URL: `http://127.0.0.1:${port}/redirect`,
      MEDOPL_ALERT_ROUTE_REF: "test-alert-route-ref",
      MEDOPL_ALERT_CHECK_ALLOW_SYNTHETIC: "1",
    },
  });
  assert.equal(operational.status, 0, `operational_stability_availability_probe_must_pass:${operational.stderr || operational.stdout}`);
  const operationalPayload = JSON.parse(operational.stdout);
  assert.equal(operationalPayload.ok, true, "operational_stability_payload_must_be_ok");
  assert.deepEqual(
    operationalPayload.operational.map((item) => item.id),
    ["soak_test_receipt", "concurrency_pressure_receipt", "continuous_canary_monitoring_receipt", "alerting_receipt"],
    "operational_stability_probe_ids_mismatch",
  );
  for (const id of ["soak_test_receipt", "concurrency_pressure_receipt", "continuous_canary_monitoring_receipt", "alerting_receipt"]) {
    const pointer = JSON.parse(await readRepoFile(`.runtime/v22-cloud-authorization/${operationalRunId}/production-complete/${id}.json`));
    assert.equal(pointer.status, "accepted", `operational_pointer_must_be_accepted:${id}`);
    assert.equal(JSON.stringify(pointer).includes("postgres://"), false, `operational_pointer_must_not_embed_database_url:${id}`);
    assert.equal(JSON.stringify(pointer).includes("SecretKey"), false, `operational_pointer_must_not_embed_secret_key:${id}`);
  }
  const releaseDecisionMissing = spawnSync(process.execPath, ["scripts/cloud-rollout/medopl.mjs", "--release-decision"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      V22_CLOUD_GOAL_RUN_ID: operationalRunId,
    },
  });
  assert.equal(releaseDecisionMissing.status, 1, "release_decision_must_fail_until_rollback_drill_pointer_exists");
  const releaseDecisionMissingPayload = JSON.parse(releaseDecisionMissing.stdout);
  assert(
    releaseDecisionMissingPayload.missing.includes("business_db_persistence_receipt"),
    "release_decision_must_require_business_db_persistence_pointer",
  );
  const rollbackPointerPath = `.runtime/v22-cloud-authorization/${operationalRunId}/production-complete/rollback_drill_receipt.json`;
  await import("node:fs/promises").then(({ mkdir, writeFile }) => mkdir(path.dirname(path.join(repoRoot, rollbackPointerPath)), { recursive: true })
    .then(() => writeFile(path.join(repoRoot, rollbackPointerPath), `${JSON.stringify({
      kind: "medopl_operational_stability_receipt",
      id: "rollback_drill_receipt",
      status: "accepted",
      summary: "rollback drill accepted in test fixture",
      checks: { explicit_image_target: true, rollout_converged: true, post_rollback_healthz_json: true, post_rollback_readyz_json: true },
      cannotClaim: ["multi-region production", "SLA proven", "enterprise compliance"],
    }, null, 2)}\n`)));
  const liveTestPath = `.runtime/v22-cloud-authorization/${operationalRunId}/live_test.json`;
  await import("node:fs/promises").then(({ writeFile }) => writeFile(path.join(repoRoot, liveTestPath), `${JSON.stringify({
    kind: "v22_cloud_authorized_phase_evidence",
    operationClass: "live_test",
    status: "executed",
    resultSummaries: [{ ok: true, databaseProof: { databasePersistenceProof: true } }],
  }, null, 2)}\n`));
  const releaseDecision = spawnSync(process.execPath, ["scripts/cloud-rollout/medopl.mjs", "--release-decision"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      V22_CLOUD_GOAL_RUN_ID: operationalRunId,
    },
  });
  assert.equal(releaseDecision.status, 0, `release_decision_must_pass_after_operational_pointers:${releaseDecision.stderr || releaseDecision.stdout}`);
  const releaseDecisionPointer = JSON.parse(await readRepoFile(`.runtime/v22-cloud-authorization/${operationalRunId}/production-complete/final_release_decision_receipt.json`));
  assert.equal(releaseDecisionPointer.status, "accepted", "final_release_decision_pointer_must_be_accepted");
  assert.equal(JSON.stringify(releaseDecisionPointer).includes("production complete release"), false, "final_release_decision_pointer_must_not_claim_unscoped_production_complete");
  await import("node:fs/promises").then(({ rm }) => rm(path.join(repoRoot, ".runtime/v22-cloud-authorization", operationalRunId), { recursive: true, force: true }));
} finally {
  await availabilityServer.close();
}

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
