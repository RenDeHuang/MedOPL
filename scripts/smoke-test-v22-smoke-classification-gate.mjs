import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
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
  listClassifiedSmokeScripts,
  listSmokeEvalScripts,
  smokeEvalMetadataOf,
} from "./v22-smoke-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const scriptsRoot = path.join(repoRoot, "scripts");

const allSmokeScripts = (await readdir(scriptsRoot))
  .filter((name) => /^smoke-test-v22-.*\.mjs$/u.test(name))
  .map((name) => `scripts/${name}`)
  .sort();

const classifiedScripts = Object.keys(SMOKE_CLASSIFICATION).sort();
const allowedCategories = new Set(SMOKE_CATEGORIES);
const defaultCategories = new Set(DEFAULT_SMOKE_CATEGORIES);
const allowedTiers = new Set(SMOKE_EVAL_TIERS);
const allowedSurfaces = new Set(SMOKE_EVAL_SURFACES);
const allowedEntryKinds = new Set(SMOKE_EVAL_ENTRY_KINDS);
const allowedAuthorizations = new Set(SMOKE_EVAL_AUTHORIZATIONS);

assert.deepEqual(classifiedScripts, allSmokeScripts, "all_v22_smoke_scripts_must_be_explicitly_classified");

for (const [scriptPath, category] of Object.entries(SMOKE_CLASSIFICATION)) {
  assert(allowedCategories.has(category), `unknown_smoke_category:${scriptPath}:${category}`);
}

const defaultScripts = listClassifiedSmokeScripts({ categories: DEFAULT_SMOKE_CATEGORIES });
assert(defaultScripts.includes("scripts/smoke-test-v22-smoke-classification-gate.mjs"), "default_suite_must_run_smoke_classification_gate");
assert(defaultScripts.includes("scripts/smoke-test-v22-smoke-eval-boundary.mjs"), "default_suite_must_run_smoke_eval_boundary_gate");
assert(defaultScripts.includes("scripts/smoke-test-v22-golden-smoke-suite.mjs"), "default_suite_must_register_golden_smoke_suite");
assert(defaultScripts.includes("scripts/smoke-test-v22-archive-smoke-contract-physical-retirement-gate.mjs"), "default_suite_must_run_archive_physical_retirement_gate");

const retiredScripts = listClassifiedSmokeScripts({ categories: ["archive/retired"] });
assert.deepEqual(retiredScripts, [], `archive_retired_smoke_category_must_be_empty:${retiredScripts.join(",")}`);

const healthScripts = listSmokeEvalScripts({ tiers: ["health-check"] });
const goldenScripts = listSmokeEvalScripts({ tiers: ["smoke-golden"] });
const futureScripts = listSmokeEvalScripts({ tiers: ["future-authorized"] });
const evalRetiredScripts = listSmokeEvalScripts({ tiers: ["retired"] });
const suiteWrapperScripts = [];
const gateSelfTestScripts = [];

assert.deepEqual(healthScripts, [...HEALTH_CHECK_SCRIPTS].sort(), "health_check_scripts_must_be_explicit");
assert.deepEqual(goldenScripts, [...SMOKE_GOLDEN_SCRIPTS].sort(), "golden_smoke_scripts_must_be_explicit");
assert(healthScripts.length > 0 && healthScripts.length <= HEALTH_CHECK_MAX, "health_check_must_stay_small");
assert(goldenScripts.length >= SMOKE_GOLDEN_MIN, "golden_smoke_must_cover_core_path");
assert(goldenScripts.length <= SMOKE_GOLDEN_MAX, "golden_smoke_must_stay_small");
assert.deepEqual(evalRetiredScripts, [], `retired_eval_tier_must_be_empty:${evalRetiredScripts.join(",")}`);

for (const scriptPath of defaultScripts) {
  const category = SMOKE_CLASSIFICATION[scriptPath];
  assert(defaultCategories.has(category), `default_suite_must_not_run_nonlocal_category:${scriptPath}:${category}`);
  assert.equal(/cloud|tencent|authorized|deploy|package-d|live/i.test(path.basename(scriptPath)), false, `default_suite_must_not_run_future_authorized_or_live:${scriptPath}`);
}

for (const scriptPath of Object.keys(SMOKE_CLASSIFICATION)) {
  const metadata = smokeEvalMetadataOf(scriptPath);
  assert(allowedTiers.has(metadata.tier), `unknown_eval_tier:${scriptPath}:${metadata.tier}`);
  assert(allowedSurfaces.has(metadata.surface), `unknown_eval_surface:${scriptPath}:${metadata.surface}`);
  assert(allowedEntryKinds.has(metadata.entryKind), `unknown_eval_entry_kind:${scriptPath}:${metadata.entryKind}`);
  assert(allowedAuthorizations.has(metadata.authorization), `unknown_eval_authorization:${scriptPath}:${metadata.authorization}`);
  assert(metadata.contractRefs.includes("docs/contracts/v22-smoke-eval-boundary.md"), `smoke_eval_contract_ref_missing:${scriptPath}`);
  if (metadata.entryKind === "suite-wrapper") suiteWrapperScripts.push(scriptPath);
  if (metadata.entryKind === "gate-self-test") gateSelfTestScripts.push(scriptPath);
  if (metadata.authorization === "future-authorized") {
    assert.equal(metadata.tier, "future-authorized", `future_authorized_must_map_to_future_tier:${scriptPath}`);
    assert.equal(metadata.surface, "cloud", `future_authorized_must_map_to_cloud_surface:${scriptPath}`);
  } else {
    assert.notEqual(metadata.tier, "future-authorized", `non_future_authorized_must_not_use_future_tier:${scriptPath}`);
  }
}

assert.deepEqual(suiteWrapperScripts.sort(), [
  "scripts/smoke-test-v22-golden-smoke-suite.mjs",
  "scripts/smoke-test-v22-mvp-contract-suite.mjs",
], "suite_wrappers_must_be_explicit");
assert.deepEqual(gateSelfTestScripts.sort(), [
  "scripts/smoke-test-v22-workflow-gate.mjs",
], "gate_self_tests_must_be_explicit");

for (const scriptPath of [...healthScripts, ...goldenScripts]) {
  assert(defaultScripts.includes(scriptPath), `health_or_golden_must_be_default_local:${scriptPath}`);
  assert.equal(/(?:cloud|tencent|authorized|deploy|package-d|live|canary)/iu.test(path.basename(scriptPath)), false, `health_or_golden_must_not_be_future_or_live:${scriptPath}`);
}

for (const scriptPath of futureScripts) {
  assert(!defaultScripts.includes(scriptPath), `future_authorized_must_not_be_default:${scriptPath}`);
}

const mvpSuiteSource = await readFile(path.join(repoRoot, "scripts/smoke-test-v22-mvp-contract-suite.mjs"), "utf8");
assert(mvpSuiteSource.includes("DEFAULT_SMOKE_CATEGORIES"), "mvp_suite_must_select_default_categories");
assert(mvpSuiteSource.includes("listClassifiedSmokeScripts"), "mvp_suite_must_use_smoke_classification_selector");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_smoke_classification_gate",
  classifiedCount: classifiedScripts.length,
  atomicCount: classifiedScripts
    .filter((scriptPath) => smokeEvalMetadataOf(scriptPath).entryKind === "atomic")
    .length,
  suiteWrapperCount: suiteWrapperScripts.length,
  gateSelfTestCount: gateSelfTestScripts.length,
  categories: SMOKE_CATEGORIES.map((category) => ({
    category,
    count: classifiedScripts.filter((scriptPath) => SMOKE_CLASSIFICATION[scriptPath] === category).length,
  })),
  tiers: SMOKE_EVAL_TIERS.map((tier) => ({
    tier,
    count: listSmokeEvalScripts({ tiers: [tier] }).length,
  })),
  defaultCount: defaultScripts.length,
}, null, 2));
