import assert from "node:assert/strict";

const { createWorkspaceStorageRoutes } = await import("../services/portal/src/routes/workspace-storage.routes.mjs");

function createResponseRecorder() {
  return { statusCode: null, payload: null };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

const db = {
  storageOrders: [],
  workspaceFiles: [{
    tenantId: "user-1",
    userId: "user-1",
    workspaceId: "analysis",
    kind: "inputs",
    name: "input.csv",
    relativePath: "input.csv",
  }],
};

const user = { id: "user-1", tenantId: "tenant-1", currentTaskSlug: "analysis" };
const calls = [];
const route = createWorkspaceStorageRoutes({
  buildWorkspaceStorageKey: (tenantId, workspaceId, kind, relativePath) => `${tenantId}/${workspaceId}/${kind}/${relativePath}`,
  createOrUpdateStorageOrder: (_db, input) => ({ ok: true, created: true, order: { id: "storage-order-1", ...input } }),
  defaultTaskTitle: (slug) => `Task ${slug}`,
  ensureTaskSpace: async (_db, targetUser, slug, title) => ({ slug, userId: targetUser.id, title, status: "active" }),
  fetchWorkspaceMinioState: async () => ({ ok: true, source: "minio" }),
  fetchWorkspaceStorageSnapshot: async () => ({ source: "workspace_file_system", inputsCount: 1, outputsCount: 0 }),
  findTaskSpace: (_db, userId, slug) => ({ slug, userId, status: "active" }),
  guessContentType: (relativePath) => relativePath.endsWith(".csv") ? "text/csv" : "application/octet-stream",
  issueWorkspaceTransferToken: (payload) => ({ token: `token-${payload.action}-${payload.relativePath}`, expiresAt: "2026-05-01T00:10:00.000Z" }),
  listWorkspaceFiles: () => db.workspaceFiles,
  logPortalEvent: async (event) => calls.push(["event", event]),
  readBody: async (req) => Buffer.from(req.body || "{}"),
  safeRelativePath: (value) => String(value || "").replace(/^\/+/, ""),
  sendJson,
  slugify: (value) => String(value || "default").toLowerCase(),
  workspaceStorageEntitlement: () => ({ enabled: true, storageSizeGb: 10 }),
  writeDb: async (targetDb) => calls.push(["write", targetDb]),
});

async function request(method, path, body = "") {
  const res = createResponseRecorder();
  const handled = await route({
    req: { method, body },
    res,
    url: new URL(path, "http://portal.local"),
    db,
    user,
  });
  return { handled, res };
}

let result = await request("GET", "/portal/api/workspace/storage?task=analysis");
assert.equal(result.handled, true, "workspace_storage_snapshot_must_be_handled");
assert.equal(result.res.payload.workspaceId, "analysis", "workspace_storage_snapshot_must_echo_workspace");
assert.equal(result.res.payload.metadata.length, 1, "workspace_storage_snapshot_must_include_metadata");

result = await request("POST", "/portal/api/storage/orders", JSON.stringify({ workspaceId: "analysis", storageSizeGb: 10 }));
assert.equal(result.res.statusCode, 201, "storage_order_create_must_return_201");
assert.equal(result.res.payload.order.storageBackend, "cos", "storage_order_must_use_cos_backend");

result = await request("POST", "/portal/api/workspace/files/upload-url", JSON.stringify({ workspaceId: "analysis", relativePath: "input.csv" }));
assert.equal(result.res.payload.method, "POST", "upload_url_must_use_post");
assert.equal(result.res.payload.url, "/portal/workspace/files/upload-signed?token=token-upload-input.csv", "upload_url_must_issue_signed_proxy_url");
assert.equal(result.res.payload.file.storageKey, "tenant-1/analysis/inputs/input.csv", "upload_url_must_include_storage_key");
assert.equal(result.res.payload.file.contentType, "text/csv", "upload_url_must_include_content_type");

result = await request("GET", "/portal/api/workspace/files/download-url?workspaceId=analysis&relativePath=input.csv");
assert.equal(result.res.payload.method, "GET", "download_url_must_use_get");
assert.equal(result.res.payload.url, "/portal/workspace/files/download-signed?token=token-download-input.csv", "download_url_must_issue_signed_proxy_url");

result = await request("GET", "/portal/api/not-workspace-storage");
assert.equal(result.handled, false, "unmatched_workspace_storage_route_must_not_be_claimed");

console.log(JSON.stringify({
  ok: true,
  contract: "workspace_storage_routes",
}, null, 2));
