export function createOplAdapterClient({
  adapterUrl,
  oplWebUrl,
  timeoutMs,
  formatDateTime,
}) {
  const normalizedAdapterUrl = String(adapterUrl || "").replace(/\/$/, "");
  const normalizedOplWebUrl = String(oplWebUrl || "").replace(/\/$/, "");

  function buildConfiguredOplWebUrl(launchToken, bootstrapUrl = "") {
    if (!normalizedOplWebUrl) return "";
    const url = new URL(normalizedOplWebUrl);
    url.searchParams.set("launch_token", launchToken);
    url.searchParams.set("portal_adapter_url", normalizedAdapterUrl);
    if (bootstrapUrl) url.searchParams.set("bootstrap_url", bootstrapUrl);
    return url.toString();
  }

  function normalizeLaunchPayload(payload, { requireRealOplWeb = false } = {}) {
    const oplWebLaunchUrl = payload.oplWebUrl || buildConfiguredOplWebUrl(payload.launchToken || "", payload.bootstrapUrl || "");
    if (requireRealOplWeb && !oplWebLaunchUrl) {
      throw new Error("OPL_WEB_URL 未配置：Portal 只能打开真实 OPL Web，不能回退到旧 workbench 路径");
    }
    return {
      ...payload,
      oplWebUrl: oplWebLaunchUrl,
      portalAdapterUrl: normalizedAdapterUrl,
    };
  }

  async function fetchJson(pathname) {
    try {
      const response = await fetch(new URL(pathname, `${normalizedAdapterUrl}/`), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  return {
    adapterUrl: normalizedAdapterUrl,
    oplWebUrl: normalizedOplWebUrl,
    buildConfiguredOplWebUrl,
    normalizeLaunchPayload,
    fetchJson,

    async createLaunch({ user, taskSpace, workspaceSession, requireRealOplWeb = false }) {
      const response = await fetch(new URL("/api/opl-launch/tokens", `${normalizedAdapterUrl}/`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          portalUserId: user.id,
          portalUserEmail: user.email,
          portalUserName: user.name,
          tenantId: user.tenantId || user.id,
          ownerId: user.id,
          sessionOwnerId: user.id,
          traceOwnerId: user.id,
          artifactOwnerId: user.id,
          storageOwnerId: user.id,
          workspaceId: workspaceSession.workspaceId,
          workspaceTitle: taskSpace.title,
          workspacePath: taskSpace.path,
          workspaceSessionId: workspaceSession.id,
          sourceSurface: "portal-control-plane",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.launchToken) {
        throw new Error(payload?.error || `opl_launch_failed:${response.status}`);
      }
      return normalizeLaunchPayload(payload, { requireRealOplWeb });
    },

    async fetchRuns() {
      const payload = await fetchJson("/api/runs");
      return Array.isArray(payload?.items) ? payload.items : [];
    },

    async fetchTraceRows({ userId = "", workspaceId = "", runId = "", limit = 200 } = {}) {
      const payload = await fetchJson("/api/trace-links");
      const traces = Array.isArray(payload?.items) ? payload.items : [];
      const actions = Array.isArray(payload?.runActions) ? payload.runActions : [];
      const rows = traces
        .filter((item) => !userId || item.portalUserId === userId)
        .filter((item) => !workspaceId || item.workspaceId === workspaceId)
        .filter((item) => !runId || item.runId === runId)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, Number(limit || 200))
        .map((item) => ({
          traceId: item.traceId || "",
          traceName: item.traceName || "",
          userId: item.portalUserId || "",
          workspaceId: item.workspaceId || "",
          workspaceSessionId: item.workspaceSessionId || "",
          runtimeSessionId: item.runtimeSessionId || "",
          runId: item.runId || "",
          model: item.model || "",
          sessionId: item.runtimeSessionId || item.workspaceSessionId || "",
          tokenCount: Number(item.tokenCount || 0),
          userAgent: item.userAgent || "",
          latencyMs: Number(item.latencyMs || 0),
          inputPreview: "",
          startedAt: formatDateTime(item.createdAt || ""),
          status: item.status || "recorded",
          url: "",
          source: "portal_opl_adapter",
          runActions: actions.filter((action) => action.runId === item.runId),
        }));
      return {
        source: "portal_opl_adapter",
        type: rows.length ? "live" : "status_only",
        rows,
        note: rows.length ? "数据来自 Portal OPL adapter trace records" : "Portal OPL adapter 未返回匹配 trace",
      };
    },

    async fetchCosts({ userId = "", workspaceId = "", runId = "" } = {}) {
      const payload = await fetchJson("/api/cost-records");
      return (Array.isArray(payload?.items) ? payload.items : [])
        .filter((item) => !userId || item.portalUserId === userId)
        .filter((item) => !workspaceId || item.workspaceId === workspaceId)
        .filter((item) => !runId || item.runId === runId);
    },
  };
}
