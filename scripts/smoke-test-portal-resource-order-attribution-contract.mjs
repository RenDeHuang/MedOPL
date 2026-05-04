import assert from "node:assert/strict";

const { createResourceOrderRoutes } = await import("../services/portal/src/routes/resource-order.routes.mjs");

function createResponseRecorder() {
  return { statusCode: null, payload: null };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

function createRequest(method, path, body = {}) {
  const raw = JSON.stringify(body);
  return {
    req: {
      method,
      headers: {},
      [Symbol.asyncIterator]: async function* iterator() {
        yield Buffer.from(raw);
      },
    },
    res: createResponseRecorder(),
    url: new URL(path, "http://portal.local"),
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const db = {
  users: [{ id: "tenant-1", email: "tenant@example.test", role: "user", status: "active", currentTaskSlug: "analysis" }],
  wallets: [{ userId: "tenant-1", balance: 100 }],
  ledger: [],
  resourceOrders: [],
  resourceOrderEvents: [],
  taskSpaces: [{ slug: "analysis", userId: "tenant-1", title: "Analysis" }],
  storageOrders: [{
    id: "storage-order-1",
    tenantId: "tenant-1",
    userId: "tenant-1",
    workspaceId: "analysis",
    status: "active",
    storageSizeGb: 10,
    cosPrefix: "workspaces/tenant-1/analysis/",
  }],
  workspaceFiles: [{
    id: "workspace-file-1",
    tenantId: "tenant-1",
    userId: "tenant-1",
    workspaceId: "analysis",
    runId: "run-attribution-1",
    kind: "inputs",
    name: "input.txt",
    relativePath: "input.txt",
    storageKey: "workspaces/tenant-1/analysis/inputs/input.txt",
    status: "active",
  }],
  groups: [],
};

const provisionerCalls = [];
const writes = [];
const user = db.users[0];
const plan = {
  id: "cpu-2c4g",
  name: "CPU 2C4G",
  region: "na-siliconvalley",
  zone: "na-siliconvalley-1",
  instanceType: "SA5.MEDIUM4",
  cpu: 2,
  memoryGb: 4,
  hourlyPrice: 0.05,
  discountPrice: 0.05,
  currency: "CNY",
  minBillableHours: 1,
  riskFactor: 1,
  provisioningMode: "tke_node_pool_create",
};

const writeDb = {
  upsertTaskSpace: async (taskSpace) => writes.push(["task_space", taskSpace.slug]),
  persistResourceOrderState: async ({ order, orderId }) => writes.push(["resource_order", order?.id || orderId]),
};

const route = createResourceOrderRoutes({
  defaultTaskTitle: (slug) => `Task ${slug}`,
  ensureTaskSpace: async () => db.taskSpaces[0],
  fetchServerPlans: async () => ({ ok: true, items: [plan] }),
  logPortalEvent: async () => {},
  normalizeAuthEmail: (value) => String(value || "").trim().toLowerCase(),
  portalInternalAuthAllowed: () => true,
  readJsonBody,
  resourceProvisionerClient: {
    startProvision: async (payload) => {
      provisionerCalls.push(payload);
      return {
        ok: true,
        accepted: true,
        order: {
          id: "provisioner-order-1",
          status: "provisioning",
          resourceOrderId: payload.resourceOrderId,
          requestId: "req-attribution-1",
        },
      };
    },
    fetchCloudResources: async () => ({ ok: true }),
    scaleToZero: async () => ({ ok: true }),
    deleteNodePool: async () => ({ ok: true }),
  },
  sendJson,
  slugify: (value) => String(value || "").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "default",
  writeDb,
});

async function request(method, path, body) {
  const context = createRequest(method, path, body);
  const handled = await route({ ...context, db, user });
  return { handled, res: context.res };
}

const freeze = await request("POST", "/portal/api/resource-orders/freeze", {
  task: "analysis",
  serverPlanId: "cpu-2c4g",
  runId: "run-attribution-1",
  storageSizeGb: 10,
});

assert.equal(freeze.handled, true, "freeze_route_must_handle");
assert.equal(freeze.res.statusCode, 200, "freeze_must_return_200");
assert.equal(freeze.res.payload.order.status, "frozen", "freeze_must_create_frozen_order");
assert.ok(freeze.res.payload.order.freezeId, "freeze_must_return_preauth_ledger_id");

const provision = await request("POST", "/portal/api/resource-orders/provision", {
  resourceOrderId: freeze.res.payload.resourceOrderId,
  runId: "run-attribution-1",
});

assert.equal(provision.handled, true, "provision_route_must_handle");
assert.equal(provision.res.statusCode, 200, "provision_must_return_200");
assert.equal(provisionerCalls.length, 1, "provisioner_must_be_called_once");

const payload = provisionerCalls[0];
assert.deepEqual(payload.ledgerIds, [freeze.res.payload.order.freezeId], "provision_payload_must_include_preauth_ledger_id");
assert.deepEqual(payload.cosKeys, [
  "workspaces/tenant-1/analysis/",
  "workspaces/tenant-1/analysis/inputs/input.txt",
], "provision_payload_must_include_workspace_storage_prefix_and_file_keys");

const deleteProvisionerCalls = [];
const scaleProvisionerCalls = [];
const routeWithDeleteGuard = createResourceOrderRoutes({
  defaultTaskTitle: (slug) => `Task ${slug}`,
  ensureTaskSpace: async () => db.taskSpaces[0],
  fetchServerPlans: async () => ({ ok: true, items: [plan] }),
  logPortalEvent: async () => {},
  normalizeAuthEmail: (value) => String(value || "").trim().toLowerCase(),
  portalInternalAuthAllowed: () => true,
  readJsonBody,
  resourceProvisionerClient: {
    startProvision: async () => ({ ok: true }),
    fetchCloudResources: async () => ({ ok: true }),
    scaleToZero: async (input) => {
      scaleProvisionerCalls.push(input);
      return { ok: true };
    },
    deleteNodePool: async (input) => {
      deleteProvisionerCalls.push(input);
      return { ok: true };
    },
  },
  sendJson,
  slugify: (value) => String(value || "").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "default",
  writeDb,
});

db.resourceOrders.push({
  id: "order-delete-a",
  tenantId: "tenant-1",
  userId: "tenant-1",
  workspaceId: "analysis",
  status: "running",
  serverPlanId: "cpu-2c4g",
  cloudResourceIds: ["np-a"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

db.resourceOrders.push({
  id: "order-delete-b",
  tenantId: "tenant-1",
  userId: "tenant-1",
  workspaceId: "analysis",
  status: "running",
  serverPlanId: "cpu-2c4g",
  cloudResourceIds: ["np-b"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

db.resourceOrders.push({
  id: "order-delete-no-pool",
  tenantId: "tenant-1",
  userId: "tenant-1",
  workspaceId: "analysis",
  status: "running",
  serverPlanId: "cpu-2c4g",
  cloudResourceIds: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

async function requestDelete(body) {
  const context = createRequest("POST", "/portal/api/resource-orders/delete-node-pool", body);
  const handled = await routeWithDeleteGuard({ ...context, db, user });
  return { handled, res: context.res };
}

const wrongNodePoolDelete = await requestDelete({
  resourceOrderId: "order-delete-a",
  nodePoolId: "np-b",
  confirmDeleteNodePool: true,
});
assert.equal(wrongNodePoolDelete.handled, true, "delete_route_must_handle_wrong_nodepool_request");
assert.equal(wrongNodePoolDelete.res.statusCode, 400, "delete_must_reject_client_supplied_nodepool");
assert.equal(wrongNodePoolDelete.res.payload.error, "delete_node_pool_client_resource_ids_forbidden", "delete_must_reject_client_cloud_resource_id_fields");

const missingNodePoolDelete = await requestDelete({
  resourceOrderId: "order-delete-no-pool",
  confirmDeleteNodePool: true,
});
assert.equal(missingNodePoolDelete.handled, true, "delete_route_must_handle_missing_nodepool_request");
assert.equal(missingNodePoolDelete.res.statusCode, 422, "delete_must_reject_when_nodepool_missing_in_payload_and_order");
assert.equal(deleteProvisionerCalls.length, 0, "delete_negative_cases_must_not_call_provisioner");

async function requestRelease(body) {
  const context = createRequest("POST", "/portal/api/resource-orders/release", body);
  const handled = await routeWithDeleteGuard({ ...context, db, user });
  return { handled, res: context.res };
}

const wrongNodePoolRelease = await requestRelease({
  resourceOrderId: "order-delete-a",
  nodePoolId: "np-b",
  scaleToZero: true,
});
assert.equal(wrongNodePoolRelease.handled, true, "release_route_must_handle_wrong_nodepool_request");
assert.equal(wrongNodePoolRelease.res.statusCode, 409, "release_must_reject_mismatched_nodepool");

const missingNodePoolRelease = await requestRelease({
  resourceOrderId: "order-delete-no-pool",
  scaleToZero: true,
});
assert.equal(missingNodePoolRelease.handled, true, "release_route_must_handle_missing_nodepool_request");
assert.equal(missingNodePoolRelease.res.statusCode, 422, "release_must_reject_when_nodepool_missing_in_payload_and_order");

for (const forbiddenField of [
  "nodePoolIds",
  "instanceIds",
  "cvmInstanceId",
  "nodePoolIdSet",
]) {
  const rejected = await requestDelete({
    resourceOrderId: "order-delete-a",
    confirmDeleteNodePool: true,
    [forbiddenField]: forbiddenField,
  });
  assert.equal(rejected.handled, true, `delete_route_must_handle_${forbiddenField}`);
  assert.equal(rejected.res.statusCode, 400, `delete_route_must_reject_${forbiddenField}`);
  assert.equal(rejected.res.payload.error, "delete_node_pool_client_resource_ids_forbidden", `delete_must_reject_${forbiddenField}_as_client_resource_id_alias`);
}
assert.equal(scaleProvisionerCalls.length, 0, "release_negative_cases_must_not_call_provisioner");

console.log(JSON.stringify({
  ok: true,
  resourceOrderId: freeze.res.payload.resourceOrderId,
  ledgerIds: payload.ledgerIds,
  cosKeys: payload.cosKeys,
  deleteGuardChecks: {
    clientNodePoolStatus: wrongNodePoolDelete.res.statusCode,
    missingNodePoolStatus: missingNodePoolDelete.res.statusCode,
    deleteProvisionerCalls: deleteProvisionerCalls.length,
    wrongScaleNodePoolStatus: wrongNodePoolRelease.res.statusCode,
    missingScaleNodePoolStatus: missingNodePoolRelease.res.statusCode,
    scaleProvisionerCalls: scaleProvisionerCalls.length,
  },
  writes: writes.length,
}, null, 2));
