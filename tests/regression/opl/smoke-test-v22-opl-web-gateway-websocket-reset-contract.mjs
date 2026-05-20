import http from "node:http";
import net from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const { proxyUpgrade } = await import("../../../services/opl-web-gateway/src/proxy.mjs");

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

function websocketAccept(key) {
  return createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
}

const uncaught = [];
function onUncaught(error) {
  uncaught.push(error);
}
process.on("uncaughtException", onUncaught);

const upstream = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end("ok");
});

upstream.on("upgrade", (req, socket) => {
  socket.on("error", () => {});
  const key = String(req.headers["sec-websocket-key"] || "");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${websocketAccept(key)}`,
    "",
    "",
  ].join("\r\n"));
  setImmediate(() => socket.destroy(new Error("fixture_upstream_reset")));
});

let gateway = null;
let client = null;

try {
  const upstreamPort = await listen(upstream);
  gateway = http.createServer();
  gateway.on("upgrade", (req, socket, head) => {
    proxyUpgrade(req, socket, head, `http://127.0.0.1:${upstreamPort}`);
  });
  const gatewayPort = await listen(gateway);

  await new Promise((resolve, reject) => {
    const key = randomBytes(16).toString("base64");
    client = net.createConnection({ host: "127.0.0.1", port: gatewayPort });
    let raw = "";
    client.on("connect", () => {
      client.write([
        "GET /socket.io/?EIO=4&transport=websocket HTTP/1.1",
        `Host: 127.0.0.1:${gatewayPort}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        "",
        "",
      ].join("\r\n"));
    });
    client.on("data", (chunk) => {
      raw += chunk.toString("utf8");
      if (!raw.includes("\r\n\r\n")) return;
      client.destroy(new Error("fixture_client_reset"));
      resolve();
    });
    client.on("error", () => {});
    client.setTimeout(3000, () => reject(new Error("gateway_socket_reset_test_timeout")));
  });
  await sleep(200);

  assert(uncaught.length === 0, `gateway_websocket_reset_must_not_throw_uncaught:${uncaught[0]?.message || ""}`);

  console.log(JSON.stringify({
    ok: true,
    contract: "opl_web_gateway_websocket_reset",
  }, null, 2));
} finally {
  process.off("uncaughtException", onUncaught);
  if (client && !client.destroyed) client.destroy();
  if (gateway) await close(gateway);
  await close(upstream);
}
