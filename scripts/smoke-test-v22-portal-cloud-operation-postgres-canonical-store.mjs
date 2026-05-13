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
  "audit_events",
];

const WRITE_TABLES = new Set();
const WRITE_SQL = [];
const DDL = [];

function cloudOperationRow({ id, operationType, requestedSpec }) {
  return {
    id,
    operation_id: id,
    tenant_id: "tenant-pg-cloud",
    user_id: "user-pg-cloud",
    workspace_id: "workspace-pg-cloud",
    resource_binding_id: "rb-pg-cloud",
    operation_type: operationType,
    status: "succeeded",
    runner_mode: "fake-live",
    real_cloud_calls: false,
    production_portal_connected: true,
    test_only: false,
    accepted_dry_run_id: id,
    dry_run_report_ref: `.runtime/v22-cloud-lifecycle/${id}-dry-run.json`,
    execution_report_ref: `.runtime/v22-cloud-lifecycle/${id}-execution.json`,
    requested_spec_json: requestedSpec,
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-11T00:01:00.000Z",
  };
}

function createRowsForSql(sql = "") {
  const tableMatch = sql.match(/FROM\s+"portal_([a-z_]+)"/i)
    || sql.match(/INTO\s+"portal_([a-z_]+)"/i)
    || sql.match(/DELETE\s+FROM\s+"portal_([a-z_]+)"/i);
  const table = tableMatch?.[1] || "";
  if (table === "users") return [{ id: "user-pg-cloud", email: "pg-cloud@example.test", name: "PG Cloud", role: "user", status: "active", password_hash: "hash", current_task_slug: "workspace-pg-cloud", group_id: "", preferences_json: {}, created_at: "2026-05-11T00:00:00.000Z" }];
  if (table === "wallets") return [{ user_id: "user-pg-cloud", balance: 1000, updated_at: "2026-05-11T00:00:00.000Z" }];
  if (table === "cloud_operations") return [
    cloudOperationRow({ id: "op-pg-storage-create", operationType: "create_storage", requestedSpec: { fileSpaceGb: 10, planId: "starter_2c4g_10gb" } }),
    cloudOperationRow({ id: "op-pg-compute-create", operationType: "create_compute", requestedSpec: { computeUnits: 1, targetDesiredCapacity: "1" } }),
    cloudOperationRow({ id: "op-pg-storage-expand", operationType: "expand_storage", requestedSpec: { fileSpaceGb: 20 } }),
    cloudOperationRow({ id: "op-pg-compute-expand", operationType: "expand_compute", requestedSpec: { computeUnits: 2, targetDesiredCapacity: "2" } }),
    cloudOperationRow({ id: "op-pg-compute-release", operationType: "release_compute", requestedSpec: { targetDesiredCapacity: "0" } }),
    cloudOperationRow({ id: "op-pg-storage-delete", operationType: "delete_storage", requestedSpec: { fileSpaceGb: 20 } }),
  ];
  if (table === "cloud_operation_jobs") return [{
    id: "job-op-pg-storage-create",
    operation_id: "op-pg-storage-create",
    tenant_id: "tenant-pg-cloud",
    user_id: "user-pg-cloud",
    workspace_id: "workspace-pg-cloud",
    resource_binding_id: "rb-pg-cloud",
    queue_mode: "independent_worker",
    status: "succeeded",
    runner_mode: "fake-live",
    real_cloud_calls: false,
    dry_run_report_ref: ".runtime/v22-cloud-lifecycle/op-pg-storage-create-storage-create-storage-dry-run.json",
    execution_report_ref: ".runtime/v22-cloud-lifecycle/op-pg-storage-create-storage-create-storage-execution.json",
    lease_owner: "portal-cloud-worker-pg-proof",
    lease_acquired_at: "2026-05-11T00:00:30.000Z",
    failure_reason: "",
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-11T00:01:00.000Z",
  }];
  if (table === "compute_allocations") return [{
    id: "compute-rb-pg-cloud",
    tenant_id: "tenant-pg-cloud",
    user_id: "user-pg-cloud",
    workspace_id: "workspace-pg-cloud",
    resource_binding_id: "rb-pg-cloud",
    plan_id: "starter_2c4g_10gb",
    compute_units: 2,
    status: "released",
    cluster_ref: "",
    namespace_ref: "",
    node_pool_ref: "np-postgres-attribution-proof",
    quota_json: {},
    workload_class: "",
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-11T00:01:00.000Z",
  }];
  if (table === "file_space_entitlements") return [{
    id: "fs-rb-pg-cloud",
    tenant_id: "tenant-pg-cloud",
    user_id: "user-pg-cloud",
    workspace_id: "workspace-pg-cloud",
    resource_binding_id: "rb-pg-cloud",
    plan_id: "starter_2c4g_10gb",
    capacity_gb: 20,
    status: "retention_protected",
    retention_protection_status: "active",
    retention_cleanup_after_at: "2026-05-18T00:01:00.000Z",
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
    last_operation_id: "op-pg-storage-delete",
    visible_summary_json: { resources: { compute: { statusLabel: "已释放", computeUnits: 2 }, fileSpace: { statusLabel: "文件保护期", capacityGb: 20 } } },
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
      if (writeMatch) {
        WRITE_TABLES.add(writeMatch[1]);
        WRITE_SQL.push(source);
      }
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
    workspaceResourceBindings: [{
      id: "rb-pg-cloud",
      resourceBindingId: "rb-pg-cloud",
      tenantId: "tenant-pg-cloud",
      userId: "user-pg-cloud",
      workspaceId: "workspace-pg-cloud",
      status: "active",
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:01:00.000Z",
    }],
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
    }, {
      id: "op-pg-compute-create",
      operationId: "op-pg-compute-create",
      tenantId: "tenant-pg-cloud",
      userId: "user-pg-cloud",
      workspaceId: "workspace-pg-cloud",
      resourceBindingId: "rb-pg-cloud",
      operationType: "create_compute",
      status: "succeeded",
      runnerMode: "fake-live",
      realCloudCalls: false,
      productionPortalConnected: true,
      testOnly: false,
      acceptedDryRunId: "op-pg-compute-create",
      dryRunReportRef: ".runtime/v22-cloud-lifecycle/op-pg-compute-create-create-compute-compute-dry-run.json",
      executionReportRef: ".runtime/v22-cloud-lifecycle/op-pg-compute-create-create-compute-compute-execution.json",
      requestedSpec: { computeUnits: 1, targetDesiredCapacity: "1" },
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:01:00.000Z",
    }, {
      id: "op-pg-storage-expand",
      operationId: "op-pg-storage-expand",
      tenantId: "tenant-pg-cloud",
      userId: "user-pg-cloud",
      workspaceId: "workspace-pg-cloud",
      resourceBindingId: "rb-pg-cloud",
      operationType: "expand_storage",
      status: "succeeded",
      runnerMode: "fake-live",
      realCloudCalls: false,
      productionPortalConnected: true,
      testOnly: false,
      acceptedDryRunId: "op-pg-storage-expand",
      dryRunReportRef: ".runtime/v22-cloud-lifecycle/op-pg-storage-expand-expand-storage-storage-expand.json",
      executionReportRef: ".runtime/v22-cloud-lifecycle/op-pg-storage-expand-expand-storage-storage-execution.json",
      requestedSpec: { fileSpaceGb: 20 },
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:01:00.000Z",
    }, {
      id: "op-pg-compute-expand",
      operationId: "op-pg-compute-expand",
      tenantId: "tenant-pg-cloud",
      userId: "user-pg-cloud",
      workspaceId: "workspace-pg-cloud",
      resourceBindingId: "rb-pg-cloud",
      operationType: "expand_compute",
      status: "succeeded",
      runnerMode: "fake-live",
      realCloudCalls: false,
      productionPortalConnected: true,
      testOnly: false,
      acceptedDryRunId: "op-pg-compute-expand",
      dryRunReportRef: ".runtime/v22-cloud-lifecycle/op-pg-compute-expand-expand-compute-compute-expand.json",
      executionReportRef: ".runtime/v22-cloud-lifecycle/op-pg-compute-expand-expand-compute-compute-execution.json",
      requestedSpec: { computeUnits: 2, targetDesiredCapacity: "2" },
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:01:00.000Z",
    }, {
      id: "op-pg-compute-release",
      operationId: "op-pg-compute-release",
      tenantId: "tenant-pg-cloud",
      userId: "user-pg-cloud",
      workspaceId: "workspace-pg-cloud",
      resourceBindingId: "rb-pg-cloud",
      operationType: "release_compute",
      status: "succeeded",
      runnerMode: "fake-live",
      realCloudCalls: false,
      productionPortalConnected: true,
      testOnly: false,
      acceptedDryRunId: "op-pg-compute-release",
      dryRunReportRef: ".runtime/v22-cloud-lifecycle/op-pg-compute-release-release-compute-compute-release.json",
      executionReportRef: ".runtime/v22-cloud-lifecycle/op-pg-compute-release-release-compute-compute-execution.json",
      requestedSpec: { targetDesiredCapacity: "0" },
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:01:00.000Z",
    }, {
      id: "op-pg-storage-delete",
      operationId: "op-pg-storage-delete",
      tenantId: "tenant-pg-cloud",
      userId: "user-pg-cloud",
      workspaceId: "workspace-pg-cloud",
      resourceBindingId: "rb-pg-cloud",
      operationType: "delete_storage",
      status: "succeeded",
      runnerMode: "fake-live",
      realCloudCalls: false,
      productionPortalConnected: true,
      testOnly: false,
      acceptedDryRunId: "op-pg-storage-delete",
      dryRunReportRef: ".runtime/v22-cloud-lifecycle/op-pg-storage-delete-delete-storage-storage-delete.json",
      executionReportRef: ".runtime/v22-cloud-lifecycle/op-pg-storage-delete-delete-storage-storage-execution.json",
      requestedSpec: { fileSpaceGb: 20 },
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:01:00.000Z",
    }],
    cloudOperationJobs: [{ id: "job-op-pg-storage-create", operationId: "op-pg-storage-create", tenantId: "tenant-pg-cloud", userId: "user-pg-cloud", workspaceId: "workspace-pg-cloud", resourceBindingId: "rb-pg-cloud", queueMode: "independent_worker", status: "succeeded", runnerMode: "fake-live", realCloudCalls: false, leaseOwner: "portal-cloud-worker-pg-proof", leaseAcquiredAt: "2026-05-11T00:00:30.000Z", failureReason: "" }],
    computeAllocations: [{ id: "compute-rb-pg-cloud", tenantId: "tenant-pg-cloud", userId: "user-pg-cloud", workspaceId: "workspace-pg-cloud", resourceBindingId: "rb-pg-cloud", planId: "starter_2c4g_10gb", computeUnits: 2, status: "released", nodePoolRef: "np-postgres-attribution-proof", quota: { cpu: 2 }, workloadClass: "starter" }],
    fileSpaceEntitlements: [{ id: "fs-rb-pg-cloud", tenantId: "tenant-pg-cloud", userId: "user-pg-cloud", workspaceId: "workspace-pg-cloud", resourceBindingId: "rb-pg-cloud", planId: "starter_2c4g_10gb", capacityGb: 20, status: "retention_protected", retentionProtectionStatus: "active", retentionCleanupAfterAt: "2026-05-18T00:01:00.000Z" }],
    cloudResourceProjections: [{ id: "projection-rb-pg-cloud", tenantId: "tenant-pg-cloud", userId: "user-pg-cloud", workspaceId: "workspace-pg-cloud", resourceBindingId: "rb-pg-cloud", status: "updated", productionPortalConnected: true, runnerMode: "fake-live", realCloudCalls: false, lastOperationId: "op-pg-storage-delete", visibleSummary: { resources: { compute: { statusLabel: "已释放", computeUnits: 2 }, fileSpace: { statusLabel: "文件保护期", capacityGb: 20 } } } }],
    billingReconciliations: [{ id: "recon-op-pg-storage-delete", tenantId: "tenant-pg-cloud", userId: "user-pg-cloud", workspaceId: "workspace-pg-cloud", resourceBindingId: "rb-pg-cloud", operationId: "op-pg-storage-delete", status: "reconciling", statusLabel: "对账中", source: "portal_production_cloud_operation" }],
    auditEvents: [{ id: "audit-op-pg-storage-delete", tenantId: "tenant-pg-cloud", userId: "user-pg-cloud", workspaceId: "workspace-pg-cloud", resourceBindingId: "rb-pg-cloud", operationId: "op-pg-storage-delete", action: "portal_cloud_operation_delete_storage", type: "portal_cloud_operation_delete_storage", status: "succeeded", decision: "accepted", reason: "user_requested_portal_cloud_operation", createdAt: "2026-05-11T00:01:00.000Z" }],
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

const cloudOperationWriteSql = WRITE_SQL.find((sql) => /INSERT\s+INTO\s+"portal_cloud_operations"/i.test(sql)) || "";
const cloudOperationJobWriteSql = WRITE_SQL.find((sql) => /INSERT\s+INTO\s+"portal_cloud_operation_jobs"/i.test(sql)) || "";
const bindingWriteSql = WRITE_SQL.find((sql) => /INSERT\s+INTO\s+"portal_workspace_resource_bindings"/i.test(sql)) || "";
const projectionWriteSql = WRITE_SQL.find((sql) => /INSERT\s+INTO\s+"portal_cloud_resource_projections"/i.test(sql)) || "";
assert.match(cloudOperationWriteSql, /status=CASE[\s\S]*succeeded[\s\S]*failed[\s\S]*queued[\s\S]*running/i, "cloud_operation_upsert_must_not_downgrade_terminal_status");
assert.match(cloudOperationJobWriteSql, /status=CASE[\s\S]*succeeded[\s\S]*failed[\s\S]*queued[\s\S]*running/i, "cloud_operation_job_upsert_must_not_downgrade_terminal_status");
assert.match(bindingWriteSql, /updated_at=CASE[\s\S]*updated_at\s*>\s*EXCLUDED\.updated_at/i, "workspace_binding_upsert_must_not_downgrade_newer_snapshot");
assert.match(projectionWriteSql, /updated_at=CASE[\s\S]*updated_at\s*>\s*EXCLUDED\.updated_at/i, "cloud_resource_projection_upsert_must_not_downgrade_newer_snapshot");

const snapshot = await readPortalPostgresSnapshot({
  pool: fakePool,
  redis: fakeRedis,
  pgTableName,
  namespace: "portal",
  normalizeServerPlanSelection: (value) => value || {},
});

assert.equal(snapshot.cloudOperations[0].operationType, "create_storage", "cloud_operation_read_mapping");
assert.deepEqual(snapshot.cloudOperations.map((item) => item.operationType), [
  "create_storage",
  "create_compute",
  "expand_storage",
  "expand_compute",
  "release_compute",
  "delete_storage",
], "cloud_operation_lifecycle_read_mapping");
assert.equal(snapshot.cloudOperations[0].productionPortalConnected, true, "cloud_operation_production_mapping");
assert.equal(snapshot.cloudOperationJobs[0].queueMode, "independent_worker", "cloud_operation_job_read_mapping");
assert.equal(snapshot.cloudOperationJobs[0].leaseOwner, "portal-cloud-worker-pg-proof", "cloud_operation_job_lease_owner_read_mapping");
assert.equal(snapshot.computeAllocations[0].status, "released", "compute_allocation_read_mapping");
assert.equal(snapshot.computeAllocations[0].nodePoolRef, "np-postgres-attribution-proof", "compute_allocation_node_pool_ref_read_mapping");
assert.equal(snapshot.fileSpaceEntitlements[0].capacityGb, 20, "file_space_read_mapping");
assert.equal(snapshot.fileSpaceEntitlements[0].status, "retention_protected", "file_space_status_read_mapping");
assert.equal(snapshot.cloudResourceProjections[0].visibleSummary.resources.fileSpace.statusLabel, "文件保护期", "projection_read_mapping");
assert.equal(snapshot.billingReconciliations[0].statusLabel, "对账中", "billing_reconciliation_read_mapping");
assert.equal(WRITE_TABLES.has("audit_events"), true, "audit_events_write_missing");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_cloud_operation_postgres_canonical_store",
  checked: [
    "postgres_schema_has_cloud_operation_tables",
    "postgres_snapshot_writes_cloud_operation_tables",
    "postgres_snapshot_reads_canonical_cloud_operation_records",
  ],
}, null, 2));
