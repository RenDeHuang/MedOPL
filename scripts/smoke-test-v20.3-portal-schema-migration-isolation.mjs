import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const storeSource = await readFile("services/portal/src/state/portal-store.mjs", "utf8");
const packageSource = await readFile("services/portal/package.json", "utf8");
const migratorSource = await readFile("services/portal/src/state/portal-schema-migrator.mjs", "utf8").catch(() => "");
const healthSource = await readFile("services/portal/src/state/portal-schema-health.mjs", "utf8").catch(() => "");
const entrypointSource = await readFile("services/portal/src/migrate-schema.mjs", "utf8").catch(() => "");

assert.match(
  storeSource,
  /from "\.\/portal-schema-migrator\.mjs"/,
  "portal_store_must_import_schema_migrator",
);
assert.match(
  storeSource,
  /from "\.\/portal-schema-health\.mjs"/,
  "portal_store_must_import_schema_health",
);
assert.doesNotMatch(
  storeSource,
  /async function initializeStorageInfra[\s\S]*initializePostgresSchema\(pool\)/,
  "request_path_must_not_run_initialize_postgres_schema",
);
assert.match(
  storeSource,
  /await assertPortalSchemaReady\(\{[\s\S]*targetVersion:\s*"v20\.3"/,
  "request_path_must_only_assert_schema_health",
);
assert.match(
  migratorSource,
  /export async function runPortalSchemaMigration\(/,
  "schema_migrator_must_export_run_function",
);
assert.match(
  migratorSource,
  /await initializePostgresSchema\(pool\)/,
  "schema_migrator_must_own_initialize_postgres_schema_call",
);
assert.match(
  migratorSource,
  /schema_versions/,
  "schema_migrator_must_write_schema_version",
);
assert.match(
  healthSource,
  /export async function assertPortalSchemaReady\(/,
  "schema_health_must_export_assert_function",
);
assert.match(
  healthSource,
  /portal_schema_not_ready/,
  "schema_health_must_raise_contract_error",
);
assert.match(
  entrypointSource,
  /migratePortalSchema\(\)/,
  "schema_migration_must_have_explicit_service_entrypoint",
);
assert.match(
  packageSource,
  /"migrate:schema":\s*"node src\/migrate-schema\.mjs"/,
  "portal_package_must_expose_schema_migration_command",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v20.3-portal-schema-migration-isolation",
}, null, 2));
