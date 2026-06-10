import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

const [packageJson, workflowSource, manifest, delivery] = await Promise.all([
  readRepoFile("package.json").then(JSON.parse),
  readRepoFile(".github/workflows/verify.yml"),
  readRepoFile("tests/fixtures/v22/agent-verify-manifest.json").then(JSON.parse),
  readRepoFile("docs/delivery/README.md"),
]);

const expectedScripts = {
  verify: "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "verify:current": "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "verify:golden-path": "node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk",
  "verify:health": "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk",
  "verify:smoke": "node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk",
  "verify:contract": "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk",
  "verify:repo-hygiene": "node scripts/v22-verify.mjs suite repo-hygiene --base origin/recovery/platform-v22-trunk",
  "verify:review": "node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk",
  "test:health": "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk",
  "test:smoke": "node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk",
  "test:contract": "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk",
  "test:regression": "node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk",
  "test:real-cloud-readiness": "node scripts/v22-verify.mjs suite real-cloud-readiness --base origin/recovery/platform-v22-trunk",
  "test:cloud-future-authorized": "node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk",
  "test:fast": "node scripts/v22-verify.mjs package pre-slide-fast --base origin/recovery/platform-v22-trunk",
  "test:lanes": "node scripts/v22-verify.mjs package test-lanes --base origin/recovery/platform-v22-trunk",
  "verify:local-release-candidate": "node scripts/v22-verify.mjs package local-release-candidate --base origin/recovery/platform-v22-trunk",
  "gate:review": "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "gate:change": "node scripts/v22-verify.mjs package change-package-gate --base origin/recovery/platform-v22-trunk",
  "closeout:check": "node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk",
  "repo:hygiene": "node scripts/v22-repo-hygiene.mjs",
  "repo:bloat": "node scripts/v22-repo-bloat-audit.mjs --json",
  "line:budget": "node scripts/v22-line-budget.mjs",
  "check:diff": "git diff --check -- docs tests scripts package.json .github",
  "verify:docs-engineering-loop": "node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk",
  "verify:product-loop": "node scripts/v22-verify.mjs suite product-engineering-loop --base origin/recovery/platform-v22-trunk",
  "local:services:plan": "node scripts/v22-local-services.mjs plan --json",
  "local:services:check": "node scripts/v22-local-services.mjs check --json",
  "local:services:check:dry-run": "node scripts/v22-local-services.mjs check --dry-run --json",
  "local:services:start": "node scripts/v22-local-services.mjs start --json",
  "local:services:stop": "node scripts/v22-local-services.mjs stop --json",
  "local:services:status": "node scripts/v22-local-services.mjs status --json",
  "local:services:logs": "node scripts/v22-local-services.mjs logs --json",
  "local:services:verify": "node scripts/v22-local-services.mjs verify --dry-run --json",
};

assert.equal(packageJson.private, true, "root_package_must_be_private");
assert.equal(packageJson.type, "module", "root_package_must_use_module");
for (const [scriptName, command] of Object.entries(expectedScripts)) {
  assert.equal(packageJson.scripts?.[scriptName], command, `root_package_script_mismatch:${scriptName}`);
}
assert.deepEqual(
  Object.keys(packageJson.scripts).sort(),
  Object.keys(expectedScripts).sort(),
  "root_package_scripts_must_all_be_registered",
);

for (const command of [
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
]) {
  assert(delivery.includes(command), `delivery_default_verification_missing:${command}`);
}

for (const expected of [
  "recovery/platform-v22-trunk",
  "npm --prefix services/portal ci",
  "npm run verify:golden-path",
  "npm run verify:repo-hygiene",
  "npm run verify:health",
  "npm run verify:smoke",
  "npm run verify:contract",
  "npm run test:health",
  "npm run test:smoke",
  "npm run test:contract",
  "npm run test:regression",
  "npm run test:fast",
  "npm run test:lanes",
  "npm run verify:review",
  "npm run gate:review",
  "npm run gate:change",
  "npm run closeout:check",
  "npm run check:diff",
  "npm run verify:docs-engineering-loop",
  "npm run verify:product-loop",
]) {
assert(workflowSource.includes(expected), `verify_workflow_missing:${expected}`);
}
assert(
  workflowSource.indexOf("npm --prefix services/portal ci") < workflowSource.indexOf("npm run test:regression"),
  "verify_workflow_must_install_portal_dependencies_before_regression",
);
for (const expected of [
  "contents: read",
  "fetch-depth: 0",
  "node-version: \"22\"",
  "pull_request:",
  "workflow_dispatch:",
]) {
  assert(workflowSource.includes(expected), `verify_workflow_structure_missing:${expected}`);
}

for (const forbidden of [
  "kubectl",
  "live-test",
  "future-authorized",
]) {
  assert.equal(workflowSource.includes(forbidden), false, `verify_workflow_forbidden:${forbidden}`);
}
for (const forbiddenPattern of [
  /\bnpm run build\b/u,
  /\bdocker\s+build\b/u,
  /\bdeploy\b/u,
]) {
  assert.equal(forbiddenPattern.test(workflowSource), false, `verify_workflow_forbidden_pattern:${forbiddenPattern}`);
}

const packageSuite = manifest.package_suites.find((suite) => suite.id === "root-verify");
assert(packageSuite, "root_verify_package_suite_missing");
assert(packageSuite.commands.indexOf("npm run verify:golden-path") > packageSuite.commands.indexOf("npm run verify"), "root_verify_must_run_golden_path_after_current_verify");
assert(packageSuite.commands.indexOf("npm run verify:golden-path") < packageSuite.commands.indexOf("npm run verify:repo-hygiene"), "root_verify_must_show_golden_path_before_governance");
for (const command of [
  "npm run verify",
  "npm run verify:golden-path",
  "npm run verify:repo-hygiene",
  "npm run repo:bloat",
  "npm run verify:review",
  "npm run test:health",
  "npm run test:smoke",
  "npm run test:contract",
  "npm run test:regression",
  "npm run test:fast",
  "npm run test:lanes",
  "npm run gate:review",
  "npm run gate:change",
  "npm run closeout:check",
  "npm run check:diff",
  "npm run verify:docs-engineering-loop",
  "npm run verify:product-loop",
  "npm run test:fast",
  "npm run test:lanes",
  "node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs",
]) {
  assert(packageSuite.commands.includes(command), `root_verify_package_suite_command_missing:${command}`);
}

const preSlideFastSuite = manifest.package_suites.find((suite) => suite.id === "pre-slide-fast");
assert(preSlideFastSuite, "pre_slide_fast_package_suite_missing");
assert.deepEqual(preSlideFastSuite.commands, [
  "node scripts/v22-repo-hygiene.mjs",
  "node scripts/v22-repo-bloat-audit.mjs --json",
  "node scripts/v22-line-budget.mjs",
  "node tests/contract/contract-test-v22-test-lane-registry.mjs",
  "node tests/contract/contract-test-v22-product-engineering-loop-index.mjs",
  "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json",
], "pre_slide_fast_package_suite_commands_mismatch");

const testLanesSuite = manifest.package_suites.find((suite) => suite.id === "test-lanes");
assert(testLanesSuite, "test_lanes_package_suite_missing");
assert.deepEqual(testLanesSuite.commands, [
  "node tests/contract/contract-test-v22-test-lane-registry.mjs",
  "node tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs",
  "node tests/health/health-check-v22-smoke-classification-gate.mjs",
  "node tests/health/health-check-v22-smoke-eval-boundary.mjs",
], "test_lanes_package_suite_commands_mismatch");

const docsEngineeringLoopSuite = manifest.package_suites.find((suite) => suite.id === "docs-engineering-loop");
assert(docsEngineeringLoopSuite, "docs_engineering_loop_package_suite_missing");
assert.deepEqual(docsEngineeringLoopSuite.commands, [
  "node scripts/v22-verify.mjs suite repo-hygiene --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-repo-bloat-audit.mjs --json",
  "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite product-engineering-loop --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json",
  "git diff --check -- docs tests scripts package.json .github",
], "docs_engineering_loop_package_suite_commands_mismatch");

const changePackageGateSuite = manifest.package_suites.find((suite) => suite.id === "change-package-gate");
assert(changePackageGateSuite, "change_package_gate_package_suite_missing");
assert.equal(changePackageGateSuite.commands[0], "node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json", "change_package_gate_must_start_with_golden_path");
for (const command of [
  "node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite mvp --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite history-closeout --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
]) {
  assert(changePackageGateSuite.commands.includes(command), `change_package_gate_package_suite_command_missing:${command}`);
}

const localReleaseCandidateSuite = manifest.package_suites.find((suite) => suite.id === "local-release-candidate");
assert(localReleaseCandidateSuite, "local_release_candidate_package_suite_missing");
assert.deepEqual(localReleaseCandidateSuite.commands, [
  "node tests/contract/contract-test-v22-local-portal-opl-delivery-rc.mjs",
  "node tests/contract/contract-test-v22-local-service-orchestration.mjs",
  "node scripts/v22-local-services.mjs verify --dry-run --json",
  "node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk --json",
  "npm --prefix services/portal run check",
  "bash -lc \"cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...\"",
  "git diff --check -- docs specs changes tests scripts package.json services/portal/frontend/src services/medopl-go-backend services/opl-web-gateway services/opl-runtime-bridge",
], "local_release_candidate_package_suite_commands_mismatch");

const reviewSuite = manifest.suites.find((suite) => suite.id === "review");
assert(reviewSuite?.commands.includes("node tests/contract/contract-test-v22-landing-closeout-automation.mjs"), "review_suite_must_check_landing_closeout");
assert(reviewSuite?.commands.includes("node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs"), "review_suite_must_check_root_verify_workflow");
assert(reviewSuite?.commands.includes("node tests/contract/contract-test-v22-framework-workflow-convergence.mjs"), "review_suite_must_check_framework_workflow");
assert(reviewSuite?.commands.includes("node tests/contract/contract-test-v22-product-engineering-loop-index.mjs"), "review_suite_must_check_product_engineering_loop");

const localContractSuite = manifest.suites.find((suite) => suite.id === "local-contract");
assert(localContractSuite?.commands.includes("node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs"), "local_contract_must_check_root_verify_workflow");
assert(localContractSuite?.commands.includes("node tests/contract/contract-test-v22-product-engineering-loop-index.mjs"), "local_contract_must_check_product_engineering_loop");

const productLoopSuite = manifest.suites.find((suite) => suite.id === "product-engineering-loop");
assert.deepEqual(productLoopSuite?.commands, [
  "node tests/contract/contract-test-v22-product-engineering-loop-index.mjs",
], "product_engineering_loop_suite_commands_mismatch");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_root_verify_workflow_entrypoints",
  packageScripts: Object.keys(expectedScripts).sort(),
}, null, 2));
