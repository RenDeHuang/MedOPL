import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { createWorkspacePayloadBuilder } from "../services/portal/src/app/portal-page-workspace-payloads.mjs";

const RAW_API_KEY = "gflabtoken_raw_key_managed_plan_view";

const forbiddenFieldPattern = /SecretId|SecretKey|kubeconfig|rawApiKey|apiKey|bearerToken|token|objectKey|storageKey|localPath|signedUrl|providerRawCost|rawCostInternal/i;
const forbiddenValuePattern = new RegExp([
  RAW_API_KEY,
  "secret-id-value",
  "secret-key-value",
  "kubeconfig-value",
  "bearer-token-secret",
  "runtime/internal/object",
  "runtime-storage-key",
  "/runtime/private/result",
  "signed.example.test",
].map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));

function assertNoForbiddenLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(forbiddenFieldPattern.test(serialized), false, `${label}_must_not_include_forbidden_field`);
  assert.equal(forbiddenValuePattern.test(serialized), false, `${label}_must_not_include_forbidden_value`);
}

function assertUserCopy(source, label) {
  for (const required of ["托管运行环境", "区域", "规格", "预计费用", "释放策略", "审计状态", "状态"]) {
    assert(source.includes(required), `${label}_missing_user_copy:${required}`);
  }
  for (const forbidden of ["CVM", "COS", "K8s", "TKE", "云资源控制台", "SecretId", "SecretKey", "kubeconfig", "raw API key", "objectKey", "storageKey", "localPath", "signedUrl"]) {
    assert.equal(source.includes(forbidden), false, `${label}_must_not_show_forbidden_copy:${forbidden}`);
  }
}

const user = {
  id: "user-v22-managed-plan",
  tenantId: "tenant-v22-managed-plan",
  email: "managed-plan@example.test",
  role: "user",
};

const workspaceId = "workspace-v22-managed-plan";
const resourceBindingId = "rb-v22-managed-plan";

const db = {
  users: [user],
  taskSpaces: [{
    slug: workspaceId,
    userId: user.id,
    path: `/tmp/${workspaceId}`,
    title: "Managed Plan View",
    status: "active",
    serverPlanId: "pro_8c16g_100gb",
    createdAt: "2026-05-08T08:00:00.000Z",
  }],
  workspaceResourceBindings: [{
    id: resourceBindingId,
    resourceBindingId,
    ownerTenantId: user.tenantId,
    ownerUserId: user.id,
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId,
    planId: "pro_8c16g_100gb",
    serverPlanId: "pro_8c16g_100gb",
    status: "active",
    region: "na-siliconvalley",
    zone: "na-siliconvalley-1",
    fileSpaceGb: 100,
    basePrice: null,
    pendingProductApproval: true,
    releasedAt: "",
    billingStopConfirmBy: "",
    auditStatus: "audit_pending",
    auditReadyAt: "2026-05-09T08:00:00.000Z",
    SecretId: "secret-id-value",
    SecretKey: "secret-key-value",
    kubeconfig: "kubeconfig-value",
    bearerToken: "bearer-token-secret",
    providerRawCost: "must-not-leak",
    objectKey: "runtime/internal/object/result.md",
    storageKey: "runtime-storage-key",
    localPath: "/runtime/private/result.md",
    signedUrl: "https://signed.example.test/result.md",
    rawApiKey: RAW_API_KEY,
    createdAt: "2026-05-08T08:00:00.000Z",
    updatedAt: "2026-05-08T08:01:00.000Z",
  }],
  weeklyProtectionFreezes: [{
    id: "freeze-v22-managed-plan",
    resourceBindingId,
    ownerTenantId: user.tenantId,
    ownerUserId: user.id,
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId,
    weeklyAmount: 0,
    weeklyAmountCents: 0,
    frozenAmount: 0,
    frozenAmountCents: 0,
    status: "active_pending_product_approval",
    preauthStatus: "pending_product_approval",
  }],
  workspaceFiles: [],
  workspaceSessions: [],
};

const billingSummary = {
  source: "contract_snapshot_fixture",
  currency: "CNY",
  totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
  items: [],
};

const buildWorkspacePayload = createWorkspacePayloadBuilder({
  collectRunsForUser: async () => [],
  currentServerPlanSelection: () => null,
  defaultTaskTitle: (slug) => slug,
  ensureTaskSpace: async () => db.taskSpaces[0],
  fetchBillingSummary: async () => billingSummary,
  findTaskSpace: () => db.taskSpaces[0],
  formatDateTime: (value) => String(value || ""),
  isRunTerminal: () => true,
  latestActiveWorkspaceSession: () => null,
  listFilesRecursive: async () => [],
  listTaskSpacesForUser: () => db.taskSpaces,
  mkdir: async () => {},
  path,
  readPortalEvents: async () => [],
  sanitizeTaskTitle: (_slug, title) => title,
  stat: async () => ({ size: 0 }),
  workspaceStorageEntitlement: () => ({
    enabled: true,
    status: "active",
    storageSizeGb: 100,
    storageBackend: "file_space",
    message: "active",
  }),
});

const workspacePayload = await buildWorkspacePayload(db, user, workspaceId);
const planView = workspacePayload.managedResourceBindingPlan;

assert.equal(planView.resourceBindingId, resourceBindingId, "plan_view_resource_binding_id_mismatch");
assert.equal(planView.managedEnvironment, "托管运行环境", "plan_view_managed_environment_label_mismatch");
assert.equal(planView.regionLabel, "硅谷一区", "plan_view_region_label_mismatch");
assert.equal(planView.planSpec, "8核 / 16GB 内存 / 100GB 文件空间", "plan_view_plan_spec_mismatch");
assert.equal(planView.status, "active", "plan_view_status_mismatch");
assert.equal(planView.estimatedCost.amount, 0, "plan_view_estimated_cost_amount_mismatch");
assert.equal(planView.estimatedCost.source, "contract_snapshot_fixture", "plan_view_estimated_cost_source_mismatch");
assert.equal(planView.estimatedCost.billingTruth, false, "plan_view_estimated_cost_must_not_be_billing_truth");
assert.equal(planView.estimatedCost.chargeApplied, false, "plan_view_must_not_apply_real_charge");
assert.equal(planView.releasePolicy.status, "not_released", "plan_view_release_policy_mismatch");
assert.equal(planView.releasePolicy.stopBillingConfirmWithinMinutes, 120, "plan_view_release_policy_window_mismatch");
assert.equal(planView.auditStatus.status, "audit_pending", "plan_view_audit_status_mismatch");
assert.equal(planView.snapshot.source, "mock_snapshot_provider", "plan_view_snapshot_source_mismatch");
assert.equal(planView.snapshot.realResourceCreated, false, "plan_view_must_not_claim_real_resource_created");
assert.equal(planView.snapshot.providerAdapterStage, "mock_snapshot_provider", "plan_view_provider_stage_mismatch");
assertNoForbiddenLeak(workspacePayload, "workspace_payload");

const workspaceViewSource = await readFile("services/portal/frontend/src/views/workspace/WorkspaceView.vue", "utf8");
const workspaceTypesSource = await readFile("services/portal/frontend/src/api/portal/workspace.ts", "utf8");
const contractSource = await readFile("docs/contracts/v22-managed-environment-open-boundary.md", "utf8");
const suiteSource = await readFile("scripts/smoke-test-v22-mvp-contract-suite.mjs", "utf8");

assertUserCopy(workspaceViewSource, "workspace_view");
assert(workspaceViewSource.includes("managedResourceBindingPlan"), "workspace_view_must_render_managed_resource_binding_plan");
assert(workspaceTypesSource.includes("managedResourceBindingPlan"), "workspace_types_must_include_managed_resource_binding_plan");
assert(contractSource.includes("本分支允许的最小 Portal frontend 展示范围"), "contract_must_allow_minimal_portal_frontend_display");
assert(contractSource.includes("Portal 工作空间 payload 输出 `managedResourceBindingPlan`"), "contract_must_allow_managed_resource_binding_plan_payload");
assert(contractSource.includes("Portal 工作空间普通用户页面展示托管运行环境的区域、规格、状态、预计费用、释放策略和审计状态"), "contract_must_allow_managed_resource_binding_plan_view");
assert.equal(contractSource.includes("- 不改 frontend。"), false, "contract_must_not_prohibit_required_frontend_scope");
assert(contractSource.includes("不创建、绑定或释放真实腾讯云资源"), "contract_must_forbid_real_tencent_resource_lifecycle");
assert(contractSource.includes("不调用真实腾讯云、COS、Langfuse 或 one-person-lab API"), "contract_must_forbid_real_external_api_calls");
assert(contractSource.includes("mock/snapshot provider -> readonly/tencent quote provider -> dry-run/tencent plan provider -> authorized/tencent create/release provider"), "contract_must_include_tencent_adapter_route");
assert(contractSource.includes("真实接入另开 feat/* 并单独授权"), "contract_must_require_separate_authorization");
assert(contractSource.includes("managed resource binding plan / mock snapshot"), "contract_must_define_mock_snapshot_plan_view");
assert(suiteSource.includes("smoke-test-v22-managed-resource-binding-plan-view"), "mvp_suite_must_include_managed_plan_view_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_managed_resource_binding_plan_view",
  covered: [
    "workspace_managed_environment_plan_summary",
    "mock_snapshot_not_real_resource_created",
    "business_payload_without_cloud_provider_objects",
    "charge_applied_false",
    "tencent_provider_adapter_route_deferred",
    "secret_cloud_internal_storage_guard",
  ],
}, null, 2));
