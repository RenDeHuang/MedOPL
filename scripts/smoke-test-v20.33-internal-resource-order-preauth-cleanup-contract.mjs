import assert from "node:assert/strict";

import { createResourceOrderRoutes } from "../services/portal/src/routes/resource-order.routes.mjs";
import { activeFreezeAmount } from "../services/portal/src/domain/wallet-ledger.mjs";

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

async function request(route, { method, path, body = "", db, headers = {} }) {
  const res = createResponseRecorder();
  const handled = await route({
    req: { method, body, headers },
    res,
    url: new URL(path, "http://portal.local"),
    db,
    user: null,
  });
  return { handled, res };
}

const persistCalls = [];
const forbiddenProvisionerCalls = [];

const route = createResourceOrderRoutes({
  defaultTaskTitle: (slug) => slug || "default",
  ensureTaskSpace: async () => {
    throw new Error("ensure_task_space_not_expected");
  },
  fetchServerPlans: async () => ({ ok: true, items: [] }),
  logPortalEvent: async () => ({ ok: true }),
  markWorkspaceStorageDeleting: async () => {
    throw new Error("workspace_storage_mutation_not_expected");
  },
  normalizeAuthEmail: (value) => String(value || "").trim().toLowerCase(),
  portalInternalAuthAllowed: () => true,
  readJsonBody,
  resourceProvisionerClient: {
    async startProvision() {
      forbiddenProvisionerCalls.push("startProvision");
      throw new Error("start_provision_not_expected");
    },
    async fetchCloudResources() {
      forbiddenProvisionerCalls.push("fetchCloudResources");
      throw new Error("fetch_cloud_resources_not_expected");
    },
    async scaleToZero() {
      forbiddenProvisionerCalls.push("scaleToZero");
      throw new Error("scale_to_zero_not_expected");
    },
    async deleteNodePool() {
      forbiddenProvisionerCalls.push("deleteNodePool");
      throw new Error("delete_node_pool_not_expected");
    },
  },
  sendJson,
  slugify: (value) => String(value || "").trim().toLowerCase(),
  writeDb: {
    async persistResourceOrderState({ order, orderId }) {
      persistCalls.push({ orderId: order?.id || orderId, status: order?.status || "" });
      return { ok: true };
    },
  },
});

const orderId = "order-v20-33-frozen-cleanup";
const userId = "user-v20-33-frozen-cleanup";
const db = {
  users: [{ id: userId, tenantId: userId, email: "cleanup@example.test" }],
  wallets: [{ userId, balance: 100, updatedAt: "2026-05-05T02:00:00.000Z" }],
  resourceOrders: [{
    id: orderId,
    tenantId: userId,
    userId,
    portalUserId: userId,
    workspaceId: "workspace-v20-33-cleanup",
    workspaceSessionId: "",
    runId: "run-v20-33-cleanup",
    billingAccountId: userId,
    status: "frozen",
    serverPlanId: "plan-cleanup",
    region: "ap-shanghai",
    zone: "ap-shanghai-1",
    cpu: 2,
    memoryGb: 4,
    gpuType: "",
    gpuCount: 0,
    storagePlanId: "workspace-default",
    storageSizeGb: 10,
    retentionPolicy: "retain",
    estimatedHours: 1,
    autoStopAt: "",
    quoteId: "quote-v20-33-cleanup",
    freezeId: "ledger-hold-v20-33-cleanup",
    provisionRequestId: "",
    cloudResourceIds: [],
    currency: "CNY",
    unitPrice: 47,
    minBillableHours: 1,
    riskFactor: 1,
    quoteAmount: 47,
    freezeAmount: 47,
    exactCost: null,
    pricingSource: "contract-fixture",
    priceUpdatedAt: "2026-05-05T02:00:00.000Z",
    idempotencyKey: "resource-order-cleanup-contract",
    createdAt: "2026-05-05T02:00:00.000Z",
    updatedAt: "2026-05-05T02:00:00.000Z",
    settledAt: "",
    pendingStoppedAt: "",
    billingStoppedAt: "",
    failedReason: "",
  }],
  resourceOrderEvents: [],
  ledger: [{
    id: "ledger-hold-v20-33-cleanup",
    tenantId: userId,
    userId,
    workspaceId: "workspace-v20-33-cleanup",
    runId: "run-v20-33-cleanup",
    resourceOrderId: orderId,
    orderId,
    billingAccountId: userId,
    type: "preauth_hold",
    amount: 47,
    currency: "CNY",
    sourceType: "quote",
    sourceId: "quote-v20-33-cleanup",
    idempotencyKey: "preauth_hold:order-v20-33-frozen-cleanup",
    reason: "resource_order_preauth_hold",
    operatorId: userId,
    createdAt: "2026-05-05T02:00:00.000Z",
  }],
};

assert.equal(activeFreezeAmount(db, userId), 47, "contract_fixture_must_start_with_active_freeze");

const cleanup = await request(route, {
  method: "POST",
  path: "/portal/internal/resource-orders/release",
  body: JSON.stringify({
    resourceOrderId: orderId,
    runId: "run-v20-33-cleanup",
    releasePreauth: true,
    idempotencyKey: "cleanup-preauth-release-once",
  }),
  db,
});

assert.equal(cleanup.handled, true, "internal_cleanup_release_must_be_handled");
assert.equal(cleanup.res.statusCode, 200, "internal_cleanup_release_must_return_200");
assert.equal(cleanup.res.payload?.order?.status, "released", "internal_cleanup_release_must_mark_order_released");
assert.equal(activeFreezeAmount(db, userId), 0, "internal_cleanup_release_must_clear_active_freeze");
assert.equal(
  db.ledger.filter((entry) => entry.type === "preauth_release" && entry.resourceOrderId === orderId).length,
  1,
  "internal_cleanup_release_must_write_single_preauth_release_ledger",
);
assert.equal(
  db.ledger.find((entry) => entry.type === "preauth_release" && entry.resourceOrderId === orderId)?.amount,
  47,
  "internal_cleanup_release_must_release_full_active_preauth_amount",
);
assert.deepEqual(forbiddenProvisionerCalls, [], "internal_cleanup_release_must_not_call_cloud_provisioner");
assert.equal(persistCalls.length, 1, "internal_cleanup_release_must_persist_resource_order_state_once");

const repeatedCleanup = await request(route, {
  method: "POST",
  path: "/portal/internal/resource-orders/release",
  body: JSON.stringify({
    resourceOrderId: orderId,
    runId: "run-v20-33-cleanup",
    releasePreauth: true,
    idempotencyKey: "cleanup-preauth-release-once",
  }),
  db,
});

assert.equal(repeatedCleanup.handled, true, "repeated_internal_cleanup_release_must_be_handled");
assert.equal(repeatedCleanup.res.statusCode, 200, "repeated_internal_cleanup_release_must_return_200");
assert.equal(
  db.ledger.filter((entry) => entry.type === "preauth_release" && entry.resourceOrderId === orderId).length,
  1,
  "repeated_internal_cleanup_release_must_not_duplicate_preauth_release_ledger",
);
assert.deepEqual(forbiddenProvisionerCalls, [], "repeated_internal_cleanup_release_must_not_call_cloud_provisioner");

console.log(JSON.stringify({
  ok: true,
  contract: "v20_33_internal_resource_order_preauth_cleanup",
  resourceOrderId: orderId,
  activeFreeze: activeFreezeAmount(db, userId),
}, null, 2));
