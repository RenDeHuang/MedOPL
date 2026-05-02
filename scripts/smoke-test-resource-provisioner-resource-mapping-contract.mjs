import assert from "node:assert/strict";

import {
  buildProvisionResourceMapping,
  markProvisionResourceCleanup,
  mergeProvisionResourceMapping,
  observeProvisionResourceMappingResources,
} from "../adapters/resource-provisioner/src/store.mjs";

const now = "2026-05-02T00:00:00.000Z";
const context = {
  tenantId: "tenant-v19",
  workspaceId: "workspace-v19",
  resourceOrderId: "ro-v19",
  runId: "run-v19",
  serverPlanId: "cpu-2c4g",
  region: "na-siliconvalley",
};

const created = buildProvisionResourceMapping({
  context,
  nodePoolId: "np-v19",
  requestId: "req-create",
  createdAt: now,
  billingStartedAt: now,
  cloudResources: {
    nodeName: "10.0.0.144",
    cvmInstanceId: "ins-v19",
    podName: "runner-v19",
    jobName: "job-v19",
    pvcName: "pvc-v19",
    cosKeys: ["workspace/run-v19/artifact.json"],
    ledgerIds: ["ledger-preauth"],
  },
});

assert.equal(created.tenantId, context.tenantId);
assert.equal(created.workspaceId, context.workspaceId);
assert.equal(created.resourceOrderId, context.resourceOrderId);
assert.equal(created.runId, context.runId);
assert.equal(created.serverPlanId, context.serverPlanId);
assert.equal(created.nodePoolId, "np-v19");
assert.deepEqual(created.nodeNames, ["10.0.0.144"]);
assert.deepEqual(created.cvmInstanceIds, ["ins-v19"]);
assert.deepEqual(created.podNames, ["runner-v19"]);
assert.deepEqual(created.jobNames, ["job-v19"]);
assert.deepEqual(created.pvcNames, ["pvc-v19"]);
assert.deepEqual(created.cosKeys, ["workspace/run-v19/artifact.json"]);
assert.deepEqual(created.ledgerIds, ["ledger-preauth"]);
assert.equal(created.billingStartedAt, now);
assert.equal(created.billingStoppedAt, "");
assert.equal(created.cleanupStatus, "active");
assert.equal(created.cleanupEvidenceId, "");

const merged = mergeProvisionResourceMapping(created, {
  nodeNames: ["10.0.0.144", "10.0.0.145"],
  cvmInstanceIds: ["ins-v19", "ins-v20"],
  cosKeys: ["workspace/run-v19/artifact.json", "workspace/run-v19/output.zip"],
  ledgerIds: ["ledger-preauth", "ledger-pending"],
  updatedAt: "2026-05-02T00:05:00.000Z",
});

assert.deepEqual(merged.nodeNames, ["10.0.0.144", "10.0.0.145"]);
assert.deepEqual(merged.cvmInstanceIds, ["ins-v19", "ins-v20"]);
assert.deepEqual(merged.cosKeys, ["workspace/run-v19/artifact.json", "workspace/run-v19/output.zip"]);
assert.deepEqual(merged.ledgerIds, ["ledger-preauth", "ledger-pending"]);
assert.equal(merged.updatedAt, "2026-05-02T00:05:00.000Z");

const cleaned = markProvisionResourceCleanup(merged, {
  status: "deleted",
  requestId: "req-delete",
  cleanupEvidenceId: "cleanup-001",
  billingStoppedAt: "2026-05-02T00:10:00.000Z",
  remaining: {
    nodePools: 0,
    instances: 0,
    pods: 0,
    jobs: 0,
    pvcs: 0,
    cosKeys: 0,
  },
});

assert.equal(cleaned.cleanupStatus, "deleted");
assert.equal(cleaned.deleteRequestId, "req-delete");
assert.equal(cleaned.cleanupEvidenceId, "cleanup-001");
assert.equal(cleaned.billingStoppedAt, "2026-05-02T00:10:00.000Z");
assert.deepEqual(cleaned.cleanupRemaining, {
  nodePools: 0,
  instances: 0,
  pods: 0,
  jobs: 0,
  pvcs: 0,
  cosKeys: 0,
});

const state = { orders: [], resourceMappings: [created] };
const observed = observeProvisionResourceMappingResources(state, {
  resourceOrderId: "ro-v19",
  runId: "run-v19",
  nodePoolId: "np-v19",
  cloudResources: {
    clusterId: "cls-v19",
    nodePoolIds: ["np-v19"],
    cvmInstanceIds: ["ins-v19", "ins-v21"],
    nodeNames: ["10.0.0.144", "10.0.0.146"],
    podNames: ["runner-v19"],
    jobNames: ["job-v19"],
    pvcNames: ["pvc-v19"],
    cosKeys: ["workspace/run-v19/artifact.json", "workspace/run-v19/output.zip"],
    ledgerIds: ["ledger-preauth", "ledger-pending"],
  },
  observedAt: "2026-05-02T00:06:00.000Z",
});

assert.equal(observed.resourceOrderId, "ro-v19");
assert.equal(observed.clusterId, "cls-v19");
assert.deepEqual(observed.nodePoolIds, ["np-v19"]);
assert.deepEqual(observed.cvmInstanceIds, ["ins-v19", "ins-v21"]);
assert.deepEqual(observed.nodeNames, ["10.0.0.144", "10.0.0.146"]);
assert.deepEqual(observed.cosKeys, ["workspace/run-v19/artifact.json", "workspace/run-v19/output.zip"]);
assert.deepEqual(observed.ledgerIds, ["ledger-preauth", "ledger-pending"]);
assert.equal(observed.lastObservedAt, "2026-05-02T00:06:00.000Z");
assert.equal(state.resourceMappings[0].lastObservedAt, "2026-05-02T00:06:00.000Z");

console.log(JSON.stringify({ ok: true, contract: "resource_provisioner_resource_mapping" }, null, 2));
