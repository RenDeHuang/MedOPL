function text(value = "") {
  return String(value ?? "").trim();
}

function number(value = 0) {
  const resolved = Number(value || 0);
  return Number.isFinite(resolved) ? resolved : 0;
}

function bool(value = false) {
  return value === true;
}

export function publicLaunchView(launch = {}, runtimeSession = {}) {
  return {
    launchId: text(launch.launchId),
    traceId: text(launch.traceId),
    portalUserId: text(launch.portalUserId),
    workspaceId: text(launch.workspaceId),
    workspaceTitle: text(launch.workspaceTitle),
    workspacePath: text(launch.workspacePath),
    workspaceSessionId: text(launch.workspaceSessionId),
    runtimeSessionId: text(launch.runtimeSessionId),
    oplSessionId: text(runtimeSession.oplSessionId || launch.oplSessionId),
    providerBound: Boolean(runtimeSession.providerConfigured && runtimeSession.providerKeyRef),
    providerKeyRef: text(runtimeSession.providerKeyRef || launch.providerKeyRef),
    launchStatus: launch.launchStatus || null,
    source: text(launch.source),
    createdAt: text(launch.createdAt),
    expiresAt: text(launch.expiresAt),
  };
}

export function publicRuntimeSessionView(runtimeSession = {}, scope = {}) {
  return {
    runtimeSessionId: text(runtimeSession.runtimeSessionId || scope.runtimeSessionId),
    oplSessionId: text(runtimeSession.oplSessionId || scope.oplSessionId),
    portalUserId: text(runtimeSession.portalUserId || scope.portalUserId),
    workspaceId: text(runtimeSession.workspaceId || scope.workspaceId),
    workspaceSessionId: text(runtimeSession.workspaceSessionId || scope.workspaceSessionId),
    providerKeyRef: text(runtimeSession.providerKeyRef),
    providerConfigured: bool(runtimeSession.providerConfigured),
    providerConfigStatus: text(runtimeSession.providerConfigStatus || (runtimeSession.providerConfigured ? "configured" : "missing")),
    providerBound: Boolean(runtimeSession.providerConfigured && runtimeSession.providerKeyRef),
    status: text(runtimeSession.status || "ready"),
  };
}

export function publicWorkspaceView(item = {}) {
  return {
    workspaceId: text(item.workspaceId || item.workspace_id || item.id),
    workspaceTitle: text(item.workspaceTitle || item.workspace_title || item.title || item.label || item.name),
    workspacePath: text(item.workspacePath || item.workspace_path),
    portalUserId: text(item.portalUserId || item.portal_user_id || item.userId),
    ownerId: text(item.ownerId || item.owner_id),
    status: text(item.status || "active"),
    createdAt: text(item.createdAt || item.created_at),
    updatedAt: text(item.updatedAt || item.updated_at),
  };
}

export function publicSessionView(item = {}) {
  return {
    sessionId: text(item.sessionId || item.session_id || item.oplSessionId || item.opl_session_id || item.id),
    oplSessionId: text(item.oplSessionId || item.opl_session_id || item.sessionId || item.session_id || item.id),
    workspaceSessionId: text(item.workspaceSessionId || item.workspace_session_id),
    runtimeSessionId: text(item.runtimeSessionId || item.runtime_session_id),
    portalUserId: text(item.portalUserId || item.portal_user_id || item.userId),
    workspaceId: text(item.workspaceId || item.workspace_id),
    status: text(item.status || "active"),
    createdAt: text(item.createdAt || item.created_at),
    updatedAt: text(item.updatedAt || item.updated_at),
  };
}

export function publicMessageView(item = {}) {
  return {
    messageId: text(item.messageId || item.message_id),
    runId: text(item.runId || item.run_id || item.messageId || item.message_id),
    traceId: text(item.traceId || item.trace_id),
    status: text(item.status || "running"),
    workspaceId: text(item.workspaceId || item.workspace_id),
    workspaceSessionId: text(item.workspaceSessionId || item.workspace_session_id),
    runtimeSessionId: text(item.runtimeSessionId || item.runtime_session_id),
    oplSessionId: text(item.oplSessionId || item.opl_session_id || item.sessionId || item.session_id),
    providerKeyRef: text(item.providerKeyRef || item.provider_key_ref),
    model: text(item.model),
    tokenCount: number(item.tokenCount || item.token_count),
    artifactRef: text(item.artifactId || item.artifact_id),
    createdAt: text(item.createdAt || item.created_at),
    updatedAt: text(item.updatedAt || item.updated_at),
    finishedAt: text(item.finishedAt || item.finished_at),
  };
}

export function publicArtifactView(item = {}) {
  const artifactRef = text(item.artifactId || item.artifact_id || item.artifactRef || item.artifact_ref || item.outputFileRef || item.output_file_ref);
  return {
    artifactId: artifactRef,
    artifactRef,
    outputFileRef: artifactRef,
    runId: text(item.runId || item.run_id),
    workspaceId: text(item.workspaceId || item.workspace_id),
    workspaceSessionId: text(item.workspaceSessionId || item.workspace_session_id),
    runtimeSessionId: text(item.runtimeSessionId || item.runtime_session_id),
    resourceBindingId: text(item.resourceBindingId || item.resource_binding_id),
    providerKeyRef: text(item.providerKeyRef || item.provider_key_ref),
    kind: text(item.kind || "outputs"),
    name: text(item.name),
    relativePath: text(item.relativePath || item.relative_path),
    sizeBytes: number(item.sizeBytes || item.size_bytes),
    contentType: text(item.contentType || item.content_type || "application/octet-stream"),
    createdAt: text(item.createdAt || item.created_at),
  };
}

export function publicProgressView(item = {}) {
  return {
    id: text(item.id),
    type: text(item.type || item.eventType || item.event_type),
    status: text(item.status),
    portalUserId: text(item.portalUserId || item.portal_user_id || item.userId),
    workspaceId: text(item.workspaceId || item.workspace_id),
    workspaceSessionId: text(item.workspaceSessionId || item.workspace_session_id),
    runtimeSessionId: text(item.runtimeSessionId || item.runtime_session_id),
    sessionId: text(item.sessionId || item.session_id || item.oplSessionId || item.opl_session_id),
    messageId: text(item.messageId || item.message_id),
    artifactRef: text(item.artifactId || item.artifact_id || item.artifactRef || item.artifact_ref),
    traceId: text(item.traceId || item.trace_id),
    source: text(item.source),
    occurredAt: text(item.occurredAt || item.occurred_at),
    createdAt: text(item.createdAt || item.created_at),
  };
}

export function publicRunView(item = {}) {
  return {
    runId: text(item.runId || item.run_id),
    traceId: text(item.traceId || item.trace_id),
    status: text(item.status || "submitted"),
    workspaceId: text(item.workspaceId || item.workspace_id),
    workspaceSessionId: text(item.workspaceSessionId || item.workspace_session_id),
    runtimeSessionId: text(item.runtimeSessionId || item.runtime_session_id),
    resourceBindingId: text(item.resourceBindingId || item.resource_binding_id),
    providerKeyRef: text(item.providerKeyRef || item.provider_key_ref),
    billingMetadataRef: text(item.billingMetadataRef || item.billing_metadata_ref),
    usageMetadataRef: text(item.usageMetadataRef || item.usage_metadata_ref),
    kind: text(item.kind),
    toolName: text(item.toolName || item.tool_name),
    mode: text(item.mode),
    model: text(item.model),
    tokenCount: number(item.tokenCount || item.token_count),
    createdAt: text(item.createdAt || item.created_at),
    startedAt: text(item.startedAt || item.started_at),
    finishedAt: text(item.finishedAt || item.finished_at),
    latencyMs: number(item.latencyMs || item.latency_ms),
    error: text(item.error),
  };
}

export function publicRunActionView(item = {}) {
  return {
    actionId: text(item.actionId || item.action_id),
    runId: text(item.runId || item.run_id),
    traceId: text(item.traceId || item.trace_id),
    workspaceId: text(item.workspaceId || item.workspace_id),
    workspaceSessionId: text(item.workspaceSessionId || item.workspace_session_id),
    runtimeSessionId: text(item.runtimeSessionId || item.runtime_session_id),
    actionType: text(item.actionType || item.action_type),
    summary: text(item.summary),
    status: text(item.status),
    startedAt: text(item.startedAt || item.started_at),
    finishedAt: text(item.finishedAt || item.finished_at),
    createdAt: text(item.createdAt || item.created_at),
  };
}

export function publicTraceView(item = {}) {
  return {
    traceId: text(item.traceId || item.trace_id),
    runId: text(item.runId || item.run_id),
    workspaceId: text(item.workspaceId || item.workspace_id),
    workspaceSessionId: text(item.workspaceSessionId || item.workspace_session_id),
    runtimeSessionId: text(item.runtimeSessionId || item.runtime_session_id),
    traceProvider: text(item.traceProvider || item.trace_provider),
    traceName: text(item.traceName || item.trace_name),
    status: text(item.status),
    latencyMs: number(item.latencyMs || item.latency_ms),
    model: text(item.model),
    tokenCount: number(item.tokenCount || item.token_count),
    createdAt: text(item.createdAt || item.created_at),
  };
}

export function publicCostView(item = {}) {
  return {
    costRecordId: text(item.costRecordId || item.cost_record_id || item.id),
    runId: text(item.runId || item.run_id),
    workspaceId: text(item.workspaceId || item.workspace_id),
    workspaceSessionId: text(item.workspaceSessionId || item.workspace_session_id),
    runtimeSessionId: text(item.runtimeSessionId || item.runtime_session_id),
    resourceBindingId: text(item.resourceBindingId || item.resource_binding_id),
    providerKeyRef: text(item.providerKeyRef || item.provider_key_ref),
    status: text(item.status),
    billingMetadataRef: text(item.billingMetadataRef || item.billing_metadata_ref || item.costSummary?.billingMetadataRef || item.costSummary?.billing_metadata_ref),
    usageMetadataRef: text(item.usageMetadataRef || item.usage_metadata_ref || item.costSummary?.usageMetadataRef || item.costSummary?.usage_metadata_ref),
    currency: text(item.currency || item.costSummary?.currency),
    estimatedCost: number(item.estimatedCost ?? item.estimated_cost ?? item.costSummary?.estimatedCost),
    billedCost: number(item.billedCost ?? item.billed_cost ?? item.costSummary?.billedCost),
    createdAt: text(item.createdAt || item.created_at),
    updatedAt: text(item.updatedAt || item.updated_at),
  };
}
