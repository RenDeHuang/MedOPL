import { createHash, randomUUID } from "node:crypto";
import { createLangfusePublisher } from "./langfuse-publisher.mjs";
import {
  addEvent,
  addTraceRecord,
  ensureRuntime,
  readState,
  upsertMessageRequestRecord,
  writeState,
} from "./state-store.mjs";
import { createLaunchApi } from "./runtime-bridge-launch.mjs";
import { createMessageApi } from "./runtime-bridge-messages.mjs";
import { createRunApi } from "./runtime-bridge-runs.mjs";
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

function readConfig() {
  const port = Number(cleanEnv("PORT", "8788"));
  return {
    port,
    baseUrl: urlEnv("PORTAL_OPL_ADAPTER_PUBLIC_URL", `http://127.0.0.1:${port}`),
    launchSecret: cleanEnv("OPL_LAUNCH_SECRET", "dev-opl-launch-secret-change-me"),
    runnerImage: cleanEnv("MED_AUTOSCIENCE_RUNNER_IMAGE"),
    k8sNamespace: cleanEnv("K8S_NAMESPACE", "med-agent-demo"),
    nodeEnv: cleanEnv("NODE_ENV", "development").toLowerCase(),
    buildSha: cleanEnv("BUILD_SHA", "dev"),
    buildTime: cleanEnv("BUILD_TIME", "unknown"),
    runtimeMode: cleanEnv("OPL_RUNTIME_MODE", "unknown"),
    oplWebUrl: urlEnv("OPL_WEB_URL"),
    runnerUrl: urlEnv("MED_AUTOSCIENCE_RUNNER_URL"),
    portalInternalBaseUrl: urlEnv("PORTAL_INTERNAL_BASE_URL"),
    portalInternalAuthToken: cleanEnv("PORTAL_INTERNAL_AUTH_TOKEN"),
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
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

function messagePromptPreview(input = {}) {
  return String(input.message || input.text || input.prompt || input.input?.message || "").slice(0, 120);
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

function messageReplyFor(state = {}, messageId = "") {
  return (state.messageReplies || []).find((item) => item.messageId === messageId) || null;
}

function messageArtifactFor(state = {}, runId = "") {
  return (state.artifacts || []).find((item) => item.runId === runId && item.kind === "message_reply") || null;
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
    promptPreview: emptyText(record.promptPreview),
    createdAt: emptyText(record.createdAt),
    updatedAt: emptyText(record.updatedAt),
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
    artifactId: message.artifact?.artifactId || "",
    artifactName: message.artifact?.name || "",
    ...messageTimingFields(message, acceptedAt, workerStartedAt),
    finishedAt: new Date().toISOString(),
  };
}

function failedMessageExtra(error, acceptedAt = "", workerStartedAt = "") {
  return {
    error: String(error.message || error),
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

function launchTokenFrom(input = {}, url) {
  return input.launchToken || input.launch_token || url.searchParams.get("launch_token") || "";
}

function messageStatusLookup({ state, url, match, launch }) {
  const tokenHash = launchTokenHash(url.searchParams.get("launch_token") || "");
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
    message: message ? { ...message, traceId: message.traceId || record.traceId || "" } : pendingMessagePayload(record),
    artifact: messageArtifactFor(state, record.runId),
    timing: timingPayload(record),
    error: emptyText(record.error),
  };
}

function statusUrlForMessage({ baseUrl, messageId, launchToken }) {
  return `${baseUrl}/api/opl-launch/messages/${encodeURIComponent(messageId)}/status?launch_token=${encodeURIComponent(launchToken)}`;
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

export function createRuntimeBridgeRuntime() {
  const config = readConfig();
  const langfusePublisher = createLangfusePublisher();

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
  });
  const messageApi = createMessageApi({
    publishTraceEvent,
  });

  async function readLaunchRuntimeSession(input, url, res) {
    const launch = launchApi.verifyLaunchToken(launchTokenFrom(input, url));
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

  async function completeMessageInBackground(messageId, runtimeSession, input, req, acceptedAt) {
    try {
      const workerStartedAt = new Date().toISOString();
      const runningState = await readState();
      const message = await messageApi.submitMessage(runningState, runtimeSession, input, req);
      const currentState = await readState();
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
      await writeState(completedState);
    } catch (error) {
      const failedState = await readState();
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
      await writeState(failedState);
    }
  }

  async function runMessageToCompletion({ state, runtimeSession, input, req, messageId, tokenHash, res }) {
    const acceptedAt = new Date().toISOString();
    const workerStartedAt = acceptedAt;
    upsertRuntimeMessage(state, {
      runtimeSession,
      input,
      messageId,
      tokenHash,
      status: "running",
      req,
      extra: { acceptedAt, workerStartedAt },
    });
    try {
      const message = await messageApi.submitMessage(state, runtimeSession, input, req);
      upsertRuntimeMessage(state, {
        runtimeSession,
        input,
        messageId,
        tokenHash,
        status: "succeeded",
        req,
        extra: completedMessageExtra({ input, runtimeSession, message, acceptedAt, workerStartedAt }),
      });
      await writeState(state);
      const record = messageRecordInState(state, { messageId, runtimeSessionId: runtimeSession.runtimeSessionId, tokenHash });
      sendJson(res, 200, { ok: true, ...message, traceId: input.traceId || runtimeSession.traceId || "", timing: timingPayload(record || {}) });
    } catch (error) {
      upsertRuntimeMessage(state, {
        runtimeSession,
        input,
        messageId,
        tokenHash,
        status: "failed",
        req,
        extra: failedMessageExtra(error, acceptedAt, workerStartedAt),
      });
      addEvent(state, "opl_message_reply_failed", { ...runtimeSession, messageId, error: String(error.message || error) });
      await writeState(state);
      sendJson(res, 502, { ok: false, error: String(error.message || error) });
    }
  }

  async function acceptMessageForBackground({ state, runtimeSession, input, req, messageId, tokenHash, launchToken, acceptedAt, res }) {
    const record = upsertRuntimeMessage(state, {
      runtimeSession,
      input,
      messageId,
      tokenHash,
      status: "running",
      req,
      extra: { acceptedAt },
    });
    await writeState(state);
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
      statusUrl: statusUrlForMessage({ baseUrl: config.baseUrl, messageId, launchToken }),
    });
  }

  async function dispatchMessageRequest({ state, runtimeSession, input, req, messageId, tokenHash, launchToken, acceptedAt, res }) {
    if (waitForMessageCompletion(input)) {
      await runMessageToCompletion({ state, runtimeSession, input, req, messageId, tokenHash, res });
      return;
    }
    await acceptMessageForBackground({ state, runtimeSession, input, req, messageId, tokenHash, launchToken, acceptedAt, res });
  }

  async function handleHealth(_req, res) {
    sendJson(res, 200, launchApi.buildStatusPayload());
  }

  async function handleWorkbenchRetired(_req, res) {
    sendRetired(res, "adapter /workbench dev projection 已退场；请打开 OPL_WEB_URL，并由 OPL Web 使用 launch token 拉 bootstrap。", "OPL_WEB_URL");
  }

  async function handleLegacyLaunchTokensRetired(_req, res) {
    sendRetired(res, "旧 /api/launch-tokens 已退场；Portal 现在通过 /api/opl-launch/tokens 签发 OPL Web launch。", "/api/opl-launch/tokens");
  }

  async function handleIssueLaunchToken(req, res) {
    sendJson(res, 200, await launchApi.issueLaunchToken(await readBody(req)));
  }

  async function handleWorkbenchBootstrapRetired(_req, res) {
    sendRetired(res, "旧 /api/workbench/bootstrap 已退场；OPL Web 必须使用 /api/opl-launch/bootstrap。", "/api/opl-launch/bootstrap");
  }

  async function handleBootstrap(_req, res, url) {
    const launch = launchApi.verifyLaunchToken(url.searchParams.get("launch_token") || "");
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    const state = await readState();
    const bootstrap = await launchApi.buildBootstrap(state, launch);
    await writeState(state);
    sendJson(res, 200, bootstrap);
  }

  async function handleRuntimeRun(req, res, url) {
    const input = await readBody(req);
    const resolved = await readLaunchRuntimeSession(input, url, res);
    if (!resolved) return;
    const { state, runtimeSession } = resolved;
    try {
      const run = await runApi.submitRuntimeRun(state, runtimeSession, input, req);
      await writeState(state);
      sendJson(res, 200, { ok: true, run });
    } catch (error) {
      const mapped = mapRunError(error, { correlationId: input?.correlationId || input?.correlation_id || "" });
      addEvent(state, "runner_run_failed", runnerFailureEvent(runtimeSession, mapped));
      await writeState(state);
      sendJson(res, 502, { ok: false, error: mapped });
    }
  }

  async function handleMessage(req, res, url) {
    const input = await readBody(req);
    const resolved = await readLaunchRuntimeSession(input, url, res);
    if (!resolved) return;
    const { launch, state, runtimeSession } = resolved;
    const messageId = messageIdFromInput(input);
    const launchToken = launchTokenFrom(input, url);
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

  async function handleMessageStatus(_req, res, url, match) {
    const launch = launchApi.verifyLaunchToken(url.searchParams.get("launch_token") || "");
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    const state = await readState();
    const record = messageStatusLookup({ state, url, match, launch });
    if (!record) {
      sendJson(res, 404, { ok: false, error: "message_not_found" });
      return;
    }
    sendJson(res, 200, messageStatusPayload(record, state));
  }

  async function handleBindSession(req, res, url) {
    const input = await readBody(req);
    const launch = launchApi.verifyLaunchToken(launchTokenFrom(input, url));
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    const state = await readState();
    const runtimeSession = await launchApi.bindOplSession(state, launch, input);
    if (!runtimeSession) {
      sendJson(res, 404, { ok: false, error: "runtime_session_not_found" });
      return;
    }
    await writeState(state);
    sendJson(res, 200, { ok: true, runtimeSession });
  }

  async function handleRuntimeSessionsRetired(_req, res) {
    sendRetired(res, "旧 /api/runtime-sessions 已退场；runtime/session 由 OPL Web 与 OPL runtime 管理，Portal 只通过 launch/bootstrap 绑定。", "/api/opl-launch/sessions/bind");
  }

  async function handleRuntimeSessionRunsRetired(_req, res) {
    sendRetired(res, "旧 /api/runtime-sessions/:id/runs 已退场；run 必须由 OPL Web 携带 launch token 调 /api/opl-launch/runs。", "/api/opl-launch/runs");
  }

  async function handleRunStatus(_req, res, _url, match) {
    const state = await readState();
    const run = state.runs.find((item) => item.runId === match[1]);
    if (!run) {
      sendJson(res, 404, { ok: false, error: "run_not_found" });
      return;
    }
    const synced = await runApi.syncRunnerRun(state, run);
    await writeState(state);
    sendJson(res, 200, { ok: true, run: synced || run });
  }

  async function handleRunArtifacts(_req, res, _url, match) {
    const state = await readState();
    const run = state.runs.find((item) => item.runId === match[1]);
    if (!run) {
      sendJson(res, 404, { ok: false, error: "run_not_found" });
      return;
    }
    await runApi.syncRunnerRun(state, run).catch((error) => {
      addEvent(state, "runner_artifact_sync_failed", { ...run, error: String(error.message || error) });
      return null;
    });
    await writeState(state);
    sendJson(res, 200, { ok: true, items: state.artifacts.filter((item) => item.runId === match[1]) });
  }

  async function handleRunsList(_req, res) {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.runs });
  }

  async function handleArtifactsList(_req, res) {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.artifacts });
  }

  async function handleTraceLinks(_req, res) {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.traceLinks, runActions: state.runActions });
  }

  async function handleTraceEvents(req, res) {
    const input = await readBody(req);
    const state = await readState();
    const trace = await publishTraceEvent(state, {
      ...input,
      eventType: input.eventType || input.type || "runtime_event",
    });
    await writeState(state);
    sendJson(res, 200, { ok: true, trace });
  }

  async function handleCostRecords(_req, res) {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.costRecords });
  }

  const exactHandlers = new Map([
    ["GET /healthz", handleHealth],
    ["GET /status", handleHealth],
    ["GET /workbench", handleWorkbenchRetired],
    ["POST /api/launch-tokens", handleLegacyLaunchTokensRetired],
    ["POST /api/opl-launch/tokens", handleIssueLaunchToken],
    ["GET /api/workbench/bootstrap", handleWorkbenchBootstrapRetired],
    ["GET /api/opl-launch/bootstrap", handleBootstrap],
    ["POST /api/opl-launch/runs", handleRuntimeRun],
    ["POST /api/opl-launch/messages", handleMessage],
    ["POST /api/opl-launch/sessions/bind", handleBindSession],
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
    { method: "GET", pattern: /^\/api\/opl-launch\/runs\/([^/]+)\/artifacts$/, handler: handleRunArtifacts },
    { method: "GET", pattern: /^\/api\/opl-launch\/messages\/([^/]+)\/status$/, handler: handleMessageStatus },
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
