import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function assertIncludes(source, marker, label) {
  assert(String(source).includes(marker), `${label}_missing:${marker}`);
}

function assertNotMatches(source, pattern, label) {
  assert.equal(pattern.test(String(source)), false, label);
}

assert.equal(await exists("services/portal/src"), false, "runtime_gate_must_not_import_node_portal_backend");

const [apiContract, runtimeContract, cloudContract, router, controlplane, controlplaneTest, bridgeRoutes, bridgeLaunch] = await Promise.all([
  readRepoFile("contracts/medopl-api-contract.json").then(JSON.parse),
  readRepoFile("contracts/medopl-runtime-bridge-contract.json").then(JSON.parse),
  readRepoFile("contracts/medopl-cloud-boundary.json").then(JSON.parse),
  readRepoFile("services/medopl-go-backend/internal/server/router.go"),
  readRepoFile("services/medopl-go-backend/internal/server/handlers/controlplane.go"),
  readRepoFile("services/medopl-go-backend/internal/server/handlers/controlplane_test.go"),
  readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-routes.mjs"),
  readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-launch.mjs"),
]);

const bridgeSurface = `${bridgeRoutes}\n${bridgeLaunch}`;

for (const marker of [
  'api.POST("/opl/runtime-gate"',
  'router.GET("/api/session-traces"',
  'router.GET("/api/runs"',
  'api.POST("/provider/preflight"',
  'api.POST("/opl/launch"',
  'api.GET("/opl/bootstrap"',
  'api.POST("/opl/sessions/bind"',
  'api.POST("/opl/messages"',
  'api.POST("/opl/files"',
  'api.POST("/opl/runs"',
  'api.GET("/opl/artifacts/:artifactRef"',
]) {
  assertIncludes(`${router}\n${controlplane}`, marker, `go_runtime_gate_surface:${marker}`);
}

for (const marker of [
  "/api/opl/runtime-gate",
  "/api/provider/bind",
  "/api/provider/preflight",
  "/api/v22/managed-environment/open",
  "/api/opl/bootstrap",
  "/api/opl/files",
  "/api/opl/runs",
  "/api/billing/summary",
  "/api/platform-provisioned-resources",
  "/api/v22/managed-environment/release",
  "assertPublicPayload",
  "rawProviderKey",
  "ordinary_chat",
  "runtime_required",
  "productOwner",
  "primaryConsumer",
  "nodePoolProjection",
  "destroyStorage",
  "consumerProjection",
  "uploadEnabled",
  "runEnabled",
  "artifactEnabled",
  "releaseAction",
  "storageAction",
]) {
  assertIncludes(controlplaneTest, marker, `go_controlplane_test_must_cover:${marker}`);
}

for (const marker of [
  "GET /api/opl/bootstrap",
  "POST /api/opl/sessions/bind",
  "POST /api/opl/messages",
  "POST /api/opl/files",
  "POST /api/opl/runs",
  "GET /api/opl/status",
  "/runtime-bridge/api/opl/bootstrap",
  "/runtime-bridge/api/opl/sessions/bind",
  "/runtime-bridge/api/opl/messages",
  "/runtime-bridge/api/opl/files",
  "/runtime-bridge/api/opl/runs",
  "/runtime-bridge/api/opl/artifacts/{artifactRef}",
]) {
  assertIncludes(bridgeSurface, marker, `runtime_bridge_routes_must_keep_public_surface:${marker}`);
}

assertNotMatches(`${router}\n${controlplane}\n${bridgeSurface}`, /services\/portal\/src|rawProviderKey[^"\n]*json|launchToken[^"\n]*json|runtimeToken[^"\n]*json/u, "runtime_gate_must_not_restore_node_backend_or_token_projection");

const runtimeGate = apiContract.medopl_api_contract.runtime_gate;
assert.equal(runtimeGate.product_owner, "medopl", "runtime_gate_product_owner_must_be_medopl");
assert.equal(runtimeGate.primary_consumer, "opl-webui", "runtime_gate_primary_consumer_must_be_opl_webui");
assert.equal(runtimeGate.ordinary_chat_owner, "opl-webui", "ordinary_chat_must_stay_with_opl_webui");
assert.equal(runtimeGate.runtime_required_owner, "medopl", "runtime_required_must_enter_medopl");
assert.deepEqual(runtimeGate.must_not_claim, [
  "medopl_owns_ordinary_chat",
  "medopl_owns_opl_research_quality",
  "runtime_required_without_medopl_runtime",
  "storage_destroy_without_user_intent"
], "runtime_gate_must_not_claim_mismatch");

const bridgeBoundary = runtimeContract.medopl_runtime_bridge_contract;
assert.equal(bridgeBoundary.consumer_context.product_owner, "medopl", "bridge_product_owner_must_be_medopl");
assert.equal(bridgeBoundary.consumer_context.primary_consumer, "opl-webui", "bridge_primary_consumer_must_be_opl_webui");
assert.deepEqual(bridgeBoundary.consumer_context.opl_webui_owned_modes, ["ordinary_chat"], "bridge_opl_webui_modes_mismatch");
assert.deepEqual(bridgeBoundary.consumer_context.medopl_owned_modes, ["runtime_required", "full_runtime"], "bridge_medopl_modes_mismatch");

const cloudBoundary = cloudContract.medopl_cloud_boundary;
for (const concept of ["runtime_binding", "storage_binding", "node_pool_projection", "billing_freeze", "release_receipt", "storage_destroy_intent"]) {
  assertIncludes(cloudBoundary.platform_owned_concepts.join("\n"), concept, `cloud_boundary_platform_owned_concept:${concept}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_runtime_gate",
  portalBackend: "physically_removed",
  controlPlane: "go",
}, null, 2));
