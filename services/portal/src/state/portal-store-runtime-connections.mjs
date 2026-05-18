import { createPortalAccountingStore } from "./portal-accounting-store.mjs";
import { createPortalWorkspaceStore } from "./portal-workspace-store.mjs";
import { createPortalLabBillingStore } from "./portal-lab-billing-store.mjs";

export function createPortalStoreRuntimeConnections({
  createRedisClient,
  pg,
  pgTableName,
  postgresUrl,
  randomUUID,
  redisUrl,
}) {
  let pgPool = null;
  let redisClient = null;
  let accountingStore = null;
  let workspaceStore = null;
  let labBillingStore = null;

  async function ensurePgPool() {
    if (!String(postgresUrl || "").trim()) {
      throw new Error("portal_pg_connection_required");
    }
    if (!pgPool) {
      const { Pool } = pg;
      pgPool = new Pool({ connectionString: postgresUrl });
    }
    return pgPool;
  }

  async function ensureRedis() {
    if (!String(redisUrl || "").trim()) {
      throw new Error("portal_redis_connection_required");
    }
    if (!redisClient) {
      redisClient = createRedisClient({ url: redisUrl });
      redisClient.on("error", () => console.error("portal redis error: connection unavailable"));
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
    }
    return redisClient;
  }

  function getAccountingStore() {
    if (!accountingStore) {
      if (!pgPool) {
        throw new Error("portal_accounting_store_requires_pg_pool");
      }
      accountingStore = createPortalAccountingStore({
        pool: pgPool,
        pgTableName,
        randomUUID,
      });
    }
    return accountingStore;
  }

  function getWorkspaceStore() {
    if (!workspaceStore) {
      if (!pgPool) {
        throw new Error("portal_workspace_store_requires_pg_pool");
      }
      workspaceStore = createPortalWorkspaceStore({
        pool: pgPool,
        pgTableName,
      });
    }
    return workspaceStore;
  }

  function getLabBillingStore() {
    if (!labBillingStore) {
      if (!pgPool) {
        throw new Error("portal_lab_billing_store_requires_pg_pool");
      }
      labBillingStore = createPortalLabBillingStore({
        pool: pgPool,
        pgTableName,
      });
    }
    return labBillingStore;
  }

  return {
    ensurePgPool,
    ensureRedis,
    getAccountingStore,
    getLabBillingStore,
    getWorkspaceStore,
  };
}
