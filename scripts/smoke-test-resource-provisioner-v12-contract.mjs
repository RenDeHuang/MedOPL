import assert from "node:assert/strict";

process.env.RESOURCE_PROVISIONING_ENABLED = "1";
delete process.env.TENCENT_CLOUD_SECRET_ID;
delete process.env.TENCENT_CLOUD_SECRET_KEY;

const { cloudResources } = await import("../adapters/resource-provisioner/src/inventory.mjs");
const { deleteNodePool, ensureCapacity, previewCreateNodePoolPayload } = await import("../adapters/resource-provisioner/src/provisioner.mjs");

const resources = await cloudResources();
assert.equal(resources.ok, false);
assert.equal(resources.reason, "tencent_cloud_credentials_not_configured");
assert.equal(resources.cluster.clusterId, "cls-ngiq693i");

const preview = previewCreateNodePoolPayload({
  tenantId: "tenant-a",
  workspaceId: "workspace-a",
  runId: "run-preview",
  resourceOrderId: "order-preview",
  serverPlanId: "cpu-2c4g",
  provisioningMode: "tke_node_pool_create",
  serverPlan: {
    id: "cpu-2c4g",
    provisioningMode: "tke_node_pool_create",
    instanceType: "MA5.MEDIUM16",
    zone: "na-siliconvalley-1",
  },
});
const autoScaling = JSON.parse(preview.AutoScalingGroupPara);
assert.equal(autoScaling.Zones, undefined, "CreateClusterNodePool payload must not send AutoScalingGroupPara.Zones in VPC network mode");
assert.deepEqual(autoScaling.SubnetIds, ["subnet-mbehh5wi", "subnet-r8mzuptu"]);
const launchConfig = JSON.parse(preview.LaunchConfigurePara);
assert.equal(launchConfig.ImageId, undefined, "CreateClusterNodePool payload must not set ImageId for this TKE cluster");
assert.equal(launchConfig.DataDisks, undefined, "CreateClusterNodePool payload must not send empty LaunchConfigurePara.DataDisks");
assert.equal(launchConfig.InstanceType, "MA5.MEDIUM16");
assert.equal(launchConfig.InstanceChargeType, "POSTPAID_BY_HOUR");
assert.equal(preview.InstanceAdvancedSettings.DataDisks, undefined, "CreateClusterNodePool payload must not send empty InstanceAdvancedSettings.DataDisks");

const ready = await ensureCapacity({
  tenantId: "tenant-a",
  workspaceId: "workspace-a",
  runId: "run-a",
  resourceOrderId: "order-a",
  serverPlanId: "cpu-2c4g",
  provisioningMode: "existing_node_pool",
  serverPlan: {
    id: "cpu-2c4g",
    nodePool: "existing-pool",
  },
});
assert.equal(ready.order.status, "ready");
assert.equal(ready.order.resourceOrderId, "order-a");

await assert.rejects(
  () => deleteNodePool({ nodePoolId: "np-test" }),
  /delete_node_pool_confirmation_required/,
);

console.log("resource provisioner v12 contract smoke passed");
