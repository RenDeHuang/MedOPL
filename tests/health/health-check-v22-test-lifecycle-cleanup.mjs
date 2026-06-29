import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEST_LIFECYCLE_CLEANUP_POLICY,
  TEST_LANE_REGISTRY,
  TEST_LANE_SUITES,
  assertTestLaneCoverage,
  listRegisteredTestFiles,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const forbiddenLifecycleRoles = [
  "historical-proof",
  "compat-only",
  "alias-only",
  "wrapper-only",
  "closeout-evidence-only",
];

const allowedLifecycleRoles = [
  "current-owner",
  "negative-retirement-guard",
  "suite-wrapper",
  "real-cloud-readiness-boundary",
  "cloud-release-candidate-boundary",
  "future-authorized-boundary",
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

function assertIncludes(source, expected, label) {
  assert(String(source).includes(expected), `${label}_missing:${expected}`);
}

function normalizeCommandTestFile(command) {
  const match = String(command || "").match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u);
  return match?.[1] || "";
}

function assertNoForbiddenLifecycleRole(source, label) {
  for (const role of forbiddenLifecycleRoles) {
    assert.equal(String(source).includes(role), false, `${label}_must_not_include_forbidden_lifecycle_role:${role}`);
  }
}

const [manifest, testsReadme] = await Promise.all([
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readRepoFile("tests/README.md"),
]);

const coverage = await assertTestLaneCoverage();
assert.equal(coverage.ok, true, `test_lifecycle_coverage_failed:${JSON.stringify(coverage, null, 2)}`);
assert.deepEqual(listRegisteredTestFiles(), [...new Set(listRegisteredTestFiles())].sort(), "registered_tests_must_be_unique");
assert.equal(TEST_LIFECYCLE_CLEANUP_POLICY.directCleanup, true, "registry_must_declare_direct_cleanup");
assert.equal(TEST_LIFECYCLE_CLEANUP_POLICY.activeTestRequiresLaneOwner, true, "registry_must_require_lane_owner");
assert.equal(TEST_LIFECYCLE_CLEANUP_POLICY.activeTestRequiresCurrentOwnerSurface, true, "registry_must_require_current_owner_surface");
assert.equal(TEST_LIFECYCLE_CLEANUP_POLICY.duplicateAggregateAction, "merge-or-delete", "registry_duplicate_aggregate_action_mismatch");

for (const entry of TEST_LANE_REGISTRY) {
  assert(entry.ownerSurface, `registry_entry_missing_owner_surface:${entry.file}`);
  assert(entry.lifecycleRole, `registry_entry_missing_lifecycle_role:${entry.file}`);
  assert(allowedLifecycleRoles.includes(entry.lifecycleRole), `registry_entry_invalid_lifecycle_role:${entry.file}:${entry.lifecycleRole}`);
  assertNoForbiddenLifecycleRole(entry.lifecycleRole, `registry_entry_lifecycle_role:${entry.file}`);
}

assert.equal(await exists("tests/governance"), false, "tests_governance_directory_must_be_physically_retired");
assert.equal(
  TEST_LANE_REGISTRY.some((entry) => entry.lane === "retired-governance" || entry.lifecycleRole === "retired-governance"),
  false,
  "retired_governance_lane_and_lifecycle_role_must_not_exist",
);

const registered = new Set(listRegisteredTestFiles());
for (const entry of TEST_LANE_REGISTRY.filter((item) => item.lifecycleRole === "suite-wrapper")) {
  assert.equal(entry.entryKind, "suite-wrapper", `suite_wrapper_lifecycle_role_must_match_entry_kind:${entry.file}`);
  assert(registered.has(entry.file), `suite_wrapper_must_be_registered:${entry.file}`);
}

for (const entry of TEST_LANE_REGISTRY.filter((item) => item.entryKind === "suite-wrapper")) {
  assert.equal(entry.lifecycleRole, "suite-wrapper", `suite_wrapper_entry_kind_must_match_lifecycle_role:${entry.file}`);
  const source = await readRepoFile(entry.file);
  const wrappedFiles = [...source.matchAll(/["'](tests\/[^"']+\.mjs)["']/gu)]
    .map((match) => match[1])
    .filter((file) => file !== entry.file);
  for (const wrappedFile of wrappedFiles) {
    assert(registered.has(wrappedFile), `suite_wrapper_must_only_wrap_active_registered_tests:${entry.file}:${wrappedFile}`);
  }
}

const manifestSuitesById = new Map(manifest.suites.map((suite) => [suite.id, suite]));
const packageSuitesById = new Map((manifest.package_suites || []).map((suite) => [suite.id, suite]));
const testLanePackageFiles = packageSuitesById.get("test-lanes")?.commands.map(normalizeCommandTestFile).filter(Boolean) || [];
assert(
  testLanePackageFiles.includes("tests/health/health-check-v22-test-lifecycle-cleanup.mjs"),
  "test_lanes_package_must_run_test_lifecycle_cleanup_gate",
);
for (const suite of ["current", "review"]) {
  const files = manifestSuitesById.get(suite)?.commands.map(normalizeCommandTestFile).filter(Boolean) || [];
  assert(
    !files.includes("tests/health/health-check-v22-test-lifecycle-cleanup.mjs"),
    `test_lifecycle_cleanup_gate_must_not_enter_active_manifest_suite:${suite}`,
  );
}
for (const suite of ["health", "hygiene", "local-contract"]) {
  const files = manifestSuitesById.get(suite)?.commands.map(normalizeCommandTestFile).filter(Boolean) || [];
  assert(
    files.includes("tests/health/health-check-v22-test-lifecycle-cleanup.mjs"),
    `test_lifecycle_cleanup_gate_must_enter_health_manifest_suite:${suite}`,
  );
}
assert.equal(manifest.test_lifecycle_cleanup_policy?.direct_cleanup, true, "manifest_must_declare_direct_cleanup");
assert.equal(manifest.test_lifecycle_cleanup_policy?.active_test_requires_lane_owner, true, "manifest_must_require_lane_owner");
assert.equal(manifest.test_lifecycle_cleanup_policy?.active_test_requires_current_owner_surface, true, "manifest_must_require_current_owner_surface");
assert.equal(manifest.test_lifecycle_cleanup_policy?.forbid_compat_only_active_tests, true, "manifest_must_forbid_compat_only_active_tests");
assert.equal(manifest.test_lifecycle_cleanup_policy?.forbid_historical_proof_as_active_test, true, "manifest_must_forbid_historical_proof_as_active_test");
assert.equal(manifest.test_lifecycle_cleanup_policy?.duplicate_aggregate_action, "merge-or-delete", "manifest_duplicate_aggregate_action_mismatch");
assert.equal(manifest.test_lifecycle_cleanup_policy?.gate, "tests/health/health-check-v22-test-lifecycle-cleanup.mjs", "manifest_test_lifecycle_gate_mismatch");

assert.equal(
  (manifest.branch_override_suites || []).some((suite) => suite.id === "test-lifecycle-cleanup-gate"),
  false,
  "test_lifecycle_cleanup_branch_override_must_remain_retired",
);

const healthFiles = manifestSuitesById.get("health")?.commands.map(normalizeCommandTestFile).filter(Boolean) || [];
const localContractFiles = manifestSuitesById.get("local-contract")?.commands.map(normalizeCommandTestFile).filter(Boolean) || [];
for (const suiteFiles of [healthFiles, localContractFiles]) {
  assert(suiteFiles.includes("tests/health/health-check-v22-zero-compat-active-surface-gate.mjs"), "zero_compat_gate_must_remain_in_health_and_local_contract");
}

assert.equal("retired-governance" in TEST_LANE_SUITES, false, "registry_must_not_expose_retired_governance_suite");
for (const suite of ["current", "review"]) {
  assert(
    !TEST_LANE_SUITES[suite].includes("tests/health/health-check-v22-test-lifecycle-cleanup.mjs"),
    `test_lifecycle_cleanup_gate_must_not_enter_active_registry_suite:${suite}`,
  );
}
for (const suite of ["health", "hygiene", "local-contract"]) {
  assert(
    TEST_LANE_SUITES[suite].includes("tests/health/health-check-v22-test-lifecycle-cleanup.mjs"),
    `test_lifecycle_cleanup_gate_must_enter_health_registry_suite:${suite}`,
  );
}

assertIncludes(testsReadme, "active test 必须有 lane owner", "tests_readme_lifecycle_rule");
assertIncludes(testsReadme, "active test 必须证明 current owner surface", "tests_readme_owner_surface_rule");
assertIncludes(testsReadme, "旧 alias / wrapper / facade / compat-only test 迁完 caller 后直接删除", "tests_readme_direct_cleanup_rule");
assertIncludes(testsReadme, "historical proof / closeout evidence 不作为 active test 保留", "tests_readme_historical_proof_rule");
assertIncludes(testsReadme, "duplicate aggregate test 必须合并或删除", "tests_readme_duplicate_cleanup_rule");
assertIncludes(testsReadme, "history 只保摘要，git history 保细节", "tests_readme_history_boundary_rule");

const registrySource = await readRepoFile("scripts/v22-test-classification.mjs");
assertIncludes(registrySource, "ownerSurface", "registry_source_must_define_owner_surface");
assertIncludes(registrySource, "lifecycleRole", "registry_source_must_define_lifecycle_role");
assertNoForbiddenLifecycleRole(registrySource, "registry_source");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_test_lifecycle_cleanup",
  registered: TEST_LANE_REGISTRY.length,
  lifecycleRoles: [...new Set(TEST_LANE_REGISTRY.map((entry) => entry.lifecycleRole))].sort(),
}, null, 2));
