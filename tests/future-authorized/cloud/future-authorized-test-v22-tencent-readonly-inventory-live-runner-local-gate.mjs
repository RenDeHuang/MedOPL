import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const runner = "scripts/v22-tencent-readonly-inventory-runner.mjs";

function run(args = []) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function assertNoSensitiveOutput(text = "", label = "output") {
  for (const forbidden of [
    "secret-id-proof",
    "secret-key-proof",
    "TENCENT_READONLY_SECRET_ID=secret-id-proof",
    "TENCENT_READONLY_SECRET_KEY=secret-key-proof",
    "rawResponse",
    "headers",
    "Authorization:",
    "authorization:",
    "signedUrl",
    "objectKey",
    "storageKey",
    "cosPrefix",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "v22-readonly-runner-"));
try {
  const envFile = path.join(tmp, "readonly.env");
  const reportDir = path.join(tmp, "reports");
  await writeFile(envFile, [
    "RUN_TENCENT_READONLY_INVENTORY=1",
    "TENCENT_READONLY_SECRET_ID=secret-id-proof",
    "TENCENT_READONLY_SECRET_KEY=secret-key-proof",
    "TENCENT_READONLY_ACCOUNT_ID=100000000001",
    "TENCENT_READONLY_REGIONS=na-siliconvalley,ap-guangzhou",
    "TENCENT_READONLY_ALLOWED_APIS=Describe*,List*,Get*,Head*",
  ].join("\n"));

  const unauthorized = run(["--secret-file", envFile, "--report-dir", reportDir]);
  assert.notEqual(unauthorized.status, 0, "runner_must_fail_without_live_authorization_flags");
  assert(unauthorized.stderr.includes("readonly_live_authorization_required"), "unauthorized_failure_reason");
  assertNoSensitiveOutput(unauthorized.stdout + unauthorized.stderr, "unauthorized_output");

  const forbiddenSecretFile = path.join(tmp, "forbidden.env");
  await writeFile(forbiddenSecretFile, [
    "RUN_TENCENT_READONLY_INVENTORY=1",
    "TENCENT_READONLY_SECRET_ID=secret-id-proof",
    "TENCENT_READONLY_SECRET_KEY=secret-key-proof",
    "TENCENT_READONLY_ACCOUNT_ID=100000000001",
    "TENCENT_READONLY_REGIONS=na-siliconvalley",
    "TENCENT_READONLY_ALLOWED_APIS=Describe*",
    "TENCENT_MUTATION_SECRET_ID=must-not-read",
  ].join("\n"));
  const forbiddenSecret = run([
    "--live-readonly",
    "--confirm-current-session-authorization",
    "--sdk-mode",
    "fake-readonly",
    "--secret-file",
    forbiddenSecretFile,
    "--report-dir",
    reportDir,
  ]);
  assert.notEqual(forbiddenSecret.status, 0, "runner_must_reject_non_allowlist_secret_key");
  assert(forbiddenSecret.stderr.includes("readonly_secret_file_contains_forbidden_key:TENCENT_MUTATION_SECRET_ID"), "forbidden_secret_reason");
  assertNoSensitiveOutput(forbiddenSecret.stdout + forbiddenSecret.stderr, "forbidden_secret_output");

  const mutationVerbFile = path.join(tmp, "mutation-verb.env");
  await writeFile(mutationVerbFile, [
    "RUN_TENCENT_READONLY_INVENTORY=1",
    "TENCENT_READONLY_SECRET_ID=secret-id-proof",
    "TENCENT_READONLY_SECRET_KEY=secret-key-proof",
    "TENCENT_READONLY_ACCOUNT_ID=100000000001",
    "TENCENT_READONLY_REGIONS=na-siliconvalley",
    "TENCENT_READONLY_ALLOWED_APIS=DescribeInstances,CreateCluster",
  ].join("\n"));
  const mutationVerb = run([
    "--live-readonly",
    "--confirm-current-session-authorization",
    "--sdk-mode",
    "fake-readonly",
    "--secret-file",
    mutationVerbFile,
    "--report-dir",
    reportDir,
  ]);
  assert.notEqual(mutationVerb.status, 0, "runner_must_reject_mutation_api_allowlist");
  assert(mutationVerb.stderr.includes("readonly_allowed_api_contains_forbidden_verb:CreateCluster"), "mutation_verb_reason");

  const officialWithoutLoader = run([
    "--live-readonly",
    "--confirm-current-session-authorization",
    "--sdk-mode",
    "tencent-official-sdk-readonly",
    "--secret-file",
    envFile,
    "--report-dir",
    reportDir,
  ]);
  assert.notEqual(officialWithoutLoader.status, 0, "official_sdk_mode_must_fail_without_explicit_loader_enable");
  assert(
    officialWithoutLoader.stderr.includes("readonly_official_sdk_loader_explicit_enable_required"),
    "official_loader_gate_reason",
  );
  assertNoSensitiveOutput(officialWithoutLoader.stdout + officialWithoutLoader.stderr, "official_without_loader_output");

  const accepted = run([
    "--live-readonly",
    "--confirm-current-session-authorization",
    "--sdk-mode",
    "fake-readonly",
    "--secret-file",
    envFile,
    "--report-dir",
    reportDir,
    "--run-id",
    "local-gate",
  ]);
  assert.equal(accepted.status, 0, `runner_should_pass_fake_readonly:${accepted.stderr}`);
  const summary = JSON.parse(accepted.stdout);
  assert.equal(summary.ok, true, "summary_ok");
  assert.equal(summary.liveReadonly, true, "summary_live_readonly");
  assert.equal(summary.sdkMode, "fake-readonly", "summary_sdk_mode");
  assert.equal(summary.reportPath.endsWith("local-gate.json"), true, "summary_report_path");
  assert.equal(summary.callsMutationApi, false, "summary_no_mutation");
  assert.equal(summary.readsCosObjectBody, false, "summary_no_cos_body");
  assertNoSensitiveOutput(accepted.stdout + accepted.stderr, "accepted_output");

  const report = JSON.parse(await readFile(summary.reportPath, "utf8"));
  assert.equal(report.ok, true, "report_ok");
  assert.deepEqual(report.regions, ["na-siliconvalley", "ap-guangzhou"], "report_regions");
  assert.equal(report.accountMasked, "1000...0001", "account_masked");
  assert.equal(report.credentials.secretId, "redacted", "report_secret_id_redacted");
  assert.equal(report.credentials.secretKey, "redacted", "report_secret_key_redacted");
  assert.equal(report.boundary.callsMutationApi, false, "report_no_mutation");
  assert.equal(report.boundary.readsCosObjectBody, false, "report_no_cos_body");
  assert.equal(report.resources.some((item) => item.resourceType === "tkeClusterSummary"), true, "report_has_tke_summary");
  assert.equal(report.resources.some((item) => item.resourceType === "cosStorageSummary"), true, "report_has_cos_summary");
  assertNoSensitiveOutput(JSON.stringify(report), "report");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_live_runner_local_gate",
  runner,
}, null, 2));
