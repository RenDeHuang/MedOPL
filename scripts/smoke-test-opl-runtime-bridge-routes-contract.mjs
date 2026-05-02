import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
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

const stateRoot = await mkdtemp(path.join(os.tmpdir(), "opl-runtime-bridge-routes-"));
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;

process.env.PORT = String(port);
process.env.NODE_ENV = "development";
process.env.OPL_WEB_URL = "https://opl.example.test";
process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL = baseUrl;
process.env.PORTAL_OPL_ADAPTER_STATE_ROOT = stateRoot;

let server = null;

try {
  const { createRuntimeBridgeServer } = await import("../services/opl-runtime-bridge/src/runtime-bridge-bootstrap.mjs");
  server = createRuntimeBridgeServer();
  assert(server instanceof http.Server, "createRuntimeBridgeServer must return http.Server");

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  await waitFor(`${baseUrl}/healthz`);

  const healthzResponse = await fetch(`${baseUrl}/healthz`);
  const healthz = await healthzResponse.json();
  assert(healthzResponse.ok, "healthz must succeed");
  assert(healthz.ok === true, "healthz payload ok mismatch");
  assert(healthz.service === "portal-opl-adapter", "healthz service mismatch");

  const retiredResponse = await fetch(`${baseUrl}/api/workbench/bootstrap`);
  const retiredBody = await retiredResponse.json();
  assert(retiredResponse.status === 410, "legacy workbench bootstrap must stay retired");
  assert(retiredBody.error === "legacy_endpoint_retired", "legacy workbench bootstrap error mismatch");
  assert(retiredBody.replacement === "/api/opl-launch/bootstrap", "legacy workbench bootstrap replacement mismatch");

  const invalidLaunchResponse = await fetch(`${baseUrl}/api/opl-launch/bootstrap?launch_token=invalid`);
  const invalidLaunchBody = await invalidLaunchResponse.json();
  assert(invalidLaunchResponse.status === 401, "invalid launch token must stay unauthorized");
  assert(invalidLaunchBody.error === "launch_token_invalid", "invalid launch token error mismatch");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    verified: [
      "bootstrap_server_factory",
      "healthz_contract",
      "retired_workbench_route",
      "invalid_launch_token_contract",
    ],
  }, null, 2));
} finally {
  if (server) {
    await close(server);
  }
  delete process.env.PORT;
  delete process.env.NODE_ENV;
  delete process.env.OPL_WEB_URL;
  delete process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL;
  delete process.env.PORTAL_OPL_ADAPTER_STATE_ROOT;
  await rm(stateRoot, { recursive: true, force: true });
}
