import { spawn } from "node:child_process";
import http from "node:http";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("exit", (code) => {
      if (code) reject(new Error(`command_failed:${code}:${stderr || stdout}`));
      else resolve({ stdout, stderr });
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, version: "opl-v19" }));
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end("<!doctype html><title>OPL v19</title>");
});

try {
  const port = await listen(server);
  const { stdout } = await runNode([
    "scripts/check-production-entry-health.mjs",
    `--hosts=127.0.0.1:${port}`,
    "--http-only",
  ]);
  const result = JSON.parse(stdout);
  assert(result.ok === true, "entry health smoke should pass");
  assert(result.hosts.length === 1, "entry health smoke host count mismatch");
  const host = result.hosts[0];
  assert(host.dns.ok === true, "dns check should pass");
  assert(host.tcp80.ok === true, "tcp check should pass");
  assert(host.http.status === 200, "http health status mismatch");
  assert(host.http.contentSample.includes("opl-v19"), "content sample should include version marker");

  console.log(JSON.stringify({
    ok: true,
    checked: ["dns", "tcp", "http_status", "content_sample"],
    status: host.http.status,
  }, null, 2));
} finally {
  await close(server);
}
