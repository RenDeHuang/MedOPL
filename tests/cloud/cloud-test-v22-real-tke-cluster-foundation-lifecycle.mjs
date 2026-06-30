import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
  async CreateClusterNodePool(request) {
    calls.push({ api: "CreateClusterNodePool", request });
    const nodePoolId = request.Name.includes("pro") ? "np-pro-foundation" : "np-starter-foundation";
    const launch = JSON.parse(request.LaunchConfigurePara);
    if (!Array.isArray(launch.SecurityGroupIds) || launch.SecurityGroupIds[0] !== "sg-foundation") {
      throw new Error("security group ids is not set");
    }
    pools.set(nodePoolId, {
      NodePoolId: nodePoolId,
      LifeState: "normal",
      DesiredNodesNum: 1,
      MinNodesNum: 1,
      MaxNodesNum: 1,
      InstanceTypes: launch.InstanceTypes || [launch.InstanceType].filter(Boolean),
      NodeCountSummary: { AutoscalingAdded: { Total: 1, Normal: 1 }, ManuallyAdded: { Total: 0, Normal: 0 } },
    });
    await persist();
    return { NodePoolId: nodePoolId };
  }
  async ModifyNodePoolInstanceTypes(request) {
    calls.push({ api: "ModifyNodePoolInstanceTypes", request });
    const pool = pools.get(request.NodePoolId);
    if (pool) pool.InstanceTypes = request.InstanceTypes;
    await persist();
    return { RequestId: "modify-instance-types" };
  }
  async DescribeClusterNodePools(request) {
    calls.push({ api: "DescribeClusterNodePools", request });
    await persist();
    return { NodePoolSet: Array.from(pools.values()) };
  }
  async DeleteClusterNodePool(request) {
    calls.push({ api: "DeleteClusterNodePool", request });
    for (const id of request.NodePoolIds || []) pools.delete(id);
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
  tke: { v20180525: { Client: TkeClient } },
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
assert.deepEqual(calls.map((call) => call.api).filter((api) => api !== "DescribeClusterNodePools"), [
  "DescribeClusters",
  "DescribeInstanceTypeConfigs",
  "DescribeSecurityGroups",
  "CreateClusterNodePool",
  "ModifyNodePoolInstanceTypes",
  "CreateClusterNodePool",
  "DeleteClusterNodePool",
  "DeleteClusterNodePool",
], "cluster_foundation_must_discover_create_upgrade_and_destroy");
const created = calls.filter((call) => call.api === "CreateClusterNodePool").map((call) => call.request);
for (const request of created) {
  assert.equal(request.Tags, undefined, "cluster_foundation_default_must_not_send_tke_node_pool_tags");
  assert.equal(
    JSON.parse(request.AutoScalingGroupPara).AutoScalingGroupName,
    undefined,
    "cluster_foundation_tke_create_must_not_set_auto_scaling_group_name",
  );
}
assert.equal(JSON.parse(created[0].LaunchConfigurePara).ImageId, undefined, "cluster_foundation_default_must_not_require_cvm_image_permission");
assert.equal(JSON.parse(created[0].LaunchConfigurePara).LaunchConfigurationName, undefined, "cluster_foundation_tke_create_must_not_set_launch_configuration_name");
assert.equal(JSON.parse(created[1].LaunchConfigurePara).LaunchConfigurationName, undefined, "cluster_foundation_pro_tke_create_must_not_set_launch_configuration_name");
assert.equal(JSON.parse(created[0].LaunchConfigurePara).InstanceType, "S5.MEDIUM4", "cluster_foundation_starter_must_use_single_instance_type");
assert.equal(JSON.parse(created[0].LaunchConfigurePara).InstanceTypes, undefined, "cluster_foundation_create_must_not_use_instance_types_array");
assert.deepEqual(JSON.parse(created[0].LaunchConfigurePara).SecurityGroupIds, ["sg-foundation"], "cluster_foundation_create_must_set_security_group_ids");
assert.equal(JSON.parse(created[1].LaunchConfigurePara).InstanceType, "S5.2XLARGE16", "cluster_foundation_pro_must_use_single_instance_type");
assert.equal(JSON.parse(created[1].LaunchConfigurePara).InstanceTypes, undefined, "cluster_foundation_pro_create_must_not_use_instance_types_array");
assert.deepEqual(JSON.parse(created[1].LaunchConfigurePara).SecurityGroupIds, ["sg-foundation"], "cluster_foundation_pro_create_must_set_security_group_ids");
assert.equal(created[0].NodePoolOs, "tlinux3.1x86_64", "cluster_foundation_default_node_pool_os");
assert.deepEqual(JSON.parse(created[0].AutoScalingGroupPara).SubnetIds, ["subnet-test"], "cluster_foundation_subnet");
assert.deepEqual(
  calls.filter((call) => call.api === "DeleteClusterNodePool").map((call) => call.request.NodePoolIds),
  [["np-pro-foundation"], ["np-starter-foundation"]],
  "cluster_foundation_cleanup_must_delete_all_created_node_pools",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_real_tke_cluster_foundation_lifecycle",
}, null, 2));
