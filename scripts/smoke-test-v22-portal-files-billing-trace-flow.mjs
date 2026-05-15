import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_portal_surface_backend_only";
const RAW_PROMPT = "raw prompt must not appear in portal trace metadata";

const { createPortalApiRoutes } = await import("../services/portal/src/routes/portal-api.routes.mjs");
const { createProviderSecretStore } = await import("../services/portal/src/domain/provider-secret-store.mjs");

function assertNoSecretLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(serialized.includes(RAW_PROMPT), false, `${label}_must_not_leak_raw_prompt`);
  assert.equal(/launchToken|runtimeToken|bearerToken|providerSecret|rawProviderKey|providerApiKey|apiKey/i.test(serialized), false, `${label}_must_not_expose_secret_fields`);
}

function assertNoInternalStorageLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(/storageKey|objectKey|secret|credential|signedUrl|presignedUrl|localPath/i.test(serialized), false, `${label}_must_not_expose_internal_storage_key`);
}

function assertNoCloudConsoleLanguage(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(/CVM|COS|K8s|TKE|云资源控制台/.test(serialized), false, `${label}_must_not_use_cloud_console_language`);
}

function assertTraceMetadataWhitelist(metadata, label) {
  assert.deepEqual(Object.keys(metadata).sort(), [
    "artifactRefs",
    "auditTag",
    "providerKeyRef",
    "resourceBindingId",
    "sessionId",
    "status",
    "timestamps",
    "workspaceId",
  ], `${label}_trace_metadata_keys_mismatch`);
  assert.equal(metadata.workspaceId, "workspace-v22-portal-surface", `${label}_trace_workspace_mismatch`);
  assert.ok(metadata.sessionId, `${label}_trace_session_required`);
  assert.ok(metadata.resourceBindingId, `${label}_trace_resource_binding_required`);
  assert.ok(metadata.providerKeyRef, `${label}_trace_provider_key_ref_required`);
  assert.equal(metadata.status, "succeeded", `${label}_trace_status_mismatch`);
  assert.ok(metadata.auditTag.includes("workspace:workspace-v22-portal-surface"), `${label}_trace_audit_tag_mismatch`);
  assert.equal(Array.isArray(metadata.artifactRefs), true, `${label}_trace_artifact_refs_must_be_array`);
  assert.equal(typeof metadata.timestamps.createdAt, "string", `${label}_trace_created_at_required`);
  assert.equal(typeof metadata.timestamps.updatedAt, "string", `${label}_trace_updated_at_required`);
  assertNoSecretLeak(metadata, `${label}_trace_metadata`);
  assertNoInternalStorageLeak(metadata, `${label}_trace_metadata`);
}

function responseRecorder() {
  return { statusCode: 0, payload: null };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

async function readBody(req) {
  return Buffer.from(req.body || "");
}

function createRoute({ providerSecretStore }) {
  return createPortalApiRoutes({
    activeUserStatus: (status) => status || "active",
    adminScopeResult: () => ({ ok: false, status: 403, error: "forbidden" }),
    announcementRows: () => [],
    buildCommercialProfile: () => ({ accountStatus: "active", billingStatus: "funded", entitlementStatus: "active" }),
    buildSessionTraceDetailPayload: async () => null,
    buildSessionTracesApiPayload: async () => ({ items: [] }),
    collectRunsForUser: async () => [],
    currentServerPlanSelection: (taskSpace) => ({ id: taskSpace?.serverPlanId || "starter_2c4g_10gb" }),
    currentTaskSpaceForUser: (targetDb, targetUser) => targetDb.taskSpaces.find((item) => item.userId === targetUser.id) || null,
    evaluateUserPolicy: async () => ({ ok: true }),
    fetchBillingSummary: async () => ({ totals: { totalCost: 0 }, items: [] }),
    fetchHarborSummary: async () => ({ available: false }),
    fetchOplAdapterCosts: async () => [],
    fetchOplAdapterRuns: async () => [],
    fetchOplAdapterTraceRows: async () => ({ rows: [] }),
    fetchOpsRegistryImageRows: async () => ({ items: [] }),
    fetchTraceRows: async () => ({ rows: [] }),
    formatDateTime: (value) => String(value || ""),
    isRunTerminal: () => true,
    normalizePageSize: (value) => Number(value || 20),
    paginateRows: (rows) => ({ rows, page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 }),
    parsePositiveInt: (value, fallback) => Number(value || fallback),
    providerSecretStore,
    readBody,
    readSessionsRequestOptions: () => ({}),
    readTracesRequestOptions: () => ({}),
    sendJson,
    visibleAnnouncementRows: () => [],
    workspaceChatSessionsForUser: () => [],
    writeDb: async () => {},
  });
}

async function request(route, db, { method = "GET", urlPath = "/", body = null, user = null } = {}) {
  const res = responseRecorder();
  const handled = await route({
    req: { method, body: body ? JSON.stringify(body) : "" },
    res,
    url: new URL(urlPath, "http://portal.local"),
    db,
    user,
  });
  return { handled, res };
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-files-billing-trace-flow-"));
try {
  const providerSecretStore = createProviderSecretStore({ secretsRoot: tempRoot });
  const db = {
    users: [],
    tenants: [],
    wallets: [],
    ledger: [],
    taskSpaces: [],
    providerKeyBindings: [],
    userComputeInstances: [],
    userStorageBuckets: [],
    workspaceResourceBindings: [],
    weeklyProtectionFreezes: [],
    workspaceFiles: [],
    oplWorkSessions: [],
    oplWorkRuns: [],
    oplWorkTraceMetadata: [],
    announcements: [],
  };
  const route = createRoute({ providerSecretStore });

  await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/users/prepare",
    body: {
      tenantId: "tenant-v22-portal-surface",
      userId: "user-v22-portal-surface",
      email: "portal-surface@example.test",
      name: "Portal Surface User",
      workspaceId: "workspace-v22-portal-surface",
    },
  });
  const user = db.users.find((item) => item.id === "user-v22-portal-surface");
  assert.ok(user, "prepared_user_must_exist");

  await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/users/credit",
    user,
    body: {
      userId: user.id,
      amount: 500,
      idempotencyKey: "v22-portal-surface-topup",
    },
  });

  const bound = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/provider-key",
    user,
    body: {
      workspaceId: "workspace-v22-portal-surface",
      provider: "gflabtoken",
      apiKey: RAW_PROVIDER_KEY,
    },
  });
  assert.equal(bound.res.statusCode, 200, "provider_key_binding_must_return_200");

  const opened = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/managed-environment/open",
    user,
    body: {
      workspaceId: "workspace-v22-portal-surface",
      planId: "starter_2c4g_10gb",
      fileSpaceGb: 10,
      freezeAmount: 56,
      idempotencyKey: "v22-portal-surface-open",
    },
  });
  assert.equal(opened.res.statusCode, 201, "managed_environment_must_open");
  const resourceBindingId = opened.res.payload.resourceBinding.resourceBindingId;
  assert.ok(resourceBindingId, "resource_binding_id_required");

  const session = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/sessions",
    user,
    body: {
      workspaceId: "workspace-v22-portal-surface",
      entrypoint: "opl.medopl.cn",
    },
  });
  assert.equal(session.res.statusCode, 201, "opl_session_must_create");

  const uploaded = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/files",
    user,
    body: {
      workspaceId: "workspace-v22-portal-surface",
      sessionId: session.res.payload.oplSession.sessionId,
      fileName: "inputs/dataset.csv",
      contentType: "text/csv",
      sizeBytes: 128,
    },
  });
  assert.equal(uploaded.res.statusCode, 201, "workspace_input_file_must_create");

  const run = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/runs",
    user,
    body: {
      workspaceId: "workspace-v22-portal-surface",
      sessionId: session.res.payload.oplSession.sessionId,
      message: RAW_PROMPT,
      fileRefs: [uploaded.res.payload.fileRef.fileRef],
      idempotencyKey: "v22-portal-surface-run",
    },
  });
  assert.equal(run.res.statusCode, 201, "workspace_run_must_create");

  db.ledger.push({
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId: "workspace-v22-portal-surface",
    runId: run.res.payload.run.runId,
    resourceBindingId,
    billingAttributionId: "billing-attr-v22-portal-surface",
    billingAccountId: user.tenantId,
    type: "pending_usage",
    amount: 12.34,
    currency: "CNY",
    sourceType: "runtime_estimate",
    sourceId: run.res.payload.run.runId,
    idempotencyKey: "v22-portal-surface-pending-usage",
    reason: "v22_runtime_estimated_usage",
    operatorId: "portal-smoke",
    createdAt: "2026-05-07T00:00:00.000Z",
  });

  const state = await request(route, db, {
    urlPath: "/portal/api/canonical-state?workspaceId=workspace-v22-portal-surface",
    user,
  });
  assert.equal(state.handled, true, "canonical_state_route_must_be_handled");
  assert.equal(state.res.statusCode, 200, "canonical_state_must_return_200");
  const payload = state.res.payload;

  assert.equal(payload.managedEnvironment.enabled, true, "managed_environment_must_be_enabled");
  assert.equal(payload.managedEnvironment.resourceBinding.resourceBindingId, resourceBindingId, "managed_environment_binding_mismatch");
  assert.equal(payload.resourceBinding.resourceBindingId, resourceBindingId, "top_level_resource_binding_mismatch");
  assert.equal(payload.freeze.resourceBindingId, resourceBindingId, "freeze_resource_binding_mismatch");
  assert.equal(payload.preauth.status, "pending_product_approval", "preauth_status_mismatch");

  assert.equal(Array.isArray(payload.workspaceFiles), true, "workspace_files_must_be_array");
  assert.equal(payload.workspaceFiles.length, 2, "workspace_files_count_mismatch");
  assert.equal(payload.workspaceFiles.some((item) => item.kind === "inputs" && item.fileRef === uploaded.res.payload.fileRef.fileRef), true, "input_file_ref_missing");
  assert.equal(payload.workspaceFiles.find((item) => item.kind === "inputs").relativePath, "inputs/dataset.csv", "input_file_relative_path_mismatch");
  assert.equal(Array.isArray(payload.outputFiles), true, "output_files_must_be_array");
  assert.equal(payload.outputFiles.length, 1, "output_files_count_mismatch");
  assert.equal(payload.outputFiles[0].fileRef, run.res.payload.artifacts[0].fileRef, "output_file_ref_mismatch");
  assert.deepEqual(payload.artifacts, payload.outputFiles, "artifacts_must_match_output_files");

  assert.equal(payload.billingSummary.balance.balanceCents, 50000, "billing_balance_mismatch");
  assert.equal(payload.billingSummary.frozen.amountCents, 5600, "billing_frozen_amount_mismatch");
  assert.equal(payload.billingSummary.preauth.amountCents, 5600, "billing_preauth_amount_mismatch");
  assert.equal(payload.billingSummary.estimatedUsage.amountCents, 1234, "billing_estimated_usage_mismatch");
  assert.equal(payload.billingSummary.pendingReconciliation.status, "pending_reconciliation", "billing_pending_reconciliation_status_mismatch");
  assert.equal(payload.billingSummary.releaseStopBillingStatus, "none", "release_stop_billing_status_mismatch");

  assert.equal(Array.isArray(payload.sessionTraceMetadata), true, "trace_metadata_must_be_array");
  assert.equal(payload.sessionTraceMetadata.length, 1, "trace_metadata_count_mismatch");
  assertTraceMetadataWhitelist(payload.sessionTraceMetadata[0], "canonical_state");

  assertNoSecretLeak(payload.workspaceFiles, "workspace_files");
  assertNoSecretLeak(payload.outputFiles, "output_files");
  assertNoSecretLeak(payload.billingSummary, "billing_summary");
  assertNoSecretLeak(payload.sessionTraceMetadata, "session_trace_metadata");
  assertNoInternalStorageLeak(payload.workspaceFiles, "workspace_files");
  assertNoInternalStorageLeak(payload.outputFiles, "output_files");
  assertNoInternalStorageLeak(payload.sessionTraceMetadata, "session_trace_metadata");
  assertNoCloudConsoleLanguage(payload.userNarrative, "user_narrative");

  const contract = await readFile("docs/contracts/v22-portal-files-billing-trace-boundary.md", "utf8");
  for (const required of [
    "workspaceFiles",
    "outputFiles",
    "billingSummary",
    "sessionTraceMetadata",
    "providerKeyRef",
    "raw prompt",
    "raw API key",
    "launchToken",
    "runtimeToken",
    "pending reconciliation",
    "Langfuse",
  ]) {
    assert(contract.includes(required), `contract_missing:${required}`);
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_files_billing_trace_flow",
    workspaceFiles: payload.workspaceFiles.length,
    outputFiles: payload.outputFiles.length,
    traceMetadata: payload.sessionTraceMetadata.length,
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
