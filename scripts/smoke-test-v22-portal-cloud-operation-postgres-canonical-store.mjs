import assert from "node:assert/strict";

const { createPortalStoreSchema } = await import("../services/portal/src/state/portal-store-schema.mjs");
const {
  readPortalPostgresSnapshot,
  writePortalPostgresSnapshot,
} = await import("../services/portal/src/state/portal-store-postgres-persistence.mjs");

const REQUIRED_TABLES = [
  "cloud_operations",
  "cloud_operation_jobs",
  "compute_allocations",
  "file_space_entitlements",
  "cloud_resource_projections",
  "billing_reconciliations",
];

const WRITE_TABLES = new Set();
const DDL = [];

function createRowsForSql(sql = "") {
  const tableMatch = sql.match(/FROM\s+"portal_([a-z_]+)"/i)
    || sql.match(/INTO\s+"portal_([a-z_]+)"/i)
    || sql.match(/DELETE\s+FROM\s+"portal_([a-z_]+)"/i);
  const table = tableMatch?.[1] || "";
  if (table === "users") return [{ id: "user-pg-cloud", email: "pg-cloud@example.test", name: "PG Cloud", role: "user", status: "active", password_hash: "hash", current_task_slug: "workspace-pg-cloud", group_id: "", preferences_json: {}, created_at: "2026-05-11T00:00:00.000Z" }];
  if (table === "wallets") return [{ user_id: "user-pg-cloud", balance: 1000, updated_at: "2026-05-11T00:00:00.000Z" }];
  if (table === "cloud_operations") return [{
    id: "op-pg-storage-create",
    operation_id: "op-pg-storage-create",
    tenant_id: "tenant-pg-cloud",
    user_id: "user-pg-cloud",
    workspace_id: "workspace-pg-cloud",
    resource_binding_id: "rb-pg-cloud",
    operation_type: "create_storage",
    status: "succeeded",
    runner_mode: "fake-live",
    real_cloud_calls: false,
    production_portal_connected: true,
    test_only: false,
    accepted_dry_run_id: "op-pg-storage-create",
    dry_run_report_ref: ".runtime/v22-cloud-lifecycle/op-pg-storage-create-storage-create-storage-dry-run.json",
    execution_report_ref: ".runtime/v22-cloud-lifecycle/op-pg-storage-create-storage-create-storage-execution.json",
    requested_spec_json: { fileSpaceGb: 10, planId: "starter_2c4g_10gb" },
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-11T00:01:00.000Z",
  }];
  if (table === "cloud_operation_jobs") return [{
    id: "job-op-pg-storage-create",
    operation_id: "op-pg-storage-create",
    tenant_id: "tenant-pg-cloud",
    user_id: "user-pg-cloud",
    workspace_id: "workspace-pg-cloud",
    resource_binding_id: "rb-pg-cloud",
    queue_mode: "inline_worker",
    status: "succeeded",
    runner_mode: "fake-live",
    real_cloud_calls: false,
    dry_run_report_ref: ".runtime/v22-cloud-lifecycle/op-pg-storage-create-storage-create-storage-dry-run.json",
    execution_report_ref: ".runtime/v22-cloud-lifecycle/op-pg-storage-create-storage-create-storage-execution.json",
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-11T00:01:00.000Z",
  }];
  if (table === "compute_allocations") return [];
  if (table === "file_space_entitlements") return [{
    id: "fs-rb-pg-cloud",
    tenant_id: "tenant-pg-cloud",
    user_id: "user-pg-cloud",
    workspace_id: "workspace-pg-cloud",
    resource_binding_id: "rb-pg-cloud",
    plan_id: "starter_2c4g_10gb",
    capacity_gb: 10,
    status: "available",
    retention_protection_status: "",
    retention_cleanup_after_at: "",
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-11T00:01:00.000Z",
  }];
  if (table === "cloud_resource_projections") return [{
    id: "projection-rb-pg-cloud",
    tenant_id: "tenant-pg-cloud",
    user_id: "user-pg-cloud",
    workspace_id: "workspace-pg-cloud",
    resource_binding_id: "rb-pg-cloud",
    status: "updated",
    production_portal_connected: true,
    runner_mode: "fake-live",
    real_cloud_calls: false,
    last_operation_id: "op-pg-storage-create",
    visible_summary_json: { resources: { fileSpace: { statusLabel: "可用", capacityGb: 10 } } },
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-11T00:01:00.000Z",
  }];
  if (table === "billing_reconciliations") return [{
    id: "recon-op-pg-storage-create",
    tenant_id: "tenant-pg-cloud",
    user_id: "user-pg-cloud",
    workspace_id: "workspace-pg-cloud",
    resource_binding_id: "rb-pg-cloud",
    operation_id: "op-pg-storage-create",
    status: "reconciling",
    status_label: "对账中",
    source: "portal_production_cloud_operation",
    billing_read_ref: "",
    audit_queue_ref: "",
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-11T00:01:00.000Z",
  }];
  return [];
}

function createFakeClient() {
  return {
    async query(sql) {
      const source = String(sql || "");
      const writeMatch = source.match(/INSERT\s+INTO\s+"portal_([a-z_]+)"/i)
        || source.match(/DELETE\s+FROM\s+"portal_([a-z_]+)"/i);
      if (writeMatch) WRITE_TABLES.add(writeMatch[1]);
      return { rows: createRowsForSql(source) };
    },
    release() {},
  };
}

const fakePool = {
  async query(sql) {
    const source = String(sql || "");
    DDL.push(source);
    return { rows: createRowsForSql(source) };
  },
  async connect() {
    return createFakeClient();
  },
};

const fakeRedis = {
  async keys() { return []; },
  async mGet() { return []; },
  async set() {},
};

const { initializePostgresSchema, pgTableName } = createPortalStoreSchema({ namespace: "portal" });
await initializePostgresSchema(fakePool);
const ddlText = DDL.join("\n");
for (const table of REQUIRED_TABLES) {
  assert.match(ddlText, new RegExp(`portal_${table}`), `${table}_ddl_missing`);
}

await writePortalPostgresSnapshot({
  pool: fakePool,
  redis: fakeRedis,
  pgTableName,
  namespace: "portal",
  db: {
    users: [],
    wallets: [],
    ledger: [],
    taskSpaces: [],
    resourceOrders: [],
    resourceOrderEvents: [],
    storageOrders: [],
    userComputeInstances: [],
    userStorageBuckets: [],
    workspaceResourceBindings: [],
    weeklyProtectionFreezes: [],
    workspaceFiles: [],
    cloudOperations: [{
      id: "op-pg-storage-create",
      operationId: "op-pg-storage-create",
      tenantId: "tenant-pg-cloud",
      userId: "user-pg-cloud",
      workspaceId: "workspace-pg-cloud",
      resourceBindingId: "rb-pg-cloud",
      operationType: "create_storage",
      status: "succeeded",
      runnerMode: "fake-live",
      realCloudCalls: false,
      productionPortalConnected: true,
      testOnly: false,
      acceptedDryRunId: "op-pg-storage-create",
      dryRunReportRef: ".runtime/v22-cloud-lifecycle/op-pg-storage-create-storage-create-storage-dry-run.json",
      executionReportRef: ".runtime/v22-cloud-lifecycle/op-pg-storage-create-storage-create-storage-execution.json",
      requestedSpec: { fileSpaceGb: 10 },
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:01:00.000Z",
    }],
    cloudOperationJobs: [{ id: "job-op-pg-storage-create", operationId: "op-pg-storage-create", tenantId: "tenant-pg-cloud", userId: "user-pg-cloud", workspaceId: "workspace-pg-cloud", resourceBindingId: "rb-pg-cloud", queueMode: "inline_worker", status: "succeeded", runnerMode: "fake-live", realCloudCalls: false }],
    computeAllocations: [{ id: "compute-rb-pg-cloud", tenantId: "tenant-pg-cloud", userId: "user-pg-cloud", workspaceId: "workspace-pg-cloud", resourceBindingId: "rb-pg-cloud", planId: "starter_2c4g_10gb", computeUnits: 1, status: "available", quota: { cpu: 2 }, workloadClass: "starter" }],
    fileSpaceEntitlements: [{ id: "fs-rb-pg-cloud", tenantId: "tenant-pg-cloud", userId: "user-pg-cloud", workspaceId: "workspace-pg-cloud", resourceBindingId: "rb-pg-cloud", planId: "starter_2c4g_10gb", capacityGb: 10, status: "available" }],
    cloudResourceProjections: [{ id: "projection-rb-pg-cloud", tenantId: "tenant-pg-cloud", userId: "user-pg-cloud", workspaceId: "workspace-pg-cloud", resourceBindingId: "rb-pg-cloud", status: "updated", productionPortalConnected: true, runnerMode: "fake-live", realCloudCalls: false, lastOperationId: "op-pg-storage-create", visibleSummary: { resources: { fileSpace: { statusLabel: "可用", capacityGb: 10 } } } }],
    billingReconciliations: [{ id: "recon-op-pg-storage-create", tenantId: "tenant-pg-cloud", userId: "user-pg-cloud", workspaceId: "workspace-pg-cloud", resourceBindingId: "rb-pg-cloud", operationId: "op-pg-storage-create", status: "reconciling", statusLabel: "对账中", source: "portal_production_cloud_operation" }],
    labSubscriptions: [],
    labPackageEvents: [],
    labStorageAddons: [],
    labDailyCharges: [],
    userSandboxes: [],
    groups: [],
    settings: {},
    sessions: [],
    workspaceSessions: [],
  },
  normalizeLedgerEntries: (rows) => rows,
  normalizeServerPlanSelection: (value) => value || {},
  atomicWriteJson: async () => {},
  dataFile: "",
});

for (const table of REQUIRED_TABLES) {
  assert.equal(WRITE_TABLES.has(table), true, `${table}_write_missing`);
}

const snapshot = await readPortalPostgresSnapshot({
  pool: fakePool,
  redis: fakeRedis,
  pgTableName,
  namespace: "portal",
  normalizeServerPlanSelection: (value) => value || {},
});

assert.equal(snapshot.cloudOperations[0].operationType, "create_storage", "cloud_operation_read_mapping");
assert.equal(snapshot.cloudOperations[0].productionPortalConnected, true, "cloud_operation_production_mapping");
assert.equal(snapshot.cloudOperationJobs[0].queueMode, "inline_worker", "cloud_operation_job_read_mapping");
assert.equal(snapshot.fileSpaceEntitlements[0].capacityGb, 10, "file_space_read_mapping");
assert.equal(snapshot.cloudResourceProjections[0].visibleSummary.resources.fileSpace.statusLabel, "可用", "projection_read_mapping");
assert.equal(snapshot.billingReconciliations[0].statusLabel, "对账中", "billing_reconciliation_read_mapping");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_cloud_operation_postgres_canonical_store",
  checked: [
    "postgres_schema_has_cloud_operation_tables",
    "postgres_snapshot_writes_cloud_operation_tables",
    "postgres_snapshot_reads_canonical_cloud_operation_records",
  ],
}, null, 2));
