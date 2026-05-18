import { fileNameFrom } from "./workspace-storage-upload-support.mjs";
import { mergeWorkspaceStorageSnapshotWithIndex } from "../domain/portal-api-workspace-storage.mjs";
import {
  resolvePathInsideRoot,
  resolveRelativePathInsideRoot,
  safePathSegment,
  safeRelativePrefix,
} from "../domain/workspace-storage.mjs";

function text(value) {
  return String(value || "").trim();
}

function userTenantId(user) {
  return text(user?.tenantId || user?.id);
}

function publicStorageEntitlementView(entitlement = {}) {
  return {
    enabled: Boolean(entitlement.enabled),
    status: text(entitlement.status || (entitlement.enabled ? "active" : "disabled")),
    freeQuotaGb: Number(entitlement.freeQuotaGb || 0),
    minimumPurchaseGb: Number(entitlement.minimumPurchaseGb || 10),
    retentionPolicy: text(entitlement.retentionPolicy || "workspace_lifecycle"),
    storageSizeGb: Number(entitlement.storageSizeGb || entitlement.capacityGb || 0),
    message: text(entitlement.message || (entitlement.enabled ? "active" : "storage_required")),
  };
}

function publicWorkspaceFileMetadata(file = {}) {
  return {
    fileRef: text(file.id || file.fileRef || file.file_ref),
    workspaceId: text(file.workspaceId || file.workspace_id),
    kind: text(file.kind),
    name: text(file.name || file.fileName || file.file_name),
    relativePath: text(file.relativePath || file.relative_path),
    sizeBytes: Number(file.sizeBytes || file.size_bytes || 0),
    checksum: text(file.checksum),
    contentType: text(file.contentType || file.content_type),
    status: text(file.status || "active"),
    source: text(file.source),
    createdAt: text(file.createdAt || file.created_at),
    updatedAt: text(file.updatedAt || file.updated_at),
  };
}

function publicStorageOrderView(order = {}) {
  return {
    status: text(order.status),
    storageSizeGb: Number(order.storageSizeGb || order.capacityGb || 0),
    retentionPolicy: text(order.retentionPolicy),
    createdAt: text(order.createdAt),
    updatedAt: text(order.updatedAt),
  };
}

async function readJsonBody(deps, req, res) {
  try {
    return JSON.parse((await deps.readBody(req)).toString("utf8") || "{}");
  } catch {
    deps.sendJson(res, { error: "invalid_json" }, 400);
    return null;
  }
}

async function resolveTaskSpace(deps, { db, user, task }) {
  const requestedTask = text(task || user.currentTaskSlug);
  const taskSlug = requestedTask ? deps.slugify(requestedTask) : "";
  if (!taskSlug) {
    return { ok: false, error: "workspace_id_required", status: 422 };
  }
  const taskSpace = deps.findTaskSpace(db, user.id, taskSlug)
    || await deps.ensureTaskSpace(db, user, taskSlug, deps.defaultTaskTitle(taskSlug));
  return { ok: true, taskSpace };
}

function buildSessionScopedLocalPath(deps, taskSpace, rootPrefix, oplSessionId, kind, relativePath) {
  const normalizedRootPrefix = safeRelativePrefix(rootPrefix);
  const normalizedSessionId = safePathSegment(oplSessionId);
  const normalizedKind = text(kind) === "outputs" ? "outputs" : "inputs";
  const rootSegments = normalizedRootPrefix ? normalizedRootPrefix.split("/") : [];
  if (!normalizedRootPrefix || !normalizedSessionId) return "";
  return resolveRelativePathInsideRoot(
    deps.path,
    taskSpace.path,
    [...rootSegments, "sessions", normalizedSessionId, normalizedKind, relativePath].join("/"),
  );
}

function verifiedIndexedLocalPath(deps, taskSpace, indexedFile) {
  const normalizedRootPrefix = safeRelativePrefix(indexedFile.storageRootPrefix);
  const normalizedSessionId = safePathSegment(indexedFile.oplSessionId || indexedFile.runId);
  const normalizedKind = text(indexedFile.kind) === "outputs" ? "outputs" : "inputs";
  const relativePath = deps.safeRelativePath(indexedFile.relativePath || "");
  if (!normalizedRootPrefix || !normalizedSessionId || !relativePath) return "";
  const expectedPath = resolveRelativePathInsideRoot(
    deps.path,
    taskSpace.path,
    `${normalizedRootPrefix}/sessions/${normalizedSessionId}/${normalizedKind}/${relativePath}`,
  );
  if (!expectedPath) return "";
  const indexedPath = text(indexedFile.localPath);
  if (!indexedPath) return expectedPath;
  const resolvedIndexedPath = resolvePathInsideRoot(deps.path, taskSpace.path, indexedPath);
  return resolvedIndexedPath && resolvedIndexedPath === expectedPath ? resolvedIndexedPath : "";
}

function findActiveWorkspaceBinding(deps, db, user, workspaceId, resourceBindingId) {
  const bindingId = text(resourceBindingId);
  const ownerUserId = text(user?.id);
  const ownerTenantId = userTenantId(user);
  if (!bindingId) return null;
  return (db.workspaceResourceBindings || []).find((item) =>
    text(item.status).toLowerCase() === "active" &&
    text(item.workspaceId) === text(workspaceId) &&
    (text(item.id) === bindingId || text(item.resourceBindingId) === bindingId) &&
    text(item.ownerUserId || item.userId) === ownerUserId &&
    text(item.ownerTenantId || item.tenantId || item.userId) === ownerTenantId
  ) || null;
}

function fullRuntimeStorageError(input, binding) {
  const oplSessionId = safePathSegment(input.oplSessionId || input.runId || input.sessionId);
  const resourceBindingId = text(input.resourceBindingId);
  if (!oplSessionId || !resourceBindingId) return { error: "full_runtime_session_required", status: 409 };
  if (!binding) return { error: "workspace_storage_binding_inactive", status: 409 };
  if (!safeRelativePrefix(binding.rootPrefix || binding.root_prefix || "")) return { error: "workspace_storage_root_invalid", status: 409 };
  return null;
}

function buildFullRuntimeStorageContext(deps, { user, taskSpace, binding, relativePath, kind, input }) {
  const oplSessionId = safePathSegment(input.oplSessionId || input.runId || input.sessionId);
  const resourceBindingId = text(binding.resourceBindingId || binding.id);
  const rootPrefix = safeRelativePrefix(binding.rootPrefix || `users/${user.id}/workspaces/${taskSpace.slug}/`);
  const localPath = buildSessionScopedLocalPath(deps, taskSpace, rootPrefix, oplSessionId, kind, relativePath);
  return {
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: taskSpace.slug,
    oplSessionId,
    resourceBindingId,
    kind,
    relativePath,
    fileName: fileNameFrom(relativePath),
    storageMode: "full_runtime",
    rootPrefix,
    source: kind === "outputs" ? "full_runtime_output" : "full_runtime_upload",
    storageKey: deps.buildWorkspaceStorageKey(userTenantId(user), taskSpace.slug, kind, relativePath, {
      userId: user.id,
      oplSessionId,
      resourceBindingId,
      storageMode: "full_runtime",
      rootPrefix,
    }),
    localPath,
  };
}

function resolveFullRuntimeStorageContext(deps, { db, user, taskSpace, relativePath, kind, input = {} }) {
  const binding = findActiveWorkspaceBinding(deps, db, user, taskSpace.slug, input.resourceBindingId);
  const failure = fullRuntimeStorageError(input, binding);
  if (failure) return { ok: false, ...failure };
  const storageContext = buildFullRuntimeStorageContext(deps, { user, taskSpace, binding, relativePath, kind, input });
  if (!storageContext.localPath) return { ok: false, error: "workspace_file_path_invalid", status: 409 };
  return {
    ok: true,
    binding,
    storageContext,
  };
}

function findIndexedWorkspaceFile(deps, db, user, taskSpace, { kind, relativePath, oplSessionId, resourceBindingId }) {
  return deps.listWorkspaceFiles(db, {
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: taskSpace.slug,
    kind,
    relativePath,
    oplSessionId,
    resourceBindingId,
  }).find((item) => item.relativePath === relativePath) || null;
}

function storageUploadError(entitlement) {
  if (!entitlement.enabled) return "storage_entitlement_required";
  if (entitlement.gates && entitlement.gates.canUpload === false) return "workspace_storage_upload_not_allowed";
  return "";
}

function sendUploadEntitlementError(deps, res, entitlement, uploadError) {
  deps.sendJson(
    res,
    { error: uploadError, entitlement },
    uploadError === "storage_entitlement_required" ? 402 : 409,
  );
}

function isTransferTokenForUser(tokenPayload, user) {
  return tokenPayload
    && tokenPayload.userId === user.id
    && text(tokenPayload.tenantId) === userTenantId(user);
}

function multipartBoundaryFrom(req) {
  const contentType = String(req.headers["content-type"] || "");
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  return boundaryMatch ? boundaryMatch[1] : "";
}

function selectUploadFile(files = [], relativePath = "") {
  return files.find((item) => item.relativePath === relativePath) || files[0] || null;
}

function buildSignedUploadStorageTarget({ tokenPayload, user, taskSpace, binding }) {
  return {
    tenantId: tokenPayload.tenantId,
    userId: tokenPayload.userId,
    workspaceId: tokenPayload.workspaceId,
    oplSessionId: tokenPayload.oplSessionId,
    resourceBindingId: tokenPayload.resourceBindingId,
    storageMode: "full_runtime",
    rootPrefix: text(binding.rootPrefix || `users/${user.id}/workspaces/${taskSpace.slug}/`),
    storageKey: tokenPayload.storageKey,
    localPath: tokenPayload.localPath,
    source: tokenPayload.kind === "outputs" ? "full_runtime_output" : "full_runtime_upload",
  };
}

async function persistStorageRouteDb(deps, { db, taskSpace, file }) {
  if (typeof deps.writeDb.upsertTaskSpace === "function" && typeof deps.writeDb.upsertWorkspaceFile === "function") {
    await deps.writeDb.upsertTaskSpace(taskSpace);
    await deps.writeDb.upsertWorkspaceFile(file);
    return;
  }
  await deps.writeDb(db);
}

function fullRuntimeSessionParams(url) {
  return {
    oplSessionId: safePathSegment(url.searchParams.get("oplSessionId") || url.searchParams.get("runId") || url.searchParams.get("sessionId")),
    resourceBindingId: text(url.searchParams.get("resourceBindingId")),
  };
}

function resolveIndexedDownload(deps, { db, user, taskSpace, kind, relativePath, oplSessionId, resourceBindingId }) {
  if (!oplSessionId || !resourceBindingId) return { ok: false, error: "full_runtime_session_required", status: 409 };
  const binding = findActiveWorkspaceBinding(deps, db, user, taskSpace.slug, resourceBindingId);
  if (!binding) return { ok: false, error: "workspace_storage_binding_inactive", status: 409 };
  const indexedFile = findIndexedWorkspaceFile(deps, db, user, taskSpace, { kind, relativePath, oplSessionId, resourceBindingId });
  if (!indexedFile) return { ok: false, error: "file_not_found", status: 404 };
  return { ok: true, binding, indexedFile };
}

async function readSignedUploadFile(deps, req, tokenPayload) {
  const boundary = multipartBoundaryFrom(req);
  if (!boundary) return { ok: false, error: "multipart_boundary_missing", status: 400 };
  const files = deps.readMultipartFiles(await deps.readBody(req), boundary);
  const matched = selectUploadFile(files, tokenPayload.relativePath);
  if (!matched) return { ok: false, error: "file_missing", status: 400 };
  return { ok: true, file: matched };
}

function signedUploadGate(deps, { db, user, taskSpace, tokenPayload }) {
  const binding = findActiveWorkspaceBinding(deps, db, user, taskSpace.slug, tokenPayload.resourceBindingId);
  if (!binding) return { ok: false, error: "workspace_storage_binding_inactive", status: 409 };
  const entitlement = deps.workspaceStorageEntitlement(db, user, taskSpace.slug);
  const uploadError = storageUploadError(entitlement);
  if (uploadError) {
    return {
      ok: false,
      error: uploadError,
      status: uploadError === "storage_entitlement_required" ? 402 : 409,
      entitlement,
    };
  }
  return { ok: true, binding };
}

async function persistStorageOrder(deps, db, taskSpace, created) {
  if (typeof deps.writeDb.upsertTaskSpace === "function" && typeof deps.writeDb.upsertStorageOrder === "function") {
    await deps.writeDb.upsertTaskSpace(taskSpace);
    await deps.writeDb.upsertStorageOrder(created.order);
    return;
  }
  await deps.writeDb(db);
}

async function handleWorkspaceStorageSnapshot(deps, { req, res, url, db, user }) {
  if (req.method !== "GET" || url.pathname !== "/portal/api/workspace/storage") return false;
  const resolved = await resolveTaskSpace(deps, { db, user, task: url.searchParams.get("task") || url.searchParams.get("workspaceId") });
  if (!resolved.ok) {
    deps.sendJson(res, { error: resolved.error }, resolved.status);
    return true;
  }
  const { taskSpace } = resolved;
  const sessionParams = fullRuntimeSessionParams(url);
  const metadata = deps.listWorkspaceFiles(db, {
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: taskSpace.slug,
    oplSessionId: sessionParams.oplSessionId,
    runId: sessionParams.oplSessionId,
    sessionId: sessionParams.oplSessionId,
    resourceBindingId: sessionParams.resourceBindingId,
  });
  const storage = mergeWorkspaceStorageSnapshotWithIndex(await deps.fetchWorkspaceStorageSnapshot(taskSpace), metadata);
  const userStorage = await deps.fetchWorkspaceUserStorageState(user.id, taskSpace.slug);
  const entitlement = deps.workspaceStorageEntitlement(db, user, taskSpace.slug);
  deps.sendJson(res, {
    workspaceId: taskSpace.slug,
    entitlement: publicStorageEntitlementView(entitlement),
    storage,
    userStorage,
    metadata: metadata.map(publicWorkspaceFileMetadata),
  });
  return true;
}

async function handleEntitlement(deps, { req, res, url, db, user }) {
  if (req.method !== "GET" || url.pathname !== "/portal/api/storage/entitlement") return false;
  const resolved = await resolveTaskSpace(deps, { db, user, task: url.searchParams.get("task") || url.searchParams.get("workspaceId") });
  if (!resolved.ok) {
    deps.sendJson(res, { error: resolved.error }, resolved.status);
    return true;
  }
  const { taskSpace } = resolved;
  deps.sendJson(res, {
    workspaceId: taskSpace.slug,
    entitlement: publicStorageEntitlementView(deps.workspaceStorageEntitlement(db, user, taskSpace.slug)),
  });
  return true;
}

async function handleStorageOrder(deps, { req, res, url, db, user }) {
  if (req.method !== "POST" || url.pathname !== "/portal/api/storage/orders") return false;
  const payload = await readJsonBody(deps, req, res);
  if (!payload) return true;
  const resolved = await resolveTaskSpace(deps, { db, user, task: payload.task || payload.workspaceId });
  if (!resolved.ok) {
    deps.sendJson(res, { error: resolved.error }, resolved.status);
    return true;
  }
  const { taskSpace } = resolved;
  const storageSizeGb = Math.max(0, Number(payload.storageSizeGb ?? payload.storage_size_gb ?? 0));
  if (storageSizeGb < 10) {
    deps.sendJson(res, { error: "minimum_storage_10gb_required", minimumPurchaseGb: 10 }, 400);
    return true;
  }
  const created = deps.createOrUpdateStorageOrder(db, {
    tenantId: user.tenantId || user.id,
    userId: user.id,
    workspaceId: taskSpace.slug,
    storageSizeGb,
    storagePlanId: String(payload.storagePlanId || `cos-${storageSizeGb}gb`),
    storageBackend: "cos",
    retentionPolicy: "order_lifecycle",
    sourceType: "portal_storage_order",
  });
  if (!created.ok) {
    deps.sendJson(res, { error: created.error || "storage_order_failed" }, created.status || 400);
    return true;
  }
  await deps.logPortalEvent({
    type: "workspace_storage_order_created",
    userId: user.id,
    workspaceId: taskSpace.slug,
    storageSizeGb,
    storageOrderId: created.order.id,
  });
  await persistStorageOrder(deps, db, taskSpace, created);
  deps.sendJson(res, {
    ok: true,
    workspaceId: taskSpace.slug,
    order: publicStorageOrderView(created.order),
    entitlement: publicStorageEntitlementView(deps.workspaceStorageEntitlement(db, user, taskSpace.slug)),
  }, created.created ? 201 : 200);
  return true;
}

async function handleUploadUrl(deps, { req, res, url, db, user }) {
  if (req.method !== "POST" || url.pathname !== "/portal/api/workspace/files/upload-url") return false;
  const payload = await readJsonBody(deps, req, res);
  if (!payload) return true;
  const resolved = await resolveTaskSpace(deps, { db, user, task: payload.task || payload.workspaceId });
  if (!resolved.ok) {
    deps.sendJson(res, { error: resolved.error }, resolved.status);
    return true;
  }
  const { taskSpace } = resolved;
  if (taskSpace.status !== "active") {
    deps.sendJson(res, { error: "workspace_not_active" }, 409);
    return true;
  }
  const entitlement = deps.workspaceStorageEntitlement(db, user, taskSpace.slug);
  const uploadError = storageUploadError(entitlement);
  if (uploadError) {
    sendUploadEntitlementError(deps, res, entitlement, uploadError);
    return true;
  }
  const relativePath = deps.safeRelativePath(payload.relativePath || payload.fileName || payload.name || "");
  if (!relativePath) {
    deps.sendJson(res, { error: "invalid_relative_path" }, 400);
    return true;
  }
  const fullRuntime = resolveFullRuntimeStorageContext(deps, { db, user, taskSpace, relativePath, kind: "inputs", input: payload });
  if (!fullRuntime.ok) {
    deps.sendJson(res, { error: fullRuntime.error }, fullRuntime.status || 409);
    return true;
  }
  sendUploadUrlResponse(deps, { res, taskSpace, fullRuntime, relativePath });
  return true;
}

function sendUploadUrlResponse(deps, { res, taskSpace, fullRuntime, relativePath }) {
  const issued = deps.issueWorkspaceTransferToken({
    action: "upload",
    ...fullRuntime.storageContext,
    ttlMs: 10 * 60 * 1000,
  });
  deps.sendJson(res, {
    workspaceId: taskSpace.slug,
    provider: "portal_signed_proxy",
    method: "POST",
    expiresAt: issued.expiresAt,
    url: `/portal/workspace/files/upload-signed?token=${encodeURIComponent(issued.token)}`,
    file: {
      kind: "inputs",
      name: fullRuntime.storageContext.fileName,
      relativePath,
      storageKey: fullRuntime.storageContext.storageKey,
      contentType: deps.guessContentType(relativePath),
    },
  });
}

async function handleDownloadUrl(deps, { req, res, url, db, user }) {
  if (req.method !== "GET" || url.pathname !== "/portal/api/workspace/files/download-url") return false;
  const resolved = await resolveTaskSpace(deps, { db, user, task: url.searchParams.get("task") || url.searchParams.get("workspaceId") });
  if (!resolved.ok) {
    deps.sendJson(res, { error: resolved.error }, resolved.status);
    return true;
  }
  const { taskSpace } = resolved;
  const kind = url.searchParams.get("kind") === "outputs" ? "outputs" : "inputs";
  const relativePath = deps.safeRelativePath(url.searchParams.get("relativePath") || url.searchParams.get("file") || "");
  if (!relativePath) {
    deps.sendJson(res, { error: "invalid_relative_path" }, 400);
    return true;
  }
  const sessionParams = fullRuntimeSessionParams(url);
  const download = resolveIndexedDownload(deps, { db, user, taskSpace, kind, relativePath, ...sessionParams });
  if (!download.ok) {
    deps.sendJson(res, { error: download.error }, download.status);
    return true;
  }
  sendDownloadUrlResponse(deps, { res, user, taskSpace, kind, relativePath, sessionParams, download });
  return true;
}

function sendDownloadUrlResponse(deps, { res, user, taskSpace, kind, relativePath, sessionParams, download }) {
  const issued = deps.issueWorkspaceTransferToken({
    action: "download",
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: taskSpace.slug,
    oplSessionId: sessionParams.oplSessionId,
    resourceBindingId: text(download.binding.resourceBindingId || download.binding.id),
    kind,
    relativePath,
    fileName: fileNameFrom(relativePath),
    storageKey: download.indexedFile.storageKey,
    localPath: download.indexedFile.localPath,
    ttlMs: 10 * 60 * 1000,
  });
  deps.sendJson(res, {
    workspaceId: taskSpace.slug,
    provider: "portal_signed_proxy",
    method: "GET",
    expiresAt: issued.expiresAt,
    url: `/portal/workspace/files/download-signed?token=${encodeURIComponent(issued.token)}`,
    file: {
      kind,
      name: fileNameFrom(relativePath),
      relativePath,
    },
  });
}

async function handleSignedUpload(deps, { req, res, url, db, user }) {
  if (req.method !== "POST" || url.pathname !== "/portal/workspace/files/upload-signed") return false;
  const tokenPayload = deps.readWorkspaceTransferToken(url.searchParams.get("token") || "", "upload");
  if (!isTransferTokenForUser(tokenPayload, user)) {
    deps.sendJson(res, { error: "invalid_or_expired_transfer_token" }, 403);
    return true;
  }
  const taskSpace = deps.findTaskSpace(db, user.id, tokenPayload.workspaceId)
    || await deps.ensureTaskSpace(db, user, tokenPayload.workspaceId, deps.defaultTaskTitle(tokenPayload.workspaceId));
  const gate = signedUploadGate(deps, { db, user, taskSpace, tokenPayload });
  if (!gate.ok) {
    deps.sendJson(res, { error: gate.error, ...(gate.entitlement ? { entitlement: gate.entitlement } : {}) }, gate.status);
    return true;
  }
  const uploadFile = await readSignedUploadFile(deps, req, tokenPayload);
  if (!uploadFile.ok) {
    deps.sendJson(res, { error: uploadFile.error }, uploadFile.status);
    return true;
  }
  const saved = await persistSignedUpload(deps, { db, user, taskSpace, tokenPayload, uploadFile, binding: gate.binding });
  if (!saved.ok) {
    deps.sendJson(res, { error: saved.error || "workspace_upload_failed" }, saved.status || 400);
    return true;
  }
  await deps.logPortalEvent({ type: "workspace_input_uploaded", userId: user.id, workspaceId: taskSpace.slug, fileCount: 1, fileName: saved.file.name });
  await persistStorageRouteDb(deps, { db, taskSpace, file: saved.file });
  deps.sendJson(res, { ok: true, workspaceId: taskSpace.slug, file: saved.file });
  return true;
}

async function persistSignedUpload(deps, { db, user, taskSpace, tokenPayload, uploadFile, binding }) {
  return deps.persistWorkspaceUpload({
    db,
    user,
    taskSpace,
    kind: tokenPayload.kind,
    file: {
      ...uploadFile.file,
      relativePath: tokenPayload.relativePath,
      name: tokenPayload.fileName || uploadFile.file.name,
      storageTarget: buildSignedUploadStorageTarget({ tokenPayload, user, taskSpace, binding }),
    },
  });
}

async function handleSignedDownload(deps, { req, res, url, user }) {
  if (req.method !== "GET" || url.pathname !== "/portal/workspace/files/download-signed") return false;
  const tokenPayload = deps.readWorkspaceTransferToken(url.searchParams.get("token") || "", "download");
  if (!isTransferTokenForUser(tokenPayload, user)) {
    deps.sendJson(res, { error: "invalid_or_expired_transfer_token" }, 403);
    return true;
  }
  const db = await deps.readDb();
  const taskSpace = deps.findTaskSpace(db, user.id, tokenPayload.workspaceId);
  if (!taskSpace) {
    deps.sendJson(res, { error: "workspace_not_found" }, 404);
    return true;
  }
  const binding = findActiveWorkspaceBinding(deps, db, user, taskSpace.slug, tokenPayload.resourceBindingId);
  if (!binding) {
    deps.sendJson(res, { error: "workspace_storage_binding_inactive" }, 409);
    return true;
  }
  return await sendSignedDownloadFile(deps, { res, db, user, taskSpace, tokenPayload });
}

async function sendSignedDownloadFile(deps, { res, db, user, taskSpace, tokenPayload }) {
  const kind = tokenPayload.kind === "outputs" ? "outputs" : "inputs";
  const relativePath = deps.safeRelativePath(tokenPayload.relativePath || "");
  const download = resolveIndexedDownload(deps, {
    db,
    user,
    taskSpace,
    kind,
    relativePath,
    oplSessionId: tokenPayload.oplSessionId,
    resourceBindingId: tokenPayload.resourceBindingId,
  });
  if (!download.ok) {
    deps.sendJson(res, { error: download.error }, download.status);
    return true;
  }
  const verifiedPath = verifiedIndexedLocalPath(deps, taskSpace, download.indexedFile);
  if (!verifiedPath) {
    deps.sendJson(res, { error: "workspace_file_path_invalid" }, 409);
    return true;
  }
  if (!(await deps.exists(verifiedPath))) {
    deps.sendJson(res, { error: "file_not_found" }, 404);
    return true;
  }
  deps.sendFile(res, verifiedPath, tokenPayload.fileName || fileNameFrom(relativePath), deps.guessContentType(relativePath));
  return true;
}

export function createWorkspaceStorageRouteHandler(deps) {
  return async function handleWorkspaceStorageRoutes(context) {
    if (await handleWorkspaceStorageSnapshot(deps, context)) return true;
    if (await handleEntitlement(deps, context)) return true;
    if (await handleStorageOrder(deps, context)) return true;
    if (await handleUploadUrl(deps, context)) return true;
    if (await handleDownloadUrl(deps, context)) return true;
    if (await handleSignedUpload(deps, context)) return true;
    if (await handleSignedDownload(deps, context)) return true;
    return false;
  };
}
