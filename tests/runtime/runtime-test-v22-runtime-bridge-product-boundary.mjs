import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

async function readMjsTree(dir) {
  const entries = await readdir(path.join(repoRoot, dir), { withFileTypes: true });
  const chunks = [];
  for (const entry of entries) {
    const repoPath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) chunks.push(await readMjsTree(repoPath));
    if (entry.isFile() && entry.name.endsWith(".mjs")) chunks.push(await readRepoFile(repoPath));
  }
  return chunks.join("\n");
}

const contract = await readJson("contracts/medopl-runtime-bridge-contract.json");
const routeSurface = await readMjsTree("services/opl-runtime-bridge/src");

const commandMarkers = new Map([
  ["create_session", ["sessionId", "workspaceSessionId"]],
  ["start_run", ["runId", "runtimeSessionId"]],
  ["stop_run", ["cancelRun", "runtime_run_canceled"]],
  ["sync_files", ["artifactId", "artifactName"]],
  ["collect_result", ["artifactId", "trace-create"]],
  ["release_session", ["Runtime Bridge retains runtime/session adapters only", "billing ledger owner 是 Portal/Go control plane"]],
]);

for (const command of contract.medopl_runtime_bridge_contract.bridge_commands) {
  const markers = commandMarkers.get(command) || [command, command.replaceAll("_", "-")];
  assert(markers.some((marker) => routeSurface.includes(marker)), `runtime_bridge_command_not_represented:${command}`);
}

assert(routeSurface.includes("billing ledger owner 是 Portal/Go control plane"), "runtime_bridge_must_not_own_billing_truth");
assert(!routeSurface.includes("upstream/internal"), "runtime_bridge_must_not_import_upstream_internal");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_runtime_bridge_product_boundary",
}, null, 2));
