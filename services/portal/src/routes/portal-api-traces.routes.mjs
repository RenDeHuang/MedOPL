export function createPortalApiTracesRoutes({
  adminScopeResult,
  buildSessionTraceDetailPayload,
  buildSessionTracesApiPayload,
  fetchRuntimeBridgeTraceRows,
  fetchTraceRows,
  normalizePageSize,
  paginateRows,
  parsePositiveInt,
  readTracesRequestOptions,
  sendJson,
}) {
  return async function handlePortalApiTracesRoutes({ req, res, url, db, user }) {
    if (req.method !== "GET") return false;
    if (url.pathname === "/portal/api/session-traces") {
      const requestOptions = readTracesRequestOptions(url);
      sendJson(res, await buildSessionTracesApiPayload(db, user, requestOptions));
      return true;
    }
    const sessionTraceDetailMatch = url.pathname.match(/^\/portal\/api\/session-traces\/([^/]+)$/);
    if (sessionTraceDetailMatch) {
      const detail = await buildSessionTraceDetailPayload(db, user, decodeURIComponent(sessionTraceDetailMatch[1]));
      if (!detail) {
        sendJson(res, { ok: false, error: "session_trace_not_found" }, 404);
        return true;
      }
      sendJson(res, detail);
      return true;
    }
    if (url.pathname === "/portal/api/admin/agent-traces") {
      const adminScope = adminScopeResult(user);
      if (!adminScope.ok) {
        sendJson(res, { error: adminScope.error }, adminScope.status);
        return true;
      }
      const requestOptions = readTracesRequestOptions(url);
      sendJson(res, await buildSessionTracesApiPayload(db, user, requestOptions));
      return true;
    }
    if (url.pathname !== "/portal/api/traces") return false;
    const adminScope = adminScopeResult(user);
    if (!adminScope.ok) {
      sendJson(res, { error: adminScope.error, use: "/portal/api/session-traces" }, adminScope.status);
      return true;
    }
    const requestOptions = readTracesRequestOptions(url);
    const requestedUserId = String(requestOptions.userId || "").trim();
    const workspaceId = String(requestOptions.workspaceId || "").trim();
    const runId = String(requestOptions.runId || "").trim();
    const sessionId = String(requestOptions.sessionId || "").trim();
    const statusFilter = String(requestOptions.status || "").trim().toLowerCase();
    const traces = await fetchTraceRows({
      userId: requestedUserId,
      workspaceId,
      runId,
      limit: parsePositiveInt(requestOptions.limit, 200),
    });
    const runtimeBridgeTraces = await fetchRuntimeBridgeTraceRows({
      userId: requestedUserId,
      workspaceId,
      runId,
      limit: parsePositiveInt(requestOptions.limit, 200),
    });
    const mergedRows = [...(runtimeBridgeTraces.rows || []), ...(traces.rows || [])]
      .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
    const filteredRows = mergedRows
      .filter((item) => !sessionId || String(item.sessionId || item.workspaceSessionId || "").includes(sessionId))
      .filter((item) => !statusFilter || String(item.status || "").toLowerCase().includes(statusFilter));
    const pagination = paginateRows(filteredRows, requestOptions.page, normalizePageSize(requestOptions.pageSize || 5));
    sendJson(res, {
      filters: {
        userId: requestedUserId,
        workspaceId,
        runId,
        sessionId,
        status: statusFilter,
      },
      summary: {
        available: traces.type === "live" || runtimeBridgeTraces.type === "live",
        mode: runtimeBridgeTraces.type === "live" ? "live" : traces.type,
        note: runtimeBridgeTraces.type === "live" ? runtimeBridgeTraces.note : (traces.note || ""),
        traceCount: filteredRows.length,
        latestTraceAt: filteredRows[0]?.startedAt || "",
        dataSource: runtimeBridgeTraces.type === "live" ? `${runtimeBridgeTraces.source} + ${traces.source}` : traces.source,
      },
      items: pagination.rows,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
      dataSource: traces.source,
      note: traces.note || "",
    });
    return true;
  };
}
