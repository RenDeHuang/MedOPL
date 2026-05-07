import assert from "node:assert/strict";

const { createPortalApiPayloads } = await import("../services/portal/src/domain/portal-api-payloads.mjs");

const db = {
  users: [
    { id: "user-1", email: "alice@example.test", name: "Alice", role: "user" },
    { id: "admin-1", email: "admin@example.test", name: "Admin", role: "admin" },
  ],
  sessions: [{ id: "portal-session-1", userId: "user-1", authSource: "local", createdAt: "2026-05-01T00:00:00.000Z" }],
  workspaceSessions: [{ id: "workspace-session-1", userId: "user-1", workspaceId: "analysis", status: "active", lastUsedAt: "2026-05-01T00:05:00.000Z" }],
  taskSpaces: [{ slug: "analysis", userId: "user-1" }],
  userSandboxes: [
    { userId: "user-1", containerName: "c1", namespace: "ns", imageTag: "portal/test:1", status: "running", lastWorkspaceId: "analysis", updatedAt: "2026-05-01T00:10:00.000Z" },
    { userId: "user-1", containerName: "c2", namespace: "ns", imageTag: "", status: "stopped", updatedAt: "2026-05-01T00:09:00.000Z" },
  ],
};

const runFixture = {
  runId: "run-1",
  userId: "user-1",
  workspaceId: "analysis",
  workspaceSessionId: "workspace-session-1",
  status: "completed",
  createdAt: "2026-05-01T00:10:00.000Z",
  source: "fixture",
};

const payloads = createPortalApiPayloads({
  collectRunsForUser: async (userId) => userId === "user-1" ? [runFixture] : [],
  defaultTaskTitle: (slug) => `Task ${slug}`,
  ensureTaskSpace: async (_db, user, slug) => ({ slug, userId: user.id, path: `/tmp/${slug}` }),
  fetchBillingSummary: async (_userId, workspaceId) => ({
    totals: { cpuCost: 1, gpuCost: 2, pvCost: 3, totalCost: 6 },
    items: [{
      name: "fixture-run-1",
      cpuCost: 1,
      gpuCost: 2,
      pvCost: 3,
      totalCost: 6,
      properties: {
        "label:run_id": "run-1",
        "label:workspace_id": workspaceId || "analysis",
        "label:customer_id": "user-1",
        pricing_source: "fixture",
      },
    }],
  }),
  fetchHarborSummary: async () => ({ available: true, mode: "live" }),
  fetchLangfuseSummary: async () => ({ available: true, source: "fixture" }),
  findTaskSpace: (targetDb, userId, slug) => targetDb.taskSpaces.find((item) => item.userId === userId && item.slug === slug) || null,
  isRunTerminal: (run) => String(run?.status || "") === "completed",
  normalizePageSize: (value) => Number(value || 10),
  paginateRows: (rows, pageValue = 1, pageSizeValue = 10) => ({
    rows: rows.slice(0, Number(pageSizeValue || 10)),
    page: Number(pageValue || 1),
    pageSize: Number(pageSizeValue || 10),
    total: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / Number(pageSizeValue || 10))),
  }),
  buildWorkspacePayload: async () => ({
    workspace: { slug: "analysis" },
    counts: { inputs: 2, outputs: 1 },
    distribution: { inputBytes: 20, outputBytes: 10 },
  }),
});

const sessions = payloads.buildSessionsApiPayload(db);
assert.equal(sessions.summary.ordinary, 1, "sessions_must_count_portal_sessions");
assert.equal(sessions.summary.mas, 1, "sessions_must_count_workspace_sessions");
assert.equal(sessions.items[0].sessionId, "workspace-session-1", "sessions_must_sort_by_last_used");

const runs = await payloads.buildRunsApiPayload(db, { userId: "user-1" });
assert.equal(runs.items[0].runId, "run-1", "runs_payload_must_include_user_runs");
assert.equal(runs.items[0].status, "completed", "runs_payload_must_normalize_terminal_status");
assert.equal(runs.pagination.total, 1, "runs_payload_must_paginate_filtered_rows");

const storage = await payloads.buildWorkspaceStorageApiPayload(db, db.users[0], "analysis");
assert.equal(storage.workspaceId, "analysis", "workspace_storage_payload_must_identify_workspace");
assert.equal(storage.inputBytes, 20, "workspace_storage_payload_must_forward_distribution");

const costSummary = await payloads.buildCostsSummaryApiPayload();
assert.equal(costSummary.totalCost, 6, "cost_summary_must_include_total_cost");

const workspaceCost = await payloads.buildWorkspaceCostsApiPayload("analysis");
assert.equal(workspaceCost.workspaceId, "analysis", "workspace_cost_must_echo_filter");

const runCost = await payloads.buildRunCostsApiPayload("run-1");
assert.equal(runCost.customerId, "user-1", "run_cost_must_include_customer_id");
assert.equal(runCost.pricingSource, "fixture", "run_cost_must_include_pricing_source");

const registrySummary = await payloads.buildRegistrySummaryApiPayload(db);
assert.equal(registrySummary.imageTagCount, 1, "registry_summary_must_count_non_empty_image_tags");

const registryImages = payloads.buildRegistryImagesApiPayload(db);
assert.equal(registryImages.items.length, 1, "registry_images_must_exclude_empty_image_tags");
assert.equal(registryImages.items[0].imageTag, "portal/test:1", "registry_images_must_preserve_image_tag");

const traceSummary = await payloads.buildTraceSummaryApiPayload();
assert.equal(traceSummary.dataSource, "Portal 会话轨迹 sanitized projection", "trace_summary_must_mark_sanitized_projection_source");

const traces = await payloads.buildTracesApiPayload({ userId: "user-1", workspaceId: "analysis", runId: "run-1" });
assert.equal(traces.filters.runId, "run-1", "traces_payload_must_echo_filters");

console.log(JSON.stringify({
  ok: true,
  checked: [
    "sessions",
    "runs",
    "workspace_storage",
    "costs",
    "registry",
    "traces",
  ],
}, null, 2));
