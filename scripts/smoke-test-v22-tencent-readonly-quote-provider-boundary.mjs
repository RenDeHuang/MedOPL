import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createWorkspacePayloadBuilder } from "../services/portal/src/app/portal-page-workspace-payloads.mjs";
import {
  createMockTencentReadonlyQuoteProvider,
  quoteManagedResourceBindingPlan,
} from "../services/portal/src/domain/tencent-readonly-quote-provider.mjs";

const RAW_API_KEY = "gflabtoken_raw_key_tencent_quote_provider";
const forbiddenFieldPattern = /SecretId|SecretKey|kubeconfig|bearerToken|runtimeToken|launchToken|rawApiKey|apiKey|providerRawCost|rawCostInternal|cvmInstance|cosBucket|k8sCluster|tkeCluster|cloudInstance|cloudDisk|cloudVpc|objectKey|storageKey|localPath|signedUrl/i;
const forbiddenValuePattern = new RegExp([
  RAW_API_KEY,
  "secret-id-value",
  "secret-key-value",
  "kubeconfig-value",
  "bearer-token-secret",
  "raw-provider-cost",
  "tencentcloud-sdk",
  "DescribeInstances",
  "DescribePrice",
  "runtime/internal/object",
  "runtime-storage-key",
  "/runtime/private/result",
  "signed.example.test",
].map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

const providerAllowedKeys = new Set([
  "regionLabel",
  "planSpec",
  "estimatedCost",
  "quoteSource",
  "quoteStatus",
  "quoteSnapshotId",
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
    "secrets.env.txt",
  ]) {
    assert.equal(source.includes(forbidden), false, `${label}_must_not_use_real_tencent_sdk_or_secret:${forbidden}`);
  }
}

const binding = {
  id: "rb-v22-tencent-readonly-quote",
  resourceBindingId: "rb-v22-tencent-readonly-quote",
  workspaceId: "workspace-v22-tencent-readonly-quote",
  planId: "pro_8c16g_100gb",
  serverPlanId: "pro_8c16g_100gb",
  status: "active",
  region: "na-siliconvalley",
  zone: "na-siliconvalley-1",
  fileSpaceGb: 100,
  SecretId: "secret-id-value",
  SecretKey: "secret-key-value",
  kubeconfig: "kubeconfig-value",
  rawApiKey: RAW_API_KEY,
  providerRawCost: "raw-provider-cost",
  cvmInstance: { id: "must-not-leak" },
  cosBucket: { name: "must-not-leak" },
  objectKey: "runtime/internal/object/result.md",
  storageKey: "runtime-storage-key",
  localPath: "/runtime/private/result.md",
  signedUrl: "https://signed.example.test/result.md",
};

const mockProvider = createMockTencentReadonlyQuoteProvider({
  snapshots: {
    pro_8c16g_100gb: {
      amount: 0,
      currency: "CNY",
      quoteSnapshotId: "quote-snapshot-v22-pro-8c16g-100gb",
      quoteStatus: "mock_snapshot",
    },
  },
});

const quote = await quoteManagedResourceBindingPlan({
  provider: mockProvider,
  binding,
});

assertOnlyKeys(quote, providerAllowedKeys, "quote_provider_response");
assertOnlyKeys(quote.estimatedCost, costAllowedKeys, "quote_provider_estimated_cost");
assert.equal(quote.regionLabel, "硅谷一区", "quote_region_label_mismatch");
assert.equal(quote.planSpec, "8核 / 16GB 内存 / 100GB 文件空间", "quote_plan_spec_mismatch");
assert.equal(quote.estimatedCost.amount, 0, "quote_estimated_cost_amount_mismatch");
assert.equal(quote.estimatedCost.billingTruth, false, "quote_must_not_be_billing_truth");
assert.equal(quote.estimatedCost.chargeApplied, false, "quote_must_not_apply_real_charge");
assert.equal(quote.quoteSource, "mock/tencent-readonly-quote-provider", "quote_source_mismatch");
assert.equal(quote.quoteStatus, "mock_snapshot", "quote_status_mismatch");
assert.equal(quote.quoteSnapshotId, "quote-snapshot-v22-pro-8c16g-100gb", "quote_snapshot_id_mismatch");
assertNoForbiddenLeak(quote, "quote_provider_response");

const user = {
  id: "user-v22-tencent-readonly-quote",
  tenantId: "tenant-v22-tencent-readonly-quote",
  email: "tencent-readonly-quote@example.test",
  role: "user",
};
const workspaceId = "workspace-v22-tencent-readonly-quote";
const db = {
  users: [user],
  taskSpaces: [{
    slug: workspaceId,
    userId: user.id,
    path: `/tmp/${workspaceId}`,
    title: "Tencent Readonly Quote",
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
  fetchBillingSummary: async () => ({ source: "contract_snapshot_fixture", currency: "CNY", totals: { totalCost: 0 }, items: [] }),
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
const planView = workspacePayload.managedResourceBindingPlan;

assert.equal(planView.quoteSource, "mock/tencent-readonly-quote-provider", "plan_view_quote_source_mismatch");
assert.equal(planView.quoteStatus, "mock_snapshot", "plan_view_quote_status_mismatch");
assert.ok(planView.quoteSnapshotId, "plan_view_quote_snapshot_id_required");
assert.equal(planView.snapshot.realResourceCreated, false, "plan_view_must_not_claim_real_resource_created");
assert.equal(planView.estimatedCost.billingTruth, false, "plan_view_must_not_be_billing_truth");
assert.equal(planView.estimatedCost.chargeApplied, false, "plan_view_must_not_apply_real_charge");
assertNoForbiddenLeak(workspacePayload, "workspace_payload");

const providerSource = await readFile("services/portal/src/domain/tencent-readonly-quote-provider.mjs", "utf8");
const planViewSource = await readFile("services/portal/src/domain/managed-resource-binding-plan-view.mjs", "utf8");
const contractSource = await readFile("docs/contracts/v22-tencent-readonly-quote-provider-boundary.md", "utf8");
const managedContractSource = await readFile("docs/contracts/v22-managed-environment-open-boundary.md", "utf8");
const readmeSource = await readFile("docs/contracts/README.md", "utf8");
const suiteSource = await readFile("scripts/smoke-test-v22-mvp-contract-suite.mjs", "utf8");

assertNoRealTencentSdkSource(providerSource, "quote_provider_source");
assertNoRealTencentSdkSource(planViewSource, "plan_view_source");
assert(contractSource.includes("readonly/tencent quote provider"), "contract_must_define_readonly_tencent_quote_provider");
assert(contractSource.includes("不读取 secret"), "contract_must_forbid_secret_read");
assert(contractSource.includes("不调用真实腾讯云 API"), "contract_must_forbid_real_tencent_api");
assert(contractSource.includes("mock/snapshot provider -> readonly/tencent quote provider -> dry-run/tencent plan provider -> authorized/tencent create/release provider"), "contract_must_keep_adapter_route");
assert(managedContractSource.includes("quoteSource"), "managed_environment_contract_must_include_quote_source");
assert(readmeSource.includes("v22-tencent-readonly-quote-provider-boundary.md"), "contracts_readme_must_index_quote_provider");
assert(suiteSource.includes("smoke-test-v22-tencent-readonly-quote-provider-boundary"), "mvp_suite_must_include_quote_provider_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_quote_provider_boundary",
  covered: [
    "mock_provider_field_allowlist",
    "no_secret_or_cloud_internal_fields",
    "no_real_tencent_sdk_or_api_calls",
    "managed_plan_quote_source_fields",
    "no_create_bind_release_or_real_charge",
  ],
}, null, 2));
