import {
  loadRedisPortalSessions,
  writeRedisPortalSessions,
} from "./portal-store-redis-sessions.mjs";

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

export async function readPortalPostgresSnapshot({
  pool,
  redis,
  pgTableName,
  namespace,
  normalizeServerPlanSelection,
}) {
  const [usersRes, walletsRes, ledgerRes, taskSpacesRes, resourceOrdersRes, resourceOrderEventsRes, storageOrdersRes, workspaceFilesRes, sandboxesRes, groupsRes, settingsRes, eventsRes] = await Promise.all([
    pool.query(`SELECT * FROM ${pgTableName("users")}`),
    pool.query(`SELECT * FROM ${pgTableName("wallets")}`),
    pool.query(`SELECT * FROM ${pgTableName("ledger_entries")}`),
    pool.query(`SELECT * FROM ${pgTableName("task_spaces")}`),
    pool.query(`SELECT * FROM ${pgTableName("resource_orders")}`),
    pool.query(`SELECT * FROM ${pgTableName("resource_order_events")}`),
    pool.query(`SELECT * FROM ${pgTableName("storage_orders")}`),
    pool.query(`SELECT * FROM ${pgTableName("workspace_files")}`),
    pool.query(`SELECT * FROM ${pgTableName("user_sandboxes")}`),
    pool.query(`SELECT * FROM ${pgTableName("groups")}`),
    pool.query(`SELECT * FROM ${pgTableName("portal_settings")}`),
    pool.query(`SELECT * FROM ${pgTableName("audit_events")} ORDER BY occurred_at DESC LIMIT 500`),
  ]);
  const { sessions, workspaceSessions } = await loadRedisPortalSessions({
    redis,
    namespace,
  });
  return {
    users: usersRes.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.status,
      passwordHash: row.password_hash,
      currentTaskSlug: row.current_task_slug,
      groupId: row.group_id,
      preferences: row.preferences_json || { theme: "light" },
      createdAt: toIso(row.created_at),
    })),
    sessions,
    wallets: walletsRes.rows.map((row) => ({
      userId: row.user_id,
      balance: Number(row.balance || 0),
      updatedAt: toIso(row.updated_at),
    })),
    ledger: ledgerRes.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id || row.user_id,
      userId: row.user_id,
      runId: row.run_id,
      workspaceId: row.workspace_id,
      orderId: row.order_id || "",
      type: row.type,
      amount: Number(row.amount || 0),
      currency: row.currency || "CNY",
      sourceType: row.source_type || "",
      sourceId: row.source_id || "",
      idempotencyKey: row.idempotency_key || "",
      reason: row.reason,
      operatorId: row.operator_id,
      createdAt: toIso(row.created_at),
    })),
    taskSpaces: taskSpacesRes.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      slug: row.slug,
      title: row.title,
      path: row.path,
      status: row.status,
      serverPlanId: row.server_plan_id || "",
      serverPlanRegion: row.server_plan_region || "",
      serverPlanSnapshot: normalizeServerPlanSelection(row.server_plan_snapshot_json),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      archivedAt: toIso(row.archived_at),
      deletedAt: toIso(row.deleted_at),
    })),
    resourceOrders: resourceOrdersRes.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      portalUserId: row.portal_user_id,
      workspaceId: row.workspace_id,
      workspaceSessionId: row.workspace_session_id,
      runId: row.run_id,
      status: row.status,
      serverPlanId: row.server_plan_id,
      region: row.region,
      zone: row.zone,
      cpu: Number(row.cpu || 0),
      memoryGb: Number(row.memory_gb || 0),
      gpuType: row.gpu_type || "",
      gpuCount: Number(row.gpu_count || 0),
      storagePlanId: row.storage_plan_id || "",
      storageSizeGb: Number(row.storage_size_gb || 0),
      retentionPolicy: row.retention_policy || "",
      estimatedHours: Number(row.estimated_hours || 0),
      autoStopAt: row.auto_stop_at || "",
      quoteId: row.quote_id || "",
      freezeId: row.freeze_id || "",
      provisionRequestId: row.provision_request_id || "",
      cloudResourceIds: row.cloud_resource_ids_json || [],
      currency: row.currency || "CNY",
      unitPrice: Number(row.unit_price || 0),
      minBillableHours: Number(row.min_billable_hours || 1),
      riskFactor: Number(row.risk_factor || 1),
      quoteAmount: Number(row.quote_amount || 0),
      freezeAmount: Number(row.freeze_amount || 0),
      exactCost: row.exact_cost === null ? null : Number(row.exact_cost || 0),
      pricingSource: row.pricing_source || "",
      priceUpdatedAt: row.price_updated_at || "",
      idempotencyKey: row.idempotency_key || "",
      failedReason: row.failed_reason || "",
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      settledAt: toIso(row.settled_at),
    })),
    resourceOrderEvents: resourceOrderEventsRes.rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      eventType: row.event_type,
      eventPayload: row.event_payload_json || {},
      actorType: row.actor_type,
      actorId: row.actor_id,
      idempotencyKey: row.idempotency_key || "",
      createdAt: toIso(row.created_at),
    })),
    storageOrders: storageOrdersRes.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      status: row.status,
      storagePlanId: row.storage_plan_id,
      storageSizeGb: Number(row.storage_size_gb || 0),
      storageBackend: row.storage_backend || "cos",
      retentionPolicy: row.retention_policy || "order_lifecycle",
      cosPrefix: row.cos_prefix || "",
      sourceType: row.source_type || "",
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      deletedAt: toIso(row.deleted_at),
      retentionCleanupAfterAt: row.retention_cleanup_after_at || "",
    })),
    workspaceFiles: workspaceFilesRes.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      runId: row.run_id || "",
      kind: row.kind,
      name: row.name,
      relativePath: row.relative_path,
      storageKey: row.storage_key,
      localPath: row.local_path,
      sizeBytes: Number(row.size_bytes || 0),
      checksum: row.checksum || "",
      contentType: row.content_type || "application/octet-stream",
      status: row.status || "active",
      source: row.source || "portal_upload",
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      deletedAt: toIso(row.deleted_at),
      retentionCleanupAfterAt: row.retention_cleanup_after_at || "",
    })),
    workspaceSessions,
    userSandboxes: sandboxesRes.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      runtimeType: row.runtime_type,
      containerName: row.container_name,
      namespace: row.namespace,
      imageTag: row.image_tag,
      status: row.status,
      lastWorkspaceId: row.last_workspace_id,
      lastRunId: row.last_run_id,
      lastError: row.last_error,
      lastActiveAt: toIso(row.last_active_at),
      updatedAt: toIso(row.updated_at),
      createdAt: toIso(row.created_at),
    })),
    groups: groupsRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      plan: row.plan,
      status: row.status,
      balanceFloor: Number(row.balance_floor || 0),
      maxWorkspaces: Number(row.max_workspaces || 0),
      maxConcurrentRuns: Number(row.max_concurrent_runs || 0),
      cpuRequest: row.cpu_request || "",
      cpuLimit: row.cpu_limit || "",
      memoryRequest: row.memory_request || "",
      memoryLimit: row.memory_limit || "",
      gpuCount: Number(row.gpu_count || 0),
      storageRequest: row.storage_request || "",
      storageLimit: row.storage_limit || "",
      allowMas: Boolean(row.allow_mas),
      allowWorkspaceCreate: Boolean(row.allow_workspace_create),
      createdAt: toIso(row.created_at),
    })),
    settings: Object.fromEntries(settingsRes.rows.map((row) => [row.key, row.value_json])),
    _auditEvents: eventsRes.rows.map((row) => ({
      id: row.id,
      type: row.type,
      userId: row.user_id,
      operatorId: row.operator_id,
      workspaceId: row.workspace_id,
      runId: row.run_id,
      occurredAt: toIso(row.occurred_at),
      ...row.detail_json,
    })),
  };
}

export async function writePortalPostgresSnapshot({
  pool,
  redis,
  pgTableName,
  namespace,
  db,
  normalizeLedgerEntries,
  normalizeServerPlanSelection,
  atomicWriteJson,
  dataFile,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of db.users || []) {
      await client.query(`INSERT INTO ${pgTableName("users")} (id,email,name,role,status,password_hash,current_task_slug,group_id,preferences_json,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET
          email=EXCLUDED.email,
          name=EXCLUDED.name,
          role=EXCLUDED.role,
          status=EXCLUDED.status,
          password_hash=COALESCE(NULLIF(EXCLUDED.password_hash, ''), ${pgTableName("users")}.password_hash),
          current_task_slug=EXCLUDED.current_task_slug,
          group_id=EXCLUDED.group_id,
          preferences_json=EXCLUDED.preferences_json`, [
        row.id, row.email, row.name, row.role, row.status, row.passwordHash || "", row.currentTaskSlug || "default", row.groupId || "", JSON.stringify(row.preferences || { theme: "light" }), row.createdAt || new Date().toISOString(),
      ]);
    }
    for (const row of db.wallets || []) {
      await client.query(`INSERT INTO ${pgTableName("wallets")} (user_id,balance,updated_at) VALUES ($1,$2,$3)
        ON CONFLICT (user_id) DO UPDATE SET
          balance=EXCLUDED.balance,
          updated_at=EXCLUDED.updated_at`, [row.userId, Number(row.balance || 0), row.updatedAt || new Date().toISOString()]);
    }
    await client.query(`DELETE FROM ${pgTableName("ledger_entries")}`);
    for (const row of normalizeLedgerEntries(db.ledger || [])) {
      await client.query(`INSERT INTO ${pgTableName("ledger_entries")} (id,tenant_id,user_id,run_id,workspace_id,order_id,type,amount,currency,source_type,source_id,idempotency_key,reason,operator_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [
        row.id,
        row.tenantId || row.userId || "",
        row.userId || "",
        row.runId || "",
        row.workspaceId || "",
        row.orderId || "",
        row.type || "",
        Number(row.amount || 0),
        row.currency || "CNY",
        row.sourceType || "",
        row.sourceId || "",
        row.idempotencyKey || "",
        row.reason || "",
        row.operatorId || "",
        row.createdAt || new Date().toISOString(),
      ]);
    }
    for (const row of db.taskSpaces || []) {
      await client.query(`INSERT INTO ${pgTableName("task_spaces")} (id,user_id,slug,title,path,status,server_plan_id,server_plan_region,server_plan_snapshot_json,created_at,updated_at,archived_at,deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
          user_id=EXCLUDED.user_id,
          slug=EXCLUDED.slug,
          title=EXCLUDED.title,
          path=EXCLUDED.path,
          status=EXCLUDED.status,
          server_plan_id=COALESCE(NULLIF(EXCLUDED.server_plan_id, ''), ${pgTableName("task_spaces")}.server_plan_id),
          server_plan_region=COALESCE(NULLIF(EXCLUDED.server_plan_region, ''), ${pgTableName("task_spaces")}.server_plan_region),
          server_plan_snapshot_json=CASE
            WHEN EXCLUDED.server_plan_snapshot_json = '{}'::jsonb THEN ${pgTableName("task_spaces")}.server_plan_snapshot_json
            ELSE EXCLUDED.server_plan_snapshot_json
          END,
          updated_at=EXCLUDED.updated_at,
          archived_at=EXCLUDED.archived_at,
          deleted_at=EXCLUDED.deleted_at`, [
        row.id,
        row.userId,
        row.slug,
        row.title,
        row.path,
        row.status,
        row.serverPlanId || "",
        row.serverPlanRegion || "",
        JSON.stringify(normalizeServerPlanSelection(row.serverPlanSnapshot) || {}),
        row.createdAt || new Date().toISOString(),
        row.updatedAt || row.createdAt || new Date().toISOString(),
        row.archivedAt || null,
        row.deletedAt || null,
      ]);
    }
    await client.query(`DELETE FROM ${pgTableName("resource_orders")}`);
    for (const row of db.resourceOrders || []) {
      await client.query(`INSERT INTO ${pgTableName("resource_orders")} (id,tenant_id,user_id,portal_user_id,workspace_id,workspace_session_id,run_id,status,server_plan_id,region,zone,cpu,memory_gb,gpu_type,gpu_count,storage_plan_id,storage_size_gb,retention_policy,estimated_hours,auto_stop_at,quote_id,freeze_id,provision_request_id,cloud_resource_ids_json,currency,unit_price,min_billable_hours,risk_factor,quote_amount,freeze_amount,exact_cost,pricing_source,price_updated_at,idempotency_key,failed_reason,created_at,updated_at,settled_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)`, [
        row.id,
        row.tenantId || row.userId || "",
        row.userId || "",
        row.portalUserId || row.userId || "",
        row.workspaceId || "",
        row.workspaceSessionId || "",
        row.runId || "",
        row.status || "quoted",
        row.serverPlanId || "",
        row.region || "",
        row.zone || "",
        Number(row.cpu || 0),
        Number(row.memoryGb || 0),
        row.gpuType || "",
        Number(row.gpuCount || 0),
        row.storagePlanId || "",
        Number(row.storageSizeGb || 0),
        row.retentionPolicy || "",
        Number(row.estimatedHours || 1),
        row.autoStopAt || "",
        row.quoteId || "",
        row.freezeId || "",
        row.provisionRequestId || "",
        JSON.stringify(row.cloudResourceIds || []),
        row.currency || "CNY",
        Number(row.unitPrice || 0),
        Number(row.minBillableHours || 1),
        Number(row.riskFactor || 1),
        Number(row.quoteAmount || 0),
        Number(row.freezeAmount || 0),
        row.exactCost === null || row.exactCost === undefined ? null : Number(row.exactCost || 0),
        row.pricingSource || "",
        row.priceUpdatedAt || "",
        row.idempotencyKey || "",
        row.failedReason || "",
        row.createdAt || new Date().toISOString(),
        row.updatedAt || row.createdAt || new Date().toISOString(),
        row.settledAt || null,
      ]);
    }
    await client.query(`DELETE FROM ${pgTableName("resource_order_events")}`);
    for (const row of db.resourceOrderEvents || []) {
      await client.query(`INSERT INTO ${pgTableName("resource_order_events")} (id,order_id,event_type,event_payload_json,actor_type,actor_id,idempotency_key,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
        row.id,
        row.orderId || "",
        row.eventType || "",
        JSON.stringify(row.eventPayload || {}),
        row.actorType || "system",
        row.actorId || "",
        row.idempotencyKey || "",
        row.createdAt || new Date().toISOString(),
      ]);
    }
    for (const row of db.storageOrders || []) {
      await client.query(`INSERT INTO ${pgTableName("storage_orders")} (id,tenant_id,user_id,workspace_id,status,storage_plan_id,storage_size_gb,storage_backend,retention_policy,cos_prefix,source_type,created_at,updated_at,deleted_at,retention_cleanup_after_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO UPDATE SET
          tenant_id=EXCLUDED.tenant_id,
          user_id=EXCLUDED.user_id,
          workspace_id=EXCLUDED.workspace_id,
          status=EXCLUDED.status,
          storage_plan_id=EXCLUDED.storage_plan_id,
          storage_size_gb=EXCLUDED.storage_size_gb,
          storage_backend=EXCLUDED.storage_backend,
          retention_policy=EXCLUDED.retention_policy,
          cos_prefix=EXCLUDED.cos_prefix,
          source_type=EXCLUDED.source_type,
          updated_at=EXCLUDED.updated_at,
          deleted_at=EXCLUDED.deleted_at,
          retention_cleanup_after_at=EXCLUDED.retention_cleanup_after_at`, [
        row.id,
        row.tenantId || row.userId || "",
        row.userId || "",
        row.workspaceId || "",
        row.status || "active",
        row.storagePlanId || "",
        Number(row.storageSizeGb || 0),
        row.storageBackend || "cos",
        row.retentionPolicy || "order_lifecycle",
        row.cosPrefix || "",
        row.sourceType || "portal_storage_order",
        row.createdAt || new Date().toISOString(),
        row.updatedAt || row.createdAt || new Date().toISOString(),
        row.deletedAt || null,
        row.retentionCleanupAfterAt || "",
      ]);
    }
    await client.query(`DELETE FROM ${pgTableName("workspace_files")}`);
    for (const row of db.workspaceFiles || []) {
      await client.query(`INSERT INTO ${pgTableName("workspace_files")} (id,tenant_id,user_id,workspace_id,run_id,kind,name,relative_path,storage_key,local_path,size_bytes,checksum,content_type,status,source,created_at,updated_at,deleted_at,retention_cleanup_after_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, [
        row.id,
        row.tenantId || row.userId || "",
        row.userId || "",
        row.workspaceId || "",
        row.runId || "",
        row.kind || "inputs",
        row.name || "",
        row.relativePath || "",
        row.storageKey || "",
        row.localPath || "",
        Number(row.sizeBytes || 0),
        row.checksum || "",
        row.contentType || "application/octet-stream",
        row.status || "active",
        row.source || "portal_upload",
        row.createdAt || new Date().toISOString(),
        row.updatedAt || row.createdAt || new Date().toISOString(),
        row.deletedAt || null,
        row.retentionCleanupAfterAt || "",
      ]);
    }
    await client.query(`DELETE FROM ${pgTableName("user_sandboxes")}`);
    for (const row of db.userSandboxes || []) {
      await client.query(`INSERT INTO ${pgTableName("user_sandboxes")} (id,user_id,runtime_type,container_name,namespace,image_tag,status,last_workspace_id,last_run_id,last_error,last_active_at,updated_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
        row.id, row.userId, row.runtimeType || "", row.containerName || "", row.namespace || "", row.imageTag || "", row.status || "", row.lastWorkspaceId || "", row.lastRunId || "", row.lastError || "", row.lastActiveAt || new Date().toISOString(), row.updatedAt || new Date().toISOString(), row.createdAt || new Date().toISOString(),
      ]);
    }
    await client.query(`DELETE FROM ${pgTableName("groups")}`);
    for (const row of db.groups || []) {
      await client.query(`INSERT INTO ${pgTableName("groups")} (id,name,plan,status,balance_floor,max_workspaces,max_concurrent_runs,cpu_request,cpu_limit,memory_request,memory_limit,gpu_count,storage_request,storage_limit,allow_mas,allow_workspace_create,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, [
        row.id, row.name, row.plan || "", row.status || "active", Number(row.balanceFloor || 0), Number(row.maxWorkspaces || 0), Number(row.maxConcurrentRuns || 0), row.cpuRequest || "", row.cpuLimit || "", row.memoryRequest || "", row.memoryLimit || "", Number(row.gpuCount || 0), row.storageRequest || "", row.storageLimit || "", row.allowMas !== false, row.allowWorkspaceCreate !== false, row.createdAt || new Date().toISOString(),
      ]);
    }
    await client.query(`DELETE FROM ${pgTableName("portal_settings")}`);
    for (const [key, value] of Object.entries(db.settings || {})) {
      await client.query(`INSERT INTO ${pgTableName("portal_settings")} (key,value_json) VALUES ($1,$2)`, [key, JSON.stringify(value)]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const { mergedSessions, mergedWorkspaceSessions } = await writeRedisPortalSessions({
    redis,
    namespace,
    sessions: db.sessions || [],
    workspaceSessions: db.workspaceSessions || [],
  });
  await atomicWriteJson(dataFile, {
    ...db,
    sessions: mergedSessions,
    workspaceSessions: mergedWorkspaceSessions,
    _storage: {
      mode: "postgres_redis",
      mirroredAt: new Date().toISOString(),
    },
  });
}
