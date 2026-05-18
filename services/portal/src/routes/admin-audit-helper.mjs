function text(value = "") {
  return String(value ?? "").trim();
}

function cloneAuditValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(cloneAuditValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneAuditValue(item)]));
  }
  return value;
}

export function recordAdminAuditEvent({
  logPortalEvent,
  actor,
  action,
  target,
  before,
  after,
  reason,
  idempotencyKey,
  extra = {},
}) {
  if (typeof logPortalEvent !== "function") {
    throw new Error("admin_audit_logger_required");
  }
  const actorId = text(actor?.id);
  const targetId = text(target?.id || target?.userId || target?.announcementId || target?.workspaceId || target?.key);
  const workspaceId = text(target?.workspaceId || extra.workspaceId);
  const runId = text(target?.runId || extra.runId);
  return logPortalEvent({
    type: text(extra.type || action || "admin_action"),
    userId: text(target?.userId || targetId),
    operatorId: actorId,
    workspaceId,
    runId,
    actor: {
      id: actorId,
      role: text(actor?.role),
      name: text(actor?.name),
      email: text(actor?.email),
    },
    action: text(action),
    target: cloneAuditValue(target),
    before: cloneAuditValue(before),
    after: cloneAuditValue(after),
    reason: text(reason),
    idempotencyKey: text(idempotencyKey),
    createdAt: new Date().toISOString(),
    ...cloneAuditValue(extra),
  });
}
