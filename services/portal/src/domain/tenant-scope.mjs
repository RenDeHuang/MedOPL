export function tenantIdForUser(user = {}) {
  const userId = String(user.id || user.userId || "").trim();
  return String(user.tenantId || user.tenant_id || userId).trim() || userId;
}

export function isAdminUser(user = {}) {
  return String(user.role || "").trim().toLowerCase() === "admin";
}

export function resourceBelongsToUser(resource = {}, user = {}) {
  if (!resource || !user) return false;
  if (isAdminUser(user)) return true;
  const userId = String(user.id || "").trim();
  const tenantId = tenantIdForUser(user);
  return Boolean(userId) && (
    String(resource.userId || resource.user_id || resource.portalUserId || resource.portal_user_id || "").trim() === userId ||
    String(resource.tenantId || resource.tenant_id || "").trim() === tenantId
  );
}

export function workspaceBelongsToUser(workspace = {}, user = {}) {
  if (!workspace || !user) return false;
  if (isAdminUser(user)) return true;
  const userId = String(user.id || "").trim();
  const tenantId = tenantIdForUser(user);
  return Boolean(userId) && (
    String(workspace.userId || workspace.user_id || "").trim() === userId ||
    String(workspace.tenantId || workspace.tenant_id || "").trim() === tenantId
  );
}

export function filterUserScopedRows(rows = [], user = {}) {
  return (Array.isArray(rows) ? rows : []).filter((row) => resourceBelongsToUser(row, user));
}

export function adminScopeResult(user = {}) {
  if (isAdminUser(user)) return { ok: true };
  return { ok: false, status: 403, error: "forbidden_admin_scope_required" };
}
