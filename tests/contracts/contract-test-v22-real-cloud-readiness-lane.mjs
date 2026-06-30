import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const selfFile = "tests/contracts/contract-test-v22-real-cloud-readiness-lane.mjs";

const readinessFiles = [
  "tests/cloud/cloud-test-v22-tencent-readonly-inventory-boundary.mjs",
];

const futureBoundaryFiles = [
  "tests/cloud/cloud-test-v22-cloud-authorized-executor.mjs",
  "tests/cloud/cloud-test-v22-production-goal-command-runner.mjs",
  "tests/cloud/cloud-test-v22-production-goal-runners.mjs",
  "tests/cloud/cloud-test-v22-real-tke-cluster-foundation-lifecycle.mjs",
  "tests/cloud/cloud-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs",
  "tests/cloud/cloud-test-v22-tke-bootstrap-preflight-local-gate.mjs",
];

const retiredCloudCommandPatterns = [
  /tests\/future-authorized\/cloud\//u,
  /tests\/cloud\/cloud-test-v22-package-d-/u,
  /tests\/cloud\/cloud-test-v22-tencent-clb-readonly/u,
  /tests\/cloud\/cloud-test-v22-real-opl-webui/u,
  /tests\/cloud\/cloud-test-v22-tencent-official-sdk-provider/u,
];

async function readJson(repoPath) {
  return JSON.parse(await readFile(path.join(repoRoot, repoPath), "utf8"));
}

function runVerify(args) {
  return spawnSync(process.execPath, ["scripts/v22-verify.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function commandFiles(commands = []) {
  return commands
    .map((command) => String(command).match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u)?.[1] || "")
    .filter(Boolean)
    .sort();
}

const manifest = await readJson("tests/fixtures/v22/agent-verify-manifest.json");
const current = await readJson("tests/fixtures/v22/goal-current.json");
const packageJson = await readJson("package.json");
const manifestSuites = new Map(manifest.suites.map((suite) => [suite.id, suite]));
const cloudTestSources = await Promise.all([...readinessFiles, ...futureBoundaryFiles].map(async (file) => [
  file,
  await readFile(path.join(repoRoot, file), "utf8"),
]));

for (const [file, source] of cloudTestSources) {
  assert(!source.includes("contract-test-v22-mvp-contract-suite.mjs"), `cloud_lane_test_must_not_anchor_old_mvp_suite:${file}`);
  assert(!source.includes("smoke-test-v22-"), `cloud_lane_test_must_not_anchor_legacy_smoke_name:${file}`);
}

assert.equal(manifestSuites.has("local-rc-authorized"), false, "manifest_must_not_keep_empty_local_rc_authorized_suite");
assert.equal(manifestSuites.has("real-cloud-readiness"), true, "manifest_must_register_real_cloud_readiness_suite");
assert.equal(packageJson.scripts["test:real-cloud-readiness"], "node scripts/v22-verify.mjs suite real-cloud-readiness --base origin/recovery/platform-v22-trunk", "package_must_expose_real_cloud_readiness_lane");
assert.equal(packageJson.scripts["test:cloud"], "node scripts/v22-verify.mjs suite cloud --base origin/recovery/platform-v22-trunk", "package_must_expose_cloud_boundary_lane");
for (const suiteId of ["local-contract"]) {
  assert(commandFiles(manifestSuites.get(suiteId)?.commands || []).includes(selfFile), `real_cloud_readiness_contract_missing_suite:${suiteId}`);
}

const manifestReadinessFiles = commandFiles(manifestSuites.get("real-cloud-readiness")?.commands || []);
assert.deepEqual(manifestReadinessFiles, readinessFiles, "manifest_real_cloud_readiness_suite_must_match_registry");
const manifestFutureFiles = commandFiles(manifestSuites.get("cloud-future-authorized")?.commands || []);
for (const file of readinessFiles) {
  assert(!manifestFutureFiles.includes(file), `manifest_future_suite_must_not_run_readiness_file:${file}`);
}
assert.deepEqual(manifestFutureFiles, futureBoundaryFiles, "manifest_future_authorized_suite_must_stay_small_boundary_set");
for (const file of manifestFutureFiles) {
  for (const pattern of retiredCloudCommandPatterns) {
    assert(!pattern.test(file), `manifest_future_suite_must_not_run_retired_cloud_pattern:${pattern}:${file}`);
  }
}

for (const command of [
  ...current.current_leaf.verification_commands,
  ...current.verification_commands,
]) {
  assert(!command.includes("suite cloud-future-authorized"), "current_verify_must_not_run_future_authorized_cloud_suite");
  assert(!command.includes("suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --dry-run"), "current_readiness_must_not_be_hidden_behind_future_authorized_dry_run");
  assert(!command.includes("contract-test-v22-mvp-contract-suite.mjs") || !command.includes("cloud"), "cloud_readiness_must_not_use_old_mvp_suite_anchor");
  for (const pattern of retiredCloudCommandPatterns) {
    assert(!pattern.test(command), `current_verify_must_not_run_retired_cloud_pattern:${pattern}:${command}`);
  }
}
assert(
  packageJson.scripts["test:cloud"] && packageJson.scripts["test:real-cloud-readiness"],
  "cloud_boundary_scripts_must_exist_outside_current_product_gate",
);

const readinessPlan = runVerify(["suite", "real-cloud-readiness", "--dry-run", "--json"]);
assert.equal(readinessPlan.status, 0, `real_cloud_readiness_dry_run_must_exit_zero:${readinessPlan.stderr || readinessPlan.stdout}`);
const readinessPayload = JSON.parse(readinessPlan.stdout);
assert.equal(readinessPayload.ok, true, "real_cloud_readiness_dry_run_ok");
assert.equal(readinessPayload.suiteId, "real-cloud-readiness", "real_cloud_readiness_suite_id_mismatch");
assert.deepEqual(commandFiles(readinessPayload.commands), readinessFiles, "real_cloud_readiness_runner_commands_mismatch");
assert.deepEqual(readinessPayload.forbiddenFiles, manifest.global_forbidden_files, "readiness_suite_must_inherit_global_forbidden_files");
for (const forbiddenOp of ["secret", "live-cloud", "true-cloud-mutation", "build-push-kubectl", "deploy", "live-test", "git-push"]) {
  assert(readinessPayload.forbiddenOps.includes(forbiddenOp), `readiness_suite_forbidden_op_missing:${forbiddenOp}`);
}

const cloudPlan = runVerify(["suite", "cloud", "--dry-run", "--json"]);
assert.equal(cloudPlan.status, 0, `cloud_boundary_dry_run_must_exit_zero:${cloudPlan.stderr || cloudPlan.stdout}`);
const cloudPayload = JSON.parse(cloudPlan.stdout);
assert.equal(cloudPayload.ok, true, "cloud_boundary_dry_run_ok");
assert.equal(cloudPayload.suiteId, "cloud", "cloud_boundary_suite_id_mismatch");
assert.deepEqual(commandFiles(cloudPayload.commands), readinessFiles, "cloud_boundary_runner_commands_mismatch");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_real_cloud_readiness_lane",
  readinessFiles,
  futureAuthorizedFiles: futureBoundaryFiles,
}, null, 2));
