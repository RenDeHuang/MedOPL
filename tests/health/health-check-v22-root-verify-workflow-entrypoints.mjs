import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

const [packageJson, workflowSource, manifest, delivery, testsReadme] = await Promise.all([
  readRepoFile("package.json").then(JSON.parse),
  readRepoFile(".github/workflows/verify.yml"),
  readRepoFile("tests/fixtures/v22/agent-verify-manifest.json").then(JSON.parse),
  readRepoFile("docs/delivery/README.md"),
  readRepoFile("tests/README.md"),
]);

const expectedScripts = {
  "validate:active-platform": "node scripts/v22-verify.mjs active-platform",
  verify: "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "verify:current": "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "verify:golden-path": "node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk",
  "verify:health": "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk",
  "verify:smoke": "node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk",
  "verify:contract": "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk",
  "verify:repo-hygiene": "node scripts/v22-verify.mjs suite repo-hygiene --base origin/recovery/platform-v22-trunk",
  "verify:review": "node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk",
  "test:product": "node scripts/v22-verify.mjs suite product --base origin/recovery/platform-v22-trunk",
  "test:frontend": "node scripts/v22-verify.mjs suite frontend --base origin/recovery/platform-v22-trunk",
  "test:backend": "node scripts/v22-verify.mjs suite backend --base origin/recovery/platform-v22-trunk",
  "test:runtime": "node scripts/v22-verify.mjs suite runtime --base origin/recovery/platform-v22-trunk",
  "test:release": "node scripts/v22-verify.mjs suite release --base origin/recovery/platform-v22-trunk",
  "test:cloud": "node scripts/v22-verify.mjs suite cloud --base origin/recovery/platform-v22-trunk",
  "test:hygiene": "node scripts/v22-verify.mjs suite hygiene --base origin/recovery/platform-v22-trunk",
  "test:health": "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk",
  "test:smoke": "node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk",
  "test:contract": "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk",
  "pretest:regression": "npm --prefix services/portal/frontend ci && mkdir -p .runtime/browser-test && npm --prefix .runtime/browser-test install --no-save playwright@1.58.2 && npx --prefix .runtime/browser-test playwright install chromium",
  "test:regression": "node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk",
  "test:real-cloud-readiness": "node scripts/v22-verify.mjs suite real-cloud-readiness --base origin/recovery/platform-v22-trunk",
  "test:cloud-future-authorized": "node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk",
  "cloud:authorized:plan": "node scripts/v22-cloud-authorized-executor.mjs --dry-run --json",
  "cloud:goal:preflight": "node scripts/v22-cloud-authorized-executor.mjs --preflight --json",
  "cloud:authorized:execute": "node scripts/v22-cloud-authorized-executor.mjs --execute --json",
  "cloud:goal": "V22_CLOUD_COMMAND_EXECUTOR=tests/support/cloud-prework/cloud-authorized-production-goal-executor.js node scripts/v22-cloud-authorized-executor.mjs --execute --json",
  "verify:cloud-release-candidate": "node scripts/v22-verify.mjs package cloud-release-candidate --base origin/recovery/platform-v22-trunk",
  "test:plan": "node scripts/v22-verify.mjs plan --base origin/recovery/platform-v22-trunk",
  "test:run-plan": "node scripts/v22-verify.mjs run-plan --base origin/recovery/platform-v22-trunk",
  "slice:start": "node scripts/v22-worktree-slice-orchestrator.mjs start --json",
  "slice:plan": "node scripts/v22-worktree-slice-orchestrator.mjs plan --json",
  "slice:verify": "node scripts/v22-worktree-slice-orchestrator.mjs verify --json",
  "slice:land": "node scripts/v22-worktree-slice-orchestrator.mjs land --json",
  "slice:post-push-verify": "node scripts/v22-worktree-slice-orchestrator.mjs post-push-verify --json",
  "slice:cleanup": "node scripts/v22-worktree-slice-orchestrator.mjs cleanup --json",
  "test:fast": "node scripts/v22-verify.mjs package pre-slide-fast --base origin/recovery/platform-v22-trunk",
  "test:lanes": "node scripts/v22-verify.mjs package test-lanes --base origin/recovery/platform-v22-trunk",
  "verify:local-release-candidate": "node scripts/v22-verify.mjs package local-release-candidate --base origin/recovery/platform-v22-trunk",
  "gate:review": "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "repo:hygiene": "node scripts/v22-repo-hygiene.mjs",
  "repo:bloat": "node scripts/v22-repo-bloat-audit.mjs --json",
  "line:budget": "node scripts/v22-line-budget.mjs",
  "check:diff": "git diff --check -- AGENTS.md README.md TASTE.md contracts docs specs tests scripts deploy package.json .github",
  "local:services:plan": "node scripts/v22-local-services.mjs plan --json",
  "local:services:check": "node scripts/v22-local-services.mjs check --json",
  "local:services:check:dry-run": "node scripts/v22-local-services.mjs check --dry-run --json",
  "local:services:start": "node scripts/v22-local-services.mjs start --json",
  "local:services:stop": "node scripts/v22-local-services.mjs stop --json",
  "local:services:status": "node scripts/v22-local-services.mjs status --json",
  "local:services:logs": "node scripts/v22-local-services.mjs logs --json",
  "local:services:verify": "node scripts/v22-local-services.mjs verify --dry-run --json",
  "local:product:e2e": "node scripts/v22-local-product-e2e.mjs --dry-run --json",
  "local:product:e2e:execute": "node scripts/v22-local-product-e2e.mjs --execute --json",
  "cloud:rollout:dry-run": "node scripts/cloud-rollout/medopl.mjs",
  "cloud:rollout:availability": "node scripts/cloud-rollout/medopl.mjs --availability-probe",
  "verify:production-complete-candidate": "node scripts/v22-verify.mjs package production-complete-candidate --base origin/recovery/platform-v22-trunk",
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
  "Test Policy -> Discovery -> Preflight -> Run -> Report/Completion Gate",
  "`npm run test:run-plan`",
  "`recommendedCommands`",
  "`authorizedCommands`",
  "`cannotClaim`",
  "只执行 `recommendedCommands`",
  "不自动执行 `authorizedCommands`",
  "不执行 cloud/live/deploy/kubectl",
  "**Preflight**",
  "**Report/Completion Gate**",
]) {
  assert(delivery.includes(expected), `delivery_dynamic_test_system_boundary_missing:${expected}`);
}
for (const expected of [
  "Test Policy -> Discovery -> Preflight -> Run -> Report/Completion Gate",
  "`npm run test:run-plan`",
  "`recommendedCommands`",
  "`authorizedCommands`",
  "`cannotClaim`",
  "只执行 `recommendedCommands`",
  "不自动执行 `authorizedCommands`",
  "**Preflight**",
  "**Report/Completion Gate**",
]) {
  assert(testsReadme.includes(expected), `tests_readme_dynamic_test_system_boundary_missing:${expected}`);
}

for (const expected of [
  "recovery/platform-v22-trunk",
  "npm run pretest:regression",
  "npm run verify:golden-path",
  "npm run verify:repo-hygiene",
  "npm run verify:health",
  "npm run verify:smoke",
  "npm run verify:contract",
  "npm run test:health",
  "npm run test:smoke",
  "npm run test:contract",
  "npm run test:regression",
  "npm run test:product",
  "npm run test:frontend",
  "npm run test:backend",
  "npm run test:runtime",
  "npm run test:release",
  "npm run test:cloud",
  "npm run test:hygiene",
  "npm run test:fast",
  "npm run test:lanes",
  "npm run verify:review",
  "npm run gate:review",
  "npm run check:diff",
]) {
  assert(workflowSource.includes(expected), `verify_workflow_missing:${expected}`);
}
assert(
  packageJson.scripts["pretest:regression"].includes("npm --prefix services/portal/frontend ci")
    && packageJson.scripts["pretest:regression"].includes("npm --prefix .runtime/browser-test install --no-save playwright@1.58.2")
    && packageJson.scripts["pretest:regression"].includes("npx --prefix .runtime/browser-test playwright install chromium"),
  "regression_pretest_must_install_frontend_and_browser_dependencies",
);
for (const expected of [
  "contents: read",
  "fetch-depth: 0",
  "node-version: \"22\"",
  "actions/setup-go@v5",
  "go-version: \"1.22.x\"",
  "git fetch --no-tags origin +refs/heads/recovery/platform-v22-trunk:refs/remotes/origin/recovery/platform-v22-trunk",
  "pull_request:",
  "workflow_dispatch:",
]) {
  assert(workflowSource.includes(expected), `verify_workflow_structure_missing:${expected}`);
}
assert.equal(workflowSource.includes("git fetch --no-tags --prune origin recovery/platform-v22-trunk:refs/remotes/origin/recovery/platform-v22-trunk"), false, "verify_workflow_must_not_prune_baseline_ref");

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
  "npm run validate:active-platform",
  "npm run verify",
  "npm run verify:golden-path",
  "npm run verify:repo-hygiene",
  "npm run repo:bloat",
  "npm run verify:review",
  "npm run gate:review",
  "npm run check:diff",
  "npm run test:health",
  "npm run test:smoke",
  "npm run test:contract",
  "npm run test:regression",
  "npm run test:fast",
  "npm run test:lanes",
  "node tests/health/health-check-v22-root-verify-workflow-entrypoints.mjs",
]) {
  assert(packageSuite.commands.includes(command), `root_verify_package_suite_command_missing:${command}`);
}

const dynamicTestSuite = manifest.package_suites.find((suite) => suite.id === "dynamic-test-system" || suite.id === "test-run-plan");
assert(dynamicTestSuite, "dynamic_test_system_package_suite_missing");
for (const command of [
  "npm run test:run-plan -- --dry-run --json",
  "node tests/health/health-check-v22-dynamic-test-run-plan.mjs",
  "node tests/health/health-check-v22-verify-plan-mode.mjs",
]) {
  assert(dynamicTestSuite.commands.includes(command), `dynamic_test_system_package_suite_command_missing:${command}`);
}

const preSlideFastSuite = manifest.package_suites.find((suite) => suite.id === "pre-slide-fast");
assert(preSlideFastSuite, "pre_slide_fast_package_suite_missing");
assert.deepEqual(preSlideFastSuite.commands, [
  "node scripts/v22-repo-hygiene.mjs",
  "node scripts/v22-repo-bloat-audit.mjs --json",
  "node scripts/v22-line-budget.mjs",
  "node tests/health/health-check-v22-test-lane-registry.mjs",
  "node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json",
], "pre_slide_fast_package_suite_commands_mismatch");

const testLanesSuite = manifest.package_suites.find((suite) => suite.id === "test-lanes");
assert(testLanesSuite, "test_lanes_package_suite_missing");
assert.deepEqual(testLanesSuite.commands, [
  "node tests/health/health-check-v22-test-lane-registry.mjs",
  "node tests/health/health-check-v22-test-lifecycle-cleanup.mjs",
  "node tests/health/health-check-v22-production-receipt-boundary.mjs",
  "node tests/health/health-check-v22-verify-plan-mode.mjs",
  "node tests/health/health-check-v22-worktree-slice-orchestrator.mjs",
  "node tests/health/health-check-v22-smoke-classification-gate.mjs",
  "node tests/health/health-check-v22-smoke-eval-boundary.mjs",
  "node tests/cloud/cloud-test-v22-cloud-authorized-executor.mjs",
], "test_lanes_package_suite_commands_mismatch");

assert.equal(manifest.package_suites.some((suite) => suite.id === "docs-engineering-loop"), false, "docs_engineering_loop_package_suite_must_remain_retired");
assert.equal(manifest.package_suites.some((suite) => suite.id === "change-package-gate"), false, "change_package_gate_package_suite_must_remain_retired");

const localReleaseCandidateSuite = manifest.package_suites.find((suite) => suite.id === "local-release-candidate");
assert(localReleaseCandidateSuite, "local_release_candidate_package_suite_missing");
assert.deepEqual(localReleaseCandidateSuite.commands, [
  "node tests/contracts/contract-test-v22-local-service-orchestration.mjs",
  "node scripts/v22-local-services.mjs verify --dry-run --json",
  "node scripts/v22-local-product-e2e.mjs --dry-run --json",
  "node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json",
  "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json",
  "npm --prefix services/portal run frontend:install",
  "npm --prefix services/portal run check",
  "node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk --json",
  "bash -lc \"cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...\"",
  "git diff --check -- docs specs tests scripts package.json services/portal/frontend/src services/medopl-go-backend services/opl-web-gateway services/opl-runtime-bridge",
], "local_release_candidate_package_suite_commands_mismatch");

const cloudReleaseCandidateSuite = manifest.package_suites.find((suite) => suite.id === "cloud-release-candidate");
assert(cloudReleaseCandidateSuite, "cloud_release_candidate_package_suite_missing");
assert.deepEqual(cloudReleaseCandidateSuite.commands, [
  "node tests/cloud/cloud-test-v22-cloud-authorized-executor.mjs",
  "node tests/cloud/cloud-test-v22-medopl-github-cloud-rollout-shape.mjs",
  "node tests/cloud/cloud-test-v22-production-goal-command-runner.mjs",
  "node tests/cloud/cloud-test-v22-production-goal-runners.mjs",
  "node tests/release/release-test-v22-production-receipt-boundary.mjs",
  "node scripts/v22-verify.mjs cloud-release-candidate --base origin/recovery/platform-v22-trunk --json",
], "cloud_release_candidate_package_suite_commands_mismatch");

const productionCompleteCandidateSuite = manifest.package_suites.find((suite) => suite.id === "production-complete-candidate");
assert(productionCompleteCandidateSuite, "production_complete_candidate_package_suite_missing");
assert.deepEqual(productionCompleteCandidateSuite.commands, [
  "node tests/release/release-test-v22-production-receipt-boundary.mjs",
  "node scripts/v22-verify.mjs production-complete-candidate --base origin/recovery/platform-v22-trunk --json",
], "production_complete_candidate_package_suite_commands_mismatch");

const reviewSuite = manifest.suites.find((suite) => suite.id === "review");
assert(reviewSuite?.commands.includes("node tests/health/health-check-v22-verify-plan-mode.mjs"), "review_suite_must_check_verify_plan_mode");

const localContractSuite = manifest.suites.find((suite) => suite.id === "local-contract");
assert(localContractSuite?.commands.includes("node tests/health/health-check-v22-verify-plan-mode.mjs"), "local_contract_must_check_verify_plan_mode");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_root_verify_workflow_entrypoints",
  packageScripts: Object.keys(expectedScripts).sort(),
}, null, 2));
