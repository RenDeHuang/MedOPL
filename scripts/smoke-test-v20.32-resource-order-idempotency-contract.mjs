import assert from "node:assert/strict";

import { createResourceOrderRoutes } from "../services/portal/src/routes/resource-order.routes.mjs";

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

function slugify(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}

function defaultTaskTitle(taskSlug) {
  return taskSlug || "default";
}

async function ensureTaskSpace(db, user, taskSlug, title) {
  db.taskSpaces = Array.isArray(db.taskSpaces) ? db.taskSpaces : [];
  const existing = db.taskSpaces.find((item) => item.userId === user.id && item.slug === taskSlug);
  if (existing) return existing;
  const created = {
    id: `ts-${taskSlug}`,
    userId: user.id,
    tenantId: user.tenantId || user.id,
    slug: taskSlug,
    title,
    status: "active",
    path: `/tmp/${taskSlug}`,
    createdAt: "2026-05-04T12:00:00.000Z",
    updatedAt: "2026-05-04T12:00:00.000Z",
  };
  db.taskSpaces.push(created);
  return created;
}

async function persistResourceOrderState() {
  return { ok: true };
}

async function upsertTaskSpace() {
  return { ok: true };
}

function createRoute({ provisionCalls, plan }) {
  return createResourceOrderRoutes({
    defaultTaskTitle,
    ensureTaskSpace,
    fetchServerPlans: async () => ({ ok: true, items: [plan] }),
    logPortalEvent: async () => ({ ok: true }),
    markWorkspaceStorageDeleting: async () => ({ ok: true, storageOrderIds: [], workspaceFileIds: [] }),
    normalizeAuthEmail: (value) => String(value || "").trim().toLowerCase(),
    portalInternalAuthAllowed: () => false,
    readJsonBody,
    resourceProvisionerClient: {
      async startProvision(input) {
        provisionCalls.push(input);
        return {
          ok: true,
          order: {
            status: "ready",
            requestId: `req-${provisionCalls.length}`,
            nodePoolId: `np-${provisionCalls.length}`,
          },
        };
      },
      async fetchCloudResources() {
        return { ok: true, items: [] };
      },
      async scaleToZero() {
        throw new Error("scale_to_zero_not_expected");
      },
      async deleteNodePool() {
        throw new Error("delete_node_pool_not_expected");
      },
    },
    sendJson,
    slugify,
    writeDb: {
      persistResourceOrderState,
      upsertTaskSpace,
    },
  });
}

async function request(route, { method, path, body = "", db, user, headers = {} }) {
  const res = createResponseRecorder();
  const handled = await route({
    req: { method, body, headers },
    res,
    url: new URL(path, "http://portal.local"),
    db,
    user,
  });
  return { handled, res };
}

const runId = "run-test-v20-32-moqnmlv5-1bf407";
const workspaceId = "case-a";
const plan = {
  id: "plan-gpu-a",
  name: "GPU A",
  region: "ap-shanghai",
  zone: "ap-shanghai-1",
  cpu: 8,
  memoryGb: 32,
  gpuType: "L20",
  gpuCount: 1,
  unitPrice: 12.5,
  discountPrice: 12.5,
  currency: "CNY",
  minBillableHours: 1,
  riskFactor: 1,
  reservationFloor: 0,
  pricingSource: "contract-fixture",
  provisioningMode: "tke_node_pool_create",
};

const db = {
  users: [{ id: "tenant-1", tenantId: "tenant-1", email: "tenant-1@example.com" }],
  groups: [],
  wallets: [{ userId: "tenant-1", balance: 1000, updatedAt: "2026-05-04T12:00:00.000Z" }],
  taskSpaces: [],
  resourceOrders: [],
  resourceOrderEvents: [],
  ledger: [],
  storageOrders: [],
  workspaceFiles: [],
};

const user = { id: "tenant-1", tenantId: "tenant-1", email: "tenant-1@example.com" };
const provisionCalls = [];
const route = createRoute({ provisionCalls, plan });

const firstFreeze = await request(route, {
  method: "POST",
  path: "/portal/api/resource-orders/freeze",
  body: JSON.stringify({
    task: workspaceId,
    workspaceId,
    serverPlanId: plan.id,
    runId,
    storageSizeGb: 50,
  }),
  db,
  user,
});

assert.equal(firstFreeze.handled, true, "first_freeze_route_must_be_handled");
assert.equal(firstFreeze.res.statusCode, 200, "first_freeze_must_return_200");
assert.equal(firstFreeze.res.payload?.order?.status, "frozen", "first_freeze_must_create_frozen_order");

const firstOrderId = String(firstFreeze.res.payload?.resourceOrderId || "");
assert.ok(firstOrderId, "first_freeze_must_return_order_id");

const firstProvision = await request(route, {
  method: "POST",
  path: "/portal/api/resource-orders/provision",
  body: JSON.stringify({
    resourceOrderId: firstOrderId,
    runId,
  }),
  db,
  user,
});

assert.equal(firstProvision.handled, true, "first_provision_route_must_be_handled");
assert.equal(firstProvision.res.statusCode, 200, "first_provision_must_return_200");
assert.equal(firstProvision.res.payload?.order?.status, "running", "first_provision_must_transition_to_running");
assert.equal(provisionCalls.length, 1, "first_provision_must_call_provisioner_once");
assert.equal(db.resourceOrders.length, 1, "first_flow_must_only_have_one_order");

const duplicateQuote = await request(route, {
  method: "POST",
  path: "/portal/api/resource-orders/quote",
  body: JSON.stringify({
    task: workspaceId,
    workspaceId,
    serverPlanId: plan.id,
    runId,
    storageSizeGb: 50,
  }),
  db,
  user,
});

assert.equal(duplicateQuote.handled, true, "duplicate_quote_route_must_be_handled");
assert.equal(duplicateQuote.res.statusCode, 200, "duplicate_quote_must_return_200");
assert.equal(
  duplicateQuote.res.payload?.resourceOrderId,
  firstOrderId,
  "same_user_workspace_run_server_plan_must_reuse_running_order_instead_of_creating_second_order",
);
assert.equal(
  db.resourceOrders.length,
  1,
  "same_user_workspace_run_server_plan_must_not_create_second_resource_order",
);

const duplicateProvision = await request(route, {
  method: "POST",
  path: "/portal/api/resource-orders/provision",
  body: JSON.stringify({
    resourceOrderId: firstOrderId,
    runId,
  }),
  db,
  user,
});

assert.equal(duplicateProvision.handled, true, "duplicate_provision_route_must_be_handled");
assert.equal(duplicateProvision.res.statusCode, 200, "duplicate_provision_must_return_200");
assert.equal(
  provisionCalls.length,
  1,
  "same_user_workspace_run_server_plan_must_not_call_provisioner_twice_for_existing_running_order",
);

const provisioningOrderId = "order-provisioning-a";
db.resourceOrders.push({
  id: provisioningOrderId,
  tenantId: user.tenantId,
  userId: user.id,
  portalUserId: user.id,
  workspaceId: "case-b",
  workspaceSessionId: "",
  runId: "run-case-b",
  billingAccountId: user.id,
  status: "provisioning",
  serverPlanId: plan.id,
  region: plan.region,
  zone: plan.zone,
  cpu: plan.cpu,
  memoryGb: plan.memoryGb,
  gpuType: plan.gpuType,
  gpuCount: plan.gpuCount,
  storagePlanId: "workspace-default",
  storageSizeGb: 50,
  retentionPolicy: "retain",
  estimatedHours: 1,
  autoStopAt: "",
  quoteId: "quote-provisioning-a",
  freezeId: "freeze-provisioning-a",
  provisionRequestId: "",
  cloudResourceIds: [],
  currency: plan.currency,
  unitPrice: plan.unitPrice,
  minBillableHours: 1,
  riskFactor: 1,
  quoteAmount: 12.5,
  freezeAmount: 15,
  exactCost: null,
  pricingSource: "contract-fixture",
  priceUpdatedAt: "2026-05-04T12:00:00.000Z",
  idempotencyKey: "manual-provisioning-order",
  createdAt: "2026-05-04T12:00:00.000Z",
  updatedAt: "2026-05-04T12:00:00.000Z",
  settledAt: "",
  pendingStoppedAt: "",
  billingStoppedAt: "",
  failedReason: "",
});

const duplicateProvisioning = await request(route, {
  method: "POST",
  path: "/portal/api/resource-orders/provision",
  body: JSON.stringify({
    resourceOrderId: provisioningOrderId,
    runId: "run-case-b",
  }),
  db,
  user,
});

assert.equal(duplicateProvisioning.handled, true, "duplicate_provisioning_route_must_be_handled");
assert.equal(duplicateProvisioning.res.statusCode, 200, "duplicate_provisioning_must_return_200");
assert.equal(
  provisionCalls.length,
  1,
  "same_user_workspace_run_server_plan_must_not_call_provisioner_twice_for_existing_provisioning_order",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v20_32_resource_order_idempotency",
  resourceOrderId: firstOrderId,
  provisionCalls: provisionCalls.length,
}, null, 2));
