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
  return http.createServer((req, res) => {
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
}

function createBrowserVm({ gatewayUrl }) {
  const storage = new Map();
  const locationState = new URL(`${gatewayUrl}/`);
  const location = {
    href: locationState.href,
    search: locationState.search,
    origin: locationState.origin,
  };
  const window = {
    location,
    navigator: { userAgent: "opl-web-gateway-direct-entry-smoke" },
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
    dispatchEvent() {
      return true;
    },
  };

  const document = {
    title: "OPL",
    addEventListener() {},
    querySelector(selector) {
      if (selector === 'meta[name="opl-portal-direct-entry"]') {
        return {
          getAttribute(name) {
            if (name === "content") return "1";
            return null;
          },
        };
      }
      return null;
    },
  };

  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  return vm.createContext({
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
      return fetch(target, options);
    },
  });
}

const calls = { upstreamAuthUser: 0 };
const oplServer = startOplWebFixture(calls);
let gateway = null;

try {
  const [oplPort, gatewayPort] = [
    await listen(oplServer),
    await freePort(),
  ];
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  gateway = spawn("node", ["services/opl-web-gateway/src/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(gatewayPort),
      OPL_UPSTREAM_URL: `http://127.0.0.1:${oplPort}`,
      PORTAL_RUNTIME_BRIDGE_URL: "http://127.0.0.1:59999",
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
      PORTAL_PUBLIC_URL: "https://portal.example.test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  gateway.stdout.on("data", (chunk) => process.stdout.write(`[gateway] ${chunk}`));
  gateway.stderr.on("data", (chunk) => process.stderr.write(`[gateway] ${chunk}`));

  await waitFor(`${gatewayUrl}/healthz`);

  const healthResponse = await fetch(`${gatewayUrl}/healthz`);
  const health = await healthResponse.json();
  assert(health.directEntry.portalLaunchRequired === true, "healthz must declare portal launch requirement");
  assert(health.directEntry.authUserWithoutLaunchStatus === 401, "healthz must expose unauthenticated status contract");
  assert(health.directEntry.portalPublicUrl === "https://portal.example.test", "healthz must expose Portal public URL");

  const authResponse = await fetch(`${gatewayUrl}/api/auth/user`);
  assert(authResponse.status === 401, "direct entry auth must return 401");
  const auth = await authResponse.json();
  assert(auth.error === "unauthenticated", "direct entry auth error mismatch");
  assert(auth.portalLaunchRequired === true, "direct entry auth must require portal launch");
  assert(auth.portalPublicUrl === "https://portal.example.test", "direct entry auth must expose Portal URL");
  assert(calls.upstreamAuthUser === 0, "direct entry auth must not proxy upstream OPL noauth user");

  const htmlResponse = await fetch(`${gatewayUrl}/`);
  const html = await htmlResponse.text();
  assert(html.includes('meta name="opl-portal-direct-entry" content="1"'), "direct entry html must mark direct entry");
  assert(html.includes("/portal-launch.js"), "direct entry html must still inject portal launch script");

  const scriptResponse = await fetch(`${gatewayUrl}/portal-launch.js`);
  const script = await scriptResponse.text();
  const context = createBrowserVm({ gatewayUrl });
  vm.runInContext(script, context, { filename: "portal-launch.js" });

  assert(context.window.__OPL_PORTAL_DIRECT_ENTRY__.active === true, "direct entry state must stay active");
  assert(context.window.__OPL_PORTAL_DIRECT_ENTRY__.portalLaunchRequired === true, "direct entry state must require Portal launch");
  assert(context.window.__OPL_PORTAL_DIRECT_ENTRY__.portalPublicUrl === "https://portal.example.test", "direct entry state must expose Portal URL");
  assert(context.window.__OPL_PORTAL__.state.launchToken === undefined, "direct entry must not create launch state");

  console.log(JSON.stringify({
    ok: true,
    gatewayUrl,
    verified: [
      "healthz_direct_entry_contract",
      "auth_user_401_without_launch_cookie",
      "upstream_auth_user_not_used",
      "html_direct_entry_marker",
      "browser_direct_entry_state",
    ],
  }, null, 2));
} finally {
  if (gateway) gateway.kill();
  await close(oplServer);
}
