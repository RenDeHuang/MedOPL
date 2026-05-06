import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schemaSource = await readFile("services/portal/src/state/portal-store-schema.mjs", "utf8");
const persistenceSource = await readFile("services/portal/src/state/portal-store-postgres-persistence.mjs", "utf8");
const writeHelpersSource = await readFile("services/portal/src/state/portal-store-postgres-write-snapshot-helpers.mjs", "utf8");
const walletLedgerSource = await readFile("services/portal/src/domain/wallet-ledger.mjs", "utf8");
const accountingStoreSource = await readFile("services/portal/src/state/portal-accounting-store.mjs", "utf8");
const resourceOrderStoreSource = await readFile("services/portal/src/state/portal-resource-order-store.mjs", "utf8");
const domainSource = await readFile("services/portal/src/domain/platform-provisioned-resources.mjs", "utf8");
const legacyDomainSource = await readFile("services/portal/src/domain/user-owned-resources.mjs", "utf8");
const storeSource = await readFile("services/portal/src/state/portal-platform-provisioned-resource-store.mjs", "utf8");
const legacyStoreSource = await readFile("services/portal/src/state/portal-user-owned-resource-store.mjs", "utf8");
const routeSource = await readFile("services/portal/src/routes/platform-provisioned-resource.routes.mjs", "utf8");
const legacyRouteSource = await readFile("services/portal/src/routes/user-owned-resource.routes.mjs", "utf8");

for (const tableName of ["user_compute_instances", "user_storage_buckets", "workspace_resource_bindings", "weekly_protection_freezes"]) {
  const tableToken = `\${pgTableName("${tableName}")}`;
  assert(schemaSource.includes(`CREATE TABLE IF NOT EXISTS ${tableToken}`), `schema_must_create_${tableName}`);
  assert(persistenceSource.includes(`SELECT * FROM ${tableToken}`), `postgres_snapshot_must_read_${tableName}`);
  assert.equal(writeHelpersSource.includes(`DELETE FROM ${tableToken}`), false, `${tableName}_must_not_be_full_table_deleted_in_snapshot_write`);
}

for (const collectionName of ["userComputeInstances", "userStorageBuckets", "workspaceResourceBindings", "weeklyProtectionFreezes"]) {
  assert.match(persistenceSource, new RegExp(`${collectionName}: .*\\.rows\\.map`, "s"), `postgres_snapshot_must_return_${collectionName}`);
  assert.match(writeHelpersSource, new RegExp(`db\\.${collectionName} \\|\\| \\[\\]`), `postgres_snapshot_must_write_${collectionName}`);
}

for (const fieldName of ["cvmInstanceId", "bucketId", "resourceBindingId", "rootPrefix", "windowStartAt", "windowEndAt", "frozenAmount", "consumedAmount", "remainingAmount", "releasedAmount", "reconcile120MinStatus", "tPlus1AuditStatus"]) {
  assert.match(domainSource, new RegExp(`\\b${fieldName}\\b`), `domain_must_normalize_${fieldName}`);
}

for (const columnName of ["runtime_agent_endpoint", "provisioning_mode", "cloud_resource_id", "provision_evidence_id", "provision_evidence_json", "release_evidence_id", "release_evidence_json"]) {
  assert.match(schemaSource, new RegExp(`ALTER TABLE \\$\\{pgTableName\\("user_compute_instances"\\)\\} ADD COLUMN IF NOT EXISTS ${columnName}`), `compute_schema_must_migrate_${columnName}`);
  assert.match(writeHelpersSource, new RegExp(columnName), `compute_writer_must_persist_${columnName}`);
  assert.match(persistenceSource, new RegExp(columnName), `compute_reader_must_read_${columnName}`);
}

for (const columnName of ["provisioning_mode", "cloud_resource_id", "storage_plan_id", "storage_capacity_gb", "provision_evidence_id", "provision_evidence_json", "release_evidence_id", "release_evidence_json", "billing_started_at", "billing_stopped_at"]) {
  assert.match(schemaSource, new RegExp(`ALTER TABLE \\$\\{pgTableName\\("user_storage_buckets"\\)\\} ADD COLUMN IF NOT EXISTS ${columnName}`), `storage_schema_must_migrate_${columnName}`);
  assert.match(writeHelpersSource, new RegExp(columnName), `storage_writer_must_persist_${columnName}`);
  assert.match(persistenceSource, new RegExp(columnName), `storage_reader_must_read_${columnName}`);
}

assert.match(schemaSource, /UNIQUE\s*\(\s*resource_binding_id\s*,\s*window_start_at\s*,\s*window_end_at\s*\)/, "weekly_protection_freeze_must_be_unique_per_binding_window");
assert.match(schemaSource, /resource_binding_id text NOT NULL DEFAULT ''/, "ledger_entries_must_define_resource_binding_id_column");
assert.match(persistenceSource, /resourceBindingId:\s*row\.resource_binding_id/, "postgres_snapshot_must_read_ledger_resource_binding_id");
assert.match(writeHelpersSource, /order_id,resource_binding_id,type,amount,currency,source_type/, "postgres_snapshot_writer_must_write_ledger_resource_binding_id");
assert.match(walletLedgerSource, /resourceBindingId/, "wallet_ledger_must_keep_resource_binding_id");
assert.match(accountingStoreSource, /resource_binding_id/, "accounting_store_must_persist_resource_binding_id");
assert.match(resourceOrderStoreSource, /resource_binding_id/, "resource_order_store_must_persist_resource_binding_id");
assert.match(storeSource, /\bweeklyProtectionFreezes\b/, "store_must_manage_weekly_protection_freezes");
assert.match(storeSource, /\bactive_binding_required\b/, "store_must_guard_full_runtime_with_active_binding");
assert.match(storeSource, /\bbillingStoppedAt\b/, "store_must_stop_billing_when_binding_is_removed");
assert.match(storeSource, /\breleasedProtection\b/, "store_must_report_released_protection");
assert.match(routeSource, /\/portal\/api\/platform-provisioned-resources\/protection-freezes\b/, "route_must_expose_platform_protection_freeze_query");
assert.match(routeSource, /\/portal\/api\/platform-provisioned-resources\/protection-freezes\/ensure\b/, "route_must_expose_platform_protection_freeze_ensure");
assert.match(routeSource, /\/portal\/api\/platform-provisioned-resources\/compute-instances\/delete\b/, "route_must_expose_platform_compute_delete");
assert.match(routeSource, /\/portal\/api\/platform-provisioned-resources\/storage-buckets\/delete\b/, "route_must_expose_platform_storage_delete");
assert.match(routeSource, /\/portal\/api\/user-owned-resources\/protection-freezes\b/, "route_must_keep_legacy_protection_freeze_query");
assert.match(routeSource, /\/portal\/api\/user-owned-resources\/protection-freezes\/ensure\b/, "route_must_keep_legacy_protection_freeze_ensure");
assert.match(legacyDomainSource, /platform-provisioned-resources\.mjs/, "legacy_domain_must_reexport_platform_resource_model");
assert.match(legacyStoreSource, /portal-platform-provisioned-resource-store\.mjs/, "legacy_store_must_reexport_platform_resource_store");
assert.match(legacyRouteSource, /createLegacyUserOwnedResourceRoutes/, "legacy_route_must_delegate_to_platform_resource_routes");

console.log(JSON.stringify({
  ok: true,
  contract: "v21_platform_provisioned_resource_postgres_persistence",
}, null, 2));
