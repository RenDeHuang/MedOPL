import { providerKeyRefFrom } from "./runtime-bridge-launch-scope.mjs";

const DEFAULT_TIMEOUT_MS = 30000;

function text(value = "") {
  return String(value ?? "").trim();
}

function endpointFrom(runtimeSession = {}, input = {}) {
  return text(input.runtimeAgentEndpoint || input.runtime_agent_endpoint || runtimeSession.runtimeAgentEndpoint).replace(/\/$/, "");
}

function firstText(...values) {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return "";
}

function fileRefsFrom(input = {}) {
  return (Array.isArray(input.fileRefs) ? input.fileRefs : [])
    .map(text)
    .filter(Boolean);
}

function relayError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.stage = "runtime_agent_http_relay";
  error.retryable = false;
  error.details = details;
  return error;
}

function assertNoForbiddenRelayFields(payload = {}, label = "runtime_agent_http_relay") {
  const serialized = JSON.stringify(payload || {});
  if (!/ownerRef|operationId|k8sLabels|kubernetesLabels|deployOwnerLabels|apiKey|providerApiKey|rawProviderKey|launchToken|runtimeToken|bearerToken|objectKey|storageKey|localPath|signedUrl|presignedUrl/i.test(serialized)) return;
  throw relayError(`${label}_forbidden_field_detected`, "RUNTIME_AGENT_HTTP_RELAY_FORBIDDEN_FIELD", { label });
}

function runtimeScope(runtimeSession = {}, input = {}) {
  return {
    tenantId: firstText(input.tenantId, input.tenant_id, runtimeSession.tenantId),
    portalUserId: firstText(input.portalUserId, input.portal_user_id, runtimeSession.portalUserId),
    workspaceId: firstText(input.workspaceId, input.workspace_id, runtimeSession.workspaceId),
    workspaceSessionId: firstText(input.workspaceSessionId, input.workspace_session_id, runtimeSession.workspaceSessionId),
    runtimeSessionId: firstText(input.runtimeSessionId, input.runtime_session_id, runtimeSession.runtimeSessionId),
    oplSessionId: firstText(input.oplSessionId, input.opl_session_id, runtimeSession.oplSessionId),
    resourceBindingId: firstText(input.resourceBindingId, input.resource_binding_id, runtimeSession.resourceBindingId),
    computeInstanceId: firstText(input.computeInstanceId, input.compute_instance_id, runtimeSession.computeInstanceId),
    storageBucketId: firstText(input.storageBucketId, input.storage_bucket_id, runtimeSession.storageBucketId),
    runtimeAgentId: firstText(input.runtimeAgentId, input.runtime_agent_id, runtimeSession.runtimeAgentId),
    providerKeyRef: providerKeyRefFrom(input) || providerKeyRefFrom(runtimeSession),
  };
}

function runtimeFilePayload(runtimeSession = {}, input = {}) {
  const scope = runtimeScope(runtimeSession, input);
  return {
    ...scope,
    fileName: firstText(input.fileName, input.file_name, input.name),
    name: firstText(input.name, input.fileName, input.file_name),
    relativePath: firstText(input.relativePath, input.relative_path, input.fileName, input.file_name, input.name).replace(/^\/+/, ""),
    sizeBytes: Number(input.sizeBytes ?? input.size_bytes ?? 0),
    contentType: firstText(input.contentType, input.content_type) || "application/octet-stream",
    source: "portal_opl_adapter",
  };
}

function runtimeRunPayload(runtimeSession = {}, input = {}) {
  const scope = runtimeScope(runtimeSession, input);
  return {
    ...scope,
    runId: firstText(input.runId, input.run_id),
    traceId: firstText(input.traceId, input.trace_id, runtimeSession.traceId),
    toolName: firstText(input.toolName, input.tool_name) || "opl-runtime",
    kind: firstText(input.kind) || "opl-runtime",
    message: firstText(input.message, input.text, input.prompt),
    model: firstText(input.model, runtimeSession.model),
    fileRefs: fileRefsFrom(input),
  };
}

function runtimeCancelPayload(runtimeSession = {}, input = {}, runId = "") {
  return {
    ...runtimeScope(runtimeSession, input),
    runId: text(runId),
    reason: firstText(input.reason, input.cancelReason, input.cancel_reason),
  };
}

async function requestJson(baseUrl, pathname, { method = "POST", body = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = new URL(pathname, `${baseUrl}/`);
  const payload = body || {};
  assertNoForbiddenRelayFields(payload, pathname);
  const response = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
    ...(body ? { body: JSON.stringify(payload) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw relayError(json?.error || `runtime_agent_http_request_failed:${response.status}`, "RUNTIME_AGENT_HTTP_REQUEST_FAILED", {
      status: response.status,
      path: pathname,
    });
  }
  assertNoForbiddenRelayFields(json, `${pathname}_response`);
  return json;
}

function fileFromResponse(response = {}) {
  const file = response.file && typeof response.file === "object" ? response.file : response;
  const fileRef = firstText(file.fileRef, file.file_ref, file.artifactRef, file.artifact_ref, file.id);
  if (!fileRef) {
    throw relayError("runtime_agent_file_ref_missing", "RUNTIME_AGENT_FILE_REF_MISSING");
  }
  return {
    fileRef,
    artifactRef: fileRef,
    kind: firstText(file.kind) || "inputs",
    name: firstText(file.name, file.fileName, file.file_name, fileRef),
    relativePath: firstText(file.relativePath, file.relative_path, file.path, file.name, fileRef).replace(/^\/+/, ""),
    sizeBytes: Number(file.sizeBytes ?? file.size_bytes ?? 0),
    contentType: firstText(file.contentType, file.content_type) || "application/octet-stream",
    status: firstText(file.status) || "ready",
    source: firstText(file.source) || "runtime_agent_http",
  };
}

export function createRuntimeAgentHttpRelay({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  async function relayFile({ runtimeSession = {}, input = {} } = {}) {
    const endpoint = endpointFrom(runtimeSession, input);
    if (!endpoint) {
      throw relayError("runtime_agent_endpoint_required", "RUNTIME_AGENT_ENDPOINT_REQUIRED");
    }
    const response = await requestJson(endpoint, "/api/runtime/files", {
      method: "POST",
      body: runtimeFilePayload(runtimeSession, input),
      timeoutMs,
    });
    return fileFromResponse(response);
  }

  async function relayRun({ runtimeSession = {}, input = {} } = {}) {
    const endpoint = endpointFrom(runtimeSession, input);
    if (!endpoint) {
      throw relayError("runtime_agent_endpoint_required", "RUNTIME_AGENT_ENDPOINT_REQUIRED");
    }
    return requestJson(endpoint, "/api/runtime/runs", {
      method: "POST",
      body: runtimeRunPayload(runtimeSession, input),
      timeoutMs,
    });
  }

  async function cancelRun({ runtimeSession = {}, runId = "", input = {} } = {}) {
    const endpoint = endpointFrom(runtimeSession, input);
    if (!endpoint) {
      throw relayError("runtime_agent_endpoint_required", "RUNTIME_AGENT_ENDPOINT_REQUIRED");
    }
    return requestJson(endpoint, `/api/runtime/runs/${encodeURIComponent(text(runId))}/cancel`, {
      method: "POST",
      body: runtimeCancelPayload(runtimeSession, input, runId),
      timeoutMs,
    });
  }

  return {
    cancelRun,
    relayFile,
    relayRun,
  };
}
