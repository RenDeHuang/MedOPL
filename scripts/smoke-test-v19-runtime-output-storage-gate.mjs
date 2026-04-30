import assert from "node:assert/strict";

const storage = await import(new URL(["..", "services", "portal", "src", "domain", "workspace-storage.mjs"].join("/"), import.meta.url));

const db = { storageOrders: [], workspaceFiles: [] };
const user = { id: "user-output-gate", tenantId: "tenant-output-gate" };
const workspaceId = "default";

const disabled = storage.resolveWorkspaceStorageEntitlement(db, user, workspaceId);
assert.equal(disabled.enabled, false);

const order = storage.createOrUpdateStorageOrder(db, {
  tenantId: user.tenantId,
  userId: user.id,
  workspaceId,
  storageSizeGb: 10,
  storageBackend: "cos",
});
assert.equal(order.ok, true);
assert.equal(storage.resolveWorkspaceStorageEntitlement(db, user, workspaceId).enabled, true);

storage.markWorkspaceStorageDeleting(db, {
  user,
  workspaceId,
  deletedAt: "2026-04-30T00:00:00.000Z",
});
const deleting = storage.resolveWorkspaceStorageEntitlement(db, user, workspaceId);
assert.equal(deleting.enabled, false);
assert.equal(deleting.status, "disabled");

console.log(JSON.stringify({
  ok: true,
  disabled: disabled.enabled,
  activeAfterOrder: true,
  deletingBlocksOutput: deleting.enabled === false,
}, null, 2));
