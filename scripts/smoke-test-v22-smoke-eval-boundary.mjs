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
  SMOKE_EVAL_SURFACES,
  SMOKE_EVAL_TIERS,
  SMOKE_GOLDEN_MAX,
  SMOKE_GOLDEN_MIN,
  SMOKE_GOLDEN_SCRIPTS,
  SMOKE_SUITE_ENTRYPOINTS,
  listClassifiedSmokeScripts,
  listSmokeEvalScripts,
  smokeEvalMetadataOf,
} from "./v22-smoke-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const scriptsRoot = path.join(repoRoot, "scripts");

const boundarySource = await readFile(path.join(repoRoot, "docs/contracts/v22-smoke-eval-boundary.md"), "utf8");
const contractIndexSource = await readFile(path.join(repoRoot, "docs/contracts/README.md"), "utf8");
const manifestSource = await readFile(path.join(repoRoot, "docs/recovery/v22-agent-verify-manifest.json"), "utf8");

const allSmokeScripts = (await readdir(scriptsRoot))
  .filter((name) => /^smoke-test-v22-.*\.mjs$/u.test(name))
  .map((name) => `scripts/${name}`)
  .sort();

assert.deepEqual(Object.keys(SMOKE_CLASSIFICATION).sort(), allSmokeScripts, "all_v22_eval_scripts_must_be_classified");

for (const requiredPhrase of [
  "Smoke 只代表极小关键路径",
  "health-check",
  "smoke-golden",
  "contract-local",
  "local-regression",
  "future-authorized",
  "retired",
  "tier + surface + contractRefs",
  "不得读取 secret",
  "不得调用真实云",
  "不得 build/push/deploy/kubectl/live-test",
]) {
  assert(boundarySource.includes(requiredPhrase), `smoke_eval_boundary_missing:${requiredPhrase}`);
}

for (const requiredRef of [
  "v22-smoke-eval-boundary.md",
  "suite smoke",
  "suite local-contract",
  "suite local-regression",
  "suite cloud-future-authorized",
]) {
  assert(contractIndexSource.includes(requiredRef), `contract_index_missing_smoke_eval_reference:${requiredRef}`);
}

const tiers = new Set(SMOKE_EVAL_TIERS);
const surfaces = new Set(SMOKE_EVAL_SURFACES);
const categories = new Set(SMOKE_CATEGORIES);
const healthScripts = listSmokeEvalScripts({ tiers: ["health-check"] });
const goldenScripts = listSmokeEvalScripts({ tiers: ["smoke-golden"] });
const contractScripts = listSmokeEvalScripts({ tiers: ["contract-local"] });
const localRegressionScripts = listSmokeEvalScripts({ tiers: ["local-regression"] });
const futureScripts = listSmokeEvalScripts({ tiers: ["future-authorized"] });
const retiredScripts = listSmokeEvalScripts({ tiers: ["retired"] });
const defaultScripts = listClassifiedSmokeScripts({ categories: DEFAULT_SMOKE_CATEGORIES });

assert.deepEqual(healthScripts, [...HEALTH_CHECK_SCRIPTS].sort(), "health_check_scripts_must_be_explicit");
assert.deepEqual(goldenScripts, [...SMOKE_GOLDEN_SCRIPTS].sort(), "golden_smoke_scripts_must_be_explicit");
assert(healthScripts.length > 0 && healthScripts.length <= HEALTH_CHECK_MAX, "health_check_must_stay_small");
assert(goldenScripts.length >= SMOKE_GOLDEN_MIN, "golden_smoke_must_cover_core_path");
assert(goldenScripts.length <= SMOKE_GOLDEN_MAX, "golden_smoke_must_stay_small");
assert.deepEqual(retiredScripts, [], `retired_eval_tier_must_be_empty:${retiredScripts.join(",")}`);

for (const scriptPath of Object.keys(SMOKE_CLASSIFICATION)) {
  const metadata = smokeEvalMetadataOf(scriptPath);
  assert(categories.has(metadata.category), `unknown_legacy_category:${scriptPath}:${metadata.category}`);
  assert(tiers.has(metadata.tier), `unknown_eval_tier:${scriptPath}:${metadata.tier}`);
  assert(surfaces.has(metadata.surface), `unknown_eval_surface:${scriptPath}:${metadata.surface}`);
  assert(metadata.contractRefs.includes("docs/contracts/v22-smoke-eval-boundary.md"), `eval_contract_ref_missing:${scriptPath}`);
  assert(metadata.contractRefs.length >= 2, `surface_contract_ref_missing:${scriptPath}`);
}

for (const scriptPath of [...healthScripts, ...goldenScripts]) {
  assert(defaultScripts.includes(scriptPath), `health_or_golden_must_be_in_default_local_suite:${scriptPath}`);
  assert.equal(/(?:cloud|tencent|authorized|deploy|package-d|live|canary)/iu.test(path.basename(scriptPath)), false, `health_or_golden_must_not_be_future_or_live:${scriptPath}`);
}

for (const scriptPath of futureScripts) {
  assert(!defaultScripts.includes(scriptPath), `future_authorized_must_not_be_default:${scriptPath}`);
}

for (const scriptPath of SMOKE_SUITE_ENTRYPOINTS) {
  assert(defaultScripts.includes(scriptPath), `suite_entrypoint_must_be_default_local:${scriptPath}`);
}

assert(manifestSource.includes('"id": "smoke"'), "manifest_must_register_smoke_suite");
assert(manifestSource.includes('"id": "health"'), "manifest_must_register_health_suite");
assert(manifestSource.includes('"id": "local-contract"'), "manifest_must_register_local_contract_suite");
assert(manifestSource.includes('"id": "local-regression"'), "manifest_must_register_local_regression_suite");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_smoke_eval_boundary",
  counts: {
    health: healthScripts.length,
    smokeGolden: goldenScripts.length,
    contractLocal: contractScripts.length,
    localRegression: localRegressionScripts.length,
    futureAuthorized: futureScripts.length,
    retired: retiredScripts.length,
  },
}, null, 2));
