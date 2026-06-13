import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  parsePackageCLiveCanaryLiveArgs,
  runPackageCLiveCanaryLive,
} from "../../support/cloud-prework/v22-package-c-live-canary-live-runner.js";

const runner = "tests/support/cloud-prework/v22-package-c-live-canary-live-runner.js";

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
    "Authorization:",
    "authorization:",
    "rawResponse",
    "signedUrl",
    "KUBECONFIG",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

function assertLedgerDoesNotWriteProtectedPool(summary, label) {
  assert.notEqual(summary.ledger?.resourceBinding?.nodePoolId, "np-cbk784r8", `${label}_resource_binding_must_not_write_platform_pool`);
  assert.notEqual(summary.ledger?.cloudOperation?.nodePoolId, "np-cbk784r8", `${label}_cloud_operation_must_not_write_platform_pool`);
  for (const transition of summary.ledger?.stateTransitions || []) {
    assert.notEqual(transition.resourceBinding?.nodePoolId, "np-cbk784r8", `${label}_transition_resource_binding_must_not_write_platform_pool`);
    assert.notEqual(transition.cloudOperation?.nodePoolId, "np-cbk784r8", `${label}_transition_cloud_operation_must_not_write_platform_pool`);
  }
}

function baseEnv(runGate = "1") {
  return [
    `RUN_TENCENT_CREATE_RELEASE_EXECUTION=${runGate}`,
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
  ].join("\n");
}

function cloudParams() {
  return {
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
  };
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-package-c-live-canary-live-runner-"));
try {
  const reportDir = path.join(tmp, "reports");
  const envFile = path.join(tmp, "package-c-mutation.env");
  const runGateZeroEnvFile = path.join(tmp, "package-c-mutation-gate-zero.env");
  const cloudParamsFile = path.join(tmp, "cloud-params.json");

  await writeFile(envFile, baseEnv("1"));
  await writeFile(runGateZeroEnvFile, baseEnv("0"));
  await writeFile(cloudParamsFile, JSON.stringify(cloudParams(), null, 2));

  const baseArgs = [
    "--live",
    "--confirm-real-cloud",
    "--secret-file",
    envFile,
    "--cloud-params-file",
    cloudParamsFile,
    "--operation-id",
    "op-package-c-live-canary-live-proof",
    "--account-id",
    "acct-canary-package-c",
    "--workspace-id",
    "ws-canary-package-c",
    "--resource-binding-id",
    "rb-package-c-live-canary-20260613",
    "--billing-attribution-id",
    "ba-package-c-live-canary-20260613",
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

  const missingLive = run(["--operation-id", "op-package-c-live-canary-live-proof"]);
  assert.notEqual(missingLive.status, 0, "runner_must_fail_without_live_flags");
  assert(missingLive.stderr.includes("package_c_live_canary_live_confirmation_required"), "missing_live_reason");
  assertNoSensitiveOutput(missingLive.stdout + missingLive.stderr, "missing_live_output");

  for (const forbiddenArg of ["--deploy", "--kubectl", "--build", "--push", "--kubeconfig", "--package-d", "--modify-node-pool"]) {
    const result = run([...baseArgs, forbiddenArg]);
    assert.notEqual(result.status, 0, `runner_must_reject:${forbiddenArg}`);
    assert(result.stderr.includes(`package_c_live_canary_live_forbidden_arg:${forbiddenArg}`), `forbidden_reason:${forbiddenArg}`);
    assertNoSensitiveOutput(result.stdout + result.stderr, `forbidden_output:${forbiddenArg}`);
  }

  const runGateBlocked = run([...baseArgs, "--secret-file", runGateZeroEnvFile]);
  assert.notEqual(runGateBlocked.status, 0, "runner_must_require_run_gate_one");
  assert(runGateBlocked.stderr.includes("package_c_live_canary_live_run_gate_must_be_one"), "run_gate_blocked_reason");
  assertNoSensitiveOutput(runGateBlocked.stdout + runGateBlocked.stderr, "run_gate_blocked_output");

  const calls = [];
  const fakeModules = {
    async getCallerIdentity(req = null) {
      calls.push({ api: "GetCallerIdentity", req });
      return { AccountId: "100047070895", Type: "CAMUser", RequestId: "req-sts" };
    },
    async describeClusters(region, req = {}) {
      calls.push({ api: "DescribeClusters", region, req });
      return { Clusters: [{ ClusterId: "cls-fi097sy4", ClusterStatus: "Running" }], RequestId: "req-clusters" };
    },
    async describeNodePools(region, req = {}) {
      calls.push({ api: "DescribeNodePools", region, req });
      if (req?.Filters?.some((filter) => filter.Name === "NodePoolsName")) {
        return { NodePools: [{ NodePoolId: "np-tenant-proof", Name: "medopl-tenant-rb-package-c-live-canary-20260613" }], RequestId: "req-node-pool-name" };
      }
      return { NodePools: [{ NodePoolId: "np-cbk784r8", Name: "platform" }], RequestId: "req-node-pools" };
    },
    async createNodePool(region, req = {}) {
      calls.push({ api: "CreateNodePool", region, req });
      return { NodePoolId: "np-tenant-proof", RequestId: "req-create" };
    },
    async tagResources(req = {}) {
      calls.push({ api: "TagResources", req });
      return { RequestId: "req-tag" };
    },
    async scaleNodePool(region, req = {}) {
      calls.push({ api: "ScaleNodePool", region, req });
      return { RequestId: `req-scale-${req.Replicas}` };
    },
    async deleteNodePool(region, req = {}) {
      calls.push({ api: "DeleteNodePool", region, req });
      return { RequestId: "req-delete" };
    },
    async getResources(req = {}) {
      calls.push({ api: "GetResources", req });
      return { ResourceTagMappingList: [], RequestId: "req-get-resources" };
    },
  };

  const options = parsePackageCLiveCanaryLiveArgs(baseArgs);
  const summary = await runPackageCLiveCanaryLive({ options, modules: fakeModules });
  assert.equal(summary.ok, true, "live_summary_ok");
  assert.equal(summary.mode, "live_canary", "live_summary_mode");
  assert.equal(summary.realCloudCalls, true, "live_summary_real_cloud");
  assert.equal(summary.mutationExecuted, true, "live_summary_mutation");
  assert.equal(summary.targetNodePoolName, "medopl-tenant-rb-package-c-live-canary-20260613", "live_summary_target_name");
  assert.equal(summary.targetNodePoolId, "np-tenant-proof", "live_summary_target_id");
  assert.equal(summary.runGateResetTo, "0", "live_summary_run_gate_reset");
  assert.deepEqual(calls.map((call) => call.api), [
    "GetCallerIdentity",
    "DescribeClusters",
    "DescribeNodePools",
    "CreateNodePool",
    "TagResources",
    "ScaleNodePool",
    "DescribeNodePools",
    "ScaleNodePool",
    "DeleteNodePool",
    "GetResources",
  ], "live_call_order");
  const createCall = calls.find((call) => call.api === "CreateNodePool");
  const tagResourcesCall = calls.find((call) => call.api === "TagResources");
  assert.equal(createCall.req.ClusterId, "cls-fi097sy4", "create_cluster");
  assert.equal(createCall.req.Name, "medopl-tenant-rb-package-c-live-canary-20260613", "create_name");
  assert.equal(createCall.req.Native.SubnetIds[0], "subnet-a1fldajw", "create_subnet");
  assert.equal(createCall.req.Native.SecurityGroupIds[0], "sg-6671l5we", "create_sg");
  assert.equal(createCall.req.Native.InstanceTypes[0], "SA5.MEDIUM4", "create_instance_from_starter_catalog");
  assert.equal(createCall.req.Native.SystemDisk.DiskType, "CLOUD_BSSD", "create_system_disk_type");
  assert.equal(createCall.req.Native.SystemDisk.DiskSize, 50, "create_system_disk_size");
  assert.equal(createCall.req.Native.InternetAccessible.AddressType, "PublicIP", "create_internet_accessible_address_type");
  assert.equal(createCall.req.Native.InternetAccessible.MaxBandwidthOut, 0, "create_public_ip_disabled");
  assert.equal(createCall.req.Native.Replicas, 0, "create_desired_zero");
  assert.equal(Object.hasOwn(createCall.req, "Tags"), false, "create_request_must_not_inline_cloud_tags");
  assert.equal(Object.hasOwn(createCall.req, "Annotations"), false, "create_request_must_not_inline_annotations");
  assert.deepEqual(tagResourcesCall.req.Tags, [
    { TagKey: "resourceBindingId", TagValue: "rb-package-c-live-canary-20260613" },
    { TagKey: "billingAttributionId", TagValue: "ba-package-c-live-canary-20260613" },
    { TagKey: "tenantId", TagValue: "tenant-canary-package-c" },
    { TagKey: "workspaceId", TagValue: "ws-canary-package-c" },
    { TagKey: "medopl.io/role", TagValue: "tenant_node_pool" },
    { TagKey: "medopl.io/package", TagValue: "C" },
    { TagKey: "medopl.io/canary", TagValue: "package_c_live" },
  ], "tag_resources_uses_tencent_tag_api_field_names_after_create");
  assert.equal(calls.filter((call) => call.api === "ScaleNodePool")[0].req.Replicas, 1, "scale_up_one");
  assert.equal(calls.filter((call) => call.api === "ScaleNodePool")[1].req.Replicas, 0, "scale_down_zero");
  assert.equal(calls.find((call) => call.api === "DeleteNodePool").req.NodePoolId, "np-tenant-proof", "delete_tenant_pool");
  assert.equal(calls.some((call) => call.req?.NodePoolId === "np-cbk784r8"), false, "must_not_target_platform_pool");

  const finalEnv = await readFile(envFile, "utf8");
  assert(finalEnv.includes("RUN_TENCENT_CREATE_RELEASE_EXECUTION=0"), "runner_must_reset_run_gate");

  const evidence = JSON.parse(await readFile(summary.summaryPath, "utf8"));
  assert.equal(evidence.ok, true, "evidence_ok");
  assert.equal(evidence.boundary.realCloudCalls, true, "evidence_real_cloud");
  assert.equal(evidence.boundary.callsKubectl, false, "evidence_no_kubectl");
  assert.equal(evidence.boundary.deploysWorkload, false, "evidence_no_deploy");
  assert.equal(evidence.boundary.buildsOrPushesImage, false, "evidence_no_build_push");
  assert.equal(evidence.boundary.writesLedger, true, "evidence_writes_ledger");
  assert.equal(evidence.target.protectedPlatformNodePoolId, "np-cbk784r8", "evidence_protected_pool");
  assert.equal(evidence.target.tenantNodePoolName, "medopl-tenant-rb-package-c-live-canary-20260613", "evidence_tenant_pool");
  assert.equal(evidence.ledger.resourceBinding.status, "released", "ledger_final_resource_binding_released");
  assert.equal(evidence.ledger.cloudOperation.status, "released", "ledger_final_cloud_operation_released");
  assert.equal(evidence.ledger.resourceBinding.nodePoolName, "medopl-tenant-rb-package-c-live-canary-20260613", "ledger_node_pool_name");
  assert.equal(evidence.ledger.resourceBinding.nodePoolId, "np-tenant-proof", "ledger_node_pool_id");
  assert.equal(evidence.ledger.resourceBinding.serverPlanId, "starter_2c4g_10gb", "ledger_canonical_server_plan");
  assert.equal(evidence.ledger.resourceBinding.workspaceStorageGb, 10, "ledger_workspace_storage");
  assert.equal(evidence.ledger.resourceBinding.canonicalOwnershipSource, "postgres_resource_binding_ledger", "ledger_canonical_source");
  assert.equal(evidence.ledger.resourceBinding.cloudTagSupport, "tke_nodepool_unsupported", "ledger_cloud_tag_support");
  assert.deepEqual(evidence.ledger.stateTransitions.map((transition) => transition.status), [
    "requested",
    "creating",
    "created",
    "scaling",
    "ready",
    "releaseRequested",
    "deleting",
    "released",
  ], "ledger_success_state_path");
  assert.equal(evidence.ledger.stateTransitions[0].resourceBinding.nodePoolName, "medopl-tenant-rb-package-c-live-canary-20260613", "ledger_pre_create_name_exists");
  assert.equal(evidence.ledger.stateTransitions[0].resourceBinding.nodePoolId, "", "ledger_pre_create_node_pool_id_empty");
  assert.equal(evidence.ledger.stateTransitions[1].status, "creating", "ledger_create_before_provider_call");
  assertLedgerDoesNotWriteProtectedPool(evidence, "success");
  assert.deepEqual(evidence.executedApis, [
    "GetCallerIdentity",
    "DescribeClusters",
    "DescribeNodePools",
    "CreateNodePool",
    "TagResources",
    "ScaleNodePool",
    "DescribeNodePools",
    "ScaleNodePool",
    "DeleteNodePool",
    "GetResources",
  ], "evidence_executed_apis");
  assertNoSensitiveOutput(JSON.stringify(evidence), "evidence");

  await writeFile(envFile, baseEnv("1"));
  const unsupportedTagCalls = [];
  const unsupportedTagModules = {
    async getCallerIdentity(req = null) {
      unsupportedTagCalls.push({ api: "GetCallerIdentity", req });
      return { AccountId: "100047070895", RequestId: "req-unsupported-sts" };
    },
    async describeClusters(region, req = {}) {
      unsupportedTagCalls.push({ api: "DescribeClusters", region, req });
      return { Clusters: [{ ClusterId: "cls-fi097sy4", ClusterStatus: "Running" }], RequestId: "req-unsupported-clusters" };
    },
    async describeNodePools(region, req = {}) {
      unsupportedTagCalls.push({ api: "DescribeNodePools", region, req });
      if (req?.Filters?.some((filter) => filter.Name === "NodePoolsName")) {
        return { NodePools: [{ NodePoolId: "np-tenant-unsupported-tag-proof", Name: "medopl-tenant-rb-package-c-live-canary-20260613" }], RequestId: "req-unsupported-node-pool-name" };
      }
      return { NodePools: [{ NodePoolId: "np-cbk784r8", Name: "platform" }], RequestId: "req-unsupported-node-pools" };
    },
    async createNodePool(region, req = {}) {
      unsupportedTagCalls.push({ api: "CreateNodePool", region, req });
      return { NodePoolId: "np-tenant-unsupported-tag-proof", RequestId: "req-unsupported-create" };
    },
    async tagResources(req = {}) {
      unsupportedTagCalls.push({ api: "TagResources", req });
      const error = new Error("unsupported service| tke:nodepool");
      error.code = "InvalidParameter.UnsupportedService";
      error.requestId = "req-unsupported-tag";
      throw error;
    },
    async scaleNodePool(region, req = {}) {
      unsupportedTagCalls.push({ api: "ScaleNodePool", region, req });
      return { RequestId: `req-unsupported-scale-${req.Replicas}` };
    },
    async deleteNodePool(region, req = {}) {
      unsupportedTagCalls.push({ api: "DeleteNodePool", region, req });
      return { RequestId: "req-unsupported-delete" };
    },
    async getResources(req = {}) {
      unsupportedTagCalls.push({ api: "GetResources", req });
      return { ResourceTagMappingList: [], RequestId: "req-unsupported-get-resources" };
    },
  };
  const unsupportedTagSummary = await runPackageCLiveCanaryLive({ options, modules: unsupportedTagModules });
  assert.equal(unsupportedTagSummary.ok, true, "unsupported_tag_summary_ok");
  assert.deepEqual(unsupportedTagCalls.map((call) => call.api), [
    "GetCallerIdentity",
    "DescribeClusters",
    "DescribeNodePools",
    "CreateNodePool",
    "TagResources",
    "ScaleNodePool",
    "DescribeNodePools",
    "ScaleNodePool",
    "DeleteNodePool",
    "GetResources",
  ], "unsupported_tag_call_order_must_continue");
  const unsupportedTagEvidence = JSON.parse(await readFile(unsupportedTagSummary.summaryPath, "utf8"));
  const unsupportedTagStep = unsupportedTagEvidence.steps.find((step) => step.api === "TagResources");
  assert.equal(unsupportedTagEvidence.ok, true, "unsupported_tag_evidence_ok");
  assert.equal(unsupportedTagEvidence.tagResourcesSkippedUnsupportedService, true, "unsupported_tag_skip_flag");
  assert.equal(unsupportedTagEvidence.cloudTagSupport, "tkeNodePoolUnsupported", "unsupported_tag_cloud_support");
  assert.equal(unsupportedTagEvidence.canonicalOwnershipSource, "postgres_resource_binding_ledger", "unsupported_tag_canonical_ownership_source");
  assert.equal(unsupportedTagEvidence.ledger.resourceBinding.canonicalOwnershipSource, "postgres_resource_binding_ledger", "unsupported_tag_ledger_canonical_source");
  assert.equal(unsupportedTagEvidence.ledger.resourceBinding.cloudTagSupport, "tke_nodepool_unsupported", "unsupported_tag_ledger_cloud_support");
  assert.equal(unsupportedTagEvidence.ledger.events.some((event) => event.type === "tagResourcesSkippedUnsupportedService" && event.blocking === false), true, "unsupported_tag_must_be_non_blocking_ledger_event");
  assert.equal(unsupportedTagEvidence.canaryOwnershipEvidenceSink, ".runtime", "unsupported_tag_canary_evidence_sink");
  assert.equal(unsupportedTagStep.status, "skipped_unsupported_service", "unsupported_tag_step_status");
  assert.equal(unsupportedTagStep.error.code, "InvalidParameter.UnsupportedService", "unsupported_tag_step_error_code");
  assert.equal(unsupportedTagStep.error.message, "unsupported service| tke:nodepool", "unsupported_tag_step_error_message");
  assert.equal(unsupportedTagStep.error.requestId, "req-unsupported-tag", "unsupported_tag_step_error_request_id");
  assert.equal(unsupportedTagStep.continuesCanary, true, "unsupported_tag_step_continues_canary");
  assert.deepEqual(unsupportedTagEvidence.rollback.steps, [], "unsupported_tag_must_not_trigger_rollback");
  assert.equal(unsupportedTagCalls.some((call) => call.req?.NodePoolId === "np-cbk784r8"), false, "unsupported_tag_must_not_touch_platform_pool");
  assertLedgerDoesNotWriteProtectedPool(unsupportedTagEvidence, "unsupported_tag");
  assertNoSensitiveOutput(JSON.stringify(unsupportedTagEvidence), "unsupported_tag_evidence");

  await writeFile(envFile, baseEnv("1"));
  const createFailureCalls = [];
  const createFailureModules = {
    async getCallerIdentity(req = null) {
      createFailureCalls.push({ api: "GetCallerIdentity", req });
      return { AccountId: "100047070895", RequestId: "req-create-fail-sts" };
    },
    async describeClusters(region, req = {}) {
      createFailureCalls.push({ api: "DescribeClusters", region, req });
      return { Clusters: [{ ClusterId: "cls-fi097sy4", ClusterStatus: "Running" }], RequestId: "req-create-fail-clusters" };
    },
    async describeNodePools(region, req = {}) {
      createFailureCalls.push({ api: "DescribeNodePools", region, req });
      return { NodePools: [{ NodePoolId: "np-cbk784r8", Name: "platform" }], RequestId: "req-create-fail-node-pools" };
    },
    async createNodePool(region, req = {}) {
      createFailureCalls.push({ api: "CreateNodePool", region, req });
      const error = new Error("create denied");
      error.code = "OperationDenied";
      error.requestId = "req-create-denied";
      throw error;
    },
    async tagResources(req = {}) {
      createFailureCalls.push({ api: "TagResources", req });
      return { RequestId: "req-create-fail-tag" };
    },
    async scaleNodePool(region, req = {}) {
      createFailureCalls.push({ api: "ScaleNodePool", region, req });
      return { RequestId: "req-create-fail-scale" };
    },
    async deleteNodePool(region, req = {}) {
      createFailureCalls.push({ api: "DeleteNodePool", region, req });
      return { RequestId: "req-create-fail-delete" };
    },
    async getResources(req = {}) {
      createFailureCalls.push({ api: "GetResources", req });
      return { ResourceTagMappingList: [], RequestId: "req-create-fail-get-resources" };
    },
  };
  let createFailureError = null;
  try {
    await runPackageCLiveCanaryLive({ options, modules: createFailureModules });
  } catch (error) {
    createFailureError = error;
  }
  assert(createFailureError, "runner_must_throw_when_create_fails");
  assert.equal(createFailureError.summary.ledger.resourceBinding.status, "failed", "create_failure_ledger_status");
  assert.equal(createFailureError.summary.ledger.resourceBinding.nodePoolId, "", "create_failure_ledger_node_pool_id_empty");
  assert.deepEqual(createFailureError.summary.ledger.stateTransitions.map((transition) => transition.status), [
    "requested",
    "creating",
    "failed",
  ], "create_failure_state_path");
  assert.equal(createFailureError.summary.rollback.attempted, false, "create_failure_must_not_cleanup_without_node_pool_id");
  assert.deepEqual(createFailureCalls.map((call) => call.api), [
    "GetCallerIdentity",
    "DescribeClusters",
    "DescribeNodePools",
    "CreateNodePool",
  ], "create_failure_call_order");
  assertLedgerDoesNotWriteProtectedPool(createFailureError.summary, "create_failure");
  assertNoSensitiveOutput(JSON.stringify(createFailureError.summary), "create_failure_summary");

  await writeFile(envFile, baseEnv("1"));
  const scaleFailureCalls = [];
  const scaleFailureModules = {
    async getCallerIdentity(req = null) {
      scaleFailureCalls.push({ api: "GetCallerIdentity", req });
      return { AccountId: "100047070895", RequestId: "req-scale-fail-sts" };
    },
    async describeClusters(region, req = {}) {
      scaleFailureCalls.push({ api: "DescribeClusters", region, req });
      return { Clusters: [{ ClusterId: "cls-fi097sy4", ClusterStatus: "Running" }], RequestId: "req-scale-fail-clusters" };
    },
    async describeNodePools(region, req = {}) {
      scaleFailureCalls.push({ api: "DescribeNodePools", region, req });
      return { NodePools: [{ NodePoolId: "np-cbk784r8", Name: "platform" }], RequestId: "req-scale-fail-node-pools" };
    },
    async createNodePool(region, req = {}) {
      scaleFailureCalls.push({ api: "CreateNodePool", region, req });
      return { NodePoolId: "np-tenant-scale-fail-proof", RequestId: "req-scale-fail-create" };
    },
    async tagResources(req = {}) {
      scaleFailureCalls.push({ api: "TagResources", req });
      return { RequestId: "req-scale-fail-tag" };
    },
    async scaleNodePool(region, req = {}) {
      scaleFailureCalls.push({ api: "ScaleNodePool", region, req });
      if (req.Replicas === 1) {
        const error = new Error("scale up denied");
        error.code = "OperationDenied";
        error.requestId = "req-scale-up-denied";
        throw error;
      }
      return { RequestId: "req-scale-down-cleanup" };
    },
    async deleteNodePool(region, req = {}) {
      scaleFailureCalls.push({ api: "DeleteNodePool", region, req });
      return { RequestId: "req-scale-fail-cleanup-delete" };
    },
    async getResources(req = {}) {
      scaleFailureCalls.push({ api: "GetResources", req });
      return { ResourceTagMappingList: [], RequestId: "req-scale-fail-get-resources" };
    },
  };
  let scaleFailureError = null;
  try {
    await runPackageCLiveCanaryLive({ options, modules: scaleFailureModules });
  } catch (error) {
    scaleFailureError = error;
  }
  assert(scaleFailureError, "runner_must_throw_when_scale_fails_after_create");
  assert.equal(scaleFailureError.summary.ledger.resourceBinding.status, "released", "scale_failure_cleanup_success_final_status");
  assert.deepEqual(scaleFailureError.summary.ledger.stateTransitions.map((transition) => transition.status), [
    "requested",
    "creating",
    "created",
    "scaling",
    "releaseRequested",
    "deleting",
    "released",
  ], "scale_failure_state_path");
  assert.deepEqual(scaleFailureError.summary.rollback.steps, [
    "scale_tenant_pool_to_zero",
    "delete_tenant_pool",
  ], "scale_failure_cleanup_steps");
  assert.equal(scaleFailureCalls.some((call) => call.req?.NodePoolId === "np-cbk784r8"), false, "scale_failure_must_not_touch_platform_pool");
  assertLedgerDoesNotWriteProtectedPool(scaleFailureError.summary, "scale_failure");
  assertNoSensitiveOutput(JSON.stringify(scaleFailureError.summary), "scale_failure_summary");

  await writeFile(envFile, baseEnv("1"));
  const deleteFailureCalls = [];
  const deleteFailureModules = {
    async getCallerIdentity(req = null) {
      deleteFailureCalls.push({ api: "GetCallerIdentity", req });
      return { AccountId: "100047070895", RequestId: "req-delete-fail-sts" };
    },
    async describeClusters(region, req = {}) {
      deleteFailureCalls.push({ api: "DescribeClusters", region, req });
      return { Clusters: [{ ClusterId: "cls-fi097sy4", ClusterStatus: "Running" }], RequestId: "req-delete-fail-clusters" };
    },
    async describeNodePools(region, req = {}) {
      deleteFailureCalls.push({ api: "DescribeNodePools", region, req });
      if (req?.Filters?.some((filter) => filter.Name === "NodePoolsName")) {
        return { NodePools: [{ NodePoolId: "np-tenant-delete-fail-proof", Name: "medopl-tenant-rb-package-c-live-canary-20260613" }], RequestId: "req-delete-fail-node-pool-name" };
      }
      return { NodePools: [{ NodePoolId: "np-cbk784r8", Name: "platform" }], RequestId: "req-delete-fail-node-pools" };
    },
    async createNodePool(region, req = {}) {
      deleteFailureCalls.push({ api: "CreateNodePool", region, req });
      return { NodePoolId: "np-tenant-delete-fail-proof", RequestId: "req-delete-fail-create" };
    },
    async tagResources(req = {}) {
      deleteFailureCalls.push({ api: "TagResources", req });
      return { RequestId: "req-delete-fail-tag" };
    },
    async scaleNodePool(region, req = {}) {
      deleteFailureCalls.push({ api: "ScaleNodePool", region, req });
      return { RequestId: `req-delete-fail-scale-${req.Replicas}` };
    },
    async deleteNodePool(region, req = {}) {
      deleteFailureCalls.push({ api: "DeleteNodePool", region, req });
      const error = new Error("delete denied");
      error.code = "OperationDenied";
      error.requestId = "req-delete-denied";
      throw error;
    },
    async getResources(req = {}) {
      deleteFailureCalls.push({ api: "GetResources", req });
      return { ResourceTagMappingList: [], RequestId: "req-delete-fail-get-resources" };
    },
  };
  let deleteFailureError = null;
  try {
    await runPackageCLiveCanaryLive({ options, modules: deleteFailureModules });
  } catch (error) {
    deleteFailureError = error;
  }
  assert(deleteFailureError, "runner_must_throw_when_delete_fails");
  assert.equal(deleteFailureError.summary.ledger.resourceBinding.status, "cleanupRequired", "delete_failure_final_status");
  assert.deepEqual(deleteFailureError.summary.ledger.stateTransitions.map((transition) => transition.status), [
    "requested",
    "creating",
    "created",
    "scaling",
    "ready",
    "releaseRequested",
    "deleting",
    "cleanupRequired",
  ], "delete_failure_state_path");
  assert.equal(deleteFailureError.summary.ledger.stateTransitions.at(-1).status, "cleanupRequired", "delete_failure_last_transition");
  assert(deleteFailureError.summary.rollback.steps.includes("delete_tenant_pool_failed"), "delete_failure_cleanup_step");
  assert.equal(deleteFailureCalls.some((call) => call.req?.NodePoolId === "np-cbk784r8"), false, "delete_failure_must_not_touch_platform_pool");
  assertLedgerDoesNotWriteProtectedPool(deleteFailureError.summary, "delete_failure");
  assertNoSensitiveOutput(JSON.stringify(deleteFailureError.summary), "delete_failure_summary");

  await writeFile(envFile, baseEnv("1"));
  const protectedPoolCalls = [];
  const protectedPoolModules = {
    async getCallerIdentity(req = null) {
      protectedPoolCalls.push({ api: "GetCallerIdentity", req });
      return { AccountId: "100047070895", RequestId: "req-protected-sts" };
    },
    async describeClusters(region, req = {}) {
      protectedPoolCalls.push({ api: "DescribeClusters", region, req });
      return { Clusters: [{ ClusterId: "cls-fi097sy4", ClusterStatus: "Running" }], RequestId: "req-protected-clusters" };
    },
    async describeNodePools(region, req = {}) {
      protectedPoolCalls.push({ api: "DescribeNodePools", region, req });
      return { NodePools: [{ NodePoolId: "np-cbk784r8", Name: "platform" }], RequestId: "req-protected-node-pools" };
    },
    async createNodePool(region, req = {}) {
      protectedPoolCalls.push({ api: "CreateNodePool", region, req });
      return { NodePoolId: "np-cbk784r8", RequestId: "req-protected-create" };
    },
    async tagResources(req = {}) {
      protectedPoolCalls.push({ api: "TagResources", req });
      return { RequestId: "req-protected-tag" };
    },
    async scaleNodePool(region, req = {}) {
      protectedPoolCalls.push({ api: "ScaleNodePool", region, req });
      return { RequestId: "req-protected-scale" };
    },
    async deleteNodePool(region, req = {}) {
      protectedPoolCalls.push({ api: "DeleteNodePool", region, req });
      return { RequestId: "req-protected-delete" };
    },
    async getResources(req = {}) {
      protectedPoolCalls.push({ api: "GetResources", req });
      return { ResourceTagMappingList: [], RequestId: "req-protected-get-resources" };
    },
  };
  let protectedPoolError = null;
  try {
    await runPackageCLiveCanaryLive({ options, modules: protectedPoolModules });
  } catch (error) {
    protectedPoolError = error;
  }
  assert(protectedPoolError, "runner_must_throw_when_provider_returns_protected_pool_id");
  assert.equal(protectedPoolError.summary.ledger.resourceBinding.status, "failed", "protected_pool_final_status");
  assert.equal(protectedPoolError.summary.ledger.resourceBinding.nodePoolId, "", "protected_pool_must_not_be_written_to_ledger");
  assert.equal(protectedPoolCalls.some((call) => call.api === "ScaleNodePool" || call.api === "DeleteNodePool"), false, "protected_pool_must_not_scale_or_delete_platform_pool");
  assertLedgerDoesNotWriteProtectedPool(protectedPoolError.summary, "protected_pool");
  assertNoSensitiveOutput(JSON.stringify(protectedPoolError.summary), "protected_pool_summary");

  await writeFile(envFile, baseEnv("1"));
  const rollbackCalls = [];
  const rollbackModules = {
    async getCallerIdentity(req = null) {
      rollbackCalls.push({ api: "GetCallerIdentity", req });
      return { AccountId: "100047070895", RequestId: "req-rollback-sts" };
    },
    async describeClusters(region, req = {}) {
      rollbackCalls.push({ api: "DescribeClusters", region, req });
      return { Clusters: [{ ClusterId: "cls-fi097sy4", ClusterStatus: "Running" }], RequestId: "req-rollback-clusters" };
    },
    async describeNodePools(region, req = {}) {
      rollbackCalls.push({ api: "DescribeNodePools", region, req });
      return { NodePools: [{ NodePoolId: "np-cbk784r8", Name: "platform" }], RequestId: "req-rollback-node-pools" };
    },
    async createNodePool(region, req = {}) {
      rollbackCalls.push({ api: "CreateNodePool", region, req });
      return { NodePoolId: "np-tenant-rollback-proof", RequestId: "req-rollback-create" };
    },
    async tagResources(req = {}) {
      rollbackCalls.push({ api: "TagResources", req });
      const error = new Error("tag denied by cam policy; token and SecretKey and kubeconfig must not leak");
      error.code = "OperationDenied";
      error.requestId = "req-denied-tag";
      throw error;
    },
    async scaleNodePool(region, req = {}) {
      rollbackCalls.push({ api: "ScaleNodePool", region, req });
      return { RequestId: `req-rollback-scale-${req.Replicas}` };
    },
    async deleteNodePool(region, req = {}) {
      rollbackCalls.push({ api: "DeleteNodePool", region, req });
      return { RequestId: "req-rollback-delete" };
    },
    async getResources(req = {}) {
      rollbackCalls.push({ api: "GetResources", req });
      return { ResourceTagMappingList: [], RequestId: "req-rollback-get-resources" };
    },
  };
  let rollbackError = null;
  try {
    await runPackageCLiveCanaryLive({ options, modules: rollbackModules });
  } catch (error) {
    rollbackError = error;
  }
  assert(rollbackError, "runner_must_throw_when_post_create_step_fails");
  assert.equal(rollbackError.summary.ok, false, "rollback_summary_not_ok");
  assert.equal(rollbackError.summary.failure.error.code, "OperationDenied", "rollback_failure_error_code");
  assert.equal(rollbackError.summary.failure.error.message, "tag denied by cam policy; [redacted-sensitive-value] and [redacted-sensitive-value] and [redacted-sensitive-value] must not leak", "rollback_failure_error_message");
  assert.equal(rollbackError.summary.failure.error.requestId, "req-denied-tag", "rollback_failure_error_request_id");
  assert.equal(rollbackError.summary.failure.code, "OperationDenied", "rollback_failure_code");
  assert.equal(rollbackError.summary.failure.message, "tag denied by cam policy; [redacted-sensitive-value] and [redacted-sensitive-value] and [redacted-sensitive-value] must not leak", "rollback_failure_message");
  assert.equal(rollbackError.summary.failure.requestId, "req-denied-tag", "rollback_failure_request_id");
  assert.equal(rollbackError.summary.failure.apiVersion, "v20180813", "rollback_failure_api_version");
  assert.equal(rollbackError.summary.failure.action, "TagResources", "rollback_failure_action");
  assert.equal(rollbackError.summary.failure.region, "na-siliconvalley", "rollback_failure_region");
  assert.equal(rollbackError.summary.failure.nodePoolName, "medopl-tenant-rb-package-c-live-canary-20260613", "rollback_failure_node_pool_name");
  const failedStep = rollbackError.summary.steps.find((step) => step.api === "TagResources");
  assert.equal(failedStep.error.code, "OperationDenied", "rollback_step_error_code");
  assert.equal(failedStep.error.message, "tag denied by cam policy; [redacted-sensitive-value] and [redacted-sensitive-value] and [redacted-sensitive-value] must not leak", "rollback_step_error_message");
  assert.equal(failedStep.error.requestId, "req-denied-tag", "rollback_step_error_request_id");
  assert.equal(failedStep.message, "tag denied by cam policy; [redacted-sensitive-value] and [redacted-sensitive-value] and [redacted-sensitive-value] must not leak", "rollback_step_message");
  assert.equal(failedStep.requestId, "req-denied-tag", "rollback_step_request_id");
  assert.equal(failedStep.apiVersion, "v20180813", "rollback_step_api_version");
  assert.equal(failedStep.action, "TagResources", "rollback_step_action");
  const failureResult = JSON.parse(await readFile(path.join(rollbackError.summary.evidenceRoot, "failure-result-redacted.json"), "utf8"));
  assert.deepEqual(failureResult, failedStep, "failure_result_must_match_failed_step");
  assert.deepEqual(rollbackError.summary.rollback.steps, [
    "scale_tenant_pool_to_zero",
    "delete_tenant_pool",
  ], "rollback_steps");
  assert.equal(rollbackError.summary.ledger.resourceBinding.status, "released", "rollback_cleanup_success_final_status");
  assert.equal(rollbackError.summary.ledger.events.some((event) => event.type === "tagResourcesFailed" && event.blocking === true), true, "blocking_tag_failure_must_be_ledger_event");
  assert.deepEqual(rollbackCalls.map((call) => call.api), [
    "GetCallerIdentity",
    "DescribeClusters",
    "DescribeNodePools",
    "CreateNodePool",
    "TagResources",
    "ScaleNodePool",
    "DeleteNodePool",
  ], "rollback_call_order");
  assert.equal(rollbackCalls.find((call) => call.api === "ScaleNodePool").req.NodePoolId, "np-tenant-rollback-proof", "rollback_scales_tenant_pool");
  assert.equal(rollbackCalls.find((call) => call.api === "ScaleNodePool").req.Replicas, 0, "rollback_scales_to_zero");
  assert.equal(rollbackCalls.find((call) => call.api === "DeleteNodePool").req.NodePoolId, "np-tenant-rollback-proof", "rollback_deletes_tenant_pool");
  assert.equal(rollbackCalls.some((call) => call.req?.NodePoolId === "np-cbk784r8"), false, "rollback_must_not_touch_platform_pool");
  assertLedgerDoesNotWriteProtectedPool(rollbackError.summary, "rollback");
  assertNoSensitiveOutput(JSON.stringify(rollbackError.summary), "rollback_summary");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_package_c_live_canary_live_runner_local_gate",
  runner,
}, null, 2));
