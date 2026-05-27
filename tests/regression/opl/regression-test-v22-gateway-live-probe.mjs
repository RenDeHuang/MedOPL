import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await close(server);
  return port;
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return response;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
}

async function stopChild(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(1500).then(() => false),
  ]);
  if (exited !== false || child.killed) return;
  child.kill("SIGKILL");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(1000),
  ]);
}

function startCleanUpstreamFixture(calls) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://clean-opl.local");
    calls.upstream.push({
      method: req.method || "GET",
      path: url.pathname,
      search: url.search,
      authorization: req.headers.authorization || "",
    });

    if (url.pathname === "/") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "x-opl-upstream-fixture": "clean-one-person-lab",
      });
      res.end([
        "<!doctype html>",
        "<html>",
        "<head><title>Clean OPL</title></head>",
        "<body>",
        "<main id=\"root\">clean upstream one-person-lab Web</main>",
        "</body>",
        "</html>",
      ].join(""));
      return;
    }

    if (url.pathname === "/api/auth/user") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        success: true,
        user: { id: "upstream-user", source: "clean-upstream-fixture" },
      }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "not_found", path: url.pathname }));
  });
}

function startRuntimeBridgeFixture(calls) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://runtime-bridge.local");
    calls.runtime.push({
      method: req.method || "GET",
      path: url.pathname,
      search: url.search,
      authorization: req.headers.authorization || "",
      cookie: req.headers.cookie || "",
    });

    if (url.pathname === "/healthz") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, service: "runtime-bridge-fixture" }));
      return;
    }

    if (url.pathname === "/api/opl/status") {
      if (req.headers.authorization !== "Bearer launch-token-live-probe") {
        res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "launch_token_required" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        ok: true,
        service: "runtime-bridge-fixture",
        runtimeSessionId: "runtime-session-live-probe",
      }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "not_found", path: url.pathname }));
  });
}

function spawnGateway({ gatewayPort, upstreamPort, runtimePort }) {
  const childEnv = { ...process.env };
  delete childEnv.OPL_WEB_UPSTREAM_URL;
  delete childEnv.OPL_WEB_URL;
  return spawn(process.execPath, ["services/opl-web-gateway/src/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...childEnv,
      PORT: String(gatewayPort),
      OPL_WEB_GATEWAY_PUBLIC_URL: `http://127.0.0.1:${gatewayPort}`,
      OPL_UPSTREAM_URL: `http://127.0.0.1:${upstreamPort}`,
      PORTAL_RUNTIME_BRIDGE_URL: `http://127.0.0.1:${runtimePort}`,
      PORTAL_PUBLIC_URL: "http://127.0.0.1:17180",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const calls = {
  upstream: [],
  runtime: [],
};
const upstreamServer = startCleanUpstreamFixture(calls);
const runtimeBridgeServer = startRuntimeBridgeFixture(calls);
let gateway = null;
const gatewayOutput = { stdout: "", stderr: "" };

try {
  const upstreamPort = await listen(upstreamServer);
  const runtimePort = await listen(runtimeBridgeServer);
  const gatewayPort = await freePort();
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  gateway = spawnGateway({ gatewayPort, upstreamPort, runtimePort });
  gateway.stdout.on("data", (chunk) => {
    gatewayOutput.stdout += chunk.toString("utf8");
  });
  gateway.stderr.on("data", (chunk) => {
    gatewayOutput.stderr += chunk.toString("utf8");
  });

  await waitFor(`${gatewayUrl}/healthz`);
  const health = await (await fetch(`${gatewayUrl}/healthz`)).json();
  assert.equal(health.ok, true, "gateway_healthz_must_be_ok");
  assert.equal(health.runtime.upstreamConfigured, true, "gateway_healthz_must_mark_upstream_configured");
  assert.equal(health.runtime.upstreamUrl, `http://127.0.0.1:${upstreamPort}`, "gateway_healthz_must_expose_local_upstream_fixture");
  assert.equal(health.runtime.portalRuntimeBridgeUrl, `http://127.0.0.1:${runtimePort}`, "gateway_healthz_must_expose_runtime_bridge_fixture");

  const htmlResponse = await fetch(`${gatewayUrl}/`, {
    headers: {
      authorization: "Bearer browser-token-must-not-reach-upstream",
    },
  });
  const html = await htmlResponse.text();
  assert.equal(htmlResponse.status, 200, "gateway_must_proxy_clean_upstream_html");
  assert(html.includes("clean upstream one-person-lab Web"), "gateway_html_must_include_clean_upstream_fixture");
  assert(html.includes("/portal-launch.js"), "gateway_must_inject_portal_launch_script");
  assert(html.includes('meta name="opl-portal-direct-entry" content="1"'), "direct_entry_html_must_be_marked");
  assert.equal(calls.upstream.some((call) => String(call.authorization || "").trim()), false, "ordinary_upstream_proxy_must_not_forward_authorization");

  const launchScriptResponse = await fetch(`${gatewayUrl}/portal-launch.js`);
  const launchScript = await launchScriptResponse.text();
  assert.equal(launchScriptResponse.status, 200, "gateway_launch_script_status_mismatch");
  assert(launchScript.includes("/runtime-bridge"), "gateway_launch_script_must_use_same_origin_runtime_bridge");
  assert(launchScript.includes("window.__OPL_PORTAL__"), "gateway_launch_script_must_expose_public_browser_api");
  assert.equal(/launch-token-live-probe|raw API Key|providerApiKey/u.test(launchScript), false, "gateway_launch_script_must_not_embed_secret_like_values");

  const runtimeResponse = await fetch(`${gatewayUrl}/runtime-bridge/api/opl/status`, {
    headers: {
      cookie: "opl_portal_launch=launch-token-live-probe; ui_theme=dark",
    },
  });
  const runtimePayload = await runtimeResponse.json();
  assert.equal(runtimeResponse.status, 200, "gateway_runtime_bridge_proxy_status_mismatch");
  assert.equal(runtimePayload.runtimeSessionId, "runtime-session-live-probe", "gateway_runtime_bridge_proxy_payload_mismatch");
  const runtimeStatusCall = calls.runtime.find((call) => call.path === "/api/opl/status");
  assert(runtimeStatusCall, "runtime_bridge_fixture_must_receive_status_call");
  assert.equal(runtimeStatusCall.authorization, "Bearer launch-token-live-probe", "gateway_must_convert_launch_cookie_to_bearer");
  assert.equal(runtimeStatusCall.cookie.includes("opl_portal_launch"), false, "gateway_must_not_forward_launch_cookie_to_runtime_bridge");
  assert(runtimeStatusCall.cookie.includes("ui_theme=dark"), "gateway_must_preserve_non_secret_cookies");

  const forbiddenRuntimeResponse = await fetch(`${gatewayUrl}/runtime-bridge/api/opl/status?launch_token=secret`, {
    headers: {
      cookie: "opl_portal_launch=launch-token-live-probe",
    },
  });
  const forbiddenRuntimePayload = await forbiddenRuntimeResponse.json();
  assert.equal(forbiddenRuntimeResponse.status, 400, "gateway_must_reject_runtime_bridge_query_secret");
  assert.equal(forbiddenRuntimePayload.error, "gateway_query_secret_forbidden", "gateway_query_secret_error_mismatch");
  assert.equal(calls.runtime.some((call) => call.search.includes("launch_token")), false, "query_secret_must_not_reach_runtime_bridge_fixture");

  const forbiddenUpstreamResponse = await fetch(`${gatewayUrl}/?api_key=secret`);
  const forbiddenUpstreamPayload = await forbiddenUpstreamResponse.json();
  assert.equal(forbiddenUpstreamResponse.status, 400, "gateway_must_reject_upstream_query_secret");
  assert.equal(forbiddenUpstreamPayload.error, "gateway_query_secret_forbidden", "gateway_upstream_query_secret_error_mismatch");
  assert.equal(calls.upstream.some((call) => call.search.includes("api_key")), false, "query_secret_must_not_reach_clean_upstream_fixture");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_gateway_live_probe",
    evidence: "local_stub_only",
    cannotClaim: [
      "real_upstream_opl",
      "production_runtime",
      "real_cloud",
      "live_provider",
    ],
    verified: [
      "gateway_healthz",
      "clean_upstream_html_proxy",
      "portal_launch_script",
      "runtime_bridge_same_origin_proxy",
      "launch_cookie_to_bearer",
      "query_secret_rejection",
    ],
  }, null, 2));
} catch (error) {
  if (gatewayOutput.stdout || gatewayOutput.stderr) {
    process.stderr.write(JSON.stringify({ gatewayOutput }, null, 2));
    process.stderr.write("\n");
  }
  throw error;
} finally {
  await stopChild(gateway);
  await close(upstreamServer);
  await close(runtimeBridgeServer);
}
