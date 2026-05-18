export function createPortalStoreDbCore({
  atomicWriteJson,
  dataFile,
  ensureStorageInfra,
  ensurePgPool,
  ensureRedis,
  migrateDb,
  namespace,
  normalizeLedgerEntries,
  normalizeServerPlanSelection,
  pgTableName,
  readFile,
  readPortalPostgresSnapshot,
  seedPostgresIfEmpty,
  storageMode,
  writePortalPostgresSnapshot,
}) {
  let dbWriteChain = Promise.resolve();

  async function withDbWriteLock(task) {
    const run = dbWriteChain.then(task, task);
    dbWriteChain = run.catch(() => {});
    return run;
  }

  async function readJsonDb() {
    let raw = await readFile(dataFile, "utf8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await dbWriteChain.catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 80));
      raw = await readFile(dataFile, "utf8");
      parsed = JSON.parse(raw);
    }
    const { db, changed } = await migrateDb(parsed);
    if (changed) await withDbWriteLock(() => atomicWriteJson(dataFile, db));
    return db;
  }

  async function mutateJsonDb(mutator) {
    await ensureStorageInfra();
    return withDbWriteLock(async () => {
      let raw = await readFile(dataFile, "utf8");
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 80));
        raw = await readFile(dataFile, "utf8");
        parsed = JSON.parse(raw);
      }
      const { db } = await migrateDb(parsed);
      const result = await mutator(db);
      await atomicWriteJson(dataFile, db);
      return result;
    });
  }

  async function writeDb(db) {
    await withDbWriteLock(async () => {
      if (storageMode() === "json") {
        await atomicWriteJson(dataFile, db);
        return;
      }
      const pool = await ensurePgPool();
      const redis = await ensureRedis();
      await writePortalPostgresSnapshot({
        pool,
        redis,
        pgTableName,
        namespace,
        db,
        normalizeLedgerEntries,
        normalizeServerPlanSelection,
        atomicWriteJson,
        dataFile,
      });
    });
  }

  async function readDb() {
    await ensureStorageInfra();
    await dbWriteChain.catch(() => {});
    if (storageMode() === "json") {
      return readJsonDb();
    }
    const pool = await ensurePgPool();
    const redis = await ensureRedis();
    await seedPostgresIfEmpty(pool);
    const db = await readPortalPostgresSnapshot({
      pool,
      redis,
      pgTableName,
      namespace,
      normalizeServerPlanSelection,
    });
    const { db: migrated, changed } = await migrateDb(db);
    if (changed) {
      await writeDb(migrated);
    }
    return migrated;
  }

  return {
    mutateJsonDb,
    readDb,
    readJsonDb,
    writeDb,
  };
}
