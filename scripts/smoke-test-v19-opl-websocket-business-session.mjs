import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function websocketAccept(key) {
  return createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
}

function rawUpgrade({ port, path = "/socket.io/?EIO=4&transport=websocket", cookie = "" }) {
  return new Promise((resolve, reject) => {
    const key = randomBytes(16).toString("base64");
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let raw = "";
    let settled = false;
    socket.once("connect", () => {
      const headers = [
        `GET ${path} HTTP/1.1`,
        `Host: 127.0.0.1:${port}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        cookie ? `Cookie: ${cookie}` : "",
      ].filter((line) => line !== "");
      socket.write(`${headers.join("\r\n")}\r\n\r\n`);
    });
    socket.on("data", (chunk) => {
      raw += chunk.toString("utf8");
      if (raw.includes("\r\n\r\n")) {
        settled = true;
        socket.destroy();
        resolve(raw);
      }
    });
    socket.on("error", (error) => {
      if (!settled) reject(error);
    });
    socket.setTimeout(5000, () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error("upgrade_timeout"));
    });
  });
}

function startOplWebFixture(calls) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><div id=\"root\"></div>");
  });
  server.on("upgrade", (req, socket) => {
    socket.on("error", () => {});
    calls.upgrades.push({ url: req.url || "", cookie: req.headers.cookie || "" });
    const key = String(req.headers["sec-websocket-key"] || "");
    socket.write([
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${websocketAccept(key)}`,
      "",
      "",
    ].join("\r\n"));
    socket.end();
  });
  return server;
}

function startAdapterFixture(calls) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://adapter.local");
    if (req.method === "GET" && url.pathname === "/api/opl-launch/bootstrap") {
      calls.bootstrap.push(url.searchParams.get("launch_token") || "");
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        portal: {
          portalUserId: "portal-user-ws",
          portalUserEmail: "portal-ws@example.test",
          portalUserName: "Portal WS",
        },
        workspace: { workspaceId: "ws" },
      }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
}

const calls = { upgrades: [], bootstrap: [] };
const upstream = startOplWebFixture(calls);
const adapter = startAdapterFixture(calls);
let gateway = null;

try {
  const [upstreamPort, adapterPort, gatewayPort] = [
    await listen(upstream),
    await listen(adapter),
    await freePort(),
  ];
  gateway = spawn(process.execPath, ["services/opl-web-gateway/src/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(gatewayPort),
      OPL_WEB_UPSTREAM_URL: `http://127.0.0.1:${upstreamPort}`,
      PORTAL_OPL_ADAPTER_URL: `http://127.0.0.1:${adapterPort}`,
      OPL_WEB_GATEWAY_PUBLIC_URL: `http://127.0.0.1:${gatewayPort}`,
      PORTAL_PUBLIC_URL: "https://portal.example.test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  gateway.stdout.on("data", (chunk) => process.stdout.write(`[gateway] ${chunk}`));
  gateway.stderr.on("data", (chunk) => process.stderr.write(`[gateway] ${chunk}`));
  await waitFor(`http://127.0.0.1:${gatewayPort}/healthz`);

  const unauthenticated = await fetch(`http://127.0.0.1:${gatewayPort}/api/auth/user`);
  assert(unauthenticated.status === 401, "business session without launch should be 401");
  const unauthPayload = await unauthenticated.json();
  assert(unauthPayload.error === "unauthenticated", "business session error mismatch");

  const launchHtml = await fetch(`http://127.0.0.1:${gatewayPort}/?launch_token=launch-ws`);
  const cookie = (launchHtml.headers.get("set-cookie") || "").split(";")[0];
  assert(cookie.includes("opl_portal_launch=launch-ws"), "launch cookie missing");
  const auth = await fetch(`http://127.0.0.1:${gatewayPort}/api/auth/user`, {
    headers: { cookie },
  });
  const authPayload = await auth.json();
  assert(auth.status === 200 && authPayload.success === true, "business session with launch should pass");
  assert(authPayload.user.id === "portal-user-ws", "business session user mismatch");

  const upgradeRaw = await rawUpgrade({ port: gatewayPort, cookie });
  assert(upgradeRaw.startsWith("HTTP/1.1 101"), `websocket upgrade did not return 101: ${upgradeRaw.slice(0, 80)}`);
  assert(calls.upgrades.length === 1, "upstream websocket upgrade was not reached");

  console.log(JSON.stringify({
    ok: true,
    verified: ["business_session_401_without_launch", "business_session_200_with_launch", "websocket_upgrade_101"],
    bootstrapCalls: calls.bootstrap.length,
    upstreamUpgradeCalls: calls.upgrades.length,
  }, null, 2));
} finally {
  if (gateway) gateway.kill();
  await close(upstream);
  await close(adapter);
}
