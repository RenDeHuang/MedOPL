import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { createWorkspacePayloadBuilder } from "../services/portal/src/app/portal-page-workspace-payloads.mjs";
import { buildSessionTracesApiPayload } from "../services/portal/src/domain/session-traces.mjs";
import { isSmokeClassifiedIn } from "./v22-smoke-classification.mjs";

const RAW_PROMPT = "raw prompt must not appear in trace file linkage";
const RAW_COMPLETION = "raw completion must not appear in trace file linkage";
const RAW_API_KEY = "gflabtoken_raw_key_trace_file_linkage";

const forbiddenFieldPattern = /rawPrompt|rawCompletion|rawApiKey|apiKey|bearerToken|launchToken|runtimeToken|objectKey|storageKey|localPath|signedUrl/i;
const forbiddenValuePattern = new RegExp([
  RAW_PROMPT,
  RAW_COMPLETION,
  RAW_API_KEY,
  "bearer-token-secret",
  "launch-token-secret",
  "runtime-token-secret",
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
  for (const required of ["任务与结果", "任务", "输出文件", "状态", "资源用量", "费用估算"]) {
    assert(source.includes(required), `${label}_missing_user_copy:${required}`);
  }
  for (const forbidden of ["CVM", "COS", "K8s", "TKE", "云资源控制台", "raw API key", "launchToken", "runtimeToken", "objectKey", "storageKey", "localPath", "signedUrl"]) {
    assert.equal(source.includes(forbidden), false, `${label}_must_not_show_forbidden_copy:${forbidden}`);
  }
}

function assertWorkspaceUserCopy(source, label) {
  for (const required of ["工作空间", "输入文件", "输出文件", "文件空间", "下载全部结果", "来自"]) {
    assert(source.includes(required), `${label}_missing_user_copy:${required}`);
  }
  for (const forbidden of ["CVM", "COS", "K8s", "TKE", "云资源控制台", "raw API key", "launchToken", "runtimeToken", "objectKey", "storageKey", "localPath", "signedUrl"]) {
    assert.equal(source.includes(forbidden), false, `${label}_must_not_show_forbidden_copy:${forbidden}`);
  }
}

const user = {
  id: "user-v22-trace-file",
  tenantId: "tenant-v22-trace-file",
  email: "trace-file@example.test",
  role: "user",
};

const workspaceId = "workspace-v22-trace-file";
const runId = "run-v22-trace-file";
const sessionId = "session-v22-trace-file";
const artifactRef = "artifact-v22-trace-file-output";

const db = {
  users: [user],
  taskSpaces: [{
    slug: workspaceId,
    userId: user.id,
    path: `/tmp/${workspaceId}`,
    title: "Trace File Linkage",
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
    resourceBindingId: "binding-v22-trace-file",
    kind: "outputs",
    name: "result.md",
    relativePath: `${runId}/result.md`,
    sizeBytes: 128,
    contentType: "text/markdown",
    status: "active",
    source: "runtime_bridge_artifact_reference",
    rawPrompt: RAW_PROMPT,
    rawCompletion: RAW_COMPLETION,
    rawApiKey: RAW_API_KEY,
    bearerToken: "bearer-token-secret",
    launchToken: "launch-token-secret",
    runtimeToken: "runtime-token-secret",
    objectKey: "runtime/internal/object/result.md",
    storageKey: "runtime-storage-key",
    localPath: "/runtime/private/result.md",
    signedUrl: "https://signed.example.test/result.md",
    createdAt: "2026-05-08T08:01:00.000Z",
    updatedAt: "2026-05-08T08:02:00.000Z",
  }],
};

const buildWorkspacePayload = createWorkspacePayloadBuilder({
  collectRunsForUser: async () => [{ runId, workspaceId, status: "completed", createdAt: "2026-05-08T08:01:00.000Z" }],
  currentServerPlanSelection: () => null,
  defaultTaskTitle: (slug) => slug,
  ensureTaskSpace: async () => db.taskSpaces[0],
  fetchBillingSummary: async () => ({ totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 }, items: [] }),
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
assert.equal(workspacePayload.counts.outputs, 1, "file_space_must_count_runtime_bridge_artifact_output");
assert.equal(workspacePayload.outputs.length, 1, "file_space_must_list_runtime_bridge_artifact_output");
assert.equal(workspacePayload.outputs[0].artifactRef, artifactRef, "file_space_artifact_ref_mismatch");
assert.equal(workspacePayload.outputs[0].fileRef, artifactRef, "file_space_file_ref_mismatch");
assert.ok(workspacePayload.outputs[0].taskRef, "file_space_task_ref_required");
assert.notEqual(workspacePayload.outputs[0].taskRef, runId, "file_space_task_ref_must_not_expose_run_id");
assert.equal(workspacePayload.outputs[0].sessionId, sessionId, "file_space_session_link_mismatch");
assert.equal(workspacePayload.outputs[0].source, "runtime_bridge_artifact_reference", "file_space_source_mismatch");
assertNoForbiddenLeak(workspacePayload, "workspace_payload");

const tracePayload = await buildSessionTracesApiPayload({
  fetchRuntimeBridgeTraceRows: async () => ({
    source: "runtime_bridge",
    type: "live",
    rows: [{
      traceId: "trace-v22-file-linkage",
      traceName: "输出文件关联",
      userId: user.id,
      workspaceId,
      workspaceSessionId: "workspace-session-v22-trace-file",
      runtimeSessionId: sessionId,
      sessionId,
      runId,
      status: "succeeded",
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
      traceId: "trace-v22-file-linkage",
      sessionId,
      runId,
      status: "succeeded",
      latencyMs: 321,
      usageSummary: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      costEstimate: { currency: "USD", amount: 0.001 },
      traceUrl: "https://trace.medopl.cn/project/platform/traces/trace-v22-file-linkage",
      tags: ["file-linkage"],
    }],
  }),
  parsePositiveInt: (value, fallback) => Number(value || fallback),
  paginateRows,
  normalizePageSize: (value) => Number(value || 10),
  findTaskSpace: () => db.taskSpaces[0],
  fetchWorkspaceStorageSnapshot: async () => workspacePayload,
  fetchBillingSummary: async () => ({ source: "local_fixture", items: [] }),
}, db, user, {
  workspaceId,
  limit: 20,
  pageSize: 20,
});

const traceItem = tracePayload.items[0];
assert.equal(tracePayload.items.length, 1, "trace_payload_must_have_one_canonical_task");
assert.equal(traceItem.outputFiles.length, 1, "trace_task_must_expose_linked_output_file");
assert.equal(traceItem.outputFiles[0].artifactRef, artifactRef, "trace_output_artifact_ref_mismatch");
assert.equal(traceItem.outputFiles[0].fileRef, artifactRef, "trace_output_file_ref_mismatch");
assert.equal(traceItem.outputFiles[0].taskRef, workspacePayload.outputs[0].taskRef, "trace_output_task_ref_mismatch");
assert.equal(traceItem.outputFiles[0].sessionId, sessionId, "trace_output_session_link_mismatch");
assert.equal(traceItem.files.linkedOutputCount, 1, "trace_file_summary_linked_output_count_mismatch");
assert.equal(traceItem.observability.source, "langfuse_sanitized_projection", "langfuse_must_remain_observability_attachment");
assert.equal(JSON.stringify(workspacePayload).includes('"runId"'), false, "workspace_payload_must_not_expose_run_id_field");
assert.equal(JSON.stringify(tracePayload).includes('"runId"'), false, "trace_payload_must_not_expose_run_id_field");
assertNoForbiddenLeak(tracePayload, "trace_payload");

const traceSurfaceSource = await readFile("services/portal/frontend/src/app/pages/TasksResults.tsx", "utf8");
const workspaceSurfaceSourceText = await readFile("services/portal/frontend/src/app/pages/Workspace.tsx", "utf8");
const portalAdapterSource = await readFile("services/portal/frontend/src/app/data/portalAdapters.ts", "utf8");
const traceTypesSource = await readFile("services/portal/frontend/src/api/portal/traces.ts", "utf8");
const workspaceTypesSource = await readFile("services/portal/frontend/src/api/portal/workspace.ts", "utf8");
const suiteSource = await readFile("scripts/smoke-test-v22-mvp-contract-suite.mjs", "utf8");

assertTraceUserCopy(traceSurfaceSource, "trace_surface");
assertWorkspaceUserCopy(workspaceSurfaceSourceText, "workspace_surface");
assert(traceSurfaceSource.includes("loadTasksResultsModel"), "trace_page_must_use_zip_portal_adapter_loader");
assert(traceSurfaceSource.includes("task.outputFiles"), "trace_surface_must_render_linked_output_file_count");
assert(traceSurfaceSource.includes("task.outputFileNames"), "trace_surface_must_render_linked_output_file_names");
assert(traceSurfaceSource.includes("查看结果"), "trace_surface_must_offer_result_action");
assert(workspaceSurfaceSourceText.includes("loadWorkspaceModel"), "workspace_page_must_use_zip_portal_adapter_loader");
assert(workspaceSurfaceSourceText.includes("file.taskName"), "workspace_surface_must_show_task_linkage_in_user_language");
assert(workspaceSurfaceSourceText.includes("来自"), "workspace_surface_must_show_task_linkage_copy");
assert(portalAdapterSource.includes("linkedOutputFiles"), "portal_adapter_must_map_trace_linked_output_files");
assert(portalAdapterSource.includes("outputFileNames"), "portal_adapter_must_project_output_file_names");
assert(traceTypesSource.includes("linkedOutputFiles"), "trace_types_must_include_linked_output_files");
assert(workspaceTypesSource.includes("artifactRef"), "workspace_types_must_include_artifact_ref");
assert(isSmokeClassifiedIn("scripts/smoke-test-v22-portal-trace-file-linkage.mjs"), "mvp_suite_must_include_trace_file_linkage_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_trace_file_linkage",
  covered: [
    "task_trace_output_file_summary",
    "file_space_runtime_bridge_artifact_reference",
    "stable_artifact_run_session_linkage",
    "langfuse_observability_only",
    "secret_token_internal_storage_guard",
  ],
}, null, 2));
