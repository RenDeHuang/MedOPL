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
  "gate:review": "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "repo:hygiene": "node scripts/v22-repo-hygiene.mjs",
  "line:budget": "node scripts/v22-line-budget.mjs",
  "check:diff": "git diff --check -- docs tests scripts package.json .github",
};

assert.equal(packageJson.private, true, "root_package_must_be_private");
assert.equal(packageJson.type, "module", "root_package_must_use_module");
for (const [scriptName, command] of Object.entries(expectedScripts)) {
  assert.equal(packageJson.scripts?.[scriptName], command, `root_package_script_mismatch:${scriptName}`);
}

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
  "npm run verify:repo-hygiene",
  "npm run verify:health",
  "npm run verify:smoke",
  "npm run verify:contract",
  "npm run gate:review",
  "npm run check:diff",
]) {
  assert(workflowSource.includes(expected), `verify_workflow_missing:${expected}`);
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
  "npm run gate:review",
  "npm run check:diff",
  "node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs",
]) {
  assert(packageSuite.commands.includes(command), `root_verify_package_suite_command_missing:${command}`);
}

const localContractSuite = manifest.suites.find((suite) => suite.id === "local-contract");
assert(localContractSuite?.commands.includes("node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs"), "local_contract_must_check_root_verify_workflow");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_root_verify_workflow_entrypoints",
  packageScripts: Object.keys(expectedScripts).sort(),
}, null, 2));
