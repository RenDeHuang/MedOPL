import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const RAW_PROVIDER_KEY = "test-only-go-control-plane-provider-key-material";
const WORKSPACE_ID = "workspace-v22-opl-work-go";
const TENANT_ID = "tenant-v22-opl-work-go";
const USER_ID = "user-v22-opl-work-go";
const PROVIDER_REF_PATTERN = /^gflab:/u;
const PUBLIC_FORBIDDEN_PATTERN = /rawProviderKey|providerApiKey|apiKey|launchToken|runtimeToken|bearerToken|providerSecret|SecretId|SecretKey|objectKey|storageKey|localPath|signedUrl|presignedUrl/i;

function scrubbedEnv(overrides = {}) {
  const env = { ...process.env, ...overrides };
  for (const key of [
    "GFLABTOKEN",
    "OPENAI_API_KEY",
    "OPL_CODEX_API_KEY",
    "TENCENTCLOUD_SECRET_ID",
    "TENCENTCLOUD_SECRET_KEY",
    "COS_SECRET_ID",
    "COS_SECRET_KEY",
  ]) {
    delete env[key];
  }
  return env;
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

function buildGoBackendBinary(outputPath) {
  const result = spawnSync("go", ["build", "-o", outputPath, "./cmd/server"], {
    cwd: "services/medopl-go-backend",
    env: scrubbedEnv({
      GOPROXY: process.env.GOPROXY || "https://goproxy.cn,direct",
      GOSUMDB: process.env.GOSUMDB || "sum.golang.google.cn",
    }),
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `go_backend_build_failed:${result.stderr || result.stdout}`);
}

function spawnGoBackend({ binaryPath, port, providerSecretRoot }) {
  const child = spawn(binaryPath, [], {
    env: scrubbedEnv({
      MEDOPL_BACKEND_MODE: "local",
      MEDOPL_BACKEND_PORT: String(port),
      PORTAL_OPL_PROVIDER_SECRET_ROOT: providerSecretRoot,
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  return child;
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(1500).then(() => child.kill("SIGKILL")),
  ]);
}

async function waitFor(url, { timeoutMs = 5000 } = {}) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status >= 200 && response.status < 500) return response;
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`wait_for_url_failed:${url}:${lastError?.message || "timeout"}`);
}

async function waitForChildUrl(child, url, label) {
  try {
    return await waitFor(url);
  } catch (error) {
    throw new Error(`${label}:${error.message}:stdout=${child.stdout.read() || ""}:stderr=${child.stderr.read() || ""}`);
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { response, json };
}

async function getJson(url) {
  const response = await fetch(url);
  const json = await response.json();
  return { response, json };
}

function assertNoPublicSecretLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(PUBLIC_FORBIDDEN_PATTERN.test(serialized), false, `${label}_must_not_expose_secret_or_storage_fields`);
}

function assertLocalSource(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(/production evidence|production truth|live provider|real cloud|deploy|kubectl/i.test(serialized), false, `${label}_must_not_claim_production_truth`);
}

function normalizeRef(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "");
}

async function assertBackendOnlySecret(secretRoot, providerKeyRef) {
  const secretFile = path.join(secretRoot, `${normalizeRef(providerKeyRef)}.json`);
  const payload = JSON.parse(await readFile(secretFile, "utf8"));
  assert.equal(payload.provider, "gflabtoken", "backend_secret_provider_mismatch");
  assert.equal(payload.source, "user_input", "backend_secret_source_mismatch");
  assert.equal(payload.apiKey, RAW_PROVIDER_KEY, "backend_secret_must_hold_raw_key_inside_backend_boundary");
  const mode = (await stat(secretFile)).mode & 0o777;
  assert.equal(mode, 0o600, "backend_secret_file_mode_must_be_0600");
  assert.deepEqual(await readdir(secretRoot), [path.basename(secretFile)], "backend_secret_root_must_only_contain_provider_ref_file");
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-go-opl-work-regression-"));
const providerSecretRoot = path.join(tempRoot, "provider-secrets");
const binaryPath = path.join(tempRoot, "medopl-go-backend-regression");
let goBackend;

try {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  buildGoBackendBinary(binaryPath);
  goBackend = spawnGoBackend({ binaryPath, port, providerSecretRoot });
  await waitForChildUrl(goBackend, `${baseUrl}/health`, "go_backend_health");

  const prepared = await postJson(`${baseUrl}/api/v22/users/prepare`, {
    tenantId: TENANT_ID,
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
  });
  assert.equal(prepared.response.status, 200, "prepare_user_must_return_200");
  assert.equal(prepared.json.source, "go-control-plane", "prepare_user_source_mismatch");
  assertNoPublicSecretLeak(prepared.json, "prepare_user");

  const approved = await postJson(`${baseUrl}/api/v22/users/approve`, {
    tenantId: TENANT_ID,
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
  });
  assert.equal(approved.response.status, 200, "approve_user_must_return_200");
  assert.equal(approved.json.status, "approved", "approve_user_status_mismatch");
  assert.equal(approved.json.source, "go-control-plane", "approve_user_source_mismatch");
  assertNoPublicSecretLeak(approved.json, "approve_user");

  const credited = await postJson(`${baseUrl}/api/v22/users/credit`, {
    userId: USER_ID,
    amount: 500,
    idempotencyKey: "go-opl-work-credit-once",
  });
  assert.equal(credited.response.status, 200, "credit_must_return_200");
  assert.equal(credited.json.source, "go-control-plane", "credit_source_mismatch");
  assertNoPublicSecretLeak(credited.json, "credit");

  const blockedReadiness = await postJson(`${baseUrl}/api/v22/managed-environment/readiness`, {
    workspaceId: WORKSPACE_ID,
  });
  assert.equal(blockedReadiness.response.status, 428, "readiness_without_provider_must_fail_closed");
  assert.equal(blockedReadiness.json.error, "provider_key_required", "readiness_without_provider_error_mismatch");
  assertNoPublicSecretLeak(blockedReadiness.json, "readiness_without_provider");

  const bound = await postJson(`${baseUrl}/api/v22/provider-key`, {
    tenantId: TENANT_ID,
    portalUserId: USER_ID,
    workspaceId: WORKSPACE_ID,
    apiKey: RAW_PROVIDER_KEY,
    idempotencyKey: "go-opl-work-provider-key-once",
  });
  assert.equal(bound.response.status, 200, "provider_key_must_return_200");
  assert.equal(bound.json.providerBound, true, "provider_key_must_mark_bound");
  assert.match(bound.json.providerKeyRef, PROVIDER_REF_PATTERN, "provider_key_ref_shape_mismatch");
  assertNoPublicSecretLeak(bound.json, "provider_key_binding");
  await assertBackendOnlySecret(providerSecretRoot, bound.json.providerKeyRef);

  const readiness = await postJson(`${baseUrl}/api/v22/managed-environment/readiness`, {
    workspaceId: WORKSPACE_ID,
  });
  assert.equal(readiness.response.status, 200, "readiness_after_provider_must_return_200");
  assert.equal(readiness.json.readyForManagedEnvironment, true, "readiness_after_provider_must_be_ready");
  assert.equal(readiness.json.providerKeyRef, bound.json.providerKeyRef, "readiness_provider_ref_mismatch");
  assertNoPublicSecretLeak(readiness.json, "readiness_after_provider");

  const opened = await postJson(`${baseUrl}/api/v22/managed-environment/open`, {
    tenantId: TENANT_ID,
    portalUserId: USER_ID,
    workspaceId: WORKSPACE_ID,
    idempotencyKey: "go-opl-work-open-once",
  });
  assert.equal(opened.response.status, 200, "managed_environment_open_must_return_200");
  assert.equal(opened.json.launchStatus, "ready", "managed_environment_open_status_mismatch");
  assert.equal(opened.json.providerKeyRef, bound.json.providerKeyRef, "open_provider_ref_mismatch");
  assertNoPublicSecretLeak(opened.json, "managed_environment_open");
  const launchId = opened.json.launchId;

  const bootstrap = await getJson(`${baseUrl}/api/opl/bootstrap?launchId=${encodeURIComponent(launchId)}`);
  assert.equal(bootstrap.response.status, 200, "bootstrap_must_return_200");
  assert.equal(bootstrap.json.runtimeBridgeContractVersion, "v22-local-rc", "bootstrap_contract_version_mismatch");
  assertNoPublicSecretLeak(bootstrap.json, "bootstrap");

  const file = await postJson(`${baseUrl}/api/opl/files?launchId=${encodeURIComponent(launchId)}`, {
    fileName: "measurements.csv",
    relativePath: "inputs/measurements.csv",
    contentType: "text/csv",
    sizeBytes: 128,
  });
  assert.equal(file.response.status, 200, "file_record_must_return_200");
  assert.equal(file.json.ok, true, "file_record_must_return_ok");
  assert.equal(file.json.providerKeyRef, bound.json.providerKeyRef, "file_provider_ref_mismatch");
  assertNoPublicSecretLeak(file.json, "file_record");

  const missingFileRun = await postJson(`${baseUrl}/api/opl/runs?launchId=${encodeURIComponent(launchId)}`, {
    message: "analyze missing MedOPL storage file",
    fileRefs: ["file-missing"],
    toolName: "opl-workbench",
    requestId: "go-opl-work-run-missing-file",
  });
  assert.equal(missingFileRun.response.status, 400, "run_with_unknown_file_ref_must_fail_closed");
  assert.equal(missingFileRun.json.error, "file_ref_required", "run_with_unknown_file_ref_error_mismatch");
  assertNoPublicSecretLeak(missingFileRun.json, "run_with_unknown_file_ref");

  const run = await postJson(`${baseUrl}/api/opl/runs?launchId=${encodeURIComponent(launchId)}`, {
    message: "analyze uploaded measurement data",
    fileRefs: [file.json.fileRef],
    toolName: "opl-workbench",
    requestId: "go-opl-work-run-once",
  });
  assert.equal(run.response.status, 200, "run_must_return_200");
  assert.equal(run.json.ok, true, "run_must_return_ok");
  assert.equal(run.json.status, "succeeded", "run_status_mismatch");
  assert.equal(run.json.artifacts.length, 1, "run_must_create_artifact");
  assert.equal(run.json.artifacts[0].providerKeyRef, bound.json.providerKeyRef, "artifact_provider_ref_mismatch");
  assertNoPublicSecretLeak(run.json, "run");

  const artifact = await getJson(`${baseUrl}/api/opl/artifacts/${encodeURIComponent(run.json.artifacts[0].artifactRef)}?launchId=${encodeURIComponent(launchId)}`);
  assert.equal(artifact.response.status, 200, "artifact_must_return_200");
  assert.equal(artifact.json.artifact.providerKeyRef, bound.json.providerKeyRef, "artifact_detail_provider_ref_mismatch");
  assertNoPublicSecretLeak(artifact.json, "artifact");

  const missingArtifact = await getJson(`${baseUrl}/api/opl/artifacts/artifact-missing?launchId=${encodeURIComponent(launchId)}`);
  assert.equal(missingArtifact.response.status, 400, "unknown_artifact_ref_must_fail_closed");
  assert.equal(missingArtifact.json.error, "artifact_ref_required", "unknown_artifact_error_mismatch");
  assertNoPublicSecretLeak(missingArtifact.json, "unknown_artifact");

  const billing = await getJson(`${baseUrl}/api/billing/summary?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`);
  assert.equal(billing.response.status, 200, "billing_must_return_200");
  assert.equal(billing.json.source, "go-control-plane", "billing_source_mismatch");
  assert.equal(Number(billing.json.totals.totalCost) > 0, true, "billing_total_cost_required");
  const ledgerSourceEvents = new Set((billing.json.ledger || []).map((item) => item.sourceEventType));
  const allowedLedgerTypes = new Set(["credit", "debit", "hold", "release", "refund", "adjustment"]);
  for (const entry of billing.json.ledger || []) {
    assert.equal(allowedLedgerTypes.has(entry.type), true, `billing_ledger_type_must_follow_contract:${entry.type}`);
  }
  for (const requiredEvent of ["file.upload", "run.succeeded", "artifact.available"]) {
    assert.equal(ledgerSourceEvents.has(requiredEvent), true, `billing_ledger_missing_source_event_${requiredEvent}`);
  }
  assertNoPublicSecretLeak(billing.json, "billing");

  const release = await postJson(`${baseUrl}/api/v22/managed-environment/release`, {
    workspaceId: WORKSPACE_ID,
    resourceBindingId: opened.json.resourceBindingId,
    stopBilling: true,
    idempotencyKey: "go-opl-work-release-once",
  });
  assert.equal(release.response.status, 200, "release_must_return_200");
  assert.equal(release.json.billingStopped, true, "release_must_stop_billing");
  assert.equal(release.json.auditEvent.status, "recorded", "release_must_record_audit");
  assertNoPublicSecretLeak(release.json, "release");

  const resources = await getJson(`${baseUrl}/api/platform-provisioned-resources?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`);
  assert.equal(resources.response.status, 200, "resources_must_return_200");
  assert.equal(resources.json.items.some((item) => item.resourceBindingId === opened.json.resourceBindingId && item.status === "released"), true, "resources_must_project_released_environment");
  assertNoPublicSecretLeak(resources.json, "resources");
  assertLocalSource({ prepared: prepared.json, opened: opened.json, billing: billing.json, release: release.json }, "go_opl_work_regression");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_go_control_plane_opl_file_run_artifact_billing_release_flow",
    goControlPlaneUrl: baseUrl,
    launchId,
    artifactRef: run.json.artifacts[0].artifactRef,
    evidenceBoundary: "local-regression-only",
  }, null, 2));
} finally {
  await stopChild(goBackend);
  await rm(tempRoot, { recursive: true, force: true });
}
