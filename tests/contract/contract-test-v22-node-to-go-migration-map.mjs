import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const inventoryPath = "tests/fixtures/v22/backend-go-convergence/backend-inventory.json";
const migrationMapPath = "tests/fixtures/v22/backend-go-convergence/migration-map.json";
const requiredNodes = [
  "portal.opl_launch_service",
  "portal.cloud_operation_service",
  "portal.billing_trace_aggregation",
  "runtimebridge.launch_service",
  "runtimebridge.message_service",
  "runtimebridge.run_service",
  "runtimebridge.secret_store",
  "gateway.auth_bridge",
];
const requiredEdgeContracts = [
  "portal_to_runtimebridge_launch_bootstrap",
  "portal_to_runtimebridge_runs_query",
  "runtimebridge_to_opl_session_message",
  "runtimebridge_to_runtime_agent_full_runtime_run",
  "portal_to_billing_audit_repositories_cloud_operation",
];
const forbiddenEdgeFields = [
  "rawApiKey",
  "launchTokenInBrowserStorage",
  "runtimeTokenInBrowserStorage",
  "secretFilePathExposed",
  "codexHomePathExposed",
];
const requiredGoLayers = ["domain", "service", "repository", "handler", "server", "integration", "worker"];

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readJson(repoPath) {
  return JSON.parse(await readFile(path.join(repoRoot, repoPath), "utf8"));
}

function inventoryFilesByClassification(inventory, classifications) {
  const files = [];
  for (const group of inventory.groups) {
    if (!classifications.includes(group.targetClassification)) continue;
    files.push(...group.paths);
  }
  return files.sort();
}

assert.equal(await exists(migrationMapPath), true, "migration_map_fixture_missing");

const [inventory, migrationMap] = await Promise.all([
  readJson(inventoryPath),
  readJson(migrationMapPath),
]);

assert.equal(migrationMap.program, "backend_go_convergence_program", "migration_map_program_mismatch");
assert.equal(migrationMap.version, 1, "migration_map_version_mismatch");
assert.equal(migrationMap.inventory, inventoryPath, "migration_map_inventory_pointer_mismatch");
assert(Array.isArray(migrationMap.nodes), "migration_map_nodes_must_be_array");
assert(Array.isArray(migrationMap.edges), "migration_map_edges_must_be_array");

const nodeIds = new Set(migrationMap.nodes.map((node) => node.id));
for (const id of requiredNodes) {
  assert(nodeIds.has(id), `migration_map_missing_required_node:${id}`);
}

const migratedFiles = new Set(migrationMap.nodes.flatMap((node) => node.sourcePaths || []));
for (const repoPath of inventoryFilesByClassification(inventory, ["misplaced", "delete-later"])) {
  assert(migratedFiles.has(repoPath), `migration_map_must_cover_risky_inventory_file:${repoPath}`);
}

for (const node of migrationMap.nodes) {
  assert(node.id, "migration_node_missing_id");
  assert(Array.isArray(node.sourcePaths) && node.sourcePaths.length > 0, `migration_node_missing_source_paths:${node.id}`);
  assert(Array.isArray(node.responsibilities) && node.responsibilities.length > 0, `migration_node_missing_responsibilities:${node.id}`);
  assert(node.target?.module || node.retire === true, `migration_node_requires_target_or_retire:${node.id}`);
  if (node.retire === true) assert(node.replacementNodeId || node.reason, `retire_node_requires_replacement_or_reason:${node.id}`);
  for (const repoPath of node.sourcePaths) {
    assert.equal(await exists(repoPath), true, `migration_node_source_missing_on_disk:${node.id}:${repoPath}`);
  }
}

for (const contract of requiredEdgeContracts) {
  assert(migrationMap.edges.some((edge) => edge.contract === contract), `migration_map_missing_required_edge:${contract}`);
}

for (const edge of migrationMap.edges) {
  assert(nodeIds.has(edge.from), `migration_edge_from_missing_node:${edge.contract}`);
  assert(nodeIds.has(edge.to), `migration_edge_to_missing_node:${edge.contract}`);
  assert(Array.isArray(edge.forbiddenFields), `migration_edge_forbidden_fields_missing:${edge.contract}`);
  for (const forbiddenField of forbiddenEdgeFields) {
    assert(edge.forbiddenFields.includes(forbiddenField), `migration_edge_must_forbid_field:${edge.contract}:${forbiddenField}`);
  }
}

for (const node of migrationMap.nodes.filter((item) => item.riskTags?.includes("runtime_bridge_token_secret_boundary"))) {
  assert(node.secretBoundary?.secretSource, `secret_node_missing_source:${node.id}`);
  assert(node.secretBoundary?.secretConsumer, `secret_node_missing_consumer:${node.id}`);
  assert(Array.isArray(node.secretBoundary?.redactedPublicFields), `secret_node_missing_redacted_public_fields:${node.id}`);
  assert(Array.isArray(node.secretBoundary?.nonPublicFields), `secret_node_missing_non_public_fields:${node.id}`);
}

for (const node of migrationMap.nodes.filter((item) => item.riskTags?.includes("memory_launch_truth"))) {
  assert(Array.isArray(node.truthBoundary) && node.truthBoundary.length > 0, `memory_truth_node_missing_truth_boundary:${node.id}`);
}

for (const node of migrationMap.nodes.filter((item) => item.riskTags?.includes("cloud_mutation"))) {
  assert.deepEqual(node.asyncBoundary, ["command_handler", "operation_repository", "worker_executor", "projection_reader"], `cloud_mutation_node_async_boundary_mismatch:${node.id}`);
}

for (const node of migrationMap.nodes.filter((item) => item.riskTags?.includes("billing_audit_aggregation"))) {
  assert(node.ledgerOwner, `billing_audit_node_missing_ledger_owner:${node.id}`);
}

for (const node of migrationMap.nodes.filter((item) => item.nodeBoundary === "keep-node-boundary")) {
  assert(["gateway.auth_bridge", "portal.bff_viewmodel"].includes(node.id), `keep_node_boundary_not_allowed:${node.id}`);
}

const serialized = JSON.stringify(migrationMap);
assert.equal(/user_owned|resource_order|med_autoscience_runner_primary|resource_provisioner_primary/u.test(serialized), false, "migration_map_must_not_restore_legacy_targets");

for (const layer of requiredGoLayers) {
  assert(migrationMap.goLayerCoverage.includes(layer), `migration_map_missing_go_layer:${layer}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_node_to_go_backend_migration_map",
  nodes: migrationMap.nodes.length,
  edges: migrationMap.edges.length,
}, null, 2));
