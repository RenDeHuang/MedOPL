import { createHash } from "node:crypto";

export function productionSessionBootstrapSignature({ tenantId, portalUserId, workspaceId, nonce, expiresAt, bootstrapSecretHash }) {
  return createHash("sha256")
    .update([tenantId, portalUserId, workspaceId, nonce, expiresAt, bootstrapSecretHash].map((item) => String(item || "").trim()).join(":"))
    .digest("hex");
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
