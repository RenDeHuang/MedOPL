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

const [router, controlplane, controlplaneTest, bridgeRoutes, bridgeLaunch] = await Promise.all([
  readRepoFile("services/medopl-go-backend/internal/server/router.go"),
  readRepoFile("services/medopl-go-backend/internal/server/handlers/controlplane.go"),
  readRepoFile("services/medopl-go-backend/internal/server/handlers/controlplane_test.go"),
  readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-routes.mjs"),
  readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-launch.mjs"),
]);

const bridgeSurface = `${bridgeRoutes}\n${bridgeLaunch}`;

for (const marker of [
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

console.log(JSON.stringify({
  ok: true,
  contract: "v22_runtime_gate",
  portalBackend: "physically_removed",
  controlPlane: "go",
}, null, 2));
