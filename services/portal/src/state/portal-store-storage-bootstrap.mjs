export function createPortalStoreStorageBootstrap({
  atomicWriteJson,
  exists,
  hashPassword,
  mkdir,
  readFile,
  randomUUID,
  adminSeed,
  adminSeedBalance,
  dataFile,
  eventsFile,
  runtimeRoot,
  medWorkspaceRoot,
  medRunsRoot,
  storageMode,
  ensurePgPool,
  ensureRedis,
  assertPortalSchemaReady,
  pgTableName,
  getAccountingStore,
  getWorkspaceStore,
  getResourceOrderStore,
  getLabBillingStore,
  migrateDb,
  buildSeedDb,
  getWriteDb,
}) {
  let storageInfraPromise = null;

  async function ensureJsonDb() {
    await mkdir(runtimeRoot, { recursive: true });
    await mkdir(medWorkspaceRoot, { recursive: true });
    await mkdir(medRunsRoot, { recursive: true });
    if (await exists(dataFile)) return;
    const adminId = randomUUID();
    const seed = {
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
    await atomicWriteJson(dataFile, seed);
  }

  async function initializeStorageInfra() {
    await mkdir(runtimeRoot, { recursive: true });
    await mkdir(medWorkspaceRoot, { recursive: true });
    await mkdir(medRunsRoot, { recursive: true });
    if (storageMode() === "json") {
      await ensureJsonDb();
      return;
    }
    const pool = await ensurePgPool();
    await ensureRedis();
    await assertPortalSchemaReady({
      pool,
      pgTableName,
      targetVersion: "v20.32",
    });
    getAccountingStore();
    getWorkspaceStore();
    getResourceOrderStore();
    getLabBillingStore();
  }

  async function ensureStorageInfra() {
    if (!storageInfraPromise) {
      storageInfraPromise = initializeStorageInfra().catch((error) => {
        storageInfraPromise = null;
        throw error;
      });
    }
    return storageInfraPromise;
  }

  async function migrateLegacyAuditEvents(pool) {
    if (!(await exists(eventsFile))) return;
    const rawEvents = await readFile(eventsFile, "utf8");
    const lines = rawEvents.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        await pool.query(`INSERT INTO ${pgTableName("audit_events")} (id,type,user_id,operator_id,workspace_id,run_id,detail_json,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
          randomUUID(),
          String(event.type || ""),
          String(event.userId || ""),
          String(event.operatorId || ""),
          String(event.workspaceId || ""),
          String(event.runId || ""),
          JSON.stringify(event),
          String(event.occurredAt || new Date().toISOString()),
        ]);
      } catch {}
    }
  }

  async function seedPostgresIfEmpty(pool) {
    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM ${pgTableName("users")}`);
    if (Number(countRes.rows[0]?.count || 0)) return;
    let seed;
    let migrateEvents = false;
    if (await exists(dataFile)) {
      seed = JSON.parse(await readFile(dataFile, "utf8"));
      seed = (await migrateDb(seed)).db;
      migrateEvents = await exists(eventsFile);
    } else {
      seed = buildSeedDb();
    }
    await getWriteDb()(seed);
    if (migrateEvents) {
      await migrateLegacyAuditEvents(pool);
    }
  }

  return {
    ensureStorageInfra,
    seedPostgresIfEmpty,
  };
}
