import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

async function readJson(repoPath) {
  return JSON.parse(await readFile(repoPath, "utf8"));
}

async function listMjsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listMjsFiles(repoPath));
    if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(repoPath);
  }
  return files.sort();
}

const [registry, manifest, packageJson] = await Promise.all([
  readJson("services/portal/frontend/src/app/registry/portalJourneyRegistry.json"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readJson("package.json"),
]);
const testClassification = await readFile("scripts/v22-test-classification.mjs", "utf8");
const workflowEntrypointHealth = await readFile("tests/health/health-check-v22-root-verify-workflow-entrypoints.mjs", "utf8");
const uiBrowserRegression = await readFile("tests/regression/portal/regression-test-v22-portal-resource-control-ui-browser.mjs", "utf8");
const localApiActionBrowserRegression = await readFile("tests/regression/portal/regression-test-v22-portal-local-api-action-browser.mjs", "utf8");

const productEvidenceLane = manifest.suites.find((suite) => suite.id === "journey-product-evidence");
assert(productEvidenceLane, "journey_product_evidence_suite_missing");
assert.deepEqual(
  productEvidenceLane.commands,
  [
    "node tests/frontend/frontend-test-v22-portal-journey-registry.mjs",
    "node tests/regression/portal/regression-test-v22-portal-resource-control-ui-browser.mjs",
  ],
  "journey_product_evidence_suite_commands_mismatch",
);
assert.equal(
  packageJson.scripts["test:journey-evidence"],
  "node scripts/v22-verify.mjs suite journey-product-evidence --base origin/recovery/platform-v22-trunk",
  "package_script_test_journey_evidence_missing",
);
assert(testClassification.includes('"journey-product-evidence"'), "test_classification_journey_product_evidence_suite_missing");

for (const journey of registry.journeys) {
  assert.equal(
    journey.product_value_evidence.artifact_sink,
    ".runtime/journey-product-evidence",
    `journey_evidence_artifact_sink_mismatch:${journey.id}`,
  );
  assert.equal(
    journey.product_value_evidence.git_truth,
    false,
    `journey_evidence_must_not_be_git_truth:${journey.id}`,
  );
  assert.equal(
    journey.product_value_evidence.consumer,
    "tests/regression/portal/regression-test-v22-portal-resource-control-ui-browser.mjs",
    `journey_evidence_consumer_mismatch:${journey.id}`,
  );
}

for (const requiredBrowserMarker of [
  "journeyProductEvidence",
  ".runtime/journey-product-evidence",
  "desktop_screenshot",
  "mobile_screenshot",
  "task_completion_assertion",
  "console_request_clean",
]) {
  assert(
    uiBrowserRegression.includes(requiredBrowserMarker),
    `browser_regression_must_emit_journey_value_evidence:${requiredBrowserMarker}`,
  );
}

assert.equal(
  packageJson.scripts["pretest:regression"].includes("npm --prefix .runtime/browser-test install --no-save playwright"),
  false,
  "pretest_regression_must_not_install_playwright_into_runtime",
);
assert.equal(
  packageJson.scripts["pretest:regression"].includes("npm --prefix services/portal/frontend exec playwright install chromium"),
  true,
  "pretest_regression_must_use_frontend_workspace_playwright",
);
const workflowEntrypointHealthWithoutThisCheck = workflowEntrypointHealth.replace(
  "npm --prefix .runtime/browser-test install --no-save playwright",
  "",
);
assert.equal(
  workflowEntrypointHealthWithoutThisCheck.includes("npm --prefix .runtime/browser-test install --no-save playwright"),
  false,
  "workflow_entrypoint_health_must_not_require_runtime_playwright_install",
);
assert.equal(
  workflowEntrypointHealth.includes("npm --prefix services/portal/frontend exec playwright install chromium"),
  true,
  "workflow_entrypoint_health_must_expect_frontend_playwright_install",
);
for (const [browserRegressionName, browserRegressionSource] of [
  ["resource_control_ui", uiBrowserRegression],
  ["local_api_action", localApiActionBrowserRegression],
]) {
  assert(
    browserRegressionSource.includes('path.join(frontendRoot, "node_modules", "playwright", "index.js")'),
    `browser_regression_must_load_frontend_workspace_playwright:${browserRegressionName}`,
  );
}

const frontendPackage = await readJson("services/portal/frontend/package.json");
assert.equal(
  frontendPackage.devDependencies.playwright,
  "1.58.2",
  "frontend_workspace_must_pin_playwright",
);

const reviewedNearLimitBaselines = new Map([
  ["tests/backend/backend-test-v22-api-contract.mjs", 929],
  ["tests/cloud/cloud-test-v22-medopl-github-cloud-rollout-shape.mjs", 996],
  ["tests/regression/portal/regression-test-v22-portal-resource-control-ui-browser.mjs", 968],
  ["tests/support/cloud-prework/production-goal-command-runner.mjs", 907],
]);
const testFiles = await listMjsFiles("tests");
const unreviewedNearLimit = [];
const oversized = [];
for (const file of testFiles) {
  const content = await readFile(file, "utf8");
  const lines = content.split("\n").length;
  if (lines > 1000) oversized.push({ file, lines });
  if (lines > 900 && !reviewedNearLimitBaselines.has(file)) unreviewedNearLimit.push({ file, lines });
  if (reviewedNearLimitBaselines.has(file)) {
    assert(
      lines <= reviewedNearLimitBaselines.get(file),
      `reviewed_near_limit_test_must_not_grow_without_split:${file}:${lines}`,
    );
  }
}
assert.deepEqual(unreviewedNearLimit, [], `test_files_above_900_lines_need_reviewed_baseline:${JSON.stringify(unreviewedNearLimit)}`);
assert.deepEqual(oversized, [], `test_files_must_stay_below_1000_lines:${JSON.stringify(oversized)}`);

const browserRegressionStats = await stat("tests/regression/portal/regression-test-v22-portal-resource-control-ui-browser.mjs");
assert(browserRegressionStats.size < 60000, `browser_regression_must_not_become_unbounded:${browserRegressionStats.size}`);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_journey_product_evidence_and_test_weight",
  journeyEvidenceSuite: productEvidenceLane.id,
  checkedJourneys: registry.journeys.length,
  testFiles: testFiles.length,
}, null, 2));
