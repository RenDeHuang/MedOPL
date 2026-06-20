import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readRepoGoDir(repoPath) {
  const absoluteDir = path.join(repoRoot, repoPath);
  const names = await readdir(absoluteDir);
  const goFiles = names.filter((name) => name.endsWith(".go") && !name.endsWith("_test.go")).sort();
  const sources = await Promise.all(goFiles.map((name) => readRepoFile(path.join(repoPath, name))));
  return sources.join("\n");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

const apiContract = await readJson("contracts/medopl-api-contract.json");
const controlplaneServiceSurface = await readRepoGoDir("services/medopl-go-backend/internal/service/controlplane");
assert.equal(controlplaneServiceSurface.includes("func Test"), false, "api_contract_surface_must_exclude_go_test_files");
assert.equal(controlplaneServiceSurface.includes("t.Fatalf"), false, "api_contract_surface_must_exclude_go_test_assertions");
const goRouteSurface = [
  await readRepoFile("services/medopl-go-backend/internal/server/router.go"),
  await readRepoFile("services/medopl-go-backend/internal/server/handlers/controlplane.go"),
  controlplaneServiceSurface,
].join("\n");
const serviceSurface = controlplaneServiceSurface;
const migration = await readRepoFile("services/medopl-go-backend/migrations/0001_baseline.sql");

const requiredRouteMarkers = [
  "/api/me",
  "/api/workspace",
  "/runtime-gate",
  "/opl/runs",
  "/billing/summary",
  "/api/admin/audit",
  "/v22/managed-environment/release",
  "/v22/storage/destroy",
];
for (const marker of requiredRouteMarkers) {
  assert(goRouteSurface.includes(marker), `api_contract_route_missing:${marker}`);
}

for (const table of ["tenants", "workspaces", "runs", "artifacts", "files", "billing_events", "cloud_operations"]) {
  assert(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `api_contract_table_missing:${table}`);
}

for (const forbidden of apiContract.medopl_api_contract.forbidden_response_fields) {
  assert(!goRouteSurface.includes(`"${forbidden}"`), `api_contract_forbidden_response_field:${forbidden}`);
}

const runtimeGate = apiContract.medopl_api_contract.runtime_gate;
assert(runtimeGate, "api_contract_runtime_gate_missing");
assert.equal(runtimeGate.product_owner, "medopl", "runtime_gate_product_owner_must_be_medopl");
assert.equal(runtimeGate.primary_consumer, "opl-webui", "runtime_gate_primary_consumer_must_be_opl_webui");
assert.equal(runtimeGate.consumer_role, "entry_and_chat_surface", "runtime_gate_consumer_role_mismatch");
assert.deepEqual(runtimeGate.invocation_modes, ["api_only", "ordinary_chat", "runtime_required"], "runtime_gate_invocation_modes_mismatch");
assert.equal(runtimeGate.ordinary_chat_owner, "opl-webui", "runtime_gate_ordinary_chat_owner_must_be_opl_webui");
assert.equal(runtimeGate.runtime_required_owner, "medopl", "runtime_gate_runtime_required_owner_must_be_medopl");
assert.equal(apiContract.medopl_api_contract.storage_destroy?.route, "POST /api/v22/storage/destroy", "storage_destroy_route_contract_missing");
assert.deepEqual(
  apiContract.medopl_api_contract.storage_destroy?.must_return,
  ["ok", "storageDestroyed", "billingStopped", "storageBindingId", "storageState", "auditEvent", "releaseReceipts"],
  "storage_destroy_must_return_contract_mismatch",
);
assert.deepEqual(
  apiContract.medopl_api_contract.storage_destroy?.must_not_return,
  ["rawObjectStoreSecret", "signedUrl", "objectKey", "storageKey", "localPath", "bearerToken", "runtimeToken", "kubeconfig"],
  "storage_destroy_forbidden_response_contract_mismatch",
);

for (const field of runtimeGate.must_return) {
  assert(
    goRouteSurface.includes(`"${field}"`) || goRouteSurface.includes(`json:"${field}`),
    `runtime_gate_go_response_field_missing:${field}`,
  );
}
const runtimeGateProjectionSurface = serviceSurface.slice(
  serviceSurface.indexOf("type RuntimeGateProjection struct"),
  serviceSurface.indexOf("type LaunchLookupInput struct"),
);
for (const field of runtimeGate.forbidden_response_fields) {
  assert(!runtimeGateProjectionSurface.includes(`json:"${field}`), `runtime_gate_forbidden_response_field:${field}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_medopl_api_contract",
  routes: requiredRouteMarkers.length,
}, null, 2));
