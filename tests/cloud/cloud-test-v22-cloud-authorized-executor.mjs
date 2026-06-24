import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const expectedOperations = Object.freeze([
  "readonly_inventory",
  "dry_run_plan",
  "tenant_runtime_provisioning",
  "storage_lifecycle",
  "billing_audit_writeback",
  "build_push",
  "kubectl",
  "deploy",
  "live_test",
]);

function runExecutor(args = [], env = {}) {
  const inheritedEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !(
    key.startsWith("V22_")
    || key.startsWith("TENCENT_")
    || key.startsWith("RUN_TENCENT_")
    || key.startsWith("MEDOPL_")
    || key.startsWith("OPL_")
    || key.startsWith("TCR_")
    || key === "DATABASE_URL"
    || key === "KUBECONFIG"
  )));
  return spawnSync(process.execPath, ["scripts/v22-cloud-authorized-executor.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...inheritedEnv,
      ...env,
    },
  });
}

function jsonFrom(result, label) {
  assert.equal(result.status, 0, `${label}_must_exit_zero:${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function failingJsonFrom(result, label) {
  assert.notEqual(result.status, 0, `${label}_must_fail_closed`);
  return JSON.parse(result.stdout);
}

const dryRun = jsonFrom(runExecutor(["--dry-run", "--json"]), "cloud_executor_dry_run");
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const authPack = JSON.parse(readFileSync(path.join(repoRoot, "contracts/medopl-cloud-authorization-pack.json"), "utf8"));
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
assert.equal(
  existsSync(path.join(repoRoot, "tests/support/cloud-prework/cloud-authorized-production-goal-executor.js")),
  true,
  "production_goal_cloud_authorized_executor_adapter_must_exist",
);
assert.equal(
  packageJson.scripts?.["cloud:goal"],
  "V22_CLOUD_COMMAND_EXECUTOR=tests/support/cloud-prework/cloud-authorized-production-goal-executor.js node scripts/v22-cloud-authorized-executor.mjs --execute --json",
  "root_package_must_expose_single_cloud_goal_entrypoint",
);
for (const scriptName of Object.keys(packageJson.scripts || {}).filter((name) => name.startsWith("cloud:goal:") && name !== "cloud:goal:preflight")) {
  assert.fail(`root_package_must_not_keep_horizontal_cloud_goal_entrypoint:${scriptName}`);
}
const mappedGoalScripts = new Map((authPack.active_pack.operation_class_command_map || []).map((entry) => [entry.operation_class, entry]));
for (const operationClass of expectedOperations) {
  const mapping = mappedGoalScripts.get(operationClass);
  assert(mapping, `cloud_authorization_pack_goal_mapping_missing:${operationClass}`);
  assert.equal(mapping.package_script, "cloud:goal", `cloud_authorization_pack_goal_package_script_mismatch:${operationClass}`);
  assert.deepEqual(mapping.commands, [`npm run cloud:goal -- --operation ${operationClass}`], `cloud_authorization_pack_goal_command_mismatch:${operationClass}`);
}
assert.equal(
  authPack.active_pack.operation_class_command_map.some((entry) => JSON.stringify(entry).includes("test:cloud-future-authorized")),
  false,
  "cloud_authorization_pack_goal_mapping_must_not_use_future_authorized_test_lane",
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
const testRunId = `test-run-${process.pid}`;
const testEvidenceSink = `.runtime/v22-cloud-authorization/${testRunId}`;
const stubExecutor = path.join(tempDir, "cloud-stub.mjs");
const receiptStubExecutor = path.join(tempDir, "cloud-receipt-stub.mjs");
const unauthorizedReceiptExecutor = path.join(tempDir, "cloud-unauthorized-receipt-stub.mjs");
  const rejectedContextReceiptExecutor = path.join(tempDir, "cloud-rejected-context-receipt-stub.mjs");
  const rejectedReceiptStatusExecutor = path.join(tempDir, "cloud-rejected-receipt-status-stub.mjs");
  const rawReceiptSummaryExecutor = path.join(tempDir, "cloud-raw-receipt-summary-stub.mjs");
  const failingExternalRunner = path.join(tempDir, "failing-external-runner.mjs");
try {
  writeFileSync(stubExecutor, `import { appendFileSync } from "node:fs";\nconst logPath = ${JSON.stringify(commandLog)};\nexport default async function runCommand(command, context) { appendFileSync(logPath, \`\${context.operationClass}:\${context.runnerId}:\${command}\\n\`); return { command, ok: true, status: 0, summary: { operationClass: context.operationClass, runnerId: context.runnerId, repoRoot: Boolean(context.repoRoot), redacted: true } }; }\n`);
  writeFileSync(receiptStubExecutor, `export default async function runCommand(command, context) { for (const type of context.receiptTypes) context.writeReceipt(type, { summary: \`\${type} accepted by \${context.runnerId}\` }); return { command, ok: true, status: 0, summary: { operationClass: context.operationClass, receiptTypes: context.receiptTypes } }; }\n`);
  writeFileSync(unauthorizedReceiptExecutor, `export default async function runCommand(command, context) { context.writeReceipt("production_deploy_receipt", { summary: "unauthorized deploy receipt" }); return { command, ok: true, status: 0, summary: { operationClass: context.operationClass } }; }\n`);
  writeFileSync(rejectedContextReceiptExecutor, `export default async function runCommand(command, context) { for (const type of context.receiptTypes) context.writeReceipt(type, { status: "pending", summary: \`\${type} is pending\` }); return { command, ok: true, status: 0, summary: { operationClass: context.operationClass } }; }\n`);
  writeFileSync(rejectedReceiptStatusExecutor, [
    "const receiptTypes = JSON.parse(process.env.V22_GOAL_RECEIPT_TYPES || '[]');",
    "const receipts = receiptTypes.map((type) => ({ type, status: 'pending', summary: `${type} is not accepted yet` }));",
    "console.log(JSON.stringify({ ok: true, summary: { operationClass: process.env.V22_GOAL_OPERATION_CLASS }, receipts }));",
    "",
  ].join("\n"));
  writeFileSync(rawReceiptSummaryExecutor, [
    "const receiptTypes = JSON.parse(process.env.V22_GOAL_RECEIPT_TYPES || '[]');",
    "const rawSecret = process.env.TENCENT_MUTATION_SECRET_KEY || process.env.TCR_SECRET || 'raw-secret-value';",
    "const receipts = receiptTypes.map((type) => ({ type, status: 'accepted', summary: `${type} accepted with ${rawSecret}` }));",
    "console.log(JSON.stringify({ ok: true, summary: { operationClass: process.env.V22_GOAL_OPERATION_CLASS, rawSecret }, receipts }));",
    "",
  ].join("\n"));
  writeFileSync(failingExternalRunner, [
    "console.log(JSON.stringify({ ok: false, summary: { blocker: 'docker_unavailable', detail: process.env.TCR_SECRET || 'raw-secret-value' } }));",
    "console.error(`docker denied ${process.env.TCR_SECRET || 'raw-secret-value'}`);",
    "process.exit(7);",
    "",
  ].join("\n"));

  const readonlyEnvFile = path.join(tempDir, "readonly.env");
  const readonlySecretKeyName = ["TENCENT", "READONLY", "SECRET", "KEY"].join("_");
  const readonlySecretValue = ["readonly", "credential", "stub"].join("-");
  const readonlyExecutor = "tests/support/cloud-prework/cloud-authorized-readonly-executor.js";
  const productionGoalExecutor = "tests/support/cloud-prework/cloud-authorized-production-goal-executor.js";
  const mutationSecretFile = path.join(tempDir, "mutation.env");
  const runtimePlanFile = path.join(tempDir, "runtime-plan.json");
  const storagePlanFile = path.join(tempDir, "storage-plan.json");
  const billingAuditReceiptFile = path.join(tempDir, "billing-audit-request.json");
  const deployPlanFile = path.join(tempDir, "deploy-plan.json");
  const kubernetesManifestDir = path.join(tempDir, "k8s");
  const containerBuildContext = path.join(tempDir, "container-context");
  const receiptBackedRunner = path.join(tempDir, "receipt-backed-runner.mjs");
  mkdirSync(kubernetesManifestDir);
  mkdirSync(containerBuildContext);
  writeFileSync(readonlyEnvFile, [
    "RUN_TENCENT_READONLY_INVENTORY=1",
    "TENCENT_READONLY_SECRET_ID=readonly-secret-id",
    `${readonlySecretKeyName}=${readonlySecretValue}`,
    "TENCENT_READONLY_ACCOUNT_ID=123456789012",
    "TENCENT_READONLY_REGIONS=na-siliconvalley",
    "TENCENT_READONLY_ALLOWED_APIS=DescribeClusters,DescribeClusterNodePools,DescribeNodePools,GetCallerIdentity,DescribeBillSummary,HeadObject",
    "",
  ].join("\n"));
  writeFileSync(mutationSecretFile, [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
    "TENCENT_MUTATION_SECRET_ID=mutation-secret-id",
    "TENCENT_MUTATION_SECRET_KEY=mutation-secret-key",
    "",
  ].join("\n"));
  writeFileSync(runtimePlanFile, JSON.stringify({ runtimeBindingId: "runtime-binding-test" }));
  writeFileSync(storagePlanFile, JSON.stringify({ storageBindingId: "storage-binding-test" }));
  writeFileSync(billingAuditReceiptFile, JSON.stringify({ billingReceiptRequestId: "billing-audit-test" }));
  writeFileSync(deployPlanFile, JSON.stringify({ deployPlanId: "deploy-test" }));
  writeFileSync(receiptBackedRunner, [
    "const receiptTypes = JSON.parse(process.env.V22_GOAL_RECEIPT_TYPES || '[]');",
    "const operationClass = process.env.V22_GOAL_OPERATION_CLASS || '';",
    "const inputs = JSON.parse(process.env.V22_GOAL_INPUTS || '{}');",
    "const receipts = receiptTypes.map((type) => ({ type, status: 'accepted', summary: `${type} accepted by external runner for ${operationClass}` }));",
    "const databaseProof = operationClass === 'live_test' ? { databasePersistenceProof: true, databaseUrlRef: 'DATABASE_URL', workspaceRefHash: 'workspacehash1234', objectRefHashes: { artifactRef: 'artifacthash1234', fileRef: 'filehash1234', resourceBindingId: 'resourcehash1234', runRef: 'runhash1234' }, recordCounts: { businessAccounts: 1, creditEvents: 1, providerBindings: 1, launchProjections: 1, managedResources: 1, files: 1, runs: 1, artifacts: 1, auditEvents: 1 } } : undefined;",
    "console.log(JSON.stringify({ ok: true, summary: { operationClass, externalRunner: true, evidenceRefObserved: Boolean(process.env.V22_GOAL_EVIDENCE_REF), inputsObserved: Object.keys(inputs).length > 0, inputKeys: Object.keys(inputs).sort(), ...(databaseProof ? { databaseProof } : {}) }, receipts }));",
    "",
  ].join("\n"));

  const preflightMissing = jsonFrom(runExecutor(["--preflight", "--json"]), "cloud_executor_preflight_missing");
  assert.equal(preflightMissing.ok, true, "cloud_executor_preflight_must_exit_zero_even_when_blocked");
  assert.equal(preflightMissing.executionMode, "preflight", "cloud_executor_preflight_mode");
  assert.equal(preflightMissing.executesCloudCommands, false, "cloud_executor_preflight_must_not_execute_cloud_commands");
  assert.equal(preflightMissing.preflight.productionReady, false, "cloud_executor_preflight_missing_must_not_be_production_ready");
  assert(
    preflightMissing.preflight.phases.find((phase) => phase.operationClass === "readonly_inventory").missingEnv.includes("V22_TENCENT_READONLY_SECRET_FILE"),
    "cloud_executor_preflight_must_report_readonly_secret_file",
  );
  assert(
    preflightMissing.preflight.phases.find((phase) => phase.operationClass === "storage_lifecycle").missingEnv.includes("V22_TENCENT_MUTATION_SECRET_FILE"),
    "cloud_executor_preflight_must_report_storage_mutation_secret_file",
  );
  assert(
    preflightMissing.preflight.phases.find((phase) => phase.operationClass === "deploy").missingEnv.includes("TENCENT_DEPLOY_KUBECONFIG_REF"),
    "cloud_executor_preflight_must_report_deploy_kubeconfig_ref",
  );
  assert.equal(JSON.stringify(preflightMissing).includes("mutation-secret-key"), false, "cloud_executor_preflight_must_not_print_secret_values");

  const preflightReady = jsonFrom(runExecutor(["--preflight", "--json"], {
    V22_TENCENT_READONLY_SECRET_FILE: readonlyEnvFile,
    V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
    V22_TENCENT_RUNTIME_PLAN_FILE: runtimePlanFile,
    V22_TENCENT_RUNTIME_PROVISIONING_RUNNER: receiptBackedRunner,
    V22_TENCENT_STORAGE_PLAN_FILE: storagePlanFile,
    V22_TENCENT_STORAGE_LIFECYCLE_RUNNER: receiptBackedRunner,
    V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE: billingAuditReceiptFile,
    V22_MEDOPL_BILLING_AUDIT_WRITEBACK_RUNNER: receiptBackedRunner,
    DATABASE_URL: "postgres://example.invalid/redacted",
    V22_CONTAINER_BUILD_CONTEXT: containerBuildContext,
    V22_CONTAINER_IMAGE_REF: "registry.example.test/medopl/app:test",
    V22_CONTAINER_BUILD_PUSH_RUNNER: receiptBackedRunner,
    TCR_ID: "tcr-id-test",
    TCR_SECRET: "tcr-secret-test",
    TENCENT_DEPLOY_KUBECONFIG_REF: "kubeconfig-ref-test",
    V22_KUBERNETES_MANIFEST_DIR: kubernetesManifestDir,
    V22_KUBERNETES_APPLY_RUNNER: receiptBackedRunner,
    V22_MEDOPL_DEPLOY_PLAN_FILE: deployPlanFile,
    V22_MEDOPL_DEPLOY_RUNNER: receiptBackedRunner,
    V22_OPL_WEBUI_CONSUMER_CANARY_URL: "https://opl.example.test/canary",
    V22_MEDOPL_PUBLIC_BASE_URL: "https://medopl.example.test",
    V22_OPL_WEBUI_CONSUMER_CANARY_RUNNER: receiptBackedRunner,
  }), "cloud_executor_preflight_ready");
  assert.equal(preflightReady.preflight.productionReady, true, "cloud_executor_preflight_ready_must_be_production_ready");
  assert.equal(
    preflightReady.preflight.phases.every((phase) => phase.ready === true),
    true,
    "cloud_executor_preflight_all_phases_ready",
  );
  assert.equal(JSON.stringify(preflightReady).includes("tcr-secret-test"), false, "cloud_executor_preflight_must_redact_tcr_secret");
  assert.equal(JSON.stringify(preflightReady).includes("postgres://example.invalid"), false, "cloud_executor_preflight_must_redact_database_url");

  const scopedPreflightMissing = runExecutor(["--preflight", "--operation", "build_push", "--json"], {
    V22_CONTAINER_BUILD_CONTEXT: containerBuildContext,
    V22_CONTAINER_BUILD_PUSH_RUNNER: receiptBackedRunner,
    TCR_ID: "tcr-id-test",
    TCR_SECRET: "tcr-secret-test",
  });
  assert.equal(scopedPreflightMissing.status, 1, "cloud_executor_scoped_preflight_missing_must_fail_closed");
  const scopedPreflightMissingPayload = JSON.parse(scopedPreflightMissing.stdout);
  assert.equal(scopedPreflightMissingPayload.ok, false, "cloud_executor_scoped_preflight_missing_payload");
  assert.equal(scopedPreflightMissingPayload.blocker.type, "cloud_goal_preflight_not_ready", "cloud_executor_scoped_preflight_missing_blocker");
  assert.deepEqual(
    scopedPreflightMissingPayload.preflight.phases.map((phase) => phase.operationClass),
    ["build_push"],
    "cloud_executor_scoped_preflight_must_only_report_selected_operation",
  );
  assert(
    scopedPreflightMissingPayload.preflight.phases[0].missingEnv.includes("V22_CONTAINER_IMAGE_REF"),
    "cloud_executor_scoped_preflight_must_report_selected_missing_env",
  );

  const scopedPreflightReady = jsonFrom(runExecutor(["--preflight", "--operation", "build_push", "--json"], {
    V22_CONTAINER_BUILD_CONTEXT: containerBuildContext,
    V22_CONTAINER_IMAGE_REF: "registry.example.test/medopl/app:test",
    V22_CONTAINER_BUILD_PUSH_RUNNER: receiptBackedRunner,
    TCR_ID: "tcr-id-test",
    TCR_SECRET: "tcr-secret-test",
  }), "cloud_executor_scoped_preflight_ready");
  assert.equal(scopedPreflightReady.preflight.productionReady, true, "cloud_executor_scoped_preflight_ready_must_pass");
  assert.deepEqual(
    scopedPreflightReady.preflight.phases.map((phase) => phase.operationClass),
    ["build_push"],
    "cloud_executor_scoped_preflight_ready_phase_scope",
  );

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

  const fullWithoutReceipts = runExecutor(["--execute", "--json"], {
    V22_CLOUD_COMMAND_EXECUTOR: stubExecutor,
    V22_CLOUD_GOAL_RUN_ID: `${testRunId}-missing-receipts`,
  });
  assert.equal(fullWithoutReceipts.status, 1, "cloud_executor_full_run_without_receipts_must_fail_closed");
  const fullWithoutReceiptsPayload = JSON.parse(fullWithoutReceipts.stdout);
  assert.equal(fullWithoutReceiptsPayload.ok, false, "cloud_executor_full_run_without_receipts_payload_must_fail");
  assert.equal(fullWithoutReceiptsPayload.receiptManifest.status, "blocked", "cloud_executor_full_run_without_receipts_manifest_must_block");
  assert(fullWithoutReceiptsPayload.receiptManifest.missingReceiptTypes.length > 0, "cloud_executor_full_run_without_receipts_must_report_missing_receipts");

  const unauthorizedReceipt = runExecutor(["--execute", "--operation", "storage_lifecycle", "--json"], { V22_CLOUD_COMMAND_EXECUTOR: unauthorizedReceiptExecutor });
  assert.equal(unauthorizedReceipt.status, 1, "cloud_executor_unauthorized_receipt_must_fail_closed");
  const unauthorizedReceiptPayload = JSON.parse(unauthorizedReceipt.stdout);
  assert.equal(
    unauthorizedReceiptPayload.blocker.type,
    "cloud_authorized_executor_exception",
    "cloud_executor_unauthorized_receipt_blocker",
  );

  const rejectedContextReceipt = runExecutor(["--execute", "--operation", "storage_lifecycle", "--json"], {
    V22_CLOUD_COMMAND_EXECUTOR: rejectedContextReceiptExecutor,
  });
  assert.equal(rejectedContextReceipt.status, 1, "cloud_executor_context_receipt_status_must_fail_closed");
  const rejectedContextReceiptPayload = JSON.parse(rejectedContextReceipt.stdout);
  assert.equal(
    rejectedContextReceiptPayload.blocker.type,
    "cloud_authorized_executor_exception",
    "cloud_executor_context_receipt_status_blocker",
  );
  assert.equal(
    rejectedContextReceiptPayload.blocker.detail.includes("receipt_status_not_accepted"),
    true,
    "cloud_executor_context_receipt_status_detail",
  );

  const full = jsonFrom(
    runExecutor(["--execute", "--json"], { V22_CLOUD_COMMAND_EXECUTOR: receiptStubExecutor, V22_CLOUD_GOAL_RUN_ID: testRunId }),
    "cloud_executor_full_run_with_receipts",
  );
  assert.equal(full.ok, true, "cloud_executor_full_run_with_receipts_must_pass");
  assert.equal(full.receiptManifest.status, "complete", "cloud_executor_full_run_receipt_manifest_must_be_complete");
  assert.equal(full.receiptManifest.path, `${testEvidenceSink}/receipt-manifest.json`, "cloud_executor_receipt_manifest_path");
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, full.receiptManifest.path), "utf8"));
  assert.equal(manifest.kind, "medopl_production_receipt_manifest", "cloud_executor_manifest_kind");
  assert.equal(manifest.receipts.length, 7, "cloud_executor_manifest_must_have_7_receipts");
  assert.equal(JSON.stringify(manifest).includes("raw_cloud_payload"), false, "cloud_executor_manifest_must_not_embed_raw_payload");
  assert.equal(JSON.stringify(manifest).includes("provider_response"), false, "cloud_executor_manifest_must_not_embed_provider_response");
  assert.equal(JSON.stringify(manifest).includes("kubeconfig"), false, "cloud_executor_manifest_must_not_embed_kubeconfig");

  const scopedResult = runExecutor(["--execute", "--json"], {
    V22_CLOUD_COMMAND_EXECUTOR: stubExecutor,
    V22_CLOUD_GOAL_RUN_ID: `${testRunId}-replay-missing-receipts`,
  });
  assert.equal(scopedResult.status, 1, "cloud_executor_replay_without_receipts_must_exit_one");
  const scoped = JSON.parse(scopedResult.stdout);
  assert.equal(scoped.ok, false, "cloud_executor_replay_without_receipts_must_still_fail");

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
      V22_CLOUD_GOAL_RUN_ID: testRunId,
    }),
    "readonly_adapter_fake_readonly",
  );
  const readonlyPhase = readonlyFake.phases.find((phase) => phase.operationClass === "readonly_inventory");
  assert.equal(readonlyPhase.status, "executed", "readonly_adapter_phase_must_execute");
  assert.equal(readonlyPhase.results.every((result) => result.ok), true, "readonly_adapter_commands_must_pass");
  assert.equal(JSON.stringify(readonlyFake).includes(readonlySecretValue), false, "readonly_adapter_output_must_redact_secret_value");
  assert.equal(JSON.stringify(readonlyFake).includes("rawResponse"), false, "readonly_adapter_output_must_not_embed_raw_response");
  assert(readonlyPhase.results[0].summary.reportPath, "readonly_adapter_summary_must_include_report_pointer");
  const readonlyPhaseEvidence = JSON.parse(readFileSync(path.join(repoRoot, `${testEvidenceSink}/readonly_inventory.json`), "utf8"));
  assert.equal(readonlyPhaseEvidence.kind, "v22_cloud_authorized_phase_evidence", "readonly_phase_evidence_kind");
  assert.equal(
    readonlyPhaseEvidence.resultSummaries[0].reportPath,
    readonlyPhase.results[0].summary.reportPath,
    "readonly_phase_evidence_must_include_redacted_report_pointer",
  );

  const dryRunGoal = jsonFrom(
    runExecutor(["--execute", "--operation", "dry_run_plan", "--json"], {
      V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
    }),
    "production_goal_dry_run_plan",
  );
  const dryRunGoalPhase = dryRunGoal.phases.find((phase) => phase.operationClass === "dry_run_plan");
  assert.equal(dryRunGoalPhase.status, "executed", "production_goal_dry_run_phase_must_execute");
  assert.equal(dryRunGoalPhase.results[0].summary.realCloudCalls, false, "production_goal_dry_run_must_not_call_real_cloud");
  assert.equal(dryRunGoalPhase.results[0].summary.mutationExecuted, false, "production_goal_dry_run_must_not_mutate");
  assert(dryRunGoalPhase.results[0].summary.reportPaths.length >= 2, "production_goal_dry_run_must_write_plan_report_pointers");

  const storageMissingEnv = runExecutor(["--execute", "--operation", "storage_lifecycle", "--json"], {
    V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
  });
  assert.equal(storageMissingEnv.status, 1, "production_goal_storage_without_env_must_fail_closed");
  const storageMissingPayload = JSON.parse(storageMissingEnv.stdout);
  const storagePhase = storageMissingPayload.phases.find((phase) => phase.operationClass === "storage_lifecycle");
  assert.equal(storageMissingPayload.blocker.type, "cloud_authorized_command_failed", "production_goal_storage_missing_env_blocker");
  assert.equal(storagePhase.results[0].summary.blocker, "production_goal_required_env_missing", "production_goal_storage_missing_env_summary");
  assert.equal(JSON.stringify(storageMissingPayload).includes("TENCENT_MUTATION_SECRET_KEY="), false, "production_goal_missing_env_must_not_print_secret_assignment");

  const storageMissingRunner = runExecutor(["--execute", "--operation", "storage_lifecycle", "--json"], {
    V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
    V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
    V22_TENCENT_STORAGE_PLAN_FILE: storagePlanFile,
  });
  assert.equal(storageMissingRunner.status, 1, "production_goal_storage_without_runner_must_fail_closed");
  const storageMissingRunnerPayload = JSON.parse(storageMissingRunner.stdout);
  assert.equal(
    storageMissingRunnerPayload.phases.find((phase) => phase.operationClass === "storage_lifecycle").results[0].summary.blocker,
    "production_goal_live_runner_missing",
    "production_goal_storage_missing_runner_summary",
  );

  const storageLive = jsonFrom(
    runExecutor(["--execute", "--operation", "storage_lifecycle", "--json"], {
      V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
      V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
      V22_TENCENT_STORAGE_PLAN_FILE: storagePlanFile,
      V22_TENCENT_STORAGE_LIFECYCLE_RUNNER: receiptBackedRunner,
      V22_CLOUD_GOAL_RUN_ID: testRunId,
    }),
    "production_goal_storage_receipt_backed_runner",
  );
  const storageLivePhase = storageLive.phases.find((phase) => phase.operationClass === "storage_lifecycle");
  assert.equal(storageLivePhase.status, "executed", "production_goal_storage_phase_must_execute_with_runner");
  assert.equal(storageLivePhase.results[0].summary.receiptsWritten.length, 2, "production_goal_storage_must_write_two_receipts");
  assert.equal(storageLivePhase.results[0].summary.inputsObserved, true, "production_goal_storage_runner_must_receive_input_refs");
  assert.deepEqual(
    storageLivePhase.results[0].summary.inputKeys,
    ["operationClass", "planFile", "secretFile"],
    "production_goal_storage_input_refs_mismatch",
  );
  assert.equal(
    existsSync(path.join(repoRoot, `${testEvidenceSink}/storage_owner_receipt.json`)),
    true,
    "production_goal_storage_owner_receipt_pointer_must_exist",
  );
  assert.equal(
    existsSync(path.join(repoRoot, `${testEvidenceSink}/release_owner_receipt.json`)),
    true,
    "production_goal_release_owner_receipt_pointer_must_exist",
  );
  const storagePhaseEvidence = JSON.parse(readFileSync(path.join(repoRoot, `${testEvidenceSink}/storage_lifecycle.json`), "utf8"));
  assert.deepEqual(
    storagePhaseEvidence.receiptPointerRefs,
    [
      `${testEvidenceSink}/storage_owner_receipt.json`,
      `${testEvidenceSink}/release_owner_receipt.json`,
    ],
    "production_goal_storage_phase_evidence_must_include_receipt_pointer_refs",
  );

  const rejectedStorageReceipt = runExecutor(["--execute", "--operation", "storage_lifecycle", "--json"], {
    V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
    V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
    V22_TENCENT_STORAGE_PLAN_FILE: storagePlanFile,
    V22_TENCENT_STORAGE_LIFECYCLE_RUNNER: rejectedReceiptStatusExecutor,
  });
  assert.equal(rejectedStorageReceipt.status, 1, "production_goal_rejected_receipt_status_must_fail_closed");
  const rejectedStorageReceiptPayload = JSON.parse(rejectedStorageReceipt.stdout);
  assert.equal(
    rejectedStorageReceiptPayload.phases.find((phase) => phase.operationClass === "storage_lifecycle").results[0].summary.blocker,
    "production_goal_external_runner_receipt_not_accepted",
    "production_goal_rejected_receipt_status_blocker",
  );

  const rawStorageReceipt = jsonFrom(
    runExecutor(["--execute", "--operation", "storage_lifecycle", "--json"], {
      V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
      V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
      V22_TENCENT_STORAGE_PLAN_FILE: storagePlanFile,
      V22_TENCENT_STORAGE_LIFECYCLE_RUNNER: rawReceiptSummaryExecutor,
    }),
    "production_goal_raw_receipt_summary_runner",
  );
  const rawStorageReceiptPointer = readFileSync(path.join(repoRoot, `${testEvidenceSink}/storage_owner_receipt.json`), "utf8");
  assert.equal(JSON.stringify(rawStorageReceipt).includes("mutation-secret-key"), false, "production_goal_raw_receipt_output_must_redact_secret_value");
  assert.equal(rawStorageReceiptPointer.includes("mutation-secret-key"), false, "production_goal_owner_receipt_pointer_must_redact_secret_value");
  assert.equal(rawStorageReceiptPointer.includes("raw-secret-value"), false, "production_goal_owner_receipt_pointer_must_redact_generic_raw_secret_value");

  const runtimeLive = jsonFrom(
    runExecutor(["--execute", "--operation", "tenant_runtime_provisioning", "--json"], {
      V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
      V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
      V22_TENCENT_RUNTIME_PLAN_FILE: runtimePlanFile,
      V22_TENCENT_RUNTIME_PROVISIONING_RUNNER: receiptBackedRunner,
    }),
    "production_goal_runtime_receipt_backed_runner",
  );
  assert.equal(
    runtimeLive.phases.find((phase) => phase.operationClass === "tenant_runtime_provisioning").results[0].summary.receiptsWritten.includes("runtime_owner_receipt"),
    true,
    "production_goal_runtime_must_write_runtime_receipt",
  );
  assert.deepEqual(
    runtimeLive.phases.find((phase) => phase.operationClass === "tenant_runtime_provisioning").results[0].summary.inputKeys,
    ["operationClass", "planFile", "secretFile"],
    "production_goal_runtime_input_refs_mismatch",
  );

  const liveTest = jsonFrom(
    runExecutor(["--execute", "--operation", "live_test", "--json"], {
      V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
      V22_OPL_WEBUI_CONSUMER_CANARY_URL: "https://opl.example.test/canary",
      V22_MEDOPL_PUBLIC_BASE_URL: "https://medopl.example.test",
      V22_OPL_WEBUI_CONSUMER_CANARY_RUNNER: receiptBackedRunner,
      V22_CLOUD_GOAL_RUN_ID: testRunId,
    }),
    "production_goal_opl_webui_consumer_receipt_runner",
  );
  assert.equal(
    liveTest.phases.find((phase) => phase.operationClass === "live_test").results[0].summary.receiptsWritten.includes("opl_webui_consumer_receipt"),
    true,
    "production_goal_live_test_must_write_opl_webui_consumer_receipt",
  );
  assert.deepEqual(
    liveTest.phases.find((phase) => phase.operationClass === "live_test").results[0].summary.inputKeys,
    ["medoplPublicBaseUrl", "operationClass", "oplWebuiConsumerCanaryUrl"],
    "production_goal_live_test_input_refs_mismatch",
  );

  const deployLive = jsonFrom(
    runExecutor(["--execute", "--operation", "deploy", "--json"], {
      V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
      TENCENT_DEPLOY_KUBECONFIG_REF: "kubeconfig-ref-test",
      V22_MEDOPL_DEPLOY_PLAN_FILE: deployPlanFile,
      V22_MEDOPL_DEPLOY_RUNNER: receiptBackedRunner,
    }),
    "production_goal_deploy_receipt_runner",
  );
  assert.equal(
    deployLive.phases.find((phase) => phase.operationClass === "deploy").results[0].summary.receiptsWritten.includes("production_deploy_receipt"),
    true,
    "production_goal_deploy_must_write_production_deploy_receipt",
  );
  assert.deepEqual(
    deployLive.phases.find((phase) => phase.operationClass === "deploy").results[0].summary.inputKeys,
    ["deployPlanFile", "kubeconfigRef", "operationClass"],
    "production_goal_deploy_input_refs_mismatch",
  );

  const kubectlLive = jsonFrom(
    runExecutor(["--execute", "--operation", "kubectl", "--json"], {
      V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
      TENCENT_DEPLOY_KUBECONFIG_REF: "kubeconfig-ref-test",
      V22_KUBERNETES_MANIFEST_DIR: kubernetesManifestDir,
      V22_KUBERNETES_APPLY_RUNNER: receiptBackedRunner,
    }),
    "production_goal_kubectl_runner_without_receipts",
  );
  assert.equal(
    kubectlLive.phases.find((phase) => phase.operationClass === "kubectl").results[0].summary.externalRunner,
    true,
    "production_goal_kubectl_must_use_external_runner",
  );
  assert.deepEqual(
    kubectlLive.phases.find((phase) => phase.operationClass === "kubectl").results[0].summary.inputKeys,
    ["kubeconfigRef", "kubernetesManifestDir", "operationClass"],
    "production_goal_kubectl_input_refs_mismatch",
  );

  const buildPushLive = jsonFrom(
    runExecutor(["--execute", "--operation", "build_push", "--json"], {
      V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
      V22_CONTAINER_BUILD_CONTEXT: containerBuildContext,
      V22_CONTAINER_IMAGE_REF: "registry.example.test/medopl/app:test",
      TCR_ID: "tcr-id-test",
      TCR_SECRET: "tcr-secret-test",
      V22_CONTAINER_BUILD_PUSH_RUNNER: receiptBackedRunner,
    }),
    "production_goal_build_push_runner_without_receipts",
  );
  assert.equal(
    buildPushLive.phases.find((phase) => phase.operationClass === "build_push").results[0].summary.externalRunner,
    true,
    "production_goal_build_push_must_use_external_runner",
  );
  assert.deepEqual(
    buildPushLive.phases.find((phase) => phase.operationClass === "build_push").results[0].summary.inputKeys,
    ["buildContext", "imageRef", "operationClass", "registryCredentialRef"],
    "production_goal_build_push_input_refs_mismatch",
  );

  const failingBuildPush = runExecutor(["--execute", "--operation", "build_push", "--json"], {
    V22_CLOUD_COMMAND_EXECUTOR: productionGoalExecutor,
    V22_CONTAINER_BUILD_CONTEXT: containerBuildContext,
    V22_CONTAINER_IMAGE_REF: "registry.example.test/medopl/app:test",
    TCR_ID: "tcr-id-test",
    TCR_SECRET: "tcr-secret-test",
    V22_CONTAINER_BUILD_PUSH_RUNNER: failingExternalRunner,
  });
  assert.equal(failingBuildPush.status, 1, "production_goal_external_runner_failure_must_fail_closed");
  const failingBuildPushPayload = JSON.parse(failingBuildPush.stdout);
  const failingBuildPushSummary = failingBuildPushPayload.phases.find((phase) => phase.operationClass === "build_push").results[0].summary;
  assert.equal(failingBuildPushSummary.blocker, "production_goal_external_runner_failed", "external_runner_failure_blocker");
  assert.equal(failingBuildPushSummary.exitStatus, 7, "external_runner_failure_exit_status");
  assert(
    String(failingBuildPushSummary.stderrSummary || "").includes("docker denied"),
    "external_runner_failure_must_include_redacted_stderr_summary",
  );
  assert.equal(JSON.stringify(failingBuildPushSummary).includes("tcr-secret-test"), false, "external_runner_failure_must_redact_secret");

  const manifestOnly = failingJsonFrom(
    runExecutor(["--manifest-only", "--json"], { V22_CLOUD_GOAL_RUN_ID: testRunId }),
    "cloud_executor_manifest_only_from_existing_receipts",
  );
  assert.equal(manifestOnly.ok, false, "cloud_executor_manifest_only_must_fail_without_operational_stability_evidence");
  assert.equal(manifestOnly.receiptManifest.path, `${testEvidenceSink}/receipt-manifest.json`, "manifest_only_path");
  assert.equal(manifestOnly.receiptManifest.status, "blocked", "manifest_only_status_without_operational_stability_evidence");
  const manifestOnlyPayload = JSON.parse(readFileSync(path.join(repoRoot, manifestOnly.receiptManifest.path), "utf8"));
  assert.equal(JSON.stringify(manifestOnlyPayload).includes("raw-secret-value"), false, "manifest_only_must_not_copy_raw_secret_receipt_summary");
  assert.equal(manifestOnlyPayload.claim, "production_complete", "manifest_only_must_emit_production_complete_candidate_manifest");
  assert.equal(
    manifestOnlyPayload.production_complete_criteria.length,
    14,
    "manifest_only_must_emit_14_production_complete_criteria",
  );
  assert(
    manifestOnly.receiptManifest.blockers.includes("production_receipt_manifest_production_complete_criterion_not_accepted:soak_test_receipt"),
    "manifest_only_missing_soak_evidence_must_block",
  );
  assert(
    manifestOnly.receiptManifest.blockers.includes("production_receipt_manifest_production_complete_criterion_not_accepted:concurrency_pressure_receipt"),
    "manifest_only_missing_concurrency_evidence_must_block",
  );
  assert(
    manifestOnly.receiptManifest.blockers.includes("production_receipt_manifest_production_complete_criterion_not_accepted:rollback_drill_receipt"),
    "manifest_only_missing_rollback_drill_evidence_must_block",
  );
  assert(
    manifestOnly.receiptManifest.blockers.includes("production_receipt_manifest_production_complete_criterion_not_accepted:continuous_canary_monitoring_receipt"),
    "manifest_only_missing_continuous_canary_evidence_must_block",
  );
  assert(
    manifestOnly.receiptManifest.blockers.includes("production_receipt_manifest_production_complete_criterion_not_accepted:alerting_receipt"),
    "manifest_only_missing_alerting_evidence_must_block",
  );
  assert(
    manifestOnly.receiptManifest.blockers.includes("production_receipt_manifest_production_complete_criterion_not_accepted:final_release_decision_receipt"),
    "manifest_only_missing_final_release_decision_evidence_must_block",
  );
  const businessDbCriterion = manifestOnlyPayload.production_complete_criteria.find((criterion) => criterion.id === "business_db_persistence_receipt");
  assert(businessDbCriterion, "manifest_only_must_emit_business_db_persistence_criterion");
  assert.equal(businessDbCriterion.owner, "MedOPL Platform", "business_db_persistence_criterion_owner");
  assert.equal(
    businessDbCriterion.evidence_ref,
    `${testEvidenceSink}/live_test.json`,
    "business_db_persistence_criterion_must_point_to_live_test_evidence",
  );
  assert.equal(
    /^sha256:[a-f0-9]{64}$/u.test(businessDbCriterion.evidence_hash),
    true,
    "business_db_persistence_criterion_must_use_sha256_pointer_hash",
  );
  assert(
    businessDbCriterion.summary.includes("PostgreSQL business metadata persistence"),
    "business_db_persistence_criterion_summary_must_name_business_persistence",
  );
  assert.equal(
    JSON.stringify(businessDbCriterion).includes("workspaceId"),
    false,
    "business_db_persistence_criterion_must_not_embed_workspace_payload",
  );
  assert.equal(
    manifestOnly.receiptManifest.productionCompleteCandidateComplete,
    false,
    "manifest_only_must_not_pass_production_complete_candidate_without_operational_stability_evidence",
  );

  for (const id of [
    "soak_test_receipt",
    "concurrency_pressure_receipt",
    "rollback_drill_receipt",
    "continuous_canary_monitoring_receipt",
    "alerting_receipt",
    "final_release_decision_receipt",
  ]) {
    const evidencePath = path.join(repoRoot, testEvidenceSink, "production-complete", `${id}.json`);
    mkdirSync(path.dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify({
      kind: "medopl_operational_stability_receipt",
      id,
      status: "accepted",
      summary: `${id} accepted by operational stability gate`,
      checks: ["redacted_summary_only"],
      cannotClaim: ["multi-region production", "SLA proven", "enterprise compliance"],
    }, null, 2)}\n`);
  }
  const manifestOnlyWithOperationalEvidence = jsonFrom(
    runExecutor(["--manifest-only", "--json"], { V22_CLOUD_GOAL_RUN_ID: testRunId }),
    "cloud_executor_manifest_only_with_operational_stability_evidence",
  );
  assert.equal(manifestOnlyWithOperationalEvidence.ok, true, "cloud_executor_manifest_only_must_pass_with_operational_stability_evidence");
  const manifestOnlyWithOperationalEvidencePayload = JSON.parse(readFileSync(path.join(repoRoot, manifestOnlyWithOperationalEvidence.receiptManifest.path), "utf8"));
  const soakCriterion = manifestOnlyWithOperationalEvidencePayload.production_complete_criteria.find((criterion) => criterion.id === "soak_test_receipt");
  assert.equal(soakCriterion?.owner, "MedOPL Operations", "soak_criterion_owner_mismatch");
  assert.equal(
    /^sha256:[a-f0-9]{64}$/u.test(soakCriterion?.evidence_hash || ""),
    true,
    "soak_criterion_must_use_real_pointer_hash",
  );
  assert.equal(
    JSON.stringify(soakCriterion).includes("probeBodies"),
    false,
    "soak_criterion_must_not_embed_raw_probe_payload",
  );
  assert.equal(
    manifestOnlyWithOperationalEvidence.receiptManifest.productionCompleteCandidateComplete,
    true,
    "manifest_only_must_pass_production_complete_candidate_with_operational_stability_evidence",
  );

  const missingDbProofRunId = `${testRunId}-missing-db-proof`;
  mkdirSync(path.join(repoRoot, ".runtime/v22-cloud-authorization", missingDbProofRunId), { recursive: true });
  for (const receipt of manifestOnlyPayload.receipts) {
    writeFileSync(
      path.join(repoRoot, ".runtime/v22-cloud-authorization", missingDbProofRunId, `${receipt.type}.json`),
      `${JSON.stringify({
        ...receipt,
        kind: "v22_owner_receipt_pointer",
        path: `.runtime/v22-cloud-authorization/${missingDbProofRunId}/${receipt.type}.json`,
      }, null, 2)}\n`,
    );
  }
  writeFileSync(
    path.join(repoRoot, ".runtime/v22-cloud-authorization", missingDbProofRunId, "live_test.json"),
    `${JSON.stringify({
      kind: "v22_cloud_authorized_phase_evidence",
      operationClass: "live_test",
      status: "executed",
      resultSummaries: [{ ok: true, databaseProof: { databasePersistenceProof: false } }],
    }, null, 2)}\n`,
  );
  const manifestWithoutDbProof = runExecutor(["--manifest-only", "--json"], { V22_CLOUD_GOAL_RUN_ID: missingDbProofRunId });
  assert.equal(manifestWithoutDbProof.status, 1, "manifest_only_must_fail_closed_without_live_db_proof");
  const manifestWithoutDbProofPayload = JSON.parse(manifestWithoutDbProof.stdout);
  assert(
    manifestWithoutDbProofPayload.receiptManifest.blockers.includes(
      "production_receipt_manifest_production_complete_criterion_not_accepted:business_db_persistence_receipt",
    ),
    "manifest_only_missing_db_proof_blocker_mismatch",
  );
} finally {
  rmSync(path.join(repoRoot, testEvidenceSink), { recursive: true, force: true });
  rmSync(path.join(repoRoot, ".runtime/v22-cloud-authorization", `${testRunId}-missing-receipts`), { recursive: true, force: true });
  rmSync(path.join(repoRoot, ".runtime/v22-cloud-authorization", `${testRunId}-replay-missing-receipts`), { recursive: true, force: true });
  rmSync(path.join(repoRoot, ".runtime/v22-cloud-authorization", `${testRunId}-missing-db-proof`), { recursive: true, force: true });
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_authorized_executor",
}, null, 2));
