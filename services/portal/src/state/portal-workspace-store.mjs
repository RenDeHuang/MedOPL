function isoTime(value) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function textValue(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function nullableIso(value) {
  return value ? isoTime(value) : null;
}

function taskSpaceValues(taskSpace, { createdAt, updatedAt }) {
  return [
    textValue(taskSpace.id),
    textValue(taskSpace.userId),
    textValue(taskSpace.slug),
    textValue(taskSpace.title, taskSpace.slug),
    textValue(taskSpace.path),
    textValue(taskSpace.status, "active"),
    textValue(taskSpace.serverPlanId),
    textValue(taskSpace.serverPlanRegion),
    JSON.stringify(taskSpace.serverPlanSnapshot || {}),
    createdAt,
    updatedAt,
    nullableIso(taskSpace.archivedAt),
    nullableIso(taskSpace.deletedAt),
  ];
}

function workspaceFileValues(file, { createdAt, updatedAt }) {
  return [
    textValue(file.id),
    textValue(file.tenantId),
    textValue(file.userId),
    textValue(file.workspaceId),
    textValue(file.runId),
    textValue(file.kind, "inputs"),
    textValue(file.name),
    textValue(file.relativePath),
    textValue(file.storageKey),
    textValue(file.localPath),
    normalizeNumber(file.sizeBytes, 0),
    textValue(file.checksum),
    textValue(file.contentType, "application/octet-stream"),
    textValue(file.status, "active"),
    textValue(file.source, "portal_upload"),
    createdAt,
    updatedAt,
    nullableIso(file.deletedAt),
    textValue(file.retentionCleanupAfterAt),
  ];
}

function storageOrderValues(order, { createdAt, updatedAt }) {
  return [
    textValue(order.id),
    textValue(order.tenantId),
    textValue(order.userId),
    textValue(order.workspaceId),
    textValue(order.status, "active"),
    textValue(order.storagePlanId),
    normalizeNumber(order.storageSizeGb, 0),
    textValue(order.storageBackend, "cos"),
    textValue(order.retentionPolicy, "order_lifecycle"),
    textValue(order.cosPrefix),
    textValue(order.sourceType, "portal_storage_order"),
    createdAt,
    updatedAt,
    nullableIso(order.deletedAt),
    textValue(order.retentionCleanupAfterAt),
  ];
}

async function upsertTaskSpaceWith({ pool, pgTableName, taskSpace }) {
  const createdAt = isoTime(taskSpace.createdAt);
  const updatedAt = isoTime(taskSpace.updatedAt || createdAt);
  await pool.query(
    `INSERT INTO ${pgTableName("task_spaces")} (
      id,user_id,slug,title,path,status,server_plan_id,server_plan_region,server_plan_snapshot_json,created_at,updated_at,archived_at,deleted_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
    )
    ON CONFLICT (id) DO UPDATE SET
      slug=EXCLUDED.slug,
      title=EXCLUDED.title,
      path=EXCLUDED.path,
      status=EXCLUDED.status,
      server_plan_id=EXCLUDED.server_plan_id,
      server_plan_region=EXCLUDED.server_plan_region,
      server_plan_snapshot_json=EXCLUDED.server_plan_snapshot_json,
      updated_at=EXCLUDED.updated_at,
      archived_at=EXCLUDED.archived_at,
      deleted_at=EXCLUDED.deleted_at`,
    taskSpaceValues(taskSpace, { createdAt, updatedAt }),
  );
}

async function upsertWorkspaceFileWith({ pool, pgTableName, file }) {
  const createdAt = isoTime(file.createdAt);
  const updatedAt = isoTime(file.updatedAt || createdAt);
  await pool.query(
    `INSERT INTO ${pgTableName("workspace_files")} (
      id,tenant_id,user_id,workspace_id,run_id,kind,name,relative_path,storage_key,local_path,size_bytes,checksum,content_type,status,source,created_at,updated_at,deleted_at,retention_cleanup_after_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
    )
    ON CONFLICT (id) DO UPDATE SET
      run_id=EXCLUDED.run_id,
      kind=EXCLUDED.kind,
      name=EXCLUDED.name,
      relative_path=EXCLUDED.relative_path,
      storage_key=EXCLUDED.storage_key,
      local_path=EXCLUDED.local_path,
      size_bytes=EXCLUDED.size_bytes,
      checksum=EXCLUDED.checksum,
      content_type=EXCLUDED.content_type,
      status=EXCLUDED.status,
      source=EXCLUDED.source,
      updated_at=EXCLUDED.updated_at,
      deleted_at=EXCLUDED.deleted_at,
      retention_cleanup_after_at=EXCLUDED.retention_cleanup_after_at`,
    workspaceFileValues(file, { createdAt, updatedAt }),
  );
}

async function upsertStorageOrderWith({ pool, pgTableName, order }) {
  const createdAt = isoTime(order.createdAt);
  const updatedAt = isoTime(order.updatedAt || createdAt);
  await pool.query(
    `INSERT INTO ${pgTableName("storage_orders")} (
      id,tenant_id,user_id,workspace_id,status,storage_plan_id,storage_size_gb,storage_backend,retention_policy,cos_prefix,source_type,created_at,updated_at,deleted_at,retention_cleanup_after_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
    )
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
      retention_cleanup_after_at=EXCLUDED.retention_cleanup_after_at`,
    storageOrderValues(order, { createdAt, updatedAt }),
  );
}

export function createPortalWorkspaceStore({ pool, pgTableName }) {
  return {
    upsertStorageOrder: (order) => upsertStorageOrderWith({ pool, pgTableName, order }),
    upsertTaskSpace: (taskSpace) => upsertTaskSpaceWith({ pool, pgTableName, taskSpace }),
    upsertWorkspaceFile: (file) => upsertWorkspaceFileWith({ pool, pgTableName, file }),
  };
}
