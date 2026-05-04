import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
          if (sql.includes("SELECT id FROM") && sql.includes("ledger_entries")) {
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
            txState.ledger_entries.push({
              id: params[0],
              type: params[6],
              idempotency_key: params[11],
            });
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes("INSERT INTO") && sql.includes("audit_events")) {
            txState.audit_events.push({
              id: params[0],
              type: params[1],
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

const routeSource = await readFile("services/portal/src/routes/admin-user.routes.mjs", "utf8");
const storeSource = await readFile("services/portal/src/state/portal-store.mjs", "utf8");
const billingRoutesSource = await readFile("services/portal/src/routes/portal-billing-export.routes.mjs", "utf8");
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

assert.equal(first.idempotent, false);
assert.equal(second.idempotent, true);
assert.equal(pool.state.wallets[0].balance, 125);
assert.equal(pool.state.ledger_entries.length, 1);
assert.equal(pool.state.audit_events.length, 1);
assert.match(routeSource, /writeDb\.topupWallet\(\{/);
assert.match(storeSource, /writeDb\.refundWallet\s*=\s*refundWallet/);
assert.match(storeSource, /writeDb\.makeupChargeWallet\s*=\s*makeupChargeWallet/);
assert.doesNotMatch(billingRoutesSource, /wallet\.balance\s*\+=/, "ledger adjust must not mutate wallet balance outside accounting transaction");
assert.doesNotMatch(billingRoutesSource, /appendLedgerEntry\(db,\s*\{/, "ledger adjust must not append ledger outside accounting transaction");
assert.match(billingRoutesSource, /writeDb\.refundWallet/);
assert.match(billingRoutesSource, /writeDb\.makeupChargeWallet/);

console.log(JSON.stringify({ ok: true, contract: "v20.31-accounting-idempotency" }, null, 2));
