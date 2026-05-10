import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseReadonlyInventorySecretFile } from "./v22-tencent-readonly-inventory-runner.mjs";

const runnerPath = "scripts/v22-tencent-readonly-inventory-runner.mjs";
const smokePath = "scripts/smoke-test-v22-tencent-readonly-inventory-live-runner.mjs";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";
const repoRoot = path.resolve(".");
const realSecretPathProof = ["/home/dev", ".secrets", "medopl", "secrets.env.txt"].join("/");

function assertNotContainsForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const forbidden = [
    "secret-id-proof",
    "secret-key-proof",
    "mutation-secret-proof",
    "github-token-proof",
    "token-proof",
    "kubeconfig-proof",
    "object-key-proof",
    "storage-key-proof",
    "cos-prefix-proof",
    "signed-url-proof",
    "raw-response-proof",
    "cos-object-body-proof",
  ];
  for (const phrase of forbidden) {
    assert.equal(serialized.includes(phrase), false, `${label}_must_not_contain:${phrase}`);
  }
  assert.equal(
    /SecretId|SecretKey|token|kubeconfig|objectKey|storageKey|cosPrefix|signedUrl|rawResponse|providerRawResponse|cosObjectBody|bucketPolicy/i.test(serialized),
    false,
    `${label}_must_not_contain_forbidden_key`,
  );
}

function assertReportWhitelist(report, label) {
  assert.deepEqual(Object.keys(report).sort(), [
    "accountMasked",
    "allowedApis",
    "auditQueueCounts",
    "blockedReason",
    "mode",
    "ok",
    "regions",
    "resourceCounts",
  ].sort(), `${label}_report_whitelist`);
  assertNotContainsForbidden(report, label);
}

function runRunner(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [runnerPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, expectedStatus, `runner_status:${args.join(" ")}`);
  assertNotContainsForbidden(result.stdout, `stdout:${args.join(" ")}`);
  assertNotContainsForbidden(result.stderr, `stderr:${args.join(" ")}`);
  return result;
}

function parseStdout(stdout) {
  return JSON.parse(stdout.trim());
}

async function writeSecretFixture(dir, name, content) {
  const file = path.join(dir, name);
  await writeFile(file, content, "utf8");
  return file;
}

const goodSecretText = [
  "RUN_TENCENT_READONLY_INVENTORY=1",
  "TENCENT_READONLY_SECRET_ID=secret-id-proof",
  "TENCENT_READONLY_SECRET_KEY=secret-key-proof",
  "TENCENT_READONLY_REGIONS=ap-guangzhou,ap-shanghai",
  "TENCENT_READONLY_ALLOWED_APIS=DescribeAccount,DescribeRegions,DescribeInstances,DescribeClusters,ListBuckets,HeadObject,DescribeBillSummary,DescribeTagResources",
  "TENCENT_READONLY_ACCOUNT_ID=tencent-account-1234567890",
].join("\n");

const parsed = parseReadonlyInventorySecretFile(goodSecretText);
assert.deepEqual(Object.keys(parsed).sort(), [
  "RUN_TENCENT_READONLY_INVENTORY",
  "TENCENT_READONLY_ACCOUNT_ID",
  "TENCENT_READONLY_ALLOWED_APIS",
  "TENCENT_READONLY_REGIONS",
  "TENCENT_READONLY_SECRET_ID",
  "TENCENT_READONLY_SECRET_KEY",
].sort(), "parser_must_only_return_allowlist_keys");
assert.equal(parsed.TENCENT_READONLY_SECRET_ID, "secret-id-proof", "parser_can_return_env_for_internal_validation_only");

assert.throws(
  () => parseReadonlyInventorySecretFile(`${goodSecretText}\nUNLISTED_SECRET_KEY=must-not-be-accepted`),
  /readonly_inventory_non_allowlist_secret_key_rejected:UNLISTED_SECRET_KEY/,
  "parser_must_reject_unknown_key",
);
assert.throws(
  () => parseReadonlyInventorySecretFile(`${goodSecretText}\nTENCENT_MUTATION_SECRET_KEY=mutation-secret-proof`),
  /readonly_inventory_forbidden_secret_key:TENCENT_MUTATION_SECRET_KEY/,
  "parser_must_reject_mutation_secret",
);

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-readonly-inventory-runner-"));
const reportPathsToCleanup = [];
try {
  const goodSecretFile = await writeSecretFixture(tmpDir, "readonly.env", goodSecretText);
  const disabledRunFile = await writeSecretFixture(tmpDir, "disabled.env", goodSecretText.replace("RUN_TENCENT_READONLY_INVENTORY=1", "RUN_TENCENT_READONLY_INVENTORY=0"));
  const unknownKeyFile = await writeSecretFixture(tmpDir, "unknown.env", `${goodSecretText}\nUNLISTED_SECRET_KEY=must-not-be-accepted`);
  const mutationSecretFile = await writeSecretFixture(tmpDir, "mutation-secret.env", `${goodSecretText}\nTENCENT_MUTATION_SECRET_ID=mutation-secret-proof`);
  const mutationApiFile = await writeSecretFixture(tmpDir, "mutation-api.env", goodSecretText.replace("DescribeAccount,DescribeRegions", "DescribeAccount,CreateInstances"));
  const emptyApisFile = await writeSecretFixture(tmpDir, "empty-apis.env", goodSecretText.replace(/TENCENT_READONLY_ALLOWED_APIS=.*/, "TENCENT_READONLY_ALLOWED_APIS="));

  const checkConfig = runRunner(["--check-config", "--secret-file", goodSecretFile, "--run-id", "check-config-proof"]);
  const checkConfigOut = parseStdout(checkConfig.stdout);
  assert.equal(checkConfigOut.reportPath, null, "check_config_must_not_write_report");
  assertReportWhitelist(checkConfigOut.summary, "check_config_summary");
  assert.equal(checkConfigOut.summary.mode, "check-config", "check_config_mode");
  assert.equal(checkConfigOut.summary.ok, true, "check_config_ok");
  assert.equal(checkConfigOut.summary.blockedReason, null, "check_config_not_blocked");

  const disabledCheckConfig = runRunner(["--check-config", "--secret-file", disabledRunFile, "--run-id", "disabled-check-config-proof"]);
  const disabledSummary = parseStdout(disabledCheckConfig.stdout).summary;
  assertReportWhitelist(disabledSummary, "disabled_check_config_summary");
  assert.equal(disabledSummary.ok, false, "disabled_check_config_safe_blocked");
  assert.equal(disabledSummary.blockedReason, "run_gate_disabled", "disabled_check_config_reason");

  runRunner(["--check-config", "--secret-file", unknownKeyFile], 1);
  runRunner(["--check-config", "--secret-file", mutationSecretFile], 1);
  runRunner(["--check-config", "--secret-file", mutationApiFile], 1);
  runRunner(["--check-config", "--secret-file", emptyApisFile], 1);

  const disabledLive = runRunner(["--live-readonly", "--secret-file", disabledRunFile], 1);
  const disabledLiveOut = parseStdout(disabledLive.stdout);
  assert.equal(disabledLiveOut.reportPath, null, "disabled_live_must_not_write_report");
  assert.equal(disabledLiveOut.summary.blockedReason, "live_readonly_requires_run_gate", "disabled_live_reason");

  const liveReadonly = runRunner(["--live-readonly", "--secret-file", goodSecretFile], 1);
  const liveReadonlyOut = parseStdout(liveReadonly.stdout);
  assert.equal(liveReadonlyOut.reportPath, null, "live_readonly_current_branch_must_not_write_report");
  assert.equal(liveReadonlyOut.summary.blockedReason, "live_readonly_requires_separate_authorization", "live_readonly_fail_closed_reason");

  const fakeLive = runRunner(["--fake-live", "--secret-file", goodSecretFile, "--run-id", "fake-live-proof"]);
  const fakeLiveOut = parseStdout(fakeLive.stdout);
  reportPathsToCleanup.push(fakeLiveOut.reportPath);
  assert(fakeLiveOut.reportPath.endsWith(".runtime/v22-tencent-readonly-inventory/fake-live-proof.json"), "fake_live_report_path");
  assertReportWhitelist(fakeLiveOut.summary, "fake_live_stdout_summary");
  assert.equal(fakeLiveOut.summary.mode, "fake-live", "fake_live_mode");
  assert.equal(fakeLiveOut.summary.ok, true, "fake_live_ok");
  assert.deepEqual(fakeLiveOut.summary.regions, ["ap-guangzhou", "ap-shanghai"], "fake_live_regions");
  assert.equal(fakeLiveOut.summary.resourceCounts.mapped > 0, true, "fake_live_mapped_resources");

  const reportText = await readFile(fakeLiveOut.reportPath, "utf8");
  const report = JSON.parse(reportText);
  assertReportWhitelist(report, "fake_live_report");
  assert.deepEqual(report, fakeLiveOut.summary, "stdout_summary_must_match_report");

  const gitDiff = spawnSync("git", ["diff", "--name-only"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(gitDiff.status, 0, "git_diff_name_only_status");
  assert.equal(gitDiff.stdout.includes(".runtime/"), false, "runtime_report_must_not_enter_git_diff");

  const source = await readFile(runnerPath, "utf8");
  assert.equal(/(^|\n)\s*source\s+/.test(source), false, "runner_must_not_source_secret_file");
  assert.equal(source.includes("process.env"), false, "runner_must_not_inject_into_process_env");
  assert.equal(source.includes(realSecretPathProof), false, "runner_must_not_read_real_secret_path");
  assert.equal(source.includes("tencentcloud-sdk-nodejs"), false, "runner_must_not_import_tencent_sdk");
  assert.equal(source.includes("@tencentcloud"), false, "runner_must_not_import_tencent_sdk_namespace");
  assert.equal(/\.Create|\.Delete|\.Modify|\.Run|\.Terminate|\.Put|\.Update|\.Attach|\.Detach/.test(source), false, "runner_must_not_call_mutation_api");

  const smoke = await readFile(smokePath, "utf8");
  assert.equal(smoke.includes(realSecretPathProof), false, "smoke_must_not_use_real_secret_path");

  const suite = await readFile(suitePath, "utf8");
  assert(suite.includes("smoke-test-v22-tencent-readonly-inventory-live-runner.mjs"), "mvp_suite_must_include_live_runner_smoke");
} finally {
  await rm(tmpDir, { recursive: true, force: true });
  await Promise.all(reportPathsToCleanup.map((reportPath) => rm(reportPath, { force: true })));
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_live_runner",
  checked: [
    "secret_file_parser_allowlist_only",
    "check_config_no_client_call",
    "source_style_forbidden",
    "non_allowlist_and_mutation_inputs_rejected",
    "run_gate_fail_closed",
    "fake_live_runtime_report_redacted",
    "runtime_report_ignored_by_git",
    "live_readonly_current_branch_fail_closed",
  ],
}, null, 2));
