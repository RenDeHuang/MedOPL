import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_SMOKE_CATEGORIES,
  SMOKE_CATEGORIES,
  SMOKE_CLASSIFICATION,
  listClassifiedSmokeScripts,
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

assert.deepEqual(classifiedScripts, allSmokeScripts, "all_v22_smoke_scripts_must_be_explicitly_classified");

for (const [scriptPath, category] of Object.entries(SMOKE_CLASSIFICATION)) {
  assert(allowedCategories.has(category), `unknown_smoke_category:${scriptPath}:${category}`);
}

const defaultScripts = listClassifiedSmokeScripts({ categories: DEFAULT_SMOKE_CATEGORIES });
assert(defaultScripts.includes("scripts/smoke-test-v22-smoke-classification-gate.mjs"), "default_suite_must_run_smoke_classification_gate");

for (const scriptPath of defaultScripts) {
  const category = SMOKE_CLASSIFICATION[scriptPath];
  assert(defaultCategories.has(category), `default_suite_must_not_run_nonlocal_category:${scriptPath}:${category}`);
  assert.equal(/cloud|tencent|authorized|deploy|package-d|live/i.test(path.basename(scriptPath)), false, `default_suite_must_not_run_future_authorized_or_live:${scriptPath}`);
}

const mvpSuiteSource = await readFile(path.join(repoRoot, "scripts/smoke-test-v22-mvp-contract-suite.mjs"), "utf8");
assert(mvpSuiteSource.includes("DEFAULT_SMOKE_CATEGORIES"), "mvp_suite_must_select_default_categories");
assert(mvpSuiteSource.includes("listClassifiedSmokeScripts"), "mvp_suite_must_use_smoke_classification_selector");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_smoke_classification_gate",
  classifiedCount: classifiedScripts.length,
  categories: SMOKE_CATEGORIES.map((category) => ({
    category,
    count: classifiedScripts.filter((scriptPath) => SMOKE_CLASSIFICATION[scriptPath] === category).length,
  })),
  defaultCount: defaultScripts.length,
}, null, 2));
