import { randomUUID } from "node:crypto";

export function ensureSeedAdminAccount({
  adminSeed,
  adminSeedBalance,
  db,
  hashPassword,
}) {
  const adminPasswordHash = hashPassword(adminSeed.password);
  let changed = false;
  let seededAdmin = db.users.find((item) => item.email === adminSeed.email && item.role === "admin");
  if (!seededAdmin) {
    seededAdmin = {
      id: randomUUID(),
      email: adminSeed.email,
      name: adminSeed.name,
      role: "admin",
      status: "active",
      currentTaskSlug: "default",
      preferences: { theme: "light" },
      passwordHash: adminPasswordHash,
      createdAt: new Date().toISOString(),
    };
    db.users.push(seededAdmin);
    db.wallets.push({ userId: seededAdmin.id, balance: adminSeedBalance, updatedAt: new Date().toISOString() });
    changed = true;
  } else {
    if (seededAdmin.passwordHash !== adminPasswordHash) {
      seededAdmin.passwordHash = adminPasswordHash;
      changed = true;
    }
    if (!seededAdmin.preferences) {
      seededAdmin.preferences = { theme: "light" };
      changed = true;
    }
  }
  return changed;
}
