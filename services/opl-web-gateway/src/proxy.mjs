import http from "node:http";
import https from "node:https";
import {
  ADAPTER_PREFIX,
  BASE_URL,
  LAUNCH_COOKIE,
} from "./config.mjs";
import { buildLaunchCookie } from "./portal-auth-bridge.mjs";
import { injectLaunchScript } from "./html-injection.mjs";
import {
  appendSetCookie,
  buildTargetUrl,
  copyHeaders,
  parseCookies,
  readRequestBody,
  sanitizeProxyHeaders,
} from "./http-utils.mjs";

export async function proxy(req, res, upstreamBase, prefix = "") {
  const target = buildTargetUrl(req.url || "/", upstreamBase, prefix);
  const body = await readRequestBody(req);
  const response = await fetch(target, {
    method: req.method || "GET",
    headers: sanitizeProxyHeaders(req.headers, target),
    body,
    redirect: "manual",
  });

  const headers = copyHeaders(response.headers);
  const incoming = new URL(req.url || "/", BASE_URL);
  const launchToken = incoming.searchParams.get("launch_token") || "";
  const hasLaunchCookie = Boolean(parseCookies(req.headers.cookie || "")[LAUNCH_COOKIE]);
  const directEntry = !launchToken && !hasLaunchCookie;
  if (!prefix && launchToken) appendSetCookie(headers, buildLaunchCookie(launchToken));
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const html = injectLaunchScript(await response.text(), directEntry);
    headers["content-type"] = contentType;
    headers["cache-control"] = "no-cache, no-store, must-revalidate";
    res.writeHead(response.status, headers);
    res.end(html);
    return;
  }

  res.writeHead(response.status, headers);
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}

export function writeRawHttpResponse(socket, response, head = null) {
  const statusCode = response.statusCode || 502;
  const statusMessage = response.statusMessage || "Bad Gateway";
  const lines = [`HTTP/1.1 ${statusCode} ${statusMessage}`];
  for (const [key, value] of Object.entries(response.headers || {})) {
    if (Array.isArray(value)) {
      for (const item of value) lines.push(`${key}: ${item}`);
    } else if (value !== undefined) {
      lines.push(`${key}: ${value}`);
    }
  }
  socket.write(`${lines.join("\r\n")}\r\n\r\n`);
  if (head?.length) socket.write(head);
}

export function writeUpgradeFailure(socket, statusCode, message) {
  if (socket.destroyed) return;
  socket.write([
    `HTTP/1.1 ${statusCode} ${message}`,
    "content-type: text/plain; charset=utf-8",
    "connection: close",
    "",
    message,
  ].join("\r\n"));
  socket.destroy();
}

export function proxyUpgrade(req, socket, head, upstreamBase, prefix = "") {
  const target = buildTargetUrl(req.url || "/", upstreamBase, prefix);
  const client = target.protocol === "https:" ? https : http;
  const headers = sanitizeProxyHeaders(req.headers, target);
  headers.connection = "Upgrade";
  headers.upgrade = req.headers.upgrade || "websocket";

  const upstream = client.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (target.protocol === "https:" ? 443 : 80),
    method: req.method || "GET",
    path: `${target.pathname}${target.search}`,
    headers,
  });

  upstream.on("upgrade", (response, upstreamSocket, upstreamHead) => {
    writeRawHttpResponse(socket, response, upstreamHead);
    if (head?.length) upstreamSocket.write(head);
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });

  upstream.on("response", (response) => {
    writeRawHttpResponse(socket, response);
    response.resume();
    socket.destroy();
  });

  upstream.on("error", (error) => {
    writeUpgradeFailure(socket, 502, String(error.message || error));
  });

  upstream.end();
}
