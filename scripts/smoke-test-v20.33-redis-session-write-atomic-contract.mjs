import assert from "node:assert/strict";

import {
  loadRedisPortalSessions,
  writeRedisPortalSessions,
} from "../services/portal/src/state/portal-store-redis-sessions.mjs";

class FakeRedis {
  constructor(seed = {}) {
    this.values = new Map(Object.entries(seed));
    this.deletedKeys = [];
  }

  async keys(pattern) {
    const prefix = String(pattern || "").replace(/\*$/, "");
    return [...this.values.keys()].filter((key) => key.startsWith(prefix)).sort();
  }

  async mGet(keys = []) {
    return keys.map((key) => this.values.get(key) || null);
  }

  async set(key, value) {
    this.values.set(key, value);
    return "OK";
  }

  async del(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    this.deletedKeys.push(...list);
    for (const key of list) this.values.delete(key);
    return list.length;
  }
}

const namespace = "portal-v20-33-atomic";
const existingSession = {
  id: "session-existing",
  userId: "user-existing",
  createdAt: "2026-05-05T03:00:00.000Z",
  authSource: "local",
};
const incomingSession = {
  id: "session-incoming",
  userId: "user-incoming",
  createdAt: "2026-05-05T03:01:00.000Z",
  authSource: "local",
};
const existingWorkspaceSession = {
  id: "workspace-session-existing",
  userId: "user-existing",
  workspaceId: "workspace-existing",
  status: "active",
  createdAt: "2026-05-05T03:00:00.000Z",
  lastUsedAt: "2026-05-05T03:00:00.000Z",
  expiresAt: "2026-05-05T15:00:00.000Z",
};

const redis = new FakeRedis({
  [`${namespace}:session:${existingSession.id}`]: JSON.stringify(existingSession),
  [`${namespace}:workspace_session:${existingWorkspaceSession.id}`]: JSON.stringify(existingWorkspaceSession),
});

const before = await loadRedisPortalSessions({ redis, namespace });
assert.equal(before.sessions.length, 1, "fixture_must_start_with_existing_portal_session");
assert.equal(before.workspaceSessions.length, 1, "fixture_must_start_with_existing_workspace_session");

const writeResult = await writeRedisPortalSessions({
  redis,
  namespace,
  sessions: [incomingSession],
  workspaceSessions: [],
});

assert.equal(writeResult.mergedSessions.length, 2, "write_must_merge_existing_and_incoming_sessions");
assert.equal(writeResult.mergedWorkspaceSessions.length, 1, "write_must_preserve_existing_workspace_sessions");
assert.deepEqual(redis.deletedKeys, [], "write_must_not_delete_session_keys_before_rewriting_them");

const after = await loadRedisPortalSessions({ redis, namespace });
assert.equal(after.sessions.length, 2, "all_portal_sessions_must_remain_visible_after_write");
assert.equal(after.workspaceSessions.length, 1, "workspace_sessions_must_remain_visible_after_write");
assert(
  after.sessions.some((session) => session.id === existingSession.id),
  "existing_session_must_remain_visible_without_transient_delete_gap",
);
assert(
  after.sessions.some((session) => session.id === incomingSession.id),
  "incoming_session_must_be_written",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_redis_session_write_atomic",
  sessionCount: after.sessions.length,
  workspaceSessionCount: after.workspaceSessions.length,
}, null, 2));
