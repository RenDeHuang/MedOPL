import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildSessionTracesApiPayload } from "../../../services/portal/src/domain/session-traces.mjs";
import { isSmokeClassifiedIn } from "../../../scripts/v22-test-classification.mjs";

const RAW_PROMPT = "raw prompt must not appear on Portal session trace";
const RAW_COMPLETION = "raw completion must not appear on Portal session trace";
const RAW_API_KEY = "gflabtoken_raw_key_must_not_escape";
const FORBIDDEN_FIELD_PATTERN = /rawPrompt|rawCompletion|rawApiKey|apiKey|bearerToken|launchToken|runtimeToken|objectKey|storageKey|localPath|signedUrl/i;
const FORBIDDEN_VALUE_PATTERN = new RegExp([
  RAW_PROMPT,
  RAW_COMPLETION,
  RAW_API_KEY,
  "bearer-token-secret",
  "launch-token-secret",
  "runtime-token-secret",
  "internal/object/key",
  "internal-storage-key",
  "/private/local/result",
  "signed.example.test",
].map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));

function assertNoForbiddenLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(FORBIDDEN_FIELD_PATTERN.test(serialized), false, `${label}_must_not_include_forbidden_field`);
  assert.equal(FORBIDDEN_VALUE_PATTERN.test(serialized), false, `${label}_must_not_include_forbidden_value`);
}

function assertPortalUserCopy(source, label) {
  for (const required of ["任务与结果", "任务", "输出文件", "资源用量", "费用估算", "状态"]) {
    assert(source.includes(required), `${label}_missing_user_copy:${required}`);
  }
  for (const forbidden of ["CVM", "COS", "K8s", "TKE", "云资源控制台", "raw API key", "launchToken", "runtimeToken", "objectKey", "storageKey", "localPath", "signedUrl"]) {
    assert.equal(source.includes(forbidden), false, `${label}_must_not_show_forbidden_copy:${forbidden}`);
  }
  assert.equal(source.includes("trace.medopl.cn"), false, `${label}_must_not_make_trace_medopl_cn_customer_default_link`);
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

const deps = {
  fetchRuntimeBridgeTraceRows: async () => ({
    source: "runtime_bridge",
    type: "live",
    rows: [{
      traceId: "trace-runtime-v22-session-view",
      traceName: "细胞图像分析",
      userId: "user-v22-session-view",
      workspaceId: "workspace-v22-session-view",
      workspaceSessionId: "workspace-session-v22-session-view",
      runtimeSessionId: "runtime-session-v22-session-view",
      sessionId: "runtime-session-v22-session-view",
      runId: "run-v22-session-view",
      status: "succeeded",
      startedAt: "2026-05-08T08:00:00.000Z",
      source: "runtime_bridge",
      artifactRefs: ["artifact-v22-session-view-output"],
      rawPrompt: RAW_PROMPT,
      rawCompletion: RAW_COMPLETION,
      rawApiKey: RAW_API_KEY,
      bearerToken: "bearer-token-secret",
      launchToken: "launch-token-secret",
      runtimeToken: "runtime-token-secret",
      objectKey: "internal/object/key.csv",
      storageKey: "internal-storage-key",
      localPath: "/private/local/result.csv",
      signedUrl: "https://signed.example.test/result.csv",
    }],
  }),
  fetchTraceRows: async () => ({
    source: "langfuse_sanitized_projection",
    type: "sanitized_projection",
    rows: [{
      traceId: "trace-runtime-v22-session-view",
      sessionId: "runtime-session-v22-session-view",
      runId: "run-v22-session-view",
      status: "succeeded",
      latencyMs: 1280,
      usageSummary: {
        inputTokens: 12,
        outputTokens: 34,
        totalTokens: 46,
      },
      costEstimate: {
        currency: "USD",
        amount: 0.0123,
      },
      traceUrl: "https://trace.medopl.cn/project/platform/traces/trace-runtime-v22-session-view",
      tags: ["workspace:workspace-v22-session-view", "run:run-v22-session-view"],
      rawPrompt: RAW_PROMPT,
      rawCompletion: RAW_COMPLETION,
      rawApiKey: RAW_API_KEY,
      launchToken: "launch-token-secret",
      objectKey: "internal/object/key.csv",
      signedUrl: "https://signed.example.test/result.csv",
    }],
  }),
  parsePositiveInt: (value, fallback) => Number(value || fallback),
  paginateRows,
  normalizePageSize: (value) => Number(value || 10),
  findTaskSpace: () => ({ slug: "workspace-v22-session-view", userId: "user-v22-session-view" }),
  fetchWorkspaceStorageSnapshot: async () => ({
    inputsCount: 1,
    outputsCount: 1,
    outputs: [{ name: "result.md", sizeBytes: 128 }],
  }),
  fetchBillingSummary: async () => ({
    source: "local_fixture",
    items: [{ runId: "run-v22-session-view", workspaceId: "workspace-v22-session-view", status: "pending", totalCost: 0.0123 }],
  }),
};

const payload = await buildSessionTracesApiPayload(deps, {
  users: [{ id: "user-v22-session-view", email: "session-view@example.test", name: "Session View User" }],
  taskSpaces: [{ slug: "workspace-v22-session-view", userId: "user-v22-session-view" }],
}, {
  id: "user-v22-session-view",
  email: "session-view@example.test",
  role: "user",
}, {
  workspaceId: "workspace-v22-session-view",
  limit: 20,
  pageSize: 20,
});

assert.equal(payload.dataSource, "portal_session_traces", "session_trace_payload_source_mismatch");
assert.equal(payload.summary.businessFactSource, "runtime_bridge_canonical_metadata", "session_trace_must_use_runtime_bridge_as_business_fact_source");
assert.equal(payload.summary.observabilityAttachmentSource, "langfuse_sanitized_projection", "langfuse_must_be_observability_attachment_source");
assert.equal(payload.summary.canonicalSource, "runtime_bridge_canonical_metadata", "canonical_source_mismatch");
assert.equal(payload.summary.billingTruth, false, "langfuse_must_not_be_billing_truth");
assert.equal(payload.customerTraceSurface, "Portal 会话轨迹", "customer_trace_surface_mismatch");
assert.equal(payload.customerDefaultLangfuseUi, false, "customer_default_trace_page_must_be_portal");
assert.equal(payload.items.length, 1, "langfuse_projection_must_not_create_second_business_trace_row");

const item = payload.items[0];
assert.ok(item.taskRef, "canonical_task_ref_required");
assert.notEqual(item.taskRef, "run-v22-session-view", "canonical_task_ref_must_not_expose_run_id");
assert.equal(item.source, "runtime_bridge_canonical_metadata", "item_source_must_be_runtime_bridge_canonical_metadata");
assert.equal(item.observability.source, "langfuse_sanitized_projection", "observability_source_mismatch");
assert.equal(item.observability.label, "观测摘要", "observability_label_mismatch");
assert.ok(item.observability.taskRef, "observability_task_ref_required");
assert.notEqual(item.observability.taskRef, "run-v22-session-view", "observability_task_ref_must_not_expose_run_id");
assert.equal(item.observability.latencyMs, 1280, "observability_latency_mismatch");
assert.deepEqual(item.observability.usageSummary, { inputTokens: 12, outputTokens: 34, totalTokens: 46 }, "observability_usage_summary_mismatch");
assert.deepEqual(item.observability.costEstimate, { currency: "USD", amount: 0.0123 }, "observability_cost_estimate_mismatch");
assert.equal(item.observability.traceUrl, "https://trace.medopl.cn/project/platform/traces/trace-runtime-v22-session-view", "sanitized_admin_trace_url_mismatch");
assert.equal(item.customerDefaultTraceSurface, "Portal 会话轨迹", "item_default_trace_surface_mismatch");
assert.equal(item.customerDefaultLangfuseUi, false, "item_must_not_default_to_langfuse_ui");
assert.equal(JSON.stringify(payload).includes('"runId"'), false, "session_trace_payload_must_not_expose_run_id_field");
assertNoForbiddenLeak(payload, "session_trace_payload");

const traceSurfaceSourceText = await readFile("services/portal/frontend/src/app/pages/TasksResults.tsx", "utf8");
const traceSurfaceSource = await readFile("services/portal/frontend/src/app/data/portalAdapters.ts", "utf8");
const traceTypesSource = await readFile("services/portal/frontend/src/api/portal/traces.ts", "utf8");
const suiteSource = await readFile("tests/contract/smoke-test-v22-mvp-contract-suite.mjs", "utf8");

assertPortalUserCopy(traceSurfaceSourceText, "trace_surface");
assert(traceSurfaceSourceText.includes("任务与结果"), "trace_page_must_render_tasks_results_heading");
assert(traceSurfaceSourceText.includes("Table"), "trace_page_must_render_structured_task_table");
assert(traceSurfaceSourceText.includes("task.resourceUsage"), "trace_surface_must_render_resource_usage");
assert(traceSurfaceSourceText.includes("task.cost"), "trace_surface_must_render_cost_estimate");
assert(traceSurfaceSource.includes("fetchSessionTraces"), "trace_surface_must_load_session_traces");
assert(traceSurfaceSource.includes("linkedOutputFiles"), "trace_adapter_must_consume_linked_output_files");
assert(traceSurfaceSource.includes("costEstimate"), "trace_adapter_must_consume_cost_estimate");
assert(traceTypesSource.includes("observability"), "trace_api_types_must_include_observability_attachment");
assert(traceTypesSource.includes("businessFactSource"), "trace_api_types_must_include_business_fact_source");
assert(isSmokeClassifiedIn("tests/regression/portal/smoke-test-v22-portal-session-trace-view.mjs"), "mvp_suite_must_include_portal_session_trace_view_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_session_trace_view",
  covered: [
    "runtime_bridge_canonical_metadata_as_business_fact_source",
    "langfuse_sanitized_projection_as_observability_attachment",
    "portal_customer_default_trace_surface",
    "trace_view_user_language",
    "secret_token_storage_field_guard",
  ],
}, null, 2));
