function compactObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""),
  );
}

function authHeader(publicKey, secretKey) {
  if (!publicKey || !secretKey) return "";
  return `Basic ${Buffer.from(`${publicKey}:${secretKey}`, "utf8").toString("base64")}`;
}

function normalizeTimestamp(value, formatDateTime) {
  if (!value) return "";
  return formatDateTime(String(value).replace(" ", "T"));
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? "";
}

function metadataFromTrace(item = {}) {
  const metadata = item.metadata || item.meta || {};
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function traceIdentityFields(item, metadata) {
  return {
    userId: String(firstValue(item.userId, item.user_id, metadata.portalUserId, metadata.userId)),
    tenantId: String(firstValue(metadata.tenantId, metadata.tenant_id, item.tenantId, item.tenant_id)),
    workspaceId: String(firstValue(metadata.workspaceId, metadata.workspace_id, item.workspaceId, item.workspace_id)),
    workspaceSessionId: String(firstValue(metadata.workspaceSessionId, metadata.workspace_session_id)),
    runtimeSessionId: String(firstValue(metadata.runtimeSessionId, metadata.runtime_session_id)),
    sessionId: String(firstValue(item.sessionId, item.session_id, metadata.sessionId, metadata.session_id)),
  };
}

function traceRuntimeFields(item, metadata) {
  return {
    runId: String(firstValue(metadata.runId, metadata.run_id, item.runId, item.run_id)),
    resourceOrderId: String(firstValue(metadata.resourceOrderId, metadata.resource_order_id)),
    serverPlanId: String(firstValue(metadata.serverPlanId, metadata.server_plan_id)),
    model: String(firstValue(metadata.model, item.model)),
    status: String(firstValue(metadata.status, item.status, "recorded")),
  };
}

function traceUsageFields(metadata) {
  return {
    tokenCount: Number(firstValue(metadata.totalTokens, metadata.tokenCount, metadata.usage?.totalTokens, 0)),
    userAgent: String(firstValue(metadata.userAgent, metadata.user_agent)),
    latencyMs: Number(firstValue(metadata.latencyMs, metadata.latency_ms, metadata.durationMs, metadata.duration_ms, 0)),
    inputPreview: String(firstValue(metadata.inputText, metadata.input, metadata.prompt, metadata.question)),
    outputPreview: String(firstValue(metadata.outputText, metadata.output, metadata.answer)),
  };
}

function traceTimingFields(item, formatDateTime) {
  return {
    startedAt: normalizeTimestamp(item.timestamp || item.createdAt || item.created_at, formatDateTime),
    updatedAt: normalizeTimestamp(item.updatedAt || item.updated_at, formatDateTime),
  };
}

function traceUrl({ langfuseUrl = "", projectId = "", traceId = "" }) {
  if (!langfuseUrl || !traceId) return "";
  return `${langfuseUrl.replace(/\/$/, "")}${projectId ? `/project/${projectId}` : ""}/traces/${traceId}`;
}

function normalizeTraceRow(item = {}, { langfuseUrl = "", formatDateTime }) {
  const metadata = metadataFromTrace(item);
  const traceId = String(item.id || item.traceId || item.trace_id || "");
  const projectId = item.projectId || item.project_id || metadata.projectId || "";
  return {
    traceId,
    traceName: String(item.name || item.traceName || item.trace_name || ""),
    ...traceIdentityFields(item, metadata),
    ...traceRuntimeFields(item, metadata),
    ...traceUsageFields(metadata),
    ...traceTimingFields(item, formatDateTime),
    url: traceUrl({ langfuseUrl, projectId, traceId }),
    source: "langfuse_api",
  };
}

function extractTraceRows(payload = {}) {
  return Array.isArray(payload.data) ? payload.data : (Array.isArray(payload.items) ? payload.items : []);
}

function normalizedTraceLimit(limit) {
  return Math.min(100, Math.max(1, Number(limit || 20)));
}

function filterTraceRows(rows = [], { userId = "", workspaceId = "", runId = "", limit = 20 } = {}) {
  return rows
    .filter((item) => !userId || item.userId === userId)
    .filter((item) => !workspaceId || item.workspaceId === workspaceId)
    .filter((item) => !runId || item.runId === runId)
    .slice(0, normalizedTraceLimit(limit));
}

function summarizeTracePayload(payload, formatDateTime) {
  const rows = extractTraceRows(payload);
  const latest = rows[0] || {};
  return {
    traceCount: Number(payload.meta?.totalItems ?? payload.totalCount ?? payload.count ?? rows.length),
    latestTraceAt: normalizeTimestamp(latest.timestamp || latest.createdAt || latest.created_at, formatDateTime) || "暂无",
  };
}

export function createLangfuseTraceClient({
  langfuseUrl,
  publicKey = "",
  secretKey = "",
  projectId = "",
  formatDateTime,
  timeoutMs = 10000,
}) {
  const baseUrl = String(langfuseUrl || "").replace(/\/$/, "");
  const authorization = authHeader(publicKey, secretKey);

  function configured() {
    return Boolean(baseUrl && authorization);
  }

  async function fetchPublicJson(pathname, search = {}) {
    if (!configured()) {
      const error = new Error("langfuse_api_not_configured");
      error.code = "LANGFUSE_NOT_CONFIGURED";
      throw error;
    }
    const url = new URL(pathname, `${baseUrl}/`);
    for (const [key, value] of Object.entries(compactObject(search))) {
      url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    const error = new Error(`langfuse_api_failed:${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return {
    configured,

    async fetchSummary() {
      if (!configured()) {
        return { available: false, mode: "status_only", note: "Langfuse API 未配置" };
      }
      try {
        const payload = await fetchPublicJson("/api/public/traces", {
          limit: 1,
          page: 1,
          projectId,
        });
        return {
          available: true,
          mode: "live",
          source: "langfuse_api",
          ...summarizeTracePayload(payload, formatDateTime),
          note: "数据来自 Langfuse Public API",
        };
      } catch (error) {
        return {
          available: false,
          mode: "status_only",
          source: "langfuse_api",
          note: `Langfuse API 查询失败：${String(error.message || error)}`,
        };
      }
    },

    async fetchTraceRows({ userId = "", workspaceId = "", runId = "", limit = 20 } = {}) {
      if (!configured()) {
        return { source: "langfuse_api", type: "status_only", rows: [], note: "Langfuse API 未配置" };
      }
      try {
        const payload = await fetchPublicJson("/api/public/traces", {
          limit: normalizedTraceLimit(limit),
          page: 1,
          userId,
          projectId,
        });
        const rows = filterTraceRows(
          extractTraceRows(payload).map((item) => normalizeTraceRow(item, { langfuseUrl: baseUrl, formatDateTime })),
          { userId, workspaceId, runId, limit },
        );
        return {
          source: "langfuse_api",
          type: rows.length ? "live" : "status_only",
          rows,
          note: rows.length ? "数据来自 Langfuse Public API" : "Langfuse 中未查询到匹配 trace",
        };
      } catch (error) {
        return {
          source: "langfuse_api",
          type: "status_only",
          rows: [],
          note: `Langfuse API 查询失败：${String(error.message || error)}`,
        };
      }
    },
  };
}
