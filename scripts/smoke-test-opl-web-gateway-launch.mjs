import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import vm from "node:vm";
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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks).toString("utf8") : "";
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

function startOplWebFixture() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://opl-web.local");
    if (url.pathname === "/") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": "default-src 'self'; script-src 'self'; connect-src 'self';",
      });
      res.end("<!doctype html><html><head><title>OPL</title></head><body><div id=\"root\"></div></body></html>");
      return;
    }
    if (url.pathname === "/api/auth/user") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        success: true,
        user: {
          id: "opl-webui-noauth",
          username: "admin",
          source: "upstream-noauth",
        },
      }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });
  return server;
}

function startAdapterFixture(calls) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://adapter.local");
    if (req.method === "GET" && url.pathname === "/api/opl-launch/bootstrap") {
      calls.bootstrap.push({
        launchToken: url.searchParams.get("launch_token") || "",
      });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        version: "v1",
        launch: {
          launchId: "launch-smoke",
          workspaceId: "workspace-smoke",
          workspaceSessionId: "workspace-session-smoke",
          runtimeSessionId: "runtime-session-smoke",
        },
        portal: {
          portalUserId: "portal-user-smoke",
          portalUserEmail: "portal-smoke@example.test",
          portalUserName: "Portal Smoke",
          workspaceId: "workspace-smoke",
          workspaceSessionId: "workspace-session-smoke",
          runtimeSessionId: "runtime-session-smoke",
        },
        workspace: {
          workspacePath: "C:\\\\tmp\\\\workspace-smoke",
        },
      }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/opl-launch/runs") {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      calls.runs.push(body);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        ok: true,
        runId: body.runId || "run-smoke",
        run: {
          runId: body.runId || "run-smoke",
          status: "submitted",
          agentId: body.agentId || "mas",
        },
      }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/opl-launch/runs/run-smoke/status") {
      calls.status.push({ runId: "run-smoke" });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        ok: true,
        status: "succeeded",
        run: {
          runId: "run-smoke",
          status: "succeeded",
        },
      }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/opl-launch/runs/run-smoke/artifacts") {
      calls.artifacts.push({ runId: "run-smoke" });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        ok: true,
        items: [
          {
            runId: "run-smoke",
            name: "result.json",
            objectKey: "runs/run-smoke/result.json",
          },
        ],
      }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/opl-launch/sessions/bind") {
      const raw = await readBody(req);
      calls.bind.push(JSON.parse(raw || "{}"));
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, bound: true }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", path: url.pathname }));
  });
  return server;
}

function createBrowserVm({ gatewayUrl, launchToken }) {
  const storage = new Map();
  const documentListeners = new Map();
  let resolveReady;
  let rejectReady;
  let resolveRunStarted;
  let rejectRunStarted;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const runStarted = new Promise((resolve, reject) => {
    resolveRunStarted = resolve;
    rejectRunStarted = reject;
  });
  const locationState = new URL(`${gatewayUrl}/?launch_token=${encodeURIComponent(launchToken)}&portal_adapter_url=http%3A%2F%2Fold-adapter.invalid`);
  const location = {
    href: locationState.href,
    search: locationState.search,
    origin: locationState.origin,
  };
  const window = {
    location,
    navigator: { userAgent: "opl-web-gateway-smoke" },
    sessionStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    history: {
      replaceState(_state, _title, nextUrl) {
        const parsed = new URL(nextUrl);
        location.href = parsed.href;
        location.search = parsed.search;
        location.origin = parsed.origin;
      },
    },
    dispatchEvent(event) {
      if (event.type === "opl:portal-launch-ready") resolveReady(event.detail);
      if (event.type === "opl:portal-launch-error") rejectReady(new Error(String(event.detail || "portal launch failed")));
      if (event.type === "opl:portal-run-started") resolveRunStarted(event.detail);
      if (event.type === "opl:portal-run-error") rejectRunStarted(new Error(String(event.detail?.error || "portal run failed")));
      return true;
    },
  };

  const document = {
    title: "OPL",
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    dispatchEvent(event) {
      for (const listener of documentListeners.get(event.type) || []) {
        listener(event);
      }
      return true;
    },
  };

  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  return {
    context: vm.createContext({
      window,
      document,
      navigator: window.navigator,
      sessionStorage: window.sessionStorage,
      history: window.history,
      CustomEvent,
      URL,
      URLSearchParams,
      console,
      fetch(input, options) {
        const target = new URL(String(input), gatewayUrl);
        return fetch(target, options);
      },
    }),
    ready,
    runStarted,
    storage,
    window,
    document,
  };
}

const calls = { bootstrap: [], bind: [], runs: [], status: [], artifacts: [] };
const oplServer = startOplWebFixture();
const adapterServer = startAdapterFixture(calls);
let gateway = null;

try {
  const [oplPort, adapterPort, gatewayPort] = [
    await listen(oplServer),
    await listen(adapterServer),
    await freePort(),
  ];
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  gateway = spawn("node", ["services/opl-web-gateway/src/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(gatewayPort),
      OPL_WEB_UPSTREAM_URL: `http://127.0.0.1:${oplPort}`,
      PORTAL_OPL_ADAPTER_URL: `http://127.0.0.1:${adapterPort}`,
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  gateway.stdout.on("data", (chunk) => process.stdout.write(`[gateway] ${chunk}`));
  gateway.stderr.on("data", (chunk) => process.stderr.write(`[gateway] ${chunk}`));

  await waitFor(`${gatewayUrl}/healthz`);
  const upstreamUserResponse = await fetch(`${gatewayUrl}/api/auth/user`);
  const upstreamUser = await upstreamUserResponse.json();
  assert(upstreamUser.user.source === "upstream-noauth", "gateway must not fake a Portal user without launch cookie");

  const htmlResponse = await fetch(`${gatewayUrl}/?launch_token=launch-token-smoke`);
  const setCookie = htmlResponse.headers.get("set-cookie") || "";
  assert(setCookie.includes("opl_portal_launch=launch-token-smoke"), "gateway did not set launch cookie");
  const html = await htmlResponse.text();
  assert(html.includes("/portal-launch.js"), "gateway did not inject portal launch script");

  const portalUserResponse = await fetch(`${gatewayUrl}/api/auth/user`, {
    headers: { cookie: setCookie.split(";")[0] },
  });
  const portalUser = await portalUserResponse.json();
  assert(portalUser.success === true, "gateway launch SSO auth user response failed");
  assert(portalUser.user.id === "portal-user-smoke", "gateway auth user did not resolve Portal user");
  assert(portalUser.user.username === "portal-smoke@example.test", "gateway auth user username should come from Portal email");
  const bootstrapCallsBeforeScript = calls.bootstrap.length;

  const scriptResponse = await fetch(`${gatewayUrl}/portal-launch.js`);
  const script = await scriptResponse.text();
  assert(script.includes("/portal-adapter"), "portal launch script must use same-origin adapter proxy");
  assert(script.includes("window.__OPL_PORTAL__"), "portal launch script must expose stable browser API");

  const browser = createBrowserVm({ gatewayUrl, launchToken: "launch-token-smoke" });
  vm.runInContext(script, browser.context, { filename: "portal-launch.js" });
  const detail = await Promise.race([
    browser.ready,
    sleep(5000).then(() => {
      throw new Error("portal launch script did not finish");
    }),
  ]);

  assert(detail.bootstrap.portal.runtimeSessionId === "runtime-session-smoke", "bootstrap runtime session was not stored");
  assert(browser.window.__OPL_PORTAL__.bootstrap.portal.portalUserId === "portal-user-smoke", "stable browser API did not expose bootstrap");
  assert(calls.bootstrap.length === bootstrapCallsBeforeScript + 1, "adapter bootstrap was not called through gateway");
  assert(calls.bootstrap.at(-1).launchToken === "launch-token-smoke", "launch token was not forwarded");
  assert(calls.bind.length === 1, "adapter session bind was not called through gateway");
  assert(calls.bind[0].source === "opl-web-gateway", "session bind source mismatch");
  assert(calls.bind[0].runtimeSessionId === "runtime-session-smoke", "runtime session bind mismatch");
  assert(!browser.window.location.search.includes("launch_token"), "launch token should be stripped from browser URL after bind");
  assert(browser.window.__OPL_PORTAL_NATIVE_RUN_BRIDGE_INSTALLED__ === true, "native OPL module click bridge was not installed");

  const nativeModuleElement = {
    textContent: "MAS 医学研究",
    getAttribute(name) {
      if (name === "data-testid") return "opl-module-pill-mas";
      if (name === "data-opl-module-id") return "";
      return "";
    },
  };
  browser.document.dispatchEvent({
    type: "click",
    target: {
      closest(selector) {
        assert(selector.includes("opl-module-pill-"), "native bridge selector mismatch");
        return nativeModuleElement;
      },
    },
  });
  const nativeRun = await Promise.race([
    browser.runStarted,
    sleep(5000).then(() => {
      throw new Error("native module click did not start a Portal run");
    }),
  ]);
  assert(nativeRun.module.moduleId === "mas", "native module bridge did not resolve MAS module");
  assert(calls.runs.at(-1).agentId === "mas", "native module bridge did not call MAS run");
  assert(calls.runs.at(-1).source === "opl-web-native-ui-click", "native module bridge source mismatch");

  const run = await browser.window.__OPL_PORTAL__.startRun({ runId: "run-smoke", agentId: "mas" });
  assert(run.runId === "run-smoke", "stable browser API did not start run");
  assert(calls.runs.length >= 2, "adapter run callback was not called");
  assert(calls.runs[0].launchToken === "launch-token-smoke", "run callback did not include launch token");
  const status = await browser.window.__OPL_PORTAL__.getRunStatus("run-smoke");
  assert(status.status === "succeeded", "stable browser API did not read run status");
  const artifacts = await browser.window.__OPL_PORTAL__.getArtifacts("run-smoke");
  assert(artifacts.items.length === 1, "stable browser API did not read artifacts");

  console.log(JSON.stringify({
    ok: true,
    gatewayUrl,
    verified: [
      "html_script_injection",
      "same_origin_adapter_proxy",
      "bootstrap_fetch",
      "session_bind",
      "launch_token_removed_from_url",
      "launch_cookie_sso",
      "stable_browser_run_api",
      "native_module_click_run_bridge",
    ],
  }, null, 2));
} finally {
  if (gateway) gateway.kill();
  await close(oplServer);
  await close(adapterServer);
}
