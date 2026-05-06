import { buildCanonicalPortalStatePayload } from "../domain/portal-api-payloads.mjs";

function parseJsonBodyOrEmpty(raw = Buffer.from("")) {
  const source = String(raw || "").trim();
  if (!source) return {};
  return JSON.parse(source);
}

function runtimeNotEnabledPayload(state = {}) {
  return {
    ok: false,
    error: "runtime_not_enabled",
    code: "runtime_not_enabled",
    runtimeEnabled: false,
    providerBound: Boolean(state.providerBound),
    providerKeyRef: state.providerKeyRef || "",
    resourceBinding: state.resourceBinding || null,
    freeze: state.freeze || null,
    plan: state.plan || null,
  };
}

export function createPortalApiRunsRoutes({
  buildUserBillingSummary,
  collectRunsForUser,
  currentServerPlanSelection,
  currentTaskSpaceForUser,
  fetchOplAdapterRuns,
  formatDateTime,
  isRunTerminal,
  readBody = async () => Buffer.from(""),
  sendJson,
}) {
  async function handleRunCreate({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/runs") return false;
    const body = parseJsonBodyOrEmpty(await readBody(req));
    const state = buildCanonicalPortalStatePayload(db, user, {
      buildUserBillingSummary,
      currentServerPlanSelection,
      currentTaskSpaceForUser,
      workspaceId: body.workspaceId || body.workspace_id || "",
    });
    if (!state.runtimeEnabled) {
      sendJson(res, runtimeNotEnabledPayload(state), 409);
      return true;
    }
    sendJson(res, {
      ok: false,
      error: "runtime_run_submission_not_implemented",
      code: "runtime_run_submission_not_implemented",
      runtimeEnabled: true,
    }, 501);
    return true;
  }

  async function handleRunList({ req, res, url, db, user }) {
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

  return async function handlePortalApiRunsRoutes(context) {
    if (await handleRunCreate(context)) return true;
    if (await handleRunList(context)) return true;
    return false;
  };
}
