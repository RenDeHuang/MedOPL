import { randomUUID } from "node:crypto";
import { ensureSeedAdminAccount } from "./portal-store-migration-admin-seed.mjs";
import { runPortalStoreCollectionMigrations } from "./portal-store-migration-collections.mjs";
import { migrateTaskSpaces } from "./portal-store-migration-taskspaces.mjs";
import { migrateUsersAndGroups } from "./portal-store-migration-users-groups.mjs";

export function createPortalStoreMigrations({
  adminSeed,
  adminSeedBalance,
  hashPassword,
  normalizeAnnouncementRecord,
  normalizeLedgerEntries,
  normalizeServerPlanSelection,
  ensureResourceOrderCollections,
  ensureLabSubscriptionCollections,
  ensureUserCommercialState,
  ensureWorkspaceStorageCollections,
  sanitizeTaskTitle,
  getTaskPath,
}) {
  function buildSeedDb() {
    const adminId = randomUUID();
    return {
      users: [
        {
          id: adminId,
          email: adminSeed.email,
          name: adminSeed.name,
          role: "admin",
          status: "active",
          currentTaskSlug: "default",
          preferences: { theme: "light" },
          passwordHash: hashPassword(adminSeed.password),
          createdAt: new Date().toISOString(),
          groupId: "",
        },
      ],
      sessions: [],
      wallets: [{ userId: adminId, balance: adminSeedBalance, updatedAt: new Date().toISOString() }],
      ledger: [],
      taskSpaces: [],
      workspaceSessions: [],
      resourceOrders: [],
      resourceOrderEvents: [],
      storageOrders: [],
      userComputeInstances: [],
      userStorageBuckets: [],
      workspaceResourceBindings: [],
      weeklyProtectionFreezes: [],
      workspaceFiles: [],
      cloudOperations: [],
      cloudOperationJobs: [],
      computeAllocations: [],
      fileSpaceEntitlements: [],
      cloudResourceProjections: [],
      billingReconciliations: [],
      labSubscriptions: [],
      labPackageEvents: [],
      labStorageAddons: [],
      labDailyCharges: [],
      userSandboxes: [],
      groups: [],
      settings: {
        allowRegistration: String(process.env.PORTAL_ALLOW_REGISTRATION || "1") !== "0",
        announcements: [],
      },
    };
  }

  async function migrateDb(db) {
    let changed = false;
    if (runPortalStoreCollectionMigrations({
      db,
      ensureLabSubscriptionCollections,
      ensureResourceOrderCollections,
      ensureWorkspaceStorageCollections,
    })) {
      changed = true;
    }
    if (!db.settings || typeof db.settings !== "object") {
      db.settings = {
        allowRegistration: String(process.env.PORTAL_ALLOW_REGISTRATION || "1") !== "0",
        announcements: [],
      };
      changed = true;
    }
    if (!Array.isArray(db.settings.announcements)) {
      db.settings.announcements = [];
      changed = true;
    } else {
      const normalizedAnnouncements = db.settings.announcements.map(normalizeAnnouncementRecord).filter(Boolean);
      if (normalizedAnnouncements.length !== db.settings.announcements.length) {
        db.settings.announcements = normalizedAnnouncements;
        changed = true;
      }
    }
    if (ensureSeedAdminAccount({ adminSeed, adminSeedBalance, db, hashPassword })) {
      changed = true;
    }
    if (migrateUsersAndGroups({ db, ensureUserCommercialState })) {
      changed = true;
    }
    if (migrateTaskSpaces({ db, getTaskPath, normalizeServerPlanSelection, sanitizeTaskTitle })) {
      changed = true;
    }
    return {
      db: {
        ...db,
        ledger: normalizeLedgerEntries(db.ledger || []),
      },
      changed,
    };
  }

  return {
    buildSeedDb,
    migrateDb,
  };
}
