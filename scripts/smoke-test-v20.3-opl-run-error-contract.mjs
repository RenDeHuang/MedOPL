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

const stateRoot = await mkdtemp(path.join(os.tmpdir(), "opl-v20.3-run-error-contract-"));
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;

process.env.PORT = String(port);
process.env.NODE_ENV = "development";
process.env.OPL_WEB_URL = "https://opl.example.test";
process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL = baseUrl;
process.env.PORTAL_OPL_ADAPTER_STATE_ROOT = stateRoot;
process.env.PORTAL_INTERNAL_BASE_URL = "http://127.0.0.1:9";
process.env.MED_AUTOSCIENCE_RUNNER_URL = "http://127.0.0.1:9";

let server = null;
try {
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

  const runResp = await fetch(`${baseUrl}/api/opl-launch/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      launchToken: launch.launchToken,
      runId: "run-contract-1",
      correlationId: "corr-contract-1",
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
  assert(runBody.error.correlationId === "corr-contract-1", "correlationId 透传失败");
  assert(runBody.error.details && typeof runBody.error.details === "object", "缺少 error.details");
  assert(
    [
      "RESOURCE_ORDER_PREPARE_FAILED",
      "RUNNER_WORKSPACE_CREATE_FAILED",
      "RUNNER_K8S_APPLY_FAILED",
      "RUNNER_NAMESPACE_NOT_FOUND",
      "RUNNER_K8S_RBAC_DENIED",
      "RUNNER_MANIFEST_INVALID",
      "RUNNER_UPSTREAM_5XX",
      "LAUNCH_TOKEN_INVALID",
    ].includes(runBody.error.code),
    `错误码不在 v20.3 稳定集合内: ${runBody.error.code}`,
  );
  assert(
    [
      "resource_order_prepare",
      "runner_workspace_create",
      "runner_submit",
      "k8s_apply",
      "runner_status_sync",
    ].includes(runBody.error.stage),
    `错误阶段不在 v20.3 稳定集合内: ${runBody.error.stage}`,
  );

  console.log(JSON.stringify({
    ok: true,
    verified: [
      "run_error_structured_contract",
      "run_error_has_code_stage_retryable_details_correlation",
    ],
  }, null, 2));
} finally {
  if (server) await close(server);
  delete process.env.PORT;
  delete process.env.NODE_ENV;
  delete process.env.OPL_WEB_URL;
  delete process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL;
  delete process.env.PORTAL_OPL_ADAPTER_STATE_ROOT;
  delete process.env.PORTAL_INTERNAL_BASE_URL;
  delete process.env.MED_AUTOSCIENCE_RUNNER_URL;
  await rm(stateRoot, { recursive: true, force: true });
}
