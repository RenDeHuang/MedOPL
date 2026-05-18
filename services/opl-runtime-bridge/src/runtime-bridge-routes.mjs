import { createHash, randomUUID } from "node:crypto";
import { createLangfusePublisher } from "./langfuse-publisher.mjs";
import {
  addArtifactRecord,
  addEvent,
  addTraceRecord,
  createRunRecord,
  ensureRuntime,
  readState,
  upsertMessageRequestRecord,
  updateState,
} from "./state-store.mjs";
import { createLaunchApi } from "./runtime-bridge-launch.mjs";
import { createLocalFakeRuntimeAgentRelay } from "./local-fake-runtime-agent-relay.mjs";
import { createMessageApi } from "./runtime-bridge-messages.mjs";
import { createRuntimeAgentHttpRelay } from "./runtime-agent-http-relay.mjs";
import { createRunApi, publicRunArtifact } from "./runtime-bridge-runs.mjs";
import { mapRunError } from "./run-error-mapper.mjs";

function stringEnv(name, fallback = "") {
  return String(process.env[name] ?? fallback);
}

function cleanEnv(name, fallback = "") {
  return stringEnv(name, fallback).trim() || fallback;
}

function urlEnv(name, fallback = "") {
  return stringEnv(name, fallback).replace(/\/$/, "");
}

function isWebuiRuntimeMode(value = process.env.OPL_RUNTIME_MODE) {
  return String(value || "").trim().toLowerCase() === "webui";
}

function readConfig() {
  const port = Number(cleanEnv("PORT", "8788"));
  const webuiMode = isWebuiRuntimeMode(cleanEnv("OPL_RUNTIME_MODE", "unknown"));
  return {
    port,
    baseUrl: urlEnv("PORTAL_RUNTIME_BRIDGE_PUBLIC_URL", `http://127.0.0.1:${port}`),
    launchSecret: cleanEnv("OPL_LAUNCH_SECRET", "dev-opl-launch-secret-change-me"),
    runnerImage: cleanEnv("MED_AUTOSCIENCE_RUNNER_IMAGE"),
    k8sNamespace: cleanEnv("K8S_NAMESPACE", "med-agent-demo"),
    nodeEnv: cleanEnv("NODE_ENV", "development").toLowerCase(),
    buildSha: cleanEnv("BUILD_SHA", "dev"),
    buildTime: cleanEnv("BUILD_TIME", "unknown"),
    runtimeMode: cleanEnv("OPL_RUNTIME_MODE", "unknown"),
    webuiProviderMessageEnabled: webuiMode && cleanEnv("OPL_WEBUI_PROVIDER_MESSAGE_ENABLED") === "1",
    oplWebUrl: urlEnv("OPL_WEB_URL"),
    runnerUrl: urlEnv("MED_AUTOSCIENCE_RUNNER_URL"),
    portalInternalBaseUrl: urlEnv("PORTAL_INTERNAL_BASE_URL"),
    portalInternalAuthToken: cleanEnv("PORTAL_INTERNAL_AUTH_TOKEN"),
    localFakeRuntimeRelay: cleanEnv("OPL_RUNTIME_BRIDGE_LOCAL_FAKE_RUNTIME") === "1",
    runtimeAgentRelayMode: cleanEnv("OPL_RUNTIME_AGENT_RELAY_MODE"),
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function buildLaunchCookie(launchToken = "") {
  return `opl_portal_launch=${encodeURIComponent(String(launchToken || ""))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`;
}

function sendRetired(res, message, replacement = "") {
  sendJson(res, 410, {
    ok: false,
    error: "legacy_endpoint_retired",
    message,
    replacement,
  });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function launchTokenHash(token = "") {
  return createHash("sha256").update(String(token || "")).digest("hex").slice(0, 32);
}

function messageIdFromInput(input = {}) {
  return input.messageId || input.message_id || input.runId || input.run_id || randomUUID();
}

function runIdFromInput(input = {}) {
  return input.runId || input.run_id || randomUUID();
}

function messagePromptPreview(input = {}) {
  const source = String(input.message || input.text || input.prompt || input.input?.message || "");
  if (!source) return "";
  const digest = createHash("sha256").update(source).digest("hex").slice(0, 16);
  return `len:${source.length};sha256:${digest}`;
}

function waitForMessageCompletion(input = {}) {
  return input.waitForCompletion === true || input.wait_for_completion === true;
}

function msBetween(start = "", end = "") {
  const started = Date.parse(start || 0);
  const ended = Date.parse(end || 0);
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return 0;
  return Math.max(0, ended - started);
}

function messageRequestRecord({ runtimeSession, input, messageId, tokenHash, status, req, extra = {} }) {
  return {
    ...runtimeSession,
    ...input,
    messageId,
    runId: messageId,
    launchTokenHash: tokenHash,
    promptPreview: messagePromptPreview(input),
    status,
    userAgent: req?.headers?.["user-agent"] || "",
    ...extra,
  };
}

function emptyText(value = "") {
  return String(value ?? "");
}

function publicMetadataRef(value = "") {
  const ref = emptyText(value).trim();
  if (!ref || ref.length > 128) return "";
  if (/[\\/]/.test(ref) || /^https?:/i.test(ref)) return "";
  return /^[a-zA-Z0-9._:-]+$/.test(ref) ? ref : "";
}

function runtimeRunMetadataRefs(run = {}) {
  return {
    billingMetadataRef: publicMetadataRef(run.billingMetadataRef || run.billing_metadata_ref),
    usageMetadataRef: publicMetadataRef(run.usageMetadataRef || run.usage_metadata_ref),
  };
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

function publicMessageReplyPayload(message = {}, record = {}) {
  if (!message) return pendingMessagePayload(record);
  return {
    messageId: emptyText(message.messageId || record.messageId),
    runId: emptyText(message.runId || record.runId || message.messageId || record.messageId),
    traceId: emptyText(message.messageTraceId || message.traceId || record.messageTraceId || record.traceId),
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

function publicCompletedMessagePayload(messageResult = {}, record = {}, state = {}, runtimeSession = {}) {
  return {
    message: publicMessageReplyPayload(messageResult.message, record),
    artifact: publicMessageArtifactFor(state, record, runtimeSession),
    trace: publicTracePayload(messageResult.trace),
  };
}

function timingPayload(record = {}) {
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

function completedMessageExtra({ input = {}, runtimeSession = {}, message = {}, acceptedAt = "", workerStartedAt = "" } = {}) {
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

function failedMessageExtra(error, acceptedAt = "", workerStartedAt = "") {
  return {
    error: String(error.message || error),
    errorCode: error?.code || "",
    capability: error?.capability || "",
    workerStartedAt,
    acceptedAt,
    finishedAt: new Date().toISOString(),
  };
}

function upsertRuntimeMessage(state, { runtimeSession, input, messageId, tokenHash, status, req, extra = {} }) {
  return upsertMessageRequestRecord(state, messageRequestRecord({
    runtimeSession,
    input,
    messageId,
    tokenHash,
    status,
    req,
    extra,
  }));
}

function messageRecordInState(state = {}, { messageId = "", runtimeSessionId = "", tokenHash = "" } = {}) {
  return (state.messageRequests || []).find((item) =>
    messageRecordMatchesLaunch(item, { messageId, runtimeSessionId, tokenHash })
  );
}

function authorizationBearerFrom(req = null) {
  const authorization = String(req?.headers?.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function launchTokenFrom(input = {}, url, req = null) {
  return authorizationBearerFrom(req);
}

function runtimeBridgeContractMetadata() {
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

function publicRuntimeSession(runtimeSession = {}) {
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

function runtimeBridgeBootstrapPayload(bootstrap = {}) {
  return {
    ...runtimeBridgeContractMetadata(),
    ...bootstrap,
  };
}

function messageStatusLookup({ state, tokenHash, match, launch }) {
  const messageId = decodeURIComponent(match[1]);
  return messageRecordInState(state, {
    messageId,
    runtimeSessionId: launch.runtimeSessionId,
    tokenHash,
  });
}

function runtimeSessionByLaunch(state = {}, launch = {}) {
  return (state.runtimeSessions || []).find((item) => item.runtimeSessionId === launch.runtimeSessionId) || null;
}

function messageStatusPayload(record = {}, state = {}) {
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

function statusUrlForMessage({ messageId }) {
  return `/runtime-bridge/api/opl/messages/${encodeURIComponent(messageId)}/status`;
}

function mergeUniqueBy(target = [], source = [], keyFn) {
  const merged = [...target];
  const seen = new Set(merged.map(keyFn).filter(Boolean));
  for (const item of source || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    merged.push(item);
    seen.add(key);
  }
  return merged;
}

function traceLinkMergeKey(item = {}) {
  return [
    item.traceId || "",
    item.runId || "",
    item.traceName || "",
    item.status || "",
  ].join(":");
}

function artifactMergeKey(item = {}) {
  return item.artifactId || [
    item.runId,
    item.kind,
    item.name,
    item.localPath,
  ].join(":");
}

function recentMessageEvents(sourceState = {}, acceptedAt = "") {
  const acceptedTime = Date.parse(acceptedAt || 0);
  return (sourceState.events || []).filter((event) =>
    Date.parse(event.occurredAt || event.createdAt || 0) >= acceptedTime
  );
}

function mergeMessageSideEffects(targetState, sourceState, acceptedAt) {
  const sourceEvents = recentMessageEvents(sourceState, acceptedAt);
  return {
    ...targetState,
    messageReplies: mergeUniqueBy(targetState.messageReplies, sourceState.messageReplies, (item) => item.messageId),
    artifacts: mergeUniqueBy(targetState.artifacts, sourceState.artifacts, artifactMergeKey),
    traceLinks: mergeUniqueBy(targetState.traceLinks, sourceState.traceLinks, traceLinkMergeKey),
    runActions: mergeUniqueBy(targetState.runActions, sourceState.runActions, (item) => item.actionId),
    events: mergeUniqueBy(targetState.events, sourceEvents, (item) => item.id),
  };
}

function messageRecordMatchesLaunch(record = {}, { messageId = "", runtimeSessionId = "", tokenHash = "" } = {}) {
  return record.messageId === messageId &&
    record.runtimeSessionId === runtimeSessionId &&
    record.launchTokenHash === tokenHash;
}

function runnerFailureEvent(runtimeSession = {}, mapped = {}) {
  return {
    ...runtimeSession,
    correlationId: mapped.correlationId,
    code: mapped.code,
    stage: mapped.stage,
    retryable: mapped.retryable,
    error: mapped.message,
    details: mapped.details,
  };
}

function runtimeAgentRequiredByContract(error) {
  return [
    "RUNTIME_AGENT_RELAY_NOT_IMPLEMENTED",
    "PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED",
  ].includes(String(error?.code || ""));
}

function publicGatedRun(run = {}) {
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

function runStatusUrlFor(runId = "") {
  return `/api/opl/runs/${encodeURIComponent(String(runId || ""))}/status`;
}

function fileGatePayload({ runtimeSession = {}, input = {}, relativePath = "" } = {}) {
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

function artifactGatePayload({ runId = "", artifactRef = "" } = {}) {
  return {
    ok: false,
    error: "artifact_not_observed",
    gate: "output_file_ref_not_observed",
    status: "gated",
    runId: emptyText(runId),
    artifactRef: emptyText(artifactRef),
  };
}

function createConfiguredRuntimeAgentRelay(config = {}) {
  if (config.localFakeRuntimeRelay) return createLocalFakeRuntimeAgentRelay();
  if (config.runtimeAgentRelayMode === "http") return createRuntimeAgentHttpRelay();
  return null;
}

function runtimeAgentRelaySupportsFile(relay = null) {
  return Boolean(relay && typeof relay.relayFile === "function");
}

function isCapabilityNotSupported(error) {
  return error?.code === "capability_not_supported";
}

function capabilityNotSupportedPayload(error, capabilityFallback = "") {
  return {
    ok: false,
    error: "capability_not_supported",
    capability: error?.capability || capabilityFallback,
    message: String(error?.message || "OPL capability is not supported by the current upstream mapping."),
  };
}

export function createRuntimeBridgeRuntime() {
  const config = readConfig();
  const langfusePublisher = createLangfusePublisher();
  const runtimeAgentRelay = createConfiguredRuntimeAgentRelay(config);

  async function publishTraceEvent(state, event = {}) {
    const trace = addTraceRecord(state, {
      ...event,
      traceName: event.traceName || event.eventType || event.type || "opl-session",
      status: event.status || "recorded",
    });
    try {
      const published = await langfusePublisher.publishTraceEvent({ ...trace, ...event });
      addEvent(state, published.ok ? "trace_event_published" : "trace_event_publish_skipped", {
        ...trace,
        status: published.ok ? "published" : "skipped",
        reason: published.reason || published.error || "",
      });
    } catch (error) {
      addEvent(state, "trace_event_publish_failed", {
        ...trace,
        error: String(error.message || error),
      });
    }
    return trace;
  }

  const launchApi = createLaunchApi({
    ...config,
    langfusePublisher,
    publishTraceEvent,
  });
  const runApi = createRunApi({
    portalInternalBaseUrl: config.portalInternalBaseUrl,
    portalInternalAuthToken: config.portalInternalAuthToken,
    runnerImage: config.runnerImage,
    k8sNamespace: config.k8sNamespace,
    publishTraceEvent,
    runtimeAgentRelay,
  });
  const messageApi = createMessageApi({
    publishTraceEvent,
  });

  async function readLaunchRuntimeSession(input, url, req, res) {
    const launch = launchApi.verifyLaunchToken(launchTokenFrom(input, url, req));
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return null;
    }
    const state = await readState();
    const runtimeSession = runtimeSessionByLaunch(state, launch);
    if (!runtimeSession) {
      sendJson(res, 404, { ok: false, error: "runtime_session_not_found" });
      return null;
    }
    return { launch, state, runtimeSession };
  }

  async function readLaunchForRequest(req, url, res) {
    const launchToken = launchTokenFrom({}, url, req);
    const launch = launchApi.verifyLaunchToken(launchToken);
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return null;
    }
    const state = await readState();
    return { launch, launchToken, state };
  }

  function runBelongsToLaunch(run = {}, launch = {}) {
    return run.runtimeSessionId === launch.runtimeSessionId &&
      run.workspaceSessionId === launch.workspaceSessionId &&
      run.workspaceId === launch.workspaceId;
  }

  function artifactBelongsToLaunch(artifact = {}, launch = {}) {
    return artifact.runtimeSessionId === launch.runtimeSessionId &&
      artifact.workspaceSessionId === launch.workspaceSessionId &&
      artifact.workspaceId === launch.workspaceId;
  }

  async function completeMessageInBackground(messageId, runtimeSession, input, req, acceptedAt) {
    try {
      const workerStartedAt = new Date().toISOString();
      const runningState = await updateState((state) => state);
      const message = await messageApi.submitMessage(runningState, runtimeSession, input, req);
      await updateState((currentState) => {
        const completedState = mergeMessageSideEffects(currentState, runningState, acceptedAt);
        upsertRuntimeMessage(completedState, {
          runtimeSession,
          input,
          messageId,
          tokenHash: input.launchTokenHash,
          status: "succeeded",
          req,
          extra: completedMessageExtra({ input, runtimeSession, message, acceptedAt, workerStartedAt }),
        });
        return completedState;
      });
    } catch (error) {
      await updateState((failedState) => {
        upsertRuntimeMessage(failedState, {
          runtimeSession,
          input,
          messageId,
          tokenHash: input.launchTokenHash,
          status: "failed",
          req,
          extra: failedMessageExtra(error, acceptedAt, new Date().toISOString()),
        });
        addEvent(failedState, "opl_message_reply_failed", { ...runtimeSession, messageId, error: String(error.message || error) });
      });
    }
  }

  async function runMessageToCompletion({ runtimeSession, input, req, messageId, tokenHash, res }) {
    if (process.env.OPL_RUNTIME_MODE === "webui" && config.webuiProviderMessageEnabled !== true) {
      sendJson(res, 409, {
        ok: false,
        error: "provider_authorization_required",
        status: "gated",
        providerKeyRef: runtimeSession.providerKeyRef || "",
        capability: "webui_provider_message",
        message: "Real OPL WebUI provider message canary requires explicit OPL_WEBUI_PROVIDER_MESSAGE_ENABLED=1.",
      });
      return;
    }
    const acceptedAt = new Date().toISOString();
    const workerStartedAt = acceptedAt;
    let status = 200;
    let payload = null;
    await updateState(async (state) => {
      const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
      upsertRuntimeMessage(state, {
        runtimeSession: activeRuntimeSession,
        input,
        messageId,
        tokenHash,
        status: "running",
        req,
        extra: { acceptedAt, workerStartedAt },
      });
      try {
        const message = await messageApi.submitMessage(state, activeRuntimeSession, input, req);
        upsertRuntimeMessage(state, {
          runtimeSession: activeRuntimeSession,
          input,
          messageId,
          tokenHash,
          status: "succeeded",
          req,
          extra: completedMessageExtra({ input, runtimeSession: activeRuntimeSession, message, acceptedAt, workerStartedAt }),
        });
        const record = messageRecordInState(state, { messageId, runtimeSessionId: activeRuntimeSession.runtimeSessionId, tokenHash });
        payload = {
          ok: true,
          ...publicCompletedMessagePayload(message, record || {}, state, activeRuntimeSession),
          traceId: input.traceId || activeRuntimeSession.traceId || "",
          timing: timingPayload(record || {}),
        };
      } catch (error) {
        status = isCapabilityNotSupported(error) ? 409 : 502;
        upsertRuntimeMessage(state, {
          runtimeSession: activeRuntimeSession,
          input,
          messageId,
          tokenHash,
          status: "failed",
          req,
          extra: failedMessageExtra(error, acceptedAt, workerStartedAt),
        });
        addEvent(state, "opl_message_reply_failed", { ...activeRuntimeSession, messageId, error: String(error.message || error) });
        payload = isCapabilityNotSupported(error)
          ? capabilityNotSupportedPayload(error, "message")
          : { ok: false, error: String(error.message || error) };
      }
    });
    sendJson(res, status, payload);
  }

  async function acceptMessageForBackground({ runtimeSession, input, req, messageId, tokenHash, launchToken, acceptedAt, res }) {
    let record = null;
    await updateState((state) => {
      const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
      record = upsertRuntimeMessage(state, {
        runtimeSession: activeRuntimeSession,
        input,
        messageId,
        tokenHash,
        status: "running",
        req,
        extra: { acceptedAt },
      });
    });
    setImmediate(() => completeMessageInBackground(messageId, runtimeSession, input, req, acceptedAt));
    sendJson(res, 202, {
      ok: true,
      status: "accepted",
      message: {
        messageId,
        runId: messageId,
        traceId: input.traceId || runtimeSession.traceId || "",
        status: record.status,
        acceptedAt,
      },
      statusUrl: statusUrlForMessage({ messageId }),
    });
  }

  async function dispatchMessageRequest({ state, runtimeSession, input, req, messageId, tokenHash, launchToken, acceptedAt, res }) {
    if (waitForMessageCompletion(input)) {
      await runMessageToCompletion({ runtimeSession, input, req, messageId, tokenHash, res });
      return;
    }
    await acceptMessageForBackground({ runtimeSession, input, req, messageId, tokenHash, launchToken, acceptedAt, res });
  }

  async function handleHealth(_req, res) {
    sendJson(res, 200, {
      ...launchApi.buildStatusPayload(),
      ...runtimeBridgeContractMetadata(),
    });
  }

  async function handleRuntimeBridgeStatus(_req, res) {
    sendJson(res, 200, {
      ok: true,
      service: "opl-runtime-bridge",
      ...runtimeBridgeContractMetadata(),
    });
  }

  async function handleWorkbenchRetired(_req, res) {
    sendRetired(res, "旧 /workbench dev projection 已退场；请打开 OPL_WEB_URL，并由 OPL Web 使用 launch token 拉 bootstrap。", "OPL_WEB_URL");
  }

  async function handleLegacyLaunchTokensRetired(_req, res) {
    sendRetired(res, "旧 /api/launch-tokens 已退场；Portal 现在通过 /api/opl-launch/tokens 签发 OPL Web launch。", "/api/opl-launch/tokens");
  }

  async function handleIssueLaunchToken(req, res) {
    const payload = await launchApi.issueLaunchToken(await readBody(req));
    if (payload.launchToken) {
      res.setHeader("set-cookie", buildLaunchCookie(payload.launchToken));
    }
    sendJson(res, 200, payload);
  }

  async function handleWorkbenchBootstrapRetired(_req, res) {
    sendRetired(res, "旧 /api/workbench/bootstrap 已退场；OPL Web 必须使用 /api/opl-launch/bootstrap。", "/api/opl-launch/bootstrap");
  }

  async function handleBootstrap(req, res, url) {
    const launch = launchApi.verifyLaunchToken(launchTokenFrom({}, url, req));
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    let bootstrap = null;
    await updateState(async (state) => {
      bootstrap = await launchApi.buildBootstrap(state, launch);
    });
    sendJson(res, 200, runtimeBridgeBootstrapPayload(bootstrap));
  }

  async function handleRuntimeRunInput(input, req, res, url, { successStatus = 200 } = {}) {
    const resolved = await readLaunchRuntimeSession(input, url, req, res);
    if (!resolved) return;
    const { runtimeSession } = resolved;
    let status = successStatus;
    let payload = null;
    await updateState(async (state) => {
      const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
      try {
        const run = await runApi.submitRuntimeRun(state, activeRuntimeSession, input, req);
        await publishTraceEvent(state, {
          ...activeRuntimeSession,
          runId: run.runId,
          traceId: run.traceId,
          ...runtimeRunMetadataRefs(run),
          artifactRefs: (run.artifacts || []).map((artifact) => artifact.artifactRef).filter(Boolean),
          eventType: "runtime_run",
          traceName: "OPL runtime run",
          status: run.status || "recorded",
          model: input.model || activeRuntimeSession.model || "opl-runtime",
          tokenCount: Number(input.tokenCount || input.token_count || 0),
          userAgent: req?.headers?.["user-agent"] || "",
        });
        payload = { ok: true, run, artifacts: run.artifacts || [] };
      } catch (error) {
        if (isWebuiRuntimeMode(config.runtimeMode) && runtimeAgentRequiredByContract(error)) {
          const run = createRunRecord(state, {
            ...activeRuntimeSession,
            ...input,
            runId: input.runId || input.run_id || runIdFromInput(input),
            traceId: input.traceId || input.trace_id || activeRuntimeSession.traceId || "",
            status: "gated",
            error: "requires_runtime_agent",
            kind: input.kind || "opl-runtime",
            toolName: input.toolName || input.tool_name || "opl-runtime",
            resourceBindingId: activeRuntimeSession.resourceBindingId || input.resourceBindingId || input.resource_binding_id || "",
            providerKeyRef: activeRuntimeSession.providerKeyRef || input.providerKeyRef || input.provider_key_ref || "",
          });
          addEvent(state, "downstream_runtime_gate_evaluated", {
            ...activeRuntimeSession,
            runId: run.runId,
            traceId: run.traceId,
            status: "gated",
            error: "requires_runtime_agent",
            gate: "run_not_observed",
            code: error.code || "",
          });
          status = 409;
          payload = {
            ok: false,
            error: "requires_runtime_agent",
            gate: "run_not_observed",
            status: "gated",
            run: publicGatedRun(run),
            statusUrl: runStatusUrlFor(run.runId),
          };
          return;
        }
        status = 502;
        const mapped = mapRunError(error, { correlationId: input?.correlationId || input?.correlation_id || "" });
        addEvent(state, "runner_run_failed", runnerFailureEvent(activeRuntimeSession, mapped));
        payload = { ok: false, error: mapped };
      }
    });
    sendJson(res, status, payload);
  }

  async function handleRuntimeRun(req, res, url) {
    await handleRuntimeRunInput(await readBody(req), req, res, url);
  }

  async function handleRuntimeBridgeFile(req, res, url) {
    const input = await readBody(req);
    const resolved = await readLaunchRuntimeSession(input, url, req, res);
    if (!resolved) return;
    const { runtimeSession } = resolved;
    const relativePath = String(input.relativePath || input.relative_path || input.fileName || input.file_name || input.name || "").trim().replace(/^\/+/, "");
    if (!relativePath) {
      sendJson(res, 422, { ok: false, error: "file_name_required" });
      return;
    }
    let artifact = null;
    let publicArtifact = null;
    if (isWebuiRuntimeMode(config.runtimeMode)) {
      let payload = null;
      await updateState((state) => {
        const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
        addEvent(state, "opl_file_gate_evaluated", {
          ...activeRuntimeSession,
          error: "file_upload_capability_not_supported",
          gate: "file_ref_not_observed",
          capability: "file_upload",
          source: "webui_bridge",
          fileName: input.name || input.fileName || input.file_name || relativePath.split("/").pop() || "",
          sizeBytes: Number(input.sizeBytes ?? input.size_bytes ?? 0),
          contentType: String(input.contentType || input.content_type || "application/octet-stream").trim() || "application/octet-stream",
        });
        payload = fileGatePayload({ runtimeSession: activeRuntimeSession, input, relativePath });
      });
      sendJson(res, 409, payload);
      return;
    }
    if (runtimeAgentRelaySupportsFile(runtimeAgentRelay) && (runtimeSession.runtimeAgentEndpoint || input.runtimeAgentEndpoint || input.runtime_agent_endpoint)) {
      let payload = null;
      await updateState(async (state) => {
        const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
        const relayedFile = await runtimeAgentRelay.relayFile({
          runtimeSession: activeRuntimeSession,
          input: {
            ...input,
            relativePath,
          },
          req,
        });
        artifact = addArtifactRecord(state, {
          ...activeRuntimeSession,
          ...relayedFile,
          artifactId: relayedFile.fileRef || relayedFile.artifactRef,
          runId: String(input.runId || input.run_id || activeRuntimeSession.oplSessionId || activeRuntimeSession.runtimeSessionId || "").trim(),
          kind: relayedFile.kind || "inputs",
          resourceBindingId: activeRuntimeSession.resourceBindingId || input.resourceBindingId || input.resource_binding_id || "",
          providerKeyRef: activeRuntimeSession.providerKeyRef || input.providerKeyRef || input.provider_key_ref || "",
        });
        addEvent(state, "runtime_agent_file_referenced", {
          ...activeRuntimeSession,
          artifactId: artifact.artifactId,
          fileRef: artifact.artifactId,
          kind: artifact.kind,
        });
        publicArtifact = {
          ...publicRunArtifact(artifact, {
            runId: artifact.runId,
            workspaceId: activeRuntimeSession.workspaceId,
            resourceBindingId: activeRuntimeSession.resourceBindingId,
            providerKeyRef: activeRuntimeSession.providerKeyRef,
          }, activeRuntimeSession),
          fileRef: artifact.artifactId,
          workspaceSessionId: activeRuntimeSession.workspaceSessionId || "",
          runtimeSessionId: activeRuntimeSession.runtimeSessionId || "",
          status: relayedFile.status || "ready",
          source: relayedFile.source || "runtime_agent_http",
        };
        payload = {
          ok: true,
          fileRef: publicArtifact.fileRef,
          file: publicArtifact,
        };
      });
      sendJson(res, 201, payload);
      return;
    }
    await updateState((state) => {
      const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
      artifact = addArtifactRecord(state, {
        ...activeRuntimeSession,
        runId: String(input.runId || input.run_id || input.sessionId || activeRuntimeSession.oplSessionId || activeRuntimeSession.runtimeSessionId || "").trim(),
        kind: String(input.kind || "inputs").trim() || "inputs",
        name: String(input.name || input.fileName || input.file_name || relativePath.split("/").pop() || "").trim(),
        relativePath,
        sizeBytes: Number(input.sizeBytes ?? input.size_bytes ?? 0),
        contentType: String(input.contentType || input.content_type || "application/octet-stream").trim() || "application/octet-stream",
      });
      addEvent(state, "opl_file_referenced", {
        ...activeRuntimeSession,
        artifactId: artifact.artifactId,
        kind: artifact.kind,
      });
      publicArtifact = publicRunArtifact(artifact, {
        runId: artifact.runId,
        workspaceId: activeRuntimeSession.workspaceId,
        resourceBindingId: activeRuntimeSession.resourceBindingId,
        providerKeyRef: activeRuntimeSession.providerKeyRef,
      }, activeRuntimeSession);
    });
    sendJson(res, 201, {
      ok: true,
      fileRef: publicArtifact.artifactRef,
      file: publicArtifact,
    });
  }

  async function handleRuntimeBridgeRun(req, res, url) {
    const input = await readBody(req);
    Object.assign(input, {
      mode: input.mode || "full_runtime",
      runId: runIdFromInput(input),
      traceId: input.traceId || input.trace_id || `trace-${randomUUID()}`,
    });
    await handleRuntimeRunInput(input, req, res, url, { successStatus: 201 });
  }

  async function handleMessage(req, res, url) {
    const input = await readBody(req);
    const resolved = await readLaunchRuntimeSession(input, url, req, res);
    if (!resolved) return;
    const { launch, state, runtimeSession } = resolved;
    const messageId = messageIdFromInput(input);
    const launchToken = launchTokenFrom(input, url, req);
    const tokenHash = launchTokenHash(launchToken);
    const acceptedAt = new Date().toISOString();
    Object.assign(input, {
      messageId,
      runId: messageId,
      traceId: input.traceId || input.trace_id || launch.traceId || runtimeSession.traceId || "",
      launchTokenHash: tokenHash,
    });
    await dispatchMessageRequest({ state, runtimeSession, input, req, messageId, tokenHash, launchToken, acceptedAt, res });
  }

  async function handleMessageStatus(req, res, url, match) {
    const launchToken = launchTokenFrom({}, url, req);
    const launch = launchApi.verifyLaunchToken(launchToken);
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    const state = await readState();
    const record = messageStatusLookup({ state, tokenHash: launchTokenHash(launchToken), match, launch });
    if (!record) {
      sendJson(res, 404, { ok: false, error: "message_not_found" });
      return;
    }
    sendJson(res, 200, messageStatusPayload(record, state));
  }

  async function handleBindSession(req, res, url) {
    const input = await readBody(req);
    const launch = launchApi.verifyLaunchToken(launchTokenFrom(input, url, req));
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    let runtimeSession = null;
    await updateState(async (state) => {
      runtimeSession = await launchApi.bindOplSession(state, launch, input);
    });
    if (!runtimeSession) {
      sendJson(res, 404, { ok: false, error: "runtime_session_not_found" });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      runtimeSession: publicRuntimeSession(runtimeSession),
    });
  }

  async function handleRuntimeSessionsRetired(_req, res) {
    sendRetired(res, "旧 /api/runtime-sessions 已退场；runtime/session 由 OPL Web 与 OPL runtime 管理，Portal 只通过 launch/bootstrap 绑定。", "/api/opl-launch/sessions/bind");
  }

  async function handleRuntimeSessionRunsRetired(_req, res) {
    sendRetired(res, "旧 /api/runtime-sessions/:id/runs 已退场；run 必须由 OPL Web 携带 launch token 调 /api/opl-launch/runs。", "/api/opl-launch/runs");
  }

  async function handleRunStatus(req, res, url, match) {
    const resolved = await readLaunchForRequest(req, url, res);
    if (!resolved) return;
    const { launch } = resolved;
    let status = 200;
    let payload = null;
    await updateState(async (state) => {
      const run = state.runs.find((item) => item.runId === match[1]);
      if (!run || !runBelongsToLaunch(run, launch)) {
        status = 404;
        payload = { ok: false, error: "run_not_found" };
        return;
      }
      const synced = await runApi.syncRunnerRun(state, run);
      payload = { ok: true, run: synced || run };
    });
    sendJson(res, status, payload);
  }

  async function handleRunArtifacts(req, res, url, match) {
    const resolved = await readLaunchForRequest(req, url, res);
    if (!resolved) return;
    const { launch } = resolved;
    let status = 200;
    let payload = null;
    await updateState(async (state) => {
      const run = state.runs.find((item) => item.runId === match[1]);
      if (!run || !runBelongsToLaunch(run, launch)) {
        status = 404;
        payload = { ok: false, error: "run_not_found" };
        return;
      }
      await runApi.syncRunnerRun(state, run).catch((error) => {
        addEvent(state, "runner_artifact_sync_failed", { ...run, error: String(error.message || error) });
        return null;
      });
      const items = state.artifacts
        .filter((item) => item.runId === match[1])
        .map((item) => publicRunArtifact(item, run, state.runtimeSessions.find((session) => session.runtimeSessionId === run.runtimeSessionId) || {}));
      if (!items.length && isWebuiRuntimeMode(config.runtimeMode)) {
        addEvent(state, "artifact_output_gate_evaluated", {
          ...run,
          error: "artifact_not_observed",
          gate: "output_file_ref_not_observed",
        });
        status = 409;
        payload = artifactGatePayload({ runId: run.runId });
        return;
      }
      payload = {
        ok: true,
        items,
      };
    });
    sendJson(res, status, payload);
  }

  async function handleRuntimeBridgeArtifact(req, res, url, match) {
    const resolved = await readLaunchForRequest(req, url, res);
    if (!resolved) return;
    const { launch, state } = resolved;
    const artifactRef = decodeURIComponent(match[1] || "");
    const artifact = state.artifacts.find((item) => item.artifactId === artifactRef);
    if (!artifact || !artifactBelongsToLaunch(artifact, launch)) {
      sendJson(res, 404, isWebuiRuntimeMode(config.runtimeMode)
        ? artifactGatePayload({ artifactRef })
        : { ok: false, error: "artifact_not_found" });
      return;
    }
    const run = state.runs.find((item) => item.runId === artifact.runId) || {};
    const runtimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === artifact.runtimeSessionId) || {};
    sendJson(res, 200, {
      ok: true,
      artifact: publicRunArtifact(artifact, run, runtimeSession),
    });
  }

  async function handleRunsList(_req, res) {
    const state = await readState();
    sendJson(res, 200, {
      ok: true,
      items: state.runs.map((run) => ({
        ...run,
        artifacts: state.artifacts
          .filter((item) => item.runId === run.runId)
          .map((item) => publicRunArtifact(item, run, state.runtimeSessions.find((session) => session.runtimeSessionId === run.runtimeSessionId) || {})),
      })),
    });
  }

  async function handleArtifactsList(_req, res) {
    const state = await readState();
    sendJson(res, 200, {
      ok: true,
      items: state.artifacts.map((item) => {
        const run = state.runs.find((entry) => entry.runId === item.runId) || {};
        const runtimeSession = state.runtimeSessions.find((session) => session.runtimeSessionId === item.runtimeSessionId) || {};
        return publicRunArtifact(item, run, runtimeSession);
      }),
    });
  }

  async function handleTraceLinks(_req, res) {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.traceLinks, runActions: state.runActions });
  }

  async function handleTraceEvents(req, res) {
    const input = await readBody(req);
    let trace = null;
    await updateState(async (state) => {
      trace = await publishTraceEvent(state, {
        ...input,
        eventType: input.eventType || input.type || "runtime_event",
      });
    });
    sendJson(res, 200, { ok: true, trace });
  }

  async function handleCostRecords(_req, res) {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.costRecords });
  }

  const exactHandlers = new Map([
    ["GET /healthz", handleHealth],
    ["GET /status", handleHealth],
    ["GET /api/opl/status", handleRuntimeBridgeStatus],
    ["GET /workbench", handleWorkbenchRetired],
    ["POST /api/launch-tokens", handleLegacyLaunchTokensRetired],
    ["POST /api/opl-launch/tokens", handleIssueLaunchToken],
    ["GET /api/workbench/bootstrap", handleWorkbenchBootstrapRetired],
    ["GET /api/opl-launch/bootstrap", handleBootstrap],
    ["GET /api/opl/bootstrap", handleBootstrap],
    ["POST /api/opl-launch/runs", handleRuntimeRun],
    ["POST /api/opl/runs", handleRuntimeBridgeRun],
    ["POST /api/opl-launch/messages", handleMessage],
    ["POST /api/opl/messages", handleMessage],
    ["POST /api/opl/files", handleRuntimeBridgeFile],
    ["POST /api/opl-launch/sessions/bind", handleBindSession],
    ["POST /api/opl/sessions/bind", handleBindSession],
    ["POST /api/runtime-sessions", handleRuntimeSessionsRetired],
    ["GET /api/runs", handleRunsList],
    ["GET /api/artifacts", handleArtifactsList],
    ["GET /api/trace-links", handleTraceLinks],
    ["POST /internal/trace-events", handleTraceEvents],
    ["GET /api/cost-records", handleCostRecords],
  ]);

  const dynamicHandlers = [
    { method: "POST", pattern: /^\/api\/runtime-sessions\/([^/]+)\/runs$/, handler: handleRuntimeSessionRunsRetired },
    { method: "GET", pattern: /^\/api\/runs\/([^/]+)\/status$/, handler: handleRunStatus },
    { method: "GET", pattern: /^\/api\/opl-launch\/runs\/([^/]+)\/status$/, handler: handleRunStatus },
    { method: "GET", pattern: /^\/api\/opl\/runs\/([^/]+)\/status$/, handler: handleRunStatus },
    { method: "GET", pattern: /^\/api\/opl-launch\/runs\/([^/]+)\/artifacts$/, handler: handleRunArtifacts },
    { method: "GET", pattern: /^\/api\/opl\/runs\/([^/]+)\/artifacts$/, handler: handleRunArtifacts },
    { method: "GET", pattern: /^\/api\/opl\/artifacts\/([^/]+)$/, handler: handleRuntimeBridgeArtifact },
    { method: "GET", pattern: /^\/api\/opl-launch\/messages\/([^/]+)\/status$/, handler: handleMessageStatus },
    { method: "GET", pattern: /^\/api\/opl\/messages\/([^/]+)\/status$/, handler: handleMessageStatus },
    { method: "GET", pattern: /^\/runtime-bridge\/api\/opl\/messages\/([^/]+)\/status$/, handler: handleMessageStatus },
  ];

  function routeKey(req, url) {
    return `${req.method || ""} ${url.pathname}`;
  }

  function matchDynamicHandler(req, url) {
    for (const route of dynamicHandlers) {
      const match = route.method === req.method ? url.pathname.match(route.pattern) : null;
      if (match) return { ...route, match };
    }
    return null;
  }

  async function handleRequest(req, res) {
    const url = new URL(req.url || "/", config.baseUrl);
    const handler = exactHandlers.get(routeKey(req, url));
    if (handler) {
      await handler(req, res, url);
      return;
    }
    const dynamicHandler = matchDynamicHandler(req, url);
    if (dynamicHandler) {
      await dynamicHandler.handler(req, res, url, dynamicHandler.match);
      return;
    }
    sendJson(res, 404, { ok: false, error: "not_found", path: url.pathname });
  }

  return {
    config,
    buildStatusPayload: launchApi.buildStatusPayload,
    handleRequest,
    ensureRuntime,
  };
}
