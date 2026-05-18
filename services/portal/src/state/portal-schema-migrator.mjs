export async function runPortalSchemaMigration({
  pool,
  initializePostgresSchema,
  pgTableName,
  targetVersion,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await initializePostgresSchema(client);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${pgTableName("schema_versions")} (
        component text PRIMARY KEY,
        version text NOT NULL,
        migrated_at timestamptz NOT NULL
      )
    `);
    await client.query(
      `INSERT INTO ${pgTableName("schema_versions")} (component, version, migrated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (component) DO UPDATE
        SET version = EXCLUDED.version,
            migrated_at = EXCLUDED.migrated_at`,
      ["portal", targetVersion],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (isPgConnectionError(error)) {
      throw new Error("portal_pg_connection_required");
    }
    throw error;
  } finally {
    client.release();
  }
}

function isPgConnectionError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return [
    "ECONNREFUSED",
    "ECONNRESET",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "57P01",
    "08006",
  ].includes(code) ||
    /connection terminated|connect econnrefused|timeout|connection refused|no pg_hba|password authentication failed/i.test(message);
}
