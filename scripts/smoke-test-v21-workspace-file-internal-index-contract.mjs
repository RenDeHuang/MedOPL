import assert from "node:assert/strict";
import path from "node:path";

const { createWorkspaceFilesInternalRoutes } = await import("../services/portal/src/routes/workspace-files-internal.routes.mjs");
const { createWorkspaceStorageRoutes } = await import("../services/portal/src/routes/workspace-storage.routes.mjs");
const { recordWorkspaceFile, listWorkspaceFiles, safeRelativePath } = await import("../services/portal/src/domain/workspace-storage.mjs");

function responseRecorder() {
  return { statusCode: 0, payload: null, file: null };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

function sendFile(res, filePath, fileName, contentType) {
  res.file = { filePath, fileName, contentType };
  res.statusCode = 200;
}

const db = {
  taskSpaces: [{ id: "task-1", userId: "user-v21-index", slug: "workspace-v21-index", title: "Workspace", path: "/tmp/workspace-v21-index", status: "active" }],
  workspaceResourceBindings: [{
    id: "binding-v21-index",
    resourceBindingId: "binding-v21-index",
    ownerTenantId: "tenant-v21-index",
    ownerUserId: "user-v21-index",
    workspaceId: "workspace-v21-index",
    computeInstanceId: "cvm-v21-index",
    storageBucketId: "bucket-v21-index",
    rootPrefix: "users/user-v21-index/workspaces/workspace-v21-index/",
    status: "active",
  }],
  workspaceFiles: [],
};

const user = {
  id: "user-v21-index",
  tenantId: "tenant-v21-index",
  currentTaskSlug: "workspace-v21-index",
};

const writes = [];
const transferTokens = [];
const sessionScopedOutputPath = path.join(
  "/tmp/workspace-v21-index",
  "users",
  "user-v21-index",
  "workspaces",
  "workspace-v21-index",
  "sessions",
  "opl-session-v21-index",
  "outputs",
  "result.json",
);
const internalRoute = createWorkspaceFilesInternalRoutes({
  defaultTaskTitle: (slug) => `Workspace ${slug}`,
  ensureTaskSpace: async (_db, targetUser, slug, title) => ({ id: `task-${slug}`, userId: targetUser.id, slug, title, path: `/tmp/${slug}`, status: "active" }),
  findTaskSpace: (_db, userId, slug) => db.taskSpaces.find((item) => item.userId === userId && item.slug === slug) || null,
  logPortalEvent: async (event) => writes.push(["event", event]),
  portalInternalAuthAllowed: (req) => req.headers["x-portal-internal-token"] === "internal-token-v21",
  readBody: async (req) => Buffer.from(req.body || "{}"),
  recordWorkspaceFile,
  safeRelativePath,
  sendJson,
  writeDb: {
    upsertWorkspaceFile: async (file) => writes.push(["upsertWorkspaceFile", file]),
  },
});

const storageRoute = createWorkspaceStorageRoutes({
  buildWorkspaceFileChecksum: () => "sha256:fixture",
  buildWorkspaceStorageKey: (tenantId, workspaceId, kind, relativePath, options = {}) =>
    `${options.rootPrefix || `users/${options.userId}/workspaces/${workspaceId}/`}sessions/${options.oplSessionId}/${kind}/${relativePath}`,
  createOrUpdateStorageOrder: () => ({ ok: true, created: true, order: { id: "storage-order-v21" } }),
  defaultTaskTitle: (slug) => `Workspace ${slug}`,
  ensureTaskSpace: async (_db, targetUser, slug, title) => ({ id: `task-${slug}`, userId: targetUser.id, slug, title, path: `/tmp/${slug}`, status: "active" }),
  exists: async () => true,
  fetchWorkspaceUserStorageState: async () => ({ ok: true, source: "user_storage" }),
  fetchWorkspaceStorageSnapshot: async () => ({ source: "workspace_file_system", inputsCount: 0, outputsCount: 1 }),
  findTaskSpace: (_db, userId, slug) => db.taskSpaces.find((item) => item.userId === userId && item.slug === slug) || null,
  guessContentType: (relativePath) => relativePath.endsWith(".json") ? "application/json" : "application/octet-stream",
  issueWorkspaceTransferToken: (payload) => {
    transferTokens.push(payload);
    return { token: `transfer-${payload.action}-${transferTokens.length}`, expiresAt: "2026-05-06T10:00:00.000Z" };
  },
  listWorkspaceFiles,
  logPortalEvent: async (event) => writes.push(["event", event]),
  mkdir: async () => {},
  path,
  readBody: async (req) => Buffer.from(req.body || "{}"),
  readDb: async () => db,
  readWorkspaceTransferToken: (token, expectedAction) => {
    const index = Number(String(token || "").split("-").pop()) - 1;
    const record = transferTokens[index] || null;
    return record?.action === expectedAction ? record : null;
  },
  recordWorkspaceFile,
  safeRelativePath,
  sendFile,
  sendJson,
  slugify: (value) => String(value || "default").toLowerCase(),
  stat: async () => ({ size: 42 }),
  syncWorkspaceFileToUserStorage: async () => {},
  workspaceStorageEntitlement: () => ({ enabled: true, gates: { canDownload: true, canUpload: true } }),
  writeFile: async () => {},
  writeDb: async () => writes.push(["writeDb", db]),
});

async function invoke(route, { method, pathname, body = {}, headers = {}, routeUser = user }) {
  const req = { method, headers, body: JSON.stringify(body) };
  const res = responseRecorder();
  const handled = await route({
    req,
    res,
    url: new URL(pathname, "http://portal.local"),
    db,
    user: routeUser,
  });
  return { handled, res };
}

let result = await invoke(internalRoute, {
  method: "POST",
  pathname: "/portal/internal/workspace-files/index",
  headers: { "x-portal-internal-token": "wrong" },
  body: {
    tenantId: "tenant-v21-index",
    userId: "user-v21-index",
    workspaceId: "workspace-v21-index",
    resourceBindingId: "binding-v21-index",
    oplSessionId: "opl-session-v21-index",
    kind: "outputs",
    relativePath: "result.json",
    localPath: sessionScopedOutputPath,
  },
});
assert.equal(result.handled, true, "internal_index_route_must_handle_auth_failure");
assert.equal(result.res.statusCode, 403, "internal_index_must_reject_bad_internal_token");
assert.equal(db.workspaceFiles.length, 0, "internal_index_auth_failure_must_not_write");

result = await invoke(internalRoute, {
  method: "POST",
  pathname: "/portal/internal/workspace-files/index",
  headers: { "x-portal-internal-token": "internal-token-v21" },
  body: {
    tenantId: "tenant-v21-index",
    userId: "user-v21-index",
    workspaceId: "workspace-v21-index",
    resourceBindingId: "binding-v21-index",
    oplSessionId: "opl-session-v21-index",
    kind: "outputs",
    relativePath: "result.json",
    name: "result.json",
    storageKey: "users/user-v21-index/workspaces/workspace-v21-index/sessions/opl-session-v21-index/outputs/result.json",
    localPath: "/tmp/workspace-v21-index/result.json",
    sizeBytes: 42,
    checksum: "sha256:result",
    contentType: "application/json",
    source: "runtime_agent_output",
  },
});
assert.equal(result.handled, true, "internal_index_route_must_handle_non_session_scoped_path");
assert.equal(result.res.statusCode, 422, "internal_index_must_reject_non_session_scoped_local_path");
assert.equal(result.res.payload.error, "workspace_file_path_invalid", "internal_index_non_session_scoped_path_error_mismatch");
assert.equal(db.workspaceFiles.length, 0, "internal_index_non_session_scoped_path_must_not_write");

result = await invoke(internalRoute, {
  method: "POST",
  pathname: "/portal/internal/workspace-files/index",
  headers: { "x-portal-internal-token": "internal-token-v21" },
  body: {
    tenantId: "tenant-v21-index",
    userId: "user-v21-index",
    workspaceId: "workspace-v21-index",
    resourceBindingId: "binding-v21-index",
    oplSessionId: "opl-session-v21-index",
    kind: "outputs",
    relativePath: "result.json",
    name: "result.json",
    storageKey: "users/user-v21-index/workspaces/workspace-v21-index/sessions/opl-session-v21-index/outputs/result.json",
    localPath: "/etc/passwd",
    sizeBytes: 42,
    checksum: "sha256:result",
    contentType: "application/json",
    source: "runtime_agent_output",
  },
});
assert.equal(result.handled, true, "internal_index_route_must_handle_root_external_path");
assert.equal(result.res.statusCode, 422, "internal_index_must_reject_root_external_local_path");
assert.equal(result.res.payload.error, "workspace_file_path_invalid", "internal_index_root_external_path_error_mismatch");
assert.equal(db.workspaceFiles.length, 0, "internal_index_root_external_path_must_not_write");

result = await invoke(internalRoute, {
  method: "POST",
  pathname: "/portal/internal/workspace-files/index",
  headers: { "x-portal-internal-token": "internal-token-v21" },
  body: {
    tenantId: "tenant-v21-index",
    userId: "user-v21-index",
    workspaceId: "workspace-v21-index",
    resourceBindingId: "binding-v21-index",
    oplSessionId: "opl-session-v21-index",
    kind: "outputs",
    relativePath: "../result.json",
    name: "result.json",
    storageKey: "users/user-v21-index/workspaces/workspace-v21-index/sessions/opl-session-v21-index/outputs/result.json",
    localPath: sessionScopedOutputPath,
    sizeBytes: 42,
    checksum: "sha256:result",
    contentType: "application/json",
    source: "runtime_agent_output",
  },
});
assert.equal(result.handled, true, "internal_index_route_must_handle_traversal_relative_path");
assert.equal(result.res.statusCode, 422, "internal_index_must_reject_traversal_relative_path");
assert.equal(result.res.payload.error, "workspace_file_path_invalid", "internal_index_traversal_relative_path_error_mismatch");
assert.equal(db.workspaceFiles.length, 0, "internal_index_traversal_relative_path_must_not_write");

result = await invoke(internalRoute, {
  method: "POST",
  pathname: "/portal/internal/workspace-files/index",
  headers: { "x-portal-internal-token": "internal-token-v21" },
  body: {
    tenantId: "tenant-v21-index",
    userId: "user-v21-index",
    workspaceId: "workspace-v21-index",
    resourceBindingId: "binding-v21-index",
    oplSessionId: "opl-session-v21-index",
    kind: "outputs",
    relativePath: "result.json",
    name: "result.json",
    storageKey: "users/user-v21-index/workspaces/workspace-v21-index/sessions/opl-session-v21-index/outputs/result.json",
    localPath: sessionScopedOutputPath,
    sizeBytes: 42,
    checksum: "sha256:result",
    contentType: "application/json",
    source: "runtime_agent_output",
  },
});
assert.equal(result.handled, true, "internal_index_route_must_handle_success");
assert.equal(result.res.statusCode, 201, "internal_index_create_must_return_201");
assert.equal(result.res.payload.ok, true, "internal_index_create_must_return_ok");
assert.equal(db.workspaceFiles.length, 1, "internal_index_must_record_workspace_file");
assert.equal(db.workspaceFiles[0].oplSessionId, "opl-session-v21-index", "internal_index_must_persist_opl_session_id");
assert.equal(db.workspaceFiles[0].resourceBindingId, "binding-v21-index", "internal_index_must_persist_resource_binding_id");
assert.equal(db.workspaceFiles[0].storageMode, "full_runtime", "internal_index_must_mark_full_runtime_storage_mode");
assert.equal(writes.some(([kind]) => kind === "upsertWorkspaceFile"), true, "internal_index_must_incrementally_upsert_workspace_file");

result = await invoke(storageRoute, {
  method: "GET",
  pathname: "/portal/api/workspace/files/download-url?workspaceId=workspace-v21-index&kind=outputs&relativePath=result.json&oplSessionId=opl-session-v21-index&resourceBindingId=binding-v21-index",
});
assert.equal(result.handled, true, "download_url_route_must_handle_indexed_output");
assert.equal(result.res.statusCode, 200, "download_url_must_succeed_after_internal_index");
assert.equal(result.res.payload.provider, "portal_signed_proxy", "download_url_provider_mismatch");
assert.equal(result.res.payload.file.relativePath || "result.json", "result.json", "download_url_must_keep_output_relative_path");

result = await invoke(storageRoute, {
  method: "GET",
  pathname: result.res.payload.url,
});
assert.equal(result.res.statusCode, 200, "signed_download_must_send_indexed_file");
assert.equal(result.res.file.filePath, sessionScopedOutputPath, "signed_download_must_use_verified_session_scoped_path");

result = await invoke(internalRoute, {
  method: "POST",
  pathname: "/portal/internal/workspace-files/index",
  headers: { "x-portal-internal-token": "internal-token-v21" },
  body: {
    tenantId: "tenant-v21-index",
    userId: "other-user",
    workspaceId: "workspace-v21-index",
    resourceBindingId: "binding-v21-index",
    oplSessionId: "opl-session-v21-index",
    kind: "outputs",
    relativePath: "other.json",
    localPath: "/tmp/other.json",
  },
});
assert.equal(result.res.statusCode, 409, "internal_index_must_reject_owner_mismatch");

console.log(JSON.stringify({
  ok: true,
  contract: "v21_workspace_file_internal_index",
  indexedFiles: db.workspaceFiles.length,
}, null, 2));
