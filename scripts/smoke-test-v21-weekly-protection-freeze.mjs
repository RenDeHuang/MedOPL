import assert from "node:assert/strict";

const { createPortalApiRoutes } = await import("../services/portal/src/routes/portal-api.routes.mjs");
const { appendLedgerEntry, normalizeLedgerEntries } = await import("../services/portal/src/domain/wallet-ledger.mjs");

const RESOURCE_API_BASE = "/portal/api/platform-provisioned-resources";
const LEGACY_RESOURCE_API_BASE = "/portal/api/user-owned-resources";

function resourcePath(suffix = "") {
  return `${RESOURCE_API_BASE}${suffix}`;
}

function legacyResourcePath(suffix = "") {
  return `${LEGACY_RESOURCE_API_BASE}${suffix}`;
}

function createResponseRecorder() {
  return { statusCode: null, payload: null };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

async function invoke(route, { method, pathname, user, db, body }) {
  const req = { method, url: pathname, __rawBody: body ? Buffer.from(JSON.stringify(body)) : Buffer.from("") };
  const res = createResponseRecorder();
  const handled = await route({
    req,
    res,
    url: new URL(pathname, "http://portal.local"),
    db,
    user,
  });
  return { handled, status: res.statusCode, payload: res.payload };
}

function createMockCloudProvisioner() {
  return {
    provisionCompute: async ({ payload }) => ({
      cvmInstanceId: payload.cvmInstanceId,
      instanceId: payload.instanceId || payload.cvmInstanceId,
      cloudResourceId: payload.cloudResourceId || payload.cvmInstanceId,
      billingStartedAt: "2026-05-04T00:00:00.000Z",
      healthStatus: "healthy",
      provisionEvidenceId: "mock-compute-provision",
    }),
    provisionStorage: async ({ payload }) => ({
      bucketName: payload.bucketName,
      bucketId: payload.bucketId || payload.bucketName,
      cloudResourceId: payload.cloudResourceId || payload.bucketName,
      billingStartedAt: "2026-05-04T00:00:00.000Z",
      provisionEvidenceId: "mock-storage-provision",
    }),
    releaseCompute: async () => ({
      releaseEvidenceId: "mock-compute-release",
      billingStoppedAt: "2026-05-04T01:00:00.000Z",
    }),
    releaseStorage: async () => ({
      releaseEvidenceId: "mock-storage-release",
      billingStoppedAt: "2026-05-04T01:00:00.000Z",
    }),
  };
}

const db = {
  users: [{ id: "u-freeze", name: "Freeze", email: "freeze@example.test", role: "user", tenantId: "t-freeze" }],
  wallets: [],
  ledger: [],
  announcements: [],
};
const user = db.users[0];

const route = createPortalApiRoutes({
  activeUserStatus: (status) => status || "active",
  adminScopeResult: () => ({ ok: false, status: 403, error: "forbidden" }),
  announcementRows: () => [],
  buildCommercialProfile: () => ({ accountStatus: "active", billingStatus: "funded", entitlementStatus: "active" }),
  buildSessionTraceDetailPayload: async () => null,
  buildSessionTracesApiPayload: async () => ({ items: [] }),
  collectRunsForUser: async () => [],
  currentServerPlanSelection: () => ({ id: "none" }),
  currentTaskSpaceForUser: () => ({ slug: "default" }),
  evaluateUserPolicy: async () => ({ ok: true }),
  fetchBillingSummary: async () => ({ totals: { totalCost: 0 }, items: [] }),
  fetchHarborSummary: async () => ({ available: false }),
  fetchLangfuseSummary: async () => ({ available: false }),
  fetchOplAdapterCosts: async () => [],
  fetchOplAdapterRuns: async () => [],
  fetchOplAdapterTraceRows: async () => ({ rows: [] }),
  fetchOpsRegistryImageRows: async () => ({ items: [] }),
  fetchTraceRows: async () => ({ rows: [] }),
  formatDateTime: (v) => String(v || ""),
  isRunTerminal: () => true,
  normalizePageSize: () => 20,
  paginateRows: (rows) => ({ rows, page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 }),
  parsePositiveInt: () => 1,
  productProfile: {},
  readBody: async (req) => req.__rawBody || Buffer.from(""),
  readSessionsRequestOptions: () => ({}),
  readTracesRequestOptions: () => ({}),
  sendJson,
  buildUserBillingSummary: () => ({ balanceCents: 0 }),
  cloudProvisioner: createMockCloudProvisioner(),
  visibleAnnouncementRows: () => [],
  workspaceChatSessionsForUser: () => [],
  writeDb: async () => {},
});

const createdCompute = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/compute-instances"),
  user,
  db,
  body: { region: "ap-guangzhou", instanceType: "S5.LARGE8", cvmInstanceId: "ins-freeze-a" },
});
const createdBucket = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/storage-buckets"),
  user,
  db,
  body: { region: "ap-guangzhou", bucketName: "bucket-freeze-a" },
});
const activeBinding = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/bind"),
  user,
  db,
  body: {
    workspaceId: "ws-freeze",
    computeInstanceId: createdCompute.payload.item.id,
    storageBucketId: createdBucket.payload.item.id,
  },
});
assert.equal(activeBinding.status, 200, "active_binding_status_must_be_200");

const queryBeforeEnsure = await invoke(route, {
  method: "GET",
  pathname: resourcePath("/protection-freezes?bindingId=") + encodeURIComponent(activeBinding.payload.binding.id),
  user,
  db,
});
assert.equal(queryBeforeEnsure.status, 200, "query_before_ensure_status_must_be_200");
assert.equal(queryBeforeEnsure.payload?.items?.length, 0, "query_before_ensure_must_be_empty");

const firstEnsure = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/protection-freezes/ensure"),
  user,
  db,
  body: {
    bindingId: activeBinding.payload.binding.id,
    weeklyAmount: 70,
    windowStartAt: "2026-05-04T00:00:00.000Z",
    windowEndAt: "2026-05-11T00:00:00.000Z",
    usageMode: "full_runtime",
  },
});
assert.equal(firstEnsure.status, 200, "first_ensure_status_must_be_200");
assert.equal(firstEnsure.payload?.ok, true, "first_ensure_ok_must_be_true");
assert.equal(firstEnsure.payload?.created, true, "first_ensure_must_create_record");
assert.equal(firstEnsure.payload?.freeze?.resourceBindingId, activeBinding.payload.binding.id, "freeze_binding_id_mismatch");
assert.equal(firstEnsure.payload?.binding?.protection?.resourceBindingId, activeBinding.payload.binding.id, "binding_protection_binding_id_mismatch");
assert.equal(firstEnsure.payload?.freeze?.frozenAmount, 70, "first_ensure_frozen_amount_mismatch");
assert.equal(firstEnsure.payload?.freeze?.consumedAmount, 0, "first_ensure_consumed_amount_mismatch");
assert.equal(firstEnsure.payload?.freeze?.remainingAmount, 70, "first_ensure_remaining_amount_mismatch");
assert.equal(firstEnsure.payload?.freeze?.releasedAmount, 0, "first_ensure_released_amount_must_be_zero");
assert.equal(firstEnsure.payload?.freeze?.reconcile120MinStatus, "pending", "first_ensure_reconcile_status_mismatch");
assert.equal(firstEnsure.payload?.freeze?.tPlus1AuditStatus, "pending", "first_ensure_tplus1_status_mismatch");
assert.equal(firstEnsure.payload?.deltaFrozenAmount, 70, "first_ensure_delta_frozen_amount_mismatch");

const secondEnsure = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/protection-freezes/ensure"),
  user,
  db,
  body: {
    bindingId: activeBinding.payload.binding.id,
    weeklyAmount: 70,
    windowStartAt: "2026-05-04T00:00:00.000Z",
    windowEndAt: "2026-05-11T00:00:00.000Z",
    usageMode: "full_runtime",
    consumedDeltaAmount: 20,
  },
});
assert.equal(secondEnsure.status, 200, "second_ensure_status_must_be_200");
assert.equal(secondEnsure.payload?.created, false, "second_ensure_must_update_existing_record");
assert.equal(secondEnsure.payload?.deltaFrozenAmount, 20, "second_ensure_must_only_freeze_gap");
assert.equal(secondEnsure.payload?.freeze?.frozenAmount, 90, "second_ensure_total_frozen_amount_mismatch");
assert.equal(secondEnsure.payload?.freeze?.consumedAmount, 20, "second_ensure_consumed_amount_mismatch");
assert.equal(secondEnsure.payload?.freeze?.remainingAmount, 70, "second_ensure_remaining_amount_mismatch");
assert.equal(secondEnsure.payload?.freeze?.releasedAmount, 0, "second_ensure_released_amount_must_still_be_zero");

const queryAfterEnsure = await invoke(route, {
  method: "GET",
  pathname: resourcePath("/protection-freezes?bindingId=") + encodeURIComponent(activeBinding.payload.binding.id),
  user,
  db,
});
assert.equal(queryAfterEnsure.status, 200, "query_after_ensure_status_must_be_200");
assert.equal(queryAfterEnsure.payload?.items?.length, 1, "query_after_ensure_must_have_one_record");
assert.equal(queryAfterEnsure.payload?.items?.[0]?.remainingAmount, 70, "query_after_ensure_remaining_amount_mismatch");
assert.equal(queryAfterEnsure.payload?.summary?.frozenAmount, 90, "query_after_ensure_summary_frozen_amount_mismatch");
assert.equal(queryAfterEnsure.payload?.summary?.consumedAmount, 20, "query_after_ensure_summary_consumed_amount_mismatch");
assert.equal(queryAfterEnsure.payload?.summary?.remainingAmount, 70, "query_after_ensure_summary_remaining_amount_mismatch");

const listWithActiveFreeze = await invoke(route, {
  method: "GET",
  pathname: resourcePath(),
  user,
  db,
});
assert.equal(listWithActiveFreeze.status, 200, "list_with_active_freeze_status_must_be_200");
assert.equal(listWithActiveFreeze.payload?.bindings?.[0]?.protection?.frozenAmount, 90, "list_binding_protection_frozen_amount_mismatch");
assert.equal(listWithActiveFreeze.payload?.bindings?.[0]?.protection?.consumedAmount, 20, "list_binding_protection_consumed_amount_mismatch");
assert.equal(listWithActiveFreeze.payload?.bindings?.[0]?.protection?.remainingAmount, 70, "list_binding_protection_remaining_amount_mismatch");
assert.equal(listWithActiveFreeze.payload?.bindings?.[0]?.protection?.reconcile120MinStatus, "pending", "list_binding_protection_reconcile_status_mismatch");
assert.equal(listWithActiveFreeze.payload?.bindings?.[0]?.protection?.tPlus1AuditStatus, "pending", "list_binding_protection_tplus1_status_mismatch");
assert.equal(listWithActiveFreeze.payload?.summary?.activeProtectionFreezes, 1, "list_active_protection_freezes_must_be_1");
assert.equal(listWithActiveFreeze.payload?.summary?.frozenAmount, 90, "list_summary_frozen_amount_mismatch");
assert.equal(listWithActiveFreeze.payload?.summary?.consumedAmount, 20, "list_summary_consumed_amount_mismatch");
assert.equal(listWithActiveFreeze.payload?.summary?.remainingAmount, 70, "list_summary_remaining_amount_mismatch");

const apiOnlyBinding = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/bind"),
  user,
  db,
  body: {
    workspaceId: "ws-api-only",
    computeInstanceId: createdCompute.payload.item.id,
    storageBucketId: createdBucket.payload.item.id,
  },
});
assert.equal(apiOnlyBinding.status, 200, "api_only_binding_status_must_be_200");

const activeBindingLedger = appendLedgerEntry(db, {
  tenantId: user.tenantId,
  userId: user.id,
  workspaceId: "ws-freeze",
  runId: "run-freeze-ledger",
  resourceOrderId: "order-freeze-ledger",
  resourceBindingId: activeBinding.payload.binding.id,
  type: "exact_resource_charge",
  amount: 18.5,
  currency: "CNY",
  sourceType: "tencent_bill",
  sourceId: "bill-freeze-ledger",
  idempotencyKey: "exact_resource_charge:binding-freeze-ledger",
  reason: "resource_order_exact_bill_settlement",
  operatorId: "billing-aggregator",
});
assert.equal(activeBindingLedger.created, true, "active_binding_ledger_must_be_created");
const apiOnlyBindingLedger = appendLedgerEntry(db, {
  tenantId: user.tenantId,
  userId: user.id,
  workspaceId: "ws-api-only",
  runId: "run-api-only-ledger",
  resourceOrderId: "order-api-only-ledger",
  resourceBindingId: apiOnlyBinding.payload.binding.id,
  type: "exact_resource_charge",
  amount: 6.25,
  currency: "CNY",
  sourceType: "tencent_bill",
  sourceId: "bill-api-only-ledger",
  idempotencyKey: "exact_resource_charge:binding-api-only-ledger",
  reason: "resource_order_exact_bill_settlement",
  operatorId: "billing-aggregator",
});
assert.equal(apiOnlyBindingLedger.created, true, "api_only_binding_ledger_must_be_created");

const activeBindingAttributedLedger = normalizeLedgerEntries(db.ledger)
  .filter((entry) => entry.resourceBindingId === activeBinding.payload.binding.id);
assert.equal(activeBindingAttributedLedger.length, 1, "binding_ledger_must_be_filterable_by_resource_binding_id");
assert.equal(activeBindingAttributedLedger[0].amount, 18.5, "binding_ledger_amount_mismatch");
assert.equal(activeBindingAttributedLedger[0].resourceBindingId, activeBinding.payload.binding.id, "binding_ledger_resource_binding_id_mismatch");

const apiOnlyEnsure = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/protection-freezes/ensure"),
  user,
  db,
  body: {
    bindingId: apiOnlyBinding.payload.binding.id,
    weeklyAmount: 70,
    windowStartAt: "2026-05-04T00:00:00.000Z",
    windowEndAt: "2026-05-11T00:00:00.000Z",
    usageMode: "api_only",
  },
});
assert.equal(apiOnlyEnsure.status, 200, "api_only_ensure_status_must_be_200");
assert.equal(apiOnlyEnsure.payload?.skipped, true, "api_only_ensure_must_be_skipped");
assert.equal(apiOnlyEnsure.payload?.reason, "api_only_no_freeze", "api_only_ensure_reason_mismatch");
assert.equal(apiOnlyEnsure.payload?.freeze, null, "api_only_ensure_must_not_create_freeze");

const unboundApiOnlyBinding = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/unbind"),
  user,
  db,
  body: { bindingId: apiOnlyBinding.payload.binding.id },
});
assert.equal(unboundApiOnlyBinding.status, 200, "unbind_api_only_binding_status_must_be_200");

const releasedBinding = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/unbind"),
  user,
  db,
  body: { bindingId: activeBinding.payload.binding.id },
});
assert.equal(releasedBinding.status, 200, "unbind_active_binding_status_must_be_200");
assert.equal(releasedBinding.payload?.binding?.status, "inactive", "unbind_active_binding_must_mark_binding_inactive");
assert.equal(releasedBinding.payload?.binding?.protection?.status, "released", "unbind_active_binding_must_release_protection");
assert.equal(releasedBinding.payload?.binding?.protection?.remainingAmount, 0, "unbind_active_binding_must_clear_remaining_protection");
assert.equal(releasedBinding.payload?.binding?.protection?.releasedAmount, 70, "unbind_active_binding_released_amount_mismatch");
assert.equal(releasedBinding.payload?.releasedProtection?.releasedAmount, 70, "unbind_active_binding_route_released_amount_mismatch");

const listAfterRelease = await invoke(route, {
  method: "GET",
  pathname: resourcePath(),
  user,
  db,
});
assert.equal(listAfterRelease.status, 200, "list_after_release_status_must_be_200");
assert.equal(listAfterRelease.payload?.bindings?.find((item) => item.id === activeBinding.payload.binding.id)?.protection?.status, "released", "list_after_release_binding_protection_status_mismatch");
assert.equal(listAfterRelease.payload?.bindings?.find((item) => item.id === activeBinding.payload.binding.id)?.protection?.releasedAmount, 70, "list_after_release_binding_protection_released_amount_mismatch");
assert.equal(listAfterRelease.payload?.summary?.activeProtectionFreezes, 0, "list_after_release_active_protection_freezes_must_be_0");
assert.equal(listAfterRelease.payload?.summary?.releasedProtectionAmount, 70, "list_after_release_released_protection_amount_mismatch");
assert.equal(listAfterRelease.payload?.summary?.remainingAmount, 0, "list_after_release_remaining_amount_mismatch");

const inactiveBindingEnsure = await invoke(route, {
  method: "POST",
  pathname: legacyResourcePath("/protection-freezes/ensure"),
  user,
  db,
  body: {
    bindingId: apiOnlyBinding.payload.binding.id,
    weeklyAmount: 70,
    windowStartAt: "2026-05-04T00:00:00.000Z",
    windowEndAt: "2026-05-11T00:00:00.000Z",
    usageMode: "full_runtime",
  },
});
assert.equal(inactiveBindingEnsure.status, 409, "inactive_binding_ensure_status_must_be_409");
assert.equal(inactiveBindingEnsure.payload?.error, "active_binding_required", "inactive_binding_ensure_error_mismatch");

console.log(JSON.stringify({ ok: true, contract: "v21_platform_provisioned_weekly_protection_freeze" }, null, 2));
