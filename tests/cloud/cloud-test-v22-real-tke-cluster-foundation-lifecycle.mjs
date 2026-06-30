import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const runner = "tests/support/cloud-prework/production-goal-command-runner.mjs";

function run(args = [], env = {}) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: { ...process.env, ...env },
  });
}

function parseJson(result, label) {
  assert.equal(result.status, 0, `${label}_must_exit_zero:${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function assertNoSensitiveText(text = "", label = "output") {
  for (const forbidden of ["mutation-secret-key", "rawResponse", "SecretId", "SecretKey"]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const tempDir = mkdtempSync(path.join(tmpdir(), "v22-real-tke-cluster-foundation-"));
const mutationSecretFile = path.join(tempDir, "mutation.env");
const planFile = path.join(tempDir, "real-tke-cluster-foundation-plan.json");
const fakeSdk = path.join(tempDir, "fake-tencentcloud-sdk-nodejs-cluster-foundation.mjs");
const fakeSdkLog = path.join(tempDir, "real-tke-cluster-foundation-fake-sdk.log");
const runtimeDir = path.join(repoRoot, ".runtime", "v22-cloud-authorization", `cluster-foundation-${Date.now()}`);
mkdirSync(runtimeDir, { recursive: true });

writeFileSync(mutationSecretFile, [
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
  "TENCENT_MUTATION_SECRET_ID=mutation-secret-id",
  "TENCENT_MUTATION_SECRET_KEY=mutation-secret-key",
  "TENCENT_MUTATION_REGIONS=na-siliconvalley",
  "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-test",
  "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
  "",
].join("\n"));

writeFileSync(planFile, JSON.stringify({
  clusterId: "cls-test",
  region: "na-siliconvalley",
  requireNodeTotal: 1,
  requireReadyNodeCount: 1,
  createObserveAttempts: 1,
  upgradeObserveAttempts: 1,
  deleteObserveAttempts: 1,
  tiers: [
    { id: "starter_2c4g_10gb", cpuCores: 2, memoryGb: 4, storageGb: 10 },
    { id: "pro_8c16g_100gb", cpuCores: 8, memoryGb: 16, storageGb: 100 },
  ],
  deriveFromClusterFoundation: {
    enabled: true,
    vpcId: "vpc-test",
    subnetId: "subnet-test",
    imageNamePattern: "TencentOS",
    requireSecurityGroup: true,
  },
}, null, 2));

writeFileSync(fakeSdk, `
const calls = [];
const pools = new Map();
async function persist() {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.TEST_REAL_TKE_CLUSTER_FOUNDATION_FAKE_SDK_LOG, JSON.stringify(calls, null, 2));
}
class TkeClient {
  async DescribeClusters(request) {
    calls.push({ api: "DescribeClusters", request });
    await persist();
    return { Clusters: [{ ClusterId: "cls-test", ClusterNetworkSettings: { VpcId: "vpc-test", Subnets: ["subnet-test"] } }] };
  }
  async CreateNodePool(request) {
    calls.push({ api: "CreateNodePool", request });
    const nodePoolId = request.Name.includes("pro") ? "np-pro-foundation" : "np-starter-foundation";
    if (request.Type !== "Native") {
      throw new Error("cluster foundation real proof must use native node pool");
    }
    if (!Array.isArray(request.Native?.SecurityGroupIds) || request.Native.SecurityGroupIds[0] !== "sg-foundation") {
      throw new Error("security group ids is not set");
    }
    if (request.Native?.MachineType !== "NativeCVM") {
      throw new Error("cluster foundation proof must request CVM-backed native node pool");
    }
    pools.set(nodePoolId, {
      NodePoolId: nodePoolId,
      Type: "Native",
      LifeState: "normal",
      Name: request.Name,
      Native: {
        Scaling: request.Native.Scaling,
        Replicas: request.Native.Replicas,
        InstanceTypes: request.Native.InstanceTypes,
        NodeCountSummary: { AutoscalingAdded: { Total: 1, Normal: 1 }, ManuallyAdded: { Total: 0, Normal: 0 } },
      },
    });
    await persist();
    return { NodePoolId: nodePoolId };
  }
  async ScaleNodePool(request) {
    calls.push({ api: "ScaleNodePool", request });
    const pool = pools.get(request.NodePoolId);
    if (pool) pool.Native.Replicas = request.Replicas;
    await persist();
    return { RequestId: "scale-node-pool" };
  }
  async ModifyNodePool(request) {
    calls.push({ api: "ModifyNodePool", request });
    const pool = pools.get(request.NodePoolId);
    if (pool && request.Native?.InstanceTypes) pool.Native.InstanceTypes = request.Native.InstanceTypes;
    await persist();
    return { RequestId: "modify-node-pool" };
  }
  async DescribeNodePools(request) {
    calls.push({ api: "DescribeNodePools", request });
    if (!request.Filters?.some((filter) => filter.Name === "NodePoolsId" && filter.Values?.length === 1)) {
      throw new Error("DescribeNodePools must filter by NodePoolsId for real lifecycle proof");
    }
    await persist();
    const requested = new Set(request.Filters.find((filter) => filter.Name === "NodePoolsId").Values);
    return { NodePools: Array.from(pools.values()).filter((pool) => requested.has(pool.NodePoolId)) };
  }
  async DeleteNodePool(request) {
    calls.push({ api: "DeleteNodePool", request });
    pools.delete(request.NodePoolId);
    await persist();
    return { RequestId: "delete-node-pool" };
  }
}
class VpcClient {
  async DescribeSubnets(request) {
    calls.push({ api: "DescribeSubnets", request });
    await persist();
    throw new Error("unexpected DescribeSubnets " + JSON.stringify(request));
  }
  async DescribeSecurityGroups(request) {
    calls.push({ api: "DescribeSecurityGroups", request });
    await persist();
    return { SecurityGroupSet: [
      { SecurityGroupId: "sg-other", SecurityGroupName: "zz-other", VpcId: "vpc-test" },
      { SecurityGroupId: "sg-foundation", SecurityGroupName: "medopl-runtime", VpcId: "vpc-test" },
    ] };
  }
}
class CvmClient {
  async DescribeInstanceTypeConfigs(request) {
    calls.push({ api: "DescribeInstanceTypeConfigs", request });
    await persist();
    return { InstanceTypeConfigSet: [
      { Zone: "na-siliconvalley-1", InstanceType: "BF1.MEDIUM4", CPU: 2, Memory: 4 },
      { Zone: "na-siliconvalley-1", InstanceType: "BF1.2XLARGE16", CPU: 8, Memory: 16 },
      { Zone: "na-siliconvalley-1", InstanceType: "C4.MEDIUM4", CPU: 2, Memory: 4 },
      { Zone: "na-siliconvalley-1", InstanceType: "C4.2XLARGE16", CPU: 8, Memory: 16 },
      { Zone: "na-siliconvalley-1", InstanceType: "S5.MEDIUM4", CPU: 2, Memory: 4 },
      { Zone: "na-siliconvalley-1", InstanceType: "S5.2XLARGE16", CPU: 8, Memory: 16 },
    ] };
  }
  async DescribeImages(request) {
    calls.push({ api: "DescribeImages", request });
    await persist();
    throw new Error("unexpected DescribeImages " + JSON.stringify(request));
  }
}
export default {
  tke: { v20180525: { Client: TkeClient }, v20220501: { Client: TkeClient } },
  vpc: { v20170312: { Client: VpcClient } },
  cvm: { v20170312: { Client: CvmClient } },
};
`);

const result = parseJson(run(["--operation", "real_tke_runtime_node_lifecycle", "--execute", "--confirm-current-session-authorization"], {
  V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE: planFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE: fakeSdk,
  V22_GOAL_EVIDENCE_REF: path.join(".runtime", "v22-cloud-authorization", path.basename(runtimeDir), "real_tke_runtime_node_lifecycle.json"),
  TEST_REAL_TKE_CLUSTER_FOUNDATION_FAKE_SDK_LOG: fakeSdkLog,
}), "real_tke_cluster_foundation_execute");

assert.equal(result.summary.realProviderMutationExecuted, true, "cluster_foundation_must_execute_provider_mutation");
assert.equal(result.summary.derivedFromClusterFoundation, true, "cluster_foundation_summary");
assert.equal(result.summary.cleanupVerified, true, "cluster_foundation_must_cleanup");
assertNoSensitiveText(JSON.stringify(result), "cluster_foundation_execute");

const calls = JSON.parse(readFileSync(fakeSdkLog, "utf8"));
const instanceTypeDiscovery = calls.find((call) => call.api === "DescribeInstanceTypeConfigs");
assert.deepEqual(instanceTypeDiscovery.request, {}, "cluster_foundation_must_not_use_unsupported_instance_charge_type_filter");
assert.deepEqual(calls.map((call) => call.api).filter((api) => api !== "DescribeNodePools"), [
  "DescribeClusters",
  "DescribeInstanceTypeConfigs",
  "DescribeSecurityGroups",
  "CreateNodePool",
  "ModifyNodePool",
  "ScaleNodePool",
  "CreateNodePool",
  "DeleteNodePool",
  "DeleteNodePool",
], "cluster_foundation_must_discover_create_upgrade_and_destroy_with_native_node_pool");
const created = calls.filter((call) => call.api === "CreateNodePool").map((call) => call.request);
for (const request of created) {
  assert.equal(request.Tags, undefined, "cluster_foundation_default_must_not_send_tke_node_pool_tags");
  assert.equal(request.Type, "Native", "cluster_foundation_must_use_native_node_pool");
  assert.equal(request.AutoScalingGroupPara, undefined, "cluster_foundation_native_create_must_not_set_asg_para");
  assert.equal(request.LaunchConfigurePara, undefined, "cluster_foundation_native_create_must_not_set_launch_para");
}
assert.equal(created[0].Native.InstanceTypes[0], "S5.MEDIUM4", "cluster_foundation_starter_must_use_instance_type");
assert.deepEqual(created[0].Native.SecurityGroupIds, ["sg-foundation"], "cluster_foundation_create_must_set_security_group_ids");
assert.equal(created[0].Native.SystemDisk.DiskType, "CLOUD_PREMIUM", "cluster_foundation_default_system_disk");
assert.deepEqual(created[0].Native.SubnetIds, ["subnet-test"], "cluster_foundation_subnet");
assert.equal(created[0].Native.MachineType, "NativeCVM", "cluster_foundation_create_must_use_cvm_backed_native_nodes");
assert.equal(created[0].Native.InternetAccessible, undefined, "cluster_foundation_default_must_not_send_legacy_internet_accessible_shape");
assert.equal(created[1].Native.InstanceTypes[0], "S5.2XLARGE16", "cluster_foundation_pro_must_use_instance_type");
assert.deepEqual(created[1].Native.SecurityGroupIds, ["sg-foundation"], "cluster_foundation_pro_create_must_set_security_group_ids");
assert.equal(created[1].Native.MachineType, "NativeCVM", "cluster_foundation_pro_create_must_use_cvm_backed_native_nodes");
assert.equal(created[1].Native.InternetAccessible, undefined, "cluster_foundation_pro_default_must_not_send_legacy_internet_accessible_shape");
const modifyCall = calls.find((call) => call.api === "ModifyNodePool");
assert.deepEqual(modifyCall.request.Native.InstanceTypes, ["S5.2XLARGE16"], "cluster_foundation_upgrade_must_target_pro_instance_type");
const scaleCall = calls.find((call) => call.api === "ScaleNodePool");
assert.equal(scaleCall.request.Replicas, 1, "cluster_foundation_upgrade_scale_must_keep_one_real_node");
assert.deepEqual(
  calls.filter((call) => call.api === "DeleteNodePool").map((call) => call.request.NodePoolId),
  ["np-pro-foundation", "np-starter-foundation"],
  "cluster_foundation_cleanup_must_delete_all_created_node_pools",
);

const blockedFakeSdk = path.join(tempDir, "fake-tencentcloud-sdk-nodejs-cluster-foundation-blocked.mjs");
const blockedSdkLog = path.join(tempDir, "real-tke-cluster-foundation-blocked-fake-sdk.log");
const blockedRuntimeDir = path.join(repoRoot, ".runtime", "v22-cloud-authorization", `cluster-foundation-blocked-${Date.now()}`);
const blockedEvidenceRef = path.join(".runtime", "v22-cloud-authorization", path.basename(blockedRuntimeDir), "real_tke_runtime_node_lifecycle.json");
mkdirSync(blockedRuntimeDir, { recursive: true });
writeFileSync(blockedFakeSdk, `
const calls = [];
async function persist() {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.TEST_REAL_TKE_CLUSTER_FOUNDATION_BLOCKED_FAKE_SDK_LOG, JSON.stringify(calls, null, 2));
}
class TkeClient {
  async DescribeClusters(request) {
    calls.push({ api: "DescribeClusters", request });
    await persist();
    return { Clusters: [{ ClusterId: "cls-test", ClusterNetworkSettings: { VpcId: "vpc-test", Subnets: ["subnet-test"] } }] };
  }
  async CreateNodePool(request) {
    calls.push({ api: "CreateNodePool", request });
    await persist();
    return { NodePoolId: "np-starter-unobserved" };
  }
  async DescribeNodePools(request) {
    calls.push({ api: "DescribeNodePools", request });
    if (!request.Filters?.some((filter) => filter.Name === "NodePoolsId" && filter.Values?.[0] === "np-starter-unobserved")) {
      throw new Error("DescribeNodePools must filter by returned NodePoolsId before accepting proof");
    }
    await persist();
    return { NodePools: [] };
  }
  async DeleteNodePool(request) {
    calls.push({ api: "DeleteNodePool", request });
    await persist();
    return { RequestId: "delete-node-pool" };
  }
}
class VpcClient {
  async DescribeSecurityGroups(request) {
    calls.push({ api: "DescribeSecurityGroups", request });
    await persist();
    return { SecurityGroupSet: [{ SecurityGroupId: "sg-foundation", SecurityGroupName: "medopl-runtime", VpcId: "vpc-test" }] };
  }
}
class CvmClient {
  async DescribeInstanceTypeConfigs(request) {
    calls.push({ api: "DescribeInstanceTypeConfigs", request });
    await persist();
    return { InstanceTypeConfigSet: [
      { Zone: "na-siliconvalley-1", InstanceType: "BF1.MEDIUM4", CPU: 2, Memory: 4 },
      { Zone: "na-siliconvalley-1", InstanceType: "BF1.2XLARGE16", CPU: 8, Memory: 16 },
      { Zone: "na-siliconvalley-1", InstanceType: "C4.MEDIUM4", CPU: 2, Memory: 4 },
      { Zone: "na-siliconvalley-1", InstanceType: "C4.2XLARGE16", CPU: 8, Memory: 16 },
      { Zone: "na-siliconvalley-1", InstanceType: "S5.MEDIUM4", CPU: 2, Memory: 4 },
      { Zone: "na-siliconvalley-1", InstanceType: "S5.2XLARGE16", CPU: 8, Memory: 16 },
    ] };
  }
}
export default {
  tke: { v20180525: { Client: TkeClient }, v20220501: { Client: TkeClient } },
  vpc: { v20170312: { Client: VpcClient } },
  cvm: { v20170312: { Client: CvmClient } },
};
`);
const blocked = run(["--operation", "real_tke_runtime_node_lifecycle", "--execute", "--confirm-current-session-authorization"], {
  V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE: planFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE: blockedFakeSdk,
  V22_GOAL_EVIDENCE_REF: blockedEvidenceRef,
  TEST_REAL_TKE_CLUSTER_FOUNDATION_BLOCKED_FAKE_SDK_LOG: blockedSdkLog,
});
assert.notEqual(blocked.status, 0, "cluster_foundation_unobserved_node_pool_must_fail_closed");
const blockedPayload = JSON.parse(blocked.stdout);
assert.equal(
  blockedPayload.summary.blocker,
  "production_goal_real_tke_node_pool_not_observed",
  "cluster_foundation_unobserved_node_pool_blocker",
);
assert.equal(existsSync(path.join(repoRoot, blockedEvidenceRef)), true, "cluster_foundation_blocked_must_write_partial_evidence");
const blockedEvidence = JSON.parse(readFileSync(path.join(repoRoot, blockedEvidenceRef), "utf8"));
assert.equal(blockedEvidence.status, "blocked", "cluster_foundation_blocked_evidence_status");
assert.equal(blockedEvidence.blocker, "production_goal_real_tke_node_pool_not_observed", "cluster_foundation_blocked_evidence_blocker");
assert.equal(blockedEvidence.lifecycle.createStarter.observed.found, false, "cluster_foundation_blocked_evidence_observe_found");
assert.equal(blockedEvidence.lifecycle.createStarter.observed.stage, "starter_created", "cluster_foundation_blocked_evidence_observe_stage");
assert.equal(blockedEvidence.lifecycle.createStarter.observed.waitReason, "node_pool_not_found", "cluster_foundation_blocked_evidence_wait_reason");
assert.equal(blockedEvidence.lifecycle.createStarter.observed.attempts, 1, "cluster_foundation_blocked_evidence_observe_attempts");
assert.deepEqual(blockedEvidence.nodePoolRefs, ["np-starter-unobserved"], "cluster_foundation_blocked_evidence_node_pool_refs");
assert.equal(blockedEvidence.cleanupVerified, true, "cluster_foundation_blocked_evidence_cleanup_verified");
assert.equal(blockedEvidence.nodePoolDestroyed, true, "cluster_foundation_blocked_evidence_node_pool_destroyed");
assert.deepEqual(
  blockedEvidence.cleanupResults.map((item) => item.nodePoolRef),
  ["np-starter-unobserved"],
  "cluster_foundation_blocked_evidence_cleanup_refs",
);
assert.deepEqual(blockedEvidence.cannotClaim, [
  "real TKE/CVM node ready",
  "starter/pro upgrade complete",
  "production complete",
  "all users/all tenants",
  "SLA/multi-region",
  "ongoing authorization",
], "cluster_foundation_blocked_evidence_cannot_claim");
assertNoSensitiveText(blocked.stdout + blocked.stderr + JSON.stringify(blockedEvidence), "cluster_foundation_blocked");
const blockedCalls = JSON.parse(readFileSync(blockedSdkLog, "utf8"));
assert.deepEqual(
  blockedCalls.map((call) => call.api).filter((api) => api !== "DescribeNodePools"),
  ["DescribeClusters", "DescribeInstanceTypeConfigs", "DescribeSecurityGroups", "CreateNodePool", "DeleteNodePool"],
  "cluster_foundation_blocked_must_cleanup_after_create_observe_failure",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_real_tke_cluster_foundation_lifecycle",
}, null, 2));
