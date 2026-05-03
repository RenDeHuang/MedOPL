import assert from "node:assert/strict";

const {
  activateLabSubscription,
  purchaseLabStorageAddon,
} = await import("../services/portal/src/domain/lab-subscriptions.mjs");
const {
  resolveLabEntitlement,
  storageUsageRatio,
} = await import("../services/portal/src/domain/lab-entitlements.mjs");
const {
  recordWorkspaceFile,
  resolveWorkspaceStorageEntitlement,
} = await import("../services/portal/src/domain/workspace-storage.mjs");

const db = {
  wallets: [{ userId: "user-v20-storage", balance: 500 }],
  ledger: [],
  storageOrders: [],
  workspaceFiles: [],
  labSubscriptions: [],
  labPackageEvents: [],
  labStorageAddons: [],
  labDailyCharges: [],
};
const user = { id: "user-v20-storage", tenantId: "tenant-v20-storage" };

const before = resolveWorkspaceStorageEntitlement(db, user, "default");
assert.equal(before.enabled, false, "storage_should_start_disabled_without_subscription");

const activated = activateLabSubscription(db, {
  user,
  workspaceId: "default",
  packageId: "starter",
  idempotencyKey: "activate-storage-starter",
  now: "2026-05-03T00:00:00.000Z",
});
assert.equal(activated.ok, true, `activation_failed:${activated.error}`);

const entitlement = resolveLabEntitlement(db, { user, workspaceId: "default" });
assert.equal(entitlement.enabled, true);
assert.equal(entitlement.packageId, "starter");
assert.equal(entitlement.storage.includedGb, 10);
assert.equal(entitlement.storage.totalGb, 10);
assert.equal(entitlement.compute.cores, 2);
assert.equal(entitlement.gates.canUpload, true);
assert.equal(entitlement.gates.canRun, true);
assert.equal(entitlement.gates.canDownload, true);

const workspaceEntitlement = resolveWorkspaceStorageEntitlement(db, user, "default");
assert.equal(workspaceEntitlement.enabled, true, "workspace_storage_should_use_lab_entitlement");
assert.equal(workspaceEntitlement.sourceType, "lab_package");
assert.equal(workspaceEntitlement.storageSizeGb, 10);
assert.equal(workspaceEntitlement.storageBackend, "package_storage");
assert.equal(workspaceEntitlement.cosPrefix, "workspaces/tenant-v20-storage/default/");

const addon = purchaseLabStorageAddon(db, {
  user,
  subscriptionId: activated.subscription.id,
  storageGb: 100,
  idempotencyKey: "addon-100gb-once",
  now: "2026-05-03T01:00:00.000Z",
});
assert.equal(addon.ok, true, `addon_failed:${addon.error}`);
assert.equal(addon.created, true);
assert.equal(resolveLabEntitlement(db, { user, workspaceId: "default" }).storage.totalGb, 110);

recordWorkspaceFile(db, {
  tenantId: user.tenantId,
  userId: user.id,
  workspaceId: "default",
  kind: "inputs",
  relativePath: "large.bin",
  name: "large.bin",
  sizeBytes: 9 * 1024 ** 3,
});
const ratio = storageUsageRatio(db, { user, workspaceId: "default" });
assert.equal(ratio.usedGb, 9);
assert.equal(ratio.totalGb, 110);
assert.equal(ratio.warning, false);
assert.equal(ratio.blocked, false);

db.labSubscriptions[0].status = "grace_period";
const graceEntitlement = resolveLabEntitlement(db, { user, workspaceId: "default" });
assert.equal(graceEntitlement.gates.canUpload, false);
assert.equal(graceEntitlement.gates.canRun, false);
assert.equal(graceEntitlement.gates.canDownload, true);

console.log(JSON.stringify({
  ok: true,
  contract: "v20_lab_entitlements",
  storageTotalGb: resolveLabEntitlement(db, { user, workspaceId: "default" }).storage.totalGb,
  sourceType: workspaceEntitlement.sourceType,
}, null, 2));
