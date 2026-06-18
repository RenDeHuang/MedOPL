import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_SMOKE_CATEGORIES,
  HEALTH_CHECK_MAX,
  HEALTH_CHECK_SCRIPTS,
  SMOKE_CATEGORIES,
  SMOKE_CLASSIFICATION,
  SMOKE_EVAL_AUTHORIZATIONS,
  SMOKE_EVAL_ENTRY_KINDS,
  SMOKE_EVAL_SURFACES,
  SMOKE_EVAL_TIERS,
  SMOKE_GOLDEN_MAX,
  SMOKE_GOLDEN_MIN,
  SMOKE_GOLDEN_SCRIPTS,
  TEST_LANE_CONTRACT_REFS,
  listClassifiedSmokeScripts,
  listSmokeEvalScripts,
  smokeEvalMetadataOf,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function listTestFiles(dir, prefix = "tests") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${prefix}/${entry.name}`;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listTestFiles(fullPath, repoPath));
    } else if (/\.mjs$/u.test(entry.name)) {
      files.push(repoPath);
    }
  }
  return files.sort();
}

const scriptsRoot = path.join(repoRoot, "scripts");
const legacySmokeScripts = (await readdir(scriptsRoot))
  .filter((name) => /^smoke-test-v22-.*\.mjs$/u.test(name))
  .map((name) => `scripts/${name}`)
  .sort();
assert.deepEqual(legacySmokeScripts, [], `legacy_scripts_smoke_tests_must_not_exist:${legacySmokeScripts.join(",")}`);

const allEvalScripts = (await listTestFiles(path.join(repoRoot, "tests")))
  .filter((scriptPath) => !scriptPath.startsWith("tests/fixtures/"));
const classifiedScripts = Object.keys(SMOKE_CLASSIFICATION).sort();
assert.deepEqual(classifiedScripts, allEvalScripts, "all_v22_eval_scripts_must_be_explicitly_classified");

const allowedCategories = new Set(SMOKE_CATEGORIES);
const allowedTiers = new Set(SMOKE_EVAL_TIERS);
const allowedSurfaces = new Set(SMOKE_EVAL_SURFACES);
const allowedEntryKinds = new Set(SMOKE_EVAL_ENTRY_KINDS);
const allowedAuthorizations = new Set(SMOKE_EVAL_AUTHORIZATIONS);

for (const [scriptPath, category] of Object.entries(SMOKE_CLASSIFICATION)) {
  assert(allowedCategories.has(category), `unknown_smoke_category:${scriptPath}:${category}`);
  const metadata = smokeEvalMetadataOf(scriptPath);
  assert(allowedTiers.has(metadata.tier), `unknown_eval_tier:${scriptPath}:${metadata.tier}`);
  assert(allowedSurfaces.has(metadata.surface), `unknown_eval_surface:${scriptPath}:${metadata.surface}`);
  assert(allowedEntryKinds.has(metadata.entryKind), `unknown_eval_entry_kind:${scriptPath}:${metadata.entryKind}`);
  assert(allowedAuthorizations.has(metadata.authorization), `unknown_eval_authorization:${scriptPath}:${metadata.authorization}`);
  assert(metadata.contractRefs.length > 0, `metadata_contract_refs_required:${scriptPath}`);
  for (const ref of metadata.contractRefs) {
    assert(TEST_LANE_CONTRACT_REFS.includes(ref), `metadata_must_reference_root_specs:${scriptPath}:${ref}`);
  }
}

const defaultScripts = listClassifiedSmokeScripts({ categories: DEFAULT_SMOKE_CATEGORIES });
assert(defaultScripts.includes("tests/health/health-check-v22-smoke-classification-gate.mjs"), "default_suite_must_run_smoke_classification_gate");
assert(defaultScripts.includes("tests/health/health-check-v22-smoke-eval-boundary.mjs"), "default_suite_must_run_smoke_eval_boundary_gate");
assert(defaultScripts.includes("tests/contract/contract-test-v22-golden-smoke-suite.mjs"), "default_suite_must_register_golden_smoke_suite");

const healthScripts = listSmokeEvalScripts({ tiers: ["health-check"] });
const goldenScripts = listSmokeEvalScripts({ tiers: ["smoke-golden"] });
assert.deepEqual(healthScripts, [...HEALTH_CHECK_SCRIPTS].sort(), "health_check_scripts_must_be_explicit");
assert.deepEqual(goldenScripts, [...SMOKE_GOLDEN_SCRIPTS].sort(), "golden_smoke_scripts_must_be_explicit");
assert(healthScripts.length > 0 && healthScripts.length <= HEALTH_CHECK_MAX, "health_check_must_stay_small");
assert(goldenScripts.length >= SMOKE_GOLDEN_MIN, "golden_smoke_must_cover_core_path");
assert(goldenScripts.length <= SMOKE_GOLDEN_MAX, "golden_smoke_must_stay_small");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_smoke_classification_gate",
  classifiedCount: classifiedScripts.length,
  categories: SMOKE_CATEGORIES.map((category) => ({
    category,
    count: classifiedScripts.filter((scriptPath) => SMOKE_CLASSIFICATION[scriptPath] === category).length,
  })),
  tiers: SMOKE_EVAL_TIERS.map((tier) => ({
    tier,
    count: listSmokeEvalScripts({ tiers: [tier] }).length,
  })),
}, null, 2));
