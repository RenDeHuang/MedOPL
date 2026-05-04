import assert from "node:assert/strict";

const { sanitizeProxyHeaders } = await import("../services/opl-web-gateway/src/http-utils.mjs");

const headers = sanitizeProxyHeaders({
  host: "opl-v20-32.medopl.cn",
  connection: "keep-alive, x-hop-token",
  "content-type": "application/json",
  "proxy-connection": "keep-alive",
  te: "trailers",
  "transfer-encoding": "chunked",
  trailer: "x-checksum",
  "content-length": "128",
  upgrade: "websocket",
  "x-hop-token": "remove-me",
  "x-forwarded-for": "203.0.113.10",
}, new URL("http://portal-opl-adapter:8788/api/opl-launch/sessions/bind"));

assert.equal(headers.host, "portal-opl-adapter:8788");
assert.equal(headers["content-type"], "application/json");
assert.equal(headers["x-forwarded-for"], "203.0.113.10");
assert.equal(headers.connection, undefined, "proxy must not forward hop-by-hop connection header");
assert.equal(headers["content-length"], undefined, "proxy must not forward stale content-length after buffering body");
assert.equal(headers["transfer-encoding"], undefined, "proxy must not forward transfer-encoding after buffering body");
assert.equal(headers.trailer, undefined, "proxy must not forward trailer after buffering body");
assert.equal(headers.te, undefined, "proxy must not forward te header");
assert.equal(headers.upgrade, undefined, "proxy must not forward upgrade header on normal fetch proxy");
assert.equal(headers["proxy-connection"], undefined, "proxy must not forward proxy-connection header");
assert.equal(headers["x-hop-token"], undefined, "proxy must not forward headers named by connection header");

console.log(JSON.stringify({
  ok: true,
  contract: "opl_web_gateway_proxy_hop_by_hop_headers",
}, null, 2));
