import { publicRunArtifact } from "./runtime-bridge-public-artifacts.mjs";

function emptyText(value = "") {
  return String(value ?? "");
}

function msBetween(start = "", end = "") {
  const started = Date.parse(start || 0);
  const ended = Date.parse(end || 0);
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return 0;
  return Math.max(0, ended - started);
}

function messageReplyFor(state = {}, messageId = "") {
  return (state.messageReplies || []).find((item) => item.messageId === messageId) || null;
}

function messageArtifactFor(state = {}, runId = "") {
  return (state.artifacts || []).find((item) => item.runId === runId && item.kind === "message_reply") || null;
}

function publicMessageArtifactFor(state = {}, record = {}, runtimeSession = {}) {
  const artifact = messageArtifactFor(state, record.runId || record.messageId);
  if (!artifact) return null;
  return publicRunArtifact(artifact, {
    runId: record.runId || record.messageId || "",
    workspaceId: record.workspaceId || runtimeSession.workspaceId || "",
    resourceBindingId: record.resourceBindingId || runtimeSession.resourceBindingId || "",
    providerKeyRef: record.providerKeyRef || runtimeSession.providerKeyRef || "",
  }, runtimeSession);
}

function statusForMessageRecord(record = {}, message = null) {
  if (record.status) return record.status;
  return message ? "succeeded" : "running";
}

function pendingMessagePayload(record = {}) {
  return {
    messageId: emptyText(record.messageId),
    runId: emptyText(record.runId || record.messageId),
    traceId: emptyText(record.traceId),
    status: emptyText(record.status || "running"),
    createdAt: emptyText(record.createdAt),
    updatedAt: emptyText(record.updatedAt),
  };
}

function publicTracePayload(trace = {}) {
  if (!trace) return null;
  return {
    traceId: emptyText(trace.traceId),
    runId: emptyText(trace.runId),
    workspaceId: emptyText(trace.workspaceId),
    workspaceSessionId: emptyText(trace.workspaceSessionId),
    runtimeSessionId: emptyText(trace.runtimeSessionId),
    status: emptyText(trace.status || "recorded"),
    traceName: emptyText(trace.traceName),
    replyMessageId: emptyText(trace.replyMessageId),
    providerInvocationRef: emptyText(trace.providerInvocationRef),
    capabilitySource: emptyText(trace.capabilitySource),
    latencyMs: Number(trace.latencyMs || 0),
    model: emptyText(trace.model),
    tokenCount: Number(trace.tokenCount || 0),
    createdAt: emptyText(trace.createdAt),
  };
}

export function publicMessageReplyPayload(message = {}, record = {}) {
  if (!message) return pendingMessagePayload(record);
  return {
    messageId: emptyText(message.messageId || record.messageId),
    runId: emptyText(message.runId || record.runId || message.messageId || record.messageId),
    traceId: emptyText(message.messageTraceId || message.traceId || record.messageTraceId || record.traceId),
    providerKeyRef: emptyText(message.providerKeyRef || record.providerKeyRef),
    replyMessageId: emptyText(message.replyMessageId || record.replyMessageId),
    messageTraceId: emptyText(message.messageTraceId || record.messageTraceId || message.traceId || record.traceId),
    providerInvocationRef: emptyText(message.providerInvocationRef || record.providerInvocationRef),
    capabilitySource: emptyText(message.capabilitySource || record.capabilitySource),
    providerModelRef: emptyText(message.providerModelRef || record.providerModelRef || message.model || record.model),
    providerAuthorizationStatus: emptyText(message.providerAuthorizationStatus || record.providerAuthorizationStatus),
    status: emptyText(message.status || record.status || "succeeded"),
    reply: emptyText(message.reply),
    replyMetadata: message.replyMetadata || null,
    source: emptyText(message.source || "opl_runtime"),
    model: emptyText(message.model || record.model),
    tokenCount: Number(message.tokenCount || record.tokenCount || 0),
    createdAt: emptyText(message.createdAt || record.createdAt),
  };
}

export function publicCompletedMessagePayload(messageResult = {}, record = {}, state = {}, runtimeSession = {}) {
  return {
    message: publicMessageReplyPayload(messageResult.message, record),
    artifact: publicMessageArtifactFor(state, record, runtimeSession),
    trace: publicTracePayload(messageResult.trace),
  };
}

export function timingPayload(record = {}) {
  const acceptedAt = emptyText(record.acceptedAt || record.createdAt);
  const workerStartedAt = emptyText(record.workerStartedAt || acceptedAt);
  const acpStartedAt = emptyText(record.acpStartedAt || workerStartedAt);
  const acpEndedAt = emptyText(record.acpEndedAt || record.finishedAt || acpStartedAt);
  const persistedAt = emptyText(record.persistedAt || record.finishedAt || acpEndedAt);
  const tracePublishedAt = emptyText(record.tracePublishedAt || persistedAt);
  return {
    acceptedAt,
    workerStartedAt,
    acpStartedAt,
    acpEndedAt,
    persistedAt,
    tracePublishedAt,
    queueLatencyMs: msBetween(acceptedAt, workerStartedAt),
    acpLatencyMs: msBetween(acpStartedAt, acpEndedAt),
    persistLatencyMs: msBetween(acpEndedAt, persistedAt),
    totalLatencyMs: msBetween(acceptedAt, tracePublishedAt),
  };
}

function messageTimingFields(message = {}, acceptedAt = "", workerStartedAt = "") {
  const timing = message.timing || {};
  return {
    acpStartedAt: timing.acpStartedAt || "",
    acpEndedAt: timing.acpEndedAt || "",
    persistedAt: timing.persistedAt || "",
    tracePublishedAt: timing.tracePublishedAt || "",
    workerStartedAt,
    acceptedAt,
  };
}

export function completedMessageExtra({ input = {}, runtimeSession = {}, message = {}, acceptedAt = "", workerStartedAt = "" } = {}) {
  return {
    model: input.model || runtimeSession.model || "opl-runtime",
    tokenCount: Number(input.tokenCount || input.token_count || 0),
    reply: message.message?.reply || "",
    replyMessageId: message.message?.replyMessageId || "",
    messageTraceId: message.message?.messageTraceId || message.trace?.traceId || "",
    providerInvocationRef: message.message?.providerInvocationRef || message.trace?.providerInvocationRef || "",
    capabilitySource: message.message?.capabilitySource || message.trace?.capabilitySource || "",
    artifactId: message.artifact?.artifactId || "",
    artifactName: message.artifact?.name || "",
    ...messageTimingFields(message, acceptedAt, workerStartedAt),
    finishedAt: new Date().toISOString(),
  };
}

export function failedMessageExtra(error, acceptedAt = "", workerStartedAt = "") {
  return {
    error: String(error.message || error),
    errorCode: error?.code || "",
    capability: error?.capability || "",
    workerStartedAt,
    acceptedAt,
    finishedAt: new Date().toISOString(),
  };
}

export function messageStatusPayload(record = {}, state = {}) {
  const message = messageReplyFor(state, record.messageId);
  return {
    ok: true,
    status: statusForMessageRecord(record, message),
    traceId: emptyText(record.traceId),
    message: message ? publicMessageReplyPayload(message, record) : pendingMessagePayload(record),
    artifact: publicMessageArtifactFor(state, record),
    timing: timingPayload(record),
    error: emptyText(record.error),
  };
}
