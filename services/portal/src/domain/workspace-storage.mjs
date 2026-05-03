import { createHash, randomUUID } from "node:crypto";
import { resolveWorkspaceLabStorageEntitlement } from "./lab-entitlements.mjs";

export const STORAGE_ORDER_STATUSES = new Set(["active", "deleting", "deleted", "cleanup_failed", "cancelled"]);
export const WORKSPACE_FILE_KINDS = new Set(["inputs", "outputs", "artifacts"]);

const transferTokens = new Map();

function normalizeSlashPath(value = "") {
  return String(value || "").replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
}

function safeRelativePath(value = "") {
  const normalized = normalizeSlashPath(value).replace(/^\.+\/?/, "");
  if (!normalized || normalized === "." || normalized.startsWith("..") || normalized.includes("/../")) return "";
  return normalized;
}

function normalizeWorkspaceKind(kind = "inputs") {
  const normalized = String(kind || "inputs").trim().toLowerCase();
  return WORKSPACE_FILE_KINDS.has(normalized) ? normalized : "inputs";
}

function storageOrderCosPrefix(tenantId, workspaceId) {
  return `workspaces/${String(tenantId || "").trim()}/${String(workspaceId || "").trim()}/`;
}

function workspaceOwnerMatches(item = {}, context = {}) {
  return item.workspaceId === context.workspaceId && (item.userId === context.userId || item.tenantId === context.tenantId);
}

function canMarkStorageOrderDeleting(order = {}, context = {}) {
  return workspaceOwnerMatches(order, context) && !["deleted", "cancelled"].includes(String(order.status || "").toLowerCase());
}

function canMarkWorkspaceFileDeleting(file = {}, context = {}) {
  return workspaceOwnerMatches(file, context) && String(file.status || "").toLowerCase() !== "deleted";
}

function applyRetentionMarker(item, deletedAt, cleanupAfterAt) {
  item.status = "deleting";
  item.deletedAt = deletedAt;
  item.updatedAt = deletedAt;
  item.retentionCleanupAfterAt = cleanupAfterAt;
}

export function buildWorkspaceStorageKey(tenantId, workspaceId, kind, relativePath) {
  const normalizedKind = normalizeWorkspaceKind(kind);
  const normalizedRelativePath = safeRelativePath(relativePath);
  return `${storageOrderCosPrefix(tenantId, workspaceId)}${normalizedKind}/${normalizedRelativePath}`;
}

export function ensureWorkspaceStorageCollections(db) {
  if (!Array.isArray(db.storageOrders)) db.storageOrders = [];
  if (!Array.isArray(db.workspaceFiles)) db.workspaceFiles = [];
  db.storageOrders = db.storageOrders.map(normalizeStorageOrder).filter(Boolean);
  db.workspaceFiles = db.workspaceFiles.map(normalizeWorkspaceFileRecord).filter(Boolean);
  return db;
}

export function normalizeStorageOrder(order = {}) {
  if (!order || typeof order !== "object") return null;
  const id = String(order.id || randomUUID()).trim();
  const userId = String(order.userId || order.user_id || order.tenantId || order.tenant_id || "").trim();
  const tenantId = String(order.tenantId || order.tenant_id || userId).trim() || userId;
  const workspaceId = String(order.workspaceId || order.workspace_id || "").trim();
  const now = new Date().toISOString();
  if (!id || !userId || !workspaceId) return null;
  const status = String(order.status || "active").trim().toLowerCase();
  const storageSizeGb = Math.max(10, Number(order.storageSizeGb ?? order.storage_size_gb ?? 10));
  return {
    id,
    tenantId,
    userId,
    workspaceId,
    status: STORAGE_ORDER_STATUSES.has(status) ? status : "active",
    storagePlanId: String(order.storagePlanId || order.storage_plan_id || `cos-${storageSizeGb}gb`).trim() || `cos-${storageSizeGb}gb`,
    storageSizeGb,
    storageBackend: String(order.storageBackend || order.storage_backend || "cos").trim() || "cos",
    retentionPolicy: String(order.retentionPolicy || order.retention_policy || "order_lifecycle").trim() || "order_lifecycle",
    cosPrefix: String(order.cosPrefix || order.cos_prefix || storageOrderCosPrefix(tenantId, workspaceId)).trim() || storageOrderCosPrefix(tenantId, workspaceId),
    sourceType: String(order.sourceType || order.source_type || "portal_storage_order").trim() || "portal_storage_order",
    createdAt: String(order.createdAt || order.created_at || now).trim() || now,
    updatedAt: String(order.updatedAt || order.updated_at || now).trim() || now,
    deletedAt: String(order.deletedAt || order.deleted_at || "").trim(),
    retentionCleanupAfterAt: String(order.retentionCleanupAfterAt || order.retention_cleanup_after_at || "").trim(),
  };
}

export function normalizeWorkspaceFileRecord(record = {}) {
  if (!record || typeof record !== "object") return null;
  const id = String(record.id || randomUUID()).trim();
  const userId = String(record.userId || record.user_id || record.tenantId || record.tenant_id || "").trim();
  const tenantId = String(record.tenantId || record.tenant_id || userId).trim() || userId;
  const workspaceId = String(record.workspaceId || record.workspace_id || "").trim();
  const relativePath = safeRelativePath(record.relativePath || record.relative_path || record.name || "");
  const kind = normalizeWorkspaceKind(record.kind);
  const name = String(record.name || relativePath.split("/").pop() || "").trim();
  const now = new Date().toISOString();
  if (!id || !userId || !workspaceId || !relativePath || !name) return null;
  return {
    id,
    tenantId,
    userId,
    workspaceId,
    runId: String(record.runId || record.run_id || "").trim(),
    kind,
    name,
    relativePath,
    storageKey: String(record.storageKey || record.storage_key || buildWorkspaceStorageKey(tenantId, workspaceId, kind, relativePath)).trim(),
    localPath: String(record.localPath || record.local_path || "").trim(),
    sizeBytes: Math.max(0, Number(record.sizeBytes ?? record.size_bytes ?? 0)),
    checksum: String(record.checksum || "").trim(),
    contentType: String(record.contentType || record.content_type || "application/octet-stream").trim() || "application/octet-stream",
    status: String(record.status || "active").trim() || "active",
    source: String(record.source || "portal_upload").trim() || "portal_upload",
    createdAt: String(record.createdAt || record.created_at || now).trim() || now,
    updatedAt: String(record.updatedAt || record.updated_at || now).trim() || now,
    deletedAt: String(record.deletedAt || record.deleted_at || "").trim(),
    retentionCleanupAfterAt: String(record.retentionCleanupAfterAt || record.retention_cleanup_after_at || "").trim(),
  };
}

export function resolveWorkspaceStorageEntitlement(db, user, workspaceId) {
  ensureWorkspaceStorageCollections(db);
  const tenantId = String(user?.tenantId || user?.id || "").trim();
  const cosPrefix = storageOrderCosPrefix(tenantId, workspaceId);
  const labStorage = resolveWorkspaceLabStorageEntitlement(db, { user, workspaceId, tenantId, cosPrefix });
  if (labStorage) return labStorage;
  return resolveStorageOrderEntitlement(db, { user, workspaceId, tenantId, cosPrefix });
}

function resolveStorageOrderEntitlement(db, { user, workspaceId, tenantId, cosPrefix }) {
  const activeStatuses = new Set(["active"]);
  const order = (db.storageOrders || [])
    .filter((item) => item.workspaceId === workspaceId)
    .filter((item) => item.userId === user.id || item.tenantId === tenantId)
    .filter((item) => activeStatuses.has(String(item.status || "").toLowerCase()))
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0] || null;
  return {
    enabled: Boolean(order),
    status: order ? order.status : "disabled",
    freeQuotaGb: 0,
    minimumPurchaseGb: 10,
    storageBackend: "cos",
    retentionPolicy: order?.retentionPolicy || "order_lifecycle",
    cosPrefix: order?.cosPrefix || cosPrefix,
    resourceOrderId: "",
    storagePlanId: order?.storagePlanId || "",
    storageSizeGb: order?.storageSizeGb || 0,
    sourceType: order ? "portal_storage_order" : "none",
    gates: {
      canUpload: Boolean(order),
      canRun: Boolean(order),
      canDownload: true,
    },
    message: order
      ? `已开通 ${order.storageSizeGb}GB 对象存储，可上传输入并保留输出。`
      : "免费容量为 0；至少购买 10GB 后才能上传输入文件和保存输出文件。",
  };
}

export function markWorkspaceStorageDeleting(db, { user, workspaceId, deletedAt = "", retentionDays = 7 } = {}) {
  ensureWorkspaceStorageCollections(db);
  const tenantId = String(user?.tenantId || user?.id || "").trim();
  const userId = String(user?.id || "").trim();
  const context = { tenantId, userId, workspaceId: String(workspaceId || "").trim() };
  const now = String(deletedAt || "").trim() || new Date().toISOString();
  const cleanupAfterAt = new Date(Date.parse(now) + Math.max(1, Number(retentionDays || 7)) * 24 * 60 * 60 * 1000).toISOString();
  let storageOrderCount = 0;
  let fileCount = 0;
  for (const order of db.storageOrders || []) {
    if (canMarkStorageOrderDeleting(order, context)) {
      applyRetentionMarker(order, now, cleanupAfterAt);
      storageOrderCount += 1;
    }
  }
  for (const file of db.workspaceFiles || []) {
    if (canMarkWorkspaceFileDeleting(file, context)) {
      applyRetentionMarker(file, now, cleanupAfterAt);
      fileCount += 1;
    }
  }
  return { ok: true, storageOrderCount, fileCount, deletedAt: now, cleanupAfterAt };
}

export function workspaceStorageCleanupCandidates(db, { now = new Date().toISOString(), retentionDays = 7 } = {}) {
  ensureWorkspaceStorageCollections(db);
  const nowMs = Date.parse(String(now || ""));
  const retentionMs = Math.max(1, Number(retentionDays || 7)) * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(nowMs)) return { storageOrders: [], workspaceFiles: [] };
  function cleanupDue(item) {
    if (String(item.status || "").toLowerCase() !== "deleting") return false;
    const cleanupAfterAt = Date.parse(String(item.retentionCleanupAfterAt || ""));
    if (Number.isFinite(cleanupAfterAt)) return cleanupAfterAt <= nowMs;
    const deletedAt = Date.parse(String(item.deletedAt || ""));
    return Number.isFinite(deletedAt) && deletedAt + retentionMs <= nowMs;
  }
  return {
    storageOrders: (db.storageOrders || []).filter(cleanupDue),
    workspaceFiles: (db.workspaceFiles || []).filter(cleanupDue),
  };
}

export function createOrUpdateStorageOrder(db, input = {}) {
  ensureWorkspaceStorageCollections(db);
  const normalized = normalizeStorageOrder(input);
  if (!normalized) return { ok: false, status: 400, error: "invalid_storage_order" };
  const existing = db.storageOrders.find((item) =>
    item.userId === normalized.userId &&
    item.workspaceId === normalized.workspaceId &&
    ["active", "deleting"].includes(String(item.status || "").toLowerCase()),
  );
  if (existing) {
    existing.status = "active";
    existing.storagePlanId = normalized.storagePlanId;
    existing.storageSizeGb = normalized.storageSizeGb;
    existing.storageBackend = normalized.storageBackend;
    existing.retentionPolicy = normalized.retentionPolicy;
    existing.cosPrefix = normalized.cosPrefix;
    existing.sourceType = normalized.sourceType;
    existing.updatedAt = new Date().toISOString();
    existing.deletedAt = "";
    existing.retentionCleanupAfterAt = "";
    return { ok: true, created: false, order: existing };
  }
  db.storageOrders.push(normalized);
  return { ok: true, created: true, order: normalized };
}

export function recordWorkspaceFile(db, input = {}) {
  ensureWorkspaceStorageCollections(db);
  const normalized = normalizeWorkspaceFileRecord(input);
  if (!normalized) return { ok: false, status: 400, error: "invalid_workspace_file" };
  const existing = db.workspaceFiles.find((item) =>
    item.userId === normalized.userId &&
    item.workspaceId === normalized.workspaceId &&
    item.kind === normalized.kind &&
    item.relativePath === normalized.relativePath,
  );
  if (existing) {
    existing.runId = normalized.runId;
    existing.name = normalized.name;
    existing.storageKey = normalized.storageKey;
    existing.localPath = normalized.localPath;
    existing.sizeBytes = normalized.sizeBytes;
    existing.checksum = normalized.checksum;
    existing.contentType = normalized.contentType;
    existing.status = normalized.status;
    existing.source = normalized.source;
    existing.updatedAt = new Date().toISOString();
    existing.deletedAt = normalized.deletedAt || existing.deletedAt || "";
    return { ok: true, created: false, file: existing };
  }
  db.workspaceFiles.push(normalized);
  return { ok: true, created: true, file: normalized };
}

export function listWorkspaceFiles(db, filters = {}) {
  ensureWorkspaceStorageCollections(db);
  const tenantId = String(filters.tenantId || "").trim();
  const userId = String(filters.userId || "").trim();
  const workspaceId = String(filters.workspaceId || "").trim();
  const kind = filters.kind ? normalizeWorkspaceKind(filters.kind) : "";
  return (db.workspaceFiles || [])
    .filter((item) => !tenantId || item.tenantId === tenantId)
    .filter((item) => !userId || item.userId === userId)
    .filter((item) => !workspaceId || item.workspaceId === workspaceId)
    .filter((item) => !kind || item.kind === kind)
    .filter((item) => String(item.status || "").toLowerCase() !== "deleted")
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

export function buildWorkspaceFileChecksum(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function issueWorkspaceTransferToken(payload = {}) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + Math.max(60_000, Number(payload.ttlMs || 10 * 60 * 1000))).toISOString();
  transferTokens.set(token, {
    ...payload,
    action: String(payload.action || "").trim(),
    token,
    expiresAt,
  });
  return { token, expiresAt };
}

export function readWorkspaceTransferToken(token, expectedAction = "") {
  const record = transferTokens.get(String(token || ""));
  if (!record) return null;
  if (Date.parse(record.expiresAt || "") <= Date.now()) {
    transferTokens.delete(String(token || ""));
    return null;
  }
  if (expectedAction && record.action !== expectedAction) return null;
  transferTokens.delete(String(token || ""));
  return record;
}
