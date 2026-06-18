import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_SMOKE_CATEGORIES,
  HEALTH_CHECK_MAX,
  HEALTH_CHECK_SCRIPTS,
  SMOKE_CLASSIFICATION,
  SMOKE_EVAL_SURFACES,
  SMOKE_EVAL_TIERS,
  SMOKE_GOLDEN_MAX,
  SMOKE_GOLDEN_MIN,
  SMOKE_GOLDEN_SCRIPTS,
  SMOKE_SUITE_ENTRYPOINTS,
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

const specsIndexSource = await readFile(path.join(repoRoot, "docs/specs/README.md"), "utf8");
const frameworkSpecSource = await readFile(path.join(repoRoot, "specs/framework/spec.md"), "utf8");
const manifest = JSON.parse(await readFile(path.join(repoRoot, "tests/fixtures/v22/agent-verify-manifest.json"), "utf8"));
const classifierSource = await readFile(path.join(repoRoot, "scripts/v22-test-classification.mjs"), "utf8");
const allEvalScripts = (await listTestFiles(path.join(repoRoot, "tests")))
  .filter((scriptPath) => !scriptPath.startsWith("tests/fixtures/"));

assert.deepEqual(Object.keys(SMOKE_CLASSIFICATION).sort(), allEvalScripts, "all_v22_eval_scripts_must_be_classified");

for (const requiredPhrase of [
  "health-check",
  "smoke-golden",
  "contract-local",
  "local-regression",
  "real-cloud-readiness",
  "future-authorized",
  "suite-wrapper",
  "gate-self-test",
]) {
  assert(
    `${classifierSource}\n${frameworkSpecSource}\n${specsIndexSource}`.includes(requiredPhrase),
    `smoke_eval_boundary_missing:${requiredPhrase}`,
  );
}

for (const requiredRef of [
  "framework:repo-health-contraction",
]) {
  assert(`${classifierSource}\n${frameworkSpecSource}`.includes(requiredRef), `framework_spec_missing_smoke_eval_reference:${requiredRef}`);
}
const manifestSuiteIds = new Set(manifest.suites.map((suite) => suite.id));
for (const requiredSuite of ["smoke", "local-contract", "local-regression", "real-cloud-readiness", "cloud-future-authorized"]) {
  assert(manifestSuiteIds.has(requiredSuite), `manifest_suite_missing:${requiredSuite}`);
}

const healthScripts = listSmokeEvalScripts({ tiers: ["health-check"] });
const goldenScripts = listSmokeEvalScripts({ tiers: ["smoke-golden"] });
const futureScripts = listSmokeEvalScripts({ tiers: ["future-authorized"] });
const defaultScripts = listClassifiedSmokeScripts({ categories: DEFAULT_SMOKE_CATEGORIES });

assert.deepEqual(healthScripts, [...HEALTH_CHECK_SCRIPTS].sort(), "health_check_scripts_must_be_explicit");
assert.deepEqual(goldenScripts, [...SMOKE_GOLDEN_SCRIPTS].sort(), "golden_smoke_scripts_must_be_explicit");
assert(healthScripts.length > 0 && healthScripts.length <= HEALTH_CHECK_MAX, "health_check_must_stay_small");
assert(goldenScripts.length >= SMOKE_GOLDEN_MIN, "golden_smoke_must_cover_core_path");
assert(goldenScripts.length <= SMOKE_GOLDEN_MAX, "golden_smoke_must_stay_small");

for (const scriptPath of Object.keys(SMOKE_CLASSIFICATION)) {
  const metadata = smokeEvalMetadataOf(scriptPath);
  assert(SMOKE_EVAL_TIERS.includes(metadata.tier), `unknown_eval_tier:${scriptPath}:${metadata.tier}`);
  assert(SMOKE_EVAL_SURFACES.includes(metadata.surface), `unknown_eval_surface:${scriptPath}:${metadata.surface}`);
  assert(["atomic", "suite-wrapper", "gate-self-test"].includes(metadata.entryKind), `unknown_eval_entry_kind:${scriptPath}:${metadata.entryKind}`);
  assert(["none", "future-authorized"].includes(metadata.authorization), `unknown_eval_authorization:${scriptPath}:${metadata.authorization}`);
  assert(metadata.contractRefs.length > 0, `eval_contract_refs_required:${scriptPath}`);
  for (const ref of metadata.contractRefs) {
    assert(TEST_LANE_CONTRACT_REFS.includes(ref), `eval_contract_ref_must_use_root_specs:${scriptPath}:${ref}`);
  }
  if (metadata.authorization === "future-authorized") {
    assert.equal(metadata.tier, "future-authorized", `future_authorized_must_use_future_tier:${scriptPath}`);
    assert.equal(metadata.surface, "cloud", `future_authorized_must_use_cloud_surface:${scriptPath}`);
    assert(!defaultScripts.includes(scriptPath), `future_authorized_must_not_be_default:${scriptPath}`);
  }
}

for (const scriptPath of SMOKE_SUITE_ENTRYPOINTS) {
  assert.equal(smokeEvalMetadataOf(scriptPath).entryKind, "suite-wrapper", `suite_entrypoint_must_be_wrapper:${scriptPath}`);
}

assert(manifestSuiteIds.has("smoke"), "manifest_must_register_smoke_suite");
assert(manifestSuiteIds.has("health"), "manifest_must_register_health_suite");
assert(manifestSuiteIds.has("local-contract"), "manifest_must_register_local_contract_suite");
assert(!JSON.stringify(manifest).includes(["docs", "recovery", ""].join("/")), "manifest_must_not_reference_retired_recovery");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_smoke_eval_boundary",
  counts: Object.fromEntries(SMOKE_EVAL_TIERS.map((tier) => [tier, listSmokeEvalScripts({ tiers: [tier] }).length])),
}, null, 2));
