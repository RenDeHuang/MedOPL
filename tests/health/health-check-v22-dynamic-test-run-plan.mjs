import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLOUD_GOAL_AUTHORIZED_COMMANDS,
  readCloudAuthorizationPack,
  planCommandsForFiles,
  preflightTestPlan,
} from "../../scripts/v22-test-policy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function runVerify(args = [], env = {}) {
  return spawnSync(process.execPath, ["scripts/v22-verify.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function parseJsonResult(result, label) {
  assert.equal(result.status, 0, `${label}_must_exit_zero:${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function readPackFromJson(pack) {
  return readCloudAuthorizationPack({
    readFile() {
      return `${JSON.stringify(pack, null, 2)}\n`;
    },
  });
}

const apiContractPlan = planCommandsForFiles(["contracts/medopl-api-contract.json"]);
for (const surface of ["contract", "backend", "frontend"]) {
  assert(apiContractPlan.matchedSurfaces.includes(surface), `api_contract_plan_must_include_surface:${surface}`);
}
for (const command of ["npm run test:contract", "npm run test:backend", "npm run test:frontend"]) {
  assert(apiContractPlan.recommendedCommands.includes(command), `api_contract_plan_must_recommend_command:${command}`);
}

const cloudPlan = planCommandsForFiles(["contracts/medopl-cloud-boundary.json"]);
assert.deepEqual(cloudPlan.authorizedCommands, CLOUD_GOAL_AUTHORIZED_COMMANDS, "cloud_plan_must_keep_goal_authorized_commands");
assert.equal(
  CLOUD_GOAL_AUTHORIZED_COMMANDS.some((command) => cloudPlan.recommendedCommands.includes(command)),
  false,
  "cloud_plan_must_not_recommend_goal_authorized_commands",
);
assert.equal(cloudPlan.authorization.authorizedCommandsExecutable, true, "cloud_plan_must_see_active_authorization_pack");
assert.equal(
  cloudPlan.cannotClaim.includes("real cloud execution"),
  false,
  "cloud_plan_with_active_pack_must_not_forbid_real_cloud_execution_claim",
);
assert(cloudPlan.cannotClaim.includes("owner receipts complete"), "cloud_plan_must_still_block_receipt_completion_claim");
assert.equal(cloudPlan.authorization.authorizedCommandsExecutable, true, "cloud_plan_must_keep_authorized_commands_executable");
assert(Array.isArray(cloudPlan.authorization.diagnostics?.operationClassMappings), "cloud_plan_must_expose_authorization_diagnostics");
assert(cloudPlan.authorization.diagnostics.operationClassMappings.length > 0, "cloud_plan_must_report_operation_class_mappings");
assert(Array.isArray(cloudPlan.authorization.diagnostics?.secretAllowlistMappings), "cloud_plan_must_expose_secret_allowlist_diagnostics");
assert(cloudPlan.authorization.diagnostics.secretAllowlistMappings.length > 0, "cloud_plan_must_report_secret_allowlist_diagnostics");
assert.equal(
  cloudPlan.authorization.postAuthorizedCommandReceiptManifest?.required,
  true,
  "cloud_plan_must_require_post_authorized_command_receipt_manifest",
);
assert.equal(
  cloudPlan.authorization.postAuthorizedCommandReceiptManifest?.contract,
  "contracts/medopl-production-receipt-boundary.json",
  "cloud_plan_receipt_manifest_contract_mismatch",
);

const missingAuth = readCloudAuthorizationPack({
  exists(repoPath) {
    return repoPath !== "contracts/medopl-cloud-authorization-pack.json";
  },
});
assert.equal(missingAuth.authorizedCommandsExecutable, false, "missing_authorization_pack_must_not_execute_authorized_commands");

const expiredPack = readPackFromJson({
  schema_version: 1,
  owner: "MedOPL Operations",
  purpose: "machine_authorization_pack_for_cloud_execution",
  state: "active",
  authority_boundary: {
    surface: "cloud_execution_authorization",
    default_cloud_execution: "allowed_when_authorization_pack_is_active",
    default_cloud_mutation: "allowed_when_authorization_pack_is_active",
    default_secret_read: "allowed_when_secret_allowlist_matches_pack",
    production_claim_requires: "runtime_storage_billing_audit_release_owner_receipts",
  },
  authorization_boundary: {
    default_cloud_execution: "allowed_when_authorization_pack_is_active",
    default_cloud_mutation: "allowed_when_authorization_pack_is_active",
    default_secret_read: "allowed_when_secret_allowlist_matches_pack",
    production_claim_requires: "runtime_storage_billing_audit_release_owner_receipts",
  },
  active_pack: {
    id: "v22-cloud-execution-open-authority",
    status: "authorized",
    authorized_by: "user_request_2026-06-19",
    issued_at: "2026-06-19",
    approval_id: "approval-v22-001",
    run_id: "run-v22-001",
    target_environments: ["staging", "production-canary"],
    operation_classes: ["readonly_inventory"],
    secret_allowlist: ["TENCENT_READONLY_SECRET_ID", "TENCENT_READONLY_SECRET_KEY"],
    api_allowlist: ["tencentcloud:readonly_inventory"],
    evidence_sink: ".runtime/v22-cloud-authorization",
    redaction_required: true,
    rollback_owner: "MedOPL Operations",
    rollback_commands: ["npm run test:cloud"],
    budget: {
      currency: "USD",
      cost_ceiling: 1000,
    },
    post_authorized_command_receipt_manifest: {
      required: true,
      contract: "contracts/medopl-production-receipt-boundary.json",
      path_pattern: ".runtime/v22-cloud-authorization/**/receipt-manifest.json",
      policy: "small_pointer_and_summary_only",
    },
    expires_at: "2026-06-01",
  },
  required_receipts_before_production_complete: ["runtime_owner_receipt"],
});
assert.equal(expiredPack.authorizedCommandsExecutable, false, "expired_pack_must_not_authorize_commands");
assert(
  expiredPack.blockers.some((blocker) => blocker.includes("expires_at")),
  "expired_pack_must_report_expired_date_blocker",
);

const incompletePack = readPackFromJson({
  schema_version: 1,
  owner: "MedOPL Operations",
  purpose: "machine_authorization_pack_for_cloud_execution",
  state: "active",
  authority_boundary: {
    surface: "cloud_execution_authorization",
    default_cloud_execution: "allowed_when_authorization_pack_is_active",
    default_cloud_mutation: "allowed_when_authorization_pack_is_active",
    default_secret_read: "allowed_when_secret_allowlist_matches_pack",
    production_claim_requires: "runtime_storage_billing_audit_release_owner_receipts",
  },
  authorization_boundary: {
    default_cloud_execution: "allowed_when_authorization_pack_is_active",
    default_cloud_mutation: "allowed_when_authorization_pack_is_active",
    default_secret_read: "allowed_when_secret_allowlist_matches_pack",
    production_claim_requires: "runtime_storage_billing_audit_release_owner_receipts",
  },
  active_pack: {
    id: "v22-cloud-execution-open-authority",
    status: "authorized",
    authorized_by: "user_request_2026-06-19",
    issued_at: "2026-06-19",
    approval_id: "approval-v22-001",
    run_id: "run-v22-001",
    target_environments: ["staging"],
    operation_classes: ["readonly_inventory", "dry_run_plan"],
    secret_allowlist: ["TENCENT_READONLY_SECRET_ID"],
    api_allowlist: ["tencentcloud:readonly_inventory"],
    evidence_sink: ".runtime/v22-cloud-authorization",
    redaction_required: true,
    rollback_owner: "MedOPL Operations",
    rollback_commands: ["npm run test:cloud"],
    budget: {
      currency: "USD",
      cost_ceiling: 1000,
    },
    post_authorized_command_receipt_manifest: {
      required: true,
      contract: "contracts/medopl-production-receipt-boundary.json",
      path_pattern: ".runtime/v22-cloud-authorization/**/receipt-manifest.json",
      policy: "small_pointer_and_summary_only",
    },
    expires_at: "2026-07-19",
  },
  required_receipts_before_production_complete: ["runtime_owner_receipt"],
});
assert.equal(incompletePack.authorizedCommandsExecutable, false, "incomplete_pack_must_not_authorize_commands");
assert(
  incompletePack.blockers.some((blocker) => blocker.includes("operation_class")),
  "incomplete_pack_must_report_operation_class_mapping_blocker",
);
assert(
  incompletePack.blockers.some((blocker) => blocker.includes("secret_allowlist")),
  "incomplete_pack_must_report_secret_allowlist_blocker",
);

const unknownEnvironmentPack = readPackFromJson({
  schema_version: 1,
  owner: "MedOPL Operations",
  purpose: "machine_authorization_pack_for_cloud_execution",
  state: "active",
  authority_boundary: {
    surface: "cloud_execution_authorization",
    default_cloud_execution: "allowed_when_authorization_pack_is_active",
    default_cloud_mutation: "allowed_when_authorization_pack_is_active",
    default_secret_read: "allowed_when_secret_allowlist_matches_pack",
    production_claim_requires: "runtime_storage_billing_audit_release_owner_receipts",
  },
  authorization_boundary: {
    default_cloud_execution: "allowed_when_authorization_pack_is_active",
    default_cloud_mutation: "allowed_when_authorization_pack_is_active",
    default_secret_read: "allowed_when_secret_allowlist_matches_pack",
    production_claim_requires: "runtime_storage_billing_audit_release_owner_receipts",
  },
  active_pack: {
    id: "v22-cloud-execution-open-authority",
    status: "authorized",
    authorized_by: "user_request_2026-06-19",
    issued_at: "2026-06-19",
    approval_id: "approval-v22-001",
    run_id: "run-v22-001",
    target_environments: ["moon"],
    operation_classes: ["readonly_inventory"],
    secret_allowlist: ["TENCENT_READONLY_SECRET_ID", "TENCENT_READONLY_SECRET_KEY"],
    secret_allowlist_required: ["TENCENT_READONLY_SECRET_ID", "TENCENT_READONLY_SECRET_KEY"],
    secret_allowlist_mapping: {
      readonly_inventory: ["TENCENT_READONLY_SECRET_ID", "TENCENT_READONLY_SECRET_KEY"],
    },
    api_allowlist: ["tencentcloud:readonly_inventory"],
    api_allowlist_required: ["tencentcloud:readonly_inventory"],
    api_allowlist_mapping: {
      readonly_inventory: ["tencentcloud:readonly_inventory"],
    },
    operation_class_command_map: [
      {
        operation_class: "readonly_inventory",
        package_script: "test:cloud",
        commands: ["npm run test:cloud"],
      },
    ],
    evidence_sink: ".runtime/v22-cloud-authorization",
    redaction_required: true,
    rollback_owner: "MedOPL Operations",
    rollback_commands: ["npm run test:cloud"],
    budget: {
      currency: "USD",
      cost_ceiling: 1000,
    },
    post_authorized_command_receipt_manifest: {
      required: true,
      contract: "contracts/medopl-production-receipt-boundary.json",
      path_pattern: ".runtime/v22-cloud-authorization/**/receipt-manifest.json",
      policy: "small_pointer_and_summary_only",
    },
    expires_at: "2026-07-19",
  },
  required_receipts_before_production_complete: ["runtime_owner_receipt"],
});
assert.equal(unknownEnvironmentPack.authorizedCommandsExecutable, false, "unknown_environment_pack_must_not_authorize_commands");
assert(
  unknownEnvironmentPack.blockers.some((blocker) => blocker.includes("invalid_target_environment")),
  "unknown_environment_pack_must_report_environment_blocker",
);

const frontendPreflight = preflightTestPlan(
  {
    recommendedCommands: ["npm run test:frontend"],
    matchedSurfaces: ["frontend"],
  },
  {
    exists(repoPath) {
      return repoPath !== "services/portal/frontend/node_modules/typescript";
    },
  },
);
assert.equal(frontendPreflight.ok, false, "frontend_preflight_must_fail_when_typescript_dependency_missing");
assert(
  frontendPreflight.recommendedSetupCommands.includes("npm --prefix services/portal/frontend ci"),
  "frontend_preflight_must_recommend_frontend_ci",
);

const runtimePreflight = preflightTestPlan({
  recommendedCommands: ["npm run test:runtime"],
  matchedSurfaces: ["runtime"],
});
assert.equal(runtimePreflight.ok, false, "runtime_preflight_must_fail_when_local_service_ports_are_unreachable");
assert(
  runtimePreflight.missing.some((entry) => entry.id === "local-service-port-check"),
  "runtime_preflight_must_report_missing_local_service_ports",
);
assert(
  runtimePreflight.recommendedSetupCommands.includes("npm run local:services:start && npm run local:services:check -- --json"),
  "runtime_preflight_must_recommend_local_services_start_and_check",
);

const dryRun = parseJsonResult(
  runVerify(["run-plan", "--files", "tests/cloud/cloud-test-v22-tencent-readonly-inventory-boundary.mjs", "--dry-run", "--json"]),
  "run_plan_dry_run",
);
assert.equal(dryRun.ok, true, "run_plan_dry_run_payload_must_be_ok");
assert.equal(dryRun.mode, "run-plan", "run_plan_mode_mismatch");
assert.equal(dryRun.executesCommands, false, "run_plan_dry_run_must_not_execute_commands");
assert.equal(dryRun.report.kind, "v22_dynamic_test_plan_report", "run_plan_must_emit_dynamic_report");
assert.equal(dryRun.report.completion.status, "not_started", "run_plan_dry_run_must_not_report_completion");
assert.equal(
  dryRun.report.productionReceiptManifest.requiredAfterAuthorizedCommands,
  true,
  "run_plan_report_must_include_receipt_manifest_requirement",
);
assert.equal(
  dryRun.report.productionReceiptManifest.contract,
  "contracts/medopl-production-receipt-boundary.json",
  "run_plan_report_receipt_manifest_contract_mismatch",
);
assert(dryRun.report.commands.planned.includes("npm run test:cloud"), "run_plan_report_must_include_recommended_command");
assert.equal(
  CLOUD_GOAL_AUTHORIZED_COMMANDS.some((command) => dryRun.report.commands.planned.includes(command)),
  false,
  "run_plan_report_must_not_plan_authorized_commands",
);
assert.deepEqual(dryRun.report.commands.skippedAuthorized, CLOUD_GOAL_AUTHORIZED_COMMANDS, "run_plan_report_must_skip_goal_authorized_commands");
assert(dryRun.cannotClaim.includes("owner receipts complete"), "run_plan_must_preserve_receipt_cannot_claim");

const tempDir = mkdtempSync(path.join(tmpdir(), "v22-run-plan-"));
const successExecutor = path.join(tempDir, "success.mjs");
const failureExecutor = path.join(tempDir, "failure.mjs");
const authorizedLog = path.join(tempDir, "authorized.log");
const authorizedExecutor = path.join(tempDir, "authorized.mjs");
const authorizedWithReceiptExecutor = path.join(tempDir, "authorized-with-receipt.mjs");
const successLog = path.join(tempDir, "success.log");
try {
  writeFileSync(successExecutor, `import { appendFileSync } from "node:fs";\nconst logPath = ${JSON.stringify(successLog)};\nexport default async function runCommand(command) { appendFileSync(logPath, \`\${command}\\n\`); return { command, ok: true, status: 0 }; }\n`);
  writeFileSync(failureExecutor, "export default async function runCommand(command) { return command === \"npm run test:smoke\" ? { command, ok: false, status: 7 } : { command, ok: true, status: 0 }; }\n");
  writeFileSync(authorizedExecutor, `import { appendFileSync } from "node:fs";\nconst logPath = ${JSON.stringify(authorizedLog)};\nexport default async function runCommand(command) { appendFileSync(logPath, \`\${command}\\n\`); return { command, ok: true, status: 0 }; }\n`);
  writeFileSync(authorizedWithReceiptExecutor, `import { copyFileSync, mkdirSync } from "node:fs";\nimport path from "node:path";\nexport default async function runCommand(command, context) { if (command.startsWith("npm run cloud:goal:")) { const target = path.join(context.repoRoot, ".runtime/v22-cloud-authorization/run-v22-001/receipt-manifest.json"); mkdirSync(path.dirname(target), { recursive: true }); copyFileSync(path.join(context.repoRoot, "tests/fixtures/v22/production-receipt-manifest.example.json"), target); } return { command, ok: true, status: 0 }; }\n`);

  const commandOverride = runVerify(["run-plan", "--files", "scripts/v22-test-policy.mjs", "--commands", "node -e \"process.exit(0)\"", "--json"]);
  assert.equal(commandOverride.status, 1, "run_plan_must_reject_manual_command_override");
  assert(commandOverride.stderr.includes("run_plan_command_override_forbidden"), "run_plan_command_override_must_fail_closed");

  const stubSuccess = parseJsonResult(
    runVerify(
      ["run-plan", "--files", "scripts/v22-test-policy.mjs", "--json"],
      { V22_VERIFY_COMMAND_EXECUTOR: successExecutor },
    ),
    "run_plan_stub_success",
  );
  assert.equal(stubSuccess.ok, true, "run_plan_stub_success_must_be_ok");
  assert.equal(stubSuccess.executesCommands, true, "run_plan_stub_success_must_execute_commands");
  assert.deepEqual(
    stubSuccess.report.commands.executed.map((entry) => entry.command),
    stubSuccess.report.commands.planned,
    "run_plan_stub_success_must_execute_policy_recommended_commands",
  );
  assert.equal(stubSuccess.report.commands.executed.every((entry) => entry.ok), true, "run_plan_stub_success_commands_must_pass");
  assert.equal(
    stubSuccess.report.completion.status,
    "local_recommended_commands_passed",
    "run_plan_stub_success_must_report_local_recommended_completion",
  );

  const authorizedMissingReceipt = runVerify(
    ["run-plan", "--files", "contracts/medopl-cloud-boundary.json", "--include-authorized", "--json"],
    { V22_VERIFY_COMMAND_EXECUTOR: authorizedExecutor },
  );
  assert.equal(authorizedMissingReceipt.status, 1, "authorized_run_without_receipt_manifest_must_exit_one");
  const authorizedMissingReceiptPayload = JSON.parse(authorizedMissingReceipt.stdout);
  assert.equal(authorizedMissingReceiptPayload.includeAuthorized, true, "authorized_run_must_enable_authorized_execution");
  assert.deepEqual(
    authorizedMissingReceiptPayload.report.commands.authorizedExecuted.map((entry) => entry.command),
    CLOUD_GOAL_AUTHORIZED_COMMANDS,
    "run_plan_authorized_must_execute_goal_authorized_commands_before_receipt_gate",
  );
  assert.equal(authorizedMissingReceiptPayload.ok, false, "authorized_run_without_receipt_manifest_must_fail_closed");
  assert.equal(
    authorizedMissingReceiptPayload.report.productionReceiptManifest.status,
    "missing",
    "authorized_run_without_receipt_manifest_must_report_missing_manifest",
  );
  assert.equal(authorizedMissingReceiptPayload.report.commands.skippedAuthorized.length, 0, "authorized_run_must_not_skip_authorized_commands");

  const authorizedWithReceipt = parseJsonResult(
    runVerify(
      ["run-plan", "--files", "contracts/medopl-cloud-boundary.json", "--include-authorized", "--json"],
      { V22_VERIFY_COMMAND_EXECUTOR: authorizedWithReceiptExecutor },
    ),
    "run_plan_authorized_with_receipt",
  );
  assert.equal(authorizedWithReceipt.ok, true, "authorized_run_with_receipt_manifest_must_pass");
  assert.equal(
    authorizedWithReceipt.report.productionReceiptManifest.status,
    "complete",
    "authorized_run_with_receipt_manifest_must_report_complete_manifest",
  );
  assert.equal(
    authorizedWithReceipt.report.productionReceiptManifest.productionComplete,
    true,
    "authorized_run_with_receipt_manifest_must_evaluate_production_completion",
  );

  const stubFailure = runVerify(
    ["run-plan", "--files", "scripts/v22-test-policy.mjs", "--json"],
    { V22_VERIFY_COMMAND_EXECUTOR: failureExecutor },
  );
  assert.equal(stubFailure.status, 1, "run_plan_stub_failure_must_exit_one");
  const stubFailurePayload = JSON.parse(stubFailure.stdout);
  assert.equal(stubFailurePayload.ok, false, "run_plan_stub_failure_payload_must_fail");
  assert.equal(
    stubFailurePayload.report.commands.executed.some((entry) => entry.command === "npm run test:smoke" && entry.status === 7),
    true,
    "run_plan_stub_failure_must_report_failed_policy_command_status",
  );
  assert.equal(stubFailurePayload.report.completion.status, "blocked", "run_plan_stub_failure_must_report_blocked_completion");
} finally {
  rmSync(path.join(repoRoot, ".runtime/v22-cloud-authorization/run-v22-001/receipt-manifest.json"), { force: true });
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_dynamic_test_run_plan",
}, null, 2));
