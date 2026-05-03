import { randomUUID } from "node:crypto";
import path from "node:path";

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
      wallets: [{ userId: adminId, balance: 0, updatedAt: new Date().toISOString() }],
      ledger: [],
      taskSpaces: [],
      workspaceSessions: [],
      resourceOrders: [],
      resourceOrderEvents: [],
      storageOrders: [],
      workspaceFiles: [],
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
    for (const key of ["users", "sessions", "wallets", "ledger", "workspaceSessions", "resourceOrders", "resourceOrderEvents", "storageOrders", "workspaceFiles", "labSubscriptions", "labPackageEvents", "labStorageAddons", "labDailyCharges", "userSandboxes", "groups"]) {
      if (!Array.isArray(db[key])) {
        db[key] = [];
        changed = true;
      }
    }
    const resourceOrderStateBefore = JSON.stringify({
      ledger: db.ledger,
      resourceOrders: db.resourceOrders,
      resourceOrderEvents: db.resourceOrderEvents,
    });
    ensureResourceOrderCollections(db);
    if (JSON.stringify({
      ledger: db.ledger,
      resourceOrders: db.resourceOrders,
      resourceOrderEvents: db.resourceOrderEvents,
    }) !== resourceOrderStateBefore) {
      changed = true;
    }
    const workspaceStorageStateBefore = JSON.stringify({
      storageOrders: db.storageOrders,
      workspaceFiles: db.workspaceFiles,
    });
    ensureWorkspaceStorageCollections(db);
    if (JSON.stringify({
      storageOrders: db.storageOrders,
      workspaceFiles: db.workspaceFiles,
    }) !== workspaceStorageStateBefore) {
      changed = true;
    }
    const labSubscriptionStateBefore = JSON.stringify({
      labSubscriptions: db.labSubscriptions,
      labPackageEvents: db.labPackageEvents,
      labStorageAddons: db.labStorageAddons,
      labDailyCharges: db.labDailyCharges,
    });
    ensureLabSubscriptionCollections(db);
    if (JSON.stringify({
      labSubscriptions: db.labSubscriptions,
      labPackageEvents: db.labPackageEvents,
      labStorageAddons: db.labStorageAddons,
      labDailyCharges: db.labDailyCharges,
    }) !== labSubscriptionStateBefore) {
      changed = true;
    }
    if (!Array.isArray(db.taskSpaces)) {
      db.taskSpaces = (db.workspaces || []).map((item) => ({
        id: item.id || randomUUID(),
        userId: item.userId,
        slug: item.slug || "default",
        title: sanitizeTaskTitle(item.slug || "default", item.title || item.workspace_name || "Default Task"),
        path: item.path || item.workspace_root || getTaskPath(item.userId, item.slug || "default"),
        status: "active",
        createdAt: item.createdAt || item.created_at || new Date().toISOString(),
        updatedAt: item.updatedAt || item.updated_at || new Date().toISOString(),
      }));
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
    const adminPasswordHash = hashPassword(adminSeed.password);
    let seededAdmin = db.users.find((item) => item.email === adminSeed.email && item.role === "admin");
    if (!seededAdmin) {
      seededAdmin = {
        id: randomUUID(),
        email: adminSeed.email,
        name: adminSeed.name,
        role: "admin",
        status: "active",
        currentTaskSlug: "default",
        preferences: { theme: "light" },
        passwordHash: adminPasswordHash,
        createdAt: new Date().toISOString(),
      };
      db.users.push(seededAdmin);
      db.wallets.push({ userId: seededAdmin.id, balance: adminSeedBalance, updatedAt: new Date().toISOString() });
      changed = true;
    } else {
      if (seededAdmin.passwordHash !== adminPasswordHash) {
        seededAdmin.passwordHash = adminPasswordHash;
        changed = true;
      }
      if (!seededAdmin.preferences) {
        seededAdmin.preferences = { theme: "light" };
        changed = true;
      }
    }
    for (const user of db.users) {
      if (!user.status) {
        user.status = "active";
        changed = true;
      }
      if (!user.preferences || typeof user.preferences !== "object") {
        user.preferences = { theme: "light" };
        changed = true;
      }
      if (!user.preferences.theme) {
        user.preferences.theme = "light";
        changed = true;
      }
      if (!user.currentTaskSlug) {
        user.currentTaskSlug = "default";
        changed = true;
      }
      if (!("groupId" in user)) {
        user.groupId = "";
        changed = true;
      }
      if (ensureUserCommercialState(user, { grantTrial: false })) {
        changed = true;
      }
    }
    for (const group of db.groups) {
      if (!("balanceFloor" in group)) {
        group.balanceFloor = 0;
        changed = true;
      }
      if (!("maxWorkspaces" in group)) {
        group.maxWorkspaces = 0;
        changed = true;
      }
      if (!("maxConcurrentRuns" in group)) {
        group.maxConcurrentRuns = 0;
        changed = true;
      }
      if (!("allowMas" in group)) {
        group.allowMas = true;
        changed = true;
      }
      if (!("allowWorkspaceCreate" in group)) {
        group.allowWorkspaceCreate = true;
        changed = true;
      }
      if (!("cpuRequest" in group)) {
        group.cpuRequest = "";
        changed = true;
      }
      if (!("cpuLimit" in group)) {
        group.cpuLimit = "";
        changed = true;
      }
      if (!("memoryRequest" in group)) {
        group.memoryRequest = "";
        changed = true;
      }
      if (!("memoryLimit" in group)) {
        group.memoryLimit = "";
        changed = true;
      }
      if (!("gpuCount" in group)) {
        group.gpuCount = 0;
        changed = true;
      }
      if (!("storageRequest" in group)) {
        group.storageRequest = "";
        changed = true;
      }
      if (!("storageLimit" in group)) {
        group.storageLimit = "";
        changed = true;
      }
    }
    for (const taskSpace of db.taskSpaces) {
      const sanitizedTitle = sanitizeTaskTitle(taskSpace.slug, taskSpace.title);
      if (taskSpace.title !== sanitizedTitle) {
        taskSpace.title = sanitizedTitle;
        changed = true;
      }
      if (!taskSpace.status) {
        taskSpace.status = "active";
        changed = true;
      }
      if (!taskSpace.path) {
        taskSpace.path = getTaskPath(taskSpace.userId, taskSpace.slug || "default");
        changed = true;
      }
      const expectedTaskPath = getTaskPath(taskSpace.userId, taskSpace.slug || "default");
      if (path.normalize(String(taskSpace.path || "")) !== path.normalize(expectedTaskPath)) {
        taskSpace.path = expectedTaskPath;
        changed = true;
      }
      if (!taskSpace.createdAt) {
        taskSpace.createdAt = new Date().toISOString();
        changed = true;
      }
      if (!taskSpace.updatedAt) {
        taskSpace.updatedAt = taskSpace.createdAt;
        changed = true;
      }
      const normalizedServerPlan = normalizeServerPlanSelection(taskSpace.serverPlanSnapshot);
      if (JSON.stringify(normalizedServerPlan) !== JSON.stringify(taskSpace.serverPlanSnapshot || null)) {
        taskSpace.serverPlanSnapshot = normalizedServerPlan;
        changed = true;
      }
      const serverPlanId = normalizedServerPlan?.id || "";
      const serverPlanRegion = normalizedServerPlan?.region || "";
      if (String(taskSpace.serverPlanId || "") !== serverPlanId) {
        taskSpace.serverPlanId = serverPlanId;
        changed = true;
      }
      if (String(taskSpace.serverPlanRegion || "") !== serverPlanRegion) {
        taskSpace.serverPlanRegion = serverPlanRegion;
        changed = true;
      }
    }
    delete db.workspaces;
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
