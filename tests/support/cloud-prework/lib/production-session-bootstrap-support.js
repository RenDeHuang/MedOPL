import { createHash } from "node:crypto";

export function hashPublicRef(value = "") {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

export function productionSessionBootstrapSignature({ tenantId, portalUserId, workspaceId, nonce, expiresAt, bootstrapSecretHash }) {
  return createHash("sha256")
    .update([tenantId, portalUserId, workspaceId, nonce, expiresAt, bootstrapSecretHash].map((item) => String(item || "").trim()).join(":"))
    .digest("hex");
}

export function signedProductionSessionBootstrapPayload({ tenantId, portalUserId, workspaceId, bootstrapSecretHash, now = Date.now }) {
  const nonce = `goal-f-bootstrap-${hashPublicRef(`${workspaceId}:${now()}`)}`;
  const expiresAt = new Date(now() + 5 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/u, "Z");
  return {
    tenantId,
    userId: portalUserId,
    workspaceId,
    nonce,
    expiresAt,
    signature: productionSessionBootstrapSignature({ tenantId, portalUserId, workspaceId, nonce, expiresAt, bootstrapSecretHash }),
  };
}

export function setCookieLines(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const joined = headers.get("set-cookie") || "";
  return joined.split(/,(?=\s*medopl_(?:session|csrf)=)/u).map((item) => item.trim()).filter(Boolean);
}

export function cookiePairFromSetCookie(lines, name) {
  const prefix = `${name}=`;
  const line = lines.find((item) => item.startsWith(prefix));
  return line ? line.split(";")[0] : "";
}

export function sessionFromBootstrapHeaders(headers) {
  const cookieLines = setCookieLines(headers);
  const sessionPair = cookiePairFromSetCookie(cookieLines, "medopl_session");
  const csrfPair = cookiePairFromSetCookie(cookieLines, "medopl_csrf");
  return {
    cookieLines,
    sessionPair,
    csrfPair,
    session: sessionPair && csrfPair
      ? { cookieHeader: `${sessionPair}; ${csrfPair}`, csrfToken: decodeURIComponent(csrfPair.slice("medopl_csrf=".length)) }
      : null,
  };
}

export function identityScopeHeaders({ tenantId, portalUserId, workspaceId }) {
  return {
    "X-MedOPL-Tenant-ID": String(tenantId || "").trim(),
    "X-MedOPL-User-ID": String(portalUserId || "").trim(),
    "X-MedOPL-Workspace-ID": String(workspaceId || "").trim(),
  };
}
