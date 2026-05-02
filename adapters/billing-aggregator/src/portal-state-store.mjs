import { access, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import {
  normalizeLedgerEntries,
  normalizeResourceOrder,
} from "./ledger-contract.mjs";

export function createPortalStateStore({
  mode = "postgres_redis",
  postgresUrl = "postgres://postgres:postgres@127.0.0.1:5432/med_meta",
  namespace = "portal",
  jsonFile,
} = {}) {
  let portalPool = null;
  const storageMode = String(mode || "postgres_redis").trim().toLowerCase() === "postgres_redis" ? "postgres_redis" : "json";

  function portalTable(name) {
    return `${namespace}_${name}`;
  }

  async function ensurePortalPool() {
    if (!portalPool) {
      const { Pool } = await import("pg");
      portalPool = new Pool({ connectionString: postgresUrl });
    }
    return portalPool;
  }

  async function exists(file) {
    try {
      await access(file, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async function readPostgresPortalDb() {
    const pool = await ensurePortalPool();
    const [walletsRes, ledgerRes, resourceOrdersRes] = await Promise.all([
      pool.query(`SELECT * FROM ${portalTable("wallets")}`),
      pool.query(`SELECT * FROM ${portalTable("ledger_entries")} ORDER BY created_at ASC`),
      pool.query(`SELECT * FROM ${portalTable("resource_orders")}`),
    ]);
    return {
      wallets: walletsRes.rows.map((row) => ({
        userId: row.user_id,
        balance: Number(row.balance || 0),
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      })),
      ledger: normalizeLedgerEntries(ledgerRes.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id || row.user_id,
        userId: row.user_id,
        runId: row.run_id,
        workspaceId: row.workspace_id,
        orderId: row.order_id || "",
        type: row.type,
        amount: Number(row.amount || 0),
        currency: row.currency || "CNY",
        sourceType: row.source_type || "",
        sourceId: row.source_id || "",
        idempotencyKey: row.idempotency_key || "",
        reason: row.reason || "",
        operatorId: row.operator_id || "",
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      }))),
      resourceOrders: resourceOrdersRes.rows.map((row) => normalizeResourceOrder({
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        portalUserId: row.portal_user_id,
        workspaceId: row.workspace_id,
        workspaceSessionId: row.workspace_session_id,
        runId: row.run_id,
        billingAccountId: row.portal_user_id || row.user_id || row.tenant_id,
        status: row.status,
        serverPlanId: row.server_plan_id,
        region: row.region,
        zone: row.zone,
        cpu: row.cpu,
        memoryGb: row.memory_gb,
        gpuType: row.gpu_type,
        gpuCount: row.gpu_count,
        storagePlanId: row.storage_plan_id,
        storageSizeGb: row.storage_size_gb,
        retentionPolicy: row.retention_policy,
        estimatedHours: row.estimated_hours,
        autoStopAt: row.auto_stop_at,
        quoteId: row.quote_id,
        freezeId: row.freeze_id,
        provisionRequestId: row.provision_request_id,
        cloudResourceIds: row.cloud_resource_ids_json || [],
        currency: row.currency || "CNY",
        unitPrice: Number(row.unit_price || 0),
        minBillableHours: Number(row.min_billable_hours || 1),
        riskFactor: Number(row.risk_factor || 1),
        quoteAmount: Number(row.quote_amount || 0),
        freezeAmount: Number(row.freeze_amount || 0),
        exactCost: row.exact_cost === null ? null : Number(row.exact_cost || 0),
        pricingSource: row.pricing_source || "",
        priceUpdatedAt: row.price_updated_at || "",
        idempotencyKey: row.idempotency_key || "",
        failedReason: row.failed_reason || "",
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        settledAt: row.settled_at instanceof Date ? row.settled_at.toISOString() : row.settled_at,
      })).filter(Boolean),
    };
  }

  async function readJsonPortalDb() {
    if (!(await exists(jsonFile))) return null;
    const db = JSON.parse(await readFile(jsonFile, "utf8"));
    db.ledger = normalizeLedgerEntries(db.ledger || []);
    db.resourceOrders = (Array.isArray(db.resourceOrders) ? db.resourceOrders : []).map((row) => normalizeResourceOrder(row)).filter(Boolean);
    return db;
  }

  async function writePostgresPortalDb(db) {
    const pool = await ensurePortalPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of db.wallets || []) {
        await client.query(
          `INSERT INTO ${portalTable("wallets")} (user_id,balance,updated_at)
           VALUES ($1,$2,$3)
           ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = EXCLUDED.updated_at`,
          [row.userId, Number(row.balance || 0), row.updatedAt || new Date().toISOString()],
        );
      }
      const existingRes = await client.query(`SELECT id FROM ${portalTable("ledger_entries")}`);
      const existing = new Set(existingRes.rows.map((row) => row.id));
      for (const row of db.ledger || []) {
        if (existing.has(row.id)) continue;
        await client.query(
          `INSERT INTO ${portalTable("ledger_entries")} (id,tenant_id,user_id,run_id,workspace_id,order_id,type,amount,currency,source_type,source_id,idempotency_key,reason,operator_id,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            row.id,
            row.tenantId || row.userId || "",
            row.userId || "",
            row.runId || "",
            row.workspaceId || "",
            row.resourceOrderId || row.orderId || "",
            row.type || "",
            Number(row.amount || 0),
            row.currency || "CNY",
            row.sourceType || "",
            row.sourceId || "",
            row.idempotencyKey || "",
            row.reason || "",
            row.operatorId || "",
            row.createdAt || new Date().toISOString(),
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    storageMode,
    async readPortalDb() {
      if (storageMode === "postgres_redis") return readPostgresPortalDb();
      return readJsonPortalDb();
    },
    async writePortalDb(db) {
      if (storageMode === "postgres_redis") return writePostgresPortalDb(db);
      return writeFile(jsonFile, JSON.stringify(db, null, 2), "utf8");
    },
  };
}
