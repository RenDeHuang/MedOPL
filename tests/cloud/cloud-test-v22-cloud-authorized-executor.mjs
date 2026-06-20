import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function runExecutor(args = [], env = {}) {
  return spawnSync(process.execPath, ["scripts/v22-cloud-authorized-executor.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function jsonFrom(result, label) {
  assert.equal(result.status, 0, `${label}_must_exit_zero:${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

const dryRun = jsonFrom(runExecutor(["--dry-run", "--json"]), "cloud_executor_dry_run");
assert.equal(dryRun.ok, true, "cloud_executor_dry_run_must_pass");
assert.equal(dryRun.kind, "v22_cloud_authorized_executor", "cloud_executor_kind");
assert.equal(dryRun.executionMode, "dry-run", "cloud_executor_must_default_dry_run");
assert.equal(dryRun.executesCloudCommands, false, "cloud_executor_dry_run_must_not_execute_cloud_commands");
assert.equal(dryRun.evidenceSink, ".runtime/v22-cloud-authorization/run-v22-001", "cloud_executor_evidence_sink_mismatch");
assert.deepEqual(dryRun.phases.map((phase) => phase.operationClass), [
  "readonly_inventory",
  "dry_run_plan",
  "tenant_runtime_provisioning",
  "storage_lifecycle",
  "billing_audit_writeback",
  "build_push",
  "kubectl",
  "deploy",
  "live_test",
], "cloud_executor_phase_order_mismatch");
for (const phase of dryRun.phases) {
  assert.equal(phase.status, "planned", `cloud_executor_dry_run_phase_status:${phase.operationClass}`);
  assert(phase.evidenceRef.startsWith(".runtime/v22-cloud-authorization/run-v22-001/"), `cloud_executor_phase_evidence_ref:${phase.operationClass}`);
  assert.equal(typeof phase.runnerId, "string", `cloud_executor_phase_runner_id_type:${phase.operationClass}`);
  assert.notEqual(phase.runnerId, "", `cloud_executor_phase_runner_id_missing:${phase.operationClass}`);
  assert(Array.isArray(phase.receiptTypes), `cloud_executor_phase_receipt_types_missing:${phase.operationClass}`);
}
assert.equal(
  new Set(dryRun.phases.map((phase) => phase.runnerId)).size,
  dryRun.phases.length,
  "cloud_executor_phase_runner_ids_must_be_unique",
);
assert.equal(
  existsSync(path.join(repoRoot, "tests/support/cloud-prework/cloud-authorized-readonly-executor.js")),
  true,
  "readonly_inventory_cloud_authorized_executor_adapter_must_exist",
);

const blocked = runExecutor(["--execute", "--operation", "does_not_exist", "--json"]);
assert.equal(blocked.status, 1, "cloud_executor_unknown_operation_must_fail_closed");
const blockedPayload = JSON.parse(blocked.stdout);
assert.equal(blockedPayload.ok, false, "cloud_executor_unknown_operation_payload_must_fail");
assert.equal(blockedPayload.blocker.type, "unknown_operation_class", "cloud_executor_unknown_operation_blocker");

const missingExecutor = runExecutor(["--execute", "--operation", "readonly_inventory", "--json"]);
assert.equal(missingExecutor.status, 1, "cloud_executor_execute_without_executor_must_fail_closed");
const missingExecutorPayload = JSON.parse(missingExecutor.stdout);
assert.equal(missingExecutorPayload.ok, false, "cloud_executor_missing_executor_payload_must_fail");
assert.equal(missingExecutorPayload.blocker.type, "cloud_command_executor_missing", "cloud_executor_missing_executor_blocker");

const tempDir = mkdtempSync(path.join(tmpdir(), "v22-cloud-executor-"));
const commandLog = path.join(tempDir, "commands.log");
const stubExecutor = path.join(tempDir, "cloud-stub.mjs");
const receiptStubExecutor = path.join(tempDir, "cloud-receipt-stub.mjs");
try {
  writeFileSync(stubExecutor, `import { appendFileSync } from "node:fs";\nconst logPath = ${JSON.stringify(commandLog)};\nexport default async function runCommand(command, context) { appendFileSync(logPath, \`\${context.operationClass}:\${context.runnerId}:\${command}\\n\`); return { command, ok: true, status: 0, summary: { operationClass: context.operationClass, runnerId: context.runnerId, repoRoot: Boolean(context.repoRoot), redacted: true } }; }\n`);
  writeFileSync(receiptStubExecutor, `export default async function runCommand(command, context) { for (const type of context.receiptTypes) context.writeReceipt(type, { summary: \`\${type} accepted by \${context.runnerId}\` }); return { command, ok: true, status: 0, summary: { operationClass: context.operationClass, receiptTypes: context.receiptTypes } }; }\n`);

  const single = jsonFrom(
    runExecutor(["--execute", "--operation", "readonly_inventory", "--json"], { V22_CLOUD_COMMAND_EXECUTOR: stubExecutor }),
    "cloud_executor_single_operation",
  );
  assert.equal(single.ok, true, "cloud_executor_single_operation_must_pass");
  assert.equal(single.executesCloudCommands, true, "cloud_executor_execute_must_execute_cloud_commands");
  assert.equal(single.phases.find((phase) => phase.operationClass === "readonly_inventory").status, "executed", "cloud_executor_single_phase_executed");
  assert.equal(single.phases.find((phase) => phase.operationClass === "readonly_inventory").runnerId, "tencent_readonly_inventory_runner", "cloud_executor_single_phase_runner_id");
  assert.equal(JSON.stringify(single).includes("SecretKey"), false, "cloud_executor_output_must_not_include_secret_key_marker");
  assert.equal(JSON.stringify(single).includes("provider_response"), false, "cloud_executor_output_must_not_include_provider_response_marker");

  const fullWithoutReceipts = runExecutor(["--execute", "--json"], { V22_CLOUD_COMMAND_EXECUTOR: stubExecutor });
  assert.equal(fullWithoutReceipts.status, 1, "cloud_executor_full_run_without_receipts_must_fail_closed");
  const fullWithoutReceiptsPayload = JSON.parse(fullWithoutReceipts.stdout);
  assert.equal(fullWithoutReceiptsPayload.ok, false, "cloud_executor_full_run_without_receipts_payload_must_fail");
  assert.equal(fullWithoutReceiptsPayload.receiptManifest.status, "blocked", "cloud_executor_full_run_without_receipts_manifest_must_block");
  assert(fullWithoutReceiptsPayload.receiptManifest.missingReceiptTypes.length > 0, "cloud_executor_full_run_without_receipts_must_report_missing_receipts");

  const full = jsonFrom(
    runExecutor(["--execute", "--json"], { V22_CLOUD_COMMAND_EXECUTOR: receiptStubExecutor }),
    "cloud_executor_full_run_with_receipts",
  );
  assert.equal(full.ok, true, "cloud_executor_full_run_with_receipts_must_pass");
  assert.equal(full.receiptManifest.status, "complete", "cloud_executor_full_run_receipt_manifest_must_be_complete");
  assert.equal(full.receiptManifest.path, ".runtime/v22-cloud-authorization/run-v22-001/receipt-manifest.json", "cloud_executor_receipt_manifest_path");
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, full.receiptManifest.path), "utf8"));
  assert.equal(manifest.kind, "medopl_production_receipt_manifest", "cloud_executor_manifest_kind");
  assert.equal(manifest.receipts.length, 7, "cloud_executor_manifest_must_have_7_receipts");
  assert.equal(JSON.stringify(manifest).includes("raw_cloud_payload"), false, "cloud_executor_manifest_must_not_embed_raw_payload");
  assert.equal(JSON.stringify(manifest).includes("provider_response"), false, "cloud_executor_manifest_must_not_embed_provider_response");
  assert.equal(JSON.stringify(manifest).includes("kubeconfig"), false, "cloud_executor_manifest_must_not_embed_kubeconfig");

  const scopedResult = runExecutor(["--execute", "--json"], { V22_CLOUD_COMMAND_EXECUTOR: stubExecutor });
  assert.equal(scopedResult.status, 1, "cloud_executor_replay_without_receipts_must_exit_one");
  const scoped = JSON.parse(scopedResult.stdout);
  assert.equal(scoped.ok, false, "cloud_executor_replay_without_receipts_must_still_fail");

  const readonlyEnvFile = path.join(tempDir, "readonly.env");
  const readonlySecretKeyName = ["TENCENT", "READONLY", "SECRET", "KEY"].join("_");
  const readonlySecretValue = ["readonly", "credential", "stub"].join("-");
  writeFileSync(readonlyEnvFile, [
    "RUN_TENCENT_READONLY_INVENTORY=1",
    "TENCENT_READONLY_SECRET_ID=readonly-secret-id",
    `${readonlySecretKeyName}=${readonlySecretValue}`,
    "TENCENT_READONLY_ACCOUNT_ID=123456789012",
    "TENCENT_READONLY_REGIONS=na-siliconvalley",
    "TENCENT_READONLY_ALLOWED_APIS=DescribeClusters,DescribeClusterNodePools,DescribeNodePools,GetCallerIdentity,DescribeBillSummary,HeadObject",
    "",
  ].join("\n"));
  const readonlyExecutor = "tests/support/cloud-prework/cloud-authorized-readonly-executor.js";
  const missingReadonlySecret = runExecutor(["--execute", "--operation", "readonly_inventory", "--json"], {
    V22_CLOUD_COMMAND_EXECUTOR: readonlyExecutor,
  });
  assert.equal(missingReadonlySecret.status, 1, "readonly_adapter_missing_secret_file_must_fail_closed");
  const missingReadonlyPayload = JSON.parse(missingReadonlySecret.stdout);
  assert.equal(missingReadonlyPayload.blocker.type, "cloud_authorized_command_failed", "readonly_adapter_missing_secret_blocker");

  const readonlyFake = jsonFrom(
    runExecutor(["--execute", "--operation", "readonly_inventory", "--json"], {
      V22_CLOUD_COMMAND_EXECUTOR: readonlyExecutor,
      V22_TENCENT_READONLY_SECRET_FILE: readonlyEnvFile,
      V22_TENCENT_READONLY_SDK_MODE: "fake-readonly",
    }),
    "readonly_adapter_fake_readonly",
  );
  const readonlyPhase = readonlyFake.phases.find((phase) => phase.operationClass === "readonly_inventory");
  assert.equal(readonlyPhase.status, "executed", "readonly_adapter_phase_must_execute");
  assert.equal(readonlyPhase.results.every((result) => result.ok), true, "readonly_adapter_commands_must_pass");
  assert.equal(JSON.stringify(readonlyFake).includes(readonlySecretValue), false, "readonly_adapter_output_must_redact_secret_value");
  assert.equal(JSON.stringify(readonlyFake).includes("rawResponse"), false, "readonly_adapter_output_must_not_embed_raw_response");
  assert(readonlyPhase.results[0].summary.reportPath, "readonly_adapter_summary_must_include_report_pointer");
} finally {
  rmSync(path.join(repoRoot, ".runtime/v22-cloud-authorization/run-v22-001"), { recursive: true, force: true });
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_authorized_executor",
}, null, 2));
