async function collectAllRunsWithUsers(db, collectRunsForUser) {
  const rows = [];
  for (const user of db.users.filter((item) => item.role !== "admin")) {
    const runs = await collectRunsForUser(user.id);
    rows.push(...runs.map((run) => ({ ...run, userId: user.id, userName: user.name || user.email || user.id, userEmail: user.email || "" })));
  }
  rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return rows;
}

export function createPortalApiPayloads(deps) {
  const {
    buildWorkspacePayload,
    collectRunsForUser,
    defaultTaskTitle,
    ensureTaskSpace,
    fetchBillingSummary,
    fetchHarborSummary,
    fetchLangfuseSummary,
    findTaskSpace,
    isRunTerminal,
    normalizePageSize,
    paginateRows,
  } = deps;

  function buildSessionsApiPayload(db) {
    const ordinarySessions = (db.sessions || []).map((session) => {
      const user = db.users.find((entry) => entry.id === session.userId) || {};
      return {
        sessionId: session.id,
        sessionType: "ordinary",
        userId: session.userId || "",
        userName: user.name || user.email || session.userId || "",
        userEmail: user.email || "",
        workspaceId: "",
        workspaceSessionId: "",
        lastUsedAt: session.createdAt || "",
        status: "active",
        source: session.authSource || "portal_session",
      };
    });
    const workspaceSessions = (db.workspaceSessions || []).map((session) => {
      const user = db.users.find((entry) => entry.id === session.userId) || {};
      return {
        sessionId: session.id,
        sessionType: "mas",
        userId: session.userId || "",
        userName: user.name || user.email || session.userId || "",
        userEmail: user.email || "",
        workspaceId: session.workspaceId || "",
        workspaceSessionId: session.id,
        lastUsedAt: session.lastUsedAt || session.createdAt || "",
        status: session.status || "active",
        source: session.source || "workspace_session",
      };
    });
    const items = [...workspaceSessions, ...ordinarySessions].sort((a, b) => String(b.lastUsedAt || "").localeCompare(String(a.lastUsedAt || "")));
    return {
      items,
      summary: {
        ordinary: ordinarySessions.filter((item) => item.status === "active").length,
        mas: workspaceSessions.filter((item) => item.status === "active").length,
        total: items.length,
      },
      dataSource: {
        ordinary: "portal sessions",
        mas: "workspace sessions",
      },
    };
  }

  async function buildRunsApiPayload(db, options = {}) {
    const runs = await collectAllRunsWithUsers(db, collectRunsForUser);
    const filtered = runs.filter((item) => {
      if (options.runId && item.runId !== options.runId) return false;
      if (options.userId && item.userId !== options.userId) return false;
      if (options.workspaceId && item.workspaceId !== options.workspaceId) return false;
      return true;
    });
    const pagination = paginateRows(filtered, options.page, normalizePageSize(options.pageSize || 10));
    return {
      items: pagination.rows.map((run) => ({
        runId: run.runId || "",
        userId: run.userId || "",
        userName: run.userName || "",
        userEmail: run.userEmail || "",
        workspaceId: run.workspaceId || "",
        workspaceSessionId: run.workspaceSessionId || "",
        status: isRunTerminal(run) ? "completed" : (run.status || "running"),
        createdAt: run.createdAt || "",
        source: run.source || "",
      })),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
      dataSource: "runtime events + run artifacts",
    };
  }

  async function buildWorkspaceStorageApiPayload(db, user, taskSlug) {
    const task = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    const payload = await buildWorkspacePayload(db, user, task.slug);
    return {
      workspaceId: payload.workspace.slug,
      inputsCount: payload.counts.inputs,
      outputsCount: payload.counts.outputs,
      inputBytes: payload.distribution.inputBytes,
      outputBytes: payload.distribution.outputBytes,
      minioSynced: true,
      lastSyncAt: new Date().toISOString(),
      dataSource: "workspace filesystem + minio sync pipeline",
    };
  }

  async function buildCostsSummaryApiPayload() {
    const billing = await fetchBillingSummary("", "", "168h");
    const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
    return {
      cpuCost: Number(totals.cpuCost || 0),
      gpuCost: Number(totals.gpuCost || 0),
      storageCost: Number(totals.pvCost || 0),
      totalCost: Number(totals.totalCost || 0),
      pricingSource: billing ? "opencost_aggregated" : "unavailable",
      dataSource: "billing-aggregator / OpenCost",
    };
  }

  async function buildWorkspaceCostsApiPayload(workspaceId = "") {
    const billing = await fetchBillingSummary("", workspaceId, "168h");
    const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
    return {
      workspaceId,
      cpuCost: Number(totals.cpuCost || 0),
      gpuCost: Number(totals.gpuCost || 0),
      storageCost: Number(totals.pvCost || 0),
      totalCost: Number(totals.totalCost || 0),
      pricingSource: billing ? "opencost_aggregated" : "unavailable",
      dataSource: "billing-aggregator / OpenCost",
    };
  }

  async function buildRunCostsApiPayload(runId = "") {
    const billing = await fetchBillingSummary("", "", "168h");
    const match = (billing?.items || []).find((item) => {
      const props = item?.properties || {};
      return props["label:run_id"] === runId || props.run_id === runId || String(item?.name || "").includes(runId);
    });
    return {
      runId,
      workspaceId: String(match?.properties?.["label:workspace_id"] || match?.properties?.workspace_id || ""),
      customerId: String(match?.properties?.["label:customer_id"] || match?.properties?.customer_id || ""),
      cpuCost: Number(match?.cpuCost || 0),
      gpuCost: Number(match?.gpuCost || 0),
      storageCost: Number(match?.pvCost || 0),
      totalCost: Number(match?.totalCost || 0),
      pricingSource: String(match?.properties?.pricing_source || match?.properties?.["label:pricing_source"] || "unavailable"),
      dataSource: match ? "billing-aggregator / OpenCost" : "unavailable",
    };
  }

  async function buildRegistrySummaryApiPayload(db) {
    const harbor = await fetchHarborSummary();
    return {
      ...harbor,
      imageTagCount: new Set((db.userSandboxes || []).map((item) => item.imageTag).filter(Boolean)).size,
      dataSource: harbor.available ? "Harbor API" : "Harbor probe",
    };
  }

  function buildRegistryImagesApiPayload(db) {
    const items = (db.userSandboxes || [])
      .map((item) => ({
        userId: item.userId,
        containerName: item.containerName || "",
        namespace: item.namespace || "",
        imageTag: item.imageTag || "",
        status: item.status || "",
        lastWorkspaceId: item.lastWorkspaceId || "",
        updatedAt: item.updatedAt || item.lastActiveAt || "",
      }))
      .filter((item) => item.imageTag)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return {
      items,
      dataSource: "user sandboxes + Harbor naming",
    };
  }

  async function buildTraceSummaryApiPayload() {
    const summary = await fetchLangfuseSummary();
    return {
      ...summary,
      dataSource: summary.available ? "Langfuse ClickHouse" : "trace summary unavailable",
    };
  }

  async function buildTracesApiPayload(options = {}) {
    const summary = await fetchLangfuseSummary();
    return {
      filters: {
        userId: options.userId || "",
        workspaceId: options.workspaceId || "",
        runId: options.runId || "",
      },
      summary,
      items: [],
      dataSource: summary.available ? "Langfuse summary only; detailed trace drill-down pending" : "unavailable",
    };
  }

  return {
    buildCostsSummaryApiPayload,
    buildRegistryImagesApiPayload,
    buildRegistrySummaryApiPayload,
    buildRunCostsApiPayload,
    buildRunsApiPayload,
    buildSessionsApiPayload,
    buildTraceSummaryApiPayload,
    buildTracesApiPayload,
    buildWorkspaceCostsApiPayload,
    buildWorkspaceStorageApiPayload,
  };
}
