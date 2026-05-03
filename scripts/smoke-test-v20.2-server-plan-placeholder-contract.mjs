import http from "node:http";
import net from "node:net";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("free_port_failed"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function listen(server) {
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return `http://127.0.0.1:${port}`;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function startPortalInternalFixture() {
  const prepareRequests = [];
  return {
    prepareRequests,
    server: http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", "http://portal-internal.fixture");
      if (req.method !== "POST" || url.pathname !== "/portal/internal/resource-orders/prepare-run") {
        sendJson(res, 404, { ok: false, error: "not_found" });
        return;
      }
      const body = await readJson(req);
      prepareRequests.push(body);
      if (String(body.serverPlanId || "") === "default") {
        sendJson(res, 409, { ok: false, error: "server_plan_placeholder_leaked" });
        return;
      }
      const serverPlanId = String(body.serverPlanId || "cpu-2c4g");
      const resourceOrderId = `order-${String(body.runId || "missing-run")}`;
      sendJson(res, 200, {
        ok: true,
        resourceOrderId,
        order: {
          id: resourceOrderId,
          status: "frozen",
          tenantId: body.tenantId || "",
          userId: body.userId || "",
          workspaceId: body.workspaceId || "",
          workspaceSessionId: body.workspaceSessionId || "",
          runId: body.runId || "",
          serverPlanId,
          instanceType: "S5.SMALL2",
          region: "na-siliconvalley",
        },
      });
    }),
  };
}

function startRunnerFixture() {
  const workspaceRequests = [];
  const runRequests = [];
  return {
    workspaceRequests,
    runRequests,
    server: http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", "http://runner.fixture");
      if (req.method === "POST" && url.pathname === "/api/workspaces") {
        const body = await readJson(req);
        workspaceRequests.push(body);
        sendJson(res, 200, { ok: true, workspace: { workspaceId: body.workspaceId || "" } });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/runs") {
        const body = await readJson(req);
        runRequests.push(body);
        sendJson(res, 200, {
          ok: true,
          run: {
            runId: body.runId || "",
            status: "submitted",
            serverPlanId: body.serverPlanId || "",
            instanceType: body.instanceType || "",
            manifestPath: "/tmp/noop-manifest.yaml",
          },
        });
        return;
      }
      sendJson(res, 404, { ok: false, error: "not_found" });
    }),
  };
}

const portalInternal = startPortalInternalFixture();
const runner = startRunnerFixture();
const portalInternalUrl = await listen(portalInternal.server);
const runnerUrl = await listen(runner.server);

process.env.MED_AUTOSCIENCE_RUNNER_URL = runnerUrl;

try {
  const { createRunApi } = await import("../services/opl-runtime-bridge/src/runtime-bridge-runs.mjs");
  const runApi = createRunApi({
    portalInternalBaseUrl: portalInternalUrl,
    runnerImage: "runner:test",
    k8sNamespace: "med-agent-demo",
    publishTraceEvent: async () => null,
  });

  const state = {
    runs: [],
    runActions: [],
    artifacts: [],
    costRecords: [],
    events: [],
    traceLinks: [],
  };
  const runtimeSession = {
    runtimeSessionId: "runtime-v20-2",
    portalUserId: "user-v20-2",
    tenantId: "tenant-v20-2",
    workspaceId: "ws-v20-2",
    workspaceSessionId: "workspace-session-v20-2",
    serverPlanId: "default",
    providerConfigured: true,
    providerConfigStatus: "configured",
  };

  const run = await runApi.submitRuntimeRun(state, runtimeSession, {
    runId: "run-v20-2-no-placeholder",
    agentId: "mas",
    toolName: "opl-message-reply-live",
  }, { headers: { "user-agent": "v20.2-placeholder-contract" } });

  assert(portalInternal.prepareRequests.length === 1, `prepare_run_call_count:${portalInternal.prepareRequests.length}`);
  assert(String(portalInternal.prepareRequests[0].serverPlanId || "") !== "default", "prepare_run_must_not_receive_default_plan_placeholder");
  assert(runner.workspaceRequests.length === 1, `runner_workspace_call_count:${runner.workspaceRequests.length}`);
  assert(runner.runRequests.length === 1, `runner_run_call_count:${runner.runRequests.length}`);
  assert(runner.runRequests[0].serverPlanId === "cpu-2c4g", `runner_must_receive_canonical_prepared_server_plan:${runner.runRequests[0].serverPlanId || ""}`);
  assert(run.serverPlanId === "cpu-2c4g", `run_must_store_canonical_prepared_server_plan:${run.serverPlanId || ""}`);
  assert(run.resourceOrderId === "order-run-v20-2-no-placeholder", `run_resource_order_mismatch:${run.resourceOrderId || ""}`);

  console.log(JSON.stringify({
    ok: true,
    runId: run.runId,
    serverPlanId: run.serverPlanId,
    preparedServerPlanId: portalInternal.prepareRequests[0].serverPlanId || "",
  }, null, 2));
} finally {
  portalInternal.server.close();
  runner.server.close();
}
