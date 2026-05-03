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
assert.equal(launchConfig.SystemDisk?.DiskType, "CLOUD_BSSD", "CreateClusterNodePool payload should default to the live-supported TKE system disk type");
assert.equal(launchConfig.SystemDisk?.DiskSize, 50, "CreateClusterNodePool payload should keep a 50GB system disk by default");
assert.equal(preview.InstanceAdvancedSettings.DataDisks, undefined, "CreateClusterNodePool payload must not send empty InstanceAdvancedSettings.DataDisks");

const diskOverridePreview = previewCreateNodePoolPayload({
  tenantId: "tenant-a",
  workspaceId: "workspace-a",
  runId: "run-preview-disk-override",
  resourceOrderId: "order-preview-disk-override",
  serverPlanId: "cpu-2c4g",
  provisioningMode: "tke_node_pool_create",
  serverPlan: {
    id: "cpu-2c4g",
    provisioningMode: "tke_node_pool_create",
    instanceType: "MA5.MEDIUM16",
    systemDiskType: "CLOUD_SSD",
    systemDiskSize: 80,
  },
});
const diskOverrideLaunchConfig = JSON.parse(diskOverridePreview.LaunchConfigurePara);
assert.equal(diskOverrideLaunchConfig.SystemDisk?.DiskType, "CLOUD_SSD", "server plan must be able to override system disk type");
assert.equal(diskOverrideLaunchConfig.SystemDisk?.DiskSize, 80, "server plan must be able to override system disk size");

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

await assert.rejects(
  () => deleteNodePool({
    confirmation: "delete-node-pool",
    nodePoolId: "np-test",
  }),
  /delete_node_pool_binding_fields_required/,
);

await assert.rejects(
  () => deleteNodePool({
    confirmation: "delete-node-pool",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    serverPlanId: "cpu-2c4g",
    resourceOrderId: "order-a",
    runId: "run-a",
    nodePoolId: "np-test",
  }),
  /delete_node_pool_mapping_not_found/,
);

console.log("resource provisioner v12 contract smoke passed");
