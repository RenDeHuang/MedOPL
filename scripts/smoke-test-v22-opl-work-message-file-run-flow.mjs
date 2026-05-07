import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_opl_work_must_remain_backend_only";
const RAW_PROMPT = "please analyze uploaded measurement data raw prompt must stay out of trace metadata";

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

function assertTraceMetadataShape(metadata, label, expectedProviderKeyRef) {
  assert.deepEqual(Object.keys(metadata).sort(), [
    "artifactRefs",
    "providerKeyRef",
    "resourceBindingId",
    "sessionId",
    "timestamps",
    "workspaceId",
  ], `${label}_trace_metadata_keys_mismatch`);
  assert.ok(metadata.sessionId, `${label}_trace_session_id_required`);
  assert.equal(metadata.workspaceId, "workspace-v22-opl-work", `${label}_trace_workspace_mismatch`);
  assert.ok(metadata.resourceBindingId, `${label}_trace_resource_binding_required`);
  assert.equal(metadata.providerKeyRef, expectedProviderKeyRef, `${label}_trace_provider_key_ref_mismatch`);
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

function createRoute({ db, providerSecretStore, writes }) {
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
    writeDb: async (targetDb) => {
      writes.push(JSON.parse(JSON.stringify(targetDb)));
    },
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

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-opl-work-message-file-run-flow-"));
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
  const writes = [];
  const route = createRoute({ db, providerSecretStore, writes });

  await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/users/prepare",
    body: {
      tenantId: "tenant-v22-opl-work",
      userId: "user-v22-opl-work",
      email: "opl-work@example.test",
      name: "OPL Work User",
      workspaceId: "workspace-v22-opl-work",
    },
  });
  const user = db.users.find((item) => item.id === "user-v22-opl-work");
  assert.ok(user, "prepared_user_must_exist");

  await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/users/credit",
    user,
    body: {
      userId: user.id,
      amount: 500,
      idempotencyKey: "v22-opl-work-topup",
    },
  });

  const runWithoutProvider = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/runs",
    user,
    body: {
      workspaceId: "workspace-v22-opl-work",
      sessionId: "session-without-provider",
      message: RAW_PROMPT,
      fileRefs: ["workspace-file-ref"],
    },
  });
  assert.equal(runWithoutProvider.handled, true, "run_without_provider_route_must_be_handled");
  assert.equal(runWithoutProvider.res.statusCode, 409, "run_without_provider_must_return_409");
  assert.equal(runWithoutProvider.res.payload.ok, false, "run_without_provider_must_return_not_ok");
  assert.equal(runWithoutProvider.res.payload.error, "provider_key_required", "run_without_provider_error_mismatch");
  assertNoSecretLeak(runWithoutProvider.res.payload, "run_without_provider");

  const bound = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/provider-key",
    user,
    body: {
      workspaceId: "workspace-v22-opl-work",
      provider: "gflabtoken",
      apiKey: RAW_PROVIDER_KEY,
    },
  });
  assert.equal(bound.res.statusCode, 200, "provider_key_binding_must_return_200");
  const providerKeyRef = bound.res.payload.providerKeyRef;
  assert.ok(providerKeyRef, "provider_key_ref_required");

  const runWithoutEnvironment = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/runs",
    user,
    body: {
      workspaceId: "workspace-v22-opl-work",
      sessionId: "session-without-environment",
      message: RAW_PROMPT,
      fileRefs: ["workspace-file-ref"],
    },
  });
  assert.equal(runWithoutEnvironment.handled, true, "run_without_environment_route_must_be_handled");
  assert.equal(runWithoutEnvironment.res.statusCode, 409, "run_without_environment_must_return_409");
  assert.equal(runWithoutEnvironment.res.payload.ok, false, "run_without_environment_must_return_not_ok");
  assert.equal(runWithoutEnvironment.res.payload.error, "managed_environment_required", "run_without_environment_error_mismatch");
  assertNoSecretLeak(runWithoutEnvironment.res.payload, "run_without_environment");

  const opened = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/managed-environment/open",
    user,
    body: {
      workspaceId: "workspace-v22-opl-work",
      planId: "starter_2c4g_10gb",
      fileSpaceGb: 10,
      idempotencyKey: "v22-opl-work-open",
    },
  });
  assert.equal(opened.res.statusCode, 201, "managed_environment_open_must_create");
  const resourceBindingId = opened.res.payload.resourceBinding.resourceBindingId;
  assert.ok(resourceBindingId, "resource_binding_id_required");

  const session = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/sessions",
    user,
    body: {
      workspaceId: "workspace-v22-opl-work",
      entrypoint: "opl.medopl.cn",
    },
  });
  assert.equal(session.handled, true, "opl_work_session_route_must_be_handled");
  assert.equal(session.res.statusCode, 201, "opl_work_session_must_return_201");
  assert.equal(session.res.payload.ok, true, "opl_work_session_must_return_ok");
  assert.equal(session.res.payload.oplSession.workspaceId, "workspace-v22-opl-work", "opl_session_workspace_mismatch");
  assert.equal(session.res.payload.oplSession.resourceBindingId, resourceBindingId, "opl_session_resource_binding_mismatch");
  assert.equal(session.res.payload.oplSession.providerKeyRef, providerKeyRef, "opl_session_provider_key_ref_mismatch");
  assert.equal(session.res.payload.upstream.repository, "https://github.com/gaofeng21cn/one-person-lab", "upstream_repository_mismatch");
  assert.equal(session.res.payload.upstream.sourceModified, false, "upstream_source_modified_must_be_false");
  assert.equal(session.res.payload.upstream.internalModuleImports, false, "upstream_internal_import_must_be_false");
  assertNoSecretLeak(session.res.payload, "opl_work_session");

  const uploaded = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/files",
    user,
    body: {
      workspaceId: "workspace-v22-opl-work",
      sessionId: session.res.payload.oplSession.sessionId,
      fileName: "inputs/measurements.csv",
      contentType: "text/csv",
      sizeBytes: 42,
    },
  });
  assert.equal(uploaded.handled, true, "opl_work_file_upload_route_must_be_handled");
  assert.equal(uploaded.res.statusCode, 201, "opl_work_file_upload_must_return_201");
  assert.equal(uploaded.res.payload.ok, true, "opl_work_file_upload_must_return_ok");
  assert.equal(uploaded.res.payload.fileRef.kind, "inputs", "uploaded_file_kind_mismatch");
  assert.equal(uploaded.res.payload.fileRef.workspaceId, "workspace-v22-opl-work", "uploaded_file_workspace_mismatch");
  assert.equal(uploaded.res.payload.fileRef.resourceBindingId, resourceBindingId, "uploaded_file_resource_binding_mismatch");
  assertNoSecretLeak(uploaded.res.payload, "opl_work_file_upload");
  assertNoInternalStorageLeak(uploaded.res.payload, "opl_work_file_upload");

  const run = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/runs",
    user,
    body: {
      workspaceId: "workspace-v22-opl-work",
      sessionId: session.res.payload.oplSession.sessionId,
      message: RAW_PROMPT,
      fileRefs: [uploaded.res.payload.fileRef.fileRef],
      idempotencyKey: "v22-opl-work-run-once",
    },
  });
  assert.equal(run.handled, true, "opl_work_run_route_must_be_handled");
  assert.equal(run.res.statusCode, 201, "opl_work_run_must_return_201");
  assert.equal(run.res.payload.ok, true, "opl_work_run_must_return_ok");
  assert.ok(run.res.payload.message.messageId, "opl_work_message_id_required");
  assert.equal(run.res.payload.message.status, "accepted", "opl_work_message_status_mismatch");
  assert.equal(run.res.payload.run.status, "succeeded", "opl_work_run_status_mismatch");
  assert.equal(run.res.payload.run.messageId, run.res.payload.message.messageId, "opl_work_run_message_ref_mismatch");
  assert.equal(run.res.payload.run.workspaceId, "workspace-v22-opl-work", "opl_work_run_workspace_mismatch");
  assert.equal(run.res.payload.run.resourceBindingId, resourceBindingId, "opl_work_run_resource_binding_mismatch");
  assert.equal(run.res.payload.run.providerKeyRef, providerKeyRef, "opl_work_run_provider_key_ref_mismatch");
  assert.equal(run.res.payload.artifacts.length, 1, "opl_work_run_must_create_artifact");
  assert.equal(run.res.payload.artifacts[0].kind, "outputs", "opl_work_artifact_kind_mismatch");
  assert.equal(run.res.payload.upstream.sourceModified, false, "run_upstream_source_modified_must_be_false");
  assertTraceMetadataShape(run.res.payload.traceMetadata, "opl_work_run", providerKeyRef);
  assert.equal(run.res.payload.traceMetadata.artifactRefs[0], run.res.payload.artifacts[0].fileRef, "trace_artifact_ref_mismatch");
  assertNoSecretLeak(run.res.payload, "opl_work_run");
  assertNoInternalStorageLeak(run.res.payload, "opl_work_run");

  const download = await request(route, db, {
    method: "GET",
    urlPath: `/portal/api/v22/opl-work/artifacts/${encodeURIComponent(run.res.payload.artifacts[0].fileRef)}/download?workspaceId=workspace-v22-opl-work`,
    user,
  });
  assert.equal(download.handled, true, "opl_work_download_route_must_be_handled");
  assert.equal(download.res.statusCode, 200, "opl_work_download_must_return_200");
  assert.equal(download.res.payload.ok, true, "opl_work_download_must_return_ok");
  assert.equal(download.res.payload.download.fileRef, run.res.payload.artifacts[0].fileRef, "download_file_ref_mismatch");
  assert.equal(download.res.payload.download.kind, "outputs", "download_kind_mismatch");
  assert.equal(download.res.payload.download.resourceBindingId, resourceBindingId, "download_resource_binding_mismatch");
  assertNoSecretLeak(download.res.payload, "opl_work_download");
  assertNoInternalStorageLeak(download.res.payload, "opl_work_download");

  assert.equal(db.oplWorkSessions.length, 1, "db_session_must_be_recorded");
  assert.equal(db.oplWorkRuns.length, 1, "db_run_must_be_recorded");
  assert.equal(db.workspaceFiles.filter((item) => item.kind === "inputs").length, 1, "db_input_file_must_be_recorded");
  assert.equal(db.workspaceFiles.filter((item) => item.kind === "outputs").length, 1, "db_output_file_must_be_recorded");
  assert.equal(db.oplWorkTraceMetadata.length, 1, "trace_metadata_must_be_recorded");
  assertNoSecretLeak(db.oplWorkTraceMetadata, "db_trace_metadata");
  assertNoInternalStorageLeak(db.oplWorkTraceMetadata, "db_trace_metadata");

  const contract = await readFile("docs/contracts/v22-opl-work-message-file-run-boundary.md", "utf8");
  for (const required of [
    "provider_key_required",
    "managed_environment_required",
    "workspace file reference",
    "artifact reference",
    "sourceModified=false",
    "providerKeyRef",
    "raw API key",
    "launchToken",
    "runtimeToken",
    "one-person-lab",
  ]) {
    assert(contract.includes(required), `contract_missing:${required}`);
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_opl_work_message_file_run_flow",
    sessionId: session.res.payload.oplSession.sessionId,
    runId: run.res.payload.run.runId,
    artifactRef: run.res.payload.artifacts[0].fileRef,
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
