export function createPortalAdminPortraitPayloads({
  collectRunsForTask,
  collectRunsForUser,
  fetchBillingSummary,
  fetchTraceRows,
  fetchWorkspaceMinioState,
  fetchWorkspaceStorageSnapshot,
  formatDateTime,
  humanizeStatus,
  isRunTerminal,
  latestActiveWorkspaceSession,
  listTaskSpacesForUser,
  money,
  readWorkspaceSession,
  sanitizeTaskTitle,
  workspaceChatSessionsForUser,
} = {}) {
  async function buildAdminUserPortraitApiPayload(db, userId = "") {
    const user = db.users.find((item) => item.id === userId && item.role !== "admin");
    if (!user) return null;

    const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
    const group = db.groups.find((item) => item.id === user.groupId) || null;
    const runs = (await collectRunsForUser(user.id))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const recentRuns = runs.slice(0, 8).map((run) => ({
      runId: run.runId || "",
      workspaceId: run.workspaceId || "",
      workspaceTitle: sanitizeTaskTitle(run.workspaceId || "", run.workspaceTitle || run.workspaceId || ""),
      status: isRunTerminal(run) ? "已完成" : humanizeStatus(run.status || "running"),
      createdAtLabel: formatDateTime(run.createdAt || ""),
    }));

    const billing = await fetchBillingSummary(user.id, "", "168h");
    const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
    const sessions = (db.sessions || [])
      .filter((session) => session.userId === user.id)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 8)
      .map((session) => ({
        sessionId: session.id,
        sessionType: "portal",
        source: session.authSource || "portal_session",
        type: "live",
        userId: user.id,
        userName: user.name || user.email || "",
        email: user.email || "",
        workspaceId: "",
        workspaceSessionId: "",
        lastUsedAt: session.createdAt || "",
        expiresAt: "",
        status: "active",
      }));
    const workspaceSessions = workspaceChatSessionsForUser(db, user, 8);
    const workspaces = listTaskSpacesForUser(db, user.id).slice(0, 8).map((item) => ({
      slug: item.slug,
      title: item.title,
      status: humanizeStatus(item.status),
      link: `/admin/workspace?userId=${encodeURIComponent(user.id)}&workspaceId=${encodeURIComponent(item.slug)}`,
    }));
    const userTraceRows = await fetchTraceRows({ userId: user.id, limit: 20 });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        balanceLabel: money(Number(wallet.balance || 0)),
        groupName: group?.name || "",
        createdAtLabel: formatDateTime(user.createdAt || ""),
      },
      recentRuns,
      costs: {
        cpuCost: Number(totals.cpuCost || 0),
        gpuCost: Number(totals.gpuCost || 0),
        storageCost: Number(totals.pvCost || 0),
        totalCost: Number(totals.totalCost || 0),
      },
      sessions: [...sessions, ...workspaceSessions].sort((a, b) => String(b.lastUsedAt || "").localeCompare(String(a.lastUsedAt || ""))).slice(0, 10),
      workspaces,
      trace: {
        source: userTraceRows.source,
        type: userTraceRows.type,
        count: Array.isArray(userTraceRows.rows) ? userTraceRows.rows.length : 0,
        latest: Array.isArray(userTraceRows.rows) && userTraceRows.rows.length ? userTraceRows.rows[0].startedAt || "" : "",
        rows: userTraceRows.rows || [],
      },
    };
  }

  async function buildAdminWorkspacePortraitApiPayload(db, userId = "", workspaceId = "") {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return null;
    const taskSpace = db.taskSpaces.find((item) => item.userId === userId && item.slug === workspaceId);
    if (!taskSpace) return null;

    const recentRuns = (await collectRunsForTask(userId, workspaceId))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 8)
      .map((run) => ({
        runId: run.runId || "",
        status: isRunTerminal(run) ? "已完成" : humanizeStatus(run.status || "running"),
        createdAtLabel: formatDateTime(run.createdAt || ""),
      }));

    const activeSession = latestActiveWorkspaceSession(db, userId, workspaceId);
    const billing = await fetchBillingSummary(userId, workspaceId, "168h");
    const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
    const storage = await fetchWorkspaceStorageSnapshot(taskSpace);
    const minio = await fetchWorkspaceMinioState(userId, workspaceId);
    const traces = await fetchTraceRows({ workspaceId, limit: 20 });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      workspace: {
        slug: taskSpace.slug,
        title: taskSpace.title,
        status: taskSpace.status,
        statusLabel: humanizeStatus(taskSpace.status),
      },
      activeSession: activeSession ? {
        id: activeSession.id,
        createdAt: activeSession.createdAt || "",
        lastUsedAt: activeSession.lastUsedAt || "",
        expiresAt: activeSession.expiresAt || "",
      } : null,
      recentRuns,
      costs: {
        cpuCost: Number(totals.cpuCost || 0),
        gpuCost: Number(totals.gpuCost || 0),
        storageCost: Number(totals.pvCost || 0),
        totalCost: Number(totals.totalCost || 0),
      },
      storage: {
        source: storage.source,
        type: storage.type,
        inputsCount: storage.inputsCount,
        outputsCount: storage.outputsCount,
        inputBytes: storage.inputBytes,
        outputBytes: storage.outputBytes,
        outputs: (storage.outputs || []).slice(0, 10),
        files: (storage.files || []).slice(0, 10),
      },
      minio,
      trace: {
        source: traces.source,
        type: traces.type,
        count: Array.isArray(traces.rows) ? traces.rows.length : 0,
        rows: traces.rows || [],
      },
    };
  }

  async function buildAdminRunPortraitApiPayload(db, runId = "") {
    if (!runId) return null;
    const runs = [];
    for (const user of db.users) {
      runs.push(...(await collectRunsForUser(user.id)).map((run) => ({ ...run, user })));
    }
    const run = runs.find((item) => item.runId === runId);
    if (!run) return null;

    const billing = await fetchBillingSummary(run.user.id, run.workspaceId || "", "168h");
    const billedRun = (billing?.items || []).find((item) => {
      const props = item?.properties || {};
      return props["label:run_id"] === runId || props.run_id === runId || String(item?.name || "").includes(runId);
    });
    const traces = await fetchTraceRows({ runId, limit: 20 });
    const taskSpace = db.taskSpaces.find((item) => item.userId === run.user.id && item.slug === run.workspaceId);
    const storage = taskSpace ? await fetchWorkspaceStorageSnapshot(taskSpace) : null;
    const relatedOutputs = (storage?.outputs || []).filter((item) => item.name.includes(runId)).slice(0, 10);
    const workspaceSession = run.workspaceSessionId ? readWorkspaceSession(db, run.workspaceSessionId, run.user.id) : null;

    return {
      run: {
        runId,
        userId: run.user.id,
        userName: run.user.name || run.user.email || run.user.id,
        userEmail: run.user.email || "",
        workspaceId: run.workspaceId || "",
        workspaceTitle: sanitizeTaskTitle(run.workspaceId || "", run.workspaceTitle || run.workspaceId || ""),
        workspaceSessionId: run.workspaceSessionId || "",
        status: isRunTerminal(run) ? "已完成" : humanizeStatus(run.status || "running"),
        source: run.source || "",
      },
      billing: {
        cpuCost: Number(billedRun?.cpuCost || 0),
        gpuCost: Number(billedRun?.gpuCost || 0),
        storageCost: Number(billedRun?.pvCost || 0),
        totalCost: Number(billedRun?.totalCost || 0),
        pricingSource: String(billedRun?.properties?.pricing_source || billedRun?.properties?.["label:pricing_source"] || billedRun?.pricingSource || "未标注"),
        start: formatDateTime(billedRun?.start || run.createdAt || ""),
        end: formatDateTime(billedRun?.end || ""),
      },
      workspaceSession: workspaceSession ? {
        id: workspaceSession.id,
        status: workspaceSession.status,
        lastUsedAt: formatDateTime(workspaceSession.lastUsedAt || ""),
        expiresAt: formatDateTime(workspaceSession.expiresAt || ""),
      } : null,
      outputs: relatedOutputs,
      trace: {
        source: traces.source,
        type: traces.type,
        count: Array.isArray(traces.rows) ? traces.rows.length : 0,
        rows: traces.rows || [],
        available: Array.isArray(traces.rows) && traces.rows.length > 0,
      },
    };
  }

  return {
    buildAdminRunPortraitApiPayload,
    buildAdminUserPortraitApiPayload,
    buildAdminWorkspacePortraitApiPayload,
  };
}
