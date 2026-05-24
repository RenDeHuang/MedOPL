import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const programId = "go-control-plane-mvp-takeover";
const branchName = "feat/v22-go-control-plane-mvp-takeover";
const inventoryPath = "tests/fixtures/v22/backend-go-convergence/backend-inventory.json";
const migrationMapPath = "tests/fixtures/v22/backend-go-convergence/migration-map.json";
const groupGateCommands = [
  "node tests/contract/contract-test-v22-backend-go-convergence-program.mjs",
  "node tests/contract/contract-test-v22-node-portal-workflow-facade-boundary.mjs",
  "node tests/contract/contract-test-v22-go-backend-service-surface.mjs",
  "node tests/contract/contract-test-v22-commercial-package-model.mjs",
];
const expectedPhaseIds = [
  "structure-truth-convergence",
  "responsibility-inventory",
  "docs-code-alignment-pass-1",
  "production-data-layer",
  "runtime-run-file-artifact-closure",
  "workflow-facade",
  "commercial-mainline",
];
const activeRoots = [
  "services/portal/src",
  "services/opl-web-gateway/src",
  "services/opl-runtime-bridge/src",
];
const classifications = ["correct-place", "misplaced", "migrate-later", "delete-later"];
const services = ["portal", "opl-web-gateway", "opl-runtime-bridge"];
const requiredRiskTags = [
  "portal_long_task",
  "cloud_mutation",
  "memory_launch_truth",
  "billing_audit_aggregation",
  "runtime_bridge_token_secret_boundary",
];
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
const requiredNodePortalMustNotExpand = [
  "long_task_orchestration",
  "cloud_mutation",
  "billing_mutation",
  "audit_reconciliation",
  "runtime_launch_truth",
];
const requiredGoActiveSurfaceGates = [
  "manifest_allowlist",
  "test_lane_registry",
  "workflow_review_recommendation",
  "package_verification",
];

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function listMjsFiles(dir, prefix = dir) {
  const entries = await readdir(path.join(repoRoot, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${prefix}/${entry.name}`;
    const absolutePath = path.join(repoRoot, repoPath);
    if (entry.isDirectory()) files.push(...await listMjsFiles(repoPath, repoPath));
    if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(repoPath);
    void absolutePath;
  }
  return files.sort();
}

async function listScriptsSmokeFamily() {
  const entries = await readdir(path.join(repoRoot, "scripts"), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.startsWith("smoke-test-")).map((entry) => entry.name).sort();
}

function assertIncludes(source, expected, label) {
  assert(String(source).includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert.equal(String(source).includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function assertArrayIncludesAll(actual, expected, label) {
  assert(Array.isArray(actual), `${label}_must_be_array`);
  for (const item of expected) assert(actual.includes(item), `${label}_missing:${item}`);
}

function serviceForPath(repoPath) {
  if (repoPath.startsWith("services/portal/")) return "portal";
  if (repoPath.startsWith("services/opl-web-gateway/")) return "opl-web-gateway";
  if (repoPath.startsWith("services/opl-runtime-bridge/")) return "opl-runtime-bridge";
  return "";
}

function flattenInventoryGroups(groups) {
  const entries = [];
  for (const group of groups) {
    assert(classifications.includes(group.targetClassification), `invalid_classification:${group.id}`);
    assert(group.targetGoModule || group.nodeBoundary === true, `group_requires_target_or_node_boundary:${group.id}`);
    assert(Array.isArray(group.paths) && group.paths.length > 0, `group_paths_missing:${group.id}`);
    for (const repoPath of group.paths) {
      entries.push({
        path: repoPath,
        service: group.service,
        currentResponsibility: group.currentResponsibility,
        targetClassification: group.targetClassification,
        targetGoModule: group.targetGoModule || "",
        nodeBoundary: group.nodeBoundary === true,
        riskTags: group.riskTags || [],
      });
    }
  }
  return entries;
}

function inventoryFilesByClassification(inventory, targetClassifications) {
  const files = [];
  for (const group of inventory.groups) {
    if (targetClassifications.includes(group.targetClassification)) files.push(...group.paths);
  }
  return files.sort();
}

function assertCommandListContains(commands, expectedCommands, label) {
  assert(Array.isArray(commands), `${label}_commands_must_be_array`);
  for (const command of expectedCommands) assert(commands.includes(command), `${label}_missing:${command}`);
}

function assertProgramBoard({ active, specs, delivery, runtime, source, product, current, manifest, classifierSource }) {
  const program = current.backend_go_convergence_program;
  assert(program, "backend_go_convergence_program_missing");
  assert.equal(program.schema_version, 1, "program_schema_version_mismatch");
  assert.equal(program.id, programId, "program_id_mismatch");
  assert.equal(program.owner, "MedOPL", "program_owner_mismatch");
  assert(["active", "closed"].includes(program.status), `program_status_mismatch:${program.status}`);
  assert.equal(program.truth_file, "docs/active/README.md", "program_truth_file_mismatch");
  assert.equal(program.spec_anchor, "docs/specs/README.md#spec-v22-go-control-plane-mvp-takeover-boundary", "program_spec_anchor_mismatch");
  assert.equal(program.machine_cursor_file, "tests/fixtures/v22/goal-current.json", "program_cursor_file_mismatch");
  assert.equal(program.verify_manifest_file, "tests/fixtures/v22/agent-verify-manifest.json", "program_manifest_file_mismatch");
  assert.equal(program.history_file, "docs/history/README.md", "program_history_file_mismatch");
  assert.equal(program.authoring_branch, branchName, "program_authoring_branch_mismatch");
  assert.equal(program.does_replace_current_cursor, true, "program_must_replace_current_cursor");
  if (program.status === "active") {
    assert.equal(program.current_product_cursor, current.current_cursor, "program_current_cursor_pointer_mismatch");
    assert.equal(current.current_cursor, programId, "go_mvp_takeover_must_be_current_product_cursor_before_real_cloud");
  } else {
    assert.equal(program.current_product_cursor, "real-cloud-authorization-boundary", "closed_program_must_handoff_to_real_cloud_authorization_boundary");
    assert.equal(current.current_cursor, "real-cloud-authorization-boundary", "closed_program_current_cursor_must_be_authorization_boundary");
    assert.equal(current.release_readiness_state?.status, "authorization_required", "closed_program_must_require_authorization");
    assert.equal(current.release_readiness_state?.blocked_before_risky_execution, true, "closed_program_must_block_risky_execution");
  }
  assert.equal(program.one_step_one_commit, true, "program_must_require_one_step_one_commit");
  assert.equal(program.review_gate, "landing gate", "program_review_gate_mismatch");
  assert.equal(program.post_merge_closeout_required, true, "program_must_require_post_merge_closeout");
  assert.equal(program.no_legacy_docs_tree, true, "program_must_forbid_legacy_docs_tree");
  assert.equal(program.no_recovery_tree, true, "program_must_forbid_recovery_tree");
  assert.equal(program.no_scripts_smoke_test_family, true, "program_must_forbid_scripts_smoke_family");
  assert.equal(program.target_go_service, "services/medopl-go-backend", "program_target_service_mismatch");
  assert.deepEqual(program.phases.map((phase) => phase.id), expectedPhaseIds, "program_phase_order_mismatch");
  if (program.status === "active") {
    assert.equal(program.phases[0].status, "active", "program_first_phase_must_be_active");
  } else {
    assert(program.phases.every((phase) => phase.status === "closed"), "closed_program_all_phases_must_be_closed");
  }
  for (const [index, phase] of program.phases.entries()) {
    assert.equal(phase.order, index + 1, `program_phase_order_field_mismatch:${phase.id}`);
    assert(phase.goal, `program_phase_goal_missing:${phase.id}`);
  }
  assertArrayIncludesAll(program.target_stack, ["Go", "Gin", "Ent", "PostgreSQL", "Redis"], "program_target_stack");
  assertArrayIncludesAll(program.target_layers, ["Portal Control Plane", "Workflow Boundary", "Runtime Broker / OPL Bridge", "Agent Runtime", "Cloud / Billing / Audit Workers"], "program_target_layers");
  assertArrayIncludesAll(program.forbidden_ops, ["secret", "live-cloud", "true-cloud-mutation", "build-push-kubectl", "deploy", "live-test", "upstream-write", "git-push"], "program_forbidden_ops");
  assert.deepEqual(program.canonical_backend_target, {
    service: "services/medopl-go-backend",
    status: "local_mvp_takeover_target",
    current_active_implementation: "services/medopl-go-backend",
    node_portal_role: "retirement_candidate_not_business_truth",
    node_portal_must_not_expand: requiredNodePortalMustNotExpand,
    go_must_enter_active_surface_through: requiredGoActiveSurfaceGates,
    sub2api_reference_scope: "engineering_shape_only_not_business_semantics",
    durable_engine_replacement_point: "behind_workflow_facade",
  }, "program_canonical_backend_target_must_be_go_local_mvp_takeover_boundary");

  assertIncludes(active, current.current_cursor, "active_must_preserve_product_cursor");
  assertIncludes(delivery, "Go Control Plane MVP Takeover Lane", "delivery_must_name_program");
  assertIncludes(delivery, "先 Go control-plane MVP，再 real-cloud-readiness", "delivery_must_gate_real_cloud_after_go_mvp");
  assertIncludes(active, "不能把 `real-cloud-authorization-boundary` 写成 secret", "active_must_defer_real_cloud");
  assertIncludes(specs, "spec:v22-go-control-plane-mvp-takeover-boundary", "specs_must_define_program_anchor");
  assertIncludes(specs, "Portal Control Plane", "specs_must_define_portal_control_plane");
  assertIncludes(specs, "Workflow Boundary", "specs_must_define_workflow_boundary");
  assertIncludes(specs, "Runtime Broker / OPL Bridge", "specs_must_define_runtime_broker_boundary");
  assertIncludes(specs, "Cloud / Billing / Audit Workers", "specs_must_define_worker_boundary");
  assertIncludes(specs, "`services/medopl-go-backend` 是本地 MVP takeover target", "specs_must_define_go_canonical_target");
  assertIncludes(specs, "`services/portal/src` 是清退对象，不是长期 active backend", "specs_must_define_node_portal_retirement_role");
  assertIncludes(delivery, "Go Control Plane MVP Takeover Lane", "delivery_must_record_program_lane");
  assertIncludes(runtime, "Backend Convergence Target View", "runtime_must_record_backend_target_view");
  assertIncludes(source, "Go control-plane MVP takeover surface", "source_must_record_backend_target_surface");
  if (program.status === "active") {
    assertIncludes(active, "Go control-plane MVP takeover is the current local program", "active_must_record_go_backend_active_program");
  } else {
    assertIncludes(active, "Go control-plane MVP takeover are closed locally", "active_must_record_go_backend_closed_program");
  }
  assertIncludes(source, "`services/medopl-go-backend` is the local MVP takeover target before real-cloud readiness", "source_must_promote_go_to_local_takeover_target");
  assertIncludes(source, "`services/portal/src` is a retirement surface for business truth", "source_must_mark_node_portal_for_retirement");
  assertIncludes(runtime, "不是 real-cloud readiness 或 production completion claim", "runtime_must_not_upgrade_target_view_to_completion");
  assertIncludes(product, "`services/medopl-go-backend` 只有在 Go local RC eval 通过后才能进入 real-cloud-readiness", "product_must_not_claim_go_backend_takeover_by_directory");

  const backendSuite = manifest.suites.find((suite) => suite.id === "backend-go-convergence");
  const backendPackage = manifest.package_suites.find((suite) => suite.id === "backend-go-convergence");
  const currentLeaf = manifest.leaves.find((leaf) => leaf.leaf_id === programId);
  const override = manifest.branch_override_suites.find((suite) => suite.id === programId);
  assert(backendSuite, "manifest_backend_suite_missing");
  assert(backendPackage, "manifest_backend_package_missing");
  assert(currentLeaf, "manifest_backend_current_leaf_missing");
  assert.equal(override, undefined, "manifest_backend_feature_branch_must_not_use_branch_override");
  assert.equal(program.authoring_branch, branchName, "manifest_backend_authoring_branch_mismatch");
  for (const [label, suite] of [["backend_suite", backendSuite], ["backend_package", backendPackage]]) {
    assertCommandListContains(suite.commands, groupGateCommands, `manifest_${label}`);
  }
  assertCommandListContains(currentLeaf.verification_commands, groupGateCommands, "manifest_current_leaf");
  assert(backendPackage.commands.includes("node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk"), "manifest_backend_package_must_run_workflow_review");
  assert(currentLeaf.allowed_files.includes("services/medopl-go-backend/**"), "manifest_backend_current_leaf_must_allow_go_service");
  assertArrayIncludesAll(currentLeaf.forbidden_files, ["deploy/*", "adapters/*", ".sentrux/*", "infra/*", "one-person-lab/*", "upstream/*", "secret-like paths"], "manifest_backend_current_leaf_forbidden_files");
  assertArrayIncludesAll(currentLeaf.forbidden_ops, program.forbidden_ops.filter((op) => op !== "git-push"), "manifest_backend_current_leaf_forbidden_ops");

  assertIncludes(classifierSource, "\"tests/contract/contract-test-v22-backend-go-convergence-program.mjs\"", "test_registry_must_register_program_gate");
  assertIncludes(classifierSource, "\"tests/contract/contract-test-v22-go-backend-service-surface.mjs\"", "test_registry_must_register_go_backend_gate");
}

async function assertResponsibilityInventory(inventory) {
  assert.equal(await exists(inventoryPath), true, "backend_inventory_fixture_missing");
  assert.equal(inventory.program, "backend_go_convergence_program", "inventory_program_mismatch");
  assert.equal(inventory.version, 1, "inventory_version_mismatch");
  assert.deepEqual(inventory.generatedFrom.services, activeRoots, "inventory_active_roots_mismatch");
  assert.equal(inventory.generatedFrom.specAnchor, "spec:v22-backend-go-convergence-program-boundary", "inventory_spec_anchor_mismatch");
  assert.deepEqual(inventory.requiredRiskTags, requiredRiskTags, "inventory_required_risk_tags_mismatch");

  const actualFiles = (await Promise.all(activeRoots.map((root) => listMjsFiles(root)))).flat().sort();
  const entries = flattenInventoryGroups(inventory.groups).sort((left, right) => left.path.localeCompare(right.path));
  const inventoryFiles = entries.map((entry) => entry.path).sort();
  assert.deepEqual(inventoryFiles, actualFiles, "inventory_must_cover_every_active_backend_file_once");

  const seen = new Set();
  for (const entry of entries) {
    assert.equal(seen.has(entry.path), false, `duplicate_inventory_file:${entry.path}`);
    seen.add(entry.path);
    assert.equal(await exists(entry.path), true, `inventory_file_missing_on_disk:${entry.path}`);
    assert(services.includes(entry.service), `invalid_service:${entry.path}`);
    assert.equal(entry.service, serviceForPath(entry.path), `service_path_mismatch:${entry.path}`);
    assert(entry.currentResponsibility, `current_responsibility_missing:${entry.path}`);
    assert(classifications.includes(entry.targetClassification), `invalid_file_classification:${entry.path}`);
    assert(entry.targetGoModule || entry.nodeBoundary === true, `file_requires_target_or_node_boundary:${entry.path}`);
    if (["misplaced", "delete-later"].includes(entry.targetClassification)) {
      assert(entry.riskTags.length > 0, `risky_classification_requires_risk_tags:${entry.path}`);
    }
  }
  for (const riskTag of requiredRiskTags) {
    assert(entries.some((entry) => entry.riskTags.includes(riskTag)), `inventory_missing_required_risk_tag:${riskTag}`);
  }
  for (const highRiskPath of inventory.highRiskPaths) {
    assert(inventoryFiles.includes(highRiskPath), `high_risk_path_must_be_inventory_file:${highRiskPath}`);
  }
  assert.equal(/user_owned_primary|resource_order_primary|opencost_primary|langfuse_primary_product/u.test(JSON.stringify(inventory)), false, "inventory_must_not_restore_legacy_primary_targets");
}

async function assertMigrationMap(inventory, migrationMap) {
  assert.equal(await exists(migrationMapPath), true, "migration_map_fixture_missing");
  assert.equal(migrationMap.program, "backend_go_convergence_program", "migration_map_program_mismatch");
  assert.equal(migrationMap.version, 1, "migration_map_version_mismatch");
  assert.equal(migrationMap.inventory, inventoryPath, "migration_map_inventory_pointer_mismatch");
  assert(Array.isArray(migrationMap.nodes), "migration_map_nodes_must_be_array");
  assert(Array.isArray(migrationMap.edges), "migration_map_edges_must_be_array");

  const nodeIds = new Set(migrationMap.nodes.map((node) => node.id));
  for (const id of requiredNodes) assert(nodeIds.has(id), `migration_map_missing_required_node:${id}`);

  const migratedFiles = new Set(migrationMap.nodes.flatMap((node) => node.sourcePaths || []));
  for (const repoPath of inventoryFilesByClassification(inventory, ["misplaced", "delete-later"])) {
    assert(migratedFiles.has(repoPath), `migration_map_must_cover_risky_inventory_file:${repoPath}`);
  }

  for (const node of migrationMap.nodes) {
    assert(node.id, "migration_node_missing_id");
    assert(Array.isArray(node.sourcePaths) && node.sourcePaths.length > 0, `migration_node_missing_source_paths:${node.id}`);
    assert(Array.isArray(node.responsibilities) && node.responsibilities.length > 0, `migration_node_missing_responsibilities:${node.id}`);
    assert(node.target?.module || node.retire === true, `migration_node_requires_target_or_retire:${node.id}`);
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
  assert.equal(/user_owned|resource_order|med_autoscience_runner_primary|resource_provisioner_primary/u.test(JSON.stringify(migrationMap)), false, "migration_map_must_not_restore_legacy_targets");
  for (const layer of requiredGoLayers) {
    assert(migrationMap.goLayerCoverage.includes(layer), `migration_map_missing_go_layer:${layer}`);
  }
}

const [active, specs, delivery, runtime, source, product, current, manifest, classifierSource, inventory, migrationMap] = await Promise.all([
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/specs/README.md"),
  readRepoFile("docs/delivery/README.md"),
  readRepoFile("docs/runtime/README.md"),
  readRepoFile("docs/source/README.md"),
  readRepoFile("docs/product/README.md"),
  readJson("tests/fixtures/v22/goal-current.json"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readRepoFile("scripts/v22-test-classification.mjs"),
  readJson(inventoryPath),
  readJson(migrationMapPath),
]);

assertProgramBoard({ active, specs, delivery, runtime, source, product, current, manifest, classifierSource });
await assertResponsibilityInventory(inventory);
await assertMigrationMap(inventory, migrationMap);

assert.equal(await exists("docs/contracts"), false, "legacy_contract_tree_must_not_exist");
assert.equal(await exists("docs/recovery"), false, "legacy_recovery_tree_must_not_exist");
assert.deepEqual(await listScriptsSmokeFamily(), [], "scripts_smoke_test_family_must_not_return");
assertNotIncludes(JSON.stringify({ inventory, migrationMap }), "普通用户云资源控制台", "backend_convergence_contract");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_backend_go_convergence_program",
  programId,
  phases: expectedPhaseIds,
  inventoryFiles: flattenInventoryGroups(inventory.groups).length,
  migrationNodes: migrationMap.nodes.length,
}, null, 2));
