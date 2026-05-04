import assert from "node:assert/strict";

const { createPortalAccountingStore } = await import("../services/portal/src/state/portal-accounting-store.mjs");

function createFakePool() {
  const state = {
    orphanRows: [
      {
        audit_event_id: "audit-1",
        audit_type: "wallet_topped_up",
        user_id: "user-1",
        operator_id: "admin-1",
        occurred_at: "2026-05-03T02:00:00.000Z",
        detail_json: {
          ledgerId: "ledger-missing-1",
          idempotencyKey: "idem-orphan-1",
        },
      },
    ],
  };
  return {
    state,
    async query(sql) {
      if (sql.includes("FROM") && sql.includes("audit_events") && sql.includes("LEFT JOIN")) {
        return { rows: state.orphanRows };
      }
      throw new Error(`unexpected_sql:${sql}`);
    },
  };
}

const pool = createFakePool();
const store = createPortalAccountingStore({
  pool,
  pgTableName: (name) => `portal_${name}`,
  randomUUID: () => "uuid-1",
});

const report = await store.scanOrphanAccountingAudit();
assert.equal(Array.isArray(report.items), true);
assert.equal(report.items.length, 1);
assert.equal(report.items[0].auditEventId, "audit-1");
assert.equal(report.items[0].ledgerId, "ledger-missing-1");
assert.equal(report.count, 1);

console.log(JSON.stringify({ ok: true, contract: "v20.31-orphan-audit" }, null, 2));
