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
  const cloudParamsFile = path.join(tmp, "package-c-live-canary-cloud-params.json");
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
  await writeFile(cloudParamsFile, JSON.stringify({
    schemaVersion: 1,
    clusterId: "cls-fi097sy4",
    protectedPlatformNodePoolId: "np-cbk784r8",
    tenantNodePoolPrefix: "medopl-tenant-",
    planId: "starter",
    workerSubnetId: "subnet-a1fldajw",
    securityGroupId: "sg-6671l5we",
    availabilityZone: "na-siliconvalley-1",
    systemDisk: {
      type: "CLOUD_BSSD",
      sizeGb: 50,
    },
    billingMode: "POSTPAID_BY_HOUR",
    publicIp: {
      enabled: false,
    },
    nodeImageOrRuntimeConfig: {
      imageType: "TKE_RUNTIME",
      runtime: "containerd",
      runtimeVersion: "1.6",
    },
    loginOrKeyPolicy: {
      mode: "DISABLED",
    },
  }, null, 2));

  const baseArgs = [
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
  const commonArgs = [
    ...baseArgs,
    "--cloud-params-file",
    cloudParamsFile,
  ];

  const missingFlags = run(["--operation-id", "op-package-c-live-canary-readiness-proof"]);
  assert.notEqual(missingFlags.status, 0, "runner_must_fail_without_prepare_flags");
  assert(missingFlags.stderr.includes("package_c_live_canary_readiness_prepare_confirmation_required"), "missing_flags_reason");
  assertNoSensitiveOutput(missingFlags.stdout + missingFlags.stderr, "missing_flags_output");

  for (const forbiddenArg of ["--live", "--execute", "--apply", "--mutate", "--deploy", "--kubectl", "--build", "--push", "--kubeconfig"]) {
    const result = run([...baseArgs, forbiddenArg]);
    assert.notEqual(result.status, 0, `runner_must_reject:${forbiddenArg}`);
    assert(result.stderr.includes(`package_c_live_canary_readiness_forbidden_arg:${forbiddenArg}`), `forbidden_reason:${forbiddenArg}`);
    assertNoSensitiveOutput(result.stdout + result.stderr, `forbidden_output:${forbiddenArg}`);
  }

  const protectedTarget = run([
    ...baseArgs,
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
  const badApi = run([...baseArgs, "--secret-file", badApiFile]);
  assert.notEqual(badApi.status, 0, "runner_must_reject_non_allowlisted_api");
  assert(badApi.stderr.includes("package_c_live_canary_readiness_api_not_allowed:ModifyNodePool"), "bad_api_reason");
  assertNoSensitiveOutput(badApi.stdout + badApi.stderr, "bad_api_output");

  const blockedEvidence = run([...baseArgs, "--secret-file", badApiFile, "--allow-blocked-evidence"]);
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

  const envWithWorkerParams = path.join(tmp, "env-with-worker-params.env");
  await writeFile(envWithWorkerParams, [
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
    "TENCENT_MUTATION_WORKER_SUBNET_ID=subnet-a1fldajw",
    "",
  ].join("\n"));
  const envWorkerParam = run([...baseArgs, "--secret-file", envWithWorkerParams]);
  assert.notEqual(envWorkerParam.status, 0, "runner_must_reject_worker_params_in_mutation_env");
  assert(envWorkerParam.stderr.includes("package_c_live_canary_readiness_secret_key_not_allowed:TENCENT_MUTATION_WORKER_SUBNET_ID"), "env_worker_param_reason");
  assertNoSensitiveOutput(envWorkerParam.stdout + envWorkerParam.stderr, "env_worker_param_output");

  const badCloudParamsFile = path.join(tmp, "bad-cloud-params.json");
  await writeFile(badCloudParamsFile, JSON.stringify({
    schemaVersion: 1,
    clusterId: "cls-fi097sy4",
    protectedPlatformNodePoolId: "np-cbk784r8",
    tenantNodePoolPrefix: "medopl-tenant-",
    planId: "starter",
    workerSubnetId: "subnet-not-allowed",
    securityGroupId: "sg-6671l5we",
    availabilityZone: "na-siliconvalley-1",
    systemDisk: { type: "CLOUD_BSSD", sizeGb: 50 },
    billingMode: "POSTPAID_BY_HOUR",
    publicIp: { enabled: true },
    nodeImageOrRuntimeConfig: { imageType: "TKE_RUNTIME", runtime: "containerd", runtimeVersion: "1.6" },
    loginOrKeyPolicy: { mode: "DISABLED" },
  }, null, 2));
  const badCloudParams = run([...commonArgs, "--cloud-params-file", badCloudParamsFile]);
  assert.notEqual(badCloudParams.status, 0, "runner_must_reject_bad_cloud_params");
  assert(badCloudParams.stderr.includes("package_c_live_canary_readiness_worker_subnet_must_be_subnet_a1fldajw"), "bad_cloud_worker_subnet_reason");
  assertNoSensitiveOutput(badCloudParams.stdout + badCloudParams.stderr, "bad_cloud_params_output");

  const publicIpEnabledFile = path.join(tmp, "public-ip-enabled-cloud-params.json");
  await writeFile(publicIpEnabledFile, JSON.stringify({
    schemaVersion: 1,
    clusterId: "cls-fi097sy4",
    protectedPlatformNodePoolId: "np-cbk784r8",
    tenantNodePoolPrefix: "medopl-tenant-",
    planId: "starter",
    workerSubnetId: "subnet-a1fldajw",
    securityGroupId: "sg-6671l5we",
    availabilityZone: "na-siliconvalley-1",
    systemDisk: { type: "CLOUD_BSSD", sizeGb: 50 },
    billingMode: "POSTPAID_BY_HOUR",
    publicIp: { enabled: true },
    nodeImageOrRuntimeConfig: { imageType: "TKE_RUNTIME", runtime: "containerd", runtimeVersion: "1.6" },
    loginOrKeyPolicy: { mode: "DISABLED" },
  }, null, 2));
  const publicIpEnabled = run([...commonArgs, "--cloud-params-file", publicIpEnabledFile]);
  assert.notEqual(publicIpEnabled.status, 0, "runner_must_reject_public_ip_enabled");
  assert(publicIpEnabled.stderr.includes("package_c_live_canary_readiness_public_ip_must_be_disabled"), "public_ip_enabled_reason");
  assertNoSensitiveOutput(publicIpEnabled.stdout + publicIpEnabled.stderr, "public_ip_enabled_output");

  const forbiddenInstanceTypeFile = path.join(tmp, "forbidden-instance-type-cloud-params.json");
  await writeFile(forbiddenInstanceTypeFile, JSON.stringify({
    schemaVersion: 1,
    clusterId: "cls-fi097sy4",
    protectedPlatformNodePoolId: "np-cbk784r8",
    tenantNodePoolPrefix: "medopl-tenant-",
    planId: "starter",
    workerSubnetId: "subnet-a1fldajw",
    securityGroupId: "sg-6671l5we",
    availabilityZone: "na-siliconvalley-1",
    instanceType: "SA5.MEDIUM2",
    systemDisk: { type: "CLOUD_BSSD", sizeGb: 50 },
    billingMode: "POSTPAID_BY_HOUR",
    publicIp: { enabled: false },
    nodeImageOrRuntimeConfig: { imageType: "TKE_RUNTIME", runtime: "containerd", runtimeVersion: "1.6" },
    loginOrKeyPolicy: { mode: "DISABLED" },
  }, null, 2));
  const forbiddenInstanceType = run([...commonArgs, "--cloud-params-file", forbiddenInstanceTypeFile]);
  assert.notEqual(forbiddenInstanceType.status, 0, "runner_must_reject_arbitrary_instance_type");
  assert(forbiddenInstanceType.stderr.includes("package_c_live_canary_readiness_cloud_param_not_allowed:instanceType"), "forbidden_instance_type_reason");
  assertNoSensitiveOutput(forbiddenInstanceType.stdout + forbiddenInstanceType.stderr, "forbidden_instance_type_output");

  const forbiddenNodeInstanceTypeFile = path.join(tmp, "forbidden-node-instance-type-cloud-params.json");
  await writeFile(forbiddenNodeInstanceTypeFile, JSON.stringify({
    schemaVersion: 1,
    clusterId: "cls-fi097sy4",
    protectedPlatformNodePoolId: "np-cbk784r8",
    tenantNodePoolPrefix: "medopl-tenant-",
    planId: "starter",
    workerSubnetId: "subnet-a1fldajw",
    securityGroupId: "sg-6671l5we",
    availabilityZone: "na-siliconvalley-1",
    nodeInstanceType: "SA5.16XLARGE128",
    systemDisk: { type: "CLOUD_BSSD", sizeGb: 50 },
    billingMode: "POSTPAID_BY_HOUR",
    publicIp: { enabled: false },
    nodeImageOrRuntimeConfig: { imageType: "TKE_RUNTIME", runtime: "containerd", runtimeVersion: "1.6" },
    loginOrKeyPolicy: { mode: "DISABLED" },
  }, null, 2));
  const forbiddenNodeInstanceType = run([...commonArgs, "--cloud-params-file", forbiddenNodeInstanceTypeFile]);
  assert.notEqual(forbiddenNodeInstanceType.status, 0, "runner_must_reject_arbitrary_node_instance_type");
  assert(forbiddenNodeInstanceType.stderr.includes("package_c_live_canary_readiness_cloud_param_not_allowed:nodeInstanceType"), "forbidden_node_instance_type_reason");
  assertNoSensitiveOutput(forbiddenNodeInstanceType.stdout + forbiddenNodeInstanceType.stderr, "forbidden_node_instance_type_output");

  const unknownPlanFile = path.join(tmp, "unknown-plan-cloud-params.json");
  await writeFile(unknownPlanFile, JSON.stringify({
    schemaVersion: 1,
    clusterId: "cls-fi097sy4",
    protectedPlatformNodePoolId: "np-cbk784r8",
    tenantNodePoolPrefix: "medopl-tenant-",
    planId: "custom-99c",
    workerSubnetId: "subnet-a1fldajw",
    securityGroupId: "sg-6671l5we",
    availabilityZone: "na-siliconvalley-1",
    systemDisk: { type: "CLOUD_BSSD", sizeGb: 50 },
    billingMode: "POSTPAID_BY_HOUR",
    publicIp: { enabled: false },
    nodeImageOrRuntimeConfig: { imageType: "TKE_RUNTIME", runtime: "containerd", runtimeVersion: "1.6" },
    loginOrKeyPolicy: { mode: "DISABLED" },
  }, null, 2));
  const unknownPlan = run([...commonArgs, "--cloud-params-file", unknownPlanFile]);
  assert.notEqual(unknownPlan.status, 0, "runner_must_reject_unknown_plan");
  assert(unknownPlan.stderr.includes("package_c_live_canary_readiness_plan_not_allowlisted:custom-99c"), "unknown_plan_reason");
  assertNoSensitiveOutput(unknownPlan.stdout + unknownPlan.stderr, "unknown_plan_output");

  const planMismatchFile = path.join(tmp, "plan-mismatch-cloud-params.json");
  await writeFile(planMismatchFile, JSON.stringify({
    schemaVersion: 1,
    clusterId: "cls-fi097sy4",
    protectedPlatformNodePoolId: "np-cbk784r8",
    tenantNodePoolPrefix: "medopl-tenant-",
    planId: "pro",
    workerSubnetId: "subnet-a1fldajw",
    securityGroupId: "sg-6671l5we",
    availabilityZone: "na-siliconvalley-1",
    systemDisk: { type: "CLOUD_BSSD", sizeGb: 50 },
    billingMode: "POSTPAID_BY_HOUR",
    publicIp: { enabled: false },
    nodeImageOrRuntimeConfig: { imageType: "TKE_RUNTIME", runtime: "containerd", runtimeVersion: "1.6" },
    loginOrKeyPolicy: { mode: "DISABLED" },
  }, null, 2));
  const planMismatch = run([...commonArgs, "--cloud-params-file", planMismatchFile]);
  assert.notEqual(planMismatch.status, 0, "runner_must_reject_plan_mismatch");
  assert(planMismatch.stderr.includes("package_c_live_canary_readiness_plan_mismatch:starter_2c4g_10gb:pro_8c16g_100gb"), "plan_mismatch_reason");
  assertNoSensitiveOutput(planMismatch.stdout + planMismatch.stderr, "plan_mismatch_output");

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
  assert.deepEqual(report.requiredMissingCloudParameters, [], "cloud_params_no_longer_missing_when_file_present");
  assert.equal(report.cloudParametersSource.kind, "non_secret_json_file", "cloud_params_source_kind");
  assert.equal(report.cloudParametersSource.path.includes("package-c-mutation.env"), false, "cloud_params_must_not_be_mutation_env");
  assert.equal(report.cloudParameters.workerSubnetId, "subnet-a1fldajw", "cloud_worker_subnet");
  assert.equal(report.cloudParameters.securityGroupId, "sg-6671l5we", "cloud_security_group");
  assert.equal(report.cloudParameters.publicIp.enabled, false, "public_ip_disabled");
  assert.equal(report.cloudParameters.clusterId, "cls-fi097sy4", "cloud_cluster");
  assert.equal(report.cloudParameters.protectedPlatformNodePoolId, "np-cbk784r8", "cloud_protected_pool");
  assert.equal(report.cloudParameters.tenantNodePoolPrefix, "medopl-tenant-", "cloud_prefix");
  assert.equal(report.cloudParameters.planId, "starter_2c4g_10gb", "cloud_plan_id");
  assert.equal(report.cloudParameters.requestedPlanId, "starter", "cloud_requested_plan_id");
  assert.equal(report.cloudParameters.planCatalogId, "v22_package_c_live_canary_plan_catalog_allowlist", "cloud_plan_catalog_id");
  assert.deepEqual(report.cloudParameters.compute, { cpuCores: 2, memoryGb: 4, maxConcurrentTasks: 1 }, "cloud_plan_compute");
  assert.equal(report.cloudParameters.workspaceStorageGb, 10, "cloud_workspace_storage");
  assert.equal(report.cloudParameters.nodeInstanceType, "SA5.MEDIUM4", "cloud_node_instance_type");
  assert.equal(report.cloudParameters.systemDisk.type, "CLOUD_BSSD", "cloud_system_disk_type");
  assert.equal(report.cloudParameters.systemDisk.sizeGb, 50, "cloud_system_disk_size");
  assert.notEqual(report.cloudParameters.workspaceStorageGb, report.cloudParameters.systemDisk.sizeGb, "workspace_storage_must_not_equal_system_disk");
  assert(report.evidenceSink.root.endsWith("op-package-c-live-canary-readiness-proof"), "evidence_sink_root");
  assert.equal(report.evidenceSink.files.includes("create-request-redacted.json"), true, "must_write_redacted_create_request");
  assert.equal(report.rollback.owner, "MedOPL Operations", "rollback_owner");
  assert.equal(report.rollback.protectedPlatformNodePoolId, "np-cbk784r8", "rollback_platform_pool");
  assertNoSensitiveOutput(JSON.stringify(report), "report");

  const redactedCreateRequest = JSON.parse(await readFile(path.join(report.evidenceSink.root, "create-request-redacted.json"), "utf8"));
  assert.equal(redactedCreateRequest.api, "CreateNodePool", "redacted_request_api");
  assert.equal(redactedCreateRequest.executedNow, false, "redacted_request_not_executed");
  assert.equal(redactedCreateRequest.clusterId, "cls-fi097sy4", "redacted_request_cluster");
  assert.equal(redactedCreateRequest.workerSubnetId, "subnet-a1fldajw", "redacted_request_worker_subnet");
  assert.equal(redactedCreateRequest.securityGroupId, "sg-6671l5we", "redacted_request_security_group");
  assert.equal(redactedCreateRequest.publicIp.enabled, false, "redacted_request_public_ip_disabled");
  assert.equal(redactedCreateRequest.createNodePoolNativeInternetAccessible.AddressType, "PublicIP", "redacted_request_address_type_public_ip");
  assert.equal(redactedCreateRequest.createNodePoolNativeInternetAccessible.MaxBandwidthOut, 0, "redacted_request_max_bandwidth_zero");
  assert.equal(redactedCreateRequest.createNodePoolNativeInternetAccessible.publicIpDisabled, true, "redacted_request_public_ip_disabled_by_zero_bandwidth");
  assert.deepEqual(redactedCreateRequest.createNodePoolInlineTags, [], "redacted_request_must_not_inline_cloud_tags");
  assert.deepEqual(redactedCreateRequest.createNodePoolInlineAnnotations, [], "redacted_request_must_not_inline_annotations");
  assert.equal(redactedCreateRequest.tagResourcesPlan.api, "TagResources", "redacted_request_tag_resources_api");
  assert.equal(redactedCreateRequest.tagResourcesPlan.afterCreateNodePool, true, "redacted_request_tag_resources_after_create");
  assert.equal(redactedCreateRequest.tagResourcesPlan.cloudTagSupport, "tkeNodePoolUnsupported", "redacted_request_tag_resources_cloud_support");
  assert.equal(redactedCreateRequest.tagResourcesPlan.hardBlocker, false, "redacted_request_tag_resources_not_hard_blocker");
  assert.equal(redactedCreateRequest.tagResourcesPlan.unsupportedServiceSkipCode, "InvalidParameter.UnsupportedService", "redacted_request_tag_resources_unsupported_skip_code");
  assert.equal(redactedCreateRequest.tagResourcesPlan.canonicalOwnershipSource, "postgres_resource_binding_ledger", "redacted_request_canonical_ownership_source");
  assert.equal(redactedCreateRequest.tagResourcesPlan.canaryOwnershipEvidenceSink, ".runtime", "redacted_request_canary_ownership_evidence_sink");
  assert.equal(redactedCreateRequest.tagResourcesPlan.futureCanonicalStore, "PostgreSQL resource_bindings/cloud_operations", "redacted_request_future_canonical_store");
  assert.deepEqual(redactedCreateRequest.tagResourcesPlan.tags, [
    { TagKey: "resourceBindingId", TagValue: "rb-canary-package-c-20260613-001" },
    { TagKey: "billingAttributionId", TagValue: "ba-canary-package-c-20260613-001" },
    { TagKey: "tenantId", TagValue: "tenant-canary-package-c" },
    { TagKey: "workspaceId", TagValue: "ws-canary-package-c" },
    { TagKey: "medopl.io/role", TagValue: "tenant_node_pool" },
    { TagKey: "medopl.io/package", TagValue: "C" },
    { TagKey: "medopl.io/canary", TagValue: "package_c_live" },
  ], "redacted_request_uses_tencent_tag_api_field_names");
  assert.equal(Object.hasOwn(redactedCreateRequest, "instanceType"), false, "redacted_request_must_not_accept_raw_instance_type");
  assert.equal(redactedCreateRequest.planId, "starter_2c4g_10gb", "redacted_request_plan_id");
  assert.equal(redactedCreateRequest.nodeInstanceType, "SA5.MEDIUM4", "redacted_request_node_instance_type");
  assert.equal(redactedCreateRequest.workspaceStorageGb, 10, "redacted_request_workspace_storage");
  assert.equal(redactedCreateRequest.systemDisk.type, "CLOUD_BSSD", "redacted_request_disk_type");
  assert.equal(redactedCreateRequest.systemDisk.sizeGb, 50, "redacted_request_disk_size");
  assert.equal(redactedCreateRequest.billingMode, "POSTPAID_BY_HOUR", "redacted_request_billing_mode");
  assert.equal(redactedCreateRequest.loginOrKeyPolicy.mode, "DISABLED", "redacted_request_login_disabled");
  assertNoSensitiveOutput(JSON.stringify(redactedCreateRequest), "redacted_create_request");

  const pack = JSON.parse(await readFile(summary.authorizationPackPath, "utf8"));
  assert.equal(pack.operationClass, "package_c.tencent_tke_tenant_node_pool.live_canary.create_scale_release", "pack_operation_class");
  assert.equal(pack.targetResourceConstraints.protectedPlatformNodePoolId, "np-cbk784r8", "pack_platform_pool");
  assert.equal(pack.targetResourceConstraints.clusterId, "cls-fi097sy4", "pack_cluster");
  assert.equal(pack.targetResourceConstraints.tenantNodePoolPrefix, "medopl-tenant-", "pack_prefix");
  assert.equal(pack.authorizationRequiredBeforeLiveMutation, true, "pack_requires_authorization");
  assert.equal(pack.currentRunGateMustRemainZero, true, "pack_run_gate_zero");
  assert.equal(pack.cloudParameters.workerSubnetId, "subnet-a1fldajw", "pack_worker_subnet");
  assert.equal(pack.cloudParameters.securityGroupId, "sg-6671l5we", "pack_security_group");
  assert.equal(pack.cloudParameters.publicIp.enabled, false, "pack_public_ip_disabled");
  assert.equal(pack.cloudParameters.planId, "starter_2c4g_10gb", "pack_plan_id");
  assert.equal(pack.cloudParameters.workspaceStorageGb, 10, "pack_workspace_storage");
  assert.equal(pack.cloudParameters.nodeInstanceType, "SA5.MEDIUM4", "pack_node_instance_type");
  assert.equal(pack.cloudParametersSource.kind, "non_secret_json_file", "pack_cloud_params_source");
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
