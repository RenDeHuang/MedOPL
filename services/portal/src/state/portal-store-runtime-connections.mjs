import { createPortalAccountingStore } from "./portal-accounting-store.mjs";
import { createPortalWorkspaceStore } from "./portal-workspace-store.mjs";
import { createPortalResourceOrderStore } from "./portal-resource-order-store.mjs";
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
  let resourceOrderStore = null;
  let labBillingStore = null;

  async function ensurePgPool() {
    if (!pgPool) {
      const { Pool } = pg;
      pgPool = new Pool({ connectionString: postgresUrl });
    }
    return pgPool;
  }

  async function ensureRedis() {
    if (!redisClient) {
      redisClient = createRedisClient({ url: redisUrl });
      redisClient.on("error", (error) => console.error("portal redis error", error));
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

  function getResourceOrderStore() {
    if (!resourceOrderStore) {
      if (!pgPool) {
        throw new Error("portal_resource_order_store_requires_pg_pool");
      }
      resourceOrderStore = createPortalResourceOrderStore({
        pool: pgPool,
        pgTableName,
      });
    }
    return resourceOrderStore;
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
    getResourceOrderStore,
    getWorkspaceStore,
  };
}
