export function firstString(values = []) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export function tenantIdFrom(detail = {}) {
  return firstString([detail.tenantId, detail.tenant_id, detail.portalUserId, detail.portal_user_id]);
}

export function ownerIdFrom(detail = {}) {
  return firstString([detail.ownerId, detail.owner_id, detail.portalUserId, detail.portal_user_id]);
}

export function storageOwnerIdFrom(detail = {}) {
  return firstString([detail.storageOwnerId, detail.storage_owner_id, detail.storageOwner, detail.storage_owner]) || ownerIdFrom(detail);
}

export function objectMapFrom(detail = {}) {
  return detail && typeof detail === "object" && !Array.isArray(detail) ? detail : {};
}

export function tolerationsFrom(detail = {}) {
  return Array.isArray(detail) ? detail.filter((item) => item && typeof item === "object") : [];
}

export function idChainFrom(detail = {}) {
  return {
    tenantId: tenantIdFrom(detail),
    portalUserId: detail.portalUserId || detail.portal_user_id || "",
    workspaceId: detail.workspaceId || detail.workspace_id || "",
    workspaceSessionId: detail.workspaceSessionId || detail.workspace_session_id || "",
    runtimeSessionId: detail.runtimeSessionId || detail.runtime_session_id || "",
    runId: detail.runId || detail.run_id || "",
  };
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
