import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildWorkspaceFileChecksum, buildWorkspaceStorageKey, createOrUpdateStorageOrder, issueWorkspaceTransferToken, listWorkspaceFiles, readWorkspaceTransferToken, recordWorkspaceFile, resolveWorkspaceStorageEntitlement } from "../services/portal/src/domain/workspace-storage.mjs";
import { createWorkspaceStorageRoutes } from "../services/portal/src/routes/workspace-storage.routes.mjs";

function assertNoInternalStorageFields(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(/storageKey|objectKey|localPath|storageRootPrefix|resourceBindingId|signedUrl|presignedUrl/i.test(serialized), false, `${label}_must_not_expose_internal_storage_fields`);
  assert.equal(serialized.includes("rb-public-response"), false, `${label}_must_not_embed_resource_binding_id`);
  assert.equal(serialized.includes("users/user-public-response/workspaces/workspace-public-response"), false, `${label}_must_not_embed_storage_root_prefix`);
}

function responseRecorder() {
  return { statusCode: 0, payload: null };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

async function readBody(req) {
  return Buffer.from(req.body || "");
}

async function request(route, db, { method = "GET", urlPath = "/", body = "", user }) {
  const res = responseRecorder();
  const handled = await route({
    req: { method, body, headers: { "content-type": "multipart/form-data; boundary=v22-public-response-boundary" } },
    res,
    url: new URL(urlPath, "http://portal.local"),
    db,
    user,
  });
  return { handled, res };
}

function multipartBody({ name, contentType, content }) {
  return [
    "--v22-public-response-boundary",
    `Content-Disposition: form-data; name="file"; filename="${name}"`,
    `Content-Type: ${contentType}`,
    "",
    content,
    "--v22-public-response-boundary--",
    "",
  ].join("\r\n");
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-workspace-storage-public-response-"));
try {
  const user = { id: "user-public-response", tenantId: "tenant-public-response" };
  const taskSpace = {
    userId: user.id,
    slug: "workspace-public-response",
    title: "Workspace Public Response",
    status: "active",
    path: path.join(tempRoot, "workspace-public-response"),
  };
  const db = {
    taskSpaces: [taskSpace],
    storageOrders: [{
      id: "storage-order-public-response",
      tenantId: user.tenantId,
      userId: user.id,
      workspaceId: taskSpace.slug,
      status: "active",
      storageSizeGb: 10,
    }],
    workspaceFiles: [],
    workspaceResourceBindings: [{
      id: "rb-public-response",
      resourceBindingId: "rb-public-response",
      tenantId: user.tenantId,
      ownerTenantId: user.tenantId,
      userId: user.id,
      ownerUserId: user.id,
      workspaceId: taskSpace.slug,
      status: "active",
      rootPrefix: `users/${user.id}/workspaces/${taskSpace.slug}/`,
    }],
  };
  let persistedDb = null;
  let synced = false;
  const route = createWorkspaceStorageRoutes({
    buildWorkspaceFileChecksum,
    buildWorkspaceStorageKey,
    createOrUpdateStorageOrder,
    defaultTaskTitle: (slug) => slug,
    ensureTaskSpace: async () => taskSpace,
    exists: async () => true,
    fetchWorkspaceStorageSnapshot: async () => ({ files: [] }),
    fetchWorkspaceUserStorageState: async () => ({ enabled: true }),
    findTaskSpace: (targetDb, userId, slug) => targetDb.taskSpaces.find((item) => item.userId === userId && item.slug === slug) || null,
    guessContentType: (relativePath) => relativePath.endsWith(".csv") ? "text/csv" : "application/octet-stream",
    issueWorkspaceTransferToken,
    listWorkspaceFiles,
    logPortalEvent: async () => {},
    mkdir: async () => {},
    path,
    readBody,
    readDb: async () => db,
    readWorkspaceTransferToken,
    recordWorkspaceFile,
    sendFile: () => {},
    sendJson,
    slugify: (value) => String(value || "").trim(),
    stat: async () => ({ size: 11 }),
    syncWorkspaceFileToUserStorage: async () => {
      synced = true;
    },
    workspaceStorageEntitlement: resolveWorkspaceStorageEntitlement,
    writeDb: async (targetDb) => {
      persistedDb = targetDb;
    },
    writeFile: async () => {},
  });

  const uploadUrl = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/workspace/files/upload-url",
    user,
    body: JSON.stringify({
      workspaceId: taskSpace.slug,
      relativePath: "inputs/dataset.csv",
      oplSessionId: "session-public-response",
    }),
  });
  assert.equal(uploadUrl.handled, true, "upload_url_route_must_handle_request");
  assert.equal(uploadUrl.res.statusCode, 200, "upload_url_must_return_200");
  assertNoInternalStorageFields(uploadUrl.res.payload.file, "upload_url_file");
  assert.equal(uploadUrl.res.payload.file.fileRef, "", "upload_url_file_ref_is_not_created_yet");
  assert.equal(uploadUrl.res.payload.file.kind, "inputs", "upload_url_file_kind_mismatch");
  assert.equal(uploadUrl.res.payload.file.name, "dataset.csv", "upload_url_file_name_mismatch");
  assert.equal(uploadUrl.res.payload.file.relativePath, "inputs/dataset.csv", "upload_url_file_relative_path_mismatch");
  assert.equal(uploadUrl.res.payload.file.contentType, "text/csv", "upload_url_file_content_type_mismatch");

  const token = new URL(uploadUrl.res.payload.url, "http://portal.local").searchParams.get("token");
  const signedUpload = await request(route, db, {
    method: "POST",
    urlPath: `/portal/workspace/files/upload-signed?token=${encodeURIComponent(token)}`,
    user,
    body: multipartBody({ name: "inputs/dataset.csv", contentType: "text/csv", content: "a,b\n1,2\n" }),
  });
  assert.equal(signedUpload.handled, true, "signed_upload_route_must_handle_request");
  assert.equal(signedUpload.res.statusCode, 200, "signed_upload_must_return_200");
  assert.equal(synced, true, "signed_upload_must_call_user_storage_sync");
  assertNoInternalStorageFields(signedUpload.res.payload.file, "signed_upload_file");
  assert.equal(signedUpload.res.payload.file.fileRef.startsWith(""), true, "signed_upload_file_ref_must_be_public_string");
  assert.equal(signedUpload.res.payload.file.kind, "inputs", "signed_upload_file_kind_mismatch");
  assert.equal(signedUpload.res.payload.file.name, "dataset.csv", "signed_upload_file_name_mismatch");
  assert.equal(signedUpload.res.payload.file.relativePath, "inputs/dataset.csv", "signed_upload_file_relative_path_mismatch");
  assert.equal(signedUpload.res.payload.file.contentType, "text/csv", "signed_upload_file_content_type_mismatch");
  assert.ok(persistedDb, "signed_upload_must_persist_db");

  const downloadUrl = await request(route, db, {
    method: "GET",
    urlPath: `/portal/api/workspace/files/download-url?workspaceId=${encodeURIComponent(taskSpace.slug)}&kind=inputs&relativePath=${encodeURIComponent("inputs/dataset.csv")}&oplSessionId=${encodeURIComponent("session-public-response")}`,
    user,
  });
  assert.equal(downloadUrl.handled, true, "download_url_route_must_handle_request");
  assert.equal(downloadUrl.res.statusCode, 200, "download_url_must_return_200_without_frontend_internal_binding_id");
  assertNoInternalStorageFields(downloadUrl.res.payload.file, "download_url_file");
  assert.equal(downloadUrl.res.payload.file.kind, "inputs", "download_url_file_kind_mismatch");
  assert.equal(downloadUrl.res.payload.file.name, "dataset.csv", "download_url_file_name_mismatch");
  assert.equal(downloadUrl.res.payload.file.relativePath, "inputs/dataset.csv", "download_url_file_relative_path_mismatch");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_workspace_storage_public_response",
    uploadUrlFileKeys: Object.keys(uploadUrl.res.payload.file).sort(),
    signedUploadFileKeys: Object.keys(signedUpload.res.payload.file).sort(),
    downloadUrlFileKeys: Object.keys(downloadUrl.res.payload.file).sort(),
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
