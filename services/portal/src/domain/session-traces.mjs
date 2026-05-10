import {
  billingItemsForRun,
  publicBalanceLink,
  publicCostEstimate,
  publicResourceUsage,
} from "./cost-balance-trace-linkage.mjs";

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
    .filter((item) => !requestOptions.sessionId || traceSearchText(item).includes(requestOptions.sessionId))
    .filter((item) => !requestOptions.status || String(item.status || "").toLowerCase().includes(requestOptions.status))
    .sort((a, b) => String(b.startedAt || b.createdAt || "").localeCompare(String(a.startedAt || a.createdAt || "")));
}

function text(value = "") {
  return String(value ?? "").trim();
}

function traceSearchText(item = {}) {
  return [
    item.sessionId,
    item.workspaceSessionId,
    item.runtimeSessionId,
    item.traceId,
    item.runId,
  ].map(text).filter(Boolean).join(" ");
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
    linkedOutputCount: Array.isArray(storage?.linkedOutputFiles) ? storage.linkedOutputFiles.length : 0,
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
    available: merged.sources.adapter.type === "live",
    mode: merged.sources.adapter.type === "live" ? "live" : "status_only",
    traceCount: merged.rows.length,
    latestTraceAt: merged.rows[0]?.startedAt || "",
    dataSource: "runtime_bridge_canonical_metadata",
    businessFactSource: "runtime_bridge_canonical_metadata",
    canonicalSource: "runtime_bridge_canonical_metadata",
    observabilityAttachmentSource: merged.sources.langfuse.source || "langfuse_sanitized_projection",
    observabilityAvailable: Boolean(merged.observabilityRows.length),
    billingTruth: false,
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
  return [
    ...canonicalTimelineForTrace(item),
    ...events.map((event) => ({
    type: event.type,
    occurredAt: event.occurredAt,
    workspaceId: event.workspaceId || item.workspaceId,
    runId: event.runId || item.runId,
    })),
  ];
}

function canonicalTimelineForTrace(item = {}) {
  const occurredAt = text(item.updatedAt || item.startedAt);
  const workspaceId = text(item.workspaceId);
  const runId = text(item.runId);
  const events = [];
  if (item.traceId || item.sessionId) {
    events.push({
      type: "portal_session_trace_projected",
      occurredAt,
      workspaceId,
      runId,
    });
  }
  if (runId) {
    events.push({
      type: "runtime_run_projected",
      occurredAt,
      workspaceId,
      runId,
    });
  }
  for (const artifactRef of Array.isArray(item.artifactRefs) ? item.artifactRefs : []) {
    events.push({
      type: "runtime_artifact_recorded",
      occurredAt,
      workspaceId,
      runId,
      artifactRef: text(artifactRef),
    });
  }
  return events;
}

function eventMatchesTrace(event = {}, item = {}, user = {}) {
  return event.userId === (item.userId || user.id) &&
    (!item.workspaceId || event.workspaceId === item.workspaceId) &&
    (!item.runId || event.runId === item.runId);
}

function findTraceDetailItem(items = [], sessionId = "") {
  const target = String(sessionId || "");
  return items.find((row) => String(row.traceId || "") === target) ||
    items.find((row) => String(row.runId || "") === target) ||
    items.find((row) =>
      String(row.sessionId || row.workspaceSessionId || "") === target
    ) ||
    items[0] ||
    null;
}

function numberValue(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function strictAdminTraceUrl(value = "") {
  const normalized = text(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    return url.origin === "https://trace.medopl.cn" ? normalized : "";
  } catch {
    return "";
  }
}

function usageSummaryProjection(row = {}) {
  const usageSummary = row.usageSummary && typeof row.usageSummary === "object" ? row.usageSummary : {};
  return {
    inputTokens: numberValue(usageSummary.inputTokens),
    outputTokens: numberValue(usageSummary.outputTokens),
    totalTokens: numberValue(usageSummary.totalTokens || row.tokenCount),
  };
}

function costEstimateProjection(row = {}) {
  const costEstimate = row.costEstimate && typeof row.costEstimate === "object" ? row.costEstimate : {};
  return {
    currency: text(costEstimate.currency),
    amount: numberValue(costEstimate.amount),
  };
}

function observabilityProjection(row = {}, source = "") {
  const traceId = text(row.traceId);
  const sessionId = text(row.sessionId || row.runtimeSessionId || row.workspaceSessionId);
  const runId = text(row.runId);
  if (!traceId && !sessionId && !runId) return null;
  return {
    source: source || text(row.source) || "langfuse_sanitized_projection",
    label: "观测摘要",
    traceId,
    sessionId,
    runId,
    status: text(row.status || "recorded"),
    latencyMs: numberValue(row.latencyMs),
    usageSummary: usageSummaryProjection(row),
    costEstimate: costEstimateProjection(row),
    traceUrl: strictAdminTraceUrl(row.traceUrl || row.url),
    tags: Array.isArray(row.tags) ? row.tags.map(text).filter(Boolean) : [],
  };
}

function traceMatchKeys(row = {}) {
  return [
    text(row.runId),
    text(row.sessionId),
    text(row.runtimeSessionId),
    text(row.workspaceSessionId),
    text(row.traceId),
  ].filter(Boolean);
}

function observabilityByTraceKey(rows = []) {
  const map = new Map();
  for (const row of rows) {
    for (const key of traceMatchKeys(row)) {
      if (!map.has(key)) map.set(key, row);
    }
  }
  return map;
}

function matchingObservability(row = {}, projectionMap = new Map()) {
  for (const key of traceMatchKeys(row)) {
    const projection = projectionMap.get(key);
    if (projection) return projection;
  }
  return null;
}

function publicOutputFileView(file = {}) {
  const fileRef = text(file.artifactRef || file.fileRef || file.id);
  return {
    artifactRef: fileRef,
    fileRef,
    name: text(file.name),
    workspaceId: text(file.workspaceId || file.workspace_id),
    runId: text(file.runId || file.run_id),
    sessionId: text(file.sessionId || file.session_id || file.oplSessionId || file.opl_session_id),
    kind: text(file.kind || "outputs"),
    sizeBytes: numberValue(file.sizeBytes || file.size_bytes || file.size),
    contentType: text(file.contentType || file.content_type),
    status: text(file.status || "active"),
    source: text(file.source || "runtime_bridge_artifact_reference"),
  };
}

function outputFilesFromStorage(storage = {}) {
  const candidates = [
    ...(Array.isArray(storage?.outputFiles) ? storage.outputFiles : []),
    ...(Array.isArray(storage?.outputs) ? storage.outputs : []),
    ...(Array.isArray(storage?.artifacts) ? storage.artifacts : []),
  ];
  return candidates.map(publicOutputFileView).filter((item) => item.fileRef || item.name);
}

function outputFileMatchesTrace(file = {}, row = {}) {
  const artifactRefs = new Set((Array.isArray(row.artifactRefs) ? row.artifactRefs : []).map(text).filter(Boolean));
  return (artifactRefs.size > 0 && artifactRefs.has(text(file.artifactRef || file.fileRef)))
    || (text(row.runId) && text(file.runId) === text(row.runId))
    || (text(row.sessionId) && text(file.sessionId) === text(row.sessionId))
    || (text(row.runtimeSessionId) && text(file.sessionId) === text(row.runtimeSessionId));
}

function linkedOutputFilesForTrace(row = {}, storage = {}) {
  const linked = [
    ...artifactOutputFilesFromTrace(row),
    ...outputFilesFromStorage(storage).filter((file) => outputFileMatchesTrace(file, row)),
  ];
  const seen = new Set();
  return linked.filter((file) => {
    const key = file.artifactRef || file.fileRef || `${file.runId}:${file.name}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function artifactOutputFilesFromTrace(row = {}) {
  return (Array.isArray(row.artifactRefs) ? row.artifactRefs : [])
    .map(text)
    .filter(Boolean)
    .map((artifactRef) => ({
      artifactRef,
      fileRef: artifactRef,
      name: artifactRef,
      workspaceId: text(row.workspaceId),
      runId: text(row.runId),
      sessionId: text(row.sessionId || row.runtimeSessionId || row.workspaceSessionId),
      kind: "outputs",
      sizeBytes: 0,
      contentType: "",
      status: text(row.status || "active"),
      source: "runtime_bridge_artifact_reference",
    }));
}

function canonicalRuntimeTraceRow(row = {}, projectionMap = new Map()) {
  const observability = matchingObservability(row, projectionMap);
  return {
    traceId: text(row.traceId),
    traceName: text(row.traceName),
    title: traceTitle(row),
    userId: text(row.userId || row.portalUserId),
    workspaceId: text(row.workspaceId),
    workspaceSessionId: text(row.workspaceSessionId),
    runtimeSessionId: text(row.runtimeSessionId),
    runId: text(row.runId),
    model: text(row.model),
    sessionId: text(row.sessionId || row.runtimeSessionId || row.workspaceSessionId),
    tokenCount: numberValue(row.tokenCount),
    userAgent: text(row.userAgent),
    latencyMs: numberValue(row.latencyMs),
    startedAt: text(row.startedAt || row.createdAt),
    updatedAt: text(row.updatedAt),
    status: text(row.status || "recorded"),
    source: "runtime_bridge_canonical_metadata",
    artifactRefs: Array.isArray(row.artifactRefs) ? row.artifactRefs.map(text).filter(Boolean) : [],
    observability,
    customerDefaultTraceSurface: "Portal 会话轨迹",
    customerDefaultLangfuseUi: false,
  };
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
  const observabilityRows = (langfuseRows.rows || [])
    .map((row) => observabilityProjection(row, langfuseRows.source || "langfuse_sanitized_projection"))
    .filter(Boolean);
  const projectionMap = observabilityByTraceKey(observabilityRows);
  const canonicalRows = (adapterRows.rows || []).map((row) => canonicalRuntimeTraceRow(row, projectionMap));
  return {
    rows: filterMergedTraceRows(canonicalRows, requestOptions),
    filters: requestOptions,
    observabilityRows,
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
  const linkedOutputFiles = linkedOutputFilesForTrace(row, storage);
  const billing = runId
    ? await deps.fetchBillingSummary(row.userId || user.id, workspaceId, "168h").catch(() => null)
    : null;
  const relatedCosts = (billing?.items || []).filter((item) => costMatchesRun(item, { runId, workspaceId }));
  const linkedCosts = billingItemsForRun(billing?.items || [], { runId, workspaceId });
  const publicCosts = linkedCosts.length ? linkedCosts : relatedCosts;
  const costEstimate = publicCostEstimate(billing || {}, publicCosts);
  return {
    ...row,
    title: traceTitle(row),
    businessStatus: row.status || "recorded",
    resourceUsage: publicResourceUsage({
      row,
      outputFiles: linkedOutputFiles,
      relatedCosts: publicCosts,
    }),
    costEstimate,
    balanceLink: publicBalanceLink(costEstimate),
    files: {
      ...fileSummary(workspaceId, { ...(storage || {}), linkedOutputFiles }),
      linkedOutputFiles,
    },
    outputFiles: linkedOutputFiles,
    linkedOutputFiles,
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
    customerTraceSurface: "Portal 会话轨迹",
    customerDefaultLangfuseUi: false,
    note: "用户侧只返回当前账号可见的会话、文件、运行、费用和资源状态索引；不暴露 Langfuse key 或原始内部参数。",
  };
}

export async function buildSessionTraceDetailPayload(deps, db, user, sessionId) {
  const payload = await buildSessionTracesApiPayload(deps, db, user, { sessionId, limit: 200, pageSize: 200 });
  const item = findTraceDetailItem(payload.items, sessionId);
  if (!item) return null;
  const events = await deps.readPortalEvents({ limit: 200, userId: user.id, workspaceId: item.workspaceId, runId: item.runId });
  return {
    ...item,
    timeline: timelineForEvents(events, item),
  };
}
