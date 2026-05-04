import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  previewCreateNodePoolPayload,
  previewScaleNodePoolPayload,
} from "../adapters/resource-provisioner/src/provisioner.mjs";

const port = 18993;
const baseUrl = `http://127.0.0.1:${port}`;
const runtimeRoot = path.join(os.tmpdir(), `resource-provisioner-contract-${Date.now()}`);
const ordersFile = path.join(runtimeRoot, "orders.json");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify({ actual, expected })}`);
  }
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return response.json();
    } catch {
      // Wait for the child process to bind the port.
    }
    await delay(100);
  }
  throw new Error("resource_provisioner_health_timeout");
}

async function postEnsureCapacity(body) {
  const response = await fetch(`${baseUrl}/resource-orders/ensure-capacity`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function postProvisionAsync(body) {
  const response = await fetch(`${baseUrl}/resource-orders/provision-async`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function getResourceMappings(query = "") {
  const response = await fetch(`${baseUrl}/resource-mappings${query}`);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function postMarkCleanup(body) {
  const response = await fetch(`${baseUrl}/resource-mappings/mark-cleanup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function postObserveResources(body) {
  const response = await fetch(`${baseUrl}/resource-mappings/observe-resources`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function autoScalingFrom(payload) {
  return JSON.parse(payload.AutoScalingGroupPara || "{}");
}

const liveCreatePreview = previewCreateNodePoolPayload({
  tenantId: "tenant-smoke",
  workspaceId: "workspace-smoke",
  runId: "run-smoke",
  resourceOrderId: "ro-smoke",
  serverPlanId: "cpu-small",
  provisioningMode: "tke_node_pool_create",
  serverPlan: {
    id: "cpu-small",
    instanceType: "SA5.MEDIUM4",
    provisioningMode: "tke_node_pool_create",
  },
});
assert(autoScalingFrom(liveCreatePreview).DesiredCapacity === 1, "tke node pool create should provision one initial node for same-day live gate");
assert(
  liveCreatePreview.Labels.some((item) => item.Name === "gaofenglab/node-pool-role" && item.Value === "runtime"),
  "created TKE node pools must carry the runtime node pool role label",
);

const explicitZeroPreview = previewCreateNodePoolPayload({
  tenantId: "tenant-smoke",
  workspaceId: "workspace-smoke",
  runId: "run-smoke-zero",
  resourceOrderId: "ro-smoke-zero",
  serverPlanId: "cpu-small",
  provisioningMode: "tke_node_pool_create",
  serverPlan: {
    id: "cpu-small",
    instanceType: "SA5.MEDIUM4",
    desiredNodes: 0,
    provisioningMode: "tke_node_pool_create",
  },
});
assert(autoScalingFrom(explicitZeroPreview).DesiredCapacity === 0, "explicit desiredNodes=0 should remain available for non-live dry capacity tests");

const scalePreview = previewScaleNodePoolPayload({
  nodePoolId: "np-smoke",
  desiredCapacity: 1,
  tkeClusterId: "cls-smoke",
});
assert(scalePreview.NodePoolId === "np-smoke", "scale preview should keep node pool id");
assert(scalePreview.DesiredCapacity === 1, "scale preview should allow scaling a live test node pool to one node");

const child = spawn(process.execPath, ["adapters/resource-provisioner/src/server.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    RESOURCE_PROVISIONING_ENABLED: "0",
    RESOURCE_PROVISIONER_RUNTIME_ROOT: runtimeRoot,
    RESOURCE_PROVISIONER_ORDERS_FILE: ordersFile,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

try {
  const health = await waitForHealth();
  assert(health.ok === true, "healthz should report ok");
  assert(health.tencent.provisioningEnabled === false, "provisioning should be disabled in this contract test");

  const scheduleRunId = `run-${Date.now()}`;
  const scheduleResourceOrderId = `ro-${Date.now()}`;
  const schedule = await postEnsureCapacity({
    tenantId: "tenant-smoke",
    workspaceId: "workspace-smoke",
    runId: scheduleRunId,
    resourceOrderId: scheduleResourceOrderId,
    serverPlanId: "cpu-small",
    provisioningMode: "schedule_to_node_pool",
    serverPlan: {
      id: "cpu-small",
      provisioningMode: "schedule_to_node_pool",
      nodeSelector: { "gaofenglab/server-plan-id": "cpu-small" },
    },
  });
  assert(schedule.response.ok, `schedule_to_node_pool should not call Tencent Cloud: ${JSON.stringify(schedule.payload)}`);
  assert(schedule.payload.order?.status === "ready", "schedule order should be ready");
  assert(schedule.payload.order?.action === "schedule_to_node_pool", "schedule action should be explicit");
  assert(schedule.payload.order?.resourceMappingId, "schedule order should expose resourceMappingId");
  assert(schedule.payload.order?.billingStartedAt, "schedule order should expose billingStartedAt");
  assert(schedule.payload.order?.cleanupStatus === "active", "schedule order should start active cleanup state");

  const mappingEvidence = await getResourceMappings(`?resourceOrderId=${encodeURIComponent(scheduleResourceOrderId)}`);
  assert(mappingEvidence.response.ok, `resource mapping evidence endpoint should be queryable: ${JSON.stringify(mappingEvidence.payload)}`);
  assert(mappingEvidence.payload.items?.length === 1, `resource mapping evidence should return one mapping: ${JSON.stringify(mappingEvidence.payload)}`);
  assert(mappingEvidence.payload.items[0].id === schedule.payload.order.resourceMappingId, "resource mapping evidence should expose the order mapping id");
  assert(mappingEvidence.payload.items[0].billingStartedAt, "resource mapping evidence should expose billingStartedAt");
  assert(mappingEvidence.payload.items[0].cleanupStatus === "active", "resource mapping evidence should expose cleanupStatus");

  const observedResources = await postObserveResources({
    resourceOrderId: scheduleResourceOrderId,
    runId: scheduleRunId,
    cloudResources: {
      clusterId: "cls-smoke",
      nodePoolId: "np-smoke",
      nodePoolIds: ["np-smoke"],
      cvmInstanceIds: ["ins-smoke-1"],
      nodeNames: ["10.0.0.11"],
      podNames: ["pod-smoke"],
      jobNames: ["job-smoke"],
      pvcNames: ["pvc-smoke"],
      cosKeys: ["workspaces/tenant-smoke/workspace-smoke/inputs/input.txt"],
      ledgerIds: ["ledger-smoke"],
    },
    observedAt: "2026-05-02T00:01:00.000Z",
  });
  assert(observedResources.response.ok, `resource mapping observed resources should be mergeable: ${JSON.stringify(observedResources.payload)}`);
  assert(observedResources.payload.mapping?.id === schedule.payload.order.resourceMappingId, "observe resources should update the same mapping");
  assertDeepEqual(observedResources.payload.mapping?.nodePoolIds, ["np-smoke"], "observe resources should expose node pool ids");
  assertDeepEqual(observedResources.payload.mapping?.cvmInstanceIds, ["ins-smoke-1"], "observe resources should expose CVM instance ids");
  assertDeepEqual(observedResources.payload.mapping?.cosKeys, ["workspaces/tenant-smoke/workspace-smoke/inputs/input.txt"], "observe resources should expose COS keys");
  assert(observedResources.payload.mapping?.lastObservedAt === "2026-05-02T00:01:00.000Z", "observe resources should expose observation timestamp");

  const bypassCleanup = await postMarkCleanup({
    resourceOrderId: scheduleResourceOrderId,
    status: "deleted",
    cleanupEvidenceId: "cleanup-bypass",
    billingStoppedAt: "2026-05-02T00:00:00.000Z",
    cleanupRemaining: {
      nodePools: 0,
      instances: 0,
      pods: 0,
      jobs: 0,
      pvcs: 0,
      cosKeys: 0,
    },
  });
  assert(bypassCleanup.response.status === 409, "mark-cleanup must reject billing stop before the bound delete chain records it");
  assert(bypassCleanup.payload.error === "resource_mapping_delete_not_started", "mark-cleanup bypass rejection should be explicit");

  const deleteStartedState = JSON.parse(await readFile(ordersFile, "utf8"));
  const deleteStartedMapping = deleteStartedState.resourceMappings.find((item) => item.id === schedule.payload.order.resourceMappingId);
  deleteStartedMapping.cleanupStatus = "delete_requested";
  deleteStartedMapping.deleteRequestId = "req-delete-smoke";
  deleteStartedMapping.billingStoppedAt = "2026-05-02T00:00:00.000Z";
  const deleteStartedOrder = deleteStartedState.orders.find((item) => item.resourceMappingId === schedule.payload.order.resourceMappingId);
  deleteStartedOrder.deleteRequestId = "req-delete-smoke";
  deleteStartedOrder.billingStoppedAt = "2026-05-02T00:00:00.000Z";
  deleteStartedOrder.cleanupStatus = "delete_requested";
  await writeFile(ordersFile, `${JSON.stringify(deleteStartedState, null, 2)}\n`, "utf8");

  const markedCleanup = await postMarkCleanup({
    resourceOrderId: scheduleResourceOrderId,
    status: "deleted",
    cleanupEvidenceId: "cleanup-smoke",
    billingStoppedAt: "2026-05-02T00:30:00.000Z",
    cleanupRemaining: {
      nodePools: 0,
      instances: 0,
      pods: 0,
      jobs: 0,
      pvcs: 0,
      cosKeys: 0,
    },
  });
  assert(markedCleanup.response.ok, `resource mapping cleanup should be markable after external cleanup verification: ${JSON.stringify(markedCleanup.payload)}`);
  assert(markedCleanup.payload.mapping?.id === schedule.payload.order.resourceMappingId, "mark cleanup should update the same mapping");
  assert(markedCleanup.payload.mapping?.cleanupStatus === "deleted", "mark cleanup should expose deleted status");
  assert(markedCleanup.payload.mapping?.billingStoppedAt === "2026-05-02T00:00:00.000Z", "mark cleanup must preserve the bound delete billingStoppedAt");
  assertDeepEqual(markedCleanup.payload.mapping?.cleanupRemaining, {
    nodePools: 0,
    instances: 0,
    pods: 0,
    jobs: 0,
    pvcs: 0,
    cosKeys: 0,
  }, "mark cleanup should expose remaining counts");

  const asyncSchedule = await postProvisionAsync({
    tenantId: "tenant-smoke",
    workspaceId: "workspace-smoke",
    runId: `run-async-${Date.now()}`,
    resourceOrderId: `ro-async-${Date.now()}`,
    serverPlanId: "cpu-small",
    provisioningMode: "schedule_to_node_pool",
    serverPlan: {
      id: "cpu-small",
      provisioningMode: "schedule_to_node_pool",
      nodeSelector: { "gaofenglab/server-plan-id": "cpu-small" },
    },
  });
  assert(asyncSchedule.response.ok, `provision-async should share ensure-capacity semantics: ${JSON.stringify(asyncSchedule.payload)}`);
  assert(asyncSchedule.payload.accepted === true, "provision-async should report accepted=true");
  assert(asyncSchedule.payload.order?.status === "ready", "provision-async schedule order should be ready");
  assert(asyncSchedule.payload.order?.action === "schedule_to_node_pool", "provision-async action should be explicit");
  assert(asyncSchedule.payload.order?.resourceMappingId, "provision-async should persist resourceMappingId");

  const cloud = await postEnsureCapacity({
    tenantId: "tenant-smoke",
    workspaceId: "workspace-smoke",
    runId: `run-cloud-${Date.now()}`,
    serverPlanId: "gpu-nodepool",
    provisioningMode: "tke_node_pool",
    serverPlan: {
      id: "gpu-nodepool",
      provisioningMode: "tke_node_pool",
      nodePoolCreatePayload: {
        ClusterId: "cls-smoke",
        AutoScalingGroupPara: "{}",
        LaunchConfigurePara: "{}",
        InstanceAdvancedSettings: "{}",
        EnableAutoscale: true,
      },
    },
  });
  assert(cloud.response.status === 503, "cloud provisioning must stay blocked when disabled");
  assert(cloud.payload.error === "resource_provisioning_disabled", "disabled cloud provisioning should be explicit");

  const state = JSON.parse(await readFile(ordersFile, "utf8"));
  assert(Array.isArray(state.resourceMappings), "orders state should contain resourceMappings");
  assert(state.resourceMappings.some((item) => item.id === schedule.payload.order.resourceMappingId), "schedule mapping should be persisted");
  const mapping = state.resourceMappings.find((item) => item.id === schedule.payload.order.resourceMappingId);
  assert(mapping.tenantId === "tenant-smoke", "mapping should keep tenantId");
  assert(mapping.workspaceId === "workspace-smoke", "mapping should keep workspaceId");
  assert(mapping.runId.startsWith("run-"), "mapping should keep runId");
  assert(mapping.cleanupStatus === "deleted", "mapping should end deleted after mark-cleanup");
  assert(mapping.billingStoppedAt === "2026-05-02T00:00:00.000Z", "mapping should persist billingStoppedAt");
  assert(mapping.billingStartedAt, "mapping should track billingStartedAt");

  console.log("resource provisioner contract smoke passed");
} finally {
  child.kill();
  await delay(100);
  if (child.exitCode && child.exitCode !== 0) {
    console.error(stdout);
    console.error(stderr);
  }
}
