export function createPortalStoreDbAuth({
  ensureStorageInfra,
  ensurePgPool,
  ensureRedis,
  namespace,
  pgTableName,
  readJsonDb,
  seedPostgresIfEmpty,
  storageMode,
  writeDb,
}) {
  async function readAuthDb() {
    await ensureStorageInfra();
    if (storageMode() === "json") {
      return readJsonDb();
    }
    const pool = await ensurePgPool();
    const redis = await ensureRedis();
    await seedPostgresIfEmpty(pool);
    const [usersRes, settingsRes] = await Promise.all([
      pool.query(`SELECT id,email,name,role,status,password_hash,current_task_slug,group_id,preferences_json,created_at FROM ${pgTableName("users")}`),
      pool.query(`SELECT key,value_json FROM ${pgTableName("portal_settings")}`),
    ]);
    const sessionKeys = await redis.keys(`${namespace}:session:*`);
    const sessionValues = sessionKeys.length ? await redis.mGet(sessionKeys) : [];
    const sessions = sessionValues.map((value) => {
      try {
        return JSON.parse(String(value || ""));
      } catch {
        return null;
      }
    }).filter((value) => value && typeof value === "object");
    return {
      users: usersRes.rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        status: row.status,
        passwordHash: row.password_hash,
        currentTaskSlug: row.current_task_slug,
        groupId: row.group_id,
        preferences: row.preferences_json || { theme: "light" },
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      })),
      sessions,
      wallets: [],
      taskSpaces: [],
      workspaceSessions: [],
      storageOrders: [],
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
      settings: Object.fromEntries(settingsRes.rows.map((row) => [row.key, row.value_json])),
    };
  }

  async function persistPortalSessions(db) {
    await ensureStorageInfra();
    if (storageMode() === "json") {
      await writeDb(db);
      return;
    }
    const redis = await ensureRedis();
    for (const session of db.sessions || []) {
      if (!session?.id) continue;
      await redis.set(`${namespace}:session:${session.id}`, JSON.stringify(session), { EX: 7 * 24 * 60 * 60 });
    }
  }

  return {
    persistPortalSessions,
    readAuthDb,
  };
}
