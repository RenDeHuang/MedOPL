import assert from "node:assert/strict";

const { releaseResourceOrder } = await import("../services/portal/src/domain/resource-orders.mjs");
const { createPortalResourceOrderStore } = await import("../services/portal/src/state/portal-resource-order-store.mjs");
const { writePortalPostgresSnapshot } = await import("../services/portal/src/state/portal-store-postgres-persistence.mjs");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rowUpdatedAt(row = {}) {
  return Date.parse(String(row.updated_at || row.created_at || "1970-01-01T00:00:00.000Z"));
}

function resourceOrderRow(params = []) {
  return {
    id: params[0],
    tenant_id: params[1],
    user_id: params[2],
    portal_user_id: params[3],
    workspace_id: params[4],
    workspace_session_id: params[5],
    run_id: params[6],
    status: params[7],
    server_plan_id: params[8],
    region: params[9],
    zone: params[10],
    cpu: params[11],
    memory_gb: params[12],
    gpu_type: params[13],
    gpu_count: params[14],
    storage_plan_id: params[15],
    storage_size_gb: params[16],
    retention_policy: params[17],
    estimated_hours: params[18],
    auto_stop_at: params[19],
    quote_id: params[20],
    freeze_id: params[21],
    provision_request_id: params[22],
    cloud_resource_ids_json: typeof params[23] === "string" ? JSON.parse(params[23] || "[]") : params[23],
    currency: params[24],
    unit_price: params[25],
    min_billable_hours: params[26],
    risk_factor: params[27],
    quote_amount: params[28],
    freeze_amount: params[29],
    exact_cost: params[30],
    pricing_source: params[31],
    price_updated_at: params[32],
    idempotency_key: params[33],
    failed_reason: params[34],
    created_at: params[35],
    updated_at: params[36],
    settled_at: params[37],
  };
}

function ledgerRow(params = []) {
  return {
    id: params[0],
    tenant_id: params[1],
    user_id: params[2],
    run_id: params[3],
    workspace_id: params[4],
    order_id: params[5],
    type: params[6],
    amount: params[7],
    currency: params[8],
    source_type: params[9],
    source_id: params[10],
    idempotency_key: params[11],
    reason: params[12],
    operator_id: params[13],
    created_at: params[14],
  };
}

function eventRow(params = []) {
  return {
    id: params[0],
    order_id: params[1],
    event_type: params[2],
    event_payload_json: typeof params[3] === "string" ? JSON.parse(params[3] || "{}") : params[3],
    actor_type: params[4],
    actor_id: params[5],
    idempotency_key: params[6],
    created_at: params[7],
  };
}

function upsertById(rows, row, { preserveNewerUpdatedAt = false } = {}) {
  const index = rows.findIndex((item) => item.id === row.id);
  if (index < 0) {
    rows.push(row);
    return;
  }
  if (preserveNewerUpdatedAt && rowUpdatedAt(row) < rowUpdatedAt(rows[index])) {
    return;
  }
  rows[index] = { ...rows[index], ...row };
}

function createFakePool(initialState) {
  const state = clone(initialState);

  function tableFromSql(sql = "") {
    const match = String(sql).match(/portal_([a-z_]+)/);
    return match?.[1] || "";
  }

  function tableRows(targetState, table) {
    if (!Array.isArray(targetState[table])) targetState[table] = [];
    return targetState[table];
  }

  async function runQuery(targetState, sql, params = []) {
    const text = String(sql || "");
    if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") return { rows: [] };
    const table = tableFromSql(text);
    if (text.includes("SELECT id FROM") && text.includes("idempotency_key")) {
      const found = tableRows(targetState, table).find((row) => row.idempotency_key === params[0]);
      return { rows: found ? [{ id: found.id }] : [] };
    }
    if (text.includes("DELETE FROM")) {
      targetState[table] = [];
      return { rows: [], rowCount: 0 };
    }
    if (text.includes("INSERT INTO") && table === "resource_orders") {
      const preserveNewerUpdatedAt = text.includes("updated_at <= EXCLUDED.updated_at");
      upsertById(tableRows(targetState, table), resourceOrderRow(params), { preserveNewerUpdatedAt });
      return { rows: [], rowCount: 1 };
    }
    if (text.includes("INSERT INTO") && table === "ledger_entries") {
      upsertById(tableRows(targetState, table), ledgerRow(params));
      return { rows: [], rowCount: 1 };
    }
    if (text.includes("INSERT INTO") && table === "resource_order_events") {
      upsertById(tableRows(targetState, table), eventRow(params));
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  }

  return {
    state,
    async connect() {
      let txState = null;
      return {
        async query(sql, params = []) {
          if (sql === "BEGIN") {
            txState = clone(state);
            return { rows: [] };
          }
          if (sql === "ROLLBACK") {
            txState = null;
            return { rows: [] };
          }
          if (sql === "COMMIT") {
            Object.assign(state, txState);
            txState = null;
            return { rows: [] };
          }
          return runQuery(txState || state, sql, params);
        },
        release() {},
      };
    },
    async query(sql, params = []) {
      return runQuery(state, sql, params);
    },
  };
}

function createFakeRedis() {
  return {
    async keys() {
      return [];
    },
    async mGet() {
      return [];
    },
    async set() {
      return "OK";
    },
  };
}

const createdAt = "2026-05-05T00:00:00.000Z";
const staleUpdatedAt = "2026-05-05T00:01:00.000Z";
const targetOrderId = "order-v20-33-snapshot-regression";
const user = { id: "user-v20-33-snapshot-regression" };
const initialDb = {
  users: [user],
  sessions: [],
  wallets: [{ userId: user.id, balance: 0, updatedAt: createdAt }],
  ledger: [{
    id: "ledger-hold",
    tenantId: user.id,
    userId: user.id,
    workspaceId: "workspace-v20-33",
    runId: "run-v20-33",
    resourceOrderId: targetOrderId,
    orderId: targetOrderId,
    type: "preauth_hold",
    amount: 0.47,
    currency: "CNY",
    sourceType: "quote",
    sourceId: "quote-v20-33",
    idempotencyKey: "preauth_hold:order-v20-33-snapshot-regression",
    reason: "resource_order_preauth_hold",
    operatorId: user.id,
    createdAt,
  }],
  taskSpaces: [],
  workspaceSessions: [],
  resourceOrders: [{
    id: targetOrderId,
    tenantId: user.id,
    userId: user.id,
    portalUserId: user.id,
    workspaceId: "workspace-v20-33",
    workspaceSessionId: "workspace-session-v20-33",
    runId: "run-v20-33",
    status: "frozen",
    serverPlanId: "plan-v20-33",
    region: "ap-shanghai",
    zone: "ap-shanghai-1",
    cpu: 1,
    memoryGb: 2,
    gpuType: "",
    gpuCount: 0,
    storagePlanId: "workspace-default",
    storageSizeGb: 10,
    retentionPolicy: "retain",
    estimatedHours: 1,
    autoStopAt: "",
    quoteId: "quote-v20-33",
    freezeId: "ledger-hold",
    provisionRequestId: "",
    cloudResourceIds: [],
    currency: "CNY",
    unitPrice: 0.39,
    minBillableHours: 1,
    riskFactor: 1,
    quoteAmount: 0.39,
    freezeAmount: 0.47,
    exactCost: null,
    pricingSource: "contract",
    priceUpdatedAt: createdAt,
    idempotencyKey: "quote:order-v20-33-snapshot-regression",
    failedReason: "",
    createdAt,
    updatedAt: staleUpdatedAt,
    settledAt: "",
  }],
  resourceOrderEvents: [{
    id: "event-frozen",
    orderId: targetOrderId,
    eventType: "frozen",
    eventPayload: {},
    actorType: "portal",
    actorId: user.id,
    idempotencyKey: `event:frozen:${targetOrderId}`,
    createdAt,
  }],
  storageOrders: [],
  workspaceFiles: [],
  labSubscriptions: [],
  labPackageEvents: [],
  labStorageAddons: [],
  labDailyCharges: [],
  userSandboxes: [],
  groups: [],
  settings: {},
};

const pool = createFakePool({
  resource_orders: [resourceOrderRow([
    targetOrderId, user.id, user.id, user.id, "workspace-v20-33", "workspace-session-v20-33", "run-v20-33", "frozen",
    "plan-v20-33", "ap-shanghai", "ap-shanghai-1", 1, 2, "", 0, "workspace-default", 10, "retain", 1, "",
    "quote-v20-33", "ledger-hold", "", [], "CNY", 0.39, 1, 1, 0.39, 0.47, null, "contract", createdAt,
    "quote:order-v20-33-snapshot-regression", "", createdAt, staleUpdatedAt, null,
  ])],
  ledger_entries: [ledgerRow([
    "ledger-hold", user.id, user.id, "run-v20-33", "workspace-v20-33", targetOrderId, "preauth_hold", 0.47,
    "CNY", "quote", "quote-v20-33", "preauth_hold:order-v20-33-snapshot-regression", "resource_order_preauth_hold", user.id, createdAt,
  ])],
  resource_order_events: [eventRow([
    "event-frozen", targetOrderId, "frozen", {}, "portal", user.id, `event:frozen:${targetOrderId}`, createdAt,
  ])],
});

const resourceOrderStore = createPortalResourceOrderStore({
  pool,
  pgTableName: (name) => `portal_${name}`,
});
const releasedDb = clone(initialDb);
const released = releaseResourceOrder(releasedDb, {
  user,
  orderId: targetOrderId,
  actorType: "runner",
  actorId: "cleanup-run-v20-33",
  payload: { runId: "cleanup-run-v20-33" },
  idempotencyKey: `v20.33-l5-cleanup:${targetOrderId}`,
  releasePreauth: true,
});

assert.equal(released.ok, true);
assert.equal(released.order.status, "released");
await resourceOrderStore.persistResourceOrderState({ db: releasedDb, order: released.order, orderId: targetOrderId });

assert.equal(pool.state.resource_orders.find((row) => row.id === targetOrderId)?.status, "released");
assert(
  pool.state.ledger_entries.some((row) => row.order_id === targetOrderId && row.type === "preauth_release"),
  "release_persist_must_write_preauth_release_before_snapshot_regression_check",
);

await writePortalPostgresSnapshot({
  pool,
  redis: createFakeRedis(),
  pgTableName: (name) => `portal_${name}`,
  namespace: "portal",
  db: clone(initialDb),
  normalizeLedgerEntries: (entries) => entries,
  normalizeServerPlanSelection: (value) => value || {},
  atomicWriteJson: async () => {},
  dataFile: "/tmp/unused-v20.33-resource-order-snapshot-regression.json",
});

const finalOrder = pool.state.resource_orders.find((row) => row.id === targetOrderId);
assert.equal(finalOrder?.status, "released", `snapshot_writer_must_not_regress_released_order:${finalOrder?.status || "missing"}`);
assert(
  pool.state.ledger_entries.some((row) => row.order_id === targetOrderId && row.type === "preauth_release"),
  "snapshot_writer_must_not_delete_incremental_preauth_release",
);

console.log(JSON.stringify({ ok: true, contract: "v20.33-resource-order-snapshot-regression" }, null, 2));
