import { isWebuiRuntimeMode } from "./runtime-bridge-routes-http.mjs";

function emptyText(value = "") {
  return String(value ?? "");
}

function publicMetadataRef(value = "") {
  const ref = emptyText(value).trim();
  if (!ref || ref.length > 128) return "";
  if (/[\\/]/.test(ref) || /^https?:/i.test(ref)) return "";
  return /^[a-zA-Z0-9._:-]+$/.test(ref) ? ref : "";
}

export function runtimeRunMetadataRefs(run = {}) {
  return {
    billingMetadataRef: publicMetadataRef(run.billingMetadataRef || run.billing_metadata_ref),
    usageMetadataRef: publicMetadataRef(run.usageMetadataRef || run.usage_metadata_ref),
  };
}

export function runtimeBridgeContractMetadata() {
  const webuiMode = isWebuiRuntimeMode();
  const webuiProviderMessageEnabled = webuiMode && process.env.OPL_WEBUI_PROVIDER_MESSAGE_ENABLED === "1";
  return {
    runtimeBridgeContractVersion: "v22.portal-opl-context-backflow.v1",
    upstreamProfile: webuiMode ? "webui_bridge" : "opl_product_api",
    capabilities: {
      contextBootstrap: { status: "supported", source: "gateway_runtime_bridge" },
      session: { status: "supported", source: webuiMode ? "webui_bridge" : "opl_product_api" },
      messageBackflow: webuiMode
        ? {
            status: webuiProviderMessageEnabled ? "mapped_to_webui_bridge" : "capability_not_supported",
            source: "webui_bridge",
            reason: webuiProviderMessageEnabled ? "provider_message_canary_enabled" : "reply_not_verified",
          }
        : { status: "supported", source: "opl_product_api" },
      fileIntent: webuiMode
        ? {
            status: "capability_not_supported",
            source: "webui_bridge",
            reason: "workspace_scoped_file_ref_not_verified",
          }
        : { status: "requires_downstream_runtime_boundary", source: "portal_workspace_file_store" },
      runIntent: { status: "requires_runtime_agent", source: "runtime_bridge" },
      langfuseSessionTrace: { status: "deferred_authorization", source: "trace.medopl.cn" },
    },
    supportedEvents: [
      "context_bootstrapped",
      "session_bound",
      "message_created",
      "message_reply_observed",
      "opl_file_gate_evaluated",
      "downstream_runtime_gate_evaluated",
      "artifact_output_gate_evaluated",
      "session_trace_metadata_projected",
    ],
  };
}

export function publicRuntimeSession(runtimeSession = {}) {
  return {
    runtimeSessionId: emptyText(runtimeSession.runtimeSessionId),
    oplSessionId: emptyText(runtimeSession.oplSessionId),
    portalUserId: emptyText(runtimeSession.portalUserId),
    tenantId: emptyText(runtimeSession.tenantId),
    workspaceId: emptyText(runtimeSession.workspaceId),
    workspaceSessionId: emptyText(runtimeSession.workspaceSessionId),
    resourceBindingId: emptyText(runtimeSession.resourceBindingId),
    providerKeyRef: emptyText(runtimeSession.providerKeyRef),
    providerConfigured: Boolean(runtimeSession.providerConfigured),
    providerConfigStatus: emptyText(runtimeSession.providerConfigStatus || (runtimeSession.providerConfigured ? "configured" : "missing")),
    providerBound: Boolean(runtimeSession.providerConfigured && runtimeSession.providerKeyRef),
    status: emptyText(runtimeSession.status || "ready"),
  };
}

export function runtimeBridgeBootstrapPayload(bootstrap = {}) {
  return {
    ...runtimeBridgeContractMetadata(),
    ...bootstrap,
  };
}

export function publicGatedRun(run = {}) {
  return {
    runId: emptyText(run.runId),
    traceId: emptyText(run.traceId),
    status: emptyText(run.status || "gated"),
    error: emptyText(run.error || "requires_runtime_agent"),
    workspaceId: emptyText(run.workspaceId),
    workspaceSessionId: emptyText(run.workspaceSessionId),
    runtimeSessionId: emptyText(run.runtimeSessionId),
    resourceBindingId: emptyText(run.resourceBindingId),
    providerKeyRef: emptyText(run.providerKeyRef),
    mode: emptyText(run.mode),
    toolName: emptyText(run.toolName),
    createdAt: emptyText(run.createdAt),
    finishedAt: emptyText(run.finishedAt),
  };
}

export function fileGatePayload({ runtimeSession = {}, input = {}, relativePath = "" } = {}) {
  return {
    ok: false,
    error: "file_upload_capability_not_supported",
    gate: "file_ref_not_observed",
    status: "gated",
    capability: "file_upload",
    source: "webui_bridge",
    file: {
      status: "gated",
      workspaceId: emptyText(runtimeSession.workspaceId),
      workspaceSessionId: emptyText(runtimeSession.workspaceSessionId),
      runtimeSessionId: emptyText(runtimeSession.runtimeSessionId),
      name: emptyText(input.name || input.fileName || input.file_name || relativePath.split("/").pop() || ""),
      relativePath: emptyText(relativePath),
      sizeBytes: Number(input.sizeBytes ?? input.size_bytes ?? 0),
      contentType: emptyText(input.contentType || input.content_type || "application/octet-stream"),
    },
  };
}

export function artifactGatePayload({ runId = "", artifactRef = "" } = {}) {
  return {
    ok: false,
    error: "artifact_not_observed",
    gate: "output_file_ref_not_observed",
    status: "gated",
    runId: emptyText(runId),
    artifactRef: emptyText(artifactRef),
  };
}

export function capabilityNotSupportedPayload(error, capabilityFallback = "") {
  return {
    ok: false,
    error: "capability_not_supported",
    capability: error?.capability || capabilityFallback,
    message: String(error?.message || "OPL capability is not supported by the current upstream mapping."),
  };
}
