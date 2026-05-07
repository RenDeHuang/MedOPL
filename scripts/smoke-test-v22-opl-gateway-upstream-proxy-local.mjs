import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const gatewaySrcRoot = path.join(repoRoot, "services/opl-web-gateway/src");

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

async function waitFor(url, { allowStatus = (status) => status < 500 } = {}) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (allowStatus(response.status)) return response;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
}

function spawnGateway({ port, env = {} }) {
  const childEnv = { ...process.env };
  delete childEnv.OPL_UPSTREAM_URL;
  delete childEnv.OPL_WEB_UPSTREAM_URL;
  delete childEnv.OPL_WEB_URL;
  return spawn(process.execPath, ["services/opl-web-gateway/src/server.mjs"], {
    cwd: repoRoot,
    env: {
      ...childEnv,
      PORT: String(port),
      OPL_WEB_GATEWAY_PUBLIC_URL: `http://127.0.0.1:${port}`,
      PORTAL_PUBLIC_URL: "https://portal.medopl.cn",
      PORTAL_OPL_ADAPTER_URL: "http://127.0.0.1:59998",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function stopChild(child) {
  if (!child || child.killed) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(1500),
  ]);
}

function startUpstreamFixture(calls) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://upstream.local");
    calls.push({
      method: req.method || "GET",
      path: url.pathname,
      search: url.search,
      authorization: req.headers.authorization || "",
    });

    if (url.pathname === "/healthz") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, service: "clean-one-person-lab-fixture" }));
      return;
    }

    if (url.pathname === "/") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "x-upstream-fixture": "one-person-lab-clean",
      });
      res.end([
        "<!doctype html>",
        "<html>",
        "<head><title>Clean OPL Upstream</title></head>",
        "<body>",
        "<main id=\"root\">clean upstream one-person-lab Web</main>",
        "<form action=\"/login\" method=\"post\">",
        "<input name=\"email\">",
        "<input name=\"password\" type=\"password\">",
        "<button type=\"submit\">Sign in</button>",
        "</form>",
        "</body>",
        "</html>",
      ].join(""));
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  });
}

async function readGatewaySourceCorpus() {
  const entries = await readdir(gatewaySrcRoot, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => path.join(gatewaySrcRoot, entry.name));
  const pairs = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")]));
  return {
    files,
    text: pairs.map(([, source]) => source).join("\n"),
    byFile: Object.fromEntries(pairs),
  };
}

function extractFunctionSource(source, functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  assert(start >= 0, `missing_function:${functionName}`);
  const next = source.indexOf("\nfunction ", start + marker.length);
  return source.slice(start, next >= 0 ? next : undefined);
}

function assertNoForbiddenStorageSecretWrite(source) {
  const storageWrites = source
    .split("\n")
    .filter((line) => /(?:localStorage|sessionStorage)\.setItem/.test(line));
  const forbidden = /raw\s*api|apiKey|providerApiKey|providerKey|launchToken|launch_token|runtimeToken|runtime_token|bearer|token/i;
  for (const line of storageWrites) {
    assert.equal(forbidden.test(line), false, `storage_write_must_not_include_secret_or_token:${line.trim()}`);
  }
  assert.equal(/localStorage\.setItem/.test(source), false, "gateway_must_not_write_local_storage");
}

function assertPublicContextWhitelist(source) {
  const publicLaunchState = extractFunctionSource(source, "publicLaunchState");
  const publicBootstrapPayload = extractFunctionSource(source, "publicBootstrapPayload");
  const publicSessionBindPayload = extractFunctionSource(source, "publicSessionBindPayload");
  const publicContext = [publicLaunchState, publicBootstrapPayload, publicSessionBindPayload].join("\n");

  for (const required of [
    "workspaceId",
    "sessionId",
    "launchStatus",
    "providerBound",
    "providerKeyRef",
    "portalReturnUrl",
  ]) {
    assert(publicContext.includes(required), `public_context_missing_safe_field:${required}`);
  }

  for (const forbidden of [
    "raw API Key",
    "rawProviderKey",
    "providerApiKey",
    "apiKey",
    "launchToken",
    "runtimeToken",
    "bearer token",
    "authorization",
    "objectKey",
    "storageKey",
    "localPath",
    "signedUrl",
    "runtimeUrl",
    "portalUserEmail",
    "portalUserName",
    "portal: bootstrap.portal",
    "workspace: bootstrap.workspace",
  ]) {
    assert.equal(publicContext.includes(forbidden), false, `public_context_must_not_expose:${forbidden}`);
  }
}

function assertGatewayStaticBoundaries(corpus) {
  assert(corpus.text.includes("OPL_UPSTREAM_URL"), "gateway_must_read_opl_upstream_url_config");
  assert.equal(corpus.text.includes("127.0.0.1:13030"), false, "gateway_must_not_fallback_to_hardcoded_local_upstream");
  assert.equal(/searchParams\.get\(["']launch_token["']\)/.test(corpus.text), false, "gateway_must_not_read_launch_token_query");
  assert.equal(/searchParams\.get\(["']runtime_token["']\)/.test(corpus.text), false, "gateway_must_not_read_runtime_token_query");
  assert.equal(/from\s+["'][^"']*one-person-lab[^"']*["']/.test(corpus.text), false, "gateway_must_not_import_one_person_lab");
  assert.equal(/from\s+["'][^"']*(?:v19|v20|v21)[^"']*["']/.test(corpus.text), false, "gateway_must_not_import_legacy_upstream_path");
  assertNoForbiddenStorageSecretWrite(corpus.text);
  assertPublicContextWhitelist(corpus.byFile[path.join(gatewaySrcRoot, "launch-client-script.mjs")]);
}

async function assertUnconfiguredGatewayFailsWithStableError() {
  const port = await freePort();
  const child = spawnGateway({ port });
  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitFor(`${baseUrl}/healthz`);
    const health = await (await fetch(`${baseUrl}/healthz`)).json();
    assert.equal(health.runtime.upstreamConfigured, false, "healthz_must_mark_upstream_unconfigured");
    assert.equal(health.runtime.upstreamUrl, null, "healthz_must_not_report_fallback_upstream_url");

    const response = await fetch(`${baseUrl}/`, { redirect: "manual" });
    const payload = await response.json();
    assert.equal(response.status, 503, "unconfigured_upstream_status_mismatch");
    assert.equal(payload.error, "opl_upstream_url_required", "unconfigured_upstream_error_mismatch");
  } finally {
    await stopChild(child);
  }
}

async function assertConfiguredGatewayProxiesCleanUpstream() {
  const calls = [];
  const upstream = startUpstreamFixture(calls);
  const upstreamPort = await listen(upstream);
  const gatewayPort = await freePort();
  const gateway = spawnGateway({
    port: gatewayPort,
    env: {
      OPL_UPSTREAM_URL: `http://127.0.0.1:${upstreamPort}`,
    },
  });

  try {
    const baseUrl = `http://127.0.0.1:${gatewayPort}`;
    await waitFor(`${baseUrl}/healthz`);
    const health = await (await fetch(`${baseUrl}/healthz`)).json();
    assert.equal(health.runtime.upstreamConfigured, true, "healthz_must_mark_upstream_configured");
    assert.equal(health.runtime.upstreamConfigKey, "OPL_UPSTREAM_URL", "healthz_must_report_canonical_upstream_config_key");
    assert.equal(health.runtime.upstreamUrl, `http://127.0.0.1:${upstreamPort}`, "healthz_must_use_opl_upstream_url");

    const htmlResponse = await fetch(`${baseUrl}/`);
    const html = await htmlResponse.text();
    assert.equal(htmlResponse.status, 200, "gateway_html_proxy_status_mismatch");
    assert(html.includes("clean upstream one-person-lab Web"), "gateway_must_proxy_upstream_html");
    assert(html.includes("/portal-launch.js"), "gateway_must_inject_public_launch_script");
    assert.equal(html.includes("raw API Key"), false, "gateway_html_must_not_expose_raw_api_key_copy");
    assert.equal(html.includes("launchToken"), false, "gateway_html_must_not_expose_launch_token");
    assert.equal(html.includes("runtimeToken"), false, "gateway_html_must_not_expose_runtime_token");

    const upstreamHealth = await fetch(`${baseUrl}/healthz`, { headers: { accept: "application/json" } });
    assert.equal(upstreamHealth.status, 200, "gateway_healthz_must_remain_gateway_status");
    assert(calls.some((call) => call.path === "/"), "upstream_html_must_receive_gateway_proxy_call");
    assert.equal(calls.some((call) => /launchToken|runtimeToken|apiKey|launch_token|runtime_token|api_key/i.test(call.search)), false, "upstream_must_not_receive_secret_query");
  } finally {
    await stopChild(gateway);
    await close(upstream);
  }
}

async function assertForbiddenQuerySecretsAreRejected() {
  const calls = [];
  const upstream = startUpstreamFixture(calls);
  const upstreamPort = await listen(upstream);
  const gatewayPort = await freePort();
  const gateway = spawnGateway({
    port: gatewayPort,
    env: {
      OPL_UPSTREAM_URL: `http://127.0.0.1:${upstreamPort}`,
    },
  });

  try {
    const baseUrl = `http://127.0.0.1:${gatewayPort}`;
    await waitFor(`${baseUrl}/healthz`);
    for (const query of [
      "launchToken=secret-launch",
      "runtimeToken=secret-runtime",
      "apiKey=secret-api-key",
      "launch_token=secret-launch",
      "runtime_token=secret-runtime",
      "api_key=secret-api-key",
    ]) {
      const response = await fetch(`${baseUrl}/?${query}`, { redirect: "manual" });
      const payload = await response.json();
      assert.equal(response.status, 400, `forbidden_query_status_mismatch:${query}`);
      assert.equal(payload.error, "gateway_query_secret_forbidden", `forbidden_query_error_mismatch:${query}`);
    }
    assert.equal(calls.length, 0, "forbidden_query_must_not_reach_upstream");
  } finally {
    await stopChild(gateway);
    await close(upstream);
  }
}

const corpus = await readGatewaySourceCorpus();
assertGatewayStaticBoundaries(corpus);
await assertUnconfiguredGatewayFailsWithStableError();
await assertConfiguredGatewayProxiesCleanUpstream();
await assertForbiddenQuerySecretsAreRejected();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_opl_gateway_upstream_proxy_local",
  verified: [
    "OPL_UPSTREAM_URL_config",
    "upstream_required_without_fallback",
    "local_html_proxy",
    "safe_public_launch_context",
    "forbidden_query_secret_rejection",
    "no_one_person_lab_internal_import",
  ],
}, null, 2));
