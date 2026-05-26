import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const programId = "go-control-plane-mvp-takeover";
const physicalRemovalGate = "node tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs";
const groupGateCommands = [
  "node tests/contract/contract-test-v22-backend-go-convergence-program.mjs",
  physicalRemovalGate,
  "node tests/contract/contract-test-v22-go-backend-service-surface.mjs",
  "node tests/contract/contract-test-v22-commercial-package-model.mjs",
];

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

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertIncludes(source, marker, label) {
  assert(String(source).includes(marker), `${label}_missing:${marker}`);
}

function assertNotIncludes(source, marker, label) {
  assert.equal(String(source).includes(marker), false, `${label}_forbidden:${marker}`);
}

function assertCommandListContains(commands, expectedCommands, label) {
  assert(Array.isArray(commands), `${label}_commands_must_be_array`);
  for (const command of expectedCommands) assert(commands.includes(command), `${label}_missing:${command}`);
}

function assertCommandListExcludes(commands, forbiddenCommands, label) {
  assert(Array.isArray(commands), `${label}_commands_must_be_array`);
  for (const command of forbiddenCommands) assert(!commands.includes(command), `${label}_forbidden:${command}`);
}

const [active, specs, delivery, runtime, source, product, current, manifest, classifierSource] = await Promise.all([
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/specs/README.md"),
  readRepoFile("docs/delivery/README.md"),
  readRepoFile("docs/runtime/README.md"),
  readRepoFile("docs/source/README.md"),
  readRepoFile("docs/product/README.md"),
  readJson("tests/fixtures/v22/goal-current.json"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readRepoFile("scripts/v22-test-classification.mjs"),
]);

assert.equal(await exists("services/portal/src"), false, "node_portal_backend_src_must_be_physically_removed");
assert.equal(await exists("tests/fixtures/v22/backend-go-convergence/backend-inventory.json"), false, "backend_inventory_fixture_must_be_removed_after_physical_cleanup");
assert.equal(await exists("tests/fixtures/v22/backend-go-convergence/migration-map.json"), false, "migration_map_fixture_must_be_removed_after_physical_cleanup");

const program = current.backend_go_convergence_program;
assert(program, "backend_go_convergence_program_missing");
assert.equal(program.id, programId, "program_id_mismatch");
assert.equal(program.owner, "MedOPL", "program_owner_mismatch");
assert.equal(program.status, "closed", "program_must_be_closed_before_node_physical_removal");
assert.equal(program.target_go_service, "services/medopl-go-backend", "program_target_service_mismatch");
assert.equal(program.current_product_cursor, "real-cloud-authorization-boundary", "closed_program_must_handoff_to_real_cloud_authorization_boundary");
assert.equal(current.release_readiness_state?.status, "authorization_required", "closed_program_must_keep_real_cloud_authorization_boundary");
assert.equal(current.release_readiness_state?.blocked_before_risky_execution, true, "closed_program_must_block_risky_execution");

assert.equal(program.canonical_backend_target.service, "services/medopl-go-backend", "canonical_backend_target_must_be_go");
assert.equal(program.canonical_backend_target.current_active_implementation, "services/medopl-go-backend", "active_backend_implementation_must_be_go");
assert.equal(
  program.canonical_backend_target.node_portal_role,
  "physically_removed_not_business_truth",
  "node_portal_role_must_record_physical_removal",
);
assert(Array.isArray(program.canonical_backend_target.node_portal_must_not_expand), "node_portal_no_expand_list_required");

for (const phrase of [
  "Go control-plane MVP takeover",
  "real-cloud-authorization-boundary",
]) {
  assertIncludes(active, phrase, `active_must_record:${phrase}`);
}
assertIncludes(delivery, "Go Control Plane MVP Takeover Lane", "delivery_must_name_program");
assertIncludes(delivery, "先 Go control-plane MVP，再 real-cloud-readiness", "delivery_must_gate_real_cloud_after_go_mvp");
assertIncludes(specs, "spec:v22-go-control-plane-mvp-takeover-boundary", "specs_must_define_program_anchor");
assertIncludes(specs, "Node Portal backend physical removal", "specs_must_record_physical_removal");
assertIncludes(specs, "`services/medopl-go-backend` 是本地 MVP takeover target", "specs_must_define_go_canonical_target");
assertIncludes(runtime, "Backend Convergence Target View", "runtime_must_record_backend_target_view");
assertIncludes(runtime, "Portal frontend -> Go backend `/api`", "runtime_must_record_frontend_go_boundary");
assertIncludes(source, "services/portal/src` 已物理清退", "source_must_record_node_backend_physical_removal");
assertIncludes(source, "`services/medopl-go-backend` is the local pre-cloud SaaS backend deployment surface", "source_must_promote_go_backend_surface");
assertIncludes(product, "`services/medopl-go-backend`", "product_must_record_go_backend_boundary");

for (const [label, text] of Object.entries({ active, specs, delivery, runtime, source, product })) {
  assertNotIncludes(text, "backend-inventory.json", `${label}_must_not_keep_backend_inventory_current_truth`);
  assertNotIncludes(text, "migration-map.json", `${label}_must_not_keep_migration_map_current_truth`);
  assertNotIncludes(text, "contract-test-v22-node-portal-workflow-facade-boundary.mjs", `${label}_must_not_reference_old_workflow_facade_gate`);
}

const backendSuite = manifest.suites.find((suite) => suite.id === "backend-go-convergence");
const backendPackage = manifest.package_suites.find((suite) => suite.id === "backend-go-convergence");
assert(backendSuite, "manifest_backend_suite_missing");
assert(backendPackage, "manifest_backend_package_missing");
for (const [label, suite] of [["backend_suite", backendSuite], ["backend_package", backendPackage]]) {
  assertCommandListContains(suite.commands, groupGateCommands, `manifest_${label}`);
  assertCommandListExcludes(suite.commands, [
    "node tests/contract/contract-test-v22-node-portal-workflow-facade-boundary.mjs",
  ], `manifest_${label}`);
}

const serializedManifest = JSON.stringify(manifest);
for (const forbidden of [
  "services/portal/src/**",
  "tests/fixtures/v22/backend-go-convergence",
  "contract-test-v22-node-portal-workflow-facade-boundary.mjs",
  "portal-runtime-suite.mjs --group all",
]) {
  assertNotIncludes(serializedManifest, forbidden, `manifest_must_not_keep:${forbidden}`);
}
assertIncludes(classifierSource, "\"tests/contract/contract-test-v22-backend-go-convergence-program.mjs\"", "test_registry_must_register_program_gate");
assertIncludes(classifierSource, "\"tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs\"", "test_registry_must_register_physical_removal_gate");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_backend_go_convergence_program",
  status: program.status,
  backend: "services/medopl-go-backend",
  nodePortalBackend: "physically_removed",
}, null, 2));
