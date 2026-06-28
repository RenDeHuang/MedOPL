import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertManifestSuiteAlignment,
  assertPolicySurfaceCoverage,
  TEST_LANE_CONTRACT_REFS,
  TEST_LANE_REGISTRY,
  TEST_LANE_SUITES,
  assertTestLaneCoverage,
  listRegisteredTestFiles,
} from "../../scripts/v22-test-classification.mjs";
import {
  CLOUD_GOAL_AUTHORIZED_COMMANDS,
  TEST_ENVIRONMENTS,
  TEST_SURFACES,
  TEST_PLAN_BASE_COMMANDS,
  TEST_SURFACE_RULES,
} from "../../scripts/v22-test-policy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function listTestFiles(dir = path.join(repoRoot, "tests"), prefix = "tests") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${prefix}/${entry.name}`;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listTestFiles(absolutePath, repoPath));
    if (entry.isFile() && /\.mjs$/u.test(entry.name)) files.push(repoPath);
  }
  return files.sort();
}

async function readJson(repoPath) {
  return JSON.parse(await readFile(path.join(repoRoot, repoPath), "utf8"));
}

function normalizeCommandTestFile(command) {
  const match = String(command || "").match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u);
  return match?.[1] || "";
}

const actualTestFiles = (await listTestFiles()).filter((file) => !file.startsWith("tests/fixtures/"));
const manifest = await readJson("tests/fixtures/v22/agent-verify-manifest.json");
assert.deepEqual(listRegisteredTestFiles(), actualTestFiles, "test_lane_registry_must_cover_every_test_file_once");
assert.equal(TEST_LANE_REGISTRY.length, actualTestFiles.length, "registry_count_must_match_test_files");

const coverage = await assertTestLaneCoverage();
assert.equal(coverage.ok, true, `test_lane_coverage_failed:${JSON.stringify(coverage, null, 2)}`);
const policyCoverage = assertPolicySurfaceCoverage();
assert.equal(policyCoverage.ok, true, `policy_surface_coverage_failed:${JSON.stringify(policyCoverage, null, 2)}`);
const manifestAlignment = assertManifestSuiteAlignment(manifest);
assert.equal(manifestAlignment.ok, true, `manifest_suite_alignment_failed:${JSON.stringify(manifestAlignment, null, 2)}`);
assert(
  manifestAlignment.activeSuiteIds.includes("cloud"),
  "manifest_suite_alignment_must_include_cloud_suite",
);

for (const entry of TEST_LANE_REGISTRY) {
  assert(entry.id, `registry_entry_missing_id:${entry.file}`);
  assert(entry.file, `registry_entry_missing_file:${entry.id}`);
  assert(entry.lane, `registry_entry_missing_lane:${entry.id}`);
  assert(entry.tier, `registry_entry_missing_tier:${entry.id}`);
  assert(entry.surface, `registry_entry_missing_surface:${entry.id}`);
  assert(entry.entryKind, `registry_entry_missing_entry_kind:${entry.id}`);
  assert(entry.authorization, `registry_entry_missing_authorization:${entry.id}`);
  assert(Array.isArray(entry.contracts) && entry.contracts.length > 0, `registry_entry_missing_specs_contract:${entry.id}`);
  for (const ref of entry.contracts) {
    assert(TEST_LANE_CONTRACT_REFS.includes(ref), `registry_entry_contract_must_use_root_specs:${entry.id}:${ref}`);
  }
  assert(Array.isArray(entry.verifySuites) && entry.verifySuites.length > 0, `registry_entry_missing_verify_suite:${entry.id}`);
}

assert.deepEqual(
  TEST_PLAN_BASE_COMMANDS,
  ["npm run test:health", "npm run test:smoke", "npm run test:contract"],
  "policy_base_commands_must_match_verify_plan_baseline",
);
for (const rule of TEST_SURFACE_RULES) {
  assert(TEST_SURFACES.includes(rule.surface), `policy_rule_surface_must_be_known:${rule.id}:${rule.surface}`);
  assert(TEST_ENVIRONMENTS.includes(rule.environment), `policy_rule_environment_must_be_known:${rule.id}:${rule.environment}`);
  if (rule.authorizedEnvironment) {
    assert(TEST_ENVIRONMENTS.includes(rule.authorizedEnvironment), `policy_rule_authorized_environment_must_be_known:${rule.id}:${rule.authorizedEnvironment}`);
  }
}
const cloudRule = TEST_SURFACE_RULES.find((rule) => rule.id === "cloud-boundary");
assert(cloudRule, "policy_must_define_cloud_boundary_rule");
assert.equal(cloudRule.environment, "local", "cloud_boundary_default_environment_must_remain_local");
assert.equal(cloudRule.authorizedEnvironment, "staging", "cloud_boundary_authorized_environment_must_be_staging");
for (const command of CLOUD_GOAL_AUTHORIZED_COMMANDS) {
  assert.equal(cloudRule.commands.includes(command), false, `cloud_goal_must_not_be_recommended_by_default:${command}`);
}
assert.deepEqual([...cloudRule.authorizedCommands], CLOUD_GOAL_AUTHORIZED_COMMANDS, "cloud_goal_commands_must_remain_authorized_commands");

for (const suite of ["health", "smoke", "local-contract", "current", "review"]) {
  assert(TEST_LANE_SUITES[suite], `registry_suite_missing:${suite}`);
}

for (const file of [
  "tests/contracts/contract-test-v22-go-backend-service-surface.mjs",
  "tests/contracts/contract-test-v22-precloud-deployable-rc.mjs",
]) {
  assert(TEST_LANE_SUITES.health.includes(file), `health_suite_must_run_go_local_rc_parity_guard:${file}`);
}

const manifestSuitesById = new Map(manifest.suites.map((suite) => [suite.id, suite]));
for (const suite of ["health", "local-contract", "review"]) {
  const manifestFiles = manifestSuitesById.get(suite).commands.map(normalizeCommandTestFile).filter(Boolean).sort();
  for (const file of manifestFiles) {
    assert(listRegisteredTestFiles().includes(file), `manifest_suite_file_must_remain_registered:${suite}:${file}`);
  }
  assert.equal(
    manifestFiles.some((file) => file.includes("change-package-lifecycle")),
    false,
    `manifest_suite_must_not_run_retired_change_package_lifecycle:${suite}`,
  );
}
const frontendManifestFiles = manifestSuitesById.get("frontend").commands.map(normalizeCommandTestFile).filter(Boolean).sort();
for (const file of TEST_LANE_SUITES.frontend) {
  assert(
    frontendManifestFiles.includes(file),
    `manifest_frontend_suite_missing_registry_file:${file}`,
  );
}
const currentManifestFiles = manifestSuitesById.get("current").commands.map(normalizeCommandTestFile).filter(Boolean).sort();
for (const file of TEST_LANE_SUITES.current) {
  assert(
    currentManifestFiles.includes(file) || manifestSuitesById.get("current").commands.includes("node scripts/v22-verify.mjs active-platform --json"),
    `manifest_current_suite_missing_registry_file:${file}`,
  );
}
for (const command of manifest.suites.flatMap((suite) => suite.commands || [])) {
  assert.equal(String(command).includes("gate:change"), false, `manifest_suite_must_not_run_gate_change:${command}`);
  assert.equal(String(command).includes("closeout:check"), false, `manifest_suite_must_not_run_closeout_check:${command}`);
  assert.equal(String(command).includes("change-package-gate"), false, `manifest_suite_must_not_run_change_package_gate:${command}`);
}
assert(manifestSuitesById.get("smoke").commands.includes("node tests/suites/suite-test-v22-golden-smoke.mjs"), "smoke_suite_must_use_golden_smoke_wrapper");

assert.equal(
  TEST_LANE_REGISTRY.some((entry) => /categoryOf|surfaceOf|entryKindOf/u.test(JSON.stringify(entry))),
  false,
  "registry_must_not_embed_inference_helpers",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_test_lane_registry",
  registered: TEST_LANE_REGISTRY.length,
  suites: Object.keys(TEST_LANE_SUITES).sort(),
}, null, 2));
