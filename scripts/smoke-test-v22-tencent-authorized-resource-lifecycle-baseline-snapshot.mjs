import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(".");
const snapshotPath = "scripts/v22-tencent-authorized-resource-lifecycle-node-pool-snapshot.mjs";
const forbiddenOutputPattern = /SecretId|SecretKey|token|kubeconfig|rawResponse|providerRawResponse|node-pool-proof|cluster-proof/i;

function runSnapshot(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [snapshotPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, expectedStatus, `snapshot_status:${args.join(" ")}:${result.stderr}`);
  assert.equal(forbiddenOutputPattern.test(result.stdout), false, `stdout_must_be_redacted:${args.join(" ")}`);
  assert.equal(forbiddenOutputPattern.test(result.stderr), false, `stderr_must_be_redacted:${args.join(" ")}`);
  return JSON.parse((result.stdout || result.stderr || "{}").trim());
}

const fixtureDir = mkdtempSync(path.join(os.tmpdir(), "v22-package-c-baseline-snapshot-"));
try {
  const secretFile = path.join(fixtureDir, "mutation.env");
  writeFileSync(secretFile, [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
    "TENCENT_MUTATION_SECRET_ID=mutation-secret-id-proof",
    "TENCENT_MUTATION_SECRET_KEY=mutation-secret-key-proof",
    "TENCENT_MUTATION_ALLOWED_APIS=DescribeNodePools,ScaleNodePool,putObject,deleteObject",
    "TENCENT_MUTATION_REGIONS=na-siliconvalley",
    "TENCENT_MUTATION_ACCOUNT_ID=account-proof-123456",
    "TENCENT_MUTATION_DAILY_BUDGET_CNY=20",
    "TENCENT_MUTATION_MAX_OPERATION_COUNT=6",
    "TENCENT_MUTATION_TKE_CLUSTER_ID=cluster-proof",
    "TENCENT_MUTATION_TKE_NODE_POOL_ID=node-pool-proof",
    "TENCENT_MUTATION_COS_BUCKET=bucket-proof",
    "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
    "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT=workspace-prefix-proof",
  ].join("\n"), "utf8");

  const out = runSnapshot([
    "--snapshot",
    "--sdk-mode",
    "fake-live",
    "--secret-file",
    secretFile,
    "--run-id",
    "baseline-proof",
    "--expected-desired-capacity",
    "2",
    "--expected-current-capacity",
    "2",
  ]);
  assert.equal(out.ok, true, "snapshot_ok");
  assert.equal(out.summary.mode, "snapshot", "snapshot_mode");
  assert.equal(out.summary.nodePoolDesiredCapacity, 2, "desired_capacity");
  assert.equal(out.summary.nodePoolCurrentCapacity, 2, "current_capacity");
  assert.equal(out.summary.risk.callsRealCloudNow, false, "fake_snapshot_must_not_call_real_cloud");
  assert.match(out.reportPath, /^\.runtime\/v22-cloud-cleanup\/baseline-proof-node-pool-snapshot\.json$/, "report_path");
  const report = JSON.parse(readFileSync(out.reportPath, "utf8"));
  assert.deepEqual(report, out.summary, "report_matches_stdout");

  const blocked = runSnapshot([
    "--snapshot",
    "--sdk-mode",
    "fake-live",
    "--secret-file",
    secretFile,
    "--run-id",
    "baseline-blocked-proof",
    "--expected-desired-capacity",
    "3",
    "--expected-current-capacity",
    "2",
  ], 1);
  assert.equal(blocked.ok, false, "snapshot_mismatch_must_fail");
  assert.equal(blocked.summary.blockedReason, "node_pool_desired_capacity_not_baseline", "desired_mismatch_error");

  const source = readFileSync(snapshotPath, "utf8");
  assert.match(source, /DescribeNodePools/, "snapshot_must_use_describe_nodepools");
  assert.equal(/ScaleNodePool|ModifyNodePool|CreateClusterNodePool|DeleteClusterNodePool|deleteBucket|putBucket/.test(source), false, "snapshot_must_not_mutate_cloud");
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_authorized_resource_lifecycle_baseline_snapshot",
}, null, 2));
