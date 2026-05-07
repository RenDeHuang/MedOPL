import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { createRunApi } = await import("../services/opl-runtime-bridge/src/runtime-bridge-runs.mjs");
const { emptyState } = await import("../services/opl-runtime-bridge/src/state-store.mjs");

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_runtime_bridge_must_not_cross_boundary";
const RAW_PROMPT = "raw OPL workbench prompt must stay outside runtime bridge contract metadata";

function cloneState() {
  return JSON.parse(JSON.stringify(emptyState));
}

function assertNoSecretLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(serialized.includes(RAW_PROMPT), false, `${label}_must_not_leak_raw_prompt`);
  assert.equal(/rawApiKey|providerSecret|apiKey|launchToken|runtimeToken|bearerToken/i.test(serialized), false, `${label}_must_not_expose_secret_fields`);
}

function assertNoCredentialLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(/rawApiKey|providerSecret|apiKey|launchToken|runtimeToken|bearerToken/i.test(serialized), false, `${label}_must_not_expose_secret_fields`);
}

function assertNoInternalFileLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(/storageKey|objectKey|signedUrl|presignedUrl|localPath|pathOnRuntime/i.test(serialized), false, `${label}_must_not_expose_internal_file_fields`);
}

function assertPublicArtifactShape(artifact, label) {
  assert.deepEqual(Object.keys(artifact).sort(), [
    "artifactId",
    "artifactRef",
    "contentType",
    "kind",
    "name",
    "providerKeyRef",
    "relativePath",
    "resourceBindingId",
    "runId",
    "sizeBytes",
    "workspaceId",
  ], `${label}_artifact_public_keys_mismatch`);
  assert.equal(artifact.kind, "outputs", `${label}_artifact_kind_mismatch`);
  assert.equal(artifact.relativePath, "outputs/result.csv", `${label}_artifact_relative_path_mismatch`);
  assert.equal(artifact.workspaceId, "workspace-runtime-bridge-v22", `${label}_artifact_workspace_mismatch`);
  assert.equal(artifact.resourceBindingId, "binding-runtime-bridge-v22", `${label}_artifact_resource_binding_mismatch`);
  assert.equal(artifact.providerKeyRef, "provider-key-ref-runtime-bridge-v22", `${label}_artifact_provider_key_ref_mismatch`);
  assert.ok(artifact.artifactRef, `${label}_artifact_ref_required`);
  assertNoSecretLeak(artifact, `${label}_artifact`);
  assertNoInternalFileLeak(artifact, `${label}_artifact`);
}

const relayCalls = [];
const runtimeAgentRelay = {
  async relayRun({ runtimeSession, input }) {
    relayCalls.push({ runtimeSession, input });
    assert.equal(input.providerKeyRef, "provider-key-ref-runtime-bridge-v22", "relay_input_provider_key_ref_mismatch");
    assert.equal(input.fileRefs[0], "workspace-file-ref-runtime-bridge-v22", "relay_input_file_ref_mismatch");
    assert.equal(input.mode, "full_runtime", "relay_input_mode_mismatch");
    assertNoCredentialLeak(input, "relay_input");
    return {
      run: {
        runId: input.runId,
        traceId: input.traceId,
        kind: "opl-workbench-run",
        toolName: "opl-workbench",
        status: "succeeded",
      },
      artifacts: [{
        kind: "outputs",
        name: "result.csv",
        relativePath: "outputs/result.csv",
        objectKey: "internal/object/key/must/not/be/public",
        localPath: "/runtime/private/output/result.csv",
        sizeBytes: 128,
        contentType: "text/csv",
      }],
      ledgerEntries: [{
        eventType: "runtime_run_succeeded",
        rawPayload: {
          runId: input.runId,
          fileRefs: input.fileRefs,
          status: "succeeded",
        },
        artifactRefs: ["outputs/result.csv"],
      }],
      runtimeTokenClaims: {
        runtimeSessionId: input.runtimeSessionId,
        workspaceId: input.workspaceId,
        providerKeyRef: input.providerKeyRef,
      },
    };
  },
  async cancelRun() {
    throw new Error("cancel_not_used_in_contract_smoke");
  },
};

const state = cloneState();
const runtimeSession = {
  tenantId: "tenant-runtime-bridge-v22",
  portalUserId: "user-runtime-bridge-v22",
  ownerId: "user-runtime-bridge-v22",
  workspaceId: "workspace-runtime-bridge-v22",
  workspaceSessionId: "workspace-session-runtime-bridge-v22",
  runtimeSessionId: "runtime-session-runtime-bridge-v22",
  mode: "full_runtime",
  resourceBindingId: "binding-runtime-bridge-v22",
  computeInstanceId: "compute-runtime-bridge-v22",
  storageBucketId: "storage-runtime-bridge-v22",
  runtimeAgentId: "runtime-agent-runtime-bridge-v22",
  providerConfigured: true,
  providerConfigStatus: "configured",
  providerKeyRef: "provider-key-ref-runtime-bridge-v22",
  providerConfigSecretRef: "provider-key-ref-runtime-bridge-v22",
};

const input = {
  mode: "full_runtime",
  runId: "run-runtime-bridge-v22",
  traceId: "trace-runtime-bridge-v22",
  runtimeSessionId: runtimeSession.runtimeSessionId,
  workspaceId: runtimeSession.workspaceId,
  resourceBindingId: runtimeSession.resourceBindingId,
  computeInstanceId: runtimeSession.computeInstanceId,
  storageBucketId: runtimeSession.storageBucketId,
  runtimeAgentId: runtimeSession.runtimeAgentId,
  providerKeyRef: runtimeSession.providerKeyRef,
  message: RAW_PROMPT,
  fileRefs: ["workspace-file-ref-runtime-bridge-v22"],
  idempotencyKey: "runtime-bridge-contract-run-once",
};

const runApi = createRunApi({ runtimeAgentRelay });
const run = await runApi.submitRuntimeRun(state, runtimeSession, input, {
  headers: { "user-agent": "runtime-bridge-contract-smoke" },
});

assert.equal(relayCalls.length, 1, "runtime_agent_relay_must_be_called_once");
assert.equal(run.runId, "run-runtime-bridge-v22", "run_id_mismatch");
assert.equal(run.traceId, "trace-runtime-bridge-v22", "trace_id_mismatch");
assert.equal(run.status, "succeeded", "run_status_mismatch");
assert.equal(run.workspaceId, "workspace-runtime-bridge-v22", "run_workspace_mismatch");
assert.equal(run.runtimeSessionId, "runtime-session-runtime-bridge-v22", "run_runtime_session_mismatch");
assert.equal(run.resourceBindingId, "binding-runtime-bridge-v22", "run_resource_binding_mismatch");
assert.equal(run.providerKeyRef, "provider-key-ref-runtime-bridge-v22", "run_provider_key_ref_mismatch");
assert.equal(run.ledgerEntryCount, 1, "run_ledger_entry_count_mismatch");
assert.equal("ledgerEntries" in run, false, "run_response_must_not_expose_raw_ledger_entries");
assert.equal(Array.isArray(run.artifacts), true, "run_artifacts_must_be_array");
assert.equal(run.artifacts.length, 1, "run_must_return_one_public_artifact");
assertPublicArtifactShape(run.artifacts[0], "run_response");
assert.deepEqual(run.runtimeClaims, {
  runtimeSessionId: "runtime-session-runtime-bridge-v22",
  workspaceId: "workspace-runtime-bridge-v22",
  providerKeyRef: "provider-key-ref-runtime-bridge-v22",
}, "runtime_claims_mismatch");
assertNoSecretLeak(run, "run_response");
assertNoInternalFileLeak(run, "run_response");

assert.equal(state.runs.length, 1, "state_run_must_be_persisted");
assert.equal(state.runs[0].providerKeyRef, "provider-key-ref-runtime-bridge-v22", "state_run_provider_key_ref_mismatch");
assert.equal(state.artifacts.length, 1, "state_artifact_must_be_persisted");
assert.equal(state.artifacts[0].objectKey, "internal/object/key/must/not/be/public", "state_artifact_must_keep_internal_object_key_backend_only");
assert.equal(state.artifacts[0].providerKeyRef, "provider-key-ref-runtime-bridge-v22", "state_artifact_provider_key_ref_mismatch");
assert.equal(state.sessionLedgerEntries.length, 1, "state_session_ledger_must_be_persisted");
assert.equal(state.sessionLedgerEntries[0].runtimeSessionId, "runtime-session-runtime-bridge-v22", "ledger_runtime_session_mismatch");
assert.equal(state.sessionLedgerEntries[0].runId, "run-runtime-bridge-v22", "ledger_run_mismatch");
assert.equal(state.sessionLedgerEntries[0].artifactRefs[0], run.artifacts[0].artifactRef, "ledger_artifact_ref_mismatch");
assertNoSecretLeak(state.runs, "state_runs");
assertNoSecretLeak(state.sessionLedgerEntries, "state_session_ledger");

const contract = await readFile("docs/contracts/v22-runtime-bridge-session-run-file-provider-keyref-boundary.md", "utf8");
for (const required of [
  "POST /api/opl-launch/runs",
  "POST /api/opl-launch/sessions/bind",
  "providerKeyRef",
  "resourceBindingId",
  "workspace file reference",
  "artifact reference",
  "storageKey",
  "objectKey",
  "localPath",
  "launchToken",
  "runtimeToken",
  "不读取 secret",
  "不调用真实云 API",
  "不改 deploy",
]) {
  assert(contract.includes(required), `contract_missing:${required}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_runtime_bridge_session_run_file_provider_keyref_flow",
  runId: run.runId,
  artifactRef: run.artifacts[0].artifactRef,
  providerKeyRef: run.providerKeyRef,
}, null, 2));
