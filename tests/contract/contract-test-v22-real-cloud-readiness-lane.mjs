import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const selfFile = "tests/contract/contract-test-v22-real-cloud-readiness-lane.mjs";

const readinessFiles = [
  "tests/future-authorized/cloud/future-authorized-test-v22-tencent-official-sdk-provider-strategy-contract.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-boundary.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-wrapper-local-gate.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs",
];

const mutationOrDeployFiles = [
  "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-contract.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-execution-contract.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-implementation-contract.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-production-cloud-topology-contract.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-real-opl-webui-runtime-bridge-flow.mjs",
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
const cloudTestSources = await Promise.all([...readinessFiles, ...mutationOrDeployFiles].map(async (file) => [
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
for (const suiteId of ["health", "local-contract", "current", "review"]) {
  assert(commandFiles(manifestSuites.get(suiteId)?.commands || []).includes(selfFile), `real_cloud_readiness_contract_missing_suite:${suiteId}`);
}

const manifestReadinessFiles = commandFiles(manifestSuites.get("real-cloud-readiness")?.commands || []);
assert.deepEqual(manifestReadinessFiles, readinessFiles, "manifest_real_cloud_readiness_suite_must_match_registry");
const manifestFutureFiles = commandFiles(manifestSuites.get("cloud-future-authorized")?.commands || []);
for (const file of readinessFiles) {
  assert(!manifestFutureFiles.includes(file), `manifest_future_suite_must_not_run_readiness_file:${file}`);
}
for (const file of mutationOrDeployFiles) {
  assert(manifestFutureFiles.includes(file), `manifest_future_suite_missing_mutation_or_deploy_file:${file}`);
}

for (const command of [
  ...current.current_leaf.verification_commands,
  ...current.verification_commands,
]) {
  assert(!command.includes("suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --dry-run"), "current_readiness_must_not_be_hidden_behind_future_authorized_dry_run");
  assert(!command.includes("contract-test-v22-mvp-contract-suite.mjs") || !command.includes("cloud"), "cloud_readiness_must_not_use_old_mvp_suite_anchor");
}
assert(
  current.current_leaf.verification_commands.includes("node scripts/v22-verify.mjs suite real-cloud-readiness --base origin/recovery/platform-v22-trunk --json"),
  "current_leaf_must_run_real_cloud_readiness_suite",
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

console.log(JSON.stringify({
  ok: true,
  contract: "v22_real_cloud_readiness_lane",
  readinessFiles,
  futureAuthorizedFiles: mutationOrDeployFiles,
}, null, 2));
