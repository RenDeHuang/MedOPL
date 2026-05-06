import assert from "node:assert/strict";

const { createPortalApiRoutes } = await import("../services/portal/src/routes/portal-api.routes.mjs");

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
  users: [
    { id: "u-v21", name: "V21", email: "v21@example.test", role: "user", tenantId: "t-v21" },
    { id: "u-other", name: "Other", email: "other@example.test", role: "user", tenantId: "t-other" },
  ],
  wallets: [],
  ledger: [],
  announcements: [],
};
const user = db.users[0];
const otherUser = db.users[1];

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
  body: { region: "ap-guangzhou", instanceType: "S5.LARGE8", cvmInstanceId: "ins-v21-a" },
});
assert.equal(createdCompute.handled, true, "create_compute_route_must_be_handled");
assert.equal(createdCompute.status, 201, "create_compute_status_must_be_201");
assert.equal(createdCompute.payload?.ok, true, "create_compute_ok_must_be_true");
assert.equal(createdCompute.payload?.item?.ownerUserId, "u-v21", "create_compute_owner_user_mismatch");
assert.equal(createdCompute.payload?.item?.cvmInstanceId, "ins-v21-a", "create_compute_cvm_instance_id_mismatch");
assert.equal("workspaceId" in createdCompute.payload.item, false, "compute_instance_must_not_belong_to_workspace_directly");

const createdBucket = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/storage-buckets"),
  user,
  db,
  body: { region: "ap-guangzhou", bucketName: "bucket-v21-a", rootPrefix: "users/u-v21/" },
});
assert.equal(createdBucket.status, 201, "create_bucket_status_must_be_201");
assert.equal("workspaceId" in createdBucket.payload.item, false, "storage_bucket_must_not_belong_to_workspace_directly");

const otherUserCompute = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/compute-instances"),
  user: otherUser,
  db,
  body: { region: "ap-shanghai", instanceType: "S5.LARGE8", cvmInstanceId: "ins-v21-other" },
});
assert.equal(otherUserCompute.status, 201, "other_user_compute_status_must_be_201");

const crossOwnerBind = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/bind"),
  user,
  db,
  body: {
    workspaceId: "ws-cross-owner",
    computeInstanceId: otherUserCompute.payload.item.id,
    storageBucketId: createdBucket.payload.item.id,
  },
});
assert.equal(crossOwnerBind.status, 404, "cross_owner_bind_status_must_be_404");
assert.equal(crossOwnerBind.payload?.error, "compute_instance_not_found_in_owner_scope", "cross_owner_bind_error_mismatch");

const bindResult = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/bind"),
  user,
  db,
  body: {
    workspaceId: "ws-v21",
    computeInstanceId: createdCompute.payload.item.id,
    storageBucketId: createdBucket.payload.item.id,
  },
});
assert.equal(bindResult.status, 200, "bind_status_must_be_200");
assert.equal(bindResult.payload?.ok, true, "bind_ok_must_be_true");
assert.equal(bindResult.payload?.binding?.rootPrefix, "users/u-v21/workspaces/ws-v21/", "bind_default_root_prefix_mismatch");
assert.equal(bindResult.payload?.binding?.bindingAccess?.oplLite?.bindingRequired, false, "opl_lite_must_not_require_binding");
assert.equal(bindResult.payload?.binding?.bindingAccess?.fullRuntime?.bindingRequired, true, "full_runtime_must_require_binding");
assert.equal(bindResult.payload?.binding?.bindingAccess?.fullRuntime?.allowed, true, "active_binding_must_allow_full_runtime");
assert.equal(bindResult.payload?.binding?.bindingAccess?.workspaceFiles?.allowed, true, "active_binding_must_allow_workspace_files");
assert.equal(bindResult.payload?.binding?.bindingAccess?.workspaceTasks?.allowed, true, "active_binding_must_allow_workspace_tasks");
assert.equal(bindResult.payload?.binding?.bindingAccess?.workspaceOutputs?.allowed, true, "active_binding_must_allow_workspace_outputs");
assert.equal(bindResult.payload?.binding?.protection, null, "binding_without_freeze_must_not_report_protection");

const listResult = await invoke(route, {
  method: "GET",
  pathname: resourcePath(),
  user,
  db,
});
assert.equal(listResult.handled, true, "list_route_must_be_handled");
assert.equal(listResult.status, 200, "list_status_must_be_200");
assert.equal(listResult.payload?.ok, true, "list_ok_must_be_true");
assert.equal(listResult.payload?.source, "portal_platform_provisioned_resources", "list_source_mismatch");
assert.equal(Array.isArray(listResult.payload?.bindings), true, "list_bindings_must_be_array");
assert.equal(listResult.payload.bindings.length, 1, "list_bindings_count_must_be_1");
assert.equal(Array.isArray(listResult.payload?.protectionFreezes), true, "list_protection_freezes_must_be_array");
assert.equal(listResult.payload?.summary?.activeBindings, 1, "list_active_bindings_must_be_1");
assert.equal(listResult.payload?.summary?.inactiveBindings, 0, "list_inactive_bindings_must_be_0");
assert.equal(listResult.payload?.summary?.frozenAmount, 0, "list_initial_frozen_amount_must_be_zero");
assert.equal(listResult.payload?.summary?.releasedProtectionAmount, 0, "list_initial_released_protection_amount_must_be_zero");
assert.equal(JSON.stringify(listResult.payload).includes("nodePoolId"), false, "list_must_not_depend_on_nodepool");

const ensuredFreeze = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/protection-freezes/ensure"),
  user,
  db,
  body: {
    bindingId: bindResult.payload.binding.id,
    weeklyAmount: 70,
    windowStartAt: "2026-05-04T00:00:00.000Z",
    windowEndAt: "2026-05-11T00:00:00.000Z",
    usageMode: "full_runtime",
  },
});
assert.equal(ensuredFreeze.status, 200, "binding_freeze_ensure_status_must_be_200");
assert.equal(ensuredFreeze.payload?.binding?.protection?.remainingAmount, 70, "binding_freeze_ensure_remaining_amount_mismatch");

const deletedCompute = await invoke(route, {
  method: "POST",
  pathname: resourcePath("/compute-instances/delete"),
  user,
  db,
  body: { computeInstanceId: createdCompute.payload.item.id },
});
assert.equal(deletedCompute.status, 200, "delete_compute_status_must_be_200");
assert.equal(deletedCompute.payload?.ok, true, "delete_compute_ok_must_be_true");
assert.equal(deletedCompute.payload?.item?.status, "deleted", "delete_compute_must_mark_compute_deleted");
assert.equal(Boolean(deletedCompute.payload?.item?.billingStoppedAt), true, "delete_compute_must_set_billing_stopped_at");
assert.equal(deletedCompute.payload?.releasedProtection?.releasedAmount, 70, "delete_compute_must_release_remaining_protection");
assert.equal(deletedCompute.payload?.affectedBindings?.[0]?.status, "inactive", "delete_compute_must_inactivate_related_binding");
assert.equal(deletedCompute.payload?.affectedBindings?.[0]?.protection?.status, "released", "delete_compute_must_release_binding_protection");

const listAfterDelete = await invoke(route, {
  method: "GET",
  pathname: resourcePath(),
  user,
  db,
});
assert.equal(listAfterDelete.payload.bindings.length, 1, "delete_compute_must_keep_binding_history");
assert.equal(listAfterDelete.payload.summary.activeBindings, 0, "delete_compute_must_clear_active_bindings");
assert.equal(listAfterDelete.payload.summary.inactiveBindings, 1, "delete_compute_must_count_inactive_bindings");
assert.equal(listAfterDelete.payload.summary.activeProtectionFreezes, 0, "delete_compute_must_clear_active_protection_freezes");
assert.equal(listAfterDelete.payload.summary.releasedProtectionAmount, 70, "delete_compute_must_report_released_protection_amount");
assert.equal(listAfterDelete.payload.bindings[0].bindingAccess.fullRuntime.allowed, false, "deleted_compute_binding_must_block_full_runtime_in_list");
assert.equal(listAfterDelete.payload.bindings[0].bindingAccess.oplLite.allowed, true, "opl_lite_must_not_depend_on_active_binding");
assert.equal(listAfterDelete.payload.bindings[0].protection?.releasedAmount, 70, "deleted_compute_binding_must_report_released_amount");
assert.equal(listAfterDelete.payload.computeInstances[0].status, "deleted", "deleted_compute_must_be_visible_in_list");
assert.equal(Boolean(listAfterDelete.payload.computeInstances[0].billingStoppedAt), true, "deleted_compute_list_must_expose_billing_stopped_at");

const legacyListAfterDelete = await invoke(route, {
  method: "GET",
  pathname: legacyResourcePath(),
  user,
  db,
});
assert.equal(legacyListAfterDelete.handled, true, "legacy_list_route_must_be_handled");
assert.equal(legacyListAfterDelete.status, 200, "legacy_list_status_must_be_200");
assert.equal(legacyListAfterDelete.payload?.source, "portal_platform_provisioned_resources", "legacy_list_source_mismatch");
assert.equal(legacyListAfterDelete.payload?.summary?.inactiveBindings, 1, "legacy_list_must_read_same_resource_model");

console.log(JSON.stringify({ ok: true, contract: "v21_platform_provisioned_resource_binding" }, null, 2));
