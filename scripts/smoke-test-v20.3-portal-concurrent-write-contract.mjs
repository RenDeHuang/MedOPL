import assert from "node:assert/strict";

const { createPortalWorkspaceStore } = await import("../services/portal/src/state/portal-workspace-store.mjs");
const { createPortalResourceOrderStore } = await import("../services/portal/src/state/portal-resource-order-store.mjs");
const { createPortalLabBillingStore } = await import("../services/portal/src/state/portal-lab-billing-store.mjs");

function createRecorderPool() {
  const logs = [];
  const txByDomain = new Map();
  const domainSqlMatchers = [
    { domain: "workspace", tokens: ["workspace_files", "storage_orders", "task_spaces"] },
    { domain: "resource_order", tokens: ["resource_orders", "resource_order_events"] },
    {
      domain: "lab_billing",
      tokens: ["lab_subscriptions", "lab_package_events", "lab_storage_addons", "lab_daily_charges"],
    },
  ];

  function domainFromSql(sql) {
    const matched = domainSqlMatchers.find(({ tokens }) => tokens.some((token) => sql.includes(token)));
    return matched?.domain ?? "unknown";
  }

  const pool = {
    logs,
    txByDomain,
    async connect(domain = "unknown") {
      return {
        async query(sql) {
          const text = String(sql || "");
          logs.push({ type: "client", domain, sql: text });
          if (text === "BEGIN") {
            txByDomain.set(domain, (txByDomain.get(domain) || 0) + 1);
          }
          return { rowCount: 1, rows: [] };
        },
        release() {},
      };
    },
    async query(sql, params = []) {
      const text = String(sql || "");
      const domain = domainFromSql(text);
      logs.push({ type: "pool", domain, sql: text, params });
      return { rowCount: 1, rows: [] };
    },
  };
  return pool;
}

const pool = createRecorderPool();
const pgTableName = (name) => `portal_${name}`;
const workspaceStore = createPortalWorkspaceStore({ pool, pgTableName });
const resourceStore = createPortalResourceOrderStore({ pool, pgTableName });
const labStore = createPortalLabBillingStore({ pool, pgTableName });

await Promise.all([
  workspaceStore.upsertTaskSpace({
    id: "ts-1",
    userId: "u-1",
    slug: "w-1",
    title: "Workspace 1",
    path: "/tmp/workspace-1",
    status: "active",
    createdAt: "2026-05-03T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
  }),
  workspaceStore.upsertWorkspaceFile({
    id: "wf-1",
    tenantId: "t-1",
    userId: "u-1",
    workspaceId: "w-1",
    runId: "r-1",
    kind: "inputs",
    name: "a.txt",
    relativePath: "a.txt",
    sizeBytes: 12,
    checksum: "sha256:a",
    contentType: "text/plain",
    status: "active",
    source: "portal_upload",
    createdAt: "2026-05-03T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
  }),
  resourceStore.upsertResourceOrder({
    id: "ro-1",
    tenantId: "t-1",
    userId: "u-1",
    workspaceId: "w-1",
    status: "pending",
    currency: "CNY",
    createdAt: "2026-05-03T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
  }),
  labStore.upsertLabSubscription({
    id: "ls-1",
    userId: "u-1",
    workspaceId: "w-1",
    packageId: "pkg-pro",
    status: "active",
    currentPeriodStart: "2026-05-01",
    currentPeriodEnd: "2026-05-31",
    freezeAmount: 50,
    nextChargeAmount: 100,
    createdAt: "2026-05-03T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
  }),
]);

const normalized = pool.logs
  .filter((entry) => entry.type === "pool")
  .map((entry) => ({
    domain: entry.domain,
    sql: entry.sql.replace(/\s+/g, " ").trim(),
  }));

assert.equal(normalized.length, 4, "four_domain_writes_expected");

const domainCounts = normalized.reduce((counts, entry) => {
  counts[entry.domain] = (counts[entry.domain] || 0) + 1;
  return counts;
}, {});
assert.deepEqual(
  domainCounts,
  { workspace: 2, resource_order: 1, lab_billing: 1 },
  "domain_table_writes_must_remain_independent_and_complete",
);

assert.equal(pool.txByDomain.size, 0, "no_cross_domain_large_transaction_expected");

const orphanAudits = pool.logs.filter(
  (entry) => entry.sql.includes("audit_events") || entry.sql.includes("ledger_entries"),
);
assert.equal(orphanAudits.length, 0, "orphan_audit_must_be_zero_in_domain_stores");

assert(
  normalized.every((entry) => entry.sql.includes("ON CONFLICT")),
  "domain_store_writes_must_be_incremental_upserts",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      contract: "v20.3-portal-concurrent-write",
      domainCounts,
      orphanAuditCount: orphanAudits.length,
    },
    null,
    2,
  ),
);
