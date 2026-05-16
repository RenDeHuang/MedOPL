import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_release_flow_backend_only";
const RAW_PROMPT = "raw release flow prompt must not appear in release or audit state";
const RELEASED_AT = "2026-05-07T02:00:00.000Z";
const BILLING_STOP_CONFIRM_BY = "2026-05-07T04:00:00.000Z";
const AUDIT_READY_AT = "2026-05-08T02:00:00.000Z";
const AUDIT_PENDING_QUERY_AT = "2026-05-07T05:00:00.000Z";
const AUDIT_QUERY_AT = "2026-05-08T02:01:00.000Z";

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
  assert.equal(/rootPrefix|storageKey|objectKey|secret|credential|signedUrl|presignedUrl|localPath/i.test(serialized), false, `${label}_must_not_expose_internal_storage_key`);
}

function assertNoCloudConsoleLanguage(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(/CVM|COS|K8s|TKE|云资源控制台/.test(serialized), false, `${label}_must_not_use_cloud_console_language`);
}

function assertNoActiveResourceOrderId(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(/"resourceOrderId"\s*:/.test(serialized), false, `${label}_must_not_use_resourceOrderId_as_active_truth`);
}

function assertBillingIdentity(record, label, expected = {}) {
  assert.equal(record.resourceBindingId, expected.resourceBindingId, `${label}_resource_binding_id_mismatch`);
  assert.equal(record.billingAttributionId, expected.billingAttributionId, `${label}_billing_attribution_id_mismatch`);
  assert.equal(record.workspaceId, expected.workspaceId, `${label}_workspace_id_mismatch`);
  assert.equal(record.accountId, expected.accountId, `${label}_account_id_mismatch`);
  assert.equal(record.serverPlanId, expected.serverPlanId, `${label}_server_plan_id_mismatch`);
  assert.equal(Object.hasOwn(record, "resourceOrderId"), false, `${label}_must_not_have_active_resource_order_id`);
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
    fetchRuntimeBridgeCosts: async () => [],
    fetchRuntimeBridgeRuns: async () => [],
    fetchRuntimeBridgeTraceRows: async () => ({ rows: [] }),
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

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-release-stop-billing-audit-flow-"));
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
    managedEnvironmentReleaseAudits: [],
    announcements: [],
  };
  const route = createRoute({ providerSecretStore });

  await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/users/prepare",
    body: {
      tenantId: "tenant-v22-release",
      userId: "user-v22-release",
      email: "release@example.test",
      name: "Release Flow User",
      workspaceId: "workspace-v22-release",
    },
  });
  const user = db.users.find((item) => item.id === "user-v22-release");
  assert.ok(user, "prepared_user_must_exist");

  const missingEnvironmentRelease = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/managed-environment/release",
    user,
    body: {
      workspaceId: "workspace-v22-release",
      releasedAt: RELEASED_AT,
    },
  });
  assert.equal(missingEnvironmentRelease.handled, true, "release_route_must_be_handled");
  assert.equal(missingEnvironmentRelease.res.statusCode, 409, "release_without_environment_must_return_409");
  assert.equal(missingEnvironmentRelease.res.payload.ok, false, "release_without_environment_must_return_not_ok");
  assert.equal(missingEnvironmentRelease.res.payload.error, "managed_environment_required", "release_without_environment_error_mismatch");
  assertNoSecretLeak(missingEnvironmentRelease.res.payload, "release_without_environment");

  await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/users/credit",
    user,
    body: {
      userId: user.id,
      amount: 500,
      idempotencyKey: "v22-release-topup",
    },
  });

  const bound = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/provider-key",
    user,
    body: {
      workspaceId: "workspace-v22-release",
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
      workspaceId: "workspace-v22-release",
      planId: "starter_2c4g_10gb",
      fileSpaceGb: 10,
      freezeAmount: 56,
      idempotencyKey: "v22-release-open",
    },
  });
  assert.equal(opened.res.statusCode, 201, "managed_environment_must_open");
  const resourceBindingId = opened.res.payload.resourceBinding.resourceBindingId;
  const billingIdentity = {
    resourceBindingId,
    billingAttributionId: opened.res.payload.resourceBinding.costAllocationTag,
    workspaceId: "workspace-v22-release",
    accountId: user.id,
    serverPlanId: "starter_2c4g_10gb",
  };
  assert.equal(opened.res.payload.resourceBinding.resourceBindingId, resourceBindingId, "opened_binding_id_mismatch");
  assertNoActiveResourceOrderId(opened.res.payload.resourceBinding, "opened_resource_binding");
  assert.equal(opened.res.payload.freeze.status, "active_pending_product_approval", "opened_freeze_status_mismatch");
  assert.equal(opened.res.payload.freeze.preauthStatus, "pending_product_approval", "opened_preauth_status_mismatch");
  assert.equal(opened.res.payload.freeze.frozenAmountCents, 5600, "opened_frozen_amount_cents_mismatch");
  assert.equal(opened.res.payload.freeze.remainingAmountCents ?? opened.res.payload.freeze.remainingAmount * 100, 5600, "opened_remaining_amount_cents_mismatch");

  const session = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/sessions",
    user,
    body: {
      workspaceId: "workspace-v22-release",
      entrypoint: "opl.medopl.cn",
    },
  });
  assert.equal(session.res.statusCode, 201, "opl_session_must_create");

  const uploaded = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/files",
    user,
    body: {
      workspaceId: "workspace-v22-release",
      sessionId: session.res.payload.oplSession.sessionId,
      fileName: "inputs/release.csv",
      contentType: "text/csv",
      sizeBytes: 64,
    },
  });
  assert.equal(uploaded.res.statusCode, 201, "workspace_input_file_must_create");

  const run = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/runs",
    user,
    body: {
      workspaceId: "workspace-v22-release",
      sessionId: session.res.payload.oplSession.sessionId,
      message: RAW_PROMPT,
      fileRefs: [uploaded.res.payload.fileRef.fileRef],
    },
  });
  assert.equal(run.res.statusCode, 201, "workspace_run_must_create");

  db.ledger.push({
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId: billingIdentity.workspaceId,
    runId: run.res.payload.run.runId,
    resourceBindingId: billingIdentity.resourceBindingId,
    billingAttributionId: billingIdentity.billingAttributionId,
    accountId: billingIdentity.accountId,
    serverPlanId: billingIdentity.serverPlanId,
    billingAccountId: user.tenantId,
    type: "pending_usage",
    amount: 9.99,
    currency: "CNY",
    sourceType: "runtime_estimate",
    sourceId: run.res.payload.run.runId,
    idempotencyKey: "v22-release-pending-usage",
    reason: "v22_runtime_estimated_usage",
    operatorId: "portal-smoke",
    createdAt: RELEASED_AT,
  });
  assertNoActiveResourceOrderId(db.ledger, "billing_ledger_fixture");

  const ledgerCountBeforeRelease = db.ledger.length;
  const release = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/managed-environment/release",
    user,
    body: {
      workspaceId: "workspace-v22-release",
      releasedAt: RELEASED_AT,
      reason: "user_stopped_using_managed_environment",
    },
  });
  assert.equal(release.handled, true, "release_route_must_be_handled_after_open");
  assert.equal(release.res.statusCode, 200, "release_must_return_200");
  assert.equal(release.res.payload.ok, true, "release_must_return_ok");
  assert.equal(release.res.payload.resourceBinding.resourceBindingId, resourceBindingId, "release_binding_mismatch");
  assert.equal(release.res.payload.release.releasedAt, RELEASED_AT, "release_released_at_mismatch");
  assert.equal(release.res.payload.stopBilling.billingStoppedAt, RELEASED_AT, "billing_stopped_at_mismatch");
  assert.equal(release.res.payload.stopBilling.billingStopConfirmBy, BILLING_STOP_CONFIRM_BY, "billing_stop_confirm_by_mismatch");
  assert.equal(release.res.payload.stopBilling.status, "billing_stopped", "stop_billing_status_mismatch");
  assert.equal(release.res.payload.audit.status, "audit_pending", "release_audit_status_mismatch");
  assert.equal(release.res.payload.audit.auditReadyAt, AUDIT_READY_AT, "audit_ready_at_mismatch");
  assert.deepEqual(release.res.payload.release.transitions.map((item) => item.status), [
    "release_requested",
    "billing_stop_confirming",
    "billing_stopped",
    "audit_pending",
  ], "release_transition_statuses_mismatch");
  assert.equal(release.res.payload.fileProtection.status, "retention_protected", "file_protection_status_mismatch");
  assert.equal(release.res.payload.fileProtection.workspaceFileCount, 2, "file_protection_count_mismatch");
  assertNoSecretLeak(release.res.payload, "release_response");
  assertNoInternalStorageLeak(release.res.payload, "release_response");
  assertNoActiveResourceOrderId(release.res.payload, "release_response");

  assert.equal(db.managedEnvironmentReleaseAudits.length, 1, "release_audit_record_count_mismatch");
  const releaseAuditRecord = db.managedEnvironmentReleaseAudits[0];
  assert.equal(releaseAuditRecord.resourceBindingId, resourceBindingId, "release_audit_binding_mismatch");
  assert.equal(releaseAuditRecord.workspaceId, billingIdentity.workspaceId, "release_audit_workspace_mismatch");
  assert.equal(releaseAuditRecord.billingStoppedAt, RELEASED_AT, "release_audit_billing_stopped_at_mismatch");
  assert.equal(releaseAuditRecord.billingStopConfirmBy, BILLING_STOP_CONFIRM_BY, "release_audit_confirm_by_mismatch");
  assert.equal(releaseAuditRecord.auditReadyAt, AUDIT_READY_AT, "release_audit_ready_at_mismatch");
  assert.equal(releaseAuditRecord.status, release.res.payload.audit.status, "release_audit_status_projection_mismatch");
  assert.equal(releaseAuditRecord.auditReadyAt, release.res.payload.audit.auditReadyAt, "release_audit_ready_projection_mismatch");
  assertNoActiveResourceOrderId(releaseAuditRecord, "release_audit_record");

  const repeatedRelease = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/managed-environment/release",
    user,
    body: {
      workspaceId: "workspace-v22-release",
      releasedAt: RELEASED_AT,
    },
  });
  assert.equal(repeatedRelease.res.statusCode, 409, "repeated_release_must_return_409");
  assert.equal(repeatedRelease.res.payload.error, "managed_environment_already_released", "repeated_release_error_mismatch");
  assertNoSecretLeak(repeatedRelease.res.payload, "repeated_release");

  const blockedRunAfterRelease = await request(route, db, {
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/runs",
    user,
    body: {
      workspaceId: "workspace-v22-release",
      sessionId: session.res.payload.oplSession.sessionId,
      message: RAW_PROMPT,
      fileRefs: [uploaded.res.payload.fileRef.fileRef],
    },
  });
  assert.equal(blockedRunAfterRelease.res.statusCode, 409, "run_after_release_must_return_409");
  assert.equal(blockedRunAfterRelease.res.payload.error, "managed_environment_required", "run_after_release_error_mismatch");
  assert.equal(db.ledger.length, ledgerCountBeforeRelease, "release_must_not_add_new_runtime_billing");
  assert.equal(db.oplWorkRuns.length, 1, "run_after_release_must_not_create_new_run");
  assertNoSecretLeak(blockedRunAfterRelease.res.payload, "run_after_release");

  const releasedState = await request(route, db, {
    urlPath: `/portal/api/canonical-state?workspaceId=workspace-v22-release&now=${encodeURIComponent(AUDIT_PENDING_QUERY_AT)}`,
    user,
  });
  assert.equal(releasedState.res.statusCode, 200, "released_state_must_return_200");
  const state = releasedState.res.payload;
  assert.equal(state.managedEnvironment.enabled, false, "managed_environment_must_be_disabled_after_release");
  assert.equal(state.resourceBinding.resourceBindingId, resourceBindingId, "released_state_binding_mismatch");
  assert.equal(state.resourceBinding.status, "audit_pending", "released_binding_status_mismatch");
  assert.equal(state.release.status, "audit_pending", "release_status_mismatch");
  assert.equal(state.release.releasedAt, RELEASED_AT, "state_released_at_mismatch");
  assert.equal(state.stopBilling.status, "billing_stopped", "state_stop_billing_status_mismatch");
  assert.equal(state.stopBilling.billingStoppedAt, RELEASED_AT, "state_billing_stopped_at_mismatch");
  assert.equal(state.stopBilling.billingStopConfirmBy, BILLING_STOP_CONFIRM_BY, "state_billing_stop_confirm_by_mismatch");
  assert.equal(state.audit.status, "audit_pending", "state_audit_status_mismatch");
  assert.equal(state.freeze.status, "released", "released_freeze_status_mismatch");
  assert.equal(state.freeze.preauthStatus, "billing_stopped", "released_freeze_preauth_status_mismatch");
  assert.equal(state.freeze.frozenAmountCents, 0, "released_freeze_frozen_amount_cents_mismatch");
  assert.equal(state.freeze.remainingAmount, 0, "released_freeze_remaining_amount_mismatch");
  assert.equal(state.preauth.status, "billing_stopped", "released_preauth_status_mismatch");
  assert.equal(state.preauth.amountCents, 0, "released_preauth_amount_cents_mismatch");
  assert.equal(state.billingSummary.billingLifecycle.activeBilling, false, "billing_summary_active_billing_mismatch");
  assert.equal(state.billingSummary.billingLifecycle.billingStopped, true, "billing_summary_billing_stopped_mismatch");
  assert.equal(state.billingSummary.billingLifecycle.auditPending, true, "billing_summary_audit_pending_mismatch");
  assert.equal(state.billingSummary.releaseStopBillingStatus, "billing_stopped", "billing_summary_release_stop_status_mismatch");
  assert.equal(state.billingSummary.estimatedUsage.items.length, 1, "billing_summary_pending_usage_count_mismatch");
  assertBillingIdentity(state.billingSummary.estimatedUsage.items[0], "billing_summary_pending_usage", billingIdentity);
  assertBillingIdentity(state.billingSummary.pendingReconciliation.items[0], "billing_summary_pending_reconciliation", billingIdentity);
  assertNoActiveResourceOrderId(state.billingSummary, "billing_summary");
  assertNoActiveResourceOrderId(state.sessionTraceMetadata, "session_trace_metadata");
  assert.equal(state.workspaceFiles.every((item) => item.status === "retention_protected"), true, "workspace_files_must_enter_retention_protection");
  assert.equal(state.artifacts.every((item) => item.status === "retention_protected"), true, "artifacts_must_enter_retention_protection");
  assertNoSecretLeak(state, "released_canonical_state");
  assertNoInternalStorageLeak(state, "released_canonical_state");
  assertNoInternalStorageLeak(state.workspaceFiles, "released_workspace_files");
  assertNoInternalStorageLeak(state.artifacts, "released_artifacts");
  assertNoCloudConsoleLanguage(state.userNarrative, "released_user_narrative");

  const auditReadyState = await request(route, db, {
    urlPath: `/portal/api/canonical-state?workspaceId=workspace-v22-release&now=${encodeURIComponent(AUDIT_QUERY_AT)}`,
    user,
  });
  assert.equal(auditReadyState.res.statusCode, 200, "audit_ready_state_must_return_200");
  assert.equal(auditReadyState.res.payload.audit.status, "audit_ready", "audit_must_be_ready_after_t_plus_1");
  assert.equal(auditReadyState.res.payload.billingSummary.billingLifecycle.auditReady, true, "billing_summary_audit_ready_mismatch");

  const contract = await readFile("docs/contracts/v22-release-stop-billing-audit-boundary.md", "utf8");
  for (const required of [
    "managed_environment_required",
    "managed_environment_already_released",
    "release_requested",
    "billing_stop_confirming",
    "billing_stopped",
    "audit_pending",
    "audit_ready",
    "120min",
    "T+1",
    "retention_protected",
    "raw API key",
    "launchToken",
    "runtimeToken",
  ]) {
    assert(contract.includes(required), `contract_missing:${required}`);
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_release_stop_billing_audit_flow",
    resourceBindingId,
    billingStoppedAt: state.stopBilling.billingStoppedAt,
    auditStatusAfterTPlus1: auditReadyState.res.payload.audit.status,
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
