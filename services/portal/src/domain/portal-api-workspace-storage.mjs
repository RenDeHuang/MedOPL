function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeWorkspaceStorageIndex(records = []) {
  const items = Array.isArray(records) ? records : [];
  return {
    source: "portal_user_storage_index",
    type: "index",
    inputsCount: items.filter((item) => item.kind === "inputs").length,
    outputsCount: items.filter((item) => item.kind === "outputs").length,
    inputBytes: items.filter((item) => item.kind === "inputs").reduce((sum, item) => sum + numberValue(item.sizeBytes), 0),
    outputBytes: items.filter((item) => item.kind === "outputs").reduce((sum, item) => sum + numberValue(item.sizeBytes), 0),
  };
}

export function mergeWorkspaceStorageSnapshotWithIndex(snapshot = {}, records = []) {
  if (!Array.isArray(records) || records.length === 0) return snapshot;
  const summary = summarizeWorkspaceStorageIndex(records);
  return {
    ...snapshot,
    source: summary.source,
    type: summary.type,
    inputsCount: summary.inputsCount,
    outputsCount: summary.outputsCount,
    inputBytes: summary.inputBytes,
    outputBytes: summary.outputBytes,
  };
}

function normalizeWorkspaceStorageSnapshot(snapshot = {}) {
  return {
    source: snapshot.source || "workspace_file_system",
    type: snapshot.type || "snapshot",
    inputsCount: numberValue(snapshot.inputsCount ?? snapshot.counts?.inputs),
    outputsCount: numberValue(snapshot.outputsCount ?? snapshot.counts?.outputs),
    inputBytes: numberValue(snapshot.inputBytes ?? snapshot.distribution?.inputBytes),
    outputBytes: numberValue(snapshot.outputBytes ?? snapshot.distribution?.outputBytes),
  };
}

function text(value = "") {
  return String(value ?? "").trim();
}

function publicWorkspaceFileMetadata(file = {}) {
  return {
    fileRef: text(file.id || file.fileRef || file.file_ref),
    workspaceId: text(file.workspaceId || file.workspace_id),
    kind: text(file.kind),
    name: text(file.name || file.fileName || file.file_name),
    relativePath: text(file.relativePath || file.relative_path),
    sizeBytes: numberValue(file.sizeBytes || file.size_bytes),
    checksum: text(file.checksum),
    contentType: text(file.contentType || file.content_type),
    status: text(file.status || "active"),
    source: text(file.source),
    createdAt: text(file.createdAt || file.created_at),
    updatedAt: text(file.updatedAt || file.updated_at),
  };
}

export function createWorkspaceStoragePayloadBuilders(deps) {
  const {
    buildWorkspacePayload,
    defaultTaskTitle,
    ensureTaskSpace,
    findTaskSpace,
    listWorkspaceFiles = () => [],
  } = deps;

  async function buildWorkspaceStorageApiPayload(db, user, taskSlug) {
    const task = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    const payload = await buildWorkspacePayload(db, user, task.slug);
    const metadata = listWorkspaceFiles(db, {
      tenantId: user.tenantId || user.id,
      userId: user.id,
      workspaceId: task.slug,
    });
    const snapshot = normalizeWorkspaceStorageSnapshot(payload);
    const summary = mergeWorkspaceStorageSnapshotWithIndex(snapshot, metadata);
    return {
      workspaceId: payload.workspace.slug,
      inputsCount: summary.inputsCount,
      outputsCount: summary.outputsCount,
      inputBytes: summary.inputBytes,
      outputBytes: summary.outputBytes,
      userStorageSynced: false,
      lastSyncAt: new Date().toISOString(),
      metadata: metadata.map(publicWorkspaceFileMetadata),
      dataSource: summary.source === "portal_user_storage_index" ? "portal user storage index" : "workspace storage snapshot",
    };
  }

  return { buildWorkspaceStorageApiPayload };
}
