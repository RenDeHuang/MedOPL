import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
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

const apiContractPlan = planCommandsForFiles(["contracts/medopl-api-contract.json"]);
for (const surface of ["contract", "backend", "frontend"]) {
  assert(apiContractPlan.matchedSurfaces.includes(surface), `api_contract_plan_must_include_surface:${surface}`);
}
for (const command of ["npm run test:contract", "npm run test:backend", "npm run test:frontend"]) {
  assert(apiContractPlan.recommendedCommands.includes(command), `api_contract_plan_must_recommend_command:${command}`);
}

const cloudPlan = planCommandsForFiles(["contracts/medopl-cloud-boundary.json"]);
assert(cloudPlan.authorizedCommands.includes("npm run test:cloud-future-authorized"), "cloud_plan_must_keep_future_authorized_command");
assert.equal(
  cloudPlan.recommendedCommands.includes("npm run test:cloud-future-authorized"),
  false,
  "cloud_plan_must_not_recommend_future_authorized_command",
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
assert(dryRun.report.commands.planned.includes("npm run test:cloud"), "run_plan_report_must_include_recommended_command");
assert.equal(dryRun.report.commands.planned.includes("npm run test:cloud-future-authorized"), false, "run_plan_report_must_not_plan_authorized_command");
assert(dryRun.report.commands.skippedAuthorized.includes("npm run test:cloud-future-authorized"), "run_plan_report_must_skip_authorized_command");
assert(dryRun.cannotClaim.includes("real cloud execution"), "run_plan_must_preserve_cannot_claim");

const tempDir = mkdtempSync(path.join(tmpdir(), "v22-run-plan-"));
const successExecutor = path.join(tempDir, "success.mjs");
const failureExecutor = path.join(tempDir, "failure.mjs");
const successLog = path.join(tempDir, "success.log");
try {
  writeFileSync(successExecutor, `import { appendFileSync } from "node:fs";\nconst logPath = ${JSON.stringify(successLog)};\nexport default async function runCommand(command) { appendFileSync(logPath, \`\${command}\\n\`); return { command, ok: true, status: 0 }; }\n`);
  writeFileSync(failureExecutor, "export default async function runCommand(command) { return command === \"npm run test:smoke\" ? { command, ok: false, status: 7 } : { command, ok: true, status: 0 }; }\n");

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
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_dynamic_test_run_plan",
}, null, 2));
