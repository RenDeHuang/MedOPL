import { randomUUID } from "node:crypto";

import { ownerIdFrom, storageOwnerIdFrom, tenantIdFrom } from "./state-store-identity.mjs";
import { providerKeyRefFields } from "./state-store-record-field-groups.mjs";
import { nowIso } from "./state-store-record-time.mjs";

export function buildArtifactRecord(input = {}) {
  const ownerId = ownerIdFrom(input);
  const storageOwnerId = storageOwnerIdFrom(input) || ownerId;
  return {
    artifactId: input.artifactId || input.artifact_id || randomUUID(),
    runId: input.runId || input.run_id || "",
    tenantId: tenantIdFrom(input),
    portalUserId: input.portalUserId || input.portal_user_id || "",
    ownerId,
    artifactOwnerId: input.artifactOwnerId || input.artifact_owner_id || ownerId,
    storageOwner: input.storageOwner || input.storage_owner || storageOwnerId,
    storageOwnerId,
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    resourceBindingId: input.resourceBindingId || input.resource_binding_id || "",
    resourceOrderId: input.resourceOrderId || input.resource_order_id || "",
    ...providerKeyRefFields(input),
    kind: input.kind || "output",
    name: input.name || "",
    relativePath: input.relativePath || input.relative_path || input.path || input.name || "",
    storageKey: input.storageKey || input.storage_key || input.objectKey || input.object_key || "",
    objectKey: input.objectKey || input.object_key || "",
    localPath: input.localPath || input.local_path || input.path || "",
    sizeBytes: Number(input.sizeBytes || input.size_bytes || 0),
    contentType: input.contentType || input.content_type || "application/octet-stream",
    createdAt: input.createdAt || input.created_at || nowIso(),
  };
}

export function buildTraceRecord(input = {}) {
  const ownerId = ownerIdFrom(input);
  return {
    traceId: input.traceId || input.trace_id || randomUUID(),
    runId: input.runId || input.run_id || "",
    tenantId: tenantIdFrom(input),
    portalUserId: input.portalUserId || input.portal_user_id || "",
    ownerId,
    traceOwnerId: input.traceOwnerId || input.trace_owner_id || ownerId,
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    resourceOrderId: input.resourceOrderId || input.resource_order_id || "",
    traceProvider: input.traceProvider || input.trace_provider || "portal-opl-adapter",
    traceName: input.traceName || input.trace_name || "med-autoscience-run",
    status: input.status || "submitted",
    latencyMs: Number(input.latencyMs || input.latency_ms || 0),
    model: input.model || "opl-runtime",
    tokenCount: Number(input.tokenCount || input.token_count || 0),
    userAgent: input.userAgent || input.user_agent || "",
    error: input.error || "",
    createdAt: input.createdAt || input.created_at || nowIso(),
  };
}
