import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const apiContract = await readJson("contracts/medopl-api-contract.json");
const goRouteSurface = [
  await readRepoFile("services/medopl-go-backend/internal/server/router.go"),
  await readRepoFile("services/medopl-go-backend/internal/server/handlers/controlplane.go"),
  await readRepoFile("services/medopl-go-backend/internal/service/controlplane/service.go"),
].join("\n");
const serviceSurface = await readRepoFile("services/medopl-go-backend/internal/service/controlplane/service.go");
const migration = await readRepoFile("services/medopl-go-backend/migrations/0001_baseline.sql");

const requiredRouteMarkers = [
  "/api/me",
  "/api/workspace",
  "/runtime-gate",
  "/opl/runs",
  "/billing/summary",
  "/api/admin/audit",
  "/v22/managed-environment/release",
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
assert.deepEqual(runtimeGate.invocation_modes, ["api_only", "runtime_required"], "runtime_gate_invocation_modes_mismatch");
assert.equal(runtimeGate.ordinary_chat_owner, "opl-webui", "runtime_gate_ordinary_chat_owner_must_be_opl_webui");
assert.equal(runtimeGate.runtime_required_owner, "medopl", "runtime_gate_runtime_required_owner_must_be_medopl");

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
