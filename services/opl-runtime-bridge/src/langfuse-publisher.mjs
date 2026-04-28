import { randomUUID } from "node:crypto";

function basicAuth(publicKey, secretKey) {
  if (!publicKey || !secretKey) return "";
  return `Basic ${Buffer.from(`${publicKey}:${secretKey}`, "utf8").toString("base64")}`;
}

function cleanMetadata(value = {}) {
  const denied = new Set(["secret", "secretKey", "apiKey", "token", "password", "authorization"]);
  return Object.fromEntries(
    Object.entries(value || {}).filter(([key, item]) => !denied.has(String(key)) && item !== undefined && item !== null),
  );
}

export function createLangfusePublisher({
  baseUrl = process.env.LANGFUSE_URL || "",
  publicKey = process.env.LANGFUSE_PUBLIC_KEY || "",
  secretKey = process.env.LANGFUSE_SECRET_KEY || "",
  timeoutMs = Number(process.env.LANGFUSE_TIMEOUT_MS || 10000),
} = {}) {
  const normalizedBaseUrl = String(baseUrl || "").replace(/\/$/, "");
  const authorization = basicAuth(String(publicKey || "").trim(), String(secretKey || "").trim());

  function configured() {
    return Boolean(normalizedBaseUrl && authorization);
  }

  async function publishTraceEvent(event = {}) {
    if (!configured()) return { ok: false, skipped: true, reason: "langfuse_not_configured" };
    const traceId = String(event.traceId || event.trace_id || event.runId || event.run_id || randomUUID());
    const timestamp = event.timestamp || event.occurredAt || event.createdAt || new Date().toISOString();
    const metadata = cleanMetadata({
      schema_version: "opl.trace.v13",
      tenantId: event.tenantId || event.tenant_id || "",
      workspaceId: event.workspaceId || event.workspace_id || "",
      workspaceSessionId: event.workspaceSessionId || event.workspace_session_id || "",
      runtimeSessionId: event.runtimeSessionId || event.runtime_session_id || "",
      runId: event.runId || event.run_id || "",
      resourceOrderId: event.resourceOrderId || event.resource_order_id || "",
      serverPlanId: event.serverPlanId || event.server_plan_id || "",
      status: event.status || "recorded",
      model: event.model || "opl-runtime",
      eventType: event.eventType || event.type || "runtime_event",
      artifactId: event.artifactId || event.artifact_id || "",
      artifactName: event.name || event.artifactName || "",
    });
    const body = {
      batch: [{
        id: randomUUID(),
        type: "trace-create",
        timestamp,
        body: {
          id: traceId,
          name: event.traceName || event.name || "opl-session",
          userId: event.portalUserId || event.portal_user_id || event.userId || event.user_id || "",
          sessionId: event.workspaceSessionId || event.workspace_session_id || event.sessionId || event.session_id || "",
          metadata,
        },
      }],
    };
    const response = await fetch(new URL("/api/public/ingestion", `${normalizedBaseUrl}/`), {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return { ok: false, status: response.status, error: `langfuse_ingestion_failed:${response.status}` };
    }
    return { ok: true, traceId };
  }

  return {
    configured,
    publishTraceEvent,
  };
}
