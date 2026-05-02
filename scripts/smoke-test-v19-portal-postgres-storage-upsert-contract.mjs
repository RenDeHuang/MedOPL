import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile("services/portal/src/state/portal-store-postgres-persistence.mjs", "utf8");
const storeSource = await readFile("services/portal/src/state/portal-store.mjs", "utf8");
const redisSessionsSource = await readFile("services/portal/src/state/portal-store-redis-sessions.mjs", "utf8");

function segmentFor(tableName) {
  const marker = `INSERT INTO \${pgTableName("${tableName}")}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${tableName}_insert_missing`);
  const next = source.indexOf("for (const row of db.", start + marker.length);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

for (const tableName of ["users", "wallets", "task_spaces", "storage_orders"]) {
  assert.equal(
    source.includes(`DELETE FROM \${pgTableName("${tableName}")}`),
    false,
    `${tableName}_must_not_be_full_table_deleted_in_postgres_write`,
  );
  const segment = segmentFor(tableName);
  const conflictKey = tableName === "wallets" ? "user_id" : "id";
  assert.match(segment, new RegExp(`ON CONFLICT \\(${conflictKey}\\) DO UPDATE SET`), `${tableName}_must_upsert_by_primary_key`);
}

const usersSegment = segmentFor("users");
assert.match(usersSegment, /email=EXCLUDED\.email/, "users_upsert_must_update_email");
assert.match(usersSegment, /password_hash=COALESCE\(NULLIF\(EXCLUDED\.password_hash, ''\)/, "users_upsert_must_preserve_existing_password_when_snapshot_is_empty");
assert.match(usersSegment, /status=EXCLUDED\.status/, "users_upsert_must_update_status");

const walletsSegment = segmentFor("wallets");
assert.match(walletsSegment, /balance=EXCLUDED\.balance/, "wallets_upsert_must_update_balance");
assert.match(walletsSegment, /updated_at=EXCLUDED\.updated_at/, "wallets_upsert_must_update_timestamp");

const taskSpaceSegment = segmentFor("task_spaces");
assert.match(taskSpaceSegment, /server_plan_id=COALESCE\(NULLIF\(EXCLUDED\.server_plan_id, ''\)/, "task_space_plan_id_must_not_be_overwritten_by_stale_empty_snapshot");
assert.match(taskSpaceSegment, /server_plan_snapshot_json = '\{\}'::jsonb/, "task_space_plan_snapshot_must_preserve_existing_when_stale_snapshot_is_empty");

assert.match(source, /from "\.\/portal-store-redis-sessions\.mjs"/, "portal_postgres_persistence_must_import_redis_session_helper");
assert.match(source, /loadRedisPortalSessions\(\{\s*redis,\s*namespace,\s*\}\)/s, "portal_store_must_delegate_redis_session_load");
assert.match(source, /writeRedisPortalSessions\(\{\s*redis,\s*namespace,\s*sessions: db\.sessions \|\| \[\],\s*workspaceSessions: db\.workspaceSessions \|\| \[\],\s*\}\)/s, "portal_store_must_delegate_redis_session_write");
assert.match(storeSource, /readPortalPostgresSnapshot\(\{/, "portal_store_facade_must_delegate_postgres_read");
assert.match(storeSource, /writePortalPostgresSnapshot\(\{/, "portal_store_facade_must_delegate_postgres_write");
assert.match(redisSessionsSource, /export function mergeRowsById\(/, "redis_session_helper_must_define_merge_helper");
assert.match(redisSessionsSource, /const mergedSessions = mergeRowsById\(existingSessions, sessions \|\| \[\]\)/, "portal_sessions_must_merge_existing_redis_rows");
assert.match(redisSessionsSource, /const mergedWorkspaceSessions = mergeRowsById\(existingWorkspaceSessions, workspaceSessions \|\| \[\]\)/, "workspace_sessions_must_merge_existing_redis_rows");
assert.match(redisSessionsSource, /for \(const item of mergedSessions\)/, "portal_sessions_must_write_merged_rows");
assert.match(redisSessionsSource, /for \(const item of mergedWorkspaceSessions\)/, "workspace_sessions_must_write_merged_rows");

console.log(JSON.stringify({
  ok: true,
  checked: ["users", "wallets", "task_spaces", "storage_orders", "portal_sessions", "workspace_sessions"],
}, null, 2));
