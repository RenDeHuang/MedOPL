import { createLangfusePublisher } from "./langfuse-publisher.mjs";
import { addEvent, addTraceRecord, ensureRuntime, readState, writeState } from "./state-store.mjs";
import { createLaunchApi } from "./runtime-bridge-launch.mjs";
import { createRunApi } from "./runtime-bridge-runs.mjs";

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
    runnerImage: config.runnerImage,
    k8sNamespace: config.k8sNamespace,
    publishTraceEvent,
  });

  async function handleRequest(req, res) {
    const url = new URL(req.url || "/", config.baseUrl);
    if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/status")) {
      sendJson(res, 200, launchApi.buildStatusPayload());
      return;
    }

    if (req.method === "GET" && url.pathname === "/workbench") {
      sendRetired(res, "adapter /workbench dev projection 已退场；请打开 OPL_WEB_URL，并由 OPL Web 使用 launch token 拉 bootstrap。", "OPL_WEB_URL");
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/launch-tokens") {
      sendRetired(res, "旧 /api/launch-tokens 已退场；Portal 现在通过 /api/opl-launch/tokens 签发 OPL Web launch。", "/api/opl-launch/tokens");
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/opl-launch/tokens") {
      const input = await readBody(req);
      sendJson(res, 200, await launchApi.issueLaunchToken(input));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/workbench/bootstrap") {
      sendRetired(res, "旧 /api/workbench/bootstrap 已退场；OPL Web 必须使用 /api/opl-launch/bootstrap。", "/api/opl-launch/bootstrap");
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/opl-launch/bootstrap") {
      const launch = launchApi.verifyLaunchToken(url.searchParams.get("launch_token") || "");
      if (!launch) {
        sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
        return;
      }
      const state = await readState();
      const bootstrap = await launchApi.buildBootstrap(state, launch);
      await writeState(state);
      sendJson(res, 200, bootstrap);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/opl-launch/runs") {
      const input = await readBody(req);
      const launch = launchApi.verifyLaunchToken(input.launchToken || input.launch_token || url.searchParams.get("launch_token") || "");
      if (!launch) {
        sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
        return;
      }
      const state = await readState();
      const runtimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === launch.runtimeSessionId);
      if (!runtimeSession) {
        sendJson(res, 404, { ok: false, error: "runtime_session_not_found" });
        return;
      }
      try {
        const run = await runApi.submitRuntimeRun(state, runtimeSession, input, req);
        await writeState(state);
        sendJson(res, 200, { ok: true, run });
      } catch (error) {
        addEvent(state, "runner_run_failed", { ...runtimeSession, error: String(error.message || error) });
        await writeState(state);
        sendJson(res, 502, { ok: false, error: String(error.message || error) });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/opl-launch/sessions/bind") {
      const input = await readBody(req);
      const launch = launchApi.verifyLaunchToken(input.launchToken || input.launch_token || url.searchParams.get("launch_token") || "");
      if (!launch) {
        sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
        return;
      }
      const state = await readState();
      const runtimeSession = launchApi.bindOplSession(state, launch, input);
      if (!runtimeSession) {
        sendJson(res, 404, { ok: false, error: "runtime_session_not_found" });
        return;
      }
      await writeState(state);
      sendJson(res, 200, { ok: true, runtimeSession });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/runtime-sessions") {
      sendRetired(res, "旧 /api/runtime-sessions 已退场；runtime/session 由 OPL Web 与 OPL runtime 管理，Portal 只通过 launch/bootstrap 绑定。", "/api/opl-launch/sessions/bind");
      return;
    }

    const runMatch = url.pathname.match(/^\/api\/runtime-sessions\/([^/]+)\/runs$/);
    if (req.method === "POST" && runMatch) {
      sendRetired(res, "旧 /api/runtime-sessions/:id/runs 已退场；run 必须由 OPL Web 携带 launch token 调 /api/opl-launch/runs。", "/api/opl-launch/runs");
      return;
    }

    const statusMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/status$/) || url.pathname.match(/^\/api\/opl-launch\/runs\/([^/]+)\/status$/);
    if (req.method === "GET" && statusMatch) {
      const state = await readState();
      const run = state.runs.find((item) => item.runId === statusMatch[1]);
      if (!run) {
        sendJson(res, 404, { ok: false, error: "run_not_found" });
        return;
      }
      const synced = await runApi.syncRunnerRun(state, run);
      await writeState(state);
      sendJson(res, 200, { ok: true, run: synced || run });
      return;
    }

    const artifactsMatch = url.pathname.match(/^\/api\/opl-launch\/runs\/([^/]+)\/artifacts$/);
    if (req.method === "GET" && artifactsMatch) {
      const state = await readState();
      const run = state.runs.find((item) => item.runId === artifactsMatch[1]);
      if (!run) {
        sendJson(res, 404, { ok: false, error: "run_not_found" });
        return;
      }
      await runApi.syncRunnerRun(state, run).catch((error) => {
        addEvent(state, "runner_artifact_sync_failed", { ...run, error: String(error.message || error) });
        return null;
      });
      await writeState(state);
      sendJson(res, 200, { ok: true, items: state.artifacts.filter((item) => item.runId === artifactsMatch[1]) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/runs") {
      const state = await readState();
      sendJson(res, 200, { ok: true, items: state.runs });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/artifacts") {
      const state = await readState();
      sendJson(res, 200, { ok: true, items: state.artifacts });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/trace-links") {
      const state = await readState();
      sendJson(res, 200, { ok: true, items: state.traceLinks, runActions: state.runActions });
      return;
    }

    if (req.method === "POST" && url.pathname === "/internal/trace-events") {
      const input = await readBody(req);
      const state = await readState();
      const trace = await publishTraceEvent(state, {
        ...input,
        eventType: input.eventType || input.type || "runtime_event",
      });
      await writeState(state);
      sendJson(res, 200, { ok: true, trace });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/cost-records") {
      const state = await readState();
      sendJson(res, 200, { ok: true, items: state.costRecords });
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
