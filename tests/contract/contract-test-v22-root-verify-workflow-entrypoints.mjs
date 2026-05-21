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
  "verify:health": "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk",
  "verify:smoke": "node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk",
  "verify:contract": "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk",
  "verify:repo-hygiene": "node scripts/v22-verify.mjs suite repo-hygiene --base origin/recovery/platform-v22-trunk",
  "verify:review": "node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk",
  "test:health": "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk",
  "test:smoke": "node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk",
  "test:contract": "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk",
  "test:regression": "node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk",
  "gate:review": "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "gate:contract": "node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk",
  "closeout:check": "node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk",
  "repo:hygiene": "node scripts/v22-repo-hygiene.mjs",
  "repo:bloat": "node scripts/v22-repo-bloat-audit.mjs --json",
  "line:budget": "node scripts/v22-line-budget.mjs",
  "check:diff": "git diff --check -- docs tests scripts package.json .github",
  "verify:docs-engineering-loop": "node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk",
  "verify:product-loop": "node scripts/v22-verify.mjs suite product-engineering-loop --base origin/recovery/platform-v22-trunk",
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
  "npm run verify:repo-hygiene",
  "npm run verify:health",
  "npm run verify:smoke",
  "npm run verify:contract",
  "npm run test:health",
  "npm run test:smoke",
  "npm run test:contract",
  "npm run test:regression",
  "npm run verify:review",
  "npm run gate:review",
  "npm run gate:contract",
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
for (const command of [
  "npm run verify",
  "npm run verify:repo-hygiene",
  "npm run repo:bloat",
  "npm run verify:review",
  "npm run test:health",
  "npm run test:smoke",
  "npm run test:contract",
  "npm run test:regression",
  "npm run gate:review",
  "npm run gate:contract",
  "npm run closeout:check",
  "npm run check:diff",
  "npm run verify:docs-engineering-loop",
  "npm run verify:product-loop",
  "node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs",
]) {
  assert(packageSuite.commands.includes(command), `root_verify_package_suite_command_missing:${command}`);
}

const docsEngineeringLoopSuite = manifest.package_suites.find((suite) => suite.id === "docs-engineering-loop");
assert(docsEngineeringLoopSuite, "docs_engineering_loop_package_suite_missing");
assert.deepEqual(docsEngineeringLoopSuite.commands, [
  "node scripts/v22-verify.mjs suite repo-hygiene --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-repo-bloat-audit.mjs --json",
  "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite product-engineering-loop --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json",
  "git diff --check -- docs tests scripts package.json .github",
], "docs_engineering_loop_package_suite_commands_mismatch");

const contractGateSuite = manifest.package_suites.find((suite) => suite.id === "contract-gate");
assert(contractGateSuite, "contract_gate_package_suite_missing");
for (const command of [
  "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite mvp --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite history-closeout --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
]) {
  assert(contractGateSuite.commands.includes(command), `contract_gate_package_suite_command_missing:${command}`);
}

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
