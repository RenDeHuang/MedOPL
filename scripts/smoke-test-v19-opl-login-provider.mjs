import http from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const gatewayPort = Number(process.env.OPL_GATEWAY_PROVIDER_TEST_PORT || 19310);
const portalPort = Number(process.env.PORTAL_PROVIDER_TEST_PORT || 19311);
const upstreamPort = Number(process.env.OPL_UPSTREAM_PROVIDER_TEST_PORT || 19312);
const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
const portalUrl = `http://127.0.0.1:${portalPort}`;
const upstreamUrl = `http://127.0.0.1:${upstreamPort}`;
const providerToken = "provider-login-smoke-token";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(payload, null, 2));
}

async function handlePortalHealth(_req, res) {
  sendJson(res, 200, { ok: true });
}

async function handlePortalLogin(req, res) {
  const body = await readJson(req);
  const result = buildPortalLoginResult(body);
  sendJson(res, result.status, result.payload);
}

function buildPortalLoginResult(body) {
  return resolveProviderKey(body)
    ? { status: 200, payload: buildPortalLoginSuccess(body) }
    : { status: 400, payload: buildPortalLoginFailure() };
}

function resolveProviderKey(body) {
  return body.apiKey || body.providerApiKey || body.experimentalBearerToken || "";
}

function buildPortalLoginFailure() {
  return {
    ok: false,
    error: "provider_api_key_required",
    message: "请输入 gflabtoken API key 后再进入 OPL。",
  };
}

function buildPortalLoginSuccess(body) {
  return {
    ok: true,
    launchToken: "launch-provider-smoke",
    user: { id: "user-provider-smoke", email: body.email, name: "Provider Smoke" },
    launch: { launchId: "launch-provider-smoke-id" },
    workspace: { workspaceId: body.task || "default" },
    runtimeSession: { runtimeSessionId: "runtime-provider-smoke" },
    providerConfigured: true,
    providerName: "gflab",
  };
}

async function handlePortalNotFound(_req, res) {
  sendJson(res, 404, { ok: false, error: "not_found" });
}

const portalRoutes = new Map([
  ["GET /healthz", handlePortalHealth],
  ["POST /internal/opl/auth/login", handlePortalLogin],
]);

async function dispatchPortalFixture(req, res) {
  const url = new URL(req.url || "/", portalUrl);
  const handler = portalRoutes.get(`${req.method} ${url.pathname}`) || handlePortalNotFound;
  await handler(req, res);
}

function createPortalFixture() {
  return http.createServer(dispatchPortalFixture);
}

function createUpstreamFixture() {
  return http.createServer((req, res) => {
    if (req.url === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end([
      "<!doctype html><html><head><title>OPL Login</title></head><body>",
      '<form action="/api/auth/login" method="post">',
      '<input name="email">',
      '<input name="password" type="password">',
      "<button>Login</button>",
      "</form>",
      "</body></html>",
    ].join(""));
  });
}

function spawnGateway() {
  return spawn("node", ["src/server.mjs"], {
    cwd: "services/opl-web-gateway",
    env: {
      ...process.env,
      PORT: String(gatewayPort),
      OPL_WEB_UPSTREAM_URL: upstreamUrl,
      PORTAL_INTERNAL_URL: portalUrl,
      PORTAL_OPL_ADAPTER_URL: "http://127.0.0.1:19319",
      PORTAL_PUBLIC_URL: "http://portal.local",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function listen(server, port) {
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`${url} did not become ready`);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

const portal = createPortalFixture();
const upstream = createUpstreamFixture();
let gateway = null;

try {
  await listen(portal, portalPort);
  await listen(upstream, upstreamPort);
  gateway = spawnGateway();
  await waitFor(`${gatewayUrl}/healthz`);

  const htmlResponse = await fetch(`${gatewayUrl}/`);
  const html = await htmlResponse.text();
  assert(html.includes("gflabtoken API key"), "gateway must inject provider key field copy");
  assert(html.includes("data-opl-portal-dismiss"), "gateway must inject dismiss button");
  assert(html.includes("/portal-launch.js"), "gateway must inject launch client script");

  const missing = await postJson(`${gatewayUrl}/api/auth/login`, {
    email: "provider-smoke@example.com",
    password: "secret",
  });
  assert(missing.response.status === 400, "missing provider key must be rejected");
  assert(missing.payload.error === "provider_api_key_required", "missing provider key error mismatch");

  const ok = await postJson(`${gatewayUrl}/api/auth/login`, {
    email: "provider-smoke@example.com",
    password: "secret",
    apiKey: providerToken,
    task: "default",
  });
  const bodyText = JSON.stringify(ok.payload);
  assert(ok.response.ok, `provider login failed: ${bodyText}`);
  assert(ok.payload.launchToken === "launch-provider-smoke", "launch token missing");
  assert(!bodyText.includes(providerToken), "provider key must not be returned to browser");
  assert(String(ok.response.headers.get("set-cookie") || "").includes("opl_portal_launch="), "launch cookie missing");

  console.log(JSON.stringify({ ok: true, injected: true, missingRejected: true, keyRedacted: true }, null, 2));
} finally {
  if (gateway) gateway.kill();
  await new Promise((resolve) => portal.close(resolve));
  await new Promise((resolve) => upstream.close(resolve));
}
