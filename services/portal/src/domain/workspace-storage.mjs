import { createHash, randomUUID } from "node:crypto";
import { resolveWorkspaceLabStorageEntitlement } from "./lab-entitlements.mjs";

export const STORAGE_ORDER_STATUSES = new Set(["active", "deleting", "deleted", "cleanup_failed", "cancelled"]);
export const WORKSPACE_FILE_KINDS = new Set(["inputs", "outputs", "artifacts"]);
export const WORKSPACE_STORAGE_MODES = new Set(["legacy", "full_runtime", "api_only"]);

const transferTokens = new Map();

function normalizeSlashPath(value = "") {
  return String(value || "").trim();
}

function hasWindowsDrivePrefix(value = "") {
  return /^[A-Za-z]:/.test(value);
}

function invalidPathSegment(segment = "") {
  return !segment || segment === "." || segment === ".." || segment.includes("\0");
}

export function safeRelativePath(value = "") {
  const normalized = normalizeSlashPath(value);
  if (!normalized || normalized.includes("\\") || normalized.startsWith("/") || hasWindowsDrivePrefix(normalized)) return "";
  const segments = normalized.split("/");
  if (segments.some(invalidPathSegment)) return "";
  return segments.join("/");
}

export function safeRelativePrefix(value = "") {
  const normalized = normalizeSlashPath(value).replace(/\/+$/, "");
  return safeRelativePath(normalized);
}

export function safePathSegment(value = "") {
  const normalized = normalizeSlashPath(value);
  if (invalidPathSegment(normalized) || normalized.includes("/") || normalized.includes("\\") || hasWindowsDrivePrefix(normalized)) return "";
  return normalized;
}

export function resolvePathInsideRoot(pathModule, rootPath, candidatePath) {
  const root = pathModule.resolve(String(rootPath || ""));
  const candidate = pathModule.resolve(String(candidatePath || ""));
  if (!root || !candidate) return "";
  const relative = pathModule.relative(root, candidate);
  if (relative === "" || (!relative.startsWith("..") && !pathModule.isAbsolute(relative))) return candidate;
  return "";
}

export function resolveRelativePathInsideRoot(pathModule, rootPath, relativePath) {
  const normalizedRelativePath = safeRelativePath(relativePath);
  if (!normalizedRelativePath) return "";
  return resolvePathInsideRoot(pathModule, rootPath, pathModule.join(rootPath, ...normalizedRelativePath.split("/")));
}

function normalizeWorkspaceKind(kind = "inputs") {
  const normalized = String(kind || "inputs").trim().toLowerCase();
  return WORKSPACE_FILE_KINDS.has(normalized) ? normalized : "inputs";
}

function normalizeStorageMode(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "full_runtime") return "full_runtime";
  if (normalized === "api_only") return "api_only";
  return "legacy";
}

function normalizedStorageRootPrefix(value = "") {
  const normalized = safeRelativePrefix(value);
  return normalized ? `${normalized.replace(/\/+$/, "")}/` : "";
}

function stringFromFields(record = {}, fields = [], defaultValue = "") {
  for (const field of fields) {
    const value = record[field];
    if (value) return String(value).trim();
  }
  return String(defaultValue).trim();
}

function activeBindingForWorkspace(db = {}, { user, workspaceId = "" } = {}) {
  const tenantId = String(user?.tenantId || user?.tenant_id || user?.id || "").trim();
  const userId = String(user?.id || "").trim();
  return (Array.isArray(db.workspaceResourceBindings) ? db.workspaceResourceBindings : [])
    .filter((item) => String(item.workspaceId || "").trim() === String(workspaceId || "").trim())
    .filter((item) => String(item.userId || item.ownerUserId || "").trim() === userId)
    .filter((item) => !tenantId || String(item.tenantId || item.ownerTenantId || "").trim() === tenantId)
    .filter((item) => ["active", "release_requested", "billing_stop_confirming", "billing_stopped", "audit_pending", "audit_ready", "audited"].includes(String(item.status || "active").trim().toLowerCase()))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
}

function bindingId(binding = {}) {
  return String(binding?.resourceBindingId || binding?.id || "").trim();
}

function bindingBillingAttributionId(binding = {}) {
  const id = bindingId(binding);
  return String(binding?.billingAttributionId || binding?.billing_attribution_id || binding?.cloudOperationId || binding?.cloud_operation_id || binding?.costAllocationTag || id || "").trim();
}

function bindingAccountId(binding = {}, user = {}) {
  return String(binding?.accountId || binding?.account_id || binding?.userId || binding?.user_id || binding?.ownerUserId || user?.id || "").trim();
}

function bindingServerPlanId(binding = {}, fallback = "") {
  return String(binding?.serverPlanId || binding?.server_plan_id || binding?.planId || binding?.plan_id || binding?.packageId || binding?.package_id || fallback || "").trim();
}

function storageOrderCosPrefix(tenantId, workspaceId) {
  return `workspaces/${String(tenantId || "").trim()}/${String(workspaceId || "").trim()}/`;
}

function fullRuntimeStorageRootPrefix({ userId = "", workspaceId = "", rootPrefix = "" } = {}) {
  const defaultPrefix = `users/${String(userId || "").trim()}/workspaces/${String(workspaceId || "").trim()}/`;
  return normalizedStorageRootPrefix(rootPrefix || defaultPrefix);
}

function fullRuntimeStoragePrefix({ userId = "", workspaceId = "", oplSessionId = "", rootPrefix = "" } = {}) {
  const normalizedSessionId = safePathSegment(oplSessionId);
  const normalizedRootPrefix = fullRuntimeStorageRootPrefix({ userId, workspaceId, rootPrefix });
  if (!normalizedRootPrefix || !normalizedSessionId) return "";
  return `${normalizedRootPrefix}sessions/${normalizedSessionId}/`;
}

function parseWorkspaceFileSource(source = "") {
  const normalized = String(source || "").trim();
  if (!normalized) return { source: "portal_upload", storageMode: "legacy", resourceBindingId: "" };
  const [prefix, ...rest] = normalized.split(":");
  const resourceBindingId = rest.join(":").trim();
  if (prefix.startsWith("full_runtime")) {
    return { source: normalized, storageMode: "full_runtime", resourceBindingId };
  }
  if (prefix.startsWith("api_only")) {
    return { source: normalized, storageMode: "api_only", resourceBindingId: "" };
  }
  return { source: normalized, storageMode: "legacy", resourceBindingId };
}

function encodeWorkspaceFileSource({
  source = "portal_upload",
  storageMode = "legacy",
  resourceBindingId = "",
} = {}) {
  const normalizedMode = normalizeStorageMode(storageMode);
  const parsed = parseWorkspaceFileSource(source);
  if (normalizedMode !== "full_runtime") {
    if (normalizedMode === "api_only") return parsed.source.startsWith("api_only") ? parsed.source : "api_only_message_trace";
    return parsed.source || "portal_upload";
  }
  const normalizedBindingId = String(resourceBindingId || parsed.resourceBindingId || "").trim();
  const prefix = parsed.source.startsWith("full_runtime") ? parsed.source.split(":")[0] : String(source || "full_runtime_upload").trim() || "full_runtime_upload";
  return normalizedBindingId ? `${prefix}:${normalizedBindingId}` : prefix;
}

function workspaceOwnerMatches(item = {}, context = {}) {
  if (item.workspaceId !== context.workspaceId) return false;
  if (item.userId !== context.userId) return false;
  return !context.tenantId || item.tenantId === context.tenantId;
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

function workspaceFileStorageMode(record = {}, parsedSource = {}, oplSessionId = "") {
  const explicitMode = stringFromFields(record, ["storageMode", "storage_mode"]);
  if (explicitMode) return normalizeStorageMode(explicitMode);
  if (parsedSource.storageMode) return normalizeStorageMode(parsedSource.storageMode);
  return normalizeStorageMode(oplSessionId ? "full_runtime" : "legacy");
}

function normalizeWorkspaceFileScope(record = {}, parsedSource = {}) {
  const id = stringFromFields(record, ["id"], randomUUID());
  const userId = stringFromFields(record, ["userId", "user_id", "tenantId", "tenant_id"]);
  const tenantId = stringFromFields(record, ["tenantId", "tenant_id"], userId) || userId;
  const workspaceId = stringFromFields(record, ["workspaceId", "workspace_id"]);
  const oplSessionId = stringFromFields(record, ["oplSessionId", "opl_session_id", "runId", "run_id"]);
  const resourceBindingId = stringFromFields(record, ["resourceBindingId", "resource_binding_id"], parsedSource.resourceBindingId);
  const storageMode = workspaceFileStorageMode(record, parsedSource, oplSessionId);
  const storageRootPrefix = fullRuntimeStorageRootPrefix({
    userId,
    workspaceId,
    rootPrefix: stringFromFields(record, ["storageRootPrefix", "storage_root_prefix"]),
  });
  return { id, tenantId, userId, workspaceId, oplSessionId, resourceBindingId, storageMode, storageRootPrefix };
}

function basenameFromPath(relativePath = "") {
  const segments = String(relativePath || "").split("/");
  return segments[segments.length - 1] || "";
}

function normalizeWorkspaceFilePath(record = {}) {
  const relativePath = safeRelativePath(stringFromFields(record, ["relativePath", "relative_path", "name"]));
  return {
    kind: normalizeWorkspaceKind(record.kind),
    name: stringFromFields(record, ["name"], basenameFromPath(relativePath)),
    relativePath,
  };
}

function workspaceFileStorageKey(record = {}, scope = {}, path = {}) {
  const explicitKey = stringFromFields(record, ["storageKey", "storage_key"]);
  if (explicitKey) return explicitKey;
  return buildWorkspaceStorageKey(scope.tenantId, scope.workspaceId, path.kind, path.relativePath, {
    userId: scope.userId,
    oplSessionId: scope.oplSessionId,
    resourceBindingId: scope.resourceBindingId,
    storageMode: scope.storageMode,
    rootPrefix: scope.storageRootPrefix,
  });
}

function workspaceFileSource(record = {}, scope = {}) {
  return encodeWorkspaceFileSource({
    source: stringFromFields(record, ["source"], "portal_upload") || "portal_upload",
    storageMode: scope.storageMode,
    resourceBindingId: scope.resourceBindingId,
  });
}

function workspaceFileTimestamp(record = {}, camelField = "", snakeField = "", defaultValue = "") {
  return stringFromFields(record, [camelField, snakeField], defaultValue) || defaultValue;
}

function validWorkspaceFileRecord(scope = {}, path = {}) {
  if (!scope.id || !scope.userId || !scope.workspaceId || !path.relativePath || !path.name) return false;
  if (scope.storageMode === "full_runtime") {
    return Boolean(scope.oplSessionId && scope.resourceBindingId && scope.storageRootPrefix);
  }
  return true;
}

export function buildWorkspaceStorageKey(tenantId, workspaceId, kind, relativePath, options = {}) {
  const normalizedKind = normalizeWorkspaceKind(kind);
  const normalizedRelativePath = safeRelativePath(relativePath);
  if (!normalizedRelativePath) return "";
  const normalizedMode = normalizeStorageMode(options.storageMode || (options.oplSessionId ? "full_runtime" : "legacy"));
  if (normalizedMode === "full_runtime") {
    const prefix = fullRuntimeStoragePrefix({
      userId: options.userId,
      workspaceId,
      oplSessionId: options.oplSessionId,
      rootPrefix: options.rootPrefix,
    });
    if (prefix) return `${prefix}${normalizedKind}/${normalizedRelativePath}`;
  }
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
  const parsedSource = parseWorkspaceFileSource(record.source);
  const scope = normalizeWorkspaceFileScope(record, parsedSource);
  const path = normalizeWorkspaceFilePath(record);
  const now = new Date().toISOString();
  if (!validWorkspaceFileRecord(scope, path)) return null;
  return {
    id: scope.id,
    tenantId: scope.tenantId,
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    runId: scope.oplSessionId,
    oplSessionId: scope.oplSessionId,
    resourceBindingId: scope.resourceBindingId,
    storageMode: scope.storageMode,
    storageRootPrefix: scope.storageRootPrefix,
    kind: path.kind,
    name: path.name,
    relativePath: path.relativePath,
    storageKey: workspaceFileStorageKey(record, scope, path),
    localPath: String(record.localPath || record.local_path || "").trim(),
    sizeBytes: Math.max(0, Number(record.sizeBytes ?? record.size_bytes ?? 0)),
    checksum: String(record.checksum || "").trim(),
    contentType: String(record.contentType || record.content_type || "application/octet-stream").trim() || "application/octet-stream",
    status: String(record.status || "active").trim() || "active",
    source: workspaceFileSource(record, scope),
    createdAt: workspaceFileTimestamp(record, "createdAt", "created_at", now),
    updatedAt: workspaceFileTimestamp(record, "updatedAt", "updated_at", now),
    deletedAt: workspaceFileTimestamp(record, "deletedAt", "deleted_at"),
    retentionCleanupAfterAt: workspaceFileTimestamp(record, "retentionCleanupAfterAt", "retention_cleanup_after_at"),
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
  const binding = activeBindingForWorkspace(db, { user, workspaceId });
  const order = (db.storageOrders || [])
    .filter((item) => item.workspaceId === workspaceId)
    .filter((item) => item.userId === user.id)
    .filter((item) => !tenantId || item.tenantId === tenantId)
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
    resourceBindingId: bindingId(binding),
    billingAttributionId: bindingBillingAttributionId(binding),
    accountId: bindingAccountId(binding, user),
    legacyResourceOrderId: String(binding?.legacyResourceOrderId || binding?.legacy_resource_order_id || "").trim(),
    storagePlanId: order?.storagePlanId || "",
    serverPlanId: bindingServerPlanId(binding, order?.storagePlanId || ""),
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
  const storageOrderIds = [];
  const workspaceFileIds = [];
  for (const order of db.storageOrders || []) {
    if (canMarkStorageOrderDeleting(order, context)) {
      applyRetentionMarker(order, now, cleanupAfterAt);
      storageOrderCount += 1;
      storageOrderIds.push(order.id);
    }
  }
  for (const file of db.workspaceFiles || []) {
    if (canMarkWorkspaceFileDeleting(file, context)) {
      applyRetentionMarker(file, now, cleanupAfterAt);
      fileCount += 1;
      workspaceFileIds.push(file.id);
    }
  }
  return { ok: true, storageOrderCount, fileCount, storageOrderIds, workspaceFileIds, deletedAt: now, cleanupAfterAt };
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
    item.oplSessionId === normalized.oplSessionId &&
    item.resourceBindingId === normalized.resourceBindingId &&
    item.kind === normalized.kind &&
    item.relativePath === normalized.relativePath,
  );
  if (existing) {
    existing.runId = normalized.runId;
    existing.oplSessionId = normalized.oplSessionId;
    existing.resourceBindingId = normalized.resourceBindingId;
    existing.storageMode = normalized.storageMode;
    existing.storageRootPrefix = normalized.storageRootPrefix;
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
  const oplSessionId = String(filters.oplSessionId || filters.runId || "").trim();
  const resourceBindingId = String(filters.resourceBindingId || "").trim();
  const storageMode = filters.storageMode ? normalizeStorageMode(filters.storageMode) : "";
  const kind = filters.kind ? normalizeWorkspaceKind(filters.kind) : "";
  return (db.workspaceFiles || [])
    .filter((item) => !tenantId || item.tenantId === tenantId)
    .filter((item) => !userId || item.userId === userId)
    .filter((item) => !workspaceId || item.workspaceId === workspaceId)
    .filter((item) => !oplSessionId || item.oplSessionId === oplSessionId)
    .filter((item) => !resourceBindingId || item.resourceBindingId === resourceBindingId)
    .filter((item) => !storageMode || item.storageMode === storageMode)
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
