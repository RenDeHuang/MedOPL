import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const paths = {
  resourceOrderStore: "services/portal/src/state/portal-resource-order-store.mjs",
  schema: "services/portal/src/state/portal-store-schema.mjs",
  postgresPersistence: "services/portal/src/state/portal-store-postgres-persistence.mjs",
  snapshotHelpers: "services/portal/src/state/portal-store-postgres-write-snapshot-helpers.mjs",
  runtimeConnections: "services/portal/src/state/portal-store-runtime-connections.mjs",
  portalStore: "services/portal/src/state/portal-store.mjs",
  dbDelegates: "services/portal/src/state/portal-store-db-delegates.mjs",
  portalStoreRuntime: "services/portal/src/app/portal-store-runtime.mjs",
  migrations: "services/portal/src/state/portal-store-migrations.mjs",
  migrationCollections: "services/portal/src/state/portal-store-migration-collections.mjs",
  activeFeatureRuntimeHandlers: "services/portal/src/app/portal-feature-runtime-handlers.mjs",
};

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_must_not_include:${forbidden}`);
}

function assertFunctionExport(source, functionName, label) {
  assert(
    source.includes(`export function ${functionName}`) || source.includes(`export async function ${functionName}`),
    `${label}_${functionName}_export_missing:${functionName}`,
  );
}

const sources = Object.fromEntries(await Promise.all(
  Object.entries(paths).map(async ([key, filePath]) => [key, await readRepoFile(filePath)]),
));

assertFunctionExport(sources.resourceOrderStore, "createPortalResourceOrderStore", "resource_order_store");
for (const expected of [
  "upsertResourceOrder",
  "appendResourceOrderEvent",
  "persistResourceOrderState",
  "resource_orders",
  "resource_order_events",
  "ledger_entries",
  "order_id",
  "resourceOrderId: targetOrderId",
]) {
  assertIncludes(sources.resourceOrderStore, expected, "resource_order_store_legacy_persistence_fact");
}

for (const expected of [
  'CREATE TABLE IF NOT EXISTS ${pgTableName("resource_orders")}',
  'CREATE TABLE IF NOT EXISTS ${pgTableName("resource_order_events")}',
  "order_id text NOT NULL DEFAULT ''",
  "resource_binding_id text NOT NULL DEFAULT ''",
  'CREATE TABLE IF NOT EXISTS ${pgTableName("workspace_resource_bindings")}',
]) {
  assertIncludes(sources.schema, expected, "resource_order_postgres_schema_fact");
}

for (const expected of [
  'pool.query(`SELECT * FROM ${pgTableName("resource_orders")}`)',
  'pool.query(`SELECT * FROM ${pgTableName("resource_order_events")}`)',
  "resourceOrdersRes",
  "resourceOrderEventsRes",
  "resourceOrders:",
  "resourceOrderEvents:",
  "writeResourceOrders",
  "writeResourceOrderEvents",
  "await writeResourceOrders({ client, pgTableName, db })",
  "await writeResourceOrderEvents({ client, pgTableName, db })",
]) {
  assertIncludes(sources.postgresPersistence, expected, "resource_order_postgres_persistence_fact");
}

assertFunctionExport(sources.snapshotHelpers, "writeResourceOrders", "resource_order_snapshot_helper");
assertFunctionExport(sources.snapshotHelpers, "writeResourceOrderEvents", "resource_order_snapshot_helper");
for (const expected of [
  'pgTableName("resource_orders")',
  'pgTableName("resource_order_events")',
]) {
  assertIncludes(sources.snapshotHelpers, expected, "resource_order_snapshot_helper_fact");
}

for (const expected of [
  'import { createPortalResourceOrderStore } from "./portal-resource-order-store.mjs";',
  "let resourceOrderStore = null;",
  "function getResourceOrderStore()",
  "portal_resource_order_store_requires_pg_pool",
  "createPortalResourceOrderStore({",
  "getResourceOrderStore,",
]) {
  assertIncludes(sources.runtimeConnections, expected, "resource_order_runtime_connection_fact");
}

for (const expected of [
  "ensureResourceOrderCollections",
  "getResourceOrderStore",
  "persistResourceOrderState: dbFacade.persistResourceOrderState",
  "readPortalPostgresSnapshot",
  "writePortalPostgresSnapshot",
  'targetVersion: "v20.32"',
]) {
  assertIncludes(sources.portalStore, expected, "resource_order_portal_store_fact");
}

for (const expected of [
  "getResourceOrderStore",
  "persistResourceOrderState(params)",
  "return getResourceOrderStore().persistResourceOrderState(params)",
]) {
  assertIncludes(sources.dbDelegates, expected, "resource_order_db_delegate_fact");
}

assertIncludes(sources.portalStoreRuntime, "ensureResourceOrderCollections", "resource_order_portal_store_runtime_fact");
assertIncludes(sources.migrations, "resourceOrders: []", "resource_order_seed_collection_fact");
assertIncludes(sources.migrations, "resourceOrderEvents: []", "resource_order_seed_collection_fact");
assertIncludes(sources.migrationCollections, '"resourceOrders"', "resource_order_migration_collection_fact");
assertIncludes(sources.migrationCollections, '"resourceOrderEvents"', "resource_order_migration_collection_fact");
assertIncludes(sources.migrationCollections, 'runSnapshotMigration(db, ["ledger", "resourceOrders", "resourceOrderEvents"], ensureResourceOrderCollections)', "resource_order_migration_collection_fact");

assertIncludes(sources.activeFeatureRuntimeHandlers, "../routes/resource-order.routes.mjs", "resource_order_tombstone_route_import_fact");
for (const forbiddenImport of [
  "../routes/resource-order-public.routes.mjs",
  "../routes/resource-order-internal.routes.mjs",
  "../routes/resource-order-public-delete.routes.mjs",
  "../routes/resource-order-provisioning-service.mjs",
  "../routes/resource-order-route-support.mjs",
]) {
  assertNotIncludes(sources.activeFeatureRuntimeHandlers, forbiddenImport, "resource_order_success_route_import");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_resource_order_store_postgres_characterization",
  mode: "static_source_characterization_only",
  noDbConnection: true,
  characterizedLegacyFacts: {
    resourceOrderStore: paths.resourceOrderStore,
    postgresSchema: paths.schema,
    postgresPersistence: paths.postgresPersistence,
    snapshotHelpers: paths.snapshotHelpers,
    runtimeConnections: paths.runtimeConnections,
    jsonCollections: [paths.migrations, paths.migrationCollections],
  },
  replacementTruthStillPresent: [
    "resource_binding_id",
    "workspace_resource_bindings",
  ],
}, null, 2));
