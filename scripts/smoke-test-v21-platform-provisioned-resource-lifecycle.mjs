import assert from "node:assert/strict";

const { createPortalApiRoutes } = await import("../services/portal/src/routes/portal-api.routes.mjs");

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

function baseRouteDeps(overrides = {}) {
  return {
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
    visibleAnnouncementRows: () => [],
    workspaceChatSessionsForUser: () => [],
    writeDb: async () => {},
    ...overrides,
  };
}

const user = { id: "u-cloud", name: "Cloud", email: "cloud@example.test", role: "user", tenantId: "t-cloud" };

const missingProvisionerDb = { users: [user], wallets: [], ledger: [], announcements: [] };
const routeWithoutProvisioner = createPortalApiRoutes(baseRouteDeps());
const rejectedCloudCompute = await invoke(routeWithoutProvisioner, {
  method: "POST",
  pathname: "/portal/api/platform-provisioned-resources/compute-instances",
  user,
  db: missingProvisionerDb,
  body: {
    resourceLifecycleMode: "platform_provisioned",
    region: "na-siliconvalley",
    zone: "na-siliconvalley-1",
    instanceType: "SA5.MEDIUM4",
    serverPlanId: "cpu-2c4g",
  },
});
assert.equal(rejectedCloudCompute.handled, true, "cloud_compute_route_must_be_handled");
assert.equal(rejectedCloudCompute.status, 503, "cloud_compute_without_provisioner_must_return_503");
assert.equal(rejectedCloudCompute.payload?.error, "cloud_provisioner_required", "cloud_compute_without_provisioner_error_mismatch");
assert.equal(missingProvisionerDb.userComputeInstances?.length || 0, 0, "cloud_compute_without_provisioner_must_not_write_metadata");

const calls = [];
const cloudProvisioner = {
  async provisionCompute(request) {
    calls.push({ action: "provisionCompute", request });
    return {
      cloudResourceId: "ins-cloud-a",
      cvmInstanceId: "ins-cloud-a",
      instanceId: "ins-cloud-a",
      publicEndpoint: "https://runtime-agent.example.test",
      privateEndpoint: "http://10.0.0.12:18080",
      runtimeAgentId: "agent-cloud-a",
      runtimeAgentEndpoint: "https://runtime-agent.example.test",
      runtimeAgentVersion: "v21-agent",
      billingStartedAt: "2026-05-06T00:00:00.000Z",
      provisionEvidenceId: "compute-evidence-a",
      provisionEvidence: { requestId: "req-compute-a", cloudResourceId: "ins-cloud-a" },
    };
  },
  async provisionStorage(request) {
    calls.push({ action: "provisionStorage", request });
    return {
      cloudResourceId: "cos-cloud-a",
      bucketName: "opl-cloud-a",
      bucketId: "opl-cloud-a",
      endpoint: "https://opl-cloud-a.cos.na-siliconvalley.myqcloud.com",
      credentialsSecretRef: "secret/storage/cloud-a",
      rootPrefix: "users/u-cloud/",
      billingStartedAt: "2026-05-06T00:00:01.000Z",
      provisionEvidenceId: "storage-evidence-a",
      provisionEvidence: { requestId: "req-storage-a", bucketName: "opl-cloud-a" },
    };
  },
  async releaseCompute(request) {
    calls.push({ action: "releaseCompute", request });
    return {
      releaseEvidenceId: "compute-release-a",
      releaseEvidence: { requestId: "req-release-compute-a", cloudResourceId: request.computeInstance.cloudResourceId },
      billingStoppedAt: "2026-05-06T01:00:00.000Z",
    };
  },
  async releaseStorage(request) {
    calls.push({ action: "releaseStorage", request });
    return {
      releaseEvidenceId: "storage-release-a",
      releaseEvidence: { requestId: "req-release-storage-a", cloudResourceId: request.storageBucket.cloudResourceId },
      billingStoppedAt: "2026-05-06T01:00:01.000Z",
    };
  },
};

const db = { users: [user], wallets: [], ledger: [], announcements: [] };
const route = createPortalApiRoutes(baseRouteDeps({ cloudProvisioner }));

const createdCompute = await invoke(route, {
  method: "POST",
  pathname: "/portal/api/platform-provisioned-resources/compute-instances",
  user,
  db,
  body: {
    resourceLifecycleMode: "platform_provisioned",
    region: "na-siliconvalley",
    zone: "na-siliconvalley-1",
    instanceType: "SA5.MEDIUM4",
    serverPlanId: "cpu-2c4g",
  },
});
assert.equal(createdCompute.status, 201, "cloud_compute_create_status_must_be_201");
assert.equal(createdCompute.payload?.item?.provisioningMode, "platform_provisioned", "cloud_compute_provisioning_mode_mismatch");
assert.equal(createdCompute.payload?.item?.cloudResourceId, "ins-cloud-a", "cloud_compute_resource_id_mismatch");
assert.equal(createdCompute.payload?.item?.cvmInstanceId, "ins-cloud-a", "cloud_compute_cvm_id_mismatch");
assert.equal(createdCompute.payload?.item?.runtimeAgentEndpoint, "https://runtime-agent.example.test", "cloud_compute_agent_endpoint_mismatch");
assert.equal(createdCompute.payload?.item?.provisionEvidenceId, "compute-evidence-a", "cloud_compute_evidence_id_mismatch");
assert.equal(createdCompute.payload?.item?.billingStartedAt, "2026-05-06T00:00:00.000Z", "cloud_compute_billing_started_at_mismatch");
assert.equal(calls[0].action, "provisionCompute", "cloud_compute_must_call_provision_compute");
assert.equal(calls[0].request.owner.ownerUserId, user.id, "cloud_compute_request_owner_user_mismatch");
assert.equal(calls[0].request.payload.instanceType, "SA5.MEDIUM4", "cloud_compute_request_instance_type_mismatch");

const createdStorage = await invoke(route, {
  method: "POST",
  pathname: "/portal/api/platform-provisioned-resources/storage-buckets",
  user,
  db,
  body: {
    resourceLifecycleMode: "platform_provisioned",
    provider: "cos",
    region: "na-siliconvalley",
    storagePlanId: "storage-100g",
    storageCapacityGb: 100,
  },
});
assert.equal(createdStorage.status, 201, "cloud_storage_create_status_must_be_201");
assert.equal(createdStorage.payload?.item?.provisioningMode, "platform_provisioned", "cloud_storage_provisioning_mode_mismatch");
assert.equal(createdStorage.payload?.item?.cloudResourceId, "cos-cloud-a", "cloud_storage_resource_id_mismatch");
assert.equal(createdStorage.payload?.item?.bucketName, "opl-cloud-a", "cloud_storage_bucket_name_mismatch");
assert.equal(createdStorage.payload?.item?.rootPrefix, "users/u-cloud/", "cloud_storage_root_prefix_mismatch");
assert.equal(createdStorage.payload?.item?.provisionEvidenceId, "storage-evidence-a", "cloud_storage_evidence_id_mismatch");
assert.equal(calls[1].action, "provisionStorage", "cloud_storage_must_call_provision_storage");
assert.equal(calls[1].request.payload.storageCapacityGb, 100, "cloud_storage_request_capacity_mismatch");

const bound = await invoke(route, {
  method: "POST",
  pathname: "/portal/api/platform-provisioned-resources/bind",
  user,
  db,
  body: {
    workspaceId: "ws-cloud",
    computeInstanceId: createdCompute.payload.item.id,
    storageBucketId: createdStorage.payload.item.id,
  },
});
assert.equal(bound.status, 200, "cloud_binding_status_must_be_200");

const ensuredFreeze = await invoke(route, {
  method: "POST",
  pathname: "/portal/api/platform-provisioned-resources/protection-freezes/ensure",
  user,
  db,
  body: {
    bindingId: bound.payload.binding.id,
    weeklyAmount: 70,
    windowStartAt: "2026-05-06T00:00:00.000Z",
    windowEndAt: "2026-05-13T00:00:00.000Z",
    usageMode: "full_runtime",
  },
});
assert.equal(ensuredFreeze.status, 200, "cloud_freeze_status_must_be_200");

const deletedCompute = await invoke(route, {
  method: "POST",
  pathname: "/portal/api/platform-provisioned-resources/compute-instances/delete",
  user,
  db,
  body: { computeInstanceId: createdCompute.payload.item.id },
});
assert.equal(deletedCompute.status, 200, "cloud_compute_delete_status_must_be_200");
assert.equal(deletedCompute.payload?.item?.status, "deleted", "cloud_compute_delete_status_mismatch");
assert.equal(deletedCompute.payload?.item?.releaseEvidenceId, "compute-release-a", "cloud_compute_release_evidence_id_mismatch");
assert.equal(deletedCompute.payload?.item?.billingStoppedAt, "2026-05-06T01:00:00.000Z", "cloud_compute_release_billing_stopped_at_mismatch");
assert.equal(deletedCompute.payload?.affectedBindings?.[0]?.status, "inactive", "cloud_compute_delete_must_deactivate_binding");
assert.equal(deletedCompute.payload?.releasedProtection?.releasedAmount, 70, "cloud_compute_delete_must_release_protection");
assert.equal(calls[2].action, "releaseCompute", "cloud_compute_delete_must_call_release_compute");
assert.equal(calls[2].request.computeInstance.cloudResourceId, "ins-cloud-a", "cloud_compute_release_request_resource_mismatch");

const deletedStorage = await invoke(route, {
  method: "POST",
  pathname: "/portal/api/platform-provisioned-resources/storage-buckets/delete",
  user,
  db,
  body: { storageBucketId: createdStorage.payload.item.id },
});
assert.equal(deletedStorage.status, 200, "cloud_storage_delete_status_must_be_200");
assert.equal(deletedStorage.payload?.item?.status, "deleted", "cloud_storage_delete_status_mismatch");
assert.equal(deletedStorage.payload?.item?.releaseEvidenceId, "storage-release-a", "cloud_storage_release_evidence_id_mismatch");
assert.equal(deletedStorage.payload?.item?.billingStoppedAt, "2026-05-06T01:00:01.000Z", "cloud_storage_release_billing_stopped_at_mismatch");
assert.equal(calls[3].action, "releaseStorage", "cloud_storage_delete_must_call_release_storage");
assert.equal(calls[3].request.storageBucket.cloudResourceId, "cos-cloud-a", "cloud_storage_release_request_resource_mismatch");

console.log(JSON.stringify({ ok: true, contract: "v21_platform_provisioned_resource_lifecycle" }, null, 2));
