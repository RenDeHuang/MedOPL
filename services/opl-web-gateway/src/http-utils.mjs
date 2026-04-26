import { BASE_URL } from "./config.mjs";

export function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

export function copyHeaders(headers) {
  const next = {};
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === "content-encoding") continue;
    if (key.toLowerCase() === "content-length") continue;
    next[key] = value;
  }
  return next;
}

export function parseCookies(cookieHeader = "") {
  const cookies = {};
  for (const part of String(cookieHeader || "").split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    cookies[rawName] = decodeURIComponent(rawValue.join("=") || "");
  }
  return cookies;
}

export function appendSetCookie(headers, cookieValue) {
  const current = headers["set-cookie"];
  if (!current) {
    headers["set-cookie"] = cookieValue;
    return;
  }
  headers["set-cookie"] = Array.isArray(current) ? [...current, cookieValue] : [current, cookieValue];
}

export function buildTargetUrl(reqUrl, upstreamBase, prefix = "") {
  const incoming = new URL(reqUrl, BASE_URL);
  const target = new URL(upstreamBase);
  let pathname = incoming.pathname;
  if (prefix && pathname.startsWith(prefix)) {
    pathname = pathname.slice(prefix.length) || "/";
  }
  target.pathname = `${target.pathname.replace(/\/$/, "")}${pathname}`;
  target.search = incoming.search;
  return target;
}

export function sanitizeProxyHeaders(headers, target) {
  const next = { ...headers };
  delete next.host;
  delete next.connection;
  delete next["content-length"];
  next.host = target.host;
  return next;
}

export async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks) : null;
}
