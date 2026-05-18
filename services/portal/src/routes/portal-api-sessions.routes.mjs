export function createPortalApiSessionsRoutes({
  fetchRuntimeBridgeRuns,
  normalizePageSize,
  paginateRows,
  readSessionsRequestOptions,
  sendJson,
  workspaceChatSessionsForUser,
}) {
  function publicTaskRef(row = {}) {
    return String(row.taskRef || row.traceId || row.sessionId || row.runtimeSessionId || row.workspaceSessionId || "").trim();
  }

  return async function handlePortalApiSessionsRoutes({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/sessions") return false;
    const requestOptions = readSessionsRequestOptions(url);
    const requestedUserId = String(url.searchParams.get("userId") || "").trim();
    const targetUser = requestedUserId && user.role === "admin"
      ? (db.users.find((item) => item.id === requestedUserId) || user)
      : user;
    const runtimeBridgeRuns = await fetchRuntimeBridgeRuns();
    const runsByWorkspaceSession = new Map();
    for (const run of runtimeBridgeRuns.filter((item) => item.portalUserId === targetUser.id)) {
      const key = run.workspaceSessionId || "";
      if (!key) continue;
      const current = runsByWorkspaceSession.get(key);
      if (!current || String(run.createdAt || "").localeCompare(String(current.createdAt || "")) > 0) {
        runsByWorkspaceSession.set(key, run);
      }
    }
    const oplSessions = workspaceChatSessionsForUser(db, targetUser, Number(url.searchParams.get("limit") || 20))
      .map((session) => {
        const latestRun = runsByWorkspaceSession.get(session.workspaceSessionId);
        return latestRun ? {
          ...session,
          runtimeSessionId: latestRun.runtimeSessionId || "",
          taskRef: publicTaskRef(latestRun),
          runStatus: latestRun.status || "",
          latencyMs: Number(latestRun.latencyMs || 0),
          tokenCount: Number(latestRun.tokenCount || 0),
          userAgent: latestRun.userAgent || "",
          source: "portal_workspace_sessions + runtime_bridge",
        } : session;
      });
    const rows = [...oplSessions]
      .sort((a, b) => String(b.lastUsedAt || b.expiresAt || "").localeCompare(String(a.lastUsedAt || a.expiresAt || "")));
    const pagination = paginateRows(rows, requestOptions.page, normalizePageSize(requestOptions.pageSize || 5));
    sendJson(res, {
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
      sessions: pagination.rows,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
      sources: {
        opl: { source: "portal_workspace_sessions + runtime_bridge", type: "live" },
      },
    });
    return true;
  };
}
