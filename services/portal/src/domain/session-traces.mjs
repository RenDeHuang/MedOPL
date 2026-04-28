function traceRequestOptions(user, options = {}, parsePositiveInt) {
  return {
    userId: user?.role === "admin" ? String(options.userId || "").trim() : user.id,
    workspaceId: String(options.workspaceId || "").trim(),
    runId: String(options.runId || "").trim(),
    sessionId: String(options.sessionId || "").trim(),
    status: String(options.status || "").trim().toLowerCase(),
    limit: parsePositiveInt(options.limit, 200),
  };
}

function filterMergedTraceRows(rows = [], requestOptions = {}) {
  return rows
    .filter((item) => !requestOptions.sessionId || String(item.sessionId || item.workspaceSessionId || "").includes(requestOptions.sessionId))
    .filter((item) => !requestOptions.status || String(item.status || "").toLowerCase().includes(requestOptions.status))
    .sort((a, b) => String(b.startedAt || b.createdAt || "").localeCompare(String(a.startedAt || a.createdAt || "")));
}

function traceTitle(row = {}) {
  return row.traceName || row.sessionId || row.workspaceSessionId || row.runId || "会话";
}

function costMatchesRun(item = {}, { runId = "", workspaceId = "" } = {}) {
  return (!runId || item.runId === runId) && (!workspaceId || item.workspaceId === workspaceId);
}

function costStatusIncludes(item = {}, statusText = "") {
  return String(item.status || item.pricingSource || "").toLowerCase().includes(statusText);
}

function sumCost(items = []) {
  return items.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
}

function exactCostItems(items = []) {
  return items.filter((item) =>
    costStatusIncludes(item, "exact") || String(item.pricingSource || "").includes("tencent")
  );
}

function fileSummary(workspaceId, storage) {
  return {
    inputsCount: storage?.inputsCount || 0,
    outputsCount: storage?.outputsCount || 0,
    latestOutputs: (storage?.outputs || []).slice(0, 5).map((item) => ({
      name: item.name,
      size: item.size || item.sizeBytes || 0,
      downloadUrl: `/portal/workspace/download-file?task=${encodeURIComponent(workspaceId)}&kind=outputs&file=${encodeURIComponent(item.name)}`,
    })),
  };
}

function billingSummary(billing, relatedCosts = []) {
  const pendingCost = sumCost(relatedCosts.filter((item) => costStatusIncludes(item, "pending")));
  const exactCost = sumCost(exactCostItems(relatedCosts));
  return {
    pendingCost: Number(pendingCost.toFixed(5)),
    exactCost: Number(exactCost.toFixed(5)),
    source: billing?.source || "billing_aggregator",
  };
}

function traceListSummary(merged) {
  return {
    available: merged.sources.adapter.type === "live" || merged.sources.langfuse.type === "live",
    mode: merged.sources.adapter.type === "live" ? "live" : merged.sources.langfuse.type,
    traceCount: merged.rows.length,
    latestTraceAt: merged.rows[0]?.startedAt || "",
    dataSource: `${merged.sources.adapter.source || "portal_opl_adapter"} + ${merged.sources.langfuse.source || "langfuse_api"}`,
  };
}

function paginationPayload(pagination) {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    totalPages: pagination.totalPages,
  };
}

function timelineForEvents(events = [], item = {}) {
  return events.map((event) => ({
    type: event.type,
    occurredAt: event.occurredAt,
    workspaceId: event.workspaceId || item.workspaceId,
    runId: event.runId || item.runId,
  }));
}

function eventMatchesTrace(event = {}, item = {}, user = {}) {
  return event.userId === (item.userId || user.id) &&
    (!item.workspaceId || event.workspaceId === item.workspaceId) &&
    (!item.runId || event.runId === item.runId);
}

function findTraceDetailItem(items = [], sessionId = "") {
  return items.find((row) =>
    String(row.sessionId || row.workspaceSessionId || row.traceId || "") === String(sessionId || "")
  ) || items[0] || null;
}

async function fetchMergedTraceRowsForPortalUser(deps, user, options = {}) {
  const requestOptions = traceRequestOptions(user, options, deps.parsePositiveInt);
  const [langfuseRows, adapterRows] = await Promise.all([
    deps.fetchTraceRows({
      userId: requestOptions.userId,
      workspaceId: requestOptions.workspaceId,
      runId: requestOptions.runId,
      limit: requestOptions.limit,
    }),
    deps.fetchOplAdapterTraceRows({
      userId: requestOptions.userId,
      workspaceId: requestOptions.workspaceId,
      runId: requestOptions.runId,
      limit: requestOptions.limit,
    }),
  ]);
  return {
    rows: filterMergedTraceRows([...(adapterRows.rows || []), ...(langfuseRows.rows || [])], requestOptions),
    filters: requestOptions,
    sources: {
      adapter: adapterRows,
      langfuse: langfuseRows,
    },
  };
}

async function enrichSessionTraceRow(deps, db, user, row = {}) {
  const workspaceId = String(row.workspaceId || "").trim();
  const runId = String(row.runId || "").trim();
  const taskSpace = workspaceId ? deps.findTaskSpace(db, row.userId || user.id, workspaceId) : null;
  const storage = taskSpace ? await deps.fetchWorkspaceStorageSnapshot(taskSpace) : null;
  const billing = runId
    ? await deps.fetchBillingSummary(row.userId || user.id, workspaceId, "168h").catch(() => null)
    : null;
  const relatedCosts = (billing?.items || []).filter((item) => costMatchesRun(item, { runId, workspaceId }));
  return {
    ...row,
    title: traceTitle(row),
    businessStatus: row.status || "recorded",
    files: fileSummary(workspaceId, storage),
    billing: billingSummary(billing, relatedCosts),
  };
}

export async function buildSessionTracesApiPayload(deps, db, user, options = {}) {
  const merged = await fetchMergedTraceRowsForPortalUser(deps, user, options);
  const pagination = deps.paginateRows(merged.rows, options.page, deps.normalizePageSize(options.pageSize || 10));
  const items = await Promise.all(pagination.rows.map((row) => enrichSessionTraceRow(deps, db, user, row)));
  return {
    filters: merged.filters,
    summary: traceListSummary(merged),
    items,
    pagination: paginationPayload(pagination),
    dataSource: "portal_session_traces",
    note: "用户侧只返回当前账号可见的会话、文件、运行、费用和资源状态索引；不暴露 Langfuse key 或原始内部参数。",
  };
}

export async function buildSessionTraceDetailPayload(deps, db, user, sessionId) {
  const payload = await buildSessionTracesApiPayload(deps, db, user, { sessionId, limit: 200, pageSize: 200 });
  const item = findTraceDetailItem(payload.items, sessionId);
  if (!item) return null;
  const events = (await deps.readPortalEvents(500)).filter((event) => eventMatchesTrace(event, item, user));
  return {
    ...item,
    timeline: timelineForEvents(events, item),
  };
}
