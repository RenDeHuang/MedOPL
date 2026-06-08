import { createLangfusePublisher } from "./langfuse-publisher.mjs";
import {
  ensureRuntime,
  readState,
  updateState,
} from "./state-store-core.mjs";
import { createLaunchApi } from "./runtime-bridge-launch.mjs";
import { createMessageApi } from "./runtime-bridge-messages.mjs";
import { createRuntimeBridgeEventApi } from "./runtime-bridge-events.mjs";
import { createConfiguredRuntimeAgentRelay } from "./runtime-bridge-runtime-agent-relay.mjs";
import { createRunApi } from "./runtime-bridge-runs.mjs";
import {
  capabilityNotSupportedPayload,
  publicRuntimeSession,
  runtimeBridgeBootstrapPayload,
  runtimeBridgeContractMetadata,
} from "./runtime-bridge-contract-payloads.mjs";
import { createRuntimeBridgeFileApi } from "./runtime-bridge-files.mjs";
import { createRuntimeBridgeMessageRouteApi } from "./runtime-bridge-message-routes.mjs";
import {
  buildLaunchCookie,
  isWebuiRuntimeMode,
  launchTokenFrom,
  matchDynamicHandler,
  readBody,
  readConfig,
  routeKey,
  sendJson,
  sendRetired,
} from "./runtime-bridge-routes-http.mjs";

export function createRuntimeBridgeRuntime() {
  const config = readConfig();
  const langfusePublisher = createLangfusePublisher();
  const runtimeAgentRelay = createConfiguredRuntimeAgentRelay(config);
  const eventApi = createRuntimeBridgeEventApi({
    langfusePublisher,
    readState,
    updateState,
  });

  const launchApi = createLaunchApi({
    ...config,
    langfusePublisher,
    publishTraceEvent: eventApi.publishTraceEvent,
  });
  const runApi = createRunApi({
    config,
    eventApi,
    launchApi,
    portalInternalBaseUrl: config.portalInternalBaseUrl,
    portalInternalAuthToken: config.portalInternalAuthToken,
    runnerImage: config.runnerImage,
    k8sNamespace: config.k8sNamespace,
    publishTraceEvent: eventApi.publishTraceEvent,
    readLaunchRuntimeSession,
    runtimeAgentRelay,
    updateState,
  });
  const messageApi = createMessageApi({
    publishTraceEvent: eventApi.publishTraceEvent,
  });
  const messageRouteApi = createRuntimeBridgeMessageRouteApi({
    config,
    launchApi,
    messageApi,
    readLaunchRuntimeSession,
    readState,
    updateState,
  });
  const fileApi = createRuntimeBridgeFileApi({
    config,
    launchApi,
    runApi,
    runtimeAgentRelay,
  });

  async function readLaunchRuntimeSession(input, url, req, res) {
    const launch = launchApi.verifyLaunchToken(launchTokenFrom(input, url, req));
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return null;
    }
    const state = await readState();
    const runtimeSession = launchApi.runtimeSessionByLaunch(state, launch);
    if (!runtimeSession) {
      sendJson(res, 404, { ok: false, error: "runtime_session_not_found" });
      return null;
    }
    return { launch, state, runtimeSession };
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
    ["POST /api/opl-launch/runs", runApi.handleRuntimeRun],
    ["POST /api/opl/runs", runApi.handleRuntimeBridgeRun],
    ["POST /api/opl-launch/messages", messageRouteApi.handleMessage],
    ["POST /api/opl/messages", messageRouteApi.handleMessage],
    ["POST /api/opl/files", fileApi.handleRuntimeBridgeFile],
    ["POST /api/opl-launch/sessions/bind", handleBindSession],
    ["POST /api/opl/sessions/bind", handleBindSession],
    ["POST /api/runtime-sessions", handleRuntimeSessionsRetired],
    ["GET /api/runs", fileApi.handleRunsList],
    ["GET /api/artifacts", fileApi.handleArtifactsList],
    ["GET /api/trace-links", eventApi.handleTraceLinks],
    ["POST /internal/trace-events", eventApi.handleTraceEvents],
    ["GET /api/cost-records", eventApi.handleCostRecords],
  ]);

  const dynamicHandlers = [
    { method: "POST", pattern: /^\/api\/runtime-sessions\/([^/]+)\/runs$/, handler: handleRuntimeSessionRunsRetired },
    { method: "GET", pattern: /^\/api\/runs\/([^/]+)\/status$/, handler: runApi.handleRunStatus },
    { method: "GET", pattern: /^\/api\/opl-launch\/runs\/([^/]+)\/status$/, handler: runApi.handleRunStatus },
    { method: "GET", pattern: /^\/api\/opl\/runs\/([^/]+)\/status$/, handler: runApi.handleRunStatus },
    { method: "GET", pattern: /^\/api\/opl-launch\/runs\/([^/]+)\/artifacts$/, handler: fileApi.handleRunArtifacts },
    { method: "GET", pattern: /^\/api\/opl\/runs\/([^/]+)\/artifacts$/, handler: fileApi.handleRunArtifacts },
    { method: "GET", pattern: /^\/api\/opl\/artifacts\/([^/]+)$/, handler: fileApi.handleRuntimeBridgeArtifact },
    { method: "GET", pattern: /^\/api\/opl-launch\/messages\/([^/]+)\/status$/, handler: messageRouteApi.handleMessageStatus },
    { method: "GET", pattern: /^\/api\/opl\/messages\/([^/]+)\/status$/, handler: messageRouteApi.handleMessageStatus },
    { method: "GET", pattern: /^\/runtime-bridge\/api\/opl\/messages\/([^/]+)\/status$/, handler: messageRouteApi.handleMessageStatus },
  ];

  async function handleRequest(req, res) {
    const url = new URL(req.url || "/", config.baseUrl);
    const handler = exactHandlers.get(routeKey(req, url));
    if (handler) {
      await handler(req, res, url);
      return;
    }
    const dynamicHandler = matchDynamicHandler(req, url, dynamicHandlers);
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
