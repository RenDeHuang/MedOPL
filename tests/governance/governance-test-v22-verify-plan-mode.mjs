import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planCommandsForFiles } from "../../scripts/v22-test-policy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readJson(repoPath) {
  return JSON.parse(await readFile(path.join(repoRoot, repoPath), "utf8"));
}

function runVerifyPlan(args = []) {
  return spawnSync(process.execPath, ["scripts/v22-verify.mjs", "plan", ...args, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function runVerifyPlanHuman(args = []) {
  return spawnSync(process.execPath, ["scripts/v22-verify.mjs", "plan", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

const [packageJson, manifest] = await Promise.all([
  readJson("package.json"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
]);

assert.equal(packageJson.scripts["test:plan"], "node scripts/v22-verify.mjs plan --base origin/recovery/platform-v22-trunk", "package_must_expose_test_plan");
assert(
  manifest.package_suites.find((suite) => suite.id === "test-lanes")?.commands.includes("node tests/governance/governance-test-v22-verify-plan-mode.mjs"),
  "test_lanes_package_must_run_verify_plan_mode_gate",
);

const frontendPlan = runVerifyPlan(["--files", "services/portal/frontend/src/app/routes.tsx"]);
assert.equal(frontendPlan.status, 0, `frontend_plan_must_exit_zero:${frontendPlan.stderr || frontendPlan.stdout}`);
const frontendPayload = JSON.parse(frontendPlan.stdout);
assert.equal(frontendPayload.ok, true, "frontend_plan_payload_must_be_ok");
assert.equal(frontendPayload.mode, "plan", "frontend_plan_mode_mismatch");
assert(frontendPayload.changedFiles.includes("services/portal/frontend/src/app/routes.tsx"), "frontend_plan_changed_file_missing");
assert(frontendPayload.matchedSurfaces.includes("frontend"), "frontend_plan_must_report_frontend_surface");
assert(frontendPayload.environments.includes("local"), "frontend_plan_must_report_local_environment");
assert(
  frontendPayload.reasons.some((reason) => reason.surface === "frontend" && reason.file === "services/portal/frontend/src/app/routes.tsx"),
  "frontend_plan_must_report_reason_for_trigger_file",
);
assert(frontendPayload.recommendedCommands.includes("npm run test:frontend"), "frontend_plan_must_recommend_frontend_lane");
assert(frontendPayload.recommendedCommands.includes("npm run test:regression"), "frontend_plan_must_recommend_regression_lane");
assert(frontendPayload.recommendedCommands.includes("npm run test:fast"), "frontend_plan_must_recommend_fast_lane");
assert(frontendPayload.recommendedCommands.includes("npm run test:lanes"), "frontend_plan_must_recommend_lane_gate");
assert(frontendPayload.cannotClaim.includes("production readiness"), "frontend_plan_must_preserve_cannot_claim");
assert.equal(frontendPayload.executesCommands, false, "plan_mode_must_not_execute_commands");
assert.equal(typeof frontendPayload.preflight?.ok, "boolean", "frontend_plan_preflight_must_report_boolean_ok");
assert(Array.isArray(frontendPayload.preflight?.checks), "frontend_plan_preflight_must_report_checks");
assert(Array.isArray(frontendPayload.preflight?.missing), "frontend_plan_preflight_must_report_missing");
assert(Array.isArray(frontendPayload.preflight?.recommendedSetupCommands), "frontend_plan_preflight_must_report_setup_commands");

const frontendHumanPlan = runVerifyPlanHuman(["--files", "services/portal/frontend/src/app/routes.tsx"]);
assert.equal(frontendHumanPlan.status, 0, `frontend_human_plan_must_exit_zero:${frontendHumanPlan.stderr || frontendHumanPlan.stdout}`);
assert(frontendHumanPlan.stdout.includes("recommended commands:"), "frontend_human_plan_must_show_recommended_commands");
assert(frontendHumanPlan.stdout.includes("matched surfaces:"), "frontend_human_plan_must_show_matched_surfaces");
assert(frontendHumanPlan.stdout.includes("reasons:"), "frontend_human_plan_must_show_reasons");
assert(frontendHumanPlan.stdout.includes("npm run test:frontend"), "frontend_human_plan_must_show_frontend_lane");
assert(frontendHumanPlan.stdout.includes("cannot claim:"), "frontend_human_plan_must_show_cannot_claim");

const untrackedProbePath = `scripts/.verify-plan-working-tree-probe-${process.pid}.mjs`;
await writeFile(path.join(repoRoot, untrackedProbePath), "export const probe = true;\n", "utf8");
try {
  const defaultPlan = runVerifyPlan();
  assert.equal(defaultPlan.status, 0, `default_plan_must_exit_zero:${defaultPlan.stderr || defaultPlan.stdout}`);
  const defaultPayload = JSON.parse(defaultPlan.stdout);
  assert(defaultPayload.changedFiles.includes(untrackedProbePath), "default_plan_must_include_untracked_working_tree_file");
  assert(defaultPayload.matchedSurfaces.includes("hygiene"), "default_plan_must_map_untracked_test_probe_to_hygiene_surface");
  assert(defaultPayload.recommendedCommands.includes("npm run test:hygiene"), "default_plan_must_recommend_hygiene_for_test_surface");
} finally {
  await rm(path.join(repoRoot, untrackedProbePath), { force: true });
}

const cloudPlan = runVerifyPlan(["--files", "tests/cloud/cloud-test-v22-tencent-readonly-inventory-boundary.mjs"]);
assert.equal(cloudPlan.status, 0, `cloud_plan_must_exit_zero:${cloudPlan.stderr || cloudPlan.stdout}`);
const cloudPayload = JSON.parse(cloudPlan.stdout);
assert(cloudPayload.matchedSurfaces.includes("cloud"), "cloud_plan_must_report_cloud_surface");
assert(cloudPayload.environments.includes("local"), "cloud_plan_must_keep_default_cloud_gate_local");
assert(cloudPayload.authorizedEnvironments.includes("staging"), "cloud_plan_must_report_staging_as_authorized_environment");
assert(cloudPayload.authorizedEnvironments.includes("production-canary"), "cloud_plan_must_report_production_canary_as_authorized_environment");
assert(cloudPayload.recommendedCommands.includes("npm run test:cloud"), "cloud_plan_must_recommend_cloud_lane");
assert(cloudPayload.recommendedCommands.includes("npm run test:real-cloud-readiness"), "cloud_plan_must_recommend_readiness_lane");
assert.equal(cloudPayload.authorizedCommands.includes("npm run test:cloud-future-authorized"), true, "cloud_plan_must_keep_future_authorized_separate");
assert.equal(cloudPayload.recommendedCommands.includes("npm run test:cloud-future-authorized"), false, "cloud_plan_must_not_default_future_authorized");
assert.equal(cloudPayload.authorization.authorizedCommandsExecutable, true, "cloud_plan_must_have_active_authorization_pack");
assert.equal(cloudPayload.cannotClaim.includes("real cloud execution"), false, "cloud_plan_must_allow_real_cloud_execution_under_pack");
assert(cloudPayload.cannotClaim.includes("owner receipts complete"), "cloud_plan_must_still_require_owner_receipts");

const apiContractPlan = runVerifyPlan(["--files", "contracts/medopl-api-contract.json"]);
assert.equal(apiContractPlan.status, 0, `api_contract_plan_must_exit_zero:${apiContractPlan.stderr || apiContractPlan.stdout}`);
const apiContractPayload = JSON.parse(apiContractPlan.stdout);
for (const surface of ["contract", "frontend", "backend"]) {
  assert(apiContractPayload.matchedSurfaces.includes(surface), `api_contract_plan_must_expand_surface:${surface}`);
}
for (const command of [
  "npm run test:contract",
  "npm run test:frontend",
  "npm run test:backend",
  "npm run test:regression",
  "bash -lc \"cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...\"",
]) {
  assert(apiContractPayload.recommendedCommands.includes(command), `api_contract_plan_command_missing:${command}`);
}
assert.equal(typeof apiContractPayload.preflight?.ok, "boolean", "api_contract_plan_preflight_must_report_boolean_ok");

const runtimeBridgeContractPlan = runVerifyPlan(["--files", "contracts/medopl-runtime-bridge-contract.json"]);
assert.equal(runtimeBridgeContractPlan.status, 0, `runtime_bridge_contract_plan_must_exit_zero:${runtimeBridgeContractPlan.stderr || runtimeBridgeContractPlan.stdout}`);
const runtimeBridgeContractPayload = JSON.parse(runtimeBridgeContractPlan.stdout);
for (const surface of ["contract", "runtime", "regression"]) {
  assert(runtimeBridgeContractPayload.matchedSurfaces.includes(surface), `runtime_bridge_contract_plan_must_expand_surface:${surface}`);
}
for (const command of [
  "npm run test:contract",
  "npm run test:runtime",
  "npm run test:regression",
]) {
  assert(runtimeBridgeContractPayload.recommendedCommands.includes(command), `runtime_bridge_contract_plan_command_missing:${command}`);
}

const cloudBoundaryPlan = runVerifyPlan(["--files", "contracts/medopl-cloud-boundary.json"]);
assert.equal(cloudBoundaryPlan.status, 0, `cloud_boundary_plan_must_exit_zero:${cloudBoundaryPlan.stderr || cloudBoundaryPlan.stdout}`);
const cloudBoundaryPayload = JSON.parse(cloudBoundaryPlan.stdout);
assert(cloudBoundaryPayload.matchedSurfaces.includes("cloud"), "cloud_boundary_plan_must_report_cloud_surface");
assert(cloudBoundaryPayload.recommendedCommands.includes("npm run test:real-cloud-readiness"), "cloud_boundary_plan_must_recommend_local_readiness");
assert.equal(cloudBoundaryPayload.recommendedCommands.includes("npm run test:cloud-future-authorized"), false, "cloud_boundary_plan_must_not_default_future_authorized");
assert.equal(cloudBoundaryPayload.authorizedCommands.includes("npm run test:cloud-future-authorized"), true, "cloud_boundary_plan_must_keep_future_authorized_separate");
assert.equal(cloudBoundaryPayload.authorization.authorizedCommandsExecutable, true, "cloud_boundary_plan_must_use_active_pack");

const missingFrontendPreflight = planCommandsForFiles(
  ["contracts/medopl-api-contract.json"],
  {
    exists(repoPath) {
      return repoPath !== "services/portal/frontend/node_modules/typescript";
    },
  },
);
assert.equal(missingFrontendPreflight.preflight.ok, false, "api_contract_preflight_must_fail_when_frontend_typescript_missing");
assert(
  missingFrontendPreflight.preflight.missing.some((entry) => entry.id === "frontend-typescript-package"),
  "api_contract_preflight_must_report_missing_frontend_typescript",
);
assert(
  missingFrontendPreflight.preflight.recommendedSetupCommands.includes("npm --prefix services/portal/frontend ci"),
  "api_contract_preflight_must_suggest_frontend_setup",
);

const fullLocalPlan = runVerifyPlan(["--profile", "full-local"]);
assert.equal(fullLocalPlan.status, 0, `full_local_plan_must_exit_zero:${fullLocalPlan.stderr || fullLocalPlan.stdout}`);
const fullLocalPayload = JSON.parse(fullLocalPlan.stdout);
for (const command of [
  "npm run test:health",
  "npm run test:smoke",
  "npm run test:contract",
  "npm run test:regression",
  "npm run verify:local-release-candidate",
]) {
  assert(fullLocalPayload.recommendedCommands.includes(command), `full_local_plan_command_missing:${command}`);
}

const fullLocalBackendPlan = runVerifyPlan(["--profile", "full-local", "--files", "services/medopl-go-backend/internal/server/router.go"]);
assert.equal(fullLocalBackendPlan.status, 0, `full_local_backend_plan_must_exit_zero:${fullLocalBackendPlan.stderr || fullLocalBackendPlan.stdout}`);
const fullLocalBackendPayload = JSON.parse(fullLocalBackendPlan.stdout);
assert(fullLocalBackendPayload.matchedSurfaces.includes("backend"), "full_local_plan_must_report_backend_surface");
assert(fullLocalBackendPayload.environments.includes("local"), "full_local_plan_must_report_local_environment");
assert(fullLocalBackendPayload.recommendedCommands.includes("npm run test:backend"), "full_local_plan_must_include_backend_targeted_lane");
assert(
  fullLocalBackendPayload.recommendedCommands.includes("bash -lc \"cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...\""),
  "full_local_plan_must_include_go_package_targeted_command",
);

const unknownProfilePlan = runVerifyPlan(["--profile", "unknown"]);
assert.notEqual(unknownProfilePlan.status, 0, "unknown_profile_plan_must_fail_closed");
assert(
  `${unknownProfilePlan.stderr}\n${unknownProfilePlan.stdout}`.includes("unknown_plan_profile:unknown"),
  "unknown_profile_plan_must_explain_failure",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_verify_plan_mode",
}, null, 2));
