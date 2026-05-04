import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeSource = await readFile("services/portal/src/routes/admin-user.routes.mjs", "utf8");
const storeSource = await readFile("services/portal/src/state/portal-store.mjs", "utf8");

const { createPortalAccountingStore } = await import("../services/portal/src/state/portal-accounting-store.mjs");

function cloneRow(row) {
  return JSON.parse(JSON.stringify(row));
}

function createFakePool() {
  const state = {
    wallets: [{ user_id: "user-1", balance: 100, updated_at: "2026-05-03T00:00:00.000Z" }],
    ledger_entries: [],
    audit_events: [],
  };

  return {
    state,
    async connect() {
      let txState = null;
      return {
        async query(sql, params = []) {
          if (sql === "BEGIN") {
            txState = {
              wallets: state.wallets.map(cloneRow),
              ledger_entries: state.ledger_entries.map(cloneRow),
              audit_events: state.audit_events.map(cloneRow),
            };
            return { rows: [] };
          }
          if (sql === "ROLLBACK") {
            txState = null;
            return { rows: [] };
          }
          if (sql === "COMMIT") {
            state.wallets = txState.wallets;
            state.ledger_entries = txState.ledger_entries;
            state.audit_events = txState.audit_events;
            txState = null;
            return { rows: [] };
          }
          if (sql.includes("SELECT id FROM")) {
            const found = txState.ledger_entries.find((entry) => entry.idempotency_key === params[0]);
            return { rows: found ? [{ id: found.id }] : [] };
          }
          if (sql.includes("UPDATE") && sql.includes("wallets")) {
            const amount = Number(params[0]);
            const wallet = txState.wallets.find((entry) => entry.user_id === params[1]);
            wallet.balance += sql.includes("balance - $1") ? -amount : amount;
            wallet.updated_at = "2026-05-03T01:00:00.000Z";
            return { rowCount: 1, rows: [{ balance: wallet.balance }] };
          }
          if (sql.includes("INSERT INTO") && sql.includes("ledger_entries")) {
            for (const column of ["run_id", "workspace_id", "order_id", "source_id"]) {
              assert.match(sql, new RegExp(`\\b${column}\\b`), `ledger_insert_must_include_${column}`);
            }
            txState.ledger_entries.push({
              id: params[0],
              tenant_id: params[1],
              user_id: params[2],
              run_id: params[3],
              workspace_id: params[4],
              order_id: params[5],
              type: params[6],
              amount: Number(params[7]),
              currency: params[8],
              source_type: params[9],
              source_id: params[10],
              idempotency_key: params[11],
              reason: params[12],
              operator_id: params[13],
            });
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes("INSERT INTO") && sql.includes("audit_events")) {
            txState.audit_events.push({
              id: params[0],
              type: params[1],
              user_id: params[2],
              operator_id: params[3],
              detail_json: JSON.parse(params[6]),
            });
            return { rowCount: 1, rows: [] };
          }
          throw new Error(`unexpected_sql:${sql}`);
        },
        release() {},
      };
    },
  };
}

const pool = createFakePool();
const store = createPortalAccountingStore({
  pool,
  pgTableName: (name) => `portal_${name}`,
  randomUUID: (() => {
    let index = 0;
    return () => `uuid-${++index}`;
  })(),
});

const first = await store.topupWallet({
  userId: "user-1",
  amount: 25,
  operatorId: "admin-1",
  idempotencyKey: "idem-topup-1",
});
const second = await store.topupWallet({
  userId: "user-1",
  amount: 25,
  operatorId: "admin-1",
  idempotencyKey: "idem-topup-1",
});
const charge = await store.chargeWallet({
  userId: "user-1",
  tenantId: "user-1",
  workspaceId: "workspace-1",
  runId: "run-1",
  orderId: "order-1",
  amount: 10,
  operatorId: "billing-aggregator",
  idempotencyKey: "idem-charge-1",
  reason: "resource_order_exact_bill_settlement",
  sourceType: "tencent_bill",
  sourceId: "bill-line-1",
});
const refund = await store.refundWallet({
  userId: "user-1",
  tenantId: "user-1",
  workspaceId: "workspace-1",
  runId: "run-1",
  orderId: "order-1",
  amount: 3,
  operatorId: "billing-aggregator",
  idempotencyKey: "idem-refund-1",
  sourceId: "bill-line-1",
});
const makeup = await store.makeupChargeWallet({
  userId: "user-1",
  tenantId: "user-1",
  workspaceId: "workspace-1",
  runId: "run-1",
  orderId: "order-1",
  amount: 2,
  operatorId: "billing-aggregator",
  idempotencyKey: "idem-makeup-1",
  sourceId: "bill-line-1",
});

assert.equal(first.idempotent, false, "first_call_must_apply_transaction");
assert.equal(second.idempotent, true, "same_idempotency_key_must_short_circuit");
assert.equal(charge.idempotent, false, "chargeWallet_must_apply_first_transaction");
assert.equal(refund.idempotent, false, "refundWallet_must_apply_first_transaction");
assert.equal(makeup.idempotent, false, "makeupChargeWallet_must_apply_first_transaction");
assert.equal(pool.state.wallets[0].balance, 116, "wallet_must_apply_credit_debit_refund_makeup_once");
assert.equal(pool.state.ledger_entries.length, 4, "ledger_must_record_one_row_per_accounting_action");
assert.deepEqual(
  pool.state.ledger_entries.map((entry) => entry.type),
  ["topup", "exact_resource_charge", "refund", "makeup_charge"],
  "accounting_store_must_expose_required_v20_3_action_types",
);
assert.equal(pool.state.audit_events.length, 4, "audit_must_record_one_row_per_accounting_action");
assert.deepEqual(
  pool.state.audit_events.map((entry) => entry.type),
  ["wallet_topped_up", "wallet_charged", "wallet_refunded", "wallet_makeup_charged"],
  "audit_events_must_keep_the_specific_accounting_action_type",
);

assert.match(
  routeSource,
  /writeDb\.topupWallet\(\{[\s\S]*idempotencyKey,/,
  "admin_recharge_route_must_pass_idempotency_key",
);
assert.match(
  routeSource,
  /if \(typeof writeDb\.topupWallet !== "function"\)[\s\S]*账务事务未启用/,
  "admin_recharge_route_must_reject_when_accounting_store_is_unavailable",
);
assert.match(
  storeSource,
  /createPortalAccountingStore/,
  "portal_store_must_wire_accounting_store",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v20.3-accounting-idempotency",
}, null, 2));
