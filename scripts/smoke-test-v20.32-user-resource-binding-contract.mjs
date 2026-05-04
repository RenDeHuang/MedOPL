import assert from "node:assert/strict";

import { createResourceOrderPublicRoutes } from "../services/portal/src/routes/resource-order-public.routes.mjs";

function createResponseRecorder() {
  return { statusCode: null, payload: null };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

async function readJsonBody(req) {
  return JSON.parse(String(req.body || "{}"));
}

async function persistResourceOrderState() {
  return { ok: true };
}

const persistedStorageOrders = [];
const persistedWorkspaceFiles = [];

function createRoute(callLog) {
  return createResourceOrderPublicRoutes({
    createQuotedResourceOrder: async () => ({ ok: false, status: 500, error: "not_used_in_contract" }),
    markWorkspaceStorageDeleting(db, input) {
      const deletedAt = String(input.deletedAt || "2026-05-04T11:00:00.000Z");
      const cleanupAfterAt = "2026-05-11T11:00:00.000Z";
      let storageOrderCount = 0;
      let fileCount = 0;
      const storageOrderIds = [];
      const workspaceFileIds = [];
      for (const order of db.storageOrders || []) {
        if (order.userId === input.user.id && order.workspaceId === input.workspaceId) {
          order.status = "deleting";
          order.deletedAt = deletedAt;
          order.updatedAt = deletedAt;
          order.retentionCleanupAfterAt = cleanupAfterAt;
          storageOrderCount += 1;
          storageOrderIds.push(order.id);
        }
      }
      for (const file of db.workspaceFiles || []) {
        if (file.userId === input.user.id && file.workspaceId === input.workspaceId) {
          file.status = "deleting";
          file.deletedAt = deletedAt;
          file.updatedAt = deletedAt;
          file.retentionCleanupAfterAt = cleanupAfterAt;
          fileCount += 1;
          workspaceFileIds.push(file.id);
        }
      }
      return { ok: true, storageOrderCount, fileCount, storageOrderIds, workspaceFileIds, deletedAt, cleanupAfterAt };
    },
    provisionResourceOrder: async () => ({ ok: false, status: 500, error: "not_used_in_contract" }),
    readJsonBody,
    resourceProvisionerClient: {
      async fetchCloudResources() {
        return { ok: true, items: [] };
      },
      async scaleToZero() {
        throw new Error("scale_to_zero_not_expected");
      },
      async deleteNodePool(input) {
        callLog.push(input);
        return { ok: true, deletedNodePoolId: input.nodePoolId };
      },
    },
    sendJson,
    writeDb: {
      persistResourceOrderState,
      upsertStorageOrder: async (order) => {
        persistedStorageOrders.push(order);
        return { ok: true };
      },
      upsertWorkspaceFile: async (file) => {
        persistedWorkspaceFiles.push(file);
        return { ok: true };
      },
    },
  });
}

async function request(route, { method, path, body = "", db, user }) {
  const res = createResponseRecorder();
  const handled = await route({
    req: { method, body, headers: {} },
    res,
    url: new URL(path, "http://portal.local"),
    db,
    user,
  });
  return { handled, res };
}

const db = {
  users: [{ id: "tenant-1", tenantId: "tenant-1", email: "tenant-1@example.com" }],
  groups: [],
  wallets: [{ userId: "tenant-1", balance: 0, updatedAt: "2026-05-04T10:00:00.000Z" }],
  resourceOrders: [{
    id: "ro-1",
    tenantId: "tenant-1",
    userId: "tenant-1",
    portalUserId: "tenant-1",
    workspaceId: "workspace-a",
    runId: "run-1",
    status: "running",
    serverPlanId: "starter-2c",
    cloudResourceIds: ["np-1", "ins-1"],
    createdAt: "2026-05-04T09:00:00.000Z",
    updatedAt: "2026-05-04T10:00:00.000Z",
  }],
  resourceOrderEvents: [],
  storageOrders: [{
    id: "storage-1",
    tenantId: "tenant-1",
    userId: "tenant-1",
    workspaceId: "workspace-a",
    status: "active",
    cosPrefix: "workspaces/tenant-1/workspace-a/",
    storagePlanId: "cos-100gb",
    storageSizeGb: 100,
    createdAt: "2026-05-04T09:00:00.000Z",
    updatedAt: "2026-05-04T10:00:00.000Z",
  }],
  workspaceFiles: [{
    id: "file-1",
    tenantId: "tenant-1",
    userId: "tenant-1",
    workspaceId: "workspace-a",
    runId: "run-1",
    kind: "outputs",
    name: "reply.md",
    relativePath: "outputs/reply.md",
    storageKey: "workspaces/tenant-1/workspace-a/outputs/reply.md",
    status: "active",
    createdAt: "2026-05-04T09:30:00.000Z",
    updatedAt: "2026-05-04T10:00:00.000Z",
  }],
  ledger: [],
};

const user = { id: "tenant-1", tenantId: "tenant-1", email: "tenant-1@example.com" };
const deleteCalls = [];
const route = createRoute(deleteCalls);

const listResult = await request(route, {
  method: "GET",
  path: "/portal/api/my/resources",
  db,
  user,
});

assert.equal(listResult.handled, true, "my_resources_route_must_be_handled");
assert.equal(listResult.res.statusCode, 200, "my_resources_route_must_return_200");
assert.equal(Array.isArray(listResult.res.payload?.items), true, "my_resources_route_must_return_items");
assert.equal(listResult.res.payload.items.length, 1, "my_resources_route_must_return_one_binding");

const [binding] = listResult.res.payload.items;
assert.equal(binding.tenantId, "tenant-1");
assert.equal(binding.workspaceId, "workspace-a");
assert.equal(binding.runId, "run-1");
assert.equal(binding.resourceOrderId, "ro-1");
assert.equal(binding.serverPlanId, "starter-2c");
assert.equal(binding.createdAt, "2026-05-04T09:00:00.000Z");
assert.equal(binding.updatedAt, "2026-05-04T10:00:00.000Z");
assert.equal(binding.resourceCreatedAt, "2026-05-04T09:00:00.000Z");
assert.equal(binding.resourceUpdatedAt, "2026-05-04T10:00:00.000Z");
assert.equal(binding.billingStartedAt, "2026-05-04T09:00:00.000Z");
assert.equal(binding.billingStoppedAt, "");
assert.equal(binding.usageMinutes, 60);
assert.equal(binding.runtimeMinutes, 60);
assert.equal(binding.nodePoolId, "np-1");
assert.deepEqual(binding.cvmInstanceIds, ["ins-1"]);
assert.equal(binding.storageOrderId, "storage-1");
assert.equal(binding.cosPrefix, "workspaces/tenant-1/workspace-a/");
assert.equal(binding.storageCreatedAt, "2026-05-04T09:00:00.000Z");
assert.equal(binding.storageUpdatedAt, "2026-05-04T10:00:00.000Z");
assert.equal(binding.storageDeletedAt, "");
assert.equal(binding.storageSizeGb, 100);
assert.equal(binding.storageStatus, "active");
assert.equal(binding.retentionCleanupAfterAt, "");
assert.equal(binding.canDelete, true);
assert.equal(binding.deleteBlockedReason, "");
assert.deepEqual(Object.keys(binding.billingTags).sort(), [
  "resourceorderid",
  "runid",
  "serverplanid",
  "tenantid",
  "workspaceid",
]);
assert.equal(binding.billingTags.resourceorderid, "ro-1");
assert.equal(binding.billingTags.runid, "run-1");
assert.equal(binding.billingTags.serverplanid, "starter-2c");
assert.equal(binding.billingTags.tenantid, "tenant-1");
assert.equal(binding.billingTags.workspaceid, "workspace-a");

const rejectedDelete = await request(route, {
  method: "POST",
  path: "/portal/api/resource-orders/delete-node-pool",
  body: JSON.stringify({
    resourceOrderId: "ro-1",
    nodePoolId: "np-client",
    confirmDeleteNodePool: true,
    destroyCvmInstances: true,
  }),
  db,
  user,
});

assert.equal(rejectedDelete.handled, true, "delete_route_must_be_handled");
assert.equal(rejectedDelete.res.statusCode, 400, "delete_route_must_reject_client_node_pool_id");
assert.equal(deleteCalls.length, 0, "negative_delete_must_not_call_provisioner");

const acceptedDelete = await request(route, {
  method: "POST",
  path: "/portal/api/resource-orders/delete-node-pool",
  body: JSON.stringify({
    resourceOrderId: "ro-1",
    confirmDeleteNodePool: true,
    destroyCvmInstances: true,
  }),
  db,
  user,
});

assert.equal(acceptedDelete.handled, true, "delete_route_must_handle_valid_delete");
assert.equal(acceptedDelete.res.statusCode, 200, "delete_route_must_return_200_for_valid_delete");
assert.equal(deleteCalls.length, 1, "valid_delete_must_call_provisioner_once");
assert.equal(deleteCalls[0].resourceOrderId, "ro-1");
assert.equal(deleteCalls[0].nodePoolId, "np-1");
assert.equal(deleteCalls[0].destroyCvmInstances, true);
assert.equal(deleteCalls[0].tenantId, "tenant-1");
assert.equal(deleteCalls[0].workspaceId, "workspace-a");
assert.equal(deleteCalls[0].serverPlanId, "starter-2c");
assert.equal(db.storageOrders[0].status, "deleting", "delete_must_mark_storage_order_deleting");
assert.equal(db.storageOrders[0].deletedAt, "2026-05-04T11:00:00.000Z", "delete_must_stop_storage_billing_at_delete_time");
assert.equal(db.storageOrders[0].retentionCleanupAfterAt, "2026-05-11T11:00:00.000Z", "delete_must_record_storage_retention_deadline");
assert.equal(db.workspaceFiles[0].status, "deleting", "delete_must_mark_workspace_files_deleting");
assert.equal(persistedStorageOrders.length, 1, "delete_must_persist_storage_order_retention_state");
assert.equal(persistedWorkspaceFiles.length, 1, "delete_must_persist_workspace_file_retention_state");

const postDeleteList = await request(route, {
  method: "GET",
  path: "/portal/api/my/resources",
  db,
  user,
});
assert.equal(postDeleteList.res.statusCode, 200, "post_delete_my_resources_must_return_200");
const [postDeleteBinding] = postDeleteList.res.payload.items;
assert.equal(postDeleteBinding.status, "released", "post_delete_resource_status_must_be_released");
assert.equal(postDeleteBinding.storageStatus, "deleting", "post_delete_binding_must_show_storage_deleting");
assert.equal(postDeleteBinding.storageDeletedAt, "2026-05-04T11:00:00.000Z", "post_delete_binding_must_show_storage_deleted_at");
assert.equal(postDeleteBinding.storageBillingStoppedAt, "2026-05-04T11:00:00.000Z", "post_delete_binding_must_show_storage_billing_stopped_at");
assert.equal(postDeleteBinding.retentionCleanupAfterAt, "2026-05-11T11:00:00.000Z", "post_delete_binding_must_show_retention_cleanup_deadline");

for (const forbiddenField of [
  "nodePoolIds",
  "instanceIds",
  "cvmInstanceId",
  "nodePoolIdSet",
]) {
  const rejected = await request(route, {
    method: "POST",
    path: "/portal/api/resource-orders/delete-node-pool",
    body: JSON.stringify({
      resourceOrderId: "ro-1",
      confirmDeleteNodePool: true,
      destroyCvmInstances: true,
      [forbiddenField]: forbiddenField,
    }),
    db,
    user,
  });
  assert.equal(rejected.handled, true, `delete_route_must_handle_${forbiddenField}`);
  assert.equal(rejected.res.statusCode, 400, `delete_route_must_reject_${forbiddenField}`);
  assert.equal(deleteCalls.length, 1, `delete_route_must_not_call_provisioner_for_${forbiddenField}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v20_32_user_resource_binding",
}, null, 2));
