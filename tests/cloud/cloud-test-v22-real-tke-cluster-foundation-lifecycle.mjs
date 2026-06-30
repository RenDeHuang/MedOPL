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
  nodePoolNamePrefix: "medopl-proof-isolated",
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
    const nodePoolId = request.Name.includes("-pro-") ? "np-pro-foundation" : "np-starter-foundation";
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
    await persist();
    throw new Error("cluster foundation replacement upgrade must not scale starter node pool in place " + JSON.stringify(request));
  }
  async ModifyNodePool(request) {
    calls.push({ api: "ModifyNodePool", request });
    await persist();
    throw new Error("cluster foundation replacement upgrade must not modify starter node pool in place " + JSON.stringify(request));
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
  "CreateNodePool",
  "DeleteNodePool",
  "DeleteNodePool",
], "cluster_foundation_must_discover_create_replacement_upgrade_and_destroy_with_native_node_pool");
const created = calls.filter((call) => call.api === "CreateNodePool").map((call) => call.request);
for (const request of created) {
  assert.match(request.Name, /^medopl-proof-isolated-(starter|pro)-/u, "cluster_foundation_must_support_isolated_node_pool_names");
  assert.equal(request.Tags, undefined, "cluster_foundation_default_must_not_send_tke_node_pool_tags");
  assert.equal(request.Type, "Native", "cluster_foundation_must_use_native_node_pool");
  assert.equal(request.AutoScalingGroupPara, undefined, "cluster_foundation_native_create_must_not_set_asg_para");
  assert.equal(request.LaunchConfigurePara, undefined, "cluster_foundation_native_create_must_not_set_launch_para");
}
assert.equal(created[0].Native.InstanceTypes[0], "S5.MEDIUM4", "cluster_foundation_starter_must_use_instance_type");
assert.deepEqual(created[0].Native.SecurityGroupIds, ["sg-foundation"], "cluster_foundation_create_must_set_security_group_ids");
assert.equal(created[0].Native.SystemDisk.DiskType, "CLOUD_BSSD", "cluster_foundation_default_system_disk");
assert.deepEqual(created[0].Native.SubnetIds, ["subnet-test"], "cluster_foundation_subnet");
assert.equal(created[0].Native.MachineType, "NativeCVM", "cluster_foundation_create_must_use_cvm_backed_native_nodes");
assert.equal(created[0].Native.InternetAccessible, undefined, "cluster_foundation_default_must_not_send_legacy_internet_accessible_shape");
assert.equal(created[1].Native.InstanceTypes[0], "S5.2XLARGE16", "cluster_foundation_pro_must_use_instance_type");
assert.deepEqual(created[1].Native.SecurityGroupIds, ["sg-foundation"], "cluster_foundation_pro_create_must_set_security_group_ids");
assert.equal(created[1].Native.MachineType, "NativeCVM", "cluster_foundation_pro_create_must_use_cvm_backed_native_nodes");
assert.equal(created[1].Native.InternetAccessible, undefined, "cluster_foundation_pro_default_must_not_send_legacy_internet_accessible_shape");
const modifyCall = calls.find((call) => call.api === "ModifyNodePool");
assert.equal(modifyCall, undefined, "cluster_foundation_replacement_upgrade_must_not_modify_starter_in_place");
const scaleCall = calls.find((call) => call.api === "ScaleNodePool");
assert.equal(scaleCall, undefined, "cluster_foundation_replacement_upgrade_must_not_scale_starter_in_place");
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

const proBlockedPlanFile = path.join(tempDir, "real-tke-cluster-foundation-pro-blocked-plan.json");
const proBlockedFakeSdk = path.join(tempDir, "fake-tencentcloud-sdk-nodejs-cluster-foundation-pro-blocked.mjs");
const proBlockedSdkLog = path.join(tempDir, "real-tke-cluster-foundation-pro-blocked-fake-sdk.log");
const proBlockedRuntimeDir = path.join(repoRoot, ".runtime", "v22-cloud-authorization", `cluster-foundation-pro-blocked-${Date.now()}`);
const proBlockedEvidenceRef = path.join(".runtime", "v22-cloud-authorization", path.basename(proBlockedRuntimeDir), "real_tke_runtime_node_lifecycle.json");
mkdirSync(proBlockedRuntimeDir, { recursive: true });
writeFileSync(proBlockedPlanFile, JSON.stringify({
  clusterId: "cls-test",
  region: "na-siliconvalley",
  requireNodeTotal: 1,
  requireReadyNodeCount: 1,
  createObserveAttempts: 1,
  deleteObserveAttempts: 2,
  tiers: [
    { id: "starter_2c4g_10gb", cpuCores: 2, memoryGb: 4, storageGb: 10 },
    { id: "pro_8c16g_100gb", cpuCores: 8, memoryGb: 16, storageGb: 100 },
  ],
  deriveFromClusterFoundation: {
    enabled: true,
    vpcId: "vpc-test",
    subnetId: "subnet-test",
    requireSecurityGroup: true,
  },
}, null, 2));
writeFileSync(proBlockedFakeSdk, `
const calls = [];
const pools = new Map();
async function persist() {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.TEST_REAL_TKE_CLUSTER_FOUNDATION_PRO_BLOCKED_FAKE_SDK_LOG, JSON.stringify(calls, null, 2));
}
class TkeClient {
  async DescribeClusters(request) {
    calls.push({ api: "DescribeClusters", request });
    await persist();
    return { Clusters: [{ ClusterId: "cls-test", ClusterNetworkSettings: { VpcId: "vpc-test", Subnets: ["subnet-test"] } }] };
  }
  async CreateNodePool(request) {
    calls.push({ api: "CreateNodePool", request });
    const nodePoolId = request.Name.includes("pro") ? "np-pro-no-cvm" : "np-starter-ready";
    pools.set(nodePoolId, {
      NodePoolId: nodePoolId,
      Type: "Native",
      LifeState: "Running",
      Name: request.Name,
      Native: {
        Scaling: request.Native.Scaling,
        Replicas: request.Native.Replicas,
        InstanceTypes: request.Native.InstanceTypes,
        ReadyReplicas: request.Name.includes("pro") ? 0 : 1,
        NodeCountSummary: request.Name.includes("pro")
          ? { AutoscalingAdded: { Total: 0, Normal: 0 }, ManuallyAdded: { Total: 0, Normal: 0 } }
          : { AutoscalingAdded: { Total: 1, Normal: 1 }, ManuallyAdded: { Total: 0, Normal: 0 } },
      },
    });
    await persist();
    return { NodePoolId: nodePoolId };
  }
  async DescribeNodePools(request) {
    calls.push({ api: "DescribeNodePools", request });
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
const proBlocked = run(["--operation", "real_tke_runtime_node_lifecycle", "--execute", "--confirm-current-session-authorization"], {
  V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE: proBlockedPlanFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE: proBlockedFakeSdk,
  V22_GOAL_EVIDENCE_REF: proBlockedEvidenceRef,
  TEST_REAL_TKE_CLUSTER_FOUNDATION_PRO_BLOCKED_FAKE_SDK_LOG: proBlockedSdkLog,
});
assert.notEqual(proBlocked.status, 0, "cluster_foundation_pro_without_cvm_must_fail_closed");
const proBlockedPayload = JSON.parse(proBlocked.stdout);
assert.equal(
  proBlockedPayload.summary.blocker,
  "production_goal_real_tke_node_pool_not_observed",
  "cluster_foundation_pro_without_cvm_blocker",
);
const proBlockedEvidence = JSON.parse(readFileSync(path.join(repoRoot, proBlockedEvidenceRef), "utf8"));
assert.equal(proBlockedEvidence.lifecycle.createStarter.observed.readyNodeCount, 1, "pro_blocked_evidence_must_keep_starter_ready_observation");
assert.equal(proBlockedEvidence.lifecycle.createPro.observed.readyNodeCount, 0, "pro_blocked_evidence_must_keep_pro_blocked_observation");
assert.deepEqual(proBlockedEvidence.nodePoolRefs, ["np-starter-ready", "np-pro-no-cvm"], "pro_blocked_evidence_must_keep_all_created_refs");
assert.equal(proBlockedEvidence.cleanupVerified, true, "pro_blocked_evidence_must_verify_cleanup");
assert.equal(proBlockedEvidence.nodePoolDestroyed, true, "pro_blocked_evidence_must_verify_destroy");
assertNoSensitiveText(proBlocked.stdout + proBlocked.stderr + JSON.stringify(proBlockedEvidence), "cluster_foundation_pro_blocked");

const stockAwarePlanFile = path.join(tempDir, "real-tke-cluster-foundation-stock-aware-plan.json");
const stockAwareFakeSdk = path.join(tempDir, "fake-tencentcloud-sdk-nodejs-cluster-foundation-stock-aware.mjs");
const stockAwareSdkLog = path.join(tempDir, "real-tke-cluster-foundation-stock-aware-fake-sdk.log");
const stockAwareRuntimeDir = path.join(repoRoot, ".runtime", "v22-cloud-authorization", `cluster-foundation-stock-aware-${Date.now()}`);
mkdirSync(stockAwareRuntimeDir, { recursive: true });
writeFileSync(stockAwarePlanFile, JSON.stringify({
  clusterId: "cls-test",
  region: "na-siliconvalley",
  requireNodeTotal: 1,
  requireReadyNodeCount: 1,
  createObserveAttempts: 1,
  deleteObserveAttempts: 1,
  tiers: [
    { id: "starter_2c4g_10gb", cpuCores: 2, memoryGb: 4, storageGb: 10 },
    { id: "pro_8c16g_100gb", cpuCores: 8, memoryGb: 16, storageGb: 100 },
  ],
  deriveFromClusterFoundation: {
    enabled: true,
    vpcId: "vpc-test",
    subnetId: "subnet-test",
    requireSecurityGroup: true,
  },
}, null, 2));
writeFileSync(stockAwareFakeSdk, `
const calls = [];
const pools = new Map();
async function persist() {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.TEST_REAL_TKE_CLUSTER_FOUNDATION_STOCK_AWARE_FAKE_SDK_LOG, JSON.stringify(calls, null, 2));
}
class TkeClient {
  async DescribeClusters(request) {
    calls.push({ api: "DescribeClusters", request });
    await persist();
    return { Clusters: [{ ClusterId: "cls-test", ClusterNetworkSettings: { VpcId: "vpc-test", Subnets: ["subnet-test"] } }] };
  }
  async CreateNodePool(request) {
    calls.push({ api: "CreateNodePool", request });
    const nodePoolId = request.Name.includes("pro") ? "np-pro-stock" : "np-starter-stock";
    pools.set(nodePoolId, {
      NodePoolId: nodePoolId,
      Type: "Native",
      LifeState: "Running",
      Name: request.Name,
      Native: {
        Scaling: request.Native.Scaling,
        Replicas: request.Native.Replicas,
        InstanceTypes: request.Native.InstanceTypes,
        ReadyReplicas: 1,
        NodeCountSummary: { AutoscalingAdded: { Total: 1, Normal: 1 }, ManuallyAdded: { Total: 0, Normal: 0 } },
      },
    });
    await persist();
    return { NodePoolId: nodePoolId };
  }
  async DescribeNodePools(request) {
    calls.push({ api: "DescribeNodePools", request });
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
      { Zone: "na-siliconvalley-1", InstanceType: "S2.MEDIUM4", CPU: 2, Memory: 4 },
      { Zone: "na-siliconvalley-1", InstanceType: "S5.MEDIUM4", CPU: 2, Memory: 4 },
      { Zone: "na-siliconvalley-1", InstanceType: "S2.2XLARGE16", CPU: 8, Memory: 16 },
      { Zone: "na-siliconvalley-1", InstanceType: "S5.2XLARGE16", CPU: 8, Memory: 16 },
    ] };
  }
  async DescribeZoneInstanceConfigInfos(request) {
    calls.push({ api: "DescribeZoneInstanceConfigInfos", request });
    await persist();
    return { InstanceTypeQuotaSet: [
      { Zone: "na-siliconvalley-1", InstanceType: "S2.MEDIUM4", Cpu: 2, Memory: 4, StatusCategory: "WithoutStock" },
      { Zone: "na-siliconvalley-1", InstanceType: "S5.MEDIUM4", Cpu: 2, Memory: 4, StatusCategory: "EnoughStock" },
      { Zone: "na-siliconvalley-1", InstanceType: "S2.2XLARGE16", Cpu: 8, Memory: 16, StatusCategory: "WithoutStock" },
      { Zone: "na-siliconvalley-1", InstanceType: "S5.2XLARGE16", Cpu: 8, Memory: 16, StatusCategory: "EnoughStock" },
    ] };
  }
}
export default {
  tke: { v20180525: { Client: TkeClient }, v20220501: { Client: TkeClient } },
  vpc: { v20170312: { Client: VpcClient } },
  cvm: { v20170312: { Client: CvmClient } },
};
`);
const stockAware = parseJson(run(["--operation", "real_tke_runtime_node_lifecycle", "--execute", "--confirm-current-session-authorization"], {
  V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE: stockAwarePlanFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE: stockAwareFakeSdk,
  V22_GOAL_EVIDENCE_REF: path.join(".runtime", "v22-cloud-authorization", path.basename(stockAwareRuntimeDir), "real_tke_runtime_node_lifecycle.json"),
  TEST_REAL_TKE_CLUSTER_FOUNDATION_STOCK_AWARE_FAKE_SDK_LOG: stockAwareSdkLog,
}), "real_tke_cluster_foundation_stock_aware_execute");
assert.equal(stockAware.summary.realProviderMutationExecuted, true, "stock_aware_must_execute_provider_mutation");
const stockAwareCalls = JSON.parse(readFileSync(stockAwareSdkLog, "utf8"));
assert(stockAwareCalls.some((call) => call.api === "DescribeZoneInstanceConfigInfos"), "stock_aware_must_query_zone_instance_stock");
const stockCreated = stockAwareCalls.filter((call) => call.api === "CreateNodePool").map((call) => call.request);
assert.equal(stockCreated[0].Native.InstanceTypes[0], "S5.MEDIUM4", "stock_aware_starter_must_avoid_without_stock_type");
assert.equal(stockCreated[1].Native.InstanceTypes[0], "S5.2XLARGE16", "stock_aware_pro_must_avoid_without_stock_type");

const cleanupOnlyPlanFile = path.join(tempDir, "real-tke-cleanup-only-plan.json");
const cleanupOnlyFakeSdk = path.join(tempDir, "fake-tencentcloud-sdk-nodejs-cleanup-only.mjs");
const cleanupOnlySdkLog = path.join(tempDir, "real-tke-cleanup-only-fake-sdk.log");
const cleanupOnlyRuntimeDir = path.join(repoRoot, ".runtime", "v22-cloud-authorization", `cleanup-only-${Date.now()}`);
mkdirSync(cleanupOnlyRuntimeDir, { recursive: true });
writeFileSync(cleanupOnlyPlanFile, JSON.stringify({
  clusterId: "cls-test",
  region: "na-siliconvalley",
  cleanupOnlyNodePoolRefs: ["np-leftover-pro"],
  deleteObserveAttempts: 2,
}, null, 2));
writeFileSync(cleanupOnlyFakeSdk, `
const calls = [];
const pools = new Map([["np-leftover-pro", { NodePoolId: "np-leftover-pro", LifeState: "Deleting", Native: { ReadyReplicas: 0 } }]]);
async function persist() {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.TEST_REAL_TKE_CLEANUP_ONLY_FAKE_SDK_LOG, JSON.stringify(calls, null, 2));
}
class TkeClient {
  async DeleteNodePool(request) {
    calls.push({ api: "DeleteNodePool", request });
    pools.delete(request.NodePoolId);
    await persist();
    return { RequestId: "delete-leftover" };
  }
  async DescribeNodePools(request) {
    calls.push({ api: "DescribeNodePools", request });
    await persist();
    const requested = new Set(request.Filters.find((filter) => filter.Name === "NodePoolsId").Values);
    return { NodePools: Array.from(pools.values()).filter((pool) => requested.has(pool.NodePoolId)) };
  }
}
export default {
  tke: { v20220501: { Client: TkeClient } },
};
`);
const cleanupOnly = parseJson(run(["--operation", "real_tke_runtime_node_lifecycle", "--execute", "--confirm-current-session-authorization"], {
  V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE: cleanupOnlyPlanFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE: cleanupOnlyFakeSdk,
  V22_GOAL_EVIDENCE_REF: path.join(".runtime", "v22-cloud-authorization", path.basename(cleanupOnlyRuntimeDir), "real_tke_runtime_node_lifecycle.json"),
  TEST_REAL_TKE_CLEANUP_ONLY_FAKE_SDK_LOG: cleanupOnlySdkLog,
}), "real_tke_cleanup_only_execute");
assert.equal(cleanupOnly.summary.cleanupOnly, true, "cleanup_only_summary");
assert.equal(cleanupOnly.summary.cleanupVerified, true, "cleanup_only_must_verify_cleanup");
const cleanupOnlyCalls = JSON.parse(readFileSync(cleanupOnlySdkLog, "utf8"));
assert.deepEqual(cleanupOnlyCalls.map((call) => call.api), ["DeleteNodePool", "DescribeNodePools"], "cleanup_only_must_only_delete_and_observe");

const cleanupMissingPlanFile = path.join(tempDir, "real-tke-cleanup-missing-plan.json");
const cleanupMissingFakeSdk = path.join(tempDir, "fake-tencentcloud-sdk-nodejs-cleanup-missing.mjs");
const cleanupMissingSdkLog = path.join(tempDir, "real-tke-cleanup-missing-fake-sdk.log");
const cleanupMissingRuntimeDir = path.join(repoRoot, ".runtime", "v22-cloud-authorization", `cleanup-missing-${Date.now()}`);
mkdirSync(cleanupMissingRuntimeDir, { recursive: true });
writeFileSync(cleanupMissingPlanFile, JSON.stringify({
  clusterId: "cls-test",
  region: "na-siliconvalley",
  cleanupOnlyNodePoolRefs: ["np-already-gone"],
  deleteObserveAttempts: 2,
}, null, 2));
writeFileSync(cleanupMissingFakeSdk, `
const calls = [];
async function persist() {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.TEST_REAL_TKE_CLEANUP_MISSING_FAKE_SDK_LOG, JSON.stringify(calls, null, 2));
}
class TkeClient {
  async DeleteNodePool(request) {
    calls.push({ api: "DeleteNodePool", request });
    await persist();
    const error = new Error("node pool not found");
    error.code = "ResourceNotFound";
    throw error;
  }
  async DescribeNodePools(request) {
    calls.push({ api: "DescribeNodePools", request });
    await persist();
    return { NodePools: [] };
  }
}
export default {
  tke: { v20220501: { Client: TkeClient } },
};
`);
const cleanupMissing = parseJson(run(["--operation", "real_tke_runtime_node_lifecycle", "--execute", "--confirm-current-session-authorization"], {
  V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE: cleanupMissingPlanFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE: cleanupMissingFakeSdk,
  V22_GOAL_EVIDENCE_REF: path.join(".runtime", "v22-cloud-authorization", path.basename(cleanupMissingRuntimeDir), "real_tke_runtime_node_lifecycle.json"),
  TEST_REAL_TKE_CLEANUP_MISSING_FAKE_SDK_LOG: cleanupMissingSdkLog,
}), "real_tke_cleanup_missing_execute");
assert.equal(cleanupMissing.summary.cleanupVerified, true, "cleanup_missing_must_verify_cleanup");
assert.equal(cleanupMissing.summary.nodePoolDestroyed, true, "cleanup_missing_must_treat_not_found_as_destroyed");
assert.deepEqual(
  JSON.parse(readFileSync(cleanupMissingSdkLog, "utf8")).map((call) => call.api),
  ["DeleteNodePool"],
  "cleanup_missing_must_not_need_extra_observe",
);

const cleanupBlockedPlanFile = path.join(tempDir, "real-tke-cleanup-blocked-plan.json");
const cleanupBlockedFakeSdk = path.join(tempDir, "fake-tencentcloud-sdk-nodejs-cleanup-blocked.mjs");
const cleanupBlockedSdkLog = path.join(tempDir, "real-tke-cleanup-blocked-fake-sdk.log");
const cleanupBlockedRuntimeDir = path.join(repoRoot, ".runtime", "v22-cloud-authorization", `cleanup-blocked-${Date.now()}`);
const cleanupBlockedEvidenceRef = path.join(".runtime", "v22-cloud-authorization", path.basename(cleanupBlockedRuntimeDir), "real_tke_runtime_node_lifecycle.json");
mkdirSync(cleanupBlockedRuntimeDir, { recursive: true });
writeFileSync(cleanupBlockedPlanFile, JSON.stringify({
  clusterId: "cls-test",
  region: "na-siliconvalley",
  cleanupOnlyNodePoolRefs: ["np-leftover-still-visible"],
  deleteObserveAttempts: 2,
}, null, 2));
writeFileSync(cleanupBlockedFakeSdk, `
const calls = [];
const pools = new Map([["np-leftover-still-visible", {
  NodePoolId: "np-leftover-still-visible",
  LifeState: "Deleting",
  Native: {
    Replicas: 1,
    ReadyReplicas: 0,
    InstanceTypes: ["S5.2XLARGE16"],
    NodeCountSummary: { AutoscalingAdded: { Total: 1, Normal: 0 }, ManuallyAdded: { Total: 0, Normal: 0 } },
  },
}]]);
async function persist() {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.TEST_REAL_TKE_CLEANUP_BLOCKED_FAKE_SDK_LOG, JSON.stringify(calls, null, 2));
}
class TkeClient {
  async DeleteNodePool(request) {
    calls.push({ api: "DeleteNodePool", request });
    await persist();
    return { RequestId: "delete-still-visible" };
  }
  async DescribeNodePools(request) {
    calls.push({ api: "DescribeNodePools", request });
    await persist();
    const requested = new Set(request.Filters.find((filter) => filter.Name === "NodePoolsId").Values);
    return { NodePools: Array.from(pools.values()).filter((pool) => requested.has(pool.NodePoolId)) };
  }
}
export default {
  tke: { v20220501: { Client: TkeClient } },
};
`);
const cleanupBlocked = run(["--operation", "real_tke_runtime_node_lifecycle", "--execute", "--confirm-current-session-authorization"], {
  V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE: cleanupBlockedPlanFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE: cleanupBlockedFakeSdk,
  V22_GOAL_EVIDENCE_REF: cleanupBlockedEvidenceRef,
  TEST_REAL_TKE_CLEANUP_BLOCKED_FAKE_SDK_LOG: cleanupBlockedSdkLog,
});
assert.notEqual(cleanupBlocked.status, 0, "cleanup_blocked_must_fail_closed");
const cleanupBlockedPayload = JSON.parse(cleanupBlocked.stdout);
assert.equal(cleanupBlockedPayload.summary.blocker, "production_goal_real_tke_cleanup_incomplete", "cleanup_blocked_summary");
const cleanupBlockedEvidence = JSON.parse(readFileSync(path.join(repoRoot, cleanupBlockedEvidenceRef), "utf8"));
assert.equal(cleanupBlockedEvidence.status, "blocked", "cleanup_blocked_evidence_status");
assert.equal(cleanupBlockedEvidence.cleanupResults[0].cleanupBlocker, "production_goal_real_tke_node_pool_destroy_not_verified", "cleanup_blocked_evidence_blocker");
assert.equal(cleanupBlockedEvidence.cleanupResults[0].observed.found, true, "cleanup_blocked_evidence_must_keep_observed_found");
assert.equal(cleanupBlockedEvidence.cleanupResults[0].observed.lifeState, "Deleting", "cleanup_blocked_evidence_must_keep_last_life_state");
assert.equal(cleanupBlockedEvidence.cleanupResults[0].observed.nodeTotal, 1, "cleanup_blocked_evidence_must_keep_last_node_total");
assert.equal(cleanupBlockedEvidence.cleanupResults[0].observed.readyNodeCount, 0, "cleanup_blocked_evidence_must_keep_last_ready_count");
assert.equal(cleanupBlockedEvidence.cleanupResults[0].observed.attempt, 2, "cleanup_blocked_evidence_must_keep_last_attempt");
assert.deepEqual(
  JSON.parse(readFileSync(cleanupBlockedSdkLog, "utf8")).map((call) => call.api),
  ["DeleteNodePool", "DescribeNodePools", "DescribeNodePools"],
  "cleanup_blocked_must_only_delete_and_observe",
);
assertNoSensitiveText(cleanupBlocked.stdout + cleanupBlocked.stderr + JSON.stringify(cleanupBlockedEvidence), "cleanup_blocked");

const cleanupObserveOnlyPlanFile = path.join(tempDir, "real-tke-cleanup-observe-only-plan.json");
const cleanupObserveOnlyFakeSdk = path.join(tempDir, "fake-tencentcloud-sdk-nodejs-cleanup-observe-only.mjs");
const cleanupObserveOnlySdkLog = path.join(tempDir, "real-tke-cleanup-observe-only-fake-sdk.log");
const cleanupObserveOnlyRuntimeDir = path.join(repoRoot, ".runtime", "v22-cloud-authorization", `cleanup-observe-only-${Date.now()}`);
mkdirSync(cleanupObserveOnlyRuntimeDir, { recursive: true });
writeFileSync(cleanupObserveOnlyPlanFile, JSON.stringify({
  clusterId: "cls-test",
  region: "na-siliconvalley",
  cleanupOnlyNodePoolRefs: ["np-leftover-observe-only"],
  cleanupOnlyObserveOnly: true,
  deleteObserveAttempts: 2,
}, null, 2));
writeFileSync(cleanupObserveOnlyFakeSdk, `
const calls = [];
let visible = true;
async function persist() {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.TEST_REAL_TKE_CLEANUP_OBSERVE_ONLY_FAKE_SDK_LOG, JSON.stringify(calls, null, 2));
}
class TkeClient {
  async DeleteNodePool(request) {
    calls.push({ api: "DeleteNodePool", request });
    await persist();
    throw new Error("observe-only cleanup must not call DeleteNodePool");
  }
  async DescribeNodePools(request) {
    calls.push({ api: "DescribeNodePools", request });
    await persist();
    const requested = new Set(request.Filters.find((filter) => filter.Name === "NodePoolsId").Values);
    if (!visible || !requested.has("np-leftover-observe-only")) return { NodePools: [] };
    visible = false;
    return { NodePools: [{
      NodePoolId: "np-leftover-observe-only",
      LifeState: "Deleting",
      Native: {
        Replicas: 1,
        ReadyReplicas: 0,
        NodeCountSummary: { AutoscalingAdded: { Total: 0, Normal: 0 }, ManuallyAdded: { Total: 0, Normal: 0 } },
      },
    }] };
  }
}
export default {
  tke: { v20220501: { Client: TkeClient } },
};
`);
const cleanupObserveOnly = parseJson(run(["--operation", "real_tke_runtime_node_lifecycle", "--execute", "--confirm-current-session-authorization"], {
  V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE: cleanupObserveOnlyPlanFile,
  V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE: cleanupObserveOnlyFakeSdk,
  V22_GOAL_EVIDENCE_REF: path.join(".runtime", "v22-cloud-authorization", path.basename(cleanupObserveOnlyRuntimeDir), "real_tke_runtime_node_lifecycle.json"),
  TEST_REAL_TKE_CLEANUP_OBSERVE_ONLY_FAKE_SDK_LOG: cleanupObserveOnlySdkLog,
}), "real_tke_cleanup_observe_only_execute");
assert.equal(cleanupObserveOnly.summary.cleanupOnly, true, "cleanup_observe_only_summary");
assert.equal(cleanupObserveOnly.summary.realProviderMutationExecuted, false, "cleanup_observe_only_must_not_claim_mutation");
assert.equal(cleanupObserveOnly.summary.cleanupVerified, true, "cleanup_observe_only_must_verify_cleanup");
assert.deepEqual(
  JSON.parse(readFileSync(cleanupObserveOnlySdkLog, "utf8")).map((call) => call.api),
  ["DescribeNodePools", "DescribeNodePools"],
  "cleanup_observe_only_must_only_observe",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_real_tke_cluster_foundation_lifecycle",
}, null, 2));
