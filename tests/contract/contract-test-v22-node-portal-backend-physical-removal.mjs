import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

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

function assertNotIncludes(source, marker, label) {
  assert.equal(String(source).includes(marker), false, `${label}_forbidden:${marker}`);
}

async function assertNodeBackendPhysicallyRemoved() {
  assert.equal(await exists("services/portal/src"), false, "node_portal_backend_src_must_be_physically_removed");
  assert.equal(await exists("services/portal/src/server.mjs"), false, "node_portal_server_entry_must_be_physically_removed");
  assert.equal(await exists("services/portal/src/services/portal-workflow-facade.service.mjs"), false, "node_portal_facade_must_not_remain_as_shell");
}

async function assertPortalPackageCannotLaunchNodeBackend() {
  const packageJson = JSON.parse(await readRepoFile("services/portal/package.json"));
  const scripts = packageJson.scripts ?? {};
  for (const [name, command] of Object.entries(scripts)) {
    assertNotIncludes(command, "src/server.mjs", `portal_script_must_not_launch_node_backend:${name}`);
    assertNotIncludes(command, "migrate-schema.mjs", `portal_script_must_not_run_node_schema_migration:${name}`);
  }
  assertIncludes(scripts.start, "frontend run dev", "portal_start_must_be_frontend_only");
  assertIncludes(scripts.check, "frontend run typecheck", "portal_check_must_be_frontend_only");
}

async function assertFrontendUsesGoApiOnly() {
  const viteConfig = await readRepoFile("services/portal/frontend/vite.config.ts");
  const client = await readRepoFile("services/portal/frontend/src/api/client.ts");
  assertIncludes(viteConfig, "goControlPlaneTarget", "vite_must_keep_go_control_plane_target");
  assertIncludes(viteConfig, '"/api": goControlPlaneTarget', "vite_must_proxy_api_to_go_backend");
  assertIncludes(client, "goControlPlaneClient", "frontend_must_export_go_client");
  for (const forbidden of [
    "portalBackendTarget",
    "VITE_PORTAL_BACKEND_URL",
    '"/portal/api"',
    "/portal/api",
    "apiClient",
  ]) {
    assertNotIncludes(viteConfig, forbidden, "vite_must_not_reference_node_backend");
    assertNotIncludes(client, forbidden, "frontend_client_must_not_reference_node_backend");
  }
}

async function assertGoBackendOwnsLocalSurface() {
  const router = await readRepoFile("services/medopl-go-backend/internal/server/router.go");
  const controlplane = await readRepoFile("services/medopl-go-backend/internal/server/handlers/controlplane.go");
  const goSurface = `${router}\n${controlplane}`;
  for (const marker of [
    'GET("/healthz"',
    'GET("/api/me"',
    'GET("/api/overview"',
    'GET("/api/workspace"',
    'GET("/api/announcements"',
    'GET("/api/cloud/connector/status"',
    'POST("/api/cloud/connector/plan"',
    'POST("/opl/entry/preflight"',
    'POST("/opl/launch"',
  ]) {
    assertIncludes(goSurface, marker, `go_router_must_own_local_surface:${marker}`);
  }
}

async function assertCurrentTruthSaysPhysicalRemoval() {
  const [active, source, runtime, specs, delivery] = await Promise.all([
    readRepoFile("docs/active/README.md"),
    readRepoFile("docs/source/README.md"),
    readRepoFile("docs/runtime/README.md"),
    readRepoFile("docs/specs/README.md"),
    readRepoFile("docs/delivery/README.md"),
  ]);
  for (const [label, sourceText] of Object.entries({ active, source, runtime, specs, delivery })) {
    assertNotIncludes(sourceText, "退役对象", `${label}_must_not_describe_node_backend_as_retirement_object`);
    assertNotIncludes(sourceText, "retired Node backend", `${label}_must_not_describe_node_backend_as_retired_surface`);
    assertNotIncludes(sourceText, "兼容层", `${label}_must_not_keep_node_compatibility_truth`);
    assertNotIncludes(sourceText, "portal-workflow-facade", `${label}_must_not_keep_node_facade_truth`);
  }
  assertIncludes(source, "services/portal/src` 已物理清退", "source_truth_must_record_physical_removal");
  assertIncludes(specs, "Node Portal backend physical removal", "specs_must_record_physical_removal");
  assertIncludes(runtime, "Portal frontend -> Go backend `/api`", "runtime_must_record_frontend_go_boundary");
}

async function assertActiveTestsDoNotImportNodeBackend() {
  const registry = await readRepoFile("scripts/v22-test-classification.mjs");
  const manifest = await readRepoFile("tests/fixtures/v22/agent-verify-manifest.json");
  for (const [label, source] of Object.entries({ registry, manifest })) {
    assertNotIncludes(source, "contract-test-v22-node-portal-workflow-facade-boundary.mjs", `${label}_must_use_physical_removal_gate_name`);
    assertNotIncludes(source, "portal-runtime-suite.mjs --group all", `${label}_must_not_run_node_portal_runtime_suite`);
    assertNotIncludes(source, "services/portal/src/**", `${label}_must_not_allow_node_backend_tree`);
    assertNotIncludes(source, "tests/fixtures/v22/backend-go-convergence", `${label}_must_not_keep_node_backend_inventory_fixture`);
  }
}

await assertNodeBackendPhysicallyRemoved();
await assertPortalPackageCannotLaunchNodeBackend();
await assertFrontendUsesGoApiOnly();
await assertGoBackendOwnsLocalSurface();
await assertCurrentTruthSaysPhysicalRemoval();
await assertActiveTestsDoNotImportNodeBackend();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_node_portal_backend_physical_removal",
  canClaim: [
    "services/portal/src is physically absent from current repo",
    "Portal frontend is frontend-only and uses Go /api",
    "Node Portal backend is not retained as a shell, facade or compatibility layer",
  ],
}, null, 2));
