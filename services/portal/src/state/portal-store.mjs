import { appendFile, mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient as createRedisClient } from "redis";
import { createPortalStoreHealth } from "./portal-store-health.mjs";
import { createPortalStoreMigrations } from "./portal-store-migrations.mjs";
import { runPortalSchemaMigration } from "./portal-schema-migrator.mjs";
import { assertPortalSchemaReady } from "./portal-schema-health.mjs";
import {
  readPortalPostgresSnapshot,
  writePortalPostgresSnapshot,
} from "./portal-store-postgres-persistence.mjs";
import { createPortalStoreSchema } from "./portal-store-schema.mjs";
import { createPortalStoreRuntimeConnections } from "./portal-store-runtime-connections.mjs";
import { createPortalStoreStorageBootstrap } from "./portal-store-storage-bootstrap.mjs";
import { createPortalStoreDbFacade } from "./portal-store-db-facade.mjs";
import {
  adminSeed,
  BUILD_SHA,
  BUILD_TIME,
  codexRuntimeEventsFile,
  codexRuntimeRoot,
  dataFile,
  eventsFile,
  medRunsRoot,
  medWorkspaceRoot,
  OPL_RUNTIME_MODE,
  OPL_RUNTIME_TIMEOUT_MS,
  OPL_WEB_URL,
  OPL_WEBUI_AUTH_MODE,
  PORTAL_ADMIN_SEED_BALANCE,
  PORTAL_DB_NAMESPACE,
  PORTAL_IDENTITY_SYNC_MODE,
  PORTAL_OIDC_ENABLED,
  PORTAL_OPL_ADAPTER_URL,
  PORTAL_POSTGRES_URL,
  PORTAL_PUBLIC_URL,
  PORTAL_REDIS_URL,
  PORTAL_STORAGE_MODE,
  RETIRED_REGISTRY_URL,
  RETIRED_STORAGE_API_URL,
  RETIRED_STORAGE_CONSOLE_URL,
  runtimeRoot,
  TENCENT_BILLING_ENABLED,
  TENCENT_BILLING_REQUIRED,
} from "../config/portal-config.mjs";

export function createPortalStore({
  atomicWriteJson,
  exists,
  hashPassword,
  normalizeAnnouncementRecord,
  normalizeLedgerEntries,
  normalizeServerPlanSelection,
  ensureLabSubscriptionCollections,
  ensureUserCommercialState,
  ensureWorkspaceStorageCollections,
  sanitizeTaskTitle,
  getTaskPath,
}) {
  const { initializePostgresSchema, pgTableName } = createPortalStoreSchema({ namespace: PORTAL_DB_NAMESPACE });
  const {
    ensurePgPool,
    ensureRedis,
    getAccountingStore,
    getLabBillingStore,
    getWorkspaceStore,
  } = createPortalStoreRuntimeConnections({
    createRedisClient,
    pg,
    pgTableName,
    postgresUrl: PORTAL_POSTGRES_URL,
    randomUUID,
    redisUrl: PORTAL_REDIS_URL,
  });
  const { buildPortalHealthPayload: buildHealthPayload } = createPortalStoreHealth({
    buildSha: BUILD_SHA,
    buildTime: BUILD_TIME,
    identity: {
      ssoMode: PORTAL_OIDC_ENABLED ? "oidc" : "local",
      identitySyncMode: PORTAL_IDENTITY_SYNC_MODE,
      oplWebAuthMode: OPL_WEBUI_AUTH_MODE,
    },
    billing: {
      mode: TENCENT_BILLING_ENABLED ? "tencent-cloud-billing" : "portal-billing-ledger",
      required: TENCENT_BILLING_REQUIRED,
      source: "portal_billing_ledger",
    },
    runtime: {
      portalPublicUrl: PORTAL_PUBLIC_URL || null,
      oplWebUrl: OPL_WEB_URL || null,
      portalAdapterUrl: PORTAL_OPL_ADAPTER_URL || null,
      oplRuntimeMode: OPL_RUNTIME_MODE,
      timeoutMs: OPL_RUNTIME_TIMEOUT_MS,
    },
    storage: {
      runtimeRoot,
      dataFile,
      eventsFile,
      medWorkspaceRoot,
      medRunsRoot,
      codexRuntimeRoot,
      codexRuntimeEventsFile,
    },
    links: {
      minioApiUrl: RETIRED_STORAGE_API_URL || null,
      minioConsoleUrl: RETIRED_STORAGE_CONSOLE_URL || null,
      harborUrl: RETIRED_REGISTRY_URL || null,
      langfuseUrl: null,
    },
  });
  const { buildSeedDb, migrateDb } = createPortalStoreMigrations({
    adminSeed,
    adminSeedBalance: PORTAL_ADMIN_SEED_BALANCE,
    hashPassword,
    normalizeAnnouncementRecord,
    normalizeLedgerEntries,
    normalizeServerPlanSelection,
    ensureLabSubscriptionCollections,
    ensureUserCommercialState,
    ensureWorkspaceStorageCollections,
    sanitizeTaskTitle,
    getTaskPath,
  });

  const storageMode = () => (PORTAL_STORAGE_MODE === "postgres_redis" ? "postgres_redis" : "json");
  const buildPortalHealthPayload = () => buildHealthPayload({ storageMode });
  const readPortalPostgresSnapshotDelegated = (params) =>
    readPortalPostgresSnapshot({
      ...params,
    });
  const writePortalPostgresSnapshotDelegated = (params) =>
    writePortalPostgresSnapshot({
      ...params,
    });

  let writeDbRef = null;
  const { ensureStorageInfra, seedPostgresIfEmpty } = createPortalStoreStorageBootstrap({
    atomicWriteJson,
    exists,
    hashPassword,
    mkdir,
    readFile,
    randomUUID,
    adminSeed,
    adminSeedBalance: PORTAL_ADMIN_SEED_BALANCE,
    dataFile,
    eventsFile,
    runtimeRoot,
    medWorkspaceRoot,
    medRunsRoot,
    storageMode,
    ensurePgPool,
    ensureRedis,
    assertPortalSchemaReady,
    pgTableName,
    getAccountingStore,
    getWorkspaceStore,
    getLabBillingStore,
    migrateDb,
    buildSeedDb,
    getWriteDb: () => writeDbRef,
  });

  const dbFacade = createPortalStoreDbFacade({
    appendFile,
    atomicWriteJson,
    dataFile,
    ensureStorageInfra,
    ensurePgPool,
    ensureRedis,
    eventsFile,
    exists,
    getAccountingStore,
    getLabBillingStore,
    getWorkspaceStore,
    migrateDb,
    mkdir,
    namespace: PORTAL_DB_NAMESPACE,
    normalizeLedgerEntries,
    normalizeServerPlanSelection,
    pgTableName,
    randomUUID,
    readFile,
    readPortalPostgresSnapshot: readPortalPostgresSnapshotDelegated,
    runtimeRoot,
    seedPostgresIfEmpty,
    storageMode,
    writePortalPostgresSnapshot: writePortalPostgresSnapshotDelegated,
  });
  writeDbRef = dbFacade.writeDb;

  async function migratePortalSchema() {
    const pool = await ensurePgPool();
    return runPortalSchemaMigration({
      pool,
      initializePostgresSchema,
      pgTableName,
      targetVersion: "v20.32",
    });
  }

  return {
    buildPortalHealthPayload,
    ensureStorageInfra,
    logPortalEvent: dbFacade.logPortalEvent,
    migratePortalSchema,
    readAuthDb: dbFacade.readAuthDb,
    readDb: dbFacade.readDb,
    readPortalEvents: dbFacade.readPortalEvents,
    storageMode,
    persistLabBillingState: dbFacade.persistLabBillingState,
    refundWallet: dbFacade.refundWallet,
    makeupChargeWallet: dbFacade.makeupChargeWallet,
    topupWallet: dbFacade.topupWallet,
    upsertStorageOrder: dbFacade.upsertStorageOrder,
    upsertTaskSpace: dbFacade.upsertTaskSpace,
    upsertWorkspaceFile: dbFacade.upsertWorkspaceFile,
    writeDb: dbFacade.writeDb,
  };
}
