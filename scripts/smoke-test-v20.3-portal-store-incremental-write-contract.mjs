import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const storeSource = await readFile("services/portal/src/state/portal-store.mjs", "utf8");
const workspaceRouteSource = await readFile("services/portal/src/routes/workspace-storage.routes.mjs", "utf8");
const resourceRouteSource = await readFile("services/portal/src/routes/resource-order-internal.routes.mjs", "utf8");
const resourcePublicRouteSource = await readFile("services/portal/src/routes/resource-order-public.routes.mjs", "utf8");
const labRouteSource = await readFile("services/portal/src/routes/lab-package.routes.mjs", "utf8");
const postgresPersistenceSource = await readFile("services/portal/src/state/portal-store-postgres-persistence.mjs", "utf8");
const workspaceStoreSource = await readFile("services/portal/src/state/portal-workspace-store.mjs", "utf8");
const resourceStoreSource = await readFile("services/portal/src/state/portal-resource-order-store.mjs", "utf8");
const labStoreSource = await readFile("services/portal/src/state/portal-lab-billing-store.mjs", "utf8");

assert.match(
  storeSource,
  /writePortalPostgresSnapshot\(/,
  "compat_portal_store_must_still_expose_snapshot_writer_for_non_p0_paths",
);

assert.doesNotMatch(
  workspaceRouteSource,
  /writePortalPostgresSnapshot\(/,
  "workspace_p0_route_must_not_call_snapshot_writer",
);
assert.doesNotMatch(
  resourceRouteSource,
  /writePortalPostgresSnapshot\(/,
  "resource_order_p0_route_must_not_call_snapshot_writer",
);
assert.doesNotMatch(
  labRouteSource,
  /writePortalPostgresSnapshot\(/,
  "lab_billing_p0_route_must_not_call_snapshot_writer",
);
assert.match(
  workspaceRouteSource,
  /writeDb\.upsertStorageOrder\(/,
  "workspace_storage_order_route_must_use_workspace_domain_store_when_injected",
);
assert.match(
  workspaceRouteSource,
  /writeDb\.upsertWorkspaceFile\(/,
  "workspace_upload_route_must_use_workspace_domain_store_when_injected",
);
assert.match(
  resourceRouteSource,
  /writeDb\.persistResourceOrderState\(/,
  "resource_order_internal_route_must_use_resource_order_domain_store_when_injected",
);
assert.match(
  resourcePublicRouteSource,
  /writeDb\.persistResourceOrderState\(/,
  "resource_order_public_route_must_use_resource_order_domain_store_when_injected",
);
assert.match(
  resourcePublicRouteSource,
  /writeDb\.upsertTaskSpace\(/,
  "resource_order_public_route_must_persist_task_space_via_workspace_store_when_injected",
);
assert.doesNotMatch(
  resourcePublicRouteSource,
  /await writeDb\(db\);/g,
  "resource_order_public_p0_route_must_not_directly_snapshot_write_after_mutation",
);
assert.match(
  labRouteSource,
  /writeDb\.persistLabBillingState\(/,
  "lab_package_route_must_use_lab_billing_domain_store_when_injected",
);

assert.match(
  postgresPersistenceSource,
  /DELETE FROM\s+\$\{pgTableName\("ledger_entries"\)\}/,
  "legacy_snapshot_writer_must_still_show_full_rewrite_risk_for_contrast",
);
assert.match(
  postgresPersistenceSource,
  /DELETE FROM\s+\$\{pgTableName\("resource_orders"\)\}/,
  "legacy_snapshot_writer_must_still_show_resource_order_full_rewrite_risk_for_contrast",
);
assert.match(
  postgresPersistenceSource,
  /DELETE FROM\s+\$\{pgTableName\("workspace_files"\)\}/,
  "legacy_snapshot_writer_must_still_show_workspace_file_full_rewrite_risk_for_contrast",
);

assert.doesNotMatch(
  workspaceStoreSource,
  /DELETE FROM\s+\$\{pgTableName\("workspace_files"\)\}/,
  "workspace_domain_store_must_not_full_rewrite_workspace_files",
);
assert.doesNotMatch(
  resourceStoreSource,
  /DELETE FROM\s+\$\{pgTableName\("resource_orders"\)\}/,
  "resource_domain_store_must_not_full_rewrite_resource_orders",
);
assert.doesNotMatch(
  labStoreSource,
  /DELETE FROM\s+\$\{pgTableName\("ledger_entries"\)\}/,
  "lab_domain_store_must_not_touch_ledger_full_rewrite",
);

assert.match(
  workspaceStoreSource,
  /ON CONFLICT\s+\(id\)\s+DO UPDATE/s,
  "workspace_domain_store_must_use_incremental_upsert",
);
assert.match(
  workspaceStoreSource,
  /upsertTaskSpace/,
  "workspace_domain_store_must_persist_task_space_incrementally",
);
assert.match(
  resourceStoreSource,
  /ON CONFLICT\s+\(id\)\s+DO UPDATE/s,
  "resource_domain_store_must_use_incremental_upsert",
);
assert.match(
  labStoreSource,
  /ON CONFLICT\s+\(id\)\s+DO UPDATE/s,
  "lab_domain_store_must_use_incremental_upsert",
);
assert.doesNotMatch(
  labStoreSource,
  /current_period_start|current_period_end|next_charge_amount|cancelled_at|detail_json|effective_from|effective_to/,
  "lab_domain_store_must_match_current_portal_schema_columns",
);
assert.doesNotMatch(
  `${resourceStoreSource}\n${labStoreSource}`,
  /ON CONFLICT\s+\(idempotency_key\)/,
  "domain_stores_must_not_depend_on_missing_idempotency_key_unique_indexes",
);
assert.doesNotMatch(
  resourceStoreSource,
  /user_id,status,actor_type,actor_id,payload_json/,
  "resource_event_store_must_match_current_resource_order_events_schema",
);
assert.doesNotMatch(
  workspaceStoreSource,
  /workspace_sessions/,
  "workspace_domain_store_must_not_write_nonexistent_postgres_workspace_sessions_table",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      contract: "v20.3-portal-store-incremental-write",
    },
    null,
    2,
  ),
);
