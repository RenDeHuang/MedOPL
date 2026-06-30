import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
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

function runLocalProductE2E(args = []) {
  return spawnSync("node", ["scripts/v22-local-product-e2e.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function runLocalProductE2EAsync(args = []) {
  return new Promise((resolve) => {
    const child = spawn("node", ["scripts/v22-local-product-e2e.mjs", ...args], {
      cwd: repoRoot,
      stdio: "pipe",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
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

assert.equal(services.get("portal-frontend").command, "npm --prefix services/portal/frontend run dev -- --host 127.0.0.1", "portal_command_must_use_frontend_package_directly");
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
assertIncludes(scriptSource, "probeServiceUntilReady", "local_services_check_must_wait_for_spawned_services");
assertIncludes(scriptSource, "external_optional_unreachable", "local_services_check_must_not_block_on_external_opl_webui");
assertIncludes(scriptSource, "blockingResults", "local_services_check_must_distinguish_required_and_external_services");

const packageJson = JSON.parse(await readRepoFile("package.json"));
assert.equal(packageJson.scripts["local:services:plan"], "node scripts/v22-local-services.mjs plan --json", "package_must_expose_plan");
assert.equal(packageJson.scripts["local:services:check"], "node scripts/v22-local-services.mjs check --json", "package_must_expose_check");
assert.equal(packageJson.scripts["local:services:check:dry-run"], "node scripts/v22-local-services.mjs check --dry-run --json", "package_must_expose_dry_run_check");
assert.equal(packageJson.scripts["local:services:start"], "node scripts/v22-local-services.mjs start --json", "package_must_expose_start");
assert.equal(packageJson.scripts["local:services:stop"], "node scripts/v22-local-services.mjs stop --json", "package_must_expose_stop");
assert.equal(packageJson.scripts["local:services:status"], "node scripts/v22-local-services.mjs status --json", "package_must_expose_status");
assert.equal(packageJson.scripts["local:services:logs"], "node scripts/v22-local-services.mjs logs --json", "package_must_expose_logs");
assert.equal(packageJson.scripts["local:services:verify"], "node scripts/v22-local-services.mjs verify --dry-run --json", "package_must_expose_local_service_verify");
assert.equal(packageJson.scripts["local:product:e2e"], "node scripts/v22-local-product-e2e.mjs --dry-run --json", "package_must_expose_local_product_e2e");
assert.equal(packageJson.scripts["local:product:e2e:execute"], "node scripts/v22-local-product-e2e.mjs --execute --json", "package_must_expose_local_product_e2e_execute");
assert.equal(packageJson.scripts["verify:local-release-candidate"], "node scripts/v22-verify.mjs package local-release-candidate --base origin/recovery/platform-v22-trunk", "package_must_expose_local_release_candidate_verify");

const e2ePlan = jsonFrom(runLocalProductE2E(["--dry-run", "--json"]));
assert.equal(e2ePlan.ok, true, "local_product_e2e_dry_run_must_pass");
assert.equal(e2ePlan.kind, "v22_local_product_e2e_runner", "local_product_e2e_kind");
assert.equal(e2ePlan.coverageMode, "go_backend_local_product_api", "local_product_e2e_must_declare_backend_api_coverage");
assert.equal(e2ePlan.ownerBoundary?.directOwner, "services/medopl-go-backend", "local_product_e2e_direct_owner");
assert.deepEqual(e2ePlan.ownerBoundary?.requiredRunningServices, ["go-backend"], "local_product_e2e_required_services");
assert.deepEqual(e2ePlan.ownerBoundary?.topologyServicesNotProbed, [
  "portal-frontend",
  "opl-web-gateway",
  "runtime-bridge",
  "clean-opl-webui",
], "local_product_e2e_must_not_overclaim_topology_services");
assert.equal(e2ePlan.executionMode, "dry-run", "local_product_e2e_must_default_dry_run");
assert.equal(e2ePlan.executesRequests, false, "local_product_e2e_dry_run_must_not_execute_requests");
assert.equal(e2ePlan.evidenceRef.startsWith(".runtime/local-product-e2e/"), true, "local_product_e2e_evidence_ref_must_be_runtime_pointer");
assert.equal(e2ePlan.canClaim, "Go backend local product API plan only", "local_product_e2e_dry_run_claim_must_be_precise");
assert.equal(e2ePlan.singleFlowEvidence?.kind, "v22_local_product_single_flow_evidence", "local_product_single_flow_evidence_kind");
assert.equal(e2ePlan.singleFlowEvidence?.owner, "services/medopl-go-backend", "local_product_single_flow_evidence_owner");
assert.equal(e2ePlan.singleFlowEvidence?.evidenceCompleteness, "planned", "local_product_single_flow_evidence_dry_run_completeness");
assert.equal(e2ePlan.singleFlowEvidence?.evidenceRef, e2ePlan.evidenceRef, "local_product_single_flow_evidence_must_point_to_report");
assert.deepEqual(e2ePlan.singleFlowEvidence?.requiredEvidence.map((item) => item.id), [
  "runtime_open",
  "storage_ready",
  "file_upload",
  "run_task",
  "artifact_projection",
  "billing_audit_projection",
  "release_runtime_stop_billing",
  "storage_destroy_intent",
], "local_product_single_flow_required_evidence_ids");
for (const item of e2ePlan.singleFlowEvidence.requiredEvidence) {
  assert.equal(item.status, "planned", `local_product_single_flow_dry_run_status:${item.id}`);
  assert(item.stepId, `local_product_single_flow_must_bind_step:${item.id}`);
  assert(Array.isArray(item.requiredFields), `local_product_single_flow_must_list_fields:${item.id}`);
}
for (const forbiddenClaim of [
  "Portal browser E2E coverage",
  "Gateway direct route coverage",
  "Runtime Bridge direct route coverage",
  "clean OPL WebUI availability",
]) {
  assert(e2ePlan.cannotClaim.includes(forbiddenClaim), `local_product_e2e_cannot_claim:${forbiddenClaim}`);
}
assert.deepEqual(e2ePlan.steps.map((step) => step.id), [
  "backend-health",
  "bind-provider-key",
  "managed-environment-readiness",
  "open-runtime",
  "runtime-gate",
  "upload-file",
  "run-task",
  "fetch-artifact",
  "billing-summary",
  "resource-projection",
  "release-runtime",
  "destroy-storage",
], "local_product_e2e_steps_mismatch");
for (const step of e2ePlan.steps) {
  assert.equal(step.status, "planned", `local_product_e2e_dry_run_step_status:${step.id}`);
}
assert.equal(JSON.stringify(e2ePlan).includes("local-rc-provider-key-material-that-must-stay-private"), false, "local_product_e2e_must_not_emit_raw_provider_key");

const e2eBlocked = runLocalProductE2E(["--execute", "--json", "--base-url", "http://127.0.0.1:1"]);
assert.equal(e2eBlocked.status, 1, "local_product_e2e_unreachable_backend_must_fail_closed");
const e2eBlockedPayload = JSON.parse(e2eBlocked.stdout);
assert.equal(e2eBlockedPayload.ok, false, "local_product_e2e_unreachable_payload_must_fail");
assert.equal(e2eBlockedPayload.blocker?.type, "local_service_unreachable", "local_product_e2e_unreachable_blocker_type");
assert.equal(e2eBlockedPayload.executesRequests, true, "local_product_e2e_execute_must_attempt_requests");
assert.equal(e2eBlockedPayload.singleFlowEvidence?.evidenceCompleteness, "blocked", "local_product_e2e_unreachable_must_block_evidence");

const incompleteEvidenceBackend = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
  const send = (status, payload) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(`${JSON.stringify(payload)}\n`);
  };
  if (request.method === "GET" && url.pathname === "/healthz") return send(200, { ok: true });
  if (request.method === "POST" && url.pathname === "/api/v22/provider-key") {
    if (body.apiKey !== "local-rc-provider-key-material-that-must-stay-private") {
      return send(500, { ok: false, error: "mock_assertion_failed", detail: "provider_key_mismatch" });
    }
    return send(200, { ok: true, providerKeyRef: "provider-key-ref-local" });
  }
  if (request.method === "POST" && url.pathname === "/api/v22/managed-environment/readiness") {
    return send(200, { ok: true, readyForManagedEnvironment: true, providerBound: true });
  }
  if (request.method === "POST" && url.pathname === "/api/v22/managed-environment/open") {
    return send(200, {
      ok: true,
      launchId: "launch-local",
      resourceBindingId: "resource-local",
      status: "ready",
      providerKeyRef: "provider-key-ref-local",
    });
  }
  if (request.method === "POST" && url.pathname === "/api/opl/runtime-gate") {
    return send(200, {
      ok: true,
      storageBindingId: "storage-local",
      runtimeBindingId: "resource-local",
      runtimeState: "ready",
      nextAction: "run_in_opl_webui_with_medopl_runtime",
    });
  }
  return send(404, { ok: false, error: "not_found", path: url.pathname });
});
await new Promise((resolve) => incompleteEvidenceBackend.listen(0, "127.0.0.1", resolve));
try {
  const { port } = incompleteEvidenceBackend.address();
  const e2eIncomplete = await runLocalProductE2EAsync(["--execute", "--json", "--base-url", `http://127.0.0.1:${port}`]);
  assert.equal(e2eIncomplete.status, 1, "local_product_e2e_missing_evidence_field_must_fail");
  const incompletePayload = JSON.parse(e2eIncomplete.stdout);
  assert.equal(incompletePayload.ok, false, "local_product_e2e_missing_evidence_payload_must_fail");
  assert.equal(incompletePayload.singleFlowEvidence?.evidenceCompleteness, "blocked", "local_product_e2e_missing_evidence_must_block_evidence");
  const incompleteEvidence = new Map(incompletePayload.singleFlowEvidence.requiredEvidence.map((item) => [item.id, item]));
  assert.equal(incompleteEvidence.get("runtime_open").status, "passed", "local_product_e2e_must_keep_completed_evidence");
  assert.equal(incompleteEvidence.get("storage_ready").status, "blocked", "local_product_e2e_must_block_missing_evidence");
  assert.match(incompletePayload.blocker?.detail || "", /local_product_e2e_missing_evidence_field:storage_ready:storageState/u, "local_product_e2e_must_report_missing_field");
} finally {
  await new Promise((resolve) => incompleteEvidenceBackend.close(resolve));
}

const mockBackend = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
  const send = (status, payload) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(`${JSON.stringify(payload)}\n`);
  };
  if (request.method === "GET" && url.pathname === "/healthz") return send(200, { ok: true });
  if (request.method === "POST" && url.pathname === "/api/v22/provider-key") {
    if (body.apiKey !== "local-rc-provider-key-material-that-must-stay-private") {
      return send(500, { ok: false, error: "mock_assertion_failed", detail: "provider_key_mismatch" });
    }
    return send(200, { ok: true, providerKeyRef: "provider-key-ref-local" });
  }
  if (request.method === "POST" && url.pathname === "/api/v22/managed-environment/readiness") {
    return send(200, { ok: true, readyForManagedEnvironment: true, providerBound: true });
  }
  if (request.method === "POST" && url.pathname === "/api/v22/managed-environment/open") {
    return send(200, {
      ok: true,
      launchId: "launch-local",
      resourceBindingId: "resource-local",
      status: "ready",
      providerKeyRef: "provider-key-ref-local",
    });
  }
  if (request.method === "POST" && url.pathname === "/api/opl/runtime-gate") {
    return send(200, {
      ok: true,
      storageBindingId: "storage-local",
      runtimeBindingId: "resource-local",
      runtimeState: "ready",
      storageState: "ready",
      nodePoolProjection: { state: "ready", customerVisible: false },
      consumerProjection: {
        uploadEnabled: true,
        runEnabled: true,
        artifactEnabled: true,
        releaseAction: "release_runtime_stop_billing",
        storageAction: "retain_storage_until_explicit_destroy",
      },
      nextAction: "run_in_opl_webui_with_medopl_runtime",
    });
  }
  if (request.method === "POST" && url.pathname === "/api/opl/files") {
    if (url.searchParams.get("launchId") !== "launch-local") {
      return send(500, { ok: false, error: "mock_assertion_failed", detail: "upload_launch_mismatch" });
    }
    return send(200, {
      ok: true,
      fileRef: "file-local",
      workspaceId: "workspace-v22",
      providerKeyRef: "provider-key-ref-local",
      file: {
        relativePath: "inputs/measurements.csv",
        status: "available",
      },
    });
  }
  if (request.method === "POST" && url.pathname === "/api/opl/runs") {
    return send(200, {
      ok: true,
      status: "succeeded",
      run: { runRef: "run-local", status: "succeeded" },
      artifacts: [{
        artifactRef: "artifact-local",
        workspaceId: "workspace-v22",
        providerKeyRef: "provider-key-ref-local",
        kind: "outputs",
      }],
    });
  }
  if (request.method === "GET" && url.pathname === "/api/opl/artifacts/artifact-local") {
    return send(200, {
      ok: true,
      artifactRef: "artifact-local",
      artifact: {
        artifactRef: "artifact-local",
        workspaceId: "workspace-v22",
        providerKeyRef: "provider-key-ref-local",
        kind: "outputs",
        relativePath: "outputs/result.md",
        contentType: "text/markdown",
      },
    });
  }
  if (request.method === "GET" && url.pathname === "/api/billing/summary") {
    return send(200, {
      ok: true,
      source: "go-control-plane",
      summary: { runCount: 1 },
      ledger: [
        { id: "audit-run-local", type: "debit", sourceEventType: "run_succeeded" },
        { id: "audit-artifact-local", type: "debit", sourceEventType: "artifact_available" },
      ],
    });
  }
  if (request.method === "GET" && url.pathname === "/api/platform-provisioned-resources") {
    return send(200, { ok: true, summary: { activeEnvironments: 1 } });
  }
  if (request.method === "POST" && url.pathname === "/api/v22/managed-environment/release") {
    return send(200, {
      ok: true,
      status: "released",
      billingStopped: true,
      auditEvent: { id: "audit-release-local", kind: "resource_release", status: "recorded" },
      receipts: {
        runtimeStopped: "recorded",
        billingSettlement: "stopped",
        storageDestroyReceipt: "pending_explicit_user_intent",
      },
    });
  }
  if (request.method === "POST" && url.pathname === "/api/v22/storage/destroy") {
    return send(200, {
      ok: true,
      storageDestroyed: true,
      billingStopped: true,
      storageState: "destroyed",
      auditEvent: { id: "audit-storage-destroy-local", kind: "storage_destroy", status: "recorded" },
      releaseReceipts: {
        storageDestroyReceipt: "recorded",
        billingSettlement: "stopped",
      },
    });
  }
  return send(404, { ok: false, error: "not_found", path: url.pathname });
});
await new Promise((resolve) => mockBackend.listen(0, "127.0.0.1", resolve));
try {
  const { port } = mockBackend.address();
  const e2eExecuted = await runLocalProductE2EAsync(["--execute", "--json", "--base-url", `http://127.0.0.1:${port}`]);
  assert.equal(e2eExecuted.status, 0, e2eExecuted.stderr || e2eExecuted.stdout);
  const executedPayload = JSON.parse(e2eExecuted.stdout);
  assert.equal(executedPayload.singleFlowEvidence?.evidenceCompleteness, "complete", "local_product_single_flow_execute_must_complete_evidence");
  const evidence = new Map(executedPayload.singleFlowEvidence.requiredEvidence.map((item) => [item.id, item]));
  assert.equal(evidence.get("storage_ready").fields.runtimeState, "ready", "single_flow_runtime_must_be_ready");
  assert.equal(evidence.get("storage_ready").fields.storageState, "ready", "single_flow_storage_must_be_ready");
  assert.equal(evidence.get("file_upload").fields.fileStatus, "available", "single_flow_file_must_be_available");
  assert.equal(evidence.get("run_task").fields.status, "succeeded", "single_flow_run_must_succeed");
  assert.equal(evidence.get("artifact_projection").fields.kind, "outputs", "single_flow_artifact_kind");
  assert.equal(evidence.get("billing_audit_projection").fields.runCount, 1, "single_flow_billing_run_count");
  assert.equal(evidence.get("billing_audit_projection").fields.ledgerCount, 2, "single_flow_billing_ledger_count");
  assert.equal(evidence.get("release_runtime_stop_billing").fields.billingStopped, true, "single_flow_release_must_stop_billing");
  assert.equal(evidence.get("release_runtime_stop_billing").fields.billingSettlement, "stopped", "single_flow_release_billing_settlement");
  assert.equal(evidence.get("release_runtime_stop_billing").fields.storageDestroyReceipt, "pending_explicit_user_intent", "single_flow_release_storage_destroy_must_wait_for_intent");
  assert.equal(evidence.get("storage_destroy_intent").fields.storageDestroyed, true, "single_flow_destroy_must_record_storage_destroy");
  assert.equal(evidence.get("storage_destroy_intent").fields.storageDestroyReceipt, "recorded", "single_flow_destroy_receipt");
  assert.equal(JSON.stringify(executedPayload).includes("local-rc-provider-key-material-that-must-stay-private"), false, "local_product_e2e_execute_must_not_emit_raw_provider_key");
} finally {
  await new Promise((resolve) => mockBackend.close(resolve));
}

const status = jsonFrom(runLocalServices(["status", "--json"]));
assert.equal(typeof status.ok, "boolean", "status_must_return_boolean_ok");
assert.equal(status.mode, "status", "status_mode");
assert.equal(status.runtimeDir, ".runtime/local-services", "status_runtime_dir");
assert.equal(status.results.length, plan.services.length, "status_must_cover_all_services");
for (const result of status.results) {
  assert(["stopped", "running", "exited", "external"].includes(result.status), `status_must_not_probe_or_spawn:${result.id}`);
  assert.notEqual(result.status, "reachable", `status_must_not_probe:${result.id}`);
  assert.notEqual(result.status, "unreachable", `status_must_not_probe:${result.id}`);
  if (result.status === "stopped" || result.status === "external") {
    assert.equal(Boolean(result.pid), false, `status_must_not_fabricate_pid:${result.id}`);
  }
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
