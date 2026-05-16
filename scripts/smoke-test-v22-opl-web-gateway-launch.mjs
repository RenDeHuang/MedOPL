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

function startOplWebFixture(calls) {
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
      calls.upstreamAuthUser += 1;
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

function startRuntimeBridgeFixture(calls) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://runtime-bridge.local");
    const authorization = String(req.headers.authorization || "");
    const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
    if (url.pathname.startsWith("/api/opl-launch/") && bearer !== "launch-token-smoke") {
      res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "launch_token_invalid" }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/opl-launch/bootstrap") {
      calls.bootstrap.push({
        authorization,
        launchTokenQuery: url.searchParams.get("launch_token") || "",
        cookie: req.headers.cookie || "",
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
        tenantId: "tenant-smoke",
        workspaceId: "workspace-smoke",
        workspaceSessionId: "workspace-session-smoke",
        runtimeSessionId: "runtime-session-smoke",
      },
      identity: {
        portalUserId: "portal-user-smoke",
        tenantId: "tenant-smoke",
        workspaceId: "workspace-smoke",
        workspaceSessionId: "workspace-session-smoke",
        runtimeSessionId: "runtime-session-smoke",
        oplSessionId: "opl-session-smoke",
      },
      ownership: {
        workspaceOwnerId: "portal-user-smoke",
        sessionOwnerId: "portal-user-smoke",
        traceOwnerId: "portal-user-smoke",
        artifactOwnerId: "portal-user-smoke",
        storageOwnerId: "portal-user-smoke",
      },
      workspace: {
        workspaceId: "workspace-smoke",
        workspacePath: "C:\\\\tmp\\\\workspace-smoke",
        inputOwner: "portal-user-smoke",
        outputOwner: "portal-user-smoke",
        storageOwner: "portal-user-smoke",
        storageOwnerId: "portal-user-smoke",
      },
      provider: {
        providerConfigured: true,
        providerConfigStatus: "configured",
      },
      }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/opl-launch/runs") {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      calls.runs.push({
        body,
        authorization,
        launchTokenQuery: url.searchParams.get("launch_token") || "",
        cookie: req.headers.cookie || "",
      });
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
      calls.status.push({
        runId: "run-smoke",
        authorization,
        launchTokenQuery: url.searchParams.get("launch_token") || "",
        cookie: req.headers.cookie || "",
      });
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
      calls.artifacts.push({
        runId: "run-smoke",
        authorization,
        launchTokenQuery: url.searchParams.get("launch_token") || "",
        cookie: req.headers.cookie || "",
      });
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
      calls.bind.push({
        body: JSON.parse(raw || "{}"),
        authorization,
        launchTokenQuery: url.searchParams.get("launch_token") || "",
        cookie: req.headers.cookie || "",
      });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, bound: true }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", path: url.pathname }));
  });
  return server;
}

function createBrowserVm({ gatewayUrl }) {
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
  const locationState = new URL(`${gatewayUrl}/`);
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
    querySelector(selector) {
      if (selector === 'meta[name="opl-portal-direct-entry"]') {
        return {
          getAttribute(name) {
            if (name === "content") return "0";
            return null;
          },
        };
      }
      return null;
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
    performance: {
      now: () => Date.now(),
    },
    fetch(input, options) {
      const target = new URL(String(input), gatewayUrl);
      return fetch(target, {
        ...options,
        headers: {
          cookie: "opl_portal_launch=launch-token-smoke",
          ...(options && options.headers ? options.headers : {}),
        },
      });
      },
    }),
    ready,
    runStarted,
    storage,
    window,
    document,
  };
}

const calls = { bootstrap: [], bind: [], runs: [], status: [], artifacts: [], upstreamAuthUser: 0 };
const oplServer = startOplWebFixture(calls);
const runtimeBridgeServer = startRuntimeBridgeFixture(calls);
let gateway = null;

try {
  const [oplPort, runtimeBridgePort, gatewayPort] = [
    await listen(oplServer),
    await listen(runtimeBridgeServer),
    await freePort(),
  ];
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  gateway = spawn("node", ["services/opl-web-gateway/src/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(gatewayPort),
      OPL_WEB_UPSTREAM_URL: `http://127.0.0.1:${oplPort}`,
      PORTAL_RUNTIME_BRIDGE_URL: `http://127.0.0.1:${runtimeBridgePort}`,
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
      PORTAL_PUBLIC_URL: "https://portal.example.test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  gateway.stdout.on("data", (chunk) => process.stdout.write(`[gateway] ${chunk}`));
  gateway.stderr.on("data", (chunk) => process.stderr.write(`[gateway] ${chunk}`));

  await waitFor(`${gatewayUrl}/healthz`);
  const directEntryHtmlResponse = await fetch(`${gatewayUrl}/`);
  const directEntryHtml = await directEntryHtmlResponse.text();
  assert(directEntryHtml.includes("返回 Portal"), "direct entry html must include Portal continue entry");
  assert(directEntryHtml.includes("https://portal.example.test/portal/opl"), "direct entry html must link to Portal continue URL");
  assert(directEntryHtml.includes('meta name="opl-portal-direct-entry" content="1"'), "direct entry html must mark direct entry as true");

  const unauthenticatedResponse = await fetch(`${gatewayUrl}/api/auth/user`);
  const unauthenticatedPayload = await unauthenticatedResponse.json();
  assert(unauthenticatedResponse.status === 401, "auth user without launch must return 401");
  assert(unauthenticatedPayload.portalLaunchRequired === true, "auth user without launch must require Portal launch");
  assert(unauthenticatedPayload.reason === "portal_login_or_launch_required", "auth user without launch must expose direct entry reason");

  const htmlResponse = await fetch(`${gatewayUrl}/?launch_token=launch-token-smoke`);
  const setCookie = htmlResponse.headers.get("set-cookie") || "";
  assert(setCookie.includes("opl_portal_launch=launch-token-smoke"), "gateway did not set launch cookie");
  const html = await htmlResponse.text();
  assert(html.includes("/portal-launch.js"), "gateway did not inject portal launch script");
  assert(html.includes('meta name="opl-portal-direct-entry" content="0"'), "launch html must mark direct entry as false");

  const portalUserResponse = await fetch(`${gatewayUrl}/api/auth/user`, {
    headers: { cookie: setCookie.split(";")[0] },
  });
  const portalUser = await portalUserResponse.json();
  assert(portalUser.success === true, "gateway launch SSO auth user response failed");
  assert(portalUser.user.id === "portal-user-smoke", "gateway auth user did not resolve Portal user");
  assert(portalUser.user.username === "portal-smoke@example.test", "gateway auth user username should come from Portal email");
  assert(portalUser.user.source === "portal-launch", "gateway auth user source must be Portal launch");
  assert(calls.upstreamAuthUser === 0, "gateway auth user must not proxy upstream OPL noauth user");
  const bootstrapCallsBeforeScript = calls.bootstrap.length;

  const scriptResponse = await fetch(`${gatewayUrl}/portal-launch.js`);
  const script = await scriptResponse.text();
  assert(script.includes("/runtime-bridge"), "portal launch script must use same-origin runtime bridge proxy");
  assert(script.includes("window.__OPL_PORTAL__"), "portal launch script must expose stable browser API");

  const browser = createBrowserVm({ gatewayUrl });
  vm.runInContext(script, browser.context, { filename: "portal-launch.js" });
  const detail = await Promise.race([
    browser.ready,
    sleep(5000).then(() => {
      throw new Error("portal launch script did not finish");
    }),
  ]);

  assert(detail.state.authenticated === true, "launch ready event must expose public authenticated state");
  assert(detail.state.runtimeBridgeUrl === "/runtime-bridge", "launch ready event must expose same-origin runtime bridge");
  assert(detail.state.launchToken === undefined, "launch ready event must not expose launch token");
  assert(browser.window.__OPL_PORTAL_LAUNCH__.bootstrap.launch.runtimeSessionId === "runtime-session-smoke", "bootstrap runtime session was not stored");
  assert(browser.window.__OPL_PORTAL_LAUNCH__.bootstrap.identity === undefined, "bootstrap identity must not be exposed in global launch state");
  assert(browser.window.__OPL_PORTAL_LAUNCH__.bootstrap.ownership === undefined, "bootstrap ownership must not be exposed in global launch state");
  assert(browser.window.__OPL_PORTAL_DIRECT_ENTRY__.active === false, "launch flow should clear direct entry state");
  assert(browser.window.__OPL_PORTAL__.bootstrap.portal.portalUserId === "portal-user-smoke", "stable browser API did not expose bootstrap");
  assert(calls.bootstrap.length >= bootstrapCallsBeforeScript + 2, "runtime bridge bootstrap was not called through cookie-only gateway flow");
  assert(calls.bootstrap.at(-1).authorization === "Bearer launch-token-smoke", "gateway must inject launch token as Authorization");
  assert(calls.bootstrap.at(-1).launchTokenQuery === "", "gateway must not inject launch token query");
  assert(!calls.bootstrap.at(-1).cookie.includes("opl_portal_launch"), "gateway must not forward launch cookie to adapter");
  assert(calls.bind.length === 1, "runtime bridge session bind was not called through gateway");
  assert(calls.bind[0].authorization === "Bearer launch-token-smoke", "gateway must inject Authorization for bind");
  assert(calls.bind[0].launchTokenQuery === "", "bind callback must not include launch token query");
  assert(!calls.bind[0].cookie.includes("opl_portal_launch"), "bind callback must not forward launch cookie");
  assert(calls.bind[0].body.source === "opl-web-gateway", "session bind source mismatch");
  assert(calls.bind[0].body.runtimeSessionId === "runtime-session-smoke", "runtime session bind mismatch");
  assert(!browser.window.location.search.includes("launch_token"), "launch token should be stripped from browser URL after bind");
  assert(!JSON.stringify([...browser.storage.values()]).includes("launch-token-smoke"), "sessionStorage must not contain launch token");
  assert(!JSON.stringify(browser.window.__OPL_PORTAL_LAUNCH__).includes("launch-token-smoke"), "global launch state must not contain launch token");
  assert(browser.window.__OPL_PORTAL_NATIVE_RUN_BRIDGE_INSTALLED__ === true, "native OPL module click bridge was not installed");
  assert(typeof browser.window.__OPL_PORTAL_TIMING__.portal_launch_ready_ms === "number", "portal launch ready timing marker missing");
  assert(browser.window.__OPL_PORTAL_TIMING__.markers.some((item) => item.marker === "portal_launch_ready_ms"), "portal launch ready telemetry event missing");

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
        if (selector.includes("opl-module-pill-")) return nativeModuleElement;
        return null;
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
  assert(typeof browser.window.__OPL_PORTAL_TIMING__.opl_first_interaction_ms === "number", "first interaction timing marker missing");
  assert(calls.runs.at(-1).authorization === "Bearer launch-token-smoke", "gateway must inject Authorization for native run");
  assert(calls.runs.at(-1).launchTokenQuery === "", "native run callback must not include launch token query");
  assert(!calls.runs.at(-1).cookie.includes("opl_portal_launch"), "native run callback must not forward launch cookie");
  assert(calls.runs.at(-1).body.launchToken === undefined, "native run body must not include launch token");
  assert(calls.runs.at(-1).body.agentId === "mas", "native module bridge did not call MAS run");
  assert(calls.runs.at(-1).body.source === "opl-web-native-ui-click", "native module bridge source mismatch");

  const run = await browser.window.__OPL_PORTAL__.startRun({ runId: "run-smoke", agentId: "mas" });
  assert(run.runId === "run-smoke", "stable browser API did not start run");
  assert(calls.runs.length >= 2, "runtime bridge run callback was not called");
  assert(calls.runs.at(-1).authorization === "Bearer launch-token-smoke", "stable browser run must use gateway Authorization injection");
  assert(calls.runs.at(-1).body.launchToken === undefined, "stable browser run body must not include launch token");
  const status = await browser.window.__OPL_PORTAL__.getRunStatus("run-smoke");
  assert(status.status === "succeeded", "stable browser API did not read run status");
  assert(calls.status.at(-1).authorization === "Bearer launch-token-smoke", "run status must use gateway Authorization injection");
  assert(calls.status.at(-1).launchTokenQuery === "", "run status must not include launch token query");
  const artifacts = await browser.window.__OPL_PORTAL__.getArtifacts("run-smoke");
  assert(artifacts.items.length === 1, "stable browser API did not read artifacts");
  assert(calls.artifacts.at(-1).authorization === "Bearer launch-token-smoke", "artifacts must use gateway Authorization injection");
  assert(calls.artifacts.at(-1).launchTokenQuery === "", "artifacts must not include launch token query");

  console.log(JSON.stringify({
    ok: true,
    gatewayUrl,
    verified: [
      "html_script_injection",
      "same_origin_runtime_bridge_proxy",
      "bootstrap_fetch",
      "bootstrap_identity_scope",
      "direct_entry_portal_continue",
      "session_bind",
      "launch_token_removed_from_url",
      "launch_cookie_sso",
      "upstream_auth_user_not_used",
      "stable_browser_run_api",
      "native_module_click_run_bridge",
    ],
  }, null, 2));
} finally {
  if (gateway) gateway.kill();
  await close(oplServer);
  await close(runtimeBridgeServer);
}
