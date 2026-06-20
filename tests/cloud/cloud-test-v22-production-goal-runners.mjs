import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const runner = "tests/support/cloud-prework/production-goal-runners.mjs";

function run(args = [], env = {}) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function parseJson(result, label) {
  assert.equal(result.status, 0, `${label}_must_exit_zero:${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function assertNoSensitiveText(text = "", label = "output") {
  for (const forbidden of [
    "mutation-secret-key",
    "tcr-secret-test",
    "postgres://ledger.example.invalid",
    "kubeconfig-raw-content",
    "SecretId",
    "SecretKey",
    "rawResponse",
    "provider_response",
    "Authorization:",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const tempDir = mkdtempSync(path.join(tmpdir(), "v22-production-goal-runners-"));
try {
  const commandLog = path.join(tempDir, "commands.log");
  const command = `${process.execPath} -e "const fs=require('fs'); fs.appendFileSync(process.env.TEST_COMMAND_LOG, process.env.V22_GOAL_OPERATION_CLASS + ':' + process.env.V22_GOAL_RUNNER_ID + ':' + process.env.V22_GOAL_INPUTS + '\\n'); console.log(JSON.stringify({ ok: true, summary: { evidenceRef: process.env.V22_GOAL_EVIDENCE_REF, raw: 'mutation-secret-key postgres://ledger.example.invalid rawResponse' } }))"`;
  const failCommand = `${process.execPath} -e "console.error('mutation-secret-key failed'); process.exit(9)"`;
  const malformedCommand = `${process.execPath} -e "process.stdout.write('{not json')"`; 
  const runtimePlan = path.join(tempDir, "runtime-plan.json");
  const storagePlan = path.join(tempDir, "storage-plan.json");
  const deployPlan = path.join(tempDir, "deploy-plan.json");
  const receiptFile = path.join(tempDir, "billing-audit-request.json");
  const manifestDir = path.join(tempDir, "manifests");
  const buildContext = path.join(tempDir, "build-context");
  mkdirSync(manifestDir);
  mkdirSync(buildContext);
  writeFileSync(runtimePlan, JSON.stringify({ runtimePlan: "starter" }));
  writeFileSync(storagePlan, JSON.stringify({ storagePlan: "workspace" }));
  writeFileSync(deployPlan, JSON.stringify({ deployPlan: "production-canary" }));
  writeFileSync(receiptFile, JSON.stringify({ receiptRequest: "billing-audit" }));

  const baseEnv = {
    TEST_COMMAND_LOG: commandLog,
    TENCENT_MUTATION_SECRET_KEY: "mutation-secret-key",
    TCR_SECRET: "tcr-secret-test",
    DATABASE_URL: "postgres://ledger.example.invalid/db",
    V22_GOAL_AUTHORIZATION: JSON.stringify({ pack: "contracts/medopl-cloud-authorization-pack.json", runId: "run-v22-001" }),
    V22_GOAL_EVIDENCE_REF: ".runtime/v22-cloud-authorization/run-v22-001/test.json",
  };

  const missingCommand = run(["--operation", "storage_lifecycle"], {
    ...baseEnv,
    V22_GOAL_RECEIPT_TYPES: JSON.stringify(["storage_owner_receipt", "release_owner_receipt"]),
    V22_GOAL_INPUTS: JSON.stringify({ operationClass: "storage_lifecycle", planFile: storagePlan, secretFile: "TENCENT_MUTATION_SECRET_FILE" }),
  });
  assert.notEqual(missingCommand.status, 0, "runner_must_fail_closed_without_command");
  assert(missingCommand.stderr.includes("production_goal_runner_command_missing"), "missing_command_reason");
  assertNoSensitiveText(missingCommand.stdout + missingCommand.stderr, "missing_command");

  const unsupported = run(["--operation", "unknown_operation"], baseEnv);
  assert.notEqual(unsupported.status, 0, "runner_must_reject_unknown_operation");
  assert(unsupported.stderr.includes("production_goal_runner_operation_unsupported"), "unsupported_reason");

  const malformed = run(["--operation", "storage_lifecycle"], {
    ...baseEnv,
    V22_PRODUCTION_GOAL_COMMAND: malformedCommand,
    V22_GOAL_RECEIPT_TYPES: JSON.stringify(["storage_owner_receipt", "release_owner_receipt"]),
    V22_GOAL_INPUTS: JSON.stringify({ operationClass: "storage_lifecycle", planFile: storagePlan, secretFile: "TENCENT_MUTATION_SECRET_FILE" }),
  });
  assert.notEqual(malformed.status, 0, "runner_must_fail_closed_on_malformed_command_output");
  assert(malformed.stderr.includes("production_goal_runner_command_output_not_json"), "malformed_reason");

  const failed = run(["--operation", "storage_lifecycle"], {
    ...baseEnv,
    V22_PRODUCTION_GOAL_COMMAND: failCommand,
    V22_GOAL_RECEIPT_TYPES: JSON.stringify(["storage_owner_receipt", "release_owner_receipt"]),
    V22_GOAL_INPUTS: JSON.stringify({ operationClass: "storage_lifecycle", planFile: storagePlan, secretFile: "TENCENT_MUTATION_SECRET_FILE" }),
  });
  assert.notEqual(failed.status, 0, "runner_must_fail_closed_when_command_fails");
  assert(failed.stderr.includes("production_goal_runner_command_failed"), "failed_reason");
  assertNoSensitiveText(failed.stdout + failed.stderr, "failed_command");

  const storage = parseJson(run(["--operation", "storage_lifecycle"], {
    ...baseEnv,
    V22_PRODUCTION_GOAL_COMMAND: command,
    V22_GOAL_RUNNER_ID: "tencent_cos_workspace_storage_runner",
    V22_GOAL_RECEIPT_TYPES: JSON.stringify(["storage_owner_receipt", "release_owner_receipt"]),
    V22_GOAL_INPUTS: JSON.stringify({ operationClass: "storage_lifecycle", planFile: storagePlan, secretFile: "TENCENT_MUTATION_SECRET_FILE" }),
  }), "storage_runner");
  assert.equal(storage.ok, true, "storage_runner_ok");
  assert.equal(storage.summary.operationClass, "storage_lifecycle", "storage_runner_operation");
  assert.equal(storage.summary.productionComplete, false, "single_runner_must_not_claim_production_complete");
  assert.equal(storage.summary.externalCommandExecuted, true, "storage_runner_command_executed");
  assert.deepEqual(storage.summary.inputKeys, ["operationClass", "planFile", "secretFile"], "storage_input_keys");
  assert.equal(storage.receipts.length, 2, "storage_receipt_count");
  assert.deepEqual(storage.receipts.map((receipt) => receipt.type), ["storage_owner_receipt", "release_owner_receipt"], "storage_receipt_types");
  assert(storage.receipts.every((receipt) => receipt.status === "accepted"), "storage_receipts_must_be_accepted");
  assertNoSensitiveText(JSON.stringify(storage), "storage_output");

  const runtime = parseJson(run(["--operation", "tenant_runtime_provisioning"], {
    ...baseEnv,
    V22_PRODUCTION_GOAL_COMMAND: command,
    V22_GOAL_RUNNER_ID: "tencent_tke_runtime_provisioning_runner",
    V22_GOAL_RECEIPT_TYPES: JSON.stringify(["runtime_owner_receipt"]),
    V22_GOAL_INPUTS: JSON.stringify({ operationClass: "tenant_runtime_provisioning", planFile: runtimePlan, secretFile: "TENCENT_MUTATION_SECRET_FILE" }),
  }), "runtime_runner");
  assert.deepEqual(runtime.summary.inputKeys, ["operationClass", "planFile", "secretFile"], "runtime_input_keys");
  assert.deepEqual(runtime.receipts.map((receipt) => receipt.type), ["runtime_owner_receipt"], "runtime_receipt_type");

  const billing = parseJson(run(["--operation", "billing_audit_writeback"], {
    ...baseEnv,
    V22_PRODUCTION_GOAL_COMMAND: command,
    V22_GOAL_RUNNER_ID: "medopl_billing_audit_receipt_writer",
    V22_GOAL_RECEIPT_TYPES: JSON.stringify(["billing_owner_receipt", "audit_owner_receipt"]),
    V22_GOAL_INPUTS: JSON.stringify({ operationClass: "billing_audit_writeback", receiptFile, databaseUrlRef: "DATABASE_URL" }),
  }), "billing_runner");
  assert.deepEqual(billing.summary.inputKeys, ["databaseUrlRef", "operationClass", "receiptFile"], "billing_input_keys");
  assert.deepEqual(billing.receipts.map((receipt) => receipt.type), ["billing_owner_receipt", "audit_owner_receipt"], "billing_receipt_types");

  const buildPush = parseJson(run(["--operation", "build_push"], {
    ...baseEnv,
    V22_PRODUCTION_GOAL_COMMAND: command,
    V22_GOAL_RUNNER_ID: "container_registry_build_push_runner",
    V22_GOAL_RECEIPT_TYPES: JSON.stringify([]),
    V22_GOAL_INPUTS: JSON.stringify({ operationClass: "build_push", buildContext, imageRef: "registry.example.test/medopl/app:test", registryCredentialRef: "TCR_ID:TCR_SECRET" }),
  }), "build_push_runner");
  assert.deepEqual(buildPush.summary.inputKeys, ["buildContext", "imageRef", "operationClass", "registryCredentialRef"], "build_push_input_keys");
  assert.equal(buildPush.receipts.length, 0, "build_push_has_no_receipts");

  const kubectl = parseJson(run(["--operation", "kubectl"], {
    ...baseEnv,
    V22_PRODUCTION_GOAL_COMMAND: command,
    V22_GOAL_RUNNER_ID: "kubernetes_apply_runner",
    V22_GOAL_RECEIPT_TYPES: JSON.stringify([]),
    V22_GOAL_INPUTS: JSON.stringify({ operationClass: "kubectl", kubeconfigRef: "TENCENT_DEPLOY_KUBECONFIG_REF", kubernetesManifestDir: manifestDir }),
  }), "kubectl_runner");
  assert.deepEqual(kubectl.summary.inputKeys, ["kubeconfigRef", "kubernetesManifestDir", "operationClass"], "kubectl_input_keys");

  const deploy = parseJson(run(["--operation", "deploy"], {
    ...baseEnv,
    V22_PRODUCTION_GOAL_COMMAND: command,
    V22_GOAL_RUNNER_ID: "medopl_production_canary_deploy_runner",
    V22_GOAL_RECEIPT_TYPES: JSON.stringify(["production_deploy_receipt"]),
    V22_GOAL_INPUTS: JSON.stringify({ operationClass: "deploy", deployPlanFile: deployPlan, kubeconfigRef: "TENCENT_DEPLOY_KUBECONFIG_REF" }),
  }), "deploy_runner");
  assert.deepEqual(deploy.summary.inputKeys, ["deployPlanFile", "kubeconfigRef", "operationClass"], "deploy_input_keys");
  assert.deepEqual(deploy.receipts.map((receipt) => receipt.type), ["production_deploy_receipt"], "deploy_receipt_type");

  const live = parseJson(run(["--operation", "live_test"], {
    ...baseEnv,
    V22_PRODUCTION_GOAL_COMMAND: command,
    V22_GOAL_RUNNER_ID: "opl_webui_runtime_gate_live_test_runner",
    V22_GOAL_RECEIPT_TYPES: JSON.stringify(["opl_webui_consumer_receipt"]),
    V22_GOAL_INPUTS: JSON.stringify({ operationClass: "live_test", oplWebuiConsumerCanaryUrl: "https://opl.medopl.cn", medoplPublicBaseUrl: "https://medopl.medopl.cn" }),
  }), "live_runner");
  assert.deepEqual(live.summary.inputKeys, ["medoplPublicBaseUrl", "operationClass", "oplWebuiConsumerCanaryUrl"], "live_input_keys");
  assert.deepEqual(live.receipts.map((receipt) => receipt.type), ["opl_webui_consumer_receipt"], "live_receipt_type");

  const log = readFileSync(commandLog, "utf8");
  assert(log.includes("storage_lifecycle:tencent_cos_workspace_storage_runner"), "command_log_storage");
  assert(log.includes("tenant_runtime_provisioning:tencent_tke_runtime_provisioning_runner"), "command_log_runtime");
  assertNoSensitiveText(log, "command_log");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_production_goal_runners",
}, null, 2));
