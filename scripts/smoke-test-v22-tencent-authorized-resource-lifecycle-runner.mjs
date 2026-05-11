import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseTencentMutationSecretFile } from "./v22-tencent-authorized-resource-lifecycle-runner.mjs";

const runnerPath = "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";
const repoRoot = path.resolve(".");

const forbiddenPhrases = [
  "mutation-secret-id-proof",
  "mutation-secret-key-proof",
  "readonly-secret-proof",
  "raw-response-proof",
  "bucket-proof",
  "workspace-prefix-proof",
  "node-pool-proof",
  "object-key-proof",
  "kubeconfig-proof",
];

function assertNotContainsForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  for (const phrase of forbiddenPhrases) {
    assert.equal(serialized.includes(phrase), false, `${label}_must_not_contain:${phrase}`);
  }
  assert.equal(
    /SecretId|SecretKey|token|kubeconfig|objectKey|storageKey|signedUrl|rawResponse|providerRawResponse|cosObjectBody|bucketPolicy/i.test(serialized),
    false,
    `${label}_must_not_contain_forbidden_key`,
  );
}

function runRunner(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [runnerPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, expectedStatus, `runner_status:${args.join(" ")}:${result.stderr}`);
  assertNotContainsForbidden(result.stdout, `stdout:${args.join(" ")}`);
  assertNotContainsForbidden(result.stderr, `stderr:${args.join(" ")}`);
  return result;
}

function parseStdout(stdout) {
  return JSON.parse(stdout.trim());
}

function assertSummaryShape(summary, label) {
  assert.deepEqual(Object.keys(summary).sort(), [
    "artifactPath",
    "blockedReason",
    "dryRun",
    "gateId",
    "mode",
    "ok",
    "operationId",
    "operationType",
    "portalRecords",
    "resourceKind",
    "risk",
  ].sort(), `${label}_summary_keys`);
  assert.equal(summary.dryRun, true, `${label}_must_be_dry_run`);
  assert.equal(Array.isArray(summary.portalRecords), true, `${label}_portal_records_array`);
  assert.equal(summary.portalRecords.includes("cloud_operation"), true, `${label}_cloud_operation_required`);
  assertNotContainsForbidden(summary, label);
}

function assertExecutionSummaryShape(summary, label) {
  assert.deepEqual(Object.keys(summary).sort(), [
    "artifactPath",
    "blockedReason",
    "dryRun",
    "execution",
    "gateId",
    "mode",
    "ok",
    "operationId",
    "operationType",
    "portalRecords",
    "resourceKind",
    "risk",
  ].sort(), `${label}_execution_summary_keys`);
  assert.equal(summary.mode, "execute", `${label}_execution_mode`);
  assert.equal(summary.dryRun, false, `${label}_must_not_be_dry_run`);
  assert.equal(summary.ok, true, `${label}_execution_ok`);
  assert.equal(summary.blockedReason, null, `${label}_execution_not_blocked`);
  assert.equal(summary.risk.callsRealCloudNow, false, `${label}_fake_live_must_not_call_real_cloud`);
  assert.equal(summary.risk.executesMutationNow, true, `${label}_fake_live_executes_mutation_path`);
  assert.equal(summary.execution?.providerMode, "fake-live", `${label}_provider_mode`);
  assert.equal(summary.execution?.acceptedDryRunVerified, true, `${label}_accepted_dry_run_verified`);
  assertNotContainsForbidden(summary, label);
}

const goodSecretText = [
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
  "TENCENT_MUTATION_SECRET_ID=mutation-secret-id-proof",
  "TENCENT_MUTATION_SECRET_KEY=mutation-secret-key-proof",
  "TENCENT_MUTATION_ALLOWED_APIS=putObject,deleteObject,DescribeNodePools,ScaleNodePool",
  "TENCENT_MUTATION_REGIONS=na-siliconvalley",
  "TENCENT_MUTATION_ACCOUNT_ID=account-proof-123456",
  "TENCENT_MUTATION_DAILY_BUDGET_CNY=20",
  "TENCENT_MUTATION_MAX_OPERATION_COUNT=6",
  "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-proof",
  "TENCENT_MUTATION_TKE_NODE_POOL_ID=node-pool-proof",
  "TENCENT_MUTATION_COS_BUCKET=bucket-proof",
  "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
  "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT=workspace-prefix-proof",
].join("\n");

const parsed = parseTencentMutationSecretFile(goodSecretText);
assert.deepEqual(Object.keys(parsed).sort(), [
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "TENCENT_MUTATION_ACCOUNT_ID",
  "TENCENT_MUTATION_ALLOWED_APIS",
  "TENCENT_MUTATION_COS_BUCKET",
  "TENCENT_MUTATION_COS_REGION",
  "TENCENT_MUTATION_DAILY_BUDGET_CNY",
  "TENCENT_MUTATION_MAX_OPERATION_COUNT",
  "TENCENT_MUTATION_REGIONS",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "TENCENT_MUTATION_TKE_CLUSTER_ID",
  "TENCENT_MUTATION_TKE_NODE_POOL_ID",
  "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT",
].sort(), "parser_must_only_return_package_c_allowlist_keys");

assert.throws(
  () => parseTencentMutationSecretFile(`${goodSecretText}\nTENCENT_READONLY_SECRET_ID=readonly-secret-proof`),
  /tencent_resource_lifecycle_forbidden_secret_key:TENCENT_READONLY_SECRET_ID/,
  "parser_must_reject_readonly_secret",
);
assert.throws(
  () => parseTencentMutationSecretFile(`${goodSecretText}\nUNLISTED_SECRET_KEY=proof`),
  /tencent_resource_lifecycle_non_allowlist_secret_key_rejected:UNLISTED_SECRET_KEY/,
  "parser_must_reject_unknown_key",
);

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-resource-lifecycle-runner-"));
const reportPathsToCleanup = [];
try {
  const goodSecretFile = path.join(tmpDir, "mutation.env");
  await writeFile(goodSecretFile, goodSecretText, "utf8");
  const disabledSecretFile = path.join(tmpDir, "disabled.env");
  await writeFile(disabledSecretFile, goodSecretText.replace("RUN_TENCENT_CREATE_RELEASE_EXECUTION=1", "RUN_TENCENT_CREATE_RELEASE_EXECUTION=0"), "utf8");
  const readonlySecretFile = path.join(tmpDir, "readonly-mixed.env");
  await writeFile(readonlySecretFile, `${goodSecretText}\nTENCENT_READONLY_SECRET_KEY=readonly-secret-proof`, "utf8");

  const checkConfig = runRunner(["--check-config", "--secret-file", goodSecretFile, "--operation", "storage-create"]);
  const checkConfigOut = parseStdout(checkConfig.stdout);
  assert.equal(checkConfigOut.reportPath, null, "check_config_must_not_write_report");
  assert.equal(checkConfigOut.summary.ok, true, "check_config_ok");
  assert.equal(checkConfigOut.summary.blockedReason, null, "check_config_not_blocked");
  assertNotContainsForbidden(checkConfigOut.summary, "check_config_summary");

  runRunner(["--check-config", "--secret-file", readonlySecretFile, "--operation", "storage-create"], 1);

  const dryRunOperations = [
    ["storage-create", "R-06", ".runtime/v22-cloud-lifecycle/pkg-c-proof-storage-create-storage-dry-run.json"],
    ["compute-create", "R-08", ".runtime/v22-cloud-lifecycle/pkg-c-proof-compute-create-compute-dry-run.json"],
    ["storage-expand", "R-11", ".runtime/v22-cloud-lifecycle/pkg-c-proof-storage-expand-storage-expand.json"],
    ["compute-expand", "R-12", ".runtime/v22-cloud-lifecycle/pkg-c-proof-compute-expand-compute-expand.json"],
    ["compute-release", "R-19", ".runtime/v22-cloud-lifecycle/pkg-c-proof-compute-release-compute-release.json"],
    ["storage-delete", "R-20", ".runtime/v22-cloud-lifecycle/pkg-c-proof-storage-delete-storage-delete.json"],
  ];

  for (const [operation, gateId, expectedPath] of dryRunOperations) {
    const result = runRunner(["--dry-run", "--secret-file", goodSecretFile, "--operation", operation, "--run-id", "pkg-c-proof"]);
    const out = parseStdout(result.stdout);
    reportPathsToCleanup.push(out.reportPath);
    assert.equal(out.reportPath.endsWith(expectedPath), true, `report_path:${operation}`);
    assertSummaryShape(out.summary, operation);
    assert.equal(out.summary.ok, true, `summary_ok:${operation}`);
    assert.equal(out.summary.gateId, gateId, `summary_gate:${operation}`);
    const report = JSON.parse(await readFile(out.reportPath, "utf8"));
    assert.deepEqual(report, out.summary, `report_matches_stdout:${operation}`);
  }

  const fakeStorageExecution = runRunner([
    "--execute",
    "--sdk-mode",
    "fake-live",
    "--secret-file",
    goodSecretFile,
    "--operation",
    "storage-create",
    "--run-id",
    "pkg-c-proof",
    "--accepted-dry-run-id",
    "pkg-c-proof-storage-create",
    "--workspace-id",
    "workspace-proof",
  ]);
  const fakeStorageExecutionOut = parseStdout(fakeStorageExecution.stdout);
  reportPathsToCleanup.push(fakeStorageExecutionOut.reportPath);
  assert.equal(
    fakeStorageExecutionOut.reportPath.endsWith(".runtime/v22-cloud-lifecycle/pkg-c-proof-storage-create-storage-execution.json"),
    true,
    "fake_storage_execution_report_path",
  );
  assertExecutionSummaryShape(fakeStorageExecutionOut.summary, "fake_storage_execution");

  const fakeComputeExecution = runRunner([
    "--execute",
    "--sdk-mode",
    "fake-live",
    "--secret-file",
    goodSecretFile,
    "--operation",
    "compute-expand",
    "--run-id",
    "pkg-c-proof",
    "--accepted-dry-run-id",
    "pkg-c-proof-compute-expand",
    "--workspace-id",
    "workspace-proof",
    "--target-desired-capacity",
    "1",
  ]);
  const fakeComputeExecutionOut = parseStdout(fakeComputeExecution.stdout);
  reportPathsToCleanup.push(fakeComputeExecutionOut.reportPath);
  assert.equal(
    fakeComputeExecutionOut.reportPath.endsWith(".runtime/v22-cloud-lifecycle/pkg-c-proof-compute-expand-compute-execution.json"),
    true,
    "fake_compute_execution_report_path",
  );
  assertExecutionSummaryShape(fakeComputeExecutionOut.summary, "fake_compute_execution");

  const fakeStorageDeleteExecution = runRunner([
    "--execute",
    "--sdk-mode",
    "fake-live",
    "--secret-file",
    goodSecretFile,
    "--operation",
    "storage-delete",
    "--run-id",
    "pkg-c-proof",
    "--accepted-dry-run-id",
    "pkg-c-proof-storage-delete",
    "--workspace-id",
    "workspace-proof",
  ]);
  const fakeStorageDeleteExecutionOut = parseStdout(fakeStorageDeleteExecution.stdout);
  reportPathsToCleanup.push(fakeStorageDeleteExecutionOut.reportPath);
  assert.equal(
    fakeStorageDeleteExecutionOut.reportPath.endsWith(".runtime/v22-cloud-lifecycle/pkg-c-proof-storage-delete-storage-execution.json"),
    true,
    "fake_storage_delete_execution_report_path",
  );
  assertExecutionSummaryShape(fakeStorageDeleteExecutionOut.summary, "fake_storage_delete_execution");
  assert.equal(fakeStorageDeleteExecutionOut.summary.execution.target, "storage_markers", "storage_delete_must_cover_create_and_expand_markers");

  const disabledLive = runRunner(["--execute", "--secret-file", disabledSecretFile, "--operation", "storage-create"], 1);
  assert.equal(parseStdout(disabledLive.stdout).summary.blockedReason, "mutation_run_gate_disabled", "disabled_execute_reason");

  const liveWithoutDryRun = runRunner(["--execute", "--secret-file", goodSecretFile, "--operation", "storage-create"], 1);
  assert.equal(parseStdout(liveWithoutDryRun.stdout).summary.blockedReason, "execute_requires_accepted_dry_run_id", "execute_without_dry_run_reason");

  const source = await readFile(runnerPath, "utf8");
  assert.match(source, /v20220501/, "runner_must_use_tke_20220501_for_native_node_pool");
  assert.match(source, /DescribeNodePools/, "runner_must_plan_native_node_pool_with_describe_nodepools");
  assert.match(source, /ScaleNodePool/, "runner_must_scale_native_node_pool_with_scale_node_pool");
  assert.match(source, /waitForNativeNodePoolReplicas/, "runner_must_wait_for_native_node_pool_replica_reconciliation");
  assert.match(source, /tencent_resource_lifecycle_tke_node_pool_replicas_not_reconciled/, "runner_must_fail_closed_when_native_node_pool_does_not_reconcile");
  assert.match(source, /latest\.readyReplicas === targetReplicas/, "runner_must_wait_for_ready_replicas_to_match_target_even_when_target_is_zero");
  assert.doesNotMatch(source, /\.ModifyNodePoolDesiredCapacityAboutAsg\(/, "runner_must_not_use_legacy_desired_capacity_for_native_node_pool");
  assert.equal(/(^|\n)\s*source\s+/.test(source), false, "runner_must_not_source_secret_file");
  assert.equal(source.includes("/home/dev/" + ".secrets"), false, "runner_must_not_hardcode_real_secret_path");
  assert.equal(/\.CreateClusterNodePool|\.DeleteClusterNodePool|\.deleteBucket|\.putBucket/.test(source), false, "runner_must_not_create_or_delete_cluster_node_pool_or_bucket");

  const suite = await readFile(suitePath, "utf8");
  assert(suite.includes("smoke-test-v22-tencent-authorized-resource-lifecycle-runner.mjs"), "mvp_suite_must_include_resource_lifecycle_runner_smoke");
} finally {
  await rm(tmpDir, { recursive: true, force: true });
  await Promise.all(reportPathsToCleanup.map((reportPath) => rm(reportPath, { force: true })));
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_authorized_resource_lifecycle_runner",
  checked: [
    "package_c_secret_allowlist_only",
    "readonly_secret_rejected",
    "check_config_no_report",
    "dry_run_reports_for_r06_r08_r11_r12_r19_r20",
    "fake_live_execute_reports_for_storage_compute_and_delete",
    "execute_fail_closed_without_run_gate_or_dry_run",
    "real_compute_execute_waits_for_native_node_pool_replicas",
    "redacted_stdout_and_runtime_reports",
    "mvp_suite_includes_smoke",
  ],
}, null, 2));
