import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEST_LANE_REGISTRY,
  TEST_LANE_SUITES,
  assertTestLaneCoverage,
  listRegisteredTestFiles,
} from "../../scripts/v22-test-classification.mjs";

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

for (const entry of TEST_LANE_REGISTRY) {
  assert(entry.id, `registry_entry_missing_id:${entry.file}`);
  assert(entry.file, `registry_entry_missing_file:${entry.id}`);
  assert(entry.lane, `registry_entry_missing_lane:${entry.id}`);
  assert(entry.tier, `registry_entry_missing_tier:${entry.id}`);
  assert(entry.surface, `registry_entry_missing_surface:${entry.id}`);
  assert(entry.entryKind, `registry_entry_missing_entry_kind:${entry.id}`);
  assert(entry.authorization, `registry_entry_missing_authorization:${entry.id}`);
  assert(Array.isArray(entry.contracts) && entry.contracts.includes("docs/specs/README.md"), `registry_entry_missing_specs_contract:${entry.id}`);
  assert(Array.isArray(entry.verifySuites) && entry.verifySuites.length > 0, `registry_entry_missing_verify_suite:${entry.id}`);
}

for (const suite of ["health", "smoke", "local-contract", "current", "review"]) {
  assert(TEST_LANE_SUITES[suite], `registry_suite_missing:${suite}`);
}

for (const file of [
  "tests/contract/contract-test-v22-go-backend-service-surface.mjs",
  "tests/contract/contract-test-v22-precloud-deployable-rc.mjs",
]) {
  assert(TEST_LANE_SUITES.health.includes(file), `health_suite_must_run_go_local_rc_parity_guard:${file}`);
}

const manifestSuitesById = new Map(manifest.suites.map((suite) => [suite.id, suite]));
for (const suite of ["health", "local-contract", "review"]) {
  const manifestFiles = manifestSuitesById.get(suite).commands.map(normalizeCommandTestFile).filter(Boolean).sort();
  assert.deepEqual(manifestFiles, TEST_LANE_SUITES[suite], `manifest_suite_must_match_test_lane_registry:${suite}`);
}
const currentManifestFiles = manifestSuitesById.get("current").commands.map(normalizeCommandTestFile).filter(Boolean).sort();
for (const file of TEST_LANE_SUITES.current) {
  assert(currentManifestFiles.includes(file), `manifest_current_suite_missing_registry_file:${file}`);
}
assert(manifestSuitesById.get("smoke").commands.includes("node tests/contract/contract-test-v22-golden-smoke-suite.mjs"), "smoke_suite_must_use_golden_smoke_wrapper");

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
