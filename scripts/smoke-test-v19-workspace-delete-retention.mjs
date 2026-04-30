import assert from "node:assert/strict";

const storage = await import(new URL(["..", "services", "portal", "src", "domain", "workspace-storage.mjs"].join("/"), import.meta.url));

const db = { storageOrders: [], workspaceFiles: [] };
const user = { id: "user-retention", tenantId: "tenant-retention" };
const workspaceId = "analysis";

storage.createOrUpdateStorageOrder(db, {
  tenantId: user.tenantId,
  userId: user.id,
  workspaceId,
  storageSizeGb: 10,
  storageBackend: "cos",
});
storage.recordWorkspaceFile(db, {
  tenantId: user.tenantId,
  userId: user.id,
  workspaceId,
  kind: "outputs",
  name: "result.csv",
  relativePath: "result.csv",
  storageKey: storage.buildWorkspaceStorageKey(user.tenantId, workspaceId, "outputs", "result.csv"),
  sizeBytes: 12,
});

const marked = storage.markWorkspaceStorageDeleting(db, {
  user,
  workspaceId,
  deletedAt: "2026-04-30T00:00:00.000Z",
  retentionDays: 7,
});
assert.equal(marked.storageOrderCount, 1);
assert.equal(marked.fileCount, 1);
assert.equal(db.storageOrders[0].status, "deleting");
assert.equal(db.workspaceFiles[0].status, "deleting");
assert.equal(storage.workspaceStorageCleanupCandidates(db, { now: "2026-05-06T23:59:59.000Z", retentionDays: 7 }).storageOrders.length, 0);
const due = storage.workspaceStorageCleanupCandidates(db, { now: "2026-05-07T00:00:00.000Z", retentionDays: 7 });
assert.equal(due.storageOrders.length, 1);
assert.equal(due.workspaceFiles.length, 1);

console.log(JSON.stringify({
  ok: true,
  cleanupAfterAt: marked.cleanupAfterAt,
  dueStorageOrders: due.storageOrders.length,
  dueWorkspaceFiles: due.workspaceFiles.length,
}, null, 2));
