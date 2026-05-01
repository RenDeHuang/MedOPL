import { randomUUID } from "node:crypto";
import {
  PROVISIONING_ENABLED,
  TENCENT_SECURITY_GROUP_ID,
  TENCENT_SUBNET_IDS,
  TENCENT_TKE_CLUSTER_ID,
  TENCENT_TKE_MAX_NODES,
  TENCENT_TKE_MIN_NODES,
  TENCENT_TKE_SYSTEM_DISK_SIZE,
  TENCENT_TKE_SYSTEM_DISK_TYPE,
  TENCENT_TKE_ZONE,
  TENCENT_VPC_ID,
  TENCENT_CLOUD_REGION,
} from "./config.mjs";
import { appendLabels, appendTags, firstString, labelValue } from "./labels.mjs";
import { readOrders, writeOrders } from "./store.mjs";
import { callTag, callTke } from "./tencent-cloud.mjs";

function parseObjectString(value, fieldName) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      const error = new Error(`${fieldName}_invalid_json`);
      error.status = 422;
      throw error;
    }
  }
  if (typeof value === "object") return value;
  return null;
}

function planObject(input) {
  return input.serverPlan && typeof input.serverPlan === "object" ? input.serverPlan : input;
}

function buildProvisionContext(input) {
  const plan = planObject(input);
  return {
    tenantId: firstString(input.tenantId, input.tenant_id, input.customerId, input.customer_id),
    workspaceId: firstString(input.workspaceId, input.workspace_id),
    runId: firstString(input.runId, input.run_id, input.resourceOrderId, input.resource_order_id),
    resourceOrderId: firstString(input.resourceOrderId, input.resource_order_id),
    serverPlanId: firstString(input.serverPlanId, input.server_plan_id, plan.id, "default"),
    region: firstString(input.region, plan.region, TENCENT_CLOUD_REGION),
    mode: firstString(input.provisioningMode, input.provisioning_mode, plan.provisioningMode, "tke_node_pool_create"),
    plan,
  };
}

function idempotencyKey(context) {
  return [context.tenantId, context.workspaceId, context.resourceOrderId || context.runId, context.serverPlanId, context.mode]
    .map((item) => String(item || ""))
    .join(":");
}

function readyOrder(context, details = {}) {
  return {
    id: randomUUID(),
    idempotencyKey: idempotencyKey(context),
    status: "ready",
    action: "schedule_to_node_pool",
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    runId: context.runId,
    resourceOrderId: context.resourceOrderId,
    serverPlanId: context.serverPlanId,
    region: context.region,
    mode: context.mode,
    details,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function defaultNodePoolName(context) {
  const order = labelValue(context.resourceOrderId || context.runId).slice(0, 16);
  return `opl-${labelValue(context.serverPlanId)}-${order}`;
}

function defaultCreateNodePoolPayload(context) {
  const plan = context.plan;
  const instanceType = firstString(plan.instanceType, plan.InstanceType);
  if (!instanceType) {
    const error = new Error("node_pool_instance_type_required");
    error.status = 422;
    throw error;
  }

  return {
    ClusterId: firstString(plan.tkeClusterId, plan.clusterId, TENCENT_TKE_CLUSTER_ID),
    Name: defaultNodePoolName(context),
    EnableAutoscale: true,
    AutoScalingGroupPara: JSON.stringify({
      VpcId: TENCENT_VPC_ID,
      SubnetIds: TENCENT_SUBNET_IDS,
      MinSize: TENCENT_TKE_MIN_NODES,
      MaxSize: Math.min(TENCENT_TKE_MAX_NODES, Math.max(1, Number(plan.maxNodes || TENCENT_TKE_MAX_NODES))),
      DesiredCapacity: 0,
    }),
    LaunchConfigurePara: JSON.stringify({
      InstanceType: instanceType,
      InstanceChargeType: firstString(plan.instanceChargeType, plan.InstanceChargeType, "POSTPAID_BY_HOUR"),
      SecurityGroupIds: [TENCENT_SECURITY_GROUP_ID],
      SystemDisk: {
        DiskType: firstString(plan.systemDiskType, plan.SystemDiskType, TENCENT_TKE_SYSTEM_DISK_TYPE),
        DiskSize: Math.max(50, Number(plan.systemDiskSize || plan.SystemDiskSize || TENCENT_TKE_SYSTEM_DISK_SIZE)),
      },
      InternetAccessible: {
        PublicIpAssigned: false,
      },
    }),
    InstanceAdvancedSettings: {
      MountTarget: "",
      DockerGraphPath: "/var/lib/docker",
    },
  };
}

function normalizeAutoScalingGroupPara(payload) {
  const autoScaling = parseObjectString(payload.AutoScalingGroupPara, "auto_scaling_group_para") || {};
  if (Array.isArray(autoScaling.SubnetIds) && autoScaling.SubnetIds.length > 0) {
    delete autoScaling.Zones;
  }
  payload.AutoScalingGroupPara = JSON.stringify(autoScaling);
  return payload;
}

function normalizeLaunchConfigurePara(payload) {
  const launchConfig = parseObjectString(payload.LaunchConfigurePara, "launch_configure_para") || {};
  if (Object.hasOwn(launchConfig, "ImageId")) {
    delete launchConfig.ImageId;
  }
  if (Array.isArray(launchConfig.DataDisks) && launchConfig.DataDisks.length === 0) {
    delete launchConfig.DataDisks;
  }
  launchConfig.InstanceChargeType = firstString(launchConfig.InstanceChargeType, "POSTPAID_BY_HOUR");
  payload.LaunchConfigurePara = JSON.stringify(launchConfig);
  return payload;
}

function normalizeInstanceAdvancedSettings(payload) {
  const settings = parseObjectString(payload.InstanceAdvancedSettings, "instance_advanced_settings") || {};
  if (Array.isArray(settings.DataDisks) && settings.DataDisks.length === 0) {
    delete settings.DataDisks;
  }
  payload.InstanceAdvancedSettings = settings;
  return payload;
}

function buildCreateNodePoolPayload(context) {
  const plan = context.plan;
  const rawPayload = parseObjectString(
    plan.nodePoolCreatePayload || plan.provisionerPayload || plan.provisioningPayload,
    "node_pool_create_payload",
  );
  const payload = { ...(rawPayload || defaultCreateNodePoolPayload(context)) };
  payload.ClusterId = firstString(payload.ClusterId, plan.tkeClusterId, plan.clusterId, TENCENT_TKE_CLUSTER_ID);
  payload.Name = firstString(payload.Name, plan.nodePoolName, defaultNodePoolName(context));
  payload.EnableAutoscale = payload.EnableAutoscale !== undefined ? Boolean(payload.EnableAutoscale) : true;
  normalizeAutoScalingGroupPara(payload);
  normalizeLaunchConfigurePara(payload);
  normalizeInstanceAdvancedSettings(payload);
  payload.Tags = appendTags(payload, context);
  payload.Labels = appendLabels(payload, context);

  const required = ["ClusterId", "AutoScalingGroupPara", "LaunchConfigurePara", "InstanceAdvancedSettings", "EnableAutoscale"];
  const missing = required.filter((key) => payload[key] === undefined || payload[key] === null || payload[key] === "");
  if (missing.length) {
    const error = new Error(`node_pool_create_payload_missing:${missing.join(",")}`);
    error.status = 422;
    throw error;
  }
  return payload;
}

export function previewCreateNodePoolPayload(input = {}) {
  return buildCreateNodePoolPayload(buildProvisionContext(input));
}

function buildScaleToZeroPayload(input = {}) {
  const nodePoolId = firstString(input.nodePoolId, input.node_pool_id);
  if (!nodePoolId) {
    const error = new Error("node_pool_id_required");
    error.status = 422;
    throw error;
  }
  return {
    ClusterId: firstString(input.clusterId, input.tkeClusterId, TENCENT_TKE_CLUSTER_ID),
    NodePoolId: nodePoolId,
    DesiredCapacity: 0,
  };
}

async function ensureCloudTags(tags = []) {
  const items = tags
    .filter((tag) => tag?.Key && tag?.Value)
    .slice(0, 9)
    .map((tag) => ({ TagKey: tag.Key, TagValue: tag.Value }));
  if (!items.length) return;
  try {
    await callTag("CreateTags", { Tags: items });
  } catch (error) {
    const code = String(error.code || "");
    const message = String(error.message || "");
    if (/exist|duplicate/i.test(`${code} ${message}`)) return;
    throw error;
  }
}

export async function ensureCapacity(input) {
  const context = buildProvisionContext(input);
  if (!context.tenantId || !context.workspaceId || !context.runId) {
    const error = new Error("tenant_workspace_run_required");
    error.status = 422;
    throw error;
  }

  const state = await readOrders();
  const key = idempotencyKey(context);
  const existing = state.orders.find((order) => order.idempotencyKey === key && order.status !== "failed");
  if (existing) return { order: existing, reused: true };

  const mode = context.mode.toLowerCase();
  let order;
  if (mode === "schedule_to_node_pool" || mode === "existing_node_pool") {
    order = readyOrder(context, {
      nodePool: context.plan.nodePool || "",
      nodeSelector: context.plan.nodeSelector || {},
      tolerations: context.plan.tolerations || [],
    });
  } else {
    if (!PROVISIONING_ENABLED) {
      const error = new Error("resource_provisioning_disabled");
      error.status = 503;
      throw error;
    }
    const payload = buildCreateNodePoolPayload(context);
    await ensureCloudTags(payload.Tags);
    const response = await callTke("CreateClusterNodePool", payload, context.region);
    order = {
      id: randomUUID(),
      idempotencyKey: key,
      status: "provisioning",
      action: "CreateClusterNodePool",
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      runId: context.runId,
      resourceOrderId: context.resourceOrderId,
      serverPlanId: context.serverPlanId,
      region: context.region,
      mode: context.mode,
      nodePoolId: response.NodePoolId || payload.NodePoolId || "",
      requestId: response.RequestId || "",
      imageId: "",
      imageSource: "tke_create_node_pool_cluster_default",
      details: {
        nodeSelector: {
          ...(context.plan.nodeSelector || {}),
          "gaofenglab/resource-order-id": labelValue(context.resourceOrderId),
        },
        tolerations: context.plan.tolerations || [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  state.orders.unshift(order);
  await writeOrders(state);
  return { order, reused: false };
}

export async function scaleToZero(input = {}) {
  if (!PROVISIONING_ENABLED) {
    const error = new Error("resource_provisioning_disabled");
    error.status = 503;
    throw error;
  }
  const payload = buildScaleToZeroPayload(input);
  const response = await callTke("ModifyNodePoolDesiredCapacityAboutAsg", payload, TENCENT_CLOUD_REGION);
  const state = await readOrders();
  const order = state.orders.find((item) =>
    (input.resourceOrderId && item.resourceOrderId === input.resourceOrderId) ||
    (payload.NodePoolId && item.nodePoolId === payload.NodePoolId)
  );
  if (order) {
    order.status = "scaled_to_zero";
    order.updatedAt = new Date().toISOString();
    order.scaleToZeroRequestId = response.RequestId || "";
    await writeOrders(state);
  }
  return {
    ok: true,
    action: "ModifyNodePoolDesiredCapacityAboutAsg",
    requestId: response.RequestId || "",
    nodePoolId: payload.NodePoolId,
  };
}

export async function deleteNodePool(input = {}) {
  if (!PROVISIONING_ENABLED) {
    const error = new Error("resource_provisioning_disabled");
    error.status = 503;
    throw error;
  }
  if (String(input.confirmation || "") !== "delete-node-pool") {
    const error = new Error("delete_node_pool_confirmation_required");
    error.status = 409;
    throw error;
  }
  const nodePoolId = firstString(input.nodePoolId, input.node_pool_id);
  if (!nodePoolId) {
    const error = new Error("node_pool_id_required");
    error.status = 422;
    throw error;
  }
  const destroyCvmInstances = input.destroyCvmInstances === true || input.destroy_cvm_instances === true;
  const payload = {
    ClusterId: firstString(input.clusterId, input.tkeClusterId, TENCENT_TKE_CLUSTER_ID),
    NodePoolIds: [nodePoolId],
    KeepInstance: !destroyCvmInstances,
  };
  const response = await callTke("DeleteClusterNodePool", payload, TENCENT_CLOUD_REGION);
  const state = await readOrders();
  const order = state.orders.find((item) =>
    (input.resourceOrderId && item.resourceOrderId === input.resourceOrderId) ||
    (nodePoolId && item.nodePoolId === nodePoolId)
  );
  if (order) {
    order.status = "deleted";
    order.updatedAt = new Date().toISOString();
    order.deleteRequestId = response.RequestId || "";
    await writeOrders(state);
  }
  return {
    ok: true,
    action: "DeleteClusterNodePool",
    requestId: response.RequestId || "",
    nodePoolId,
    destroyCvmInstances,
    warning: destroyCvmInstances
      ? "CVM instances are released with the node pool."
      : "CVM instances are retained and may continue to incur cloud charges.",
  };
}
