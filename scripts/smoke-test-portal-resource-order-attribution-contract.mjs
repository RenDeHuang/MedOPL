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
  writeDb: async (targetDb) => writes.push(targetDb),
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

console.log(JSON.stringify({
  ok: true,
  resourceOrderId: freeze.res.payload.resourceOrderId,
  ledgerIds: payload.ledgerIds,
  cosKeys: payload.cosKeys,
  writes: writes.length,
}, null, 2));
