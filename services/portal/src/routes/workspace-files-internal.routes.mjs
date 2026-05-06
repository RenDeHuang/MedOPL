import path from "node:path";
import {
  resolvePathInsideRoot,
  resolveRelativePathInsideRoot,
  safePathSegment,
  safeRelativePrefix,
} from "../domain/workspace-storage.mjs";

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function tenantIdFromBinding(binding = {}) {
  return text(binding.ownerTenantId || binding.tenantId || binding.userId);
}

function userIdFromBinding(binding = {}) {
  return text(binding.ownerUserId || binding.userId);
}

function bindingIdFrom(binding = {}) {
  return text(binding.resourceBindingId || binding.id);
}

function activeWorkspaceBinding(db, payload = {}) {
  const tenantId = text(payload.tenantId || payload.tenant_id);
  const userId = text(payload.userId || payload.user_id);
  const workspaceId = text(payload.workspaceId || payload.workspace_id);
  const resourceBindingId = text(payload.resourceBindingId || payload.resource_binding_id);
  if (!tenantId || !userId || !workspaceId || !resourceBindingId) return null;
  return (db.workspaceResourceBindings || []).find((binding) =>
    lower(binding.status || "active") === "active" &&
    text(binding.workspaceId || binding.workspace_id) === workspaceId &&
    bindingIdFrom(binding) === resourceBindingId &&
    userIdFromBinding(binding) === userId &&
    tenantIdFromBinding(binding) === tenantId
  ) || null;
}

function requiredPayloadFields(payload = {}) {
  return [
    "tenantId",
    "userId",
    "workspaceId",
    "resourceBindingId",
    "oplSessionId",
    "kind",
    "relativePath",
    "localPath",
  ].filter((field) => !text(payload[field] || payload[field.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)]));
}

function indexedWorkspaceFilePayload(deps, payload = {}, binding = {}, taskSpace = {}) {
  const tenantId = text(payload.tenantId || payload.tenant_id);
  const userId = text(payload.userId || payload.user_id);
  const workspaceId = text(payload.workspaceId || payload.workspace_id);
  const oplSessionId = safePathSegment(payload.oplSessionId || payload.opl_session_id || payload.runId || payload.run_id);
  const resourceBindingId = bindingIdFrom(binding);
  const kind = lower(payload.kind) === "outputs" ? "outputs" : lower(payload.kind) === "artifacts" ? "artifacts" : "inputs";
  const relativePath = deps.safeRelativePath(payload.relativePath || payload.relative_path || payload.name || "");
  const storageRootPrefix = safeRelativePrefix(binding.rootPrefix || binding.root_prefix || `users/${userId}/workspaces/${workspaceId}/`);
  const localPath = verifiedIndexedLocalPath({ payload, taskSpace, storageRootPrefix, oplSessionId, kind, relativePath });
  return {
    tenantId,
    userId,
    workspaceId,
    runId: oplSessionId,
    oplSessionId,
    resourceBindingId,
    storageMode: "full_runtime",
    storageRootPrefix,
    kind,
    relativePath,
    name: text(payload.name || relativePath.split("/").pop()),
    storageKey: text(payload.storageKey || payload.storage_key),
    localPath,
    sizeBytes: Number(payload.sizeBytes ?? payload.size_bytes ?? 0),
    checksum: text(payload.checksum),
    contentType: text(payload.contentType || payload.content_type || "application/octet-stream") || "application/octet-stream",
    status: text(payload.status || "active") || "active",
    source: text(payload.source || "runtime_agent_output") || "runtime_agent_output",
    createdAt: text(payload.createdAt || payload.created_at),
    updatedAt: text(payload.updatedAt || payload.updated_at),
    taskSpace,
  };
}

function verifiedIndexedLocalPath({ payload = {}, taskSpace = {}, storageRootPrefix = "", oplSessionId = "", kind = "inputs", relativePath = "" } = {}) {
  const requestedLocalPath = text(payload.localPath || payload.local_path);
  if (!requestedLocalPath || !text(taskSpace.path) || !storageRootPrefix || !oplSessionId || !relativePath) return "";
  const expectedPath = resolveRelativePathInsideRoot(
    path,
    taskSpace.path,
    `${storageRootPrefix}/sessions/${oplSessionId}/${kind}/${relativePath}`,
  );
  const resolvedRequestedPath = resolvePathInsideRoot(path, taskSpace.path, requestedLocalPath);
  return expectedPath && resolvedRequestedPath && expectedPath === resolvedRequestedPath ? expectedPath : "";
}

async function readJsonBody(deps, req, res) {
  try {
    return JSON.parse((await deps.readBody(req)).toString("utf8") || "{}");
  } catch {
    deps.sendJson(res, { ok: false, error: "invalid_json_body" }, 400);
    return null;
  }
}

async function persistIndexedWorkspaceFile(deps, { db, file, taskSpace }) {
  if (typeof deps.writeDb.upsertWorkspaceFile === "function") {
    if (typeof deps.writeDb.upsertTaskSpace === "function" && taskSpace) {
      await deps.writeDb.upsertTaskSpace(taskSpace);
    }
    await deps.writeDb.upsertWorkspaceFile(file);
    return;
  }
  await deps.writeDb(db);
}

export function createWorkspaceFilesInternalRoutes({
  defaultTaskTitle,
  ensureTaskSpace,
  findTaskSpace,
  logPortalEvent,
  portalInternalAuthAllowed,
  readBody,
  recordWorkspaceFile,
  safeRelativePath,
  sendJson,
  writeDb,
}) {
  function rejectIfInternalAuthMissing(req, res) {
    if (portalInternalAuthAllowed(req)) return false;
    sendJson(res, { ok: false, error: "forbidden", message: "internal auth token mismatch" }, 403);
    return true;
  }

  async function handleWorkspaceFilesIndex({ req, res, url, db }) {
    if (req.method !== "POST" || url.pathname !== "/portal/internal/workspace-files/index") return false;
    if (rejectIfInternalAuthMissing(req, res)) return true;
    const payload = await readJsonBody({ readBody, sendJson }, req, res);
    if (!payload) return true;
    const missing = requiredPayloadFields(payload);
    if (missing.length) {
      sendJson(res, { ok: false, error: "missing_required_fields", fields: missing }, 422);
      return true;
    }
    const binding = activeWorkspaceBinding(db, payload);
    if (!binding) {
      sendJson(res, { ok: false, error: "workspace_resource_binding_inactive_or_owner_mismatch" }, 409);
      return true;
    }
    const userId = text(payload.userId || payload.user_id);
    const workspaceId = text(payload.workspaceId || payload.workspace_id);
    const taskSpace = findTaskSpace(db, userId, workspaceId)
      || await ensureTaskSpace(db, { id: userId, tenantId: text(payload.tenantId || payload.tenant_id), currentTaskSlug: workspaceId }, workspaceId, defaultTaskTitle(workspaceId));
    if (!taskSpace || text(taskSpace.status || "active").toLowerCase() !== "active") {
      sendJson(res, { ok: false, error: "workspace_not_active" }, 409);
      return true;
    }
    const filePayload = indexedWorkspaceFilePayload(
      { safeRelativePath },
      payload,
      binding,
      taskSpace,
    );
    if (!filePayload.oplSessionId || !filePayload.storageRootPrefix || !filePayload.relativePath || !filePayload.localPath) {
      sendJson(res, { ok: false, error: "workspace_file_path_invalid" }, 422);
      return true;
    }
    const recorded = recordWorkspaceFile(db, filePayload);
    if (!recorded.ok) {
      sendJson(res, recorded, recorded.status || 400);
      return true;
    }
    await persistIndexedWorkspaceFile({ writeDb }, { db, file: recorded.file, taskSpace });
    await logPortalEvent({
      type: "workspace_runtime_output_indexed",
      userId: filePayload.userId,
      workspaceId: filePayload.workspaceId,
      runId: filePayload.oplSessionId,
      resourceBindingId: filePayload.resourceBindingId,
      fileName: recorded.file.name,
    });
    sendJson(res, { ok: true, created: recorded.created, file: recorded.file }, recorded.created ? 201 : 200);
    return true;
  }

  return async function handleWorkspaceFilesInternalRoutes(context) {
    if (await handleWorkspaceFilesIndex(context)) return true;
    return false;
  };
}
