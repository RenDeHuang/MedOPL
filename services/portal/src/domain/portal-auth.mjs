import { scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password) {
  return scryptSync(password, "portal-salt-v1", 64).toString("hex");
}

export function verifyPassword(password, hashed) {
  const a = Buffer.from(hashPassword(password), "hex");
  const b = Buffer.from(hashed, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
