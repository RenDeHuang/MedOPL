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

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? "";
}

function traceIdForEvent(event = {}) {
  return String(firstValue(event.traceId, event.trace_id, event.runId, event.run_id, randomUUID()));
}

function metadataForEvent(event = {}) {
  return cleanMetadata({
    schema_version: "opl.trace.v13",
    tenantId: firstValue(event.tenantId, event.tenant_id),
    workspaceId: firstValue(event.workspaceId, event.workspace_id),
    workspaceSessionId: firstValue(event.workspaceSessionId, event.workspace_session_id),
    runtimeSessionId: firstValue(event.runtimeSessionId, event.runtime_session_id),
    runId: firstValue(event.runId, event.run_id),
    resourceOrderId: firstValue(event.resourceOrderId, event.resource_order_id),
    serverPlanId: firstValue(event.serverPlanId, event.server_plan_id),
    status: firstValue(event.status, "recorded"),
    model: firstValue(event.model, "opl-runtime"),
    eventType: firstValue(event.eventType, event.type, "runtime_event"),
    artifactId: firstValue(event.artifactId, event.artifact_id),
    artifactName: firstValue(event.name, event.artifactName),
  });
}

function ingestionBodyForEvent(event = {}) {
  const traceId = traceIdForEvent(event);
  return {
    traceId,
    body: {
      batch: [{
        id: randomUUID(),
        type: "trace-create",
        timestamp: firstValue(event.timestamp, event.occurredAt, event.createdAt, new Date().toISOString()),
        body: {
          id: traceId,
          name: firstValue(event.traceName, event.name, "opl-session"),
          userId: firstValue(event.portalUserId, event.portal_user_id, event.userId, event.user_id),
          sessionId: firstValue(event.workspaceSessionId, event.workspace_session_id, event.sessionId, event.session_id),
          metadata: metadataForEvent(event),
        },
      }],
    },
  };
}

async function postIngestion({ normalizedBaseUrl, authorization, timeoutMs, body }) {
  return fetch(new URL("/api/public/ingestion", `${normalizedBaseUrl}/`), {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
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
    const { traceId, body } = ingestionBodyForEvent(event);
    const response = await postIngestion({ normalizedBaseUrl, authorization, timeoutMs, body });
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
