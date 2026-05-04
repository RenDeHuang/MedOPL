import assert from "node:assert/strict";

const { createPortalAccountingStore } = await import("../services/portal/src/state/portal-accounting-store.mjs");

function cloneRow(row) {
  return JSON.parse(JSON.stringify(row));
}

function createFakePool({ failAfterLedger = false } = {}) {
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
            if (!wallet) return { rowCount: 0, rows: [] };
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
            if (failAfterLedger) {
              throw new Error("fail_after_ledger");
            }
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes("INSERT INTO") && sql.includes("audit_events")) {
            txState.audit_events.push({
              id: params[0],
              type: params[1],
              user_id: params[2],
              operator_id: params[3],
              detail_json: JSON.parse(params[4]),
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

const pool = createFakePool({ failAfterLedger: true });
const store = createPortalAccountingStore({
  pool,
  pgTableName: (name) => `portal_${name}`,
  randomUUID: (() => {
    let index = 0;
    return () => `uuid-${++index}`;
  })(),
});

await assert.rejects(
  store.topupWallet({
    userId: "user-1",
    amount: 25,
    operatorId: "admin-1",
    idempotencyKey: "idem-failure-case",
  }),
  /fail_after_ledger/,
  "transaction_must_surface_mid_transaction_failure",
);

assert.deepEqual(
  pool.state.wallets,
  [{ user_id: "user-1", balance: 100, updated_at: "2026-05-03T00:00:00.000Z" }],
  "wallet_must_rollback_on_failure",
);
assert.equal(pool.state.ledger_entries.length, 0, "ledger_must_rollback_on_failure");
assert.equal(pool.state.audit_events.length, 0, "audit_must_rollback_on_failure");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.3-accounting-transaction",
}, null, 2));
