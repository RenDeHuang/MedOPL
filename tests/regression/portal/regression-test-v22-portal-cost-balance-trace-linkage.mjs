import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { createWorkspacePayloadBuilder } from "../../../services/portal/src/app/portal-page-workspace-payloads.mjs";
import { buildSessionTracesApiPayload } from "../../../services/portal/src/domain/session-traces.mjs";
import { isSmokeClassifiedIn } from "../../../scripts/v22-test-classification.mjs";

const RAW_PROMPT = "raw prompt must not appear in cost balance trace linkage";
const RAW_COMPLETION = "raw completion must not appear in cost balance trace linkage";
const RAW_API_KEY = "gflabtoken_raw_key_cost_balance_trace";

const forbiddenFieldPattern = /providerRawCost|rawCostInternal|rawPrompt|rawCompletion|rawApiKey|apiKey|bearerToken|launchToken|runtimeToken|objectKey|storageKey|localPath|signedUrl|SecretId|SecretKey/i;
const forbiddenValuePattern = new RegExp([
  RAW_PROMPT,
  RAW_COMPLETION,
  RAW_API_KEY,
  "bearer-token-secret",
  "launch-token-secret",
  "runtime-token-secret",
  "secret-id-value",
  "secret-key-value",
  "runtime/internal/object",
  "runtime-storage-key",
  "/runtime/private/result",
  "signed.example.test",
].map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));

function assertNoForbiddenLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(forbiddenFieldPattern.test(serialized), false, `${label}_must_not_include_internal_field`);
  assert.equal(forbiddenValuePattern.test(serialized), false, `${label}_must_not_include_internal_value`);
}

function paginateRows(rows = [], page = 1, pageSize = 10) {
  const normalizedPage = Math.max(1, Number(page || 1));
  const normalizedPageSize = Math.max(1, Number(pageSize || 10));
  const start = (normalizedPage - 1) * normalizedPageSize;
  return {
    rows: rows.slice(start, start + normalizedPageSize),
    page: normalizedPage,
    pageSize: normalizedPageSize,
    total: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / normalizedPageSize)),
  };
}

function assertTraceUserCopy(source, label) {
  for (const required of ["资源用量", "费用估算", "任务", "输出文件", "状态"]) {
    assert(source.includes(required), `${label}_missing_user_copy:${required}`);
  }
  for (const forbidden of ["CVM", "COS", "K8s", "TKE", "云资源控制台", "raw API key", "launchToken", "runtimeToken", "objectKey", "storageKey", "localPath", "signedUrl"]) {
    assert.equal(source.includes(forbidden), false, `${label}_must_not_show_forbidden_copy:${forbidden}`);
  }
}

function assertBillingUserCopy(source, label) {
  for (const required of ["余额", "冻结金额", "今日消费", "账单与审计", "费用估算"]) {
    assert(source.includes(required), `${label}_missing_user_copy:${required}`);
  }
  for (const forbidden of ["CVM", "COS", "K8s", "TKE", "云资源控制台", "raw API key", "launchToken", "runtimeToken", "objectKey", "storageKey", "localPath", "signedUrl"]) {
    assert.equal(source.includes(forbidden), false, `${label}_must_not_show_forbidden_copy:${forbidden}`);
  }
}

const user = {
  id: "user-v22-cost-balance",
  tenantId: "tenant-v22-cost-balance",
  email: "cost-balance@example.test",
  role: "user",
};

const workspaceId = "workspace-v22-cost-balance";
const runId = "run-v22-cost-balance";
const sessionId = "session-v22-cost-balance";
const artifactRef = "artifact-v22-cost-balance-output";
const billingItem = {
  runId,
  workspaceId,
  status: "pending_reconciliation",
  pricingSource: "contract_snapshot",
  cpuCost: 0.03,
  gpuCost: 0,
  pvCost: 0.00456,
  totalCost: 0.03456,
  properties: {
    run_id: runId,
    workspace_id: workspaceId,
    pricing_source: "contract_snapshot",
  },
};

const db = {
  users: [user],
  taskSpaces: [{
    slug: workspaceId,
    userId: user.id,
    path: `/tmp/${workspaceId}`,
    title: "Cost Balance Linkage",
    status: "active",
    createdAt: "2026-05-08T08:00:00.000Z",
  }],
  workspaceSessions: [],
  workspaceFiles: [{
    id: artifactRef,
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId,
    runId,
    oplSessionId: sessionId,
    resourceBindingId: "binding-v22-cost-balance",
    kind: "outputs",
    name: "analysis-result.md",
    relativePath: `${runId}/analysis-result.md`,
    sizeBytes: 256,
    contentType: "text/markdown",
    status: "active",
    source: "runtime_bridge_artifact_reference",
    providerRawCost: "must-not-leak",
    rawPrompt: RAW_PROMPT,
    rawCompletion: RAW_COMPLETION,
    rawApiKey: RAW_API_KEY,
    bearerToken: "bearer-token-secret",
    launchToken: "launch-token-secret",
    runtimeToken: "runtime-token-secret",
    objectKey: "runtime/internal/object/analysis-result.md",
    storageKey: "runtime-storage-key",
    localPath: "/runtime/private/result.md",
    signedUrl: "https://signed.example.test/result.md",
    SecretId: "secret-id-value",
    SecretKey: "secret-key-value",
    createdAt: "2026-05-08T08:01:00.000Z",
    updatedAt: "2026-05-08T08:02:00.000Z",
  }],
};

const billingSummary = {
  source: "contract_snapshot_fixture",
  currency: "CNY",
  totals: { cpuCost: 0.03, gpuCost: 0, pvCost: 0.00456, totalCost: 0.03456 },
  items: [billingItem],
};

const buildWorkspacePayload = createWorkspacePayloadBuilder({
  collectRunsForUser: async () => [{ runId, workspaceId, status: "completed", createdAt: "2026-05-08T08:01:00.000Z", tokenCount: 88, latencyMs: 640 }],
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
    storageSizeGb: 10,
    storageBackend: "file_space",
    message: "active",
  }),
});

const workspacePayload = await buildWorkspacePayload(db, user, workspaceId);
const workspaceOutput = workspacePayload.outputs[0];
const workspaceRun = workspacePayload.recentRuns[0];

assert.equal(workspaceOutput.resourceUsage.source, "runtime_bridge_canonical_metadata", "workspace_output_resource_usage_source_mismatch");
assert.equal(workspaceOutput.resourceUsage.outputFileCount, 1, "workspace_output_resource_usage_output_count_mismatch");
assert.equal(workspaceOutput.costEstimate.source, "contract_snapshot_fixture", "workspace_output_cost_estimate_source_mismatch");
assert.equal(workspaceOutput.costEstimate.amount, 0.03456, "workspace_output_cost_estimate_amount_mismatch");
assert.equal(workspaceOutput.costEstimate.billingTruth, false, "workspace_output_cost_estimate_must_not_be_billing_truth");
assert.equal(workspaceOutput.balanceLink.chargeApplied, false, "workspace_output_must_not_apply_real_charge");
assert.equal(workspaceOutput.balanceLink.rechargeStatus, "display_only", "workspace_output_recharge_status_mismatch");
assert.equal(workspaceRun.resourceUsage.source, "runtime_bridge_canonical_metadata", "workspace_run_resource_usage_source_mismatch");
assert.equal(workspaceRun.costEstimate.amount, 0.03456, "workspace_run_cost_estimate_amount_mismatch");
assertNoForbiddenLeak(workspacePayload, "workspace_payload");

const tracePayload = await buildSessionTracesApiPayload({
  fetchRuntimeBridgeTraceRows: async () => ({
    source: "runtime_bridge",
    type: "live",
    rows: [{
      traceId: "trace-v22-cost-balance",
      traceName: "费用估算关联",
      userId: user.id,
      workspaceId,
      workspaceSessionId: "workspace-session-v22-cost-balance",
      runtimeSessionId: sessionId,
      sessionId,
      runId,
      status: "succeeded",
      tokenCount: 88,
      latencyMs: 640,
      startedAt: "2026-05-08T08:01:00.000Z",
      source: "runtime_bridge",
      artifactRefs: [artifactRef],
      rawPrompt: RAW_PROMPT,
      rawCompletion: RAW_COMPLETION,
      rawApiKey: RAW_API_KEY,
      launchToken: "launch-token-secret",
      objectKey: "runtime/internal/object/result.md",
    }],
  }),
  fetchTraceRows: async () => ({
    source: "langfuse_sanitized_projection",
    type: "sanitized_projection",
    rows: [{
      traceId: "trace-v22-cost-balance",
      sessionId,
      runId,
      status: "succeeded",
      latencyMs: 640,
      usageSummary: { inputTokens: 11, outputTokens: 22, totalTokens: 33 },
      costEstimate: { currency: "USD", amount: 999 },
      traceUrl: "https://trace.medopl.cn/project/platform/traces/trace-v22-cost-balance",
      tags: ["cost-balance-linkage"],
    }],
  }),
  parsePositiveInt: (value, fallback) => Number(value || fallback),
  paginateRows,
  normalizePageSize: (value) => Number(value || 10),
  findTaskSpace: () => db.taskSpaces[0],
  fetchWorkspaceStorageSnapshot: async () => workspacePayload,
  fetchBillingSummary: async () => billingSummary,
}, db, user, {
  workspaceId,
  limit: 20,
  pageSize: 20,
});

const traceItem = tracePayload.items[0];
assert.equal(tracePayload.summary.businessFactSource, "runtime_bridge_canonical_metadata", "trace_business_fact_source_mismatch");
assert.equal(tracePayload.summary.billingTruth, false, "langfuse_must_not_be_billing_truth");
assert.equal(traceItem.resourceUsage.source, "runtime_bridge_canonical_metadata", "trace_resource_usage_source_mismatch");
assert.equal(traceItem.resourceUsage.tokenCount, 88, "trace_resource_usage_token_count_mismatch");
assert.equal(traceItem.costEstimate.source, "contract_snapshot_fixture", "trace_cost_estimate_source_mismatch");
assert.equal(traceItem.costEstimate.amount, 0.03456, "trace_cost_estimate_must_use_contract_snapshot_not_langfuse");
assert.equal(traceItem.costEstimate.billingTruth, false, "trace_cost_estimate_must_not_be_final_bill");
assert.equal(traceItem.balanceLink.linkedToBalance, true, "trace_balance_link_mismatch");
assert.equal(traceItem.balanceLink.chargeApplied, false, "trace_balance_link_must_not_apply_real_charge");
assert.equal(traceItem.observability.costEstimate.amount, 999, "langfuse_projection_must_remain_observability_attachment_only");
assertNoForbiddenLeak(tracePayload, "trace_payload");

const traceSurfaceSourceText = await readFile("services/portal/frontend/src/app/pages/TasksResults.tsx", "utf8");
const workspaceSurfaceSourceText = await readFile("services/portal/frontend/src/app/pages/Workspace.tsx", "utf8");
const billingSurfaceSourceText = await readFile("services/portal/frontend/src/app/pages/BillingAudit.tsx", "utf8");
const traceSurfaceSource = await readFile("services/portal/frontend/src/app/data/portalAdapters.ts", "utf8");
const workspaceSurfaceSource = traceSurfaceSource;
const traceTypesSource = await readFile("services/portal/frontend/src/api/portal/traces.ts", "utf8");
const workspaceTypesSource = await readFile("services/portal/frontend/src/api/portal/workspace.ts", "utf8");
const suiteSource = await readFile("tests/contract/contract-test-v22-mvp-contract-suite.mjs", "utf8");

assertTraceUserCopy(traceSurfaceSourceText, "trace_surface");
assertBillingUserCopy(billingSurfaceSourceText, "billing_surface");
assert(workspaceSurfaceSourceText.includes("文件空间"), "workspace_surface_must_render_file_space_context");
assert(workspaceSurfaceSourceText.includes("输出文件"), "workspace_surface_must_render_output_file_context");
assert(traceSurfaceSourceText.includes("task.resourceUsage"), "trace_surface_must_render_resource_usage");
assert(traceSurfaceSourceText.includes("task.cost"), "trace_surface_must_render_cost_estimate");
assert(traceSurfaceSource.includes("item.costEstimate"), "trace_adapter_must_format_cost_estimate");
assert(traceSurfaceSource.includes("item.billing?.exactCost"), "trace_adapter_must_consume_billing_cost");
assert(workspaceSurfaceSource.includes("workspace.outputs.map"), "workspace_adapter_must_project_output_files");
assert(workspaceSurfaceSource.includes("bytesToSize(file.sizeBytes)"), "workspace_adapter_must_format_output_file_size");
assert(traceTypesSource.includes("resourceUsage"), "trace_types_must_include_resource_usage");
assert(traceTypesSource.includes("costEstimate"), "trace_types_must_include_cost_estimate");
assert(traceTypesSource.includes("balanceLink"), "trace_types_must_include_balance_link");
assert(workspaceTypesSource.includes("resourceUsage"), "workspace_types_must_include_resource_usage");
assert(workspaceTypesSource.includes("costEstimate"), "workspace_types_must_include_cost_estimate");
assert(workspaceTypesSource.includes("balanceLink"), "workspace_types_must_include_balance_link");
assert(isSmokeClassifiedIn("tests/regression/portal/regression-test-v22-portal-cost-balance-trace-linkage.mjs"), "mvp_suite_must_include_cost_balance_trace_linkage_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_cost_balance_trace_linkage",
  covered: [
    "workspace_task_resource_usage_cost_estimate",
    "trace_resource_usage_cost_estimate",
    "balance_recharge_estimate_only_no_real_charge",
    "runtime_bridge_canonical_metadata_as_fact_source",
    "langfuse_observability_not_billing_truth",
    "secret_token_cloud_internal_storage_guard",
  ],
}, null, 2));
