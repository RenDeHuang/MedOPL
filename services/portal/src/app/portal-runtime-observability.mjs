export function createPortalRuntimeObservability({
  billingClient,
  codexRuntimeEventsFile,
  codexRuntimeRoot,
  harborRegistryClient,
  langfuseTraceClient,
  minioStorageClient,
  oplAdapterClient,
  path,
  readFile,
  readdir,
} = {}) {
  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function readBillingRequestOptions(url) {
    return {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      pageSize: url.searchParams.get("page_size"),
      tasksPage: url.searchParams.get("tasks_page"),
      ledgerPage: url.searchParams.get("ledger_page"),
      runsPage: url.searchParams.get("runs_page"),
    };
  }

  function readOverviewRequestOptions(url) {
    return {
      tasksPage: url.searchParams.get("tasks_page"),
      runsPage: url.searchParams.get("runs_page"),
    };
  }

  function readSessionsRequestOptions(url) {
    return {
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("page_size"),
      limit: url.searchParams.get("limit"),
    };
  }

  function readTracesRequestOptions(url) {
    return {
      userId: url.searchParams.get("userId"),
      workspaceId: url.searchParams.get("workspaceId"),
      runId: url.searchParams.get("runId"),
      messageId: url.searchParams.get("messageId"),
      sessionId: url.searchParams.get("sessionId"),
      status: url.searchParams.get("status"),
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("page_size"),
      limit: url.searchParams.get("limit"),
    };
  }

  async function fetchBillingSummary(customerId, workspaceId = "", windowValue = "24h") {
    return billingClient.fetchSummary(customerId, workspaceId, windowValue);
  }

  async function fetchPendingSummary(customerId = "", workspaceId = "", windowValue = "168h") {
    return billingClient.fetchPendingSummary(customerId, workspaceId, windowValue);
  }

  async function fetchBillingStatus() {
    return billingClient.fetchStatus();
  }

  async function fetchServerPlans() {
    return billingClient.fetchServerPlans();
  }

  async function fetchMinioSummary() {
    return minioStorageClient.fetchSummary();
  }

  async function fetchHarborSummary() {
    return harborRegistryClient.fetchSummary();
  }

  async function fetchLangfuseSummary() {
    return langfuseTraceClient.fetchSummary();
  }

  async function fetchTraceRows({ userId = "", workspaceId = "", runId = "", limit = 20 } = {}) {
    return langfuseTraceClient.fetchTraceRows({ userId, workspaceId, runId, limit });
  }

  async function fetchOplAdapterRuns() {
    return oplAdapterClient.fetchRuns();
  }

  async function fetchOplAdapterTraceRows({ userId = "", workspaceId = "", runId = "", limit = 200 } = {}) {
    return oplAdapterClient.fetchTraceRows({ userId, workspaceId, runId, limit });
  }

  async function fetchOplAdapterCosts({ userId = "", workspaceId = "", runId = "" } = {}) {
    return oplAdapterClient.fetchCosts({ userId, workspaceId, runId });
  }

  function workspaceChatSessionsForUser(db, user, limit = 20) {
    return (db.workspaceSessions || [])
      .filter((item) => item.userId === user.id)
      .sort((a, b) => String(b.lastUsedAt || b.createdAt || "").localeCompare(String(a.lastUsedAt || a.createdAt || "")))
      .slice(0, limit)
      .map((item) => ({
        sessionId: item.id,
        sessionType: "mas",
        source: "portal_workspace_sessions",
        type: "live",
        userId: item.userId,
        userName: user.name || user.email || "",
        email: user.email || "",
        workspaceId: item.workspaceId || "",
        workspaceSessionId: item.id,
        lastUsedAt: item.lastUsedAt || item.createdAt || "",
        expiresAt: item.expiresAt || "",
        status: item.status || "unknown",
      }));
  }

  async function probe(url) {
    if (!url) return { ok: false, status: "未配置" };
    const startedAt = Date.now();
    try {
      const response = await fetch(url, { redirect: "manual" });
      return { ok: true, status: String(response.status), responseMs: Date.now() - startedAt };
    } catch {
      return { ok: false, status: "不可达", responseMs: Date.now() - startedAt };
    }
  }

  async function runtimePerformanceSummary() {
    const runsDir = path.join(codexRuntimeRoot, "sessions");
    let eventRows = [];
    try {
      const raw = await readFile(codexRuntimeEventsFile, "utf8");
      eventRows = raw.split(/\r?\n/).filter(Boolean).slice(-400).map((line) => safeJsonParse(line)).filter(Boolean);
    } catch {}
    let files = [];
    try {
      files = await readdir(runsDir);
    } catch {}
    const metas = [];
    for (const file of files.filter((name) => name.endsWith(".json")).slice(-200)) {
      try {
        const parsed = JSON.parse(await readFile(path.join(runsDir, file), "utf8"));
        metas.push(parsed);
      } catch {}
    }
    const byRunId = new Map(metas.map((item) => [String(item.runId || ""), item]));
    const runtimeEvents = eventRows
      .filter((item) => item.type === "codex_runtime_run")
      .slice()
      .reverse();
    const completed = runtimeEvents.map((item) => {
      const meta = byRunId.get(String(item.runId || ""));
      const startedAt = Date.parse(String(meta?.createdAt || ""));
      const endedAt = Date.parse(String(item.occurredAt || ""));
      const durationMs = Number.isFinite(startedAt) && Number.isFinite(endedAt) ? Math.max(0, endedAt - startedAt) : null;
      return {
        runId: item.runId || "",
        workspaceId: item.workspaceId || "",
        workspaceSessionId: item.workspaceSessionId || "",
        exitCode: typeof item.exitCode === "number" ? item.exitCode : Number(item.exitCode || 0),
        durationMs,
        occurredAt: item.occurredAt || "",
      };
    }).filter((item) => item.durationMs != null);
    const successful = completed.filter((item) => item.exitCode === 0);
    const latestMas = successful.slice(-10);
    const avgMas = latestMas.length ? Math.round(latestMas.reduce((sum, item) => sum + Number(item.durationMs || 0), 0) / latestMas.length) : null;
    const warmups = eventRows.filter((item) => item.type === "codex_runtime_warmup").slice(-20);
    const slowWarmups = warmups.filter((item) => !item.runnerWarmup?.ok || String(item.runnerWarmup?.detail || "").toLowerCase().includes("timeout"));
    return {
      masFirstReplyApproxMs: avgMas,
      latestSuccessfulMasRuns: latestMas.slice(-5).reverse(),
      warmupTimeoutCount: slowWarmups.length,
      totalSuccessfulMasRuns: successful.length,
    };
  }

  return {
    fetchBillingStatus,
    fetchBillingSummary,
    fetchHarborSummary,
    fetchLangfuseSummary,
    fetchMinioSummary,
    fetchOplAdapterCosts,
    fetchOplAdapterRuns,
    fetchOplAdapterTraceRows,
    fetchPendingSummary,
    fetchServerPlans,
    fetchTraceRows,
    probe,
    readBillingRequestOptions,
    readOverviewRequestOptions,
    readSessionsRequestOptions,
    readTracesRequestOptions,
    runtimePerformanceSummary,
    workspaceChatSessionsForUser,
  };
}
