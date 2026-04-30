import { createOrUpdateStorageOrder, resolveWorkspaceStorageEntitlement } from "../services/portal/src/domain/workspace-storage.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const db = {
  storageOrders: [],
  workspaceFiles: [],
};
const user = {
  id: "tenant-storage-smoke",
  tenantId: "tenant-storage-smoke",
};
const workspaceId = "default";

const before = resolveWorkspaceStorageEntitlement(db, user, workspaceId);
assert(before.enabled === false, "storage_should_start_disabled");
assert(before.freeQuotaGb === 0, "free_quota_should_be_zero");
assert(before.minimumPurchaseGb === 10, "minimum_purchase_should_be_10gb");
assert(before.cosPrefix === "workspaces/tenant-storage-smoke/default/", `cos_prefix_before_mismatch:${before.cosPrefix}`);

const created = createOrUpdateStorageOrder(db, {
  tenantId: user.tenantId,
  userId: user.id,
  workspaceId,
  storageSizeGb: 10,
  storageBackend: "cos",
});
assert(created.ok === true, `storage_order_failed:${created.error}`);
assert(created.order.storageSizeGb === 10, "storage_order_size_mismatch");

const after = resolveWorkspaceStorageEntitlement(db, user, workspaceId);
assert(after.enabled === true, "storage_should_enable_after_order");
assert(after.storageSizeGb === 10, "entitlement_size_mismatch");
assert(after.cosPrefix === "workspaces/tenant-storage-smoke/default/", `cos_prefix_after_mismatch:${after.cosPrefix}`);

console.log(JSON.stringify({
  ok: true,
  workspaceId,
  before,
  after,
  storageOrderId: created.order.id,
}, null, 2));
