import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const programId = "backend-go-convergence-program";
const branchName = "feat/v22-backend-go-convergence-program";
const gateCommand = "node tests/contract/contract-test-v22-backend-go-convergence-program.mjs";
const expectedPhaseIds = [
  "structure-truth-convergence",
  "responsibility-inventory",
  "docs-code-alignment-pass-1",
  "production-data-layer",
  "runtime-run-file-artifact-closure",
  "workflow-facade",
  "commercial-mainline",
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

async function listScriptsSmokeFamily() {
  const entries = await readdir(path.join(repoRoot, "scripts"), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.startsWith("smoke-test-")).map((entry) => entry.name).sort();
}

function assertIncludes(source, expected, label) {
  assert(String(source).includes(expected), `${label}_missing:${expected}`);
}

function assertArrayIncludesAll(actual, expected, label) {
  assert(Array.isArray(actual), `${label}_must_be_array`);
  for (const item of expected) assert(actual.includes(item), `${label}_missing:${item}`);
}

const [active, specs, delivery, current, manifest, classifierSource] = await Promise.all([
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/specs/README.md"),
  readRepoFile("docs/delivery/README.md"),
  readJson("tests/fixtures/v22/goal-current.json"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readRepoFile("scripts/v22-test-classification.mjs"),
]);
const [runtime, source] = await Promise.all([
  readRepoFile("docs/runtime/README.md"),
  readRepoFile("docs/source/README.md"),
]);

const program = current.backend_go_convergence_program;
assert(program, "backend_go_convergence_program_missing");
assert.equal(program.schema_version, 1, "program_schema_version_mismatch");
assert.equal(program.id, programId, "program_id_mismatch");
assert.equal(program.owner, "MedOPL", "program_owner_mismatch");
assert.equal(program.status, "registered", "program_status_mismatch");
assert.equal(program.truth_file, "docs/active/README.md", "program_truth_file_mismatch");
assert.equal(program.spec_anchor, "docs/specs/README.md#spec-v22-backend-go-convergence-program-boundary", "program_spec_anchor_mismatch");
assert.equal(program.machine_cursor_file, "tests/fixtures/v22/goal-current.json", "program_cursor_file_mismatch");
assert.equal(program.verify_manifest_file, "tests/fixtures/v22/agent-verify-manifest.json", "program_manifest_file_mismatch");
assert.equal(program.history_file, "docs/history/README.md", "program_history_file_mismatch");
assert.equal(program.authoring_branch, branchName, "program_authoring_branch_mismatch");
assert.equal(program.does_not_replace_current_cursor, true, "program_must_not_replace_current_cursor");
assert.equal(program.current_product_cursor, current.current_cursor, "program_current_cursor_pointer_mismatch");
assert.equal(current.current_cursor, "real-cloud-authorization-boundary", "backend_program_must_not_advance_product_cursor");
assert.equal(program.one_step_one_commit, true, "program_must_require_one_step_one_commit");
assert.equal(program.review_gate, "landing gate", "program_review_gate_mismatch");
assert.equal(program.post_merge_closeout_required, true, "program_must_require_post_merge_closeout");
assert.equal(program.no_legacy_docs_tree, true, "program_must_forbid_legacy_docs_tree");
assert.equal(program.no_recovery_tree, true, "program_must_forbid_recovery_tree");
assert.equal(program.no_scripts_smoke_test_family, true, "program_must_forbid_scripts_smoke_family");
assert.equal(program.target_go_service, "services/medopl-go-backend", "program_target_service_mismatch");
assert.deepEqual(program.canonical_backend_target, {
  service: "services/medopl-go-backend",
  status: "future_canonical_target",
  current_active_implementation: "services/portal",
  node_portal_role: "migration_period_active_implementation",
  node_portal_must_not_expand: [
    "long_task_orchestration",
    "cloud_mutation",
    "billing_mutation",
    "audit_reconciliation",
    "runtime_launch_truth",
  ],
  go_must_enter_active_surface_through: [
    "manifest_allowlist",
    "test_lane_registry",
    "workflow_review_recommendation",
    "package_verification",
  ],
  sub2api_reference_scope: "engineering_shape_only_not_business_semantics",
  durable_engine_replacement_point: "behind_workflow_facade",
}, "program_canonical_backend_boundary_mismatch");
assertArrayIncludesAll(program.target_stack, ["Go", "Gin", "Ent", "PostgreSQL", "Redis"], "program_target_stack");
assertArrayIncludesAll(program.target_layers, ["Portal Control Plane", "Workflow Boundary", "Runtime Broker / OPL Bridge", "Agent Runtime", "Cloud / Billing / Audit Workers"], "program_target_layers");
assert.deepEqual(program.phases.map((phase) => phase.id), expectedPhaseIds, "program_phase_order_mismatch");
assert.equal(program.phases[0].status, "active", "program_first_phase_must_be_active");
for (const [index, phase] of program.phases.entries()) {
  assert.equal(phase.order, index + 1, `program_phase_order_field_mismatch:${phase.id}`);
  assert(phase.goal, `program_phase_goal_missing:${phase.id}`);
}
assertArrayIncludesAll(program.forbidden_ops, ["secret", "live-cloud", "true-cloud-mutation", "build-push-kubectl", "deploy", "live-test", "upstream-write", "git-push"], "program_forbidden_ops");
assert(program.verification_commands.includes(gateCommand), "program_verification_must_include_gate");

assertIncludes(active, "backend-go-convergence-program", "active_must_name_program");
assertIncludes(active, "backend Go convergence", "active_must_describe_backend_program");
assertIncludes(active, "does not replace the current `real-cloud-authorization-boundary` product cursor", "active_must_preserve_product_cursor");
assertIncludes(active, "不能把 backend Go convergence program 写成第二份阶段板", "active_must_forbid_second_program_board");
assertIncludes(active, gateCommand, "active_must_reference_program_gate");

assertIncludes(specs, "spec:v22-backend-go-convergence-program-boundary", "specs_must_define_program_anchor");
assertIncludes(specs, "Portal Control Plane", "specs_must_define_portal_control_plane");
assertIncludes(specs, "Workflow Boundary", "specs_must_define_workflow_boundary");
assertIncludes(specs, "Runtime Broker / OPL Bridge", "specs_must_define_runtime_broker_boundary");
assertIncludes(specs, "Cloud / Billing / Audit Workers", "specs_must_define_worker_boundary");
assertIncludes(specs, "不得恢复 `docs/contracts/**`、`docs/recovery/**`", "specs_must_forbid_retired_docs_trees");
assertIncludes(specs, "每个 step 只能有一个 commit", "specs_must_require_step_commit");
assertIncludes(specs, "`services/medopl-go-backend` 是未来 canonical backend target", "specs_must_define_go_canonical_target");
assertIncludes(specs, "当前 `services/portal` 是迁移前 active implementation", "specs_must_define_node_portal_migration_role");
assertIncludes(specs, "不得继续扩张长任务编排、cloud mutation、billing mutation、audit reconciliation 或 runtime launch truth", "specs_must_forbid_node_portal_expansion");
assertIncludes(specs, "只限工程形状", "specs_must_limit_sub2api_reference_scope");
assertIncludes(specs, "只能替换 workflow facade 后面的实现", "specs_must_keep_durable_engine_behind_facade");

assertIncludes(delivery, "Backend Go Convergence Authoring Lane", "delivery_must_record_program_lane");
assertIncludes(delivery, branchName, "delivery_must_record_authoring_branch");
assertIncludes(delivery, "不接管当前 `real-cloud-authorization-boundary` product cursor", "delivery_must_preserve_cursor");

assertIncludes(runtime, "Backend Convergence Target View", "runtime_must_record_backend_target_view");
assertIncludes(runtime, "Portal Control Plane", "runtime_must_name_portal_control_plane");
assertIncludes(runtime, "Workflow Boundary", "runtime_must_name_workflow_boundary");
assertIncludes(runtime, "Runtime Broker / OPL Bridge", "runtime_must_name_runtime_broker");
assertIncludes(runtime, "Cloud / Billing / Audit Workers", "runtime_must_name_workers");
assertIncludes(runtime, "不是 production completion claim", "runtime_must_not_claim_completion");

assertIncludes(source, "Backend convergence target surface", "source_must_record_backend_target_surface");
assertIncludes(source, "`services/medopl-go-backend` is the future canonical backend target", "source_must_record_go_future_target");
assertIncludes(source, "不能只靠目录存在或 prose claim 成为 canonical truth", "source_must_forbid_directory_only_claim");
assertIncludes(source, "`services/portal` 是 Node Portal active implementation", "source_must_record_node_portal_role");
assertIncludes(source, "不再扩张长任务编排、cloud mutation、billing mutation、audit reconciliation 或 runtime launch truth", "source_must_forbid_portal_expansion");

const backendSuite = manifest.suites.find((suite) => suite.id === "backend-go-convergence");
assert(backendSuite, "manifest_backend_suite_missing");
assert(backendSuite.commands.includes(gateCommand), "manifest_backend_suite_must_run_gate");

const backendPackage = manifest.package_suites.find((suite) => suite.id === "backend-go-convergence");
assert(backendPackage, "manifest_backend_package_missing");
assert(backendPackage.commands.includes(gateCommand), "manifest_backend_package_must_run_gate");
assert(backendPackage.commands.includes("node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk"), "manifest_backend_package_must_run_workflow_review");

const override = manifest.branch_override_suites.find((suite) => suite.id === programId);
assert(override, "manifest_backend_branch_override_missing");
assert(override.branches.includes(branchName), "manifest_backend_branch_override_branch_missing");
assert(override.commands.includes(gateCommand), "manifest_backend_branch_override_must_run_gate");
assert(override.allowed_files.includes("services/medopl-go-backend/**"), "manifest_backend_branch_override_must_allow_go_service");
assertArrayIncludesAll(override.forbidden_files, ["deploy/*", "adapters/*", ".sentrux/*", "infra/*", "one-person-lab/*", "upstream/*", ".runtime/*", "secret-like paths"], "manifest_backend_branch_override_forbidden_files");
assertArrayIncludesAll(override.forbidden_ops, program.forbidden_ops, "manifest_backend_branch_override_forbidden_ops");

assertIncludes(classifierSource, "\"tests/contract/contract-test-v22-backend-go-convergence-program.mjs\"", "test_registry_must_register_program_gate");
assertIncludes(classifierSource, "\"verifySuites\":[\"local-contract\",\"current\",\"review\"]", "test_registry_must_attach_program_gate_to_suites");

assert.equal(await exists("docs/contracts"), false, "legacy_contract_tree_must_not_exist");
assert.equal(await exists("docs/recovery"), false, "legacy_recovery_tree_must_not_exist");
assert.deepEqual(await listScriptsSmokeFamily(), [], "scripts_smoke_test_family_must_not_return");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_backend_go_convergence_program",
  programId,
  phases: expectedPhaseIds,
  branchOverride: override.id,
}, null, 2));
