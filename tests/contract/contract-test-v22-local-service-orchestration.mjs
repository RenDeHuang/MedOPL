import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function runLocalServices(args = []) {
  return spawnSync("node", ["scripts/v22-local-services.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function jsonFrom(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function assertIncludes(source, marker, label) {
  assert(String(source).includes(marker), `${label}_missing:${marker}`);
}

function assertNotIncludes(source, marker, label) {
  assert.equal(String(source).includes(marker), false, `${label}_forbidden:${marker}`);
}

const plan = jsonFrom(runLocalServices(["plan", "--json"]));
assert.equal(plan.ok, true, "local_service_plan_must_pass");
assert.equal(plan.mode, "plan", "local_service_plan_mode");
assert.equal(plan.forbiddenOps.includes("secret"), true, "local_service_plan_must_forbid_secret");
assert.equal(plan.forbiddenOps.includes("live-cloud"), true, "local_service_plan_must_forbid_cloud");
assert.equal(plan.forbiddenOps.includes("deploy"), true, "local_service_plan_must_forbid_deploy");
assert.equal(plan.forbiddenOps.includes("kubectl"), true, "local_service_plan_must_forbid_kubectl");
assert.equal(plan.forbiddenOps.includes("build-push"), true, "local_service_plan_must_forbid_build_push");

const services = new Map(plan.services.map((service) => [service.id, service]));
for (const id of ["portal-frontend", "go-backend", "opl-web-gateway", "runtime-bridge", "clean-opl-webui"]) {
  assert(services.has(id), `local_service_plan_missing:${id}`);
}

assert.equal(services.get("portal-frontend").command, "npm --prefix services/portal run start", "portal_command_must_use_frontend_only_package");
assert.equal(services.get("go-backend").command, "go run ./cmd/server", "go_backend_command_must_be_go_server");
assert.equal(services.get("go-backend").cwd, "services/medopl-go-backend", "go_backend_cwd");
assert.equal(services.get("opl-web-gateway").command, "npm --prefix services/opl-web-gateway run start", "gateway_command_must_have_repo_native_start");
assert.equal(services.get("runtime-bridge").command, "npm --prefix services/opl-runtime-bridge run start", "runtime_bridge_command_must_use_existing_start");
assert.equal(services.get("clean-opl-webui").external, true, "opl_webui_must_remain_external_clean_upstream");

for (const service of plan.services) {
  const serialized = JSON.stringify(service);
  assertNotIncludes(serialized, "services/portal/src", `service_must_not_reference_node_backend:${service.id}`);
  assertNotIncludes(serialized, "deploy/", `service_must_not_reference_deploy:${service.id}`);
  assertNotIncludes(serialized, "kubectl", `service_must_not_reference_kubectl:${service.id}`);
  assertNotIncludes(serialized, "docker build", `service_must_not_reference_docker_build:${service.id}`);
}

const checkDryRun = jsonFrom(runLocalServices(["check", "--dry-run", "--json"]));
assert.equal(checkDryRun.ok, true, "dry_run_check_must_pass");
assert.equal(checkDryRun.mode, "check", "dry_run_check_mode");
assert.equal(checkDryRun.dryRun, true, "dry_run_check_flag");
assert.equal(checkDryRun.results.length, plan.services.length, "dry_run_must_cover_all_services");
for (const result of checkDryRun.results) {
  assert.equal(result.status, "not_checked_dry_run", `dry_run_status:${result.id}`);
}

const scriptSource = await readRepoFile("scripts/v22-local-services.mjs");
for (const forbidden of [".env", "secrets.env", "SecretId", "SecretKey", "docker build", "docker push", "deploy/"]) {
  assertNotIncludes(scriptSource, forbidden, "local_services_script_must_not_use_forbidden_surface");
}
for (const marker of ["LOCAL_SERVICE_PLAN", "portal-frontend", "go-backend", "opl-web-gateway", "runtime-bridge", "clean-opl-webui"]) {
  assertIncludes(scriptSource, marker, "local_services_script_marker");
}

const packageJson = JSON.parse(await readRepoFile("package.json"));
assert.equal(packageJson.scripts["local:services:plan"], "node scripts/v22-local-services.mjs plan --json", "package_must_expose_plan");
assert.equal(packageJson.scripts["local:services:check"], "node scripts/v22-local-services.mjs check --json", "package_must_expose_check");
assert.equal(packageJson.scripts["local:services:check:dry-run"], "node scripts/v22-local-services.mjs check --dry-run --json", "package_must_expose_dry_run_check");
assert.equal(packageJson.scripts["local:services:start"], "node scripts/v22-local-services.mjs start --json", "package_must_expose_start");
assert.equal(packageJson.scripts["local:services:stop"], "node scripts/v22-local-services.mjs stop --json", "package_must_expose_stop");
assert.equal(packageJson.scripts["local:services:status"], "node scripts/v22-local-services.mjs status --json", "package_must_expose_status");
assert.equal(packageJson.scripts["local:services:logs"], "node scripts/v22-local-services.mjs logs --json", "package_must_expose_logs");
assert.equal(packageJson.scripts["local:services:verify"], "node scripts/v22-local-services.mjs verify --dry-run --json", "package_must_expose_local_service_verify");
assert.equal(packageJson.scripts["verify:local-release-candidate"], "node scripts/v22-verify.mjs package local-release-candidate --base origin/recovery/platform-v22-trunk", "package_must_expose_local_release_candidate_verify");

const status = jsonFrom(runLocalServices(["status", "--json"]));
assert.equal(status.ok, true, "status_must_be_deterministic_when_services_are_stopped");
assert.equal(status.mode, "status", "status_mode");
assert.equal(status.runtimeDir, ".runtime/local-services", "status_runtime_dir");
assert.equal(status.results.length, plan.services.length, "status_must_cover_all_services");
for (const result of status.results) {
  assert(["stopped", "external"].includes(result.status), `status_must_not_probe_or_spawn:${result.id}`);
  assert.equal(Boolean(result.pid), false, `status_must_not_fabricate_pid:${result.id}`);
}

const startDryRun = jsonFrom(runLocalServices(["start", "--dry-run", "--json"]));
assert.equal(startDryRun.ok, true, "start_dry_run_must_pass");
assert.equal(startDryRun.mode, "start", "start_dry_run_mode");
assert.equal(startDryRun.dryRun, true, "start_dry_run_flag");
assert.equal(startDryRun.results.length, plan.services.length, "start_dry_run_must_cover_all_services");
assert.equal(startDryRun.results.find((result) => result.id === "clean-opl-webui").status, "external_not_started", "clean_opl_must_not_be_started_by_medopl");
for (const result of startDryRun.results.filter((item) => item.id !== "clean-opl-webui")) {
  assert.equal(result.status, "would_start", `start_dry_run_status:${result.id}`);
  assert(result.command, `start_dry_run_must_show_command:${result.id}`);
  assert(result.logFile?.startsWith(".runtime/local-services/"), `start_dry_run_must_use_runtime_logs:${result.id}`);
}

const stopDryRun = jsonFrom(runLocalServices(["stop", "--dry-run", "--json"]));
assert.equal(stopDryRun.ok, true, "stop_dry_run_must_pass");
assert.equal(stopDryRun.mode, "stop", "stop_dry_run_mode");
assert.equal(stopDryRun.dryRun, true, "stop_dry_run_flag");
for (const result of stopDryRun.results) {
  assert(["would_stop_if_running", "external_not_stopped"].includes(result.status), `stop_dry_run_status:${result.id}`);
}

const logsDryRun = jsonFrom(runLocalServices(["logs", "--dry-run", "--json"]));
assert.equal(logsDryRun.ok, true, "logs_dry_run_must_pass");
assert.equal(logsDryRun.mode, "logs", "logs_mode");
assert.equal(logsDryRun.dryRun, true, "logs_dry_run_flag");
for (const result of logsDryRun.results) {
  assert(["log_plan", "external_no_log"].includes(result.status), `logs_dry_run_status:${result.id}`);
  if (result.id !== "clean-opl-webui") assert(result.logFile?.startsWith(".runtime/local-services/"), `logs_must_use_runtime_dir:${result.id}`);
}

const verifyDryRun = jsonFrom(runLocalServices(["verify", "--dry-run", "--json"]));
assert.equal(verifyDryRun.ok, true, "verify_dry_run_must_pass");
assert.equal(verifyDryRun.mode, "verify", "verify_mode");
assert.equal(verifyDryRun.dryRun, true, "verify_dry_run_flag");
assert.deepEqual(verifyDryRun.steps, ["plan", "check", "status"], "verify_must_collect_plan_check_status");
assert.equal(verifyDryRun.check?.dryRun, true, "verify_must_use_dry_run_check_when_requested");

const gatewayPackage = JSON.parse(await readRepoFile("services/opl-web-gateway/package.json"));
assert.equal(gatewayPackage.scripts.start, "node src/server.mjs", "gateway_package_must_have_start_script");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_local_service_orchestration",
  services: [...services.keys()],
}, null, 2));
