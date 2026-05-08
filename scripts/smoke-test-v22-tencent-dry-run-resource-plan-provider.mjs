import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { createWorkspacePayloadBuilder } from "../services/portal/src/app/portal-page-workspace-payloads.mjs";
import {
  createMockTencentDryRunResourcePlanProvider,
  planTencentDryRunResourceBinding,
} from "../services/portal/src/domain/tencent-dry-run-resource-plan-provider.mjs";
import {
  createMockTencentReadonlyQuoteProvider,
  quoteManagedResourceBindingPlan,
} from "../services/portal/src/domain/tencent-readonly-quote-provider.mjs";

const RAW_API_KEY = "gflabtoken_raw_key_tencent_dry_run_plan";

const forbiddenFieldPattern = /SecretId|SecretKey|kubeconfig|bearerToken|runtimeToken|launchToken|rawApiKey|apiKey|providerRawCost|rawCostInternal|cvmInstance|cosBucket|k8sCluster|tkeCluster|cloudInstance|cloudDisk|cloudVpc|objectKey|storageKey|localPath|signedUrl/i;
const forbiddenValuePattern = new RegExp([
  RAW_API_KEY,
  "secret-id-value",
  "secret-key-value",
  "kubeconfig-value",
  "bearer-token-secret",
  "raw-provider-cost",
  "runtime/internal/object",
  "runtime-storage-key",
  "/runtime/private/result",
  "signed.example.test",
  "must-not-leak",
].map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

const dryRunAllowedKeys = new Set([
  "resourcePlanId",
  "resourceBindingId",
  "planMode",
  "regionLabel",
  "planSpec",
  "estimatedCost",
  "resourceSteps",
  "approvalRequired",
  "releasePolicy",
  "auditStatus",
  "riskNotes",
  "realResourceCreated",
  "chargeApplied",
]);

const costAllowedKeys = new Set([
  "amount",
  "currency",
  "source",
  "status",
  "billingTruth",
  "chargeApplied",
]);

function assertNoForbiddenLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(forbiddenFieldPattern.test(serialized), false, `${label}_must_not_include_forbidden_field`);
  assert.equal(forbiddenValuePattern.test(serialized), false, `${label}_must_not_include_forbidden_value`);
}

function assertOnlyKeys(object = {}, allowed = new Set(), label = "object") {
  for (const key of Object.keys(object)) {
    assert(allowed.has(key), `${label}_unexpected_key:${key}`);
  }
}

function assertNoRealTencentSdkSource(source, label) {
  for (const forbidden of [
    "tencentcloud-sdk-nodejs",
    "@tencentcloud",
    "DescribeInstances",
    "DescribeZones",
    "InquiryPrice",
    "RunInstances",
    "TerminateInstances",
    "CreateBucket",
    "DeleteBucket",
    "process.env.TENCENT",
    "process.env.SECRET",
    "secrets.env.txt",
  ]) {
    assert.equal(source.includes(forbidden), false, `${label}_must_not_use_real_tencent_sdk_or_secret:${forbidden}`);
  }
}

function assertProductLanguageSteps(resourceSteps = [], label = "resource_steps") {
  assert.deepEqual(resourceSteps, [
    "准备托管运行环境",
    "分配文件空间",
    "准备运行网络边界",
    "登记账单和审计边界",
  ], `${label}_mismatch`);
  const joined = resourceSteps.join("\n");
  for (const forbidden of ["CVM", "COS", "K8s", "TKE", "Kubernetes", "云资源控制台"]) {
    assert.equal(joined.includes(forbidden), false, `${label}_must_not_use_cloud_console_language:${forbidden}`);
  }
}

const binding = {
  id: "rb-v22-tencent-dry-run-plan",
  resourceBindingId: "rb-v22-tencent-dry-run-plan",
  workspaceId: "workspace-v22-tencent-dry-run-plan",
  planId: "pro_8c16g_100gb",
  serverPlanId: "pro_8c16g_100gb",
  status: "active",
  region: "na-siliconvalley",
  zone: "na-siliconvalley-1",
  fileSpaceGb: 100,
  auditStatus: "audit_pending",
  auditReadyAt: "2026-05-09T08:00:00.000Z",
  SecretId: "secret-id-value",
  SecretKey: "secret-key-value",
  kubeconfig: "kubeconfig-value",
  bearerToken: "bearer-token-secret",
  rawApiKey: RAW_API_KEY,
  providerRawCost: "raw-provider-cost",
  cvmInstance: { id: "must-not-leak" },
  cosBucket: { name: "must-not-leak" },
  objectKey: "runtime/internal/object/result.md",
  storageKey: "runtime-storage-key",
  localPath: "/runtime/private/result.md",
  signedUrl: "https://signed.example.test/result.md",
};

const quoteProvider = createMockTencentReadonlyQuoteProvider({
  snapshots: {
    pro_8c16g_100gb: {
      amount: 0,
      currency: "CNY",
      source: "contract_snapshot_fixture",
      quoteSnapshotId: "quote-snapshot-v22-pro-8c16g-100gb",
      quoteStatus: "mock_snapshot",
    },
  },
});

const quote = await quoteManagedResourceBindingPlan({
  provider: quoteProvider,
  binding,
});

const dryRunProvider = createMockTencentDryRunResourcePlanProvider();
const dryRunPlan = await planTencentDryRunResourceBinding({
  provider: dryRunProvider,
  binding,
  quote,
});

assertOnlyKeys(dryRunPlan, dryRunAllowedKeys, "dry_run_provider_response");
assertOnlyKeys(dryRunPlan.estimatedCost, costAllowedKeys, "dry_run_estimated_cost");
assert.equal(dryRunPlan.resourcePlanId, "dry-run-plan-rb-v22-tencent-dry-run-plan", "dry_run_plan_id_mismatch");
assert.equal(dryRunPlan.resourceBindingId, "rb-v22-tencent-dry-run-plan", "dry_run_resource_binding_id_mismatch");
assert.equal(dryRunPlan.planMode, "dry_run", "dry_run_plan_mode_mismatch");
assert.equal(dryRunPlan.regionLabel, "硅谷一区", "dry_run_region_label_mismatch");
assert.equal(dryRunPlan.planSpec, "8核 / 16GB 内存 / 100GB 文件空间", "dry_run_plan_spec_mismatch");
assert.equal(dryRunPlan.estimatedCost.source, "contract_snapshot_fixture", "dry_run_estimated_cost_source_mismatch");
assert.equal(dryRunPlan.estimatedCost.billingTruth, false, "dry_run_estimated_cost_must_not_be_billing_truth");
assert.equal(dryRunPlan.estimatedCost.chargeApplied, false, "dry_run_estimated_cost_must_not_apply_charge");
assertProductLanguageSteps(dryRunPlan.resourceSteps);
assert.equal(dryRunPlan.approvalRequired, true, "dry_run_must_require_approval");
assert.equal(dryRunPlan.releasePolicy.stopBillingConfirmWithinMinutes, 120, "dry_run_release_policy_window_mismatch");
assert.equal(dryRunPlan.auditStatus.status, "audit_pending", "dry_run_audit_status_mismatch");
assert.deepEqual(dryRunPlan.riskNotes, [
  "dry-run 只生成不会执行的资源创建计划",
  "真实腾讯云接入必须另开 feat/* 并单独授权",
  "当前不创建、绑定、释放真实资源，不真实扣费",
], "dry_run_risk_notes_mismatch");
assert.equal(dryRunPlan.realResourceCreated, false, "dry_run_must_not_claim_real_resource_created");
assert.equal(dryRunPlan.chargeApplied, false, "dry_run_must_not_apply_real_charge");
assertNoForbiddenLeak(dryRunPlan, "dry_run_provider_response");
assert.throws(() => planTencentDryRunResourceBinding({
  provider: dryRunProvider,
  binding: { planId: "pro_8c16g_100gb" },
  quote,
}), /resource_binding_required/, "dry_run_must_require_resource_binding");
assert.throws(() => planTencentDryRunResourceBinding({
  provider: dryRunProvider,
  binding,
  quote: {},
}), /readonly_quote_required/, "dry_run_must_require_readonly_quote");

const user = {
  id: "user-v22-tencent-dry-run-plan",
  tenantId: "tenant-v22-tencent-dry-run-plan",
  email: "tencent-dry-run-plan@example.test",
  role: "user",
};
const workspaceId = "workspace-v22-tencent-dry-run-plan";
const db = {
  users: [user],
  taskSpaces: [{
    slug: workspaceId,
    userId: user.id,
    path: `/tmp/${workspaceId}`,
    title: "Tencent Dry Run Plan",
    status: "active",
    serverPlanId: "pro_8c16g_100gb",
    createdAt: "2026-05-08T08:00:00.000Z",
  }],
  workspaceResourceBindings: [{
    ...binding,
    ownerTenantId: user.tenantId,
    ownerUserId: user.id,
    tenantId: user.tenantId,
    userId: user.id,
  }],
  workspaceFiles: [],
  workspaceSessions: [],
};

const buildWorkspacePayload = createWorkspacePayloadBuilder({
  collectRunsForUser: async () => [],
  currentServerPlanSelection: () => null,
  defaultTaskTitle: (slug) => slug,
  ensureTaskSpace: async () => db.taskSpaces[0],
  fetchBillingSummary: async () => ({
    source: "contract_snapshot_fixture",
    currency: "CNY",
    totals: { totalCost: 0 },
    items: [],
  }),
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
  workspaceStorageEntitlement: () => ({ enabled: true, status: "active", storageSizeGb: 100 }),
});

const workspacePayload = await buildWorkspacePayload(db, user, workspaceId);
const payloadPlan = workspacePayload.managedResourceBindingPlan;
assert(payloadPlan.resourcePlan, "portal_payload_must_include_dry_run_resource_plan");
assertOnlyKeys(payloadPlan.resourcePlan, dryRunAllowedKeys, "portal_payload_resource_plan");
assert.equal(payloadPlan.resourcePlan.planMode, "dry_run", "portal_payload_resource_plan_mode_mismatch");
assert.equal(payloadPlan.resourcePlan.realResourceCreated, false, "portal_payload_resource_plan_must_not_claim_real_resource_created");
assert.equal(payloadPlan.resourcePlan.chargeApplied, false, "portal_payload_resource_plan_must_not_apply_real_charge");
assertProductLanguageSteps(payloadPlan.resourcePlan.resourceSteps, "portal_payload_resource_steps");
assertNoForbiddenLeak(workspacePayload, "portal_workspace_payload");

const providerSource = await readFile("services/portal/src/domain/tencent-dry-run-resource-plan-provider.mjs", "utf8");
const planViewSource = await readFile("services/portal/src/domain/managed-resource-binding-plan-view.mjs", "utf8");
const dryRunContractSource = await readFile("docs/contracts/v22-tencent-dry-run-resource-plan-provider-boundary.md", "utf8");
const readonlyContractSource = await readFile("docs/contracts/v22-tencent-readonly-quote-provider-boundary.md", "utf8");
const managedContractSource = await readFile("docs/contracts/v22-managed-environment-open-boundary.md", "utf8");
const readmeSource = await readFile("docs/contracts/README.md", "utf8");
const suiteSource = await readFile("scripts/smoke-test-v22-mvp-contract-suite.mjs", "utf8");

assertNoRealTencentSdkSource(providerSource, "dry_run_provider_source");
assertNoRealTencentSdkSource(planViewSource, "managed_plan_view_source");
assert(dryRunContractSource.includes("dry-run/tencent resource plan provider"), "dry_run_contract_must_define_provider");
assert(dryRunContractSource.includes("不会执行的资源创建计划"), "dry_run_contract_must_define_non_executing_plan");
assert(dryRunContractSource.includes("realResourceCreated=false"), "dry_run_contract_must_fix_real_resource_false");
assert(dryRunContractSource.includes("chargeApplied=false"), "dry_run_contract_must_fix_charge_applied_false");
assert(dryRunContractSource.includes("mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> authorized/tencent create/release"), "dry_run_contract_must_keep_adapter_route");
assert(readonlyContractSource.includes("dry-run/tencent plan provider"), "readonly_contract_must_reference_dry_run_stage");
assert(managedContractSource.includes("dry-run/tencent plan provider"), "managed_contract_must_reference_dry_run_stage");
assert(readmeSource.includes("v22-tencent-dry-run-resource-plan-provider-boundary.md"), "contracts_readme_must_index_dry_run_provider");
assert(suiteSource.includes("smoke-test-v22-tencent-dry-run-resource-plan-provider"), "mvp_suite_must_include_dry_run_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_dry_run_resource_plan_provider",
  covered: [
    "dry_run_provider_field_allowlist",
    "product_language_resource_steps",
    "provider_response_and_portal_payload_secret_guard",
    "no_real_tencent_sdk_or_env_secret_calls",
    "real_resource_created_false_and_charge_applied_false",
    "mvp_suite_includes_dry_run_smoke",
  ],
}, null, 2));
