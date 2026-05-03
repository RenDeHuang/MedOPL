import assert from "node:assert/strict";

import { resourceOrderPublicView } from "../services/portal/src/domain/resource-orders.mjs";
import { buildDeleteVisibilityAdminStatuses } from "../adapters/resource-provisioner/src/inventory.mjs";

const releasedAt = "2026-05-03T08:00:00.000Z";

const orderView = resourceOrderPublicView({
  id: "ro-v20-2",
  status: "released",
  tenantId: "tenant-v20",
  userId: "user-v20",
  workspaceId: "workspace-v20",
  runId: "run-v20",
  cloudResourceIds: ["np-v20"],
  createdAt: "2026-05-03T07:00:00.000Z",
  updatedAt: releasedAt,
  pendingStoppedAt: releasedAt,
  billingStoppedAt: releasedAt,
}, []);

for (const required of [
  "serverNo",
  "taskNo",
  "plainStatus",
  "usageMinutes",
  "billingStopped",
  "billingStoppedAt",
  "releasedAt",
]) {
  assert.ok(Object.hasOwn(orderView, required), `public_status_missing_${required}`);
}
assert.equal(orderView.plainStatus, "已释放，停止计费");
assert.equal(orderView.billingStopped, true);
assert.equal(orderView.billingStoppedAt, releasedAt);
assert.equal(orderView.releasedAt, releasedAt);

const adminStatuses = buildDeleteVisibilityAdminStatuses({
  resourceMappings: [{
    tenantId: "tenant-v20",
    workspaceId: "workspace-v20",
    resourceOrderId: "ro-v20-2",
    runId: "run-v20",
    nodePoolId: "np-v20",
    cvmInstanceIds: ["ins-v20-a", "ins-v20-b"],
    cleanupEvidenceId: "cleanup-v20-2",
    cleanupStatus: "deleted",
    cleanupRemaining: { nodePools: 0, instances: 0, pods: 0, jobs: 0, pvcs: 0, cosKeys: 0 },
    billingStoppedAt: releasedAt,
  }],
  instances: [],
  nodePools: [],
});

assert.equal(adminStatuses.length, 1, "admin_status_count_mismatch");
const admin = adminStatuses[0];
for (const required of ["tenantId", "workspaceId", "resourceOrderId", "runId", "nodePoolId", "cvmInstanceIds", "cleanupEvidence"]) {
  assert.ok(Object.hasOwn(admin, required), `admin_status_missing_${required}`);
}
assert.equal(admin.cleanupEvidence.id, "cleanup-v20-2");
assert.equal(admin.cleanupEvidence.billingStoppedAt, releasedAt);

console.log(JSON.stringify({ ok: true, contract: "v20_2_resource_delete_visibility" }, null, 2));
