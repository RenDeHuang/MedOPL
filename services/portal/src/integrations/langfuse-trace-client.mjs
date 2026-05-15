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

const LANGFUSE_ADMIN_CONSOLE_ORIGIN = "https://trace.medopl.cn";

function requiredText(value, code) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return normalized;
}

function requiredNonNegativeNumber(value, code) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return numberValue;
}

function requiredTags(value) {
  if (!Array.isArray(value)) {
    const error = new Error("langfuse_projection_tags_required");
    error.code = "LANGFUSE_PROJECTION_TAGS_REQUIRED";
    throw error;
  }
  return value.map((item) => requiredText(item, "langfuse_projection_tag_required"));
}

function usageSummaryProjection(summary = {}) {
  return {
    inputTokens: requiredNonNegativeNumber(summary.inputTokens, "langfuse_projection_input_tokens_required"),
    outputTokens: requiredNonNegativeNumber(summary.outputTokens, "langfuse_projection_output_tokens_required"),
    totalTokens: requiredNonNegativeNumber(summary.totalTokens, "langfuse_projection_total_tokens_required"),
  };
}

function costEstimateProjection(runtimeBridgeMetadata = {}) {
  const billingCostSummary = runtimeBridgeMetadata.billingCostSummary || {};
  return {
    currency: requiredText(billingCostSummary.currency, "langfuse_projection_cost_currency_required"),
    amount: requiredNonNegativeNumber(billingCostSummary.estimatedAmount, "langfuse_projection_cost_amount_required"),
  };
}

function requiredUrlOrigin(value, code) {
  const urlValue = requiredText(value, code);
  try {
    return new URL(urlValue).origin;
  } catch {
    const error = new Error("langfuse_projection_trace_url_invalid");
    error.code = "LANGFUSE_PROJECTION_TRACE_URL_INVALID";
    throw error;
  }
}

function requiredAdminTraceUrl(value, adminConsoleOrigin) {
  const traceUrlValue = requiredText(value, "langfuse_projection_trace_url_required");
  let traceOrigin = "";
  try {
    traceOrigin = new URL(traceUrlValue).origin;
  } catch {
    const error = new Error("langfuse_projection_trace_url_invalid");
    error.code = "LANGFUSE_PROJECTION_TRACE_URL_INVALID";
    throw error;
  }
  if (traceOrigin !== adminConsoleOrigin) {
    const error = new Error("langfuse_projection_trace_url_must_use_admin_console_origin");
    error.code = "LANGFUSE_PROJECTION_TRACE_URL_MUST_USE_ADMIN_CONSOLE_ORIGIN";
    throw error;
  }
  return traceUrlValue;
}

export function createLangfuseSanitizedProjectionAdapter({
  adminConsoleUrl = "https://trace.medopl.cn",
} = {}) {
  const adminConsoleOrigin = requiredUrlOrigin(adminConsoleUrl, "langfuse_projection_admin_console_url_required");
  if (adminConsoleOrigin !== LANGFUSE_ADMIN_CONSOLE_ORIGIN) {
    const error = new Error("langfuse_projection_admin_console_origin_mismatch");
    error.code = "LANGFUSE_PROJECTION_ADMIN_CONSOLE_ORIGIN_MISMATCH";
    throw error;
  }

  return {
    project({ runtimeBridgeMetadata = {}, langfuseTraceSummary = {} } = {}) {
      return {
        traceId: requiredText(langfuseTraceSummary.traceId, "langfuse_projection_trace_id_required"),
        sessionId: requiredText(runtimeBridgeMetadata.sessionId, "langfuse_projection_session_id_required"),
        runId: requiredText(runtimeBridgeMetadata.runId, "langfuse_projection_run_id_required"),
        status: requiredText(runtimeBridgeMetadata.status, "langfuse_projection_status_required"),
        latencyMs: requiredNonNegativeNumber(langfuseTraceSummary.latencyMs, "langfuse_projection_latency_ms_required"),
        usageSummary: usageSummaryProjection(langfuseTraceSummary.usageSummary),
        costEstimate: costEstimateProjection(runtimeBridgeMetadata),
        traceUrl: requiredAdminTraceUrl(langfuseTraceSummary.traceUrl, adminConsoleOrigin),
        tags: requiredTags(runtimeBridgeMetadata.tags),
      };
    },
  };
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
    resourceBindingId: String(firstValue(metadata.resourceBindingId, metadata.resource_binding_id, item.resourceBindingId, item.resource_binding_id)),
    billingAttributionId: String(firstValue(metadata.billingAttributionId, metadata.billing_attribution_id, item.billingAttributionId, item.billing_attribution_id)),
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
