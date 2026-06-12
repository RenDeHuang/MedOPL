import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const runner = "tests/support/cloud-prework/v22-tencent-create-release-dry-run-plan.js";

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
    "must-not-read",
    "kubeconfig",
    "KUBECONFIG",
    "signedUrl",
    "objectKey",
    "storageKey",
    "cosPrefix",
    "rawResponse",
    "Authorization:",
    "authorization:",
    "CVM",
    "cloud console",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-package-c-dry-run-"));
try {
  const reportDir = path.join(tmp, "reports");
  const commonArgs = [
    "--dry-run",
    "--confirm-no-real-cloud",
    "--report-dir",
    reportDir,
    "--operation-id",
    "op-package-c-proof",
    "--account-id",
    "acct-demo",
    "--workspace-id",
    "ws-demo",
    "--resource-binding-id",
    "rb-demo",
    "--billing-attribution-id",
    "ba-demo",
    "--server-plan-id",
    "pro",
    "--region",
    "na-siliconvalley",
  ];

  const missingFlags = run(["--operation-id", "op-package-c-proof"]);
  assert.notEqual(missingFlags.status, 0, "runner_must_fail_without_dry_run_confirmation");
  assert(missingFlags.stderr.includes("package_c_dry_run_authorization_required"), "missing_flags_reason");
  assertNoSensitiveOutput(missingFlags.stdout + missingFlags.stderr, "missing_flags_output");

  const forbiddenSecretFile = run([...commonArgs, "--secret-file", "/home/dev/.secrets/medopl/v22/package-c-mutation.env"]);
  assert.notEqual(forbiddenSecretFile.status, 0, "runner_must_reject_secret_file");
  assert(forbiddenSecretFile.stderr.includes("package_c_dry_run_forbidden_arg:--secret-file"), "secret_file_forbidden_reason");
  assertNoSensitiveOutput(forbiddenSecretFile.stdout + forbiddenSecretFile.stderr, "secret_file_output");

  const foundationEnvFile = path.join(tmp, "package-c-foundation.env");
  await writeFile(foundationEnvFile, [
    "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-proof",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID=np-platform-proof",
    "TENCENT_MUTATION_COS_BUCKET=opl-proof",
    "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
    "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT=medopl-v22/workspaces/",
    "",
  ].join("\n"));

  const forbiddenFoundationSecret = path.join(tmp, "package-c-foundation-secret.env");
  await writeFile(forbiddenFoundationSecret, [
    "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-proof",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID=np-platform-proof",
    "TENCENT_MUTATION_SECRET_ID=must-not-read",
    "",
  ].join("\n"));

  const missingFoundation = path.join(tmp, "package-c-foundation-missing.env");
  await writeFile(missingFoundation, [
    "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-proof",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID=np-platform-proof",
    "TENCENT_MUTATION_COS_BUCKET=opl-proof",
    "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
    "",
  ].join("\n"));

  const forbiddenFoundation = run([...commonArgs, "--foundation-env-file", forbiddenFoundationSecret]);
  assert.notEqual(forbiddenFoundation.status, 0, "runner_must_reject_foundation_secret_keys");
  assert(forbiddenFoundation.stderr.includes("package_c_foundation_env_forbidden_key:TENCENT_MUTATION_SECRET_ID"), "foundation_secret_forbidden_reason");
  assertNoSensitiveOutput(forbiddenFoundation.stdout + forbiddenFoundation.stderr, "foundation_secret_output");

  const missingFoundationResult = run([...commonArgs, "--foundation-env-file", missingFoundation]);
  assert.notEqual(missingFoundationResult.status, 0, "runner_must_reject_incomplete_foundation_env");
  assert(missingFoundationResult.stderr.includes("package_c_foundation_env_missing:TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT"), "foundation_missing_reason");
  assertNoSensitiveOutput(missingFoundationResult.stdout + missingFoundationResult.stderr, "foundation_missing_output");

  const forbiddenExecute = run([...commonArgs, "--execute"]);
  assert.notEqual(forbiddenExecute.status, 0, "runner_must_reject_execute");
  assert(forbiddenExecute.stderr.includes("package_c_dry_run_forbidden_arg:--execute"), "execute_forbidden_reason");

  const accepted = run([...commonArgs, "--foundation-env-file", foundationEnvFile]);
  assert.equal(accepted.status, 0, `runner_should_pass_dry_run:${accepted.stderr}`);
  const summary = JSON.parse(accepted.stdout);
  assert.equal(summary.ok, true, "summary_ok");
  assert.equal(summary.package, "C");
  assert.equal(summary.planMode, "dry_run");
  assert.equal(summary.realCloudCalls, false, "summary_no_cloud");
  assert.equal(summary.mutationExecuted, false, "summary_no_mutation");
  assert.equal(summary.readsMutationSecret, false, "summary_no_secret");
  assert.equal(summary.callsKubectl, false, "summary_no_kubectl");
  assert.equal(summary.buildsOrPushesImage, false, "summary_no_build_push");
  assert.equal(summary.reportPath.endsWith("op-package-c-proof-dry-run.json"), true, "summary_report_path");
  assertNoSensitiveOutput(accepted.stdout + accepted.stderr, "accepted_output");

  const report = JSON.parse(await readFile(summary.reportPath, "utf8"));
  assert.equal(report.ok, true, "report_ok");
  assert.equal(report.package, "C", "report_package");
  assert.equal(report.operationId, "op-package-c-proof", "report_operation_id");
  assert.equal(report.planMode, "dry_run", "report_mode");
  assert.equal(report.boundary.realCloudCalls, false, "report_no_cloud");
  assert.equal(report.boundary.mutationExecuted, false, "report_no_mutation");
  assert.equal(report.boundary.readsMutationSecret, false, "report_no_secret");
  assert.equal(report.boundary.writesLedger, false, "report_no_ledger");
  assert.equal(report.boundary.callsKubectl, false, "report_no_kubectl");
  assert.equal(report.boundary.buildsOrPushesImage, false, "report_no_build_push");
  assert.equal(report.storagePlan.resourceType, "workspace_file_space", "storage_type");
  assert.equal(report.storagePlan.retentionPolicy.deleteProtectionDays, 7, "storage_retention_days");
  assert.equal(report.computePlan.resourceType, "workspace_compute_allocation", "compute_type");
  assert.equal(report.computePlan.clusterModel, "unified_tke_cluster_with_tenant_node_pools", "compute_cluster_model");
  assert.deepEqual(report.computePlan.kubernetesControls, [
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
  ], "compute_kubernetes_controls");
  assert.equal(report.computePlan.platformServicePoolPreserved, true, "platform_service_pool_preserved");
  assert.deepEqual(report.foundation, {
    clusterRef: "cls-proof",
    platformServiceNodePoolRef: "np-platform-proof",
    platformServicePoolProtected: true,
    cosBucketRef: "opl-proof",
    cosRegion: "na-siliconvalley",
    workspacePrefixRoot: "medopl-v22/workspaces/",
  }, "foundation_mapping");
  assert.equal(report.computePlan.sharedUserComputePoolUsed, false, "shared_user_pool_not_used");
  assert.equal(Object.hasOwn(report.computePlan, "standardPlanUsesSharedPool"), false, "old_standard_shared_pool_field_removed");
  assert.equal(Object.hasOwn(report.computePlan, "premiumDedicatedPoolSupported"), false, "old_premium_pool_field_removed");
  assert.deepEqual(report.computePlan.tenantNodePoolPlan, {
    action: "plan_create_or_release",
    ownership: "tenant_workspace_dedicated",
    createdByPackageC: true,
    releasedByPackageC: true,
    bindsAccountId: "acct-demo",
    bindsWorkspaceId: "ws-demo",
    bindsResourceBindingId: "rb-demo",
    nodePoolNamePrefix: "medopl-tenant-",
  }, "tenant_node_pool_plan");
  assert.equal(report.billingPlan.chargeApplied, false, "billing_no_charge");
  assert.equal(report.billingPlan.freezeOnly, true, "billing_freeze_only");
  assert.equal(report.safetyChecks.every((item) => item.status === "pass"), true, "safety_checks_pass");
  assertNoSensitiveOutput(JSON.stringify(report), "report");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_create_release_dry_run_plan_local_gate",
  runner,
}, null, 2));
