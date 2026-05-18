import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sanitizeTaskTitle } from "./app/portal-presentation-domain.mjs";
import { createPortalRuntimeStore } from "./app/portal-store-runtime.mjs";
import { medWorkspaceRoot, repoRoot } from "./config/portal-config.mjs";
import {
  PORTAL_CLOUD_OPERATION_COMPUTE_NODE_POOL_REF,
  PORTAL_CLOUD_OPERATION_COMPUTE_POOL_BASELINE_CAPACITY,
  PORTAL_CLOUD_OPERATION_PACKAGE_C_SECRET_FILE,
  PORTAL_CLOUD_OPERATION_RUNNER_MODE,
  PORTAL_CLOUD_OPERATION_RUNNER_SCRIPT,
} from "./config/portal-config.mjs";
import { drainPortalCloudOperationQueue } from "./workers/portal-cloud-operation-worker.mjs";

export { drainPortalCloudOperationQueue };

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

export async function runPortalCloudOperationWorkerOnce(options = {}) {
  const store = createPortalRuntimeStore({
    atomicWriteJson,
    exists,
    getTaskPath,
    sanitizeTaskTitle,
  });
  const db = await store.readDb();
  const result = drainPortalCloudOperationQueue(db, {
    runnerMode: options.runnerMode || PORTAL_CLOUD_OPERATION_RUNNER_MODE,
    secretFile: options.secretFile || PORTAL_CLOUD_OPERATION_PACKAGE_C_SECRET_FILE,
    runnerScript: options.runnerScript || PORTAL_CLOUD_OPERATION_RUNNER_SCRIPT,
    computeNodePoolRef: options.computeNodePoolRef || PORTAL_CLOUD_OPERATION_COMPUTE_NODE_POOL_REF,
    computePoolBaselineCapacity: options.computePoolBaselineCapacity ?? PORTAL_CLOUD_OPERATION_COMPUTE_POOL_BASELINE_CAPACITY,
    repoRoot: options.repoRoot || repoRoot,
    workerId: options.workerId || `portal-cloud-operation-worker-${process.pid}`,
    maxOperations: options.maxOperations || 1,
  });
  await store.writeDb(db);
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes("--once")) {
    console.error("portal_cloud_operation_worker_requires_once");
    process.exit(1);
  }
  let exitCode = 0;
  try {
    const result = await runPortalCloudOperationWorkerOnce();
    console.log(JSON.stringify({
      ok: Boolean(result.ok),
      processedCount: Array.isArray(result.processed) ? result.processed.length : 0,
      error: result.ok ? "" : String(result.error || "worker_failed"),
    }, null, 2));
    if (!result.ok) exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
