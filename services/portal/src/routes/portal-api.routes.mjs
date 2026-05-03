export function createPortalApiRoutes({
  activeUserStatus,
  adminScopeResult,
  announcementRows,
  buildCommercialProfile,
  buildSessionTraceDetailPayload,
  buildSessionTracesApiPayload,
  collectRunsForUser,
  currentServerPlanSelection,
  currentTaskSpaceForUser,
  evaluateUserPolicy,
  fetchBillingSummary,
  fetchHarborImageRows,
  fetchHarborSummary,
  fetchLangfuseSummary,
  fetchOplAdapterCosts,
  fetchOplAdapterRuns,
  fetchOplAdapterTraceRows,
  fetchTraceRows,
  formatDateTime,
  isRunTerminal,
  normalizePageSize,
  paginateRows,
  parsePositiveInt,
  readSessionsRequestOptions,
  readTracesRequestOptions,
  sendJson,
  buildUserBillingSummary,
  visibleAnnouncementRows,
  workspaceChatSessionsForUser,
}) {
  async function handleAnnouncements({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/announcements") return false;
    const showAll = user.role === "admin" && String(url.searchParams.get("mode") || "").toLowerCase() === "all";
    sendJson(res, {
      items: showAll ? announcementRows(db) : visibleAnnouncementRows(db, user),
      source: "portal_settings",
      type: "live",
    });
    return true;
  }

  async function handleMe({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/me") return false;
    const policy = await evaluateUserPolicy(db, user);
    const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
    const commercial = buildCommercialProfile(db, user, { wallet, policy });
    const initials = String(user.name || user.email || "?")
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "U";
    sendJson(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: activeUserStatus(user.status),
      accountStatus: commercial.accountStatus,
      billingStatus: commercial.billingStatus,
      entitlementStatus: commercial.entitlementStatus,
      commercial,
      initials,
      currentTaskSlug: user.currentTaskSlug || "default",
      selectedServerPlan: currentServerPlanSelection(currentTaskSpaceForUser(db, user)),
    });
    return true;
  }

  async function handleSessions({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/sessions") return false;
    const requestOptions = readSessionsRequestOptions(url);
    const requestedUserId = String(url.searchParams.get("userId") || "").trim();
    const targetUser = requestedUserId && user.role === "admin"
      ? (db.users.find((item) => item.id === requestedUserId) || user)
      : user;
    const adapterRuns = await fetchOplAdapterRuns();
    const runsByWorkspaceSession = new Map();
    for (const run of adapterRuns.filter((item) => item.portalUserId === targetUser.id)) {
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
          runId: latestRun.runId || "",
          runStatus: latestRun.status || "",
          latencyMs: Number(latestRun.latencyMs || 0),
          tokenCount: Number(latestRun.tokenCount || 0),
          userAgent: latestRun.userAgent || "",
          source: "portal_workspace_sessions + portal_opl_adapter",
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
        opl: { source: "portal_workspace_sessions + portal_opl_adapter", type: "live" },
      },
    });
    return true;
  }

  async function handleRuns({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/runs") return false;
    const requestedUserId = String(url.searchParams.get("userId") || "").trim();
    const workspaceId = String(url.searchParams.get("workspaceId") || "").trim();
    const runId = String(url.searchParams.get("runId") || "").trim();
    const targetUsers = requestedUserId && user.role === "admin"
      ? db.users.filter((item) => item.id === requestedUserId)
      : [user];
    const runs = [];
    for (const targetUser of targetUsers) {
      const rows = await collectRunsForUser(targetUser.id);
      runs.push(...rows.map((item) => ({
        runId: item.runId || "",
        workspaceId: item.workspaceId || "",
        workspaceSessionId: item.workspaceSessionId || "",
        userId: targetUser.id,
        userName: targetUser.name || targetUser.email || "",
        status: isRunTerminal(item) ? "completed" : (item.status || "running"),
        startedAt: formatDateTime(item.createdAt || ""),
        endedAt: isRunTerminal(item) ? formatDateTime(item.completedAt || item.createdAt || "") : "",
        source: item.source || "runtime_events",
        type: "live",
      })));
    }
    const adapterRuns = (await fetchOplAdapterRuns())
      .filter((item) => {
        if (requestedUserId && user.role === "admin") return item.portalUserId === requestedUserId;
        return item.portalUserId === user.id;
      })
      .map((item) => ({
        runId: item.runId || "",
        workspaceId: item.workspaceId || "",
        workspaceSessionId: item.workspaceSessionId || "",
        runtimeSessionId: item.runtimeSessionId || "",
        userId: item.portalUserId || "",
        userName: "",
        status: item.status || "",
        startedAt: formatDateTime(item.createdAt || ""),
        endedAt: item.finishedAt ? formatDateTime(item.finishedAt) : "",
        source: "portal_opl_adapter",
        type: "live",
        latencyMs: Number(item.latencyMs || 0),
        tokenCount: Number(item.tokenCount || 0),
        userAgent: item.userAgent || "",
        jobName: item.jobName || "",
        namespace: item.namespace || "",
      }));
    runs.push(...adapterRuns);
    const filtered = runs
      .filter((item) => !workspaceId || item.workspaceId === workspaceId)
      .filter((item) => !runId || item.runId === runId)
      .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
    sendJson(res, {
      runs: filtered,
      source: "runtime_events + portal_opl_adapter",
      type: "live",
      note: "数据来自 runtime 事件、Portal 运行记录与 Portal OPL adapter",
    });
    return true;
  }

  async function handleCosts({ req, res, url, user }) {
    if (req.method !== "GET") return false;
    if (url.pathname === "/portal/api/costs/summary") {
      const summary = await fetchBillingSummary(user.id, "", String(url.searchParams.get("window") || "168h"));
      sendJson(res, {
        source: "billing_aggregator",
        type: summary ? "live" : "status_only",
        note: summary ? "数据来自账单聚合接口" : "账单聚合接口不可用",
        totals: summary?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
        items: summary?.items || [],
      });
      return true;
    }
    if (url.pathname === "/portal/api/costs/workspace") {
      const workspaceId = String(url.searchParams.get("workspaceId") || url.searchParams.get("task") || "").trim();
      const summary = await fetchBillingSummary(user.id, workspaceId, String(url.searchParams.get("window") || "168h"));
      sendJson(res, {
        source: "billing_aggregator",
        type: summary ? "live" : "status_only",
        note: summary ? "数据来自 workspace 维度账单聚合接口" : "workspace 账单聚合接口不可用",
        workspaceId,
        totals: summary?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
        items: summary?.items || [],
      });
      return true;
    }
    if (url.pathname === "/portal/api/costs/run") {
      const runId = String(url.searchParams.get("runId") || "").trim();
      const summary = await fetchBillingSummary(user.id, "", String(url.searchParams.get("window") || "168h"));
      const adapterCost = (await fetchOplAdapterCosts({ userId: user.id, runId }))[0] || null;
      if (adapterCost) {
        sendJson(res, {
          source: "portal_opl_adapter",
          type: "live",
          note: adapterCost.status === "pending" ? "run 成本已记录为 pending，等待 OpenCost/云账单对账" : "run 成本来自 Portal OPL adapter",
          runId,
          cost: {
            cpuCost: adapterCost.cpuCost,
            gpuCost: adapterCost.gpuCost,
            storageCost: adapterCost.storageCost,
            totalCost: adapterCost.totalCost,
            pricingSource: adapterCost.pricingSource,
            status: adapterCost.status,
          },
        });
        return true;
      }
      const runCost = (summary?.items || []).find((item) => {
        const props = item?.properties || {};
        return props["label:run_id"] === runId || props.run_id === runId || item?.name === runId;
      }) || null;
      if (!runCost) {
        sendJson(res, {
          source: "billing_aggregator",
          type: "status_only",
          note: "未找到对应 run 成本记录",
          runId,
          cost: null,
        });
        return true;
      }
      sendJson(res, {
        source: "billing_aggregator",
        type: "live",
        note: "数据来自 run 维度账单聚合结果",
        runId,
        cost: {
          cpuCost: Number(runCost.cpuCost || 0),
          gpuCost: Number(runCost.gpuCost || 0),
          storageCost: Number(runCost.pvCost || runCost.storageCost || 0),
          totalCost: Number(runCost.totalCost || 0),
          pricingSource: runCost?.properties?.pricing_source || runCost?.properties?.["label:pricing_source"] || "aggregated",
        },
      });
      return true;
    }
    return false;
  }

  async function handleBillingSummary({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/billing/me/summary") return false;
    sendJson(res, buildUserBillingSummary(db, { user }));
    return true;
  }

  async function handleRegistry({ req, res, url, user }) {
    if (req.method !== "GET") return false;
    if (url.pathname !== "/portal/api/registry/summary" && url.pathname !== "/portal/api/registry/images") return false;
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return true;
    }
    if (url.pathname === "/portal/api/registry/summary") {
      sendJson(res, await fetchHarborSummary());
      return true;
    }
    sendJson(res, await fetchHarborImageRows(Number(url.searchParams.get("limit") || 50)));
    return true;
  }

  async function handleTraces({ req, res, url, db, user }) {
    if (req.method !== "GET") return false;
    if (url.pathname === "/portal/api/traces/summary") {
      sendJson(res, await fetchLangfuseSummary());
      return true;
    }
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
    if (url.pathname === "/portal/api/traces") {
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
      const effectiveUserId = requestedUserId;
      const traces = await fetchTraceRows({
        userId: effectiveUserId,
        workspaceId,
        runId,
        limit: parsePositiveInt(requestOptions.limit, 200),
      });
      const adapterTraces = await fetchOplAdapterTraceRows({
        userId: effectiveUserId,
        workspaceId,
        runId,
        limit: parsePositiveInt(requestOptions.limit, 200),
      });
      const mergedRows = [...(adapterTraces.rows || []), ...(traces.rows || [])]
        .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
      const filteredRows = mergedRows
        .filter((item) => !sessionId || String(item.sessionId || item.workspaceSessionId || "").includes(sessionId))
        .filter((item) => !statusFilter || String(item.status || "").toLowerCase().includes(statusFilter));
      const pagination = paginateRows(filteredRows, requestOptions.page, normalizePageSize(requestOptions.pageSize || 5));
      sendJson(res, {
        filters: {
          userId: effectiveUserId,
          workspaceId,
          runId,
          sessionId,
          status: statusFilter,
        },
        summary: {
          available: traces.type === "live" || adapterTraces.type === "live",
          mode: adapterTraces.type === "live" ? "live" : traces.type,
          note: adapterTraces.type === "live" ? adapterTraces.note : (traces.note || ""),
          traceCount: filteredRows.length,
          latestTraceAt: filteredRows[0]?.startedAt || "",
          dataSource: adapterTraces.type === "live" ? `${adapterTraces.source} + ${traces.source}` : traces.source,
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
    }
    return false;
  }

  return async function handlePortalApiRoutes(context) {
    if (await handleAnnouncements(context)) return true;
    if (await handleMe(context)) return true;
    if (await handleSessions(context)) return true;
    if (await handleRuns(context)) return true;
    if (await handleBillingSummary(context)) return true;
    if (await handleCosts(context)) return true;
    if (await handleRegistry(context)) return true;
    if (await handleTraces(context)) return true;
    return false;
  };
}
