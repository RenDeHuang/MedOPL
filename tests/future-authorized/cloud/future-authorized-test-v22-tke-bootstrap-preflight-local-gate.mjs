import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const runner = "tests/support/cloud-prework/v22-tke-bootstrap-preflight-plan.js";
const selfFile = "tests/future-authorized/cloud/future-authorized-test-v22-tke-bootstrap-preflight-local-gate.mjs";

function commandFiles(commands = []) {
  return commands
    .map((command) => String(command).match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u)?.[1] || "")
    .filter(Boolean)
    .sort();
}

function run(args = []) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function assertNoSensitiveOutput(text = "", label = "output") {
  for (const forbidden of [
    "SecretId",
    "SecretKey",
    "TENCENT_MUTATION_SECRET_ID",
    "TENCENT_MUTATION_SECRET_KEY",
    "TENCENT_READONLY_SECRET_ID",
    "TENCENT_READONLY_SECRET_KEY",
    "kubeconfig",
    "KUBECONFIG",
    "signedUrl",
    "objectKey",
    "storageKey",
    "cosPrefix",
    "rawResponse",
    "Authorization:",
    "authorization:",
    "productionReady\":true",
    "\"productionReady\": true",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-tke-bootstrap-preflight-"));
try {
  const reportDir = path.join(tmp, "reports");
  const commonArgs = [
    "--dry-run",
    "--confirm-no-real-cloud",
    "--report-dir",
    reportDir,
    "--operation-id",
    "op-tke-bootstrap-proof",
    "--region",
    "na-siliconvalley",
    "--vpc-id",
    "vpc-placeholder",
    "--platform-node-pool-name",
    "medopl-platform-system",
    "--tenant-node-pool-name-prefix",
    "medopl-tenant-",
  ];

  const missingFlags = run(["--operation-id", "op-tke-bootstrap-proof"]);
  assert.notEqual(missingFlags.status, 0, "runner_must_fail_without_dry_run_confirmation");
  assert(missingFlags.stderr.includes("tke_bootstrap_preflight_authorization_required"), "missing_flags_reason");
  assertNoSensitiveOutput(missingFlags.stdout + missingFlags.stderr, "missing_flags_output");

  const forbiddenSecretFile = run([...commonArgs, "--secret-file", "/home/dev/.secrets/medopl/v22/package-c-mutation.env"]);
  assert.notEqual(forbiddenSecretFile.status, 0, "runner_must_reject_secret_file");
  assert(forbiddenSecretFile.stderr.includes("tke_bootstrap_preflight_forbidden_arg:--secret-file"), "secret_file_forbidden_reason");
  assertNoSensitiveOutput(forbiddenSecretFile.stdout + forbiddenSecretFile.stderr, "secret_file_output");

  for (const forbiddenArg of ["--live", "--execute", "--apply", "--mutate", "--deploy", "--kubectl", "--build", "--push"]) {
    const result = run([...commonArgs, forbiddenArg]);
    assert.notEqual(result.status, 0, `runner_must_reject:${forbiddenArg}`);
    assert(result.stderr.includes(`tke_bootstrap_preflight_forbidden_arg:${forbiddenArg}`), `forbidden_reason:${forbiddenArg}`);
    assertNoSensitiveOutput(result.stdout + result.stderr, `forbidden_output:${forbiddenArg}`);
  }

  const accepted = run(commonArgs);
  assert.equal(accepted.status, 0, `runner_should_pass_dry_run:${accepted.stderr}`);
  const summary = JSON.parse(accepted.stdout);
  assert.equal(summary.ok, true, "summary_ok");
  assert.equal(summary.planMode, "dry_run");
  assert.equal(summary.realCloudCalls, false, "summary_no_cloud");
  assert.equal(summary.mutationExecuted, false, "summary_no_mutation");
  assert.equal(summary.readsSecret, false, "summary_no_secret");
  assert.equal(summary.callsKubectl, false, "summary_no_kubectl");
  assert.equal(summary.deploysWorkload, false, "summary_no_deploy");
  assert.equal(summary.buildsOrPushesImage, false, "summary_no_build_push");
  assert.equal(summary.productionReady, false, "summary_not_production_ready");
  assert.equal(summary.requiredMutationEnvFields.length, 2, "summary_env_fields_count");
  assert.deepEqual(summary.requiredMutationEnvFields, [
    "TENCENT_MUTATION_TKE_CLUSTER_ID",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID",
  ], "summary_env_fields");
  assert.equal(summary.reportPath.endsWith("op-tke-bootstrap-proof-preflight.json"), true, "summary_report_path");
  assertNoSensitiveOutput(accepted.stdout + accepted.stderr, "accepted_output");

  const report = JSON.parse(await readFile(summary.reportPath, "utf8"));
  assert.equal(report.ok, true, "report_ok");
  assert.equal(report.planMode, "dry_run", "report_mode");
  assert.equal(report.productionReady, false, "report_not_production_ready");
  assert.equal(report.boundary.realCloudCalls, false, "report_no_cloud");
  assert.equal(report.boundary.mutationExecuted, false, "report_no_mutation");
  assert.equal(report.boundary.readsSecret, false, "report_no_secret");
  assert.equal(report.boundary.callsKubectl, false, "report_no_kubectl");
  assert.equal(report.boundary.deploysWorkload, false, "report_no_deploy");
  assert.equal(report.boundary.buildsOrPushesImage, false, "report_no_build_push");
  assert.equal(report.topology.dataPlane.requiredStores.includes("Redis"), false, "redis_must_not_be_required");
  assert.deepEqual(report.topology.dataPlane.requiredStores, ["PostgreSQL", "COS", "CBS"], "required_data_plane");
  assert.equal(report.target.clusterModel, "unified_tke_cluster_with_tenant_node_pools", "cluster_model");
  assert.equal(report.target.firstCanaryRequiresTenantNodePool, true, "first_canary_requires_tenant_node_pool");
  assert.equal(report.topology.tke.sharedUserComputePoolRequired, false, "shared_user_pool_not_required");
  assert.equal(report.topology.tke.premiumDedicatedPoolRequired, false, "premium_pool_not_required");
  assert.deepEqual(report.topology.tke.nodePools.map((item) => item.id), [
    "platform_service_pool",
    "tenant_node_pool_template",
  ], "node_pool_layers");
  assert.equal(report.topology.tke.nodePools.find((item) => item.id === "tenant_node_pool_template").createdDuringPackageC, true, "tenant_pool_created_during_package_c");
  assert.deepEqual(report.topology.kubernetesControls, [
    "namespace",
    "rbac",
    "resourcequota",
    "limitrange",
    "networkpolicy",
    "pod_security",
    "admission_policy",
    "taints_and_tolerations",
    "node_selector",
    "labels",
  ], "kubernetes_controls");
  assert.deepEqual(report.nextUserActions, [
    "Create or select VPC and private subnets in the target region.",
    "Create one TKE cluster with a platform service node pool only.",
    "Leave tenant node pools to Package C tenant or workspace lifecycle execution.",
    "Create or bind PostgreSQL, COS and CBS according to the production topology contract.",
    "Fill TENCENT_MUTATION_TKE_CLUSTER_ID and TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID after readonly inventory observes them.",
  ], "next_user_actions");
  assert.deepEqual(report.requiredMutationEnvFields, [
    "TENCENT_MUTATION_TKE_CLUSTER_ID",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID",
  ], "required_env_fields");
  assert.equal(report.requiredAuthorizationBeforeNextStep, "explicit_package_c_live_mutation_authorization", "required_next_authorization");
  assertNoSensitiveOutput(JSON.stringify(report), "report");

  const [contract, operationsSpec, runtimeSpec, manifest] = await Promise.all([
    readFile("docs/specs/README.md", "utf8"),
    readFile("specs/operations/spec.md", "utf8"),
    readFile("specs/runtime/spec.md", "utf8"),
    readFile("tests/fixtures/v22/agent-verify-manifest.json", "utf8").then(JSON.parse),
  ]);
  const futureAuthorizedFiles = commandFiles(manifest.suites.find((entry) => entry.id === "cloud-future-authorized")?.commands || []);
  assert(futureAuthorizedFiles.includes(selfFile), "future_authorized_suite_must_include_tke_bootstrap_preflight");
  assert(contract.includes("spec:v22-tke-bootstrap-preflight-boundary"), "contract_must_index_tke_bootstrap_preflight");
  assert(contract.includes("TKE bootstrap preflight"), "contract_must_describe_tke_bootstrap_preflight");
  assert(contract.includes("TENCENT_MUTATION_TKE_CLUSTER_ID"), "contract_must_name_cluster_env_field");
  assert(contract.includes("TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID"), "contract_must_name_platform_node_pool_env_field");
  assert.equal(contract.includes("TENCENT_MUTATION_TKE_NODE_POOL_ID"), false, "old_single_node_pool_env_must_be_removed");
  assert(contract.includes("PostgreSQL / COS / CBS"), "contract_must_keep_postgresql_cos_cbs_data_plane");
  assert.equal(contract.includes("Redis is required"), false, "contract_must_not_require_redis");
  assert(operationsSpec.includes("operations:tke-bootstrap-preflight"), "operations_spec_must_include_preflight_requirement");
  assert(runtimeSpec.includes("runtime:cloud-foundation-preflight"), "runtime_spec_must_include_preflight_requirement");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tke_bootstrap_preflight_local_gate",
  runner,
}, null, 2));
