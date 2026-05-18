import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { createPortalRuntimeStore } from "./app/portal-store-runtime.mjs";
import { sanitizeTaskTitle } from "./app/portal-presentation-domain.mjs";
import { medWorkspaceRoot, PORTAL_STORAGE_MODE } from "./config/portal-config.mjs";

async function exists(file) {
  try {
    await access(file, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function atomicWriteJson(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await rename(tmp, file);
}

function getTaskPath(userId, taskSlug) {
  if (!userId) throw new Error("portal_user_id_required");
  if (!taskSlug) throw new Error("workspace_id_required");
  return path.join(medWorkspaceRoot, String(userId), String(taskSlug));
}

if (PORTAL_STORAGE_MODE !== "postgres_redis") {
  console.error(`portal_schema_migration_requires_postgres_redis:${PORTAL_STORAGE_MODE}`);
  process.exit(1);
}

const store = createPortalRuntimeStore({
  atomicWriteJson,
  exists,
  getTaskPath,
  sanitizeTaskTitle,
});

await store.migratePortalSchema();
console.log(JSON.stringify({
  ok: true,
  component: "portal",
  schemaVersion: "v20.32",
}, null, 2));
