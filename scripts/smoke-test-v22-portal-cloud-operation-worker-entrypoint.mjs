import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("services/portal/src/portal-cloud-operation-worker.mjs", "utf8");

for (const phrase of [
  "createPortalRuntimeStore",
  "readDb",
  "drainPortalCloudOperationQueue",
  "writeDb",
  "--once",
  "PORTAL_CLOUD_OPERATION_RUNNER_MODE",
  "PORTAL_CLOUD_OPERATION_PACKAGE_C_SECRET_FILE",
  "PORTAL_CLOUD_OPERATION_COMPUTE_NODE_POOL_REF",
]) {
  assert(source.includes(phrase), `worker_entrypoint_missing:${phrase}`);
}

assert.equal(/setInterval|while\s*\(\s*true\s*\)/.test(source), false, "worker_entrypoint_must_not_poll_forever_without_contract");
assert.match(source, /finally\s*\{[\s\S]*process\.exit\(/, "worker_entrypoint_must_exit_after_once_to_close_open_store_handles");
assert.equal(/console\.log\([^)]*secretFile/i.test(source), false, "worker_entrypoint_must_not_log_secret_file");
assert.equal(/console\.log\([^)]*computeNodePoolRef/i.test(source), false, "worker_entrypoint_must_not_log_node_pool_ref");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_cloud_operation_worker_entrypoint",
  checked: [
    "explicit_once_mode",
    "read_db_drain_write_db",
    "package_c_runner_env_boundary",
    "no_secret_or_node_pool_ref_logging",
  ],
}, null, 2));
