const CORE_COLLECTION_KEYS = [
  "users",
  "sessions",
  "wallets",
  "ledger",
  "workspaceSessions",
  "storageOrders",
  "userComputeInstances",
  "userStorageBuckets",
  "workspaceResourceBindings",
  "weeklyProtectionFreezes",
  "workspaceFiles",
  "cloudOperations",
  "cloudOperationJobs",
  "computeAllocations",
  "fileSpaceEntitlements",
  "cloudResourceProjections",
  "billingReconciliations",
  "labSubscriptions",
  "labPackageEvents",
  "labStorageAddons",
  "labDailyCharges",
  "userSandboxes",
  "groups",
];

function snapshotFields(db, keys) {
  return JSON.stringify(Object.fromEntries(keys.map((key) => [key, db[key]])));
}

function runSnapshotMigration(db, keys, migrate) {
  const before = snapshotFields(db, keys);
  migrate(db);
  return snapshotFields(db, keys) !== before;
}

export function runPortalStoreCollectionMigrations({
  db,
  ensureLabSubscriptionCollections,
  ensureWorkspaceStorageCollections,
}) {
  let changed = false;
  for (const key of CORE_COLLECTION_KEYS) {
    if (!Array.isArray(db[key])) {
      db[key] = [];
      changed = true;
    }
  }
  if (runSnapshotMigration(db, ["storageOrders", "workspaceFiles"], ensureWorkspaceStorageCollections)) {
    changed = true;
  }
  if (runSnapshotMigration(db, ["labSubscriptions", "labPackageEvents", "labStorageAddons", "labDailyCharges"], ensureLabSubscriptionCollections)) {
    changed = true;
  }
  return changed;
}
