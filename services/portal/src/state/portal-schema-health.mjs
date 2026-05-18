async function queryExistingTables({ pool, pgTableName, requiredTables }) {
  const missingTables = [];
  for (const table of requiredTables) {
    let result;
    try {
      result = await pool.query("SELECT to_regclass($1) AS table_name", [pgTableName(table).replace(/"/g, "")]);
    } catch (error) {
      if (isPgConnectionError(error)) {
        throw new Error("portal_pg_connection_required");
      }
      throw error;
    }
    if (!result.rows[0]?.table_name) {
      missingTables.push(table);
    }
  }
  return missingTables;
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

export async function assertPortalSchemaReady({
  pool,
  pgTableName,
  targetVersion,
  requiredTables = [
    "users",
    "wallets",
    "ledger_entries",
    "audit_events",
    "user_compute_instances",
    "user_storage_buckets",
    "workspace_resource_bindings",
    "weekly_protection_freezes",
    "cloud_operations",
    "cloud_operation_jobs",
    "compute_allocations",
    "file_space_entitlements",
    "cloud_resource_projections",
    "billing_reconciliations",
  ],
}) {
  let versionResult;
  try {
    versionResult = await pool.query(
      `SELECT version FROM ${pgTableName("schema_versions")} WHERE component = $1`,
    ["portal"],
  );
  } catch (error) {
    if (isPgConnectionError(error)) {
      throw new Error("portal_pg_connection_required");
    }
    if (String(error?.message || "").includes("does not exist")) {
      throw new Error(`portal_schema_not_ready:missing:${targetVersion}`);
    }
    throw error;
  }
  const currentVersion = String(versionResult.rows[0]?.version || "");
  if (currentVersion !== targetVersion) {
    throw new Error(`portal_schema_not_ready:${currentVersion || "missing"}:${targetVersion}`);
  }
  const missingTables = await queryExistingTables({ pool, pgTableName, requiredTables });
  if (missingTables.length) {
    throw new Error(`portal_schema_missing_tables:${missingTables.join(",")}`);
  }
}
