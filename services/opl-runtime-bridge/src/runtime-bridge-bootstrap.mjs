import http from "node:http";
import { createRuntimeBridgeRuntime } from "./runtime-bridge-routes.mjs";

export function createRuntimeBridgeServer() {
  const runtime = createRuntimeBridgeRuntime();
  return http.createServer((req, res) => {
    runtime.handleRequest(req, res).catch((error) => {
      console.error(error);
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: String(error.message || error) }, null, 2));
    });
  });
}

export async function startRuntimeBridgeServer() {
  const runtime = createRuntimeBridgeRuntime();
  await runtime.ensureRuntime();
  const server = http.createServer((req, res) => {
    runtime.handleRequest(req, res).catch((error) => {
      console.error(error);
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: String(error.message || error) }, null, 2));
    });
  });
  await new Promise((resolve) => server.listen(runtime.config.port, resolve));
  console.log(JSON.stringify({ ...runtime.buildStatusPayload(), port: runtime.config.port }, null, 2));
  return server;
}
