import { randomUUID } from "node:crypto";

import { providerKeyRefFields } from "./state-store-provider-key-ref.mjs";
import { runtimeDispatchFields } from "./state-store-runtime-dispatch-fields.mjs";
import { ownerIdFrom, storageOwnerIdFrom, tenantIdFrom } from "./state-store-identity.mjs";
import { nowIso } from "./state-store-record-time.mjs";

export function buildMessageRequestRecord(input = {}) {
  const messageId = input.messageId || input.message_id || input.runId || input.run_id || randomUUID();
  const ownerId = ownerIdFrom(input);
  const storageOwnerId = storageOwnerIdFrom(input) || ownerId;
  return {
    ...messageRequestIds(input, messageId),
    ...messageRequestOwnership(input, ownerId, storageOwnerId),
    ...messageRequestScope(input),
    ...runtimeDispatchFields(input),
    ...messageRequestResult(input),
    createdAt: input.createdAt || input.created_at || nowIso(),
    startedAt: input.startedAt || input.started_at || nowIso(),
    finishedAt: input.finishedAt || input.finished_at || "",
    updatedAt: input.updatedAt || input.updated_at || nowIso(),
  };
}

function messageRequestIds(input = {}, messageId = randomUUID()) {
  return {
    messageId,
    runId: input.runId || input.run_id || messageId,
    traceId: input.traceId || input.trace_id || "",
    launchTokenHash: input.launchTokenHash || input.launch_token_hash || "",
  };
}

function messageRequestOwnership(input = {}, ownerId = "", storageOwnerId = "") {
  return {
    tenantId: tenantIdFrom(input),
    portalUserId: input.portalUserId || input.portal_user_id || "",
    ownerId,
    storageOwner: input.storageOwner || input.storage_owner || storageOwnerId,
    storageOwnerId,
  };
}

function messageRequestScope(input = {}) {
  return {
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    oplSessionId: input.oplSessionId || input.opl_session_id || input.sessionId || input.session_id || "",
    ...providerKeyRefFields(input),
    promptPreview: input.promptPreview || input.prompt_preview || "",
  };
}

function messageRequestResult(input = {}) {
  return {
    status: input.status || "running",
    model: input.model || "opl-runtime",
    tokenCount: Number(input.tokenCount || input.token_count || 0),
    userAgent: input.userAgent || input.user_agent || "",
    reply: input.reply || "",
    artifactId: input.artifactId || input.artifact_id || "",
    artifactName: input.artifactName || input.artifact_name || "",
    error: input.error || "",
    replyMessageId: input.replyMessageId || input.reply_message_id || "",
    messageTraceId: input.messageTraceId || input.message_trace_id || "",
    providerInvocationRef: input.providerInvocationRef || input.provider_invocation_ref || "",
    capabilitySource: input.capabilitySource || input.capability_source || "",
    ...messageRequestTiming(input),
  };
}

function messageRequestTiming(input = {}) {
  return {
    acceptedAt: input.acceptedAt || input.accepted_at || "",
    workerStartedAt: input.workerStartedAt || input.worker_started_at || "",
    acpStartedAt: input.acpStartedAt || input.acp_started_at || "",
    acpEndedAt: input.acpEndedAt || input.acp_ended_at || "",
    persistedAt: input.persistedAt || input.persisted_at || "",
    tracePublishedAt: input.tracePublishedAt || input.trace_published_at || "",
  };
}

export function buildMessageReplyRecord(input = {}) {
  return {
    ...messageReplyIds(input),
    ...messageReplyOwnership(input),
    workspaceId: input.workspaceId || input.workspace_id || "",
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || "",
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || "",
    ...providerKeyRefFields(input),
    ...runtimeDispatchFields(input),
    promptPreview: input.promptPreview || input.prompt_preview || "",
    reply: input.reply || "",
    replyMessageId: input.replyMessageId || input.reply_message_id || "",
    messageTraceId: input.messageTraceId || input.message_trace_id || "",
    providerInvocationRef: input.providerInvocationRef || input.provider_invocation_ref || "",
    capabilitySource: input.capabilitySource || input.capability_source || "",
    providerModelRef: input.providerModelRef || input.provider_model_ref || "",
    providerAuthorizationStatus: input.providerAuthorizationStatus || input.provider_authorization_status || "",
    replyMetadata: input.replyMetadata && typeof input.replyMetadata === "object"
      ? {
          role: input.replyMetadata.role || "",
          replyLength: Number(input.replyMetadata.replyLength || 0),
          replyHashPrefix: input.replyMetadata.replyHashPrefix || "",
          finishStatus: input.replyMetadata.finishStatus || "",
          latencyMs: Number(input.replyMetadata.latencyMs || 0),
          streamEventCount: Number(input.replyMetadata.streamEventCount || 0),
          createdAt: input.replyMetadata.createdAt || "",
        }
      : null,
    source: input.source || "opl_runtime",
    status: input.status || "succeeded",
    model: input.model || "opl-runtime",
    tokenCount: Number(input.tokenCount || input.token_count || 0),
    createdAt: input.createdAt || input.created_at || nowIso(),
  };
}

function messageReplyIds(input = {}) {
  const messageId = input.messageId || input.message_id || input.runId || input.run_id || randomUUID();
  return {
    messageId,
    runId: input.runId || input.run_id || input.messageId || input.message_id || "",
    traceId: input.traceId || input.trace_id || "",
    oplSessionId: input.oplSessionId || input.opl_session_id || input.sessionId || input.session_id || "",
  };
}

function messageReplyOwnership(input = {}) {
  const ownerId = ownerIdFrom(input);
  const storageOwnerId = storageOwnerIdFrom(input) || ownerId;
  return {
    tenantId: tenantIdFrom(input),
    portalUserId: input.portalUserId || input.portal_user_id || "",
    ownerId,
    storageOwner: input.storageOwner || input.storage_owner || storageOwnerId,
    storageOwnerId,
  };
}
