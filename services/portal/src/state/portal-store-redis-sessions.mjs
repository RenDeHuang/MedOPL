import { randomUUID } from "node:crypto";

export function safeJsonParse(raw) {
  try {
    return JSON.parse(String(raw || ""));
  } catch {
    return null;
  }
}

const VALID_WORKSPACE_SESSION_STATUSES = new Set(["active", "revoked", "archived", "deleted", "deleting"]);

function isValidDateValue(value) {
  if (!value) return true;
  return !Number.isNaN(Date.parse(String(value)));
}

export function normalizeWorkspaceSessionValue(session) {
  if (!session || typeof session !== "object") return null;
  const id = String(session.id || "").trim();
  const userId = String(session.userId || "").trim();
  const workspaceId = String(session.workspaceId || "").trim();
  const status = String(session.status || "").trim().toLowerCase();
  const createdAt = String(session.createdAt || "").trim();
  const lastUsedAt = String(session.lastUsedAt || "").trim();
  const expiresAt = String(session.expiresAt || "").trim();
  if (!id || !userId || !workspaceId || !VALID_WORKSPACE_SESSION_STATUSES.has(status)) return null;
  if (!isValidDateValue(createdAt) || !isValidDateValue(lastUsedAt) || !isValidDateValue(expiresAt)) return null;
  return {
    id,
    userId,
    workspaceId,
    workspaceTitle: String(session.workspaceTitle || workspaceId).trim() || workspaceId,
    sessionType: String(session.sessionType || "opl_session").trim() || "opl_session",
    status,
    source: String(session.source || "portal-workspace-entry").trim() || "portal-workspace-entry",
    createdAt: createdAt || new Date().toISOString(),
    lastUsedAt: lastUsedAt || createdAt || new Date().toISOString(),
    expiresAt: expiresAt || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  };
}

export function serializeWorkspaceSessionValue(session) {
  const normalized = normalizeWorkspaceSessionValue(session);
  if (!normalized) {
    throw new Error("workspace_session_invalid");
  }
  return JSON.stringify(normalized);
}

async function quarantineWorkspaceSessionRedisValue({ redis, namespace, key, raw, reason }) {
  const suffix = String(key || "").split(":").pop() || randomUUID();
  console.warn("workspace_session quarantined", { key, reason });
  await redis.set(`${namespace}:quarantine:workspace_session:${suffix}`, JSON.stringify({
    key,
    raw: String(raw || ""),
    reason,
    quarantinedAt: new Date().toISOString(),
  }), { EX: 7 * 24 * 60 * 60 }).catch(() => {});
  if (key) {
    await redis.del(key).catch(() => {});
  }
}

export function mergeRowsById(existingRows = [], incomingRows = []) {
  const merged = new Map();
  for (const row of existingRows || []) {
    const id = String(row?.id || "").trim();
    if (id) merged.set(id, row);
  }
  for (const row of incomingRows || []) {
    const id = String(row?.id || "").trim();
    if (id) merged.set(id, row);
  }
  return [...merged.values()];
}

export async function loadRedisPortalSessions({ redis, namespace }) {
  const sessionKeys = await redis.keys(`${namespace}:session:*`);
  const workspaceSessionKeys = await redis.keys(`${namespace}:workspace_session:*`);
  const [sessionValues, workspaceSessionValues] = await Promise.all([
    sessionKeys.length ? redis.mGet(sessionKeys) : [],
    workspaceSessionKeys.length ? redis.mGet(workspaceSessionKeys) : [],
  ]);
  const sessions = sessionKeys.map((key, index) => {
    const parsed = safeJsonParse(sessionValues[index]);
    return parsed && typeof parsed === "object" ? parsed : null;
  }).filter(Boolean);
  const workspaceSessions = [];
  for (let index = 0; index < workspaceSessionKeys.length; index += 1) {
    const key = workspaceSessionKeys[index];
    const raw = workspaceSessionValues[index];
    if (!raw) continue;
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== "object") {
      await quarantineWorkspaceSessionRedisValue({ redis, namespace, key, raw, reason: "invalid_json" });
      continue;
    }
    const normalized = normalizeWorkspaceSessionValue(parsed);
    if (!normalized) {
      await quarantineWorkspaceSessionRedisValue({ redis, namespace, key, raw, reason: "invalid_workspace_session_shape" });
      continue;
    }
    workspaceSessions.push(normalized);
  }
  return {
    sessions,
    workspaceSessions,
  };
}

export async function writeRedisPortalSessions({
  redis,
  namespace,
  sessions,
  workspaceSessions,
}) {
  const sessionKeys = await redis.keys(`${namespace}:session:*`);
  const workspaceSessionKeys = await redis.keys(`${namespace}:workspace_session:*`);
  const [sessionValues, workspaceSessionValues] = await Promise.all([
    sessionKeys.length ? redis.mGet(sessionKeys) : [],
    workspaceSessionKeys.length ? redis.mGet(workspaceSessionKeys) : [],
  ]);
  const existingSessions = sessionValues
    .map((value) => safeJsonParse(value))
    .filter((value) => value && typeof value === "object");
  const existingWorkspaceSessions = workspaceSessionValues
    .map((value) => safeJsonParse(value))
    .filter((value) => value && typeof value === "object");
  const mergedSessions = mergeRowsById(existingSessions, sessions || []);
  const mergedWorkspaceSessions = mergeRowsById(existingWorkspaceSessions, workspaceSessions || []);
  for (const item of mergedSessions) {
    await redis.set(`${namespace}:session:${item.id}`, JSON.stringify(item), { EX: 7 * 24 * 60 * 60 });
  }
  for (const item of mergedWorkspaceSessions) {
    const payload = serializeWorkspaceSessionValue(item);
    const normalized = normalizeWorkspaceSessionValue(item);
    const ttl = normalized?.expiresAt ? Math.max(60, Math.floor((Date.parse(normalized.expiresAt) - Date.now()) / 1000)) : 12 * 60 * 60;
    await redis.set(`${namespace}:workspace_session:${normalized.id}`, payload, { EX: ttl });
  }
  return {
    mergedSessions,
    mergedWorkspaceSessions,
  };
}
