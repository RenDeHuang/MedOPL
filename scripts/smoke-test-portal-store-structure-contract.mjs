import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const storeSource = await readFile("services/portal/src/state/portal-store.mjs", "utf8");
const healthSource = await readFile("services/portal/src/state/portal-store-health.mjs", "utf8");
const migrationsSource = await readFile("services/portal/src/state/portal-store-migrations.mjs", "utf8");
const postgresSource = await readFile("services/portal/src/state/portal-store-postgres-persistence.mjs", "utf8");

function callBlock(source, callee) {
  const start = source.indexOf(`${callee}({`);
  assert.notEqual(start, -1, `${callee}_call_missing`);
  const end = source.indexOf("  });", start);
  assert.notEqual(end, -1, `${callee}_call_end_missing`);
  return source.slice(start, end);
}

assert.match(storeSource, /from "\.\/portal-store-health\.mjs"/, "portal_store_must_delegate_health_payload");
assert.match(storeSource, /from "\.\/portal-store-migrations\.mjs"/, "portal_store_must_delegate_seed_and_migration");
assert.match(storeSource, /from "\.\/portal-store-postgres-persistence\.mjs"/, "portal_store_must_delegate_postgres_persistence");

assert.match(healthSource, /export function createPortalStoreHealth\(/, "health_helper_must_export_factory");
assert.match(healthSource, /buildPortalHealthPayload/, "health_helper_must_own_health_payload_builder");

assert.match(migrationsSource, /export function createPortalStoreMigrations\(/, "migration_helper_must_export_factory");
assert.match(
  callBlock(storeSource, "createPortalStoreMigrations"),
  /normalizeLedgerEntries,\s*normalizeServerPlanSelection,/,
  "portal_store_must_pass_ledger_normalizer_to_migration_helper",
);
assert.match(migrationsSource, /buildSeedDb/, "migration_helper_must_own_seed_builder");
assert.match(migrationsSource, /migrateDb/, "migration_helper_must_own_db_migration");

assert.match(postgresSource, /export async function readPortalPostgresSnapshot\(/, "postgres_helper_must_own_read_snapshot");
assert.match(postgresSource, /export async function writePortalPostgresSnapshot\(/, "postgres_helper_must_own_write_snapshot");
assert.match(postgresSource, /loadRedisPortalSessions/, "postgres_helper_must_load_redis_sessions");
assert.match(postgresSource, /normalizeLedgerEntries/, "postgres_helper_must_preserve_ledger_normalization");

assert.doesNotMatch(storeSource, /SELECT \* FROM \${pgTableName\("users"\)}/, "portal_store_must_not_inline_postgres_read_mapping");
assert.doesNotMatch(storeSource, /INSERT INTO \${pgTableName\("resource_orders"\)}/, "portal_store_must_not_inline_postgres_write_mapping");

console.log(JSON.stringify({
  ok: true,
  contract: "portal_store_structure",
}, null, 2));
