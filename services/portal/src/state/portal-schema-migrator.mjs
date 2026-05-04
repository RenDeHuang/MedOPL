export async function runPortalSchemaMigration({
  pool,
  initializePostgresSchema,
  pgTableName,
  targetVersion,
}) {
  await initializePostgresSchema(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${pgTableName("schema_versions")} (
      component text PRIMARY KEY,
      version text NOT NULL,
      migrated_at timestamptz NOT NULL
    )
  `);
  await pool.query(
    `INSERT INTO ${pgTableName("schema_versions")} (component, version, migrated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (component) DO UPDATE
      SET version = EXCLUDED.version,
          migrated_at = EXCLUDED.migrated_at`,
    ["portal", targetVersion],
  );
}
