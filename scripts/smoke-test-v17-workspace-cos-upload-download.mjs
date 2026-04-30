import {
  buildWorkspaceFileChecksum,
  buildWorkspaceStorageKey,
  createOrUpdateStorageOrder,
  issueWorkspaceTransferToken,
  listWorkspaceFiles,
  readWorkspaceTransferToken,
  recordWorkspaceFile,
  resolveWorkspaceStorageEntitlement,
} from "../services/portal/src/domain/workspace-storage.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const db = {
  storageOrders: [],
  workspaceFiles: [],
};
const user = {
  id: "tenant-workspace-cos-smoke",
  tenantId: "tenant-workspace-cos-smoke",
};
const workspaceId = "default";
const fileName = "hello.txt";
const content = Buffer.from("hello from v17 workspace storage\n", "utf8");
const checksum = buildWorkspaceFileChecksum(content);

const disabled = resolveWorkspaceStorageEntitlement(db, user, workspaceId);
assert(disabled.enabled === false, "storage_should_start_disabled");

const order = createOrUpdateStorageOrder(db, {
  tenantId: user.tenantId,
  userId: user.id,
  workspaceId,
  storageSizeGb: 10,
  storageBackend: "cos",
});
assert(order.ok === true, `storage_order_failed:${order.error}`);

const storageKey = buildWorkspaceStorageKey(user.tenantId, workspaceId, "inputs", fileName);
assert(storageKey === "workspaces/tenant-workspace-cos-smoke/default/inputs/hello.txt", `storage_key_mismatch:${storageKey}`);

const uploadToken = issueWorkspaceTransferToken({
  action: "upload",
  userId: user.id,
  workspaceId,
  kind: "inputs",
  relativePath: fileName,
  fileName,
});
const uploadPayload = readWorkspaceTransferToken(uploadToken.token, "upload");
assert(uploadPayload?.relativePath === fileName, "upload_token_payload_mismatch");
assert(readWorkspaceTransferToken(uploadToken.token, "upload") === null, "upload_token_should_be_single_use");

const recorded = recordWorkspaceFile(db, {
  tenantId: user.tenantId,
  userId: user.id,
  workspaceId,
  kind: "inputs",
  name: fileName,
  relativePath: fileName,
  storageKey,
  localPath: "scratch/hello.txt",
  sizeBytes: content.length,
  checksum,
  contentType: "text/plain",
  status: "active",
  source: "portal_upload",
});
assert(recorded.ok === true, `workspace_file_record_failed:${recorded.error}`);

const files = listWorkspaceFiles(db, {
  tenantId: user.tenantId,
  userId: user.id,
  workspaceId,
  kind: "inputs",
});
assert(files.length === 1, `workspace_file_count_mismatch:${files.length}`);
assert(files[0].storageKey === storageKey, "workspace_file_storage_key_mismatch");
assert(files[0].checksum === checksum, "workspace_file_checksum_mismatch");

const downloadToken = issueWorkspaceTransferToken({
  action: "download",
  userId: user.id,
  workspaceId,
  kind: "inputs",
  relativePath: fileName,
  fileName,
});
const downloadPayload = readWorkspaceTransferToken(downloadToken.token, "download");
assert(downloadPayload?.relativePath === fileName, "download_token_payload_mismatch");
assert(readWorkspaceTransferToken(downloadToken.token, "download") === null, "download_token_should_be_single_use");

console.log(JSON.stringify({
  ok: true,
  workspaceId,
  storageKey,
  checksum,
  fileCount: files.length,
}, null, 2));
