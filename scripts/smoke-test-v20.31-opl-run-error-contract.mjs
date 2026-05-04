import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await close(server);
  return port;
}

async function waitFor(url) {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const stateRoot = await mkdtemp(path.join(os.tmpdir(), "opl-v20.31-run-error-contract-"));
const port = await freePort();
const runnerPort = await freePort();
const portalPort = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const runnerUrl = `http://127.0.0.1:${runnerPort}`;
const portalUrl = `http://127.0.0.1:${portalPort}`;

process.env.PORT = String(port);
process.env.NODE_ENV = "development";
process.env.OPL_WEB_URL = "https://opl.example.test";
process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL = baseUrl;
process.env.PORTAL_OPL_ADAPTER_STATE_ROOT = stateRoot;
process.env.PORTAL_INTERNAL_BASE_URL = portalUrl;
process.env.PORTAL_INTERNAL_AUTH_TOKEN = "run-error-contract-token";
process.env.MED_AUTOSCIENCE_RUNNER_URL = runnerUrl;

let server = null;
let runnerServer = null;
let portalServer = null;
try {
  portalServer = net.createServer((socket) => {
    socket.on("data", (chunk) => {
      const req = chunk.toString("utf8");
      if (/POST \/portal\/internal\/resource-orders\/prepare-run/.test(req)) {
        assert(/x-portal-internal-token:\s*run-error-contract-token/i.test(req), "prepare_run_must_forward_portal_internal_auth_token");
        socket.write("HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n");
        socket.write(JSON.stringify({
          ok: true,
          resourceOrderId: "ro-1",
          order: { serverPlanId: "plan-basic", instanceType: "S2.SMALL1", region: "ap-shanghai", zone: "ap-shanghai-2" },
        }));
        socket.end();
        return;
      }
      socket.write("HTTP/1.1 404 Not Found\r\ncontent-type: application/json\r\n\r\n");
      socket.write(JSON.stringify({ ok: false, error: "not_found" }));
      socket.end();
    });
  });
  await new Promise((resolve) => portalServer.listen(portalPort, "127.0.0.1", resolve));

  let runCount = 0;
  runnerServer = net.createServer((socket) => {
    socket.on("data", (chunk) => {
      const req = chunk.toString("utf8");
      if (/POST \/api\/workspaces/.test(req)) {
        socket.write("HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n");
        socket.write(JSON.stringify({ ok: true, workspace: { workspaceId: "w1" } }));
        socket.end();
        return;
      }
      if (/POST \/api\/runs/.test(req)) {
        runCount += 1;
        if (runCount === 1) {
          socket.write("HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n");
          socket.write(JSON.stringify({
            ok: true,
            run: {
              runId: "run-contract-1",
              status: "submitted",
              jobName: "med-autoscience-run-contract-1",
              namespace: "med-agent-demo",
              resourceOrderId: "ro-1",
              traceId: "trace-1",
              correlationId: "corr-contract-1",
            },
          }));
          socket.end();
          return;
        }
        socket.write("HTTP/1.1 500 Internal Server Error\r\ncontent-type: application/json\r\n\r\n");
        socket.write(JSON.stringify({
          ok: false,
          error: {
            code: "RUNNER_K8S_RBAC_DENIED",
            stage: "k8s_apply",
            message: "kubectl apply failed due to RBAC in /tmp/a.yaml",
            retryable: false,
            details: { reason: "forbidden" },
            correlationId: "corr-contract-2",
          },
        }));
        socket.end();
        return;
      }
      socket.write("HTTP/1.1 404 Not Found\r\ncontent-type: application/json\r\n\r\n");
      socket.write(JSON.stringify({ ok: false, error: "not_found" }));
      socket.end();
    });
  });
  await new Promise((resolve) => runnerServer.listen(runnerPort, "127.0.0.1", resolve));

  const { createRuntimeBridgeServer } = await import("../services/opl-runtime-bridge/src/runtime-bridge-bootstrap.mjs");
  server = createRuntimeBridgeServer();
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  await waitFor(`${baseUrl}/healthz`);

  const launchResp = await fetch(`${baseUrl}/api/opl-launch/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      portalUserId: "u1",
      portalUserEmail: "u1@example.local",
      workspaceId: "w1",
    }),
  });
  const launch = await launchResp.json();
  assert(launchResp.ok && launch.ok, "launch token 签发失败");

  const okRunResp = await fetch(`${baseUrl}/api/opl-launch/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      launchToken: launch.launchToken,
      runId: "run-contract-1",
      correlationId: "corr-contract-1",
    }),
  });
  const okRunBody = await okRunResp.json();
  assert(okRunResp.status === 200, "runner 成功时必须返回 200");
  assert(okRunBody?.ok === true, "成功响应必须 ok=true");
  assert(okRunBody?.run && typeof okRunBody.run === "object", "成功响应必须包含 run");
  assert(typeof okRunBody.run.runId === "string" && okRunBody.run.runId.length > 0, "run 缺少 runId");
  assert(typeof okRunBody.run.status === "string" && okRunBody.run.status.length > 0, "run 缺少 status");
  assert(typeof okRunBody.run.jobName === "string", "run 缺少 jobName");
  assert(typeof okRunBody.run.namespace === "string", "run 缺少 namespace");
  assert(typeof okRunBody.run.resourceOrderId === "string", "run 缺少 resourceOrderId");
  assert(typeof okRunBody.run.traceId === "string" && okRunBody.run.traceId.length > 0, "run 缺少 traceId");
  assert(okRunBody.run.correlationId === "corr-contract-1", "run 缺少 correlationId");

  const runResp = await fetch(`${baseUrl}/api/opl-launch/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      launchToken: launch.launchToken,
      runId: "run-contract-2",
      correlationId: "corr-contract-2",
    }),
  });
  const runBody = await runResp.json();
  assert(runResp.status === 502, "runner 异常时必须返回 502");
  assert(runBody?.ok === false, "失败响应必须 ok=false");
  assert(runBody?.error && typeof runBody.error === "object", "error 必须是对象");
  assert(typeof runBody.error.code === "string" && runBody.error.code.length > 0, "缺少 error.code");
  assert(typeof runBody.error.stage === "string" && runBody.error.stage.length > 0, "缺少 error.stage");
  assert(typeof runBody.error.message === "string" && runBody.error.message.length > 0, "缺少 error.message");
  assert(typeof runBody.error.retryable === "boolean", "缺少 error.retryable");
  assert(runBody.error.correlationId === "corr-contract-2", "correlationId 透传失败");
  assert(runBody.error.details && typeof runBody.error.details === "object", "缺少 error.details");
  assert(!/kubectl|rbac|yaml/i.test(runBody.error.message), "错误 message 不得暴露 kubectl/RBAC/YAML");

  console.log(JSON.stringify({
    ok: true,
    verified: [
      "run_error_structured_contract_v20_31",
      "run_error_message_sanitized_contract_v20_31",
      "run_success_payload_contract_v20_31",
    ],
  }, null, 2));
} finally {
  if (server) await close(server);
  if (runnerServer) await close(runnerServer);
  if (portalServer) await close(portalServer);
  delete process.env.PORT;
  delete process.env.NODE_ENV;
  delete process.env.OPL_WEB_URL;
  delete process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL;
  delete process.env.PORTAL_OPL_ADAPTER_STATE_ROOT;
  delete process.env.PORTAL_INTERNAL_BASE_URL;
  delete process.env.PORTAL_INTERNAL_AUTH_TOKEN;
  delete process.env.MED_AUTOSCIENCE_RUNNER_URL;
  await rm(stateRoot, { recursive: true, force: true });
}
