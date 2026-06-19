import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEST_LANE_REGISTRY,
  TEST_LANE_SUITES,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const selfFile = "tests/contract/contract-test-v22-validate-active-platform.mjs";

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function assertIncludes(source, marker, label) {
  assert(String(source).includes(marker), `${label}_missing:${marker}`);
}

function assertNotIncludes(source, marker, label) {
  assert.equal(String(source).includes(marker), false, `${label}_must_not_include:${marker}`);
}

const [packageJson, scriptSource, manifest, current] = await Promise.all([
  readJson("package.json"),
  readRepoFile("scripts/v22-verify.mjs"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readJson("tests/fixtures/v22/goal-current.json"),
]);

assert.equal(packageJson.scripts["validate:active-platform"], "node scripts/v22-verify.mjs active-platform", "package_script_mismatch");
assert.equal(packageJson.scripts.verify, "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk", "verify_script_mismatch");
assert.equal(packageJson.scripts["gate:review"], "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk", "review_script_mismatch");

for (const marker of [
  "tests/fixtures/v22/goal-current.json",
  "tests/fixtures/v22/agent-verify-manifest.json",
  "scripts/v22-verify.mjs",
  "scripts/v22-workflow-gate.mjs",
  "contracts/README.md",
  "contracts/medopl-package-d-deploy-readiness.json",
  "contracts/medopl-production-launch-gap-map.json",
  "global_forbidden_ops",
  "global_forbidden_files",
]) {
  assertIncludes(scriptSource, marker, "active_platform_wrapper_source");
}

for (const forbidden of [
  "kubectl ",
  "docker build",
  "docker push",
  "npm run build",
  "sentrux check",
  "sentrux gate",
  "deploy --",
]) {
  assertNotIncludes(scriptSource, forbidden, "active_platform_wrapper_must_not_embed_forbidden_command");
}

const registryEntry = TEST_LANE_REGISTRY.find((entry) => entry.file === selfFile);
assert(registryEntry, "active_platform_test_must_be_registered");
assert.equal(registryEntry.lane, "contract", "active_platform_lane_mismatch");
assert.equal(registryEntry.surface, "control-plane", "active_platform_surface_mismatch");
assert.equal(registryEntry.entryKind, "gate-self-test", "active_platform_entry_kind_mismatch");
assert.equal(registryEntry.authorization, "none", "active_platform_authorization_mismatch");
for (const suite of ["health", "local-contract", "current", "review"]) {
  assert(TEST_LANE_SUITES[suite].includes(selfFile), `active_platform_missing_suite:${suite}`);
}

assert.equal(current.verify_manifest, "tests/fixtures/v22/agent-verify-manifest.json", "current_manifest_pointer_mismatch");
assert.equal(manifest.runner, "scripts/v22-verify.mjs", "manifest_runner_mismatch");
assert(manifest.leaves.some((leaf) => leaf.leaf_id === current.current_cursor), "manifest_current_leaf_missing");

const quick = runNode(["scripts/v22-verify.mjs", "active-platform", "--quick", "--json"]);
assert.equal(quick.status, 0, `active_platform_quick_must_pass:${quick.stderr || quick.stdout}`);
const payload = JSON.parse(quick.stdout);
assert.equal(payload.ok, true, "active_platform_quick_payload_must_be_ok");
assert.equal(payload.contract, "validate_active_platform", "active_platform_payload_contract_mismatch");
assert.equal(payload.currentCursor, current.current_cursor, "active_platform_payload_cursor_mismatch");
assert.equal(payload.manifestRunner, "scripts/v22-verify.mjs", "active_platform_payload_runner_mismatch");

const defaultRun = runNode(["scripts/v22-verify.mjs", "active-platform", "--json"]);
assert.equal(defaultRun.status, 0, `active_platform_default_must_pass:${defaultRun.stderr || defaultRun.stdout}`);
const defaultPayload = JSON.parse(defaultRun.stdout);
assert.deepEqual(defaultPayload, payload, "active_platform_default_must_remain_shape_only");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_validate_active_platform",
  currentCursor: current.current_cursor,
}, null, 2));
