import assert from "node:assert/strict";
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

const envNames = new Set((container.env || []).map((item) => item.name));
for (const expected of [
  "MEDOPL_ENV",
  "MEDOPL_PUBLIC_BASE_URL",
  "OPL_WEBUI_PUBLIC_BASE_URL",
  "DATABASE_URL",
]) {
  assert(envNames.has(expected), `container_env_missing:${expected}`);
}
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
assert(ingress.spec.tls?.some((entry) => entry.hosts?.includes("medopl.medopl.cn")), "ingress_tls_must_include_medopl_host");
assert(ingress.spec.rules?.some((rule) => rule.host === "medopl.medopl.cn"), "ingress_rule_must_include_medopl_host");

const rolloutSource = await readRepoFile("scripts/cloud-rollout/medopl.mjs");
assertNoRawSecretValues(rolloutSource, "medopl_rollout_helper");
for (const expected of [
  "medopl.medopl.cn",
  "uswccr.ccs.tencentyun.com/medopl/medopl-go-backend",
  "MEDOPL_IMAGE",
  "MEDOPL_NAMESPACE",
  "kubectl",
  "--availability-probe",
]) {
  assert(rolloutSource.includes(expected), `rollout_helper_contract_missing:${expected}`);
}

const releaseImage = await readRepoFile(".github/workflows/release-image.yml");
const cloudRollout = await readRepoFile(".github/workflows/cloud-rollout.yml");
assertNoRawSecretValues(releaseImage, "release_image_workflow");
assertNoRawSecretValues(cloudRollout, "cloud_rollout_workflow");
assert.equal(releaseImage.includes("workflow_run:"), false, "release_image_must_not_auto_push_after_verify");
assert.equal(releaseImage.includes("docker/build-push-action"), false, "release_image_build_push_must_go_through_cloud_goal_runner");
for (const expected of [
  "runs-on: [self-hosted, tencent-cloud, medopl]",
  "workflow_dispatch:",
  "environment: production",
  "V22_CONTAINER_BUILD_PUSH_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_CONTAINER_BUILD_PUSH_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation build_push --execute --confirm-current-session-authorization",
  "TCR_ID: ${{ secrets.TCR_USERNAME }}",
  "TCR_SECRET: ${{ secrets.TCR_PASSWORD }}",
  "npm run cloud:goal:preflight",
  "npm run cloud:goal -- --operation build_push",
  "services/medopl-go-backend/Dockerfile",
  "uswccr.ccs.tencentyun.com/medopl/medopl-go-backend",
]) {
  assert(releaseImage.includes(expected), `release_image_workflow_missing:${expected}`);
}
for (const expected of [
  "runs-on: [self-hosted, tencent-cloud, medopl]",
  "environment: production",
  "KUBECONFIG_CONTENT: ${{ secrets.KUBECONFIG }}",
  "V22_KUBERNETES_APPLY_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_KUBERNETES_APPLY_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation kubectl --execute --confirm-current-session-authorization",
  "V22_MEDOPL_DEPLOY_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_MEDOPL_DEPLOY_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation deploy --execute --confirm-current-session-authorization",
  "V22_OPL_WEBUI_CONSUMER_CANARY_RUNNER: tests/support/cloud-prework/production-goal-runners.mjs",
  "V22_OPL_WEBUI_CONSUMER_CANARY_COMMAND: node tests/support/cloud-prework/production-goal-command-runner.mjs --operation live_test --execute --confirm-current-session-authorization",
  "V22_MEDOPL_DEPLOY_PLAN_FILE: ${{ runner.temp }}/medopl-deploy-plan.json",
  "Create deploy plan",
  "npm run cloud:goal:preflight",
  "npm run cloud:goal -- --operation kubectl",
  "npm run cloud:goal -- --operation deploy",
  "npm run cloud:goal -- --operation live_test",
  "node scripts/cloud-rollout/medopl.mjs --apply",
]) {
  assert(cloudRollout.includes(expected), `cloud_rollout_workflow_missing:${expected}`);
}
assert.equal(cloudRollout.includes("runs-on: ubuntu-latest\n    environment: production"), false, "production_mutation_must_not_run_on_github_hosted_runner");

const packageJson = JSON.parse(await readRepoFile("package.json"));
assert.equal(packageJson.scripts["cloud:rollout:dry-run"], "node scripts/cloud-rollout/medopl.mjs", "cloud_rollout_dry_run_script_missing");
assert.equal(packageJson.scripts["cloud:rollout:availability"], "node scripts/cloud-rollout/medopl.mjs --availability-probe", "cloud_rollout_availability_script_missing");

const goalCurrent = await readRepoJson("tests/fixtures/v22/goal-current.json");
assert.equal(goalCurrent.last_landed_commit, "618f523ce38e4714f345e9fa49921a2256d1c182", "goal_current_must_sync_latest_landed_commit");

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
