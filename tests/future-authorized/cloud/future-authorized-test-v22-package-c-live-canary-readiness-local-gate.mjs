import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const runner = "tests/support/cloud-prework/v22-package-c-live-canary-readiness.js";

function run(args = []) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function assertNoSensitiveOutput(text = "", label = "output") {
  for (const forbidden of [
    "secret-id-proof",
    "secret-key-proof",
    "SecretId",
    "SecretKey",
    "KUBECONFIG",
    "Authorization:",
    "authorization:",
    "rawResponse",
    "signedUrl",
    "objectKey",
    "storageKey",
    "cosPrefix",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-package-c-live-canary-readiness-"));
try {
  const reportDir = path.join(tmp, "reports");
  const envFile = path.join(tmp, "package-c-mutation.env");
  await writeFile(envFile, [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION=0",
    "TENCENT_MUTATION_SECRET_ID=secret-id-proof",
    "TENCENT_MUTATION_SECRET_KEY=secret-key-proof",
    "TENCENT_MUTATION_ACCOUNT_ID=100047070895",
    "TENCENT_MUTATION_REGIONS=na-siliconvalley",
    "TENCENT_MUTATION_ALLOWED_APIS=GetCallerIdentity,DescribeClusters,DescribeNodePools,CreateNodePool,ScaleNodePool,DeleteNodePool,GetResources,TagResources",
    "TENCENT_MUTATION_DAILY_BUDGET_CNY=50",
    "TENCENT_MUTATION_MAX_OPERATION_COUNT=1",
    "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-fi097sy4",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID=np-cbk784r8",
    "TENCENT_MUTATION_PROTECTED_NODE_POOL_IDS=np-cbk784r8",
    "TENCENT_MUTATION_COS_BUCKET=opl-1410708315",
    "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
    "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT=medopl-v22/workspaces/",
    "",
  ].join("\n"));

  const commonArgs = [
    "--prepare-only",
    "--confirm-no-real-cloud",
    "--secret-file",
    envFile,
    "--operation-id",
    "op-package-c-live-canary-readiness-proof",
    "--account-id",
    "acct-canary-package-c",
    "--workspace-id",
    "ws-canary-package-c",
    "--resource-binding-id",
    "rb-canary-package-c-20260613-001",
    "--billing-attribution-id",
    "ba-canary-package-c-20260613-001",
    "--tenant-id",
    "tenant-canary-package-c",
    "--server-plan-id",
    "starter",
    "--target-cluster-id",
    "cls-fi097sy4",
    "--protected-platform-node-pool-id",
    "np-cbk784r8",
    "--tenant-node-pool-prefix",
    "medopl-tenant-",
    "--report-dir",
    reportDir,
  ];

  const missingFlags = run(["--operation-id", "op-package-c-live-canary-readiness-proof"]);
  assert.notEqual(missingFlags.status, 0, "runner_must_fail_without_prepare_flags");
  assert(missingFlags.stderr.includes("package_c_live_canary_readiness_prepare_confirmation_required"), "missing_flags_reason");
  assertNoSensitiveOutput(missingFlags.stdout + missingFlags.stderr, "missing_flags_output");

  for (const forbiddenArg of ["--live", "--execute", "--apply", "--mutate", "--deploy", "--kubectl", "--build", "--push", "--kubeconfig"]) {
    const result = run([...commonArgs, forbiddenArg]);
    assert.notEqual(result.status, 0, `runner_must_reject:${forbiddenArg}`);
    assert(result.stderr.includes(`package_c_live_canary_readiness_forbidden_arg:${forbiddenArg}`), `forbidden_reason:${forbiddenArg}`);
    assertNoSensitiveOutput(result.stdout + result.stderr, `forbidden_output:${forbiddenArg}`);
  }

  const protectedTarget = run([
    ...commonArgs,
    "--tenant-node-pool-prefix",
    "np-cbk784r8",
  ]);
  assert.notEqual(protectedTarget.status, 0, "runner_must_reject_protected_pool_as_tenant_prefix");
  assert(protectedTarget.stderr.includes("package_c_live_canary_readiness_tenant_prefix_must_be_medopl_tenant"), "protected_prefix_reason");
  assertNoSensitiveOutput(protectedTarget.stdout + protectedTarget.stderr, "protected_prefix_output");

  const badApiFile = path.join(tmp, "bad-api.env");
  await writeFile(badApiFile, [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION=0",
    "TENCENT_MUTATION_SECRET_ID=secret-id-proof",
    "TENCENT_MUTATION_SECRET_KEY=secret-key-proof",
    "TENCENT_MUTATION_ACCOUNT_ID=100047070895",
    "TENCENT_MUTATION_REGIONS=na-siliconvalley",
    "TENCENT_MUTATION_ALLOWED_APIS=GetCallerIdentity,DescribeClusters,DescribeNodePools,CreateNodePool,ScaleNodePool,DeleteNodePool,ModifyNodePool",
    "TENCENT_MUTATION_DAILY_BUDGET_CNY=50",
    "TENCENT_MUTATION_MAX_OPERATION_COUNT=1",
    "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-fi097sy4",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID=np-cbk784r8",
    "TENCENT_MUTATION_PROTECTED_NODE_POOL_IDS=np-cbk784r8",
    "TENCENT_MUTATION_COS_BUCKET=opl-1410708315",
    "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
    "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT=medopl-v22/workspaces/",
    "",
  ].join("\n"));
  const badApi = run([...commonArgs, "--secret-file", badApiFile]);
  assert.notEqual(badApi.status, 0, "runner_must_reject_non_allowlisted_api");
  assert(badApi.stderr.includes("package_c_live_canary_readiness_api_not_allowed:ModifyNodePool"), "bad_api_reason");
  assertNoSensitiveOutput(badApi.stdout + badApi.stderr, "bad_api_output");

  const blockedEvidence = run([...commonArgs, "--secret-file", badApiFile, "--allow-blocked-evidence"]);
  assert.equal(blockedEvidence.status, 0, `blocked_evidence_should_write_report:${blockedEvidence.stderr}`);
  assertNoSensitiveOutput(blockedEvidence.stdout + blockedEvidence.stderr, "blocked_evidence_output");
  const blockedSummary = JSON.parse(blockedEvidence.stdout);
  assert.equal(blockedSummary.ok, false, "blocked_summary_not_ok");
  assert.equal(blockedSummary.authorizationPackPath, "", "blocked_must_not_write_authorization_pack");
  const blockedReport = JSON.parse(await readFile(blockedSummary.reportPath, "utf8"));
  assert.equal(blockedReport.ok, false, "blocked_report_not_ok");
  assert.equal(blockedReport.blocked, true, "blocked_report_blocked");
  assert.equal(blockedReport.boundary.realCloudCalls, false, "blocked_no_cloud");
  assert.equal(blockedReport.boundary.mutationExecuted, false, "blocked_no_mutation");
  assert.deepEqual(blockedReport.blockers, ["package_c_live_canary_readiness_api_not_allowed:ModifyNodePool"], "blocked_reason");
  assertNoSensitiveOutput(JSON.stringify(blockedReport), "blocked_report");

  const accepted = run(commonArgs);
  assert.equal(accepted.status, 0, `runner_should_generate_readiness_pack:${accepted.stderr}`);
  assertNoSensitiveOutput(accepted.stdout + accepted.stderr, "accepted_output");
  const summary = JSON.parse(accepted.stdout);
  assert.equal(summary.ok, true, "summary_ok");
  assert.equal(summary.package, "C", "summary_package");
  assert.equal(summary.mode, "live_canary_readiness", "summary_mode");
  assert.equal(summary.realCloudCalls, false, "summary_no_cloud");
  assert.equal(summary.mutationExecuted, false, "summary_no_mutation");
  assert.equal(summary.callsKubectl, false, "summary_no_kubectl");
  assert.equal(summary.deploysWorkload, false, "summary_no_deploy");
  assert.equal(summary.buildsOrPushesImage, false, "summary_no_build_push");
  assert.equal(summary.readsKubeconfig, false, "summary_no_kubeconfig");
  assert.equal(summary.runGateValue, "0", "summary_run_gate_zero");
  assert.equal(summary.reportPath.endsWith("op-package-c-live-canary-readiness-proof-readiness.json"), true, "summary_report_path");
  assert.equal(summary.authorizationPackPath.endsWith("op-package-c-live-canary-readiness-proof-authorization-pack.json"), true, "summary_pack_path");

  const report = JSON.parse(await readFile(summary.reportPath, "utf8"));
  assert.equal(report.ok, true, "report_ok");
  assert.equal(report.boundary.realCloudCalls, false, "report_no_cloud");
  assert.equal(report.boundary.mutationExecuted, false, "report_no_mutation");
  assert.equal(report.boundary.callsKubectl, false, "report_no_kubectl");
  assert.equal(report.boundary.deploysWorkload, false, "report_no_deploy");
  assert.equal(report.boundary.buildsOrPushesImage, false, "report_no_build_push");
  assert.equal(report.boundary.readsKubeconfig, false, "report_no_kubeconfig");
  assert.equal(report.boundary.runGateValue, "0", "report_run_gate_zero");
  assert.equal(report.target.clusterId, "cls-fi097sy4", "target_cluster");
  assert.equal(report.target.protectedPlatformNodePoolId, "np-cbk784r8", "target_platform_pool");
  assert.deepEqual(report.target.protectedNodePoolIds, ["np-cbk784r8"], "target_protected_set");
  assert.equal(report.target.tenantNodePoolPrefix, "medopl-tenant-", "target_prefix");
  assert.equal(report.target.sharedUserComputePoolAllowed, false, "shared_pool_forbidden");
  assert.deepEqual(report.apiAllowlist, [
    "GetCallerIdentity",
    "DescribeClusters",
    "DescribeNodePools",
    "CreateNodePool",
    "ScaleNodePool",
    "DeleteNodePool",
    "GetResources",
    "TagResources",
  ], "api_allowlist");
  assert.deepEqual(report.secretAllowlist, [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
    "TENCENT_MUTATION_SECRET_ID",
    "TENCENT_MUTATION_SECRET_KEY",
    "TENCENT_MUTATION_ACCOUNT_ID",
    "TENCENT_MUTATION_REGIONS",
    "TENCENT_MUTATION_ALLOWED_APIS",
    "TENCENT_MUTATION_DAILY_BUDGET_CNY",
    "TENCENT_MUTATION_MAX_OPERATION_COUNT",
    "TENCENT_MUTATION_TKE_CLUSTER_ID",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID",
    "TENCENT_MUTATION_PROTECTED_NODE_POOL_IDS",
    "TENCENT_MUTATION_COS_BUCKET",
    "TENCENT_MUTATION_COS_REGION",
    "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT",
  ], "secret_allowlist");
  assert.deepEqual(report.expectedCreateReleasePlan.map((item) => item.action), [
    "validate_run_gate_disabled",
    "validate_identity",
    "observe_cluster",
    "observe_node_pools",
    "protect_platform_pool",
    "create_tenant_node_pool_desired_zero",
    "tag_tenant_resources",
    "scale_tenant_pool_to_one",
    "observe_tenant_pool",
    "scale_tenant_pool_to_zero",
    "delete_tenant_node_pool",
    "verify_cleanup",
  ], "expected_plan_actions");
  assert.equal(report.expectedCreateReleasePlan.every((item) => item.targetNodePoolId !== "np-cbk784r8"), true, "plan_must_not_target_platform_pool");
  assert.equal(report.requiredMissingCloudParameters.length > 0, true, "must_name_missing_cloud_parameters");
  assert(report.requiredMissingCloudParameters.includes("workerSubnetId"), "must_require_worker_subnet");
  assert(report.requiredMissingCloudParameters.includes("instanceType"), "must_require_instance_type");
  assert(report.evidenceSink.root.endsWith("op-package-c-live-canary-readiness-proof"), "evidence_sink_root");
  assert.equal(report.rollback.owner, "MedOPL Operations", "rollback_owner");
  assert.equal(report.rollback.protectedPlatformNodePoolId, "np-cbk784r8", "rollback_platform_pool");
  assertNoSensitiveOutput(JSON.stringify(report), "report");

  const pack = JSON.parse(await readFile(summary.authorizationPackPath, "utf8"));
  assert.equal(pack.operationClass, "package_c.tencent_tke_tenant_node_pool.live_canary.create_scale_release", "pack_operation_class");
  assert.equal(pack.targetResourceConstraints.protectedPlatformNodePoolId, "np-cbk784r8", "pack_platform_pool");
  assert.equal(pack.targetResourceConstraints.clusterId, "cls-fi097sy4", "pack_cluster");
  assert.equal(pack.targetResourceConstraints.tenantNodePoolPrefix, "medopl-tenant-", "pack_prefix");
  assert.equal(pack.authorizationRequiredBeforeLiveMutation, true, "pack_requires_authorization");
  assert.equal(pack.currentRunGateMustRemainZero, true, "pack_run_gate_zero");
  assert.equal(pack.forbiddenOperations.includes("kubectl"), true, "pack_forbids_kubectl");
  assert.equal(pack.forbiddenOperations.includes("deploy"), true, "pack_forbids_deploy");
  assert.equal(pack.forbiddenOperations.includes("build/push"), true, "pack_forbids_build_push");
  assertNoSensitiveOutput(JSON.stringify(pack), "authorization_pack");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_package_c_live_canary_readiness_local_gate",
  runner,
}, null, 2));
