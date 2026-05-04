import { createLangfusePublisher } from "./langfuse-publisher.mjs";
import { addEvent, addTraceRecord, ensureRuntime, readState, writeState } from "./state-store.mjs";
import { createLaunchApi } from "./runtime-bridge-launch.mjs";
import { createMessageApi } from "./runtime-bridge-messages.mjs";
import { createRunApi } from "./runtime-bridge-runs.mjs";
import { mapRunError } from "./run-error-mapper.mjs";

function readConfig() {
  const port = Number(process.env.PORT || 8788);
  return {
    port,
    baseUrl: String(process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL || `http://127.0.0.1:${port}`).replace(/\/$/, ""),
    launchSecret: process.env.OPL_LAUNCH_SECRET || "dev-opl-launch-secret-change-me",
    runnerImage: process.env.MED_AUTOSCIENCE_RUNNER_IMAGE || "",
    k8sNamespace: process.env.K8S_NAMESPACE || "med-agent-demo",
    nodeEnv: String(process.env.NODE_ENV || "development").toLowerCase(),
    buildSha: String(process.env.BUILD_SHA || "dev").trim() || "dev",
    buildTime: String(process.env.BUILD_TIME || "unknown").trim() || "unknown",
    runtimeMode: String(process.env.OPL_RUNTIME_MODE || "unknown").trim() || "unknown",
    oplWebUrl: String(process.env.OPL_WEB_URL || "").replace(/\/$/, ""),
    runnerUrl: String(process.env.MED_AUTOSCIENCE_RUNNER_URL || "").replace(/\/$/, ""),
    portalInternalBaseUrl: String(process.env.PORTAL_INTERNAL_BASE_URL || "").replace(/\/$/, ""),
    portalInternalAuthToken: String(process.env.PORTAL_INTERNAL_AUTH_TOKEN || "").trim(),
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

  function launchTokenFrom(input = {}, url) {
    return input.launchToken || input.launch_token || url.searchParams.get("launch_token") || "";
  }

  function runtimeSessionByLaunch(state, launch) {
    return state.runtimeSessions.find((item) => item.runtimeSessionId === launch.runtimeSessionId) || null;
  }

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
      addEvent(state, "runner_run_failed", {
        ...runtimeSession,
        correlationId: mapped.correlationId,
        code: mapped.code,
        stage: mapped.stage,
        retryable: mapped.retryable,
        error: mapped.message,
        details: mapped.details,
      });
      await writeState(state);
      sendJson(res, 502, { ok: false, error: mapped });
    }
  }

  async function handleMessage(req, res, url) {
    const input = await readBody(req);
    const resolved = await readLaunchRuntimeSession(input, url, res);
    if (!resolved) return;
    const { state, runtimeSession } = resolved;
    try {
      const message = await messageApi.submitMessage(state, runtimeSession, input, req);
      await writeState(state);
      sendJson(res, 200, { ok: true, ...message });
    } catch (error) {
      addEvent(state, "opl_message_reply_failed", { ...runtimeSession, error: String(error.message || error) });
      await writeState(state);
      sendJson(res, 502, { ok: false, error: String(error.message || error) });
    }
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
