import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
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

function startUpstreamFixture(calls) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://upstream.local");
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<!doctype html><html><body><form method=\"post\" action=\"/login\"><input name=\"email\" /><input name=\"password\" /><button type=\"submit\">login</button></form></body></html>");
      return;
    }
    if (req.method === "POST" && (url.pathname === "/login" || url.pathname === "/api/auth/signin" || url.pathname === "/api/v1/auths/signin")) {
      calls.upstreamLogin += 1;
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ success: false, error: "should_not_proxy_login" }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/auth/user") {
      calls.upstreamAuthUser += 1;
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        success: true,
        user: { id: "upstream", username: "admin", source: "upstream" },
      }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  });
}

function startPortalFixture(calls) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://portal.local");
    if (req.method === "POST" && url.pathname === "/internal/opl/auth/login") {
      calls.portalLogin += 1;
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      if (payload.email !== "native-login@example.test" || payload.password !== "PortalPass123!") {
        res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({
          ok: false,
          error: "invalid_credentials",
          message: "账号或密码错误。",
        }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        ok: true,
        user: {
          id: "portal-user-native",
          email: "native-login@example.test",
          name: "Native Login",
          role: "user",
          status: "active",
        },
        launchToken: "launch-native-123",
        launch: {
          launchId: "launch-native",
          launchToken: "launch-native-123",
          runtimeSessionId: "runtime-native",
        },
        workspace: {
          slug: payload.task || "default",
          title: "Default Task",
        },
        workspaceSession: {
          id: "workspace-session-native",
          workspaceId: payload.task || "default",
        },
        runtimeSession: {
          runtimeSessionId: "runtime-native",
          oplSessionId: "opl-session-native",
        },
      }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "not_found", path: url.pathname }));
  });
}

function startRuntimeBridgeFixture(calls) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://runtime-bridge.local");
    if (req.method === "GET" && url.pathname === "/api/opl-launch/bootstrap") {
      const launchToken = url.searchParams.get("launch_token") || "";
      calls.bootstrap.push(launchToken);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        launch: {
          launchId: "launch-native",
          workspaceId: "default",
          workspaceSessionId: "workspace-session-native",
          runtimeSessionId: "runtime-native",
        },
        portal: {
          portalUserId: "portal-user-native",
          portalUserEmail: "native-login@example.test",
          portalUserName: "Native Login",
          workspaceId: "default",
          workspaceSessionId: "workspace-session-native",
          runtimeSessionId: "runtime-native",
        },
        workspace: {
          workspaceId: "default",
          workspacePath: "C:\\tmp\\default",
        },
      }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "not_found", path: url.pathname }));
  });
}

async function main() {
  const calls = {
    upstreamLogin: 0,
    upstreamAuthUser: 0,
    portalLogin: 0,
    bootstrap: [],
  };
  const upstreamServer = startUpstreamFixture(calls);
  const portalServer = startPortalFixture(calls);
  const runtimeBridgeServer = startRuntimeBridgeFixture(calls);
  const upstreamPort = await listen(upstreamServer);
  const portalPort = await listen(portalServer);
  const runtimeBridgePort = await listen(runtimeBridgeServer);
  const gatewayPort = await freePort();
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  const env = {
    ...process.env,
    PORT: String(gatewayPort),
    OPL_WEB_UPSTREAM_URL: `http://127.0.0.1:${upstreamPort}`,
    PORTAL_RUNTIME_BRIDGE_URL: `http://127.0.0.1:${runtimeBridgePort}`,
    PORTAL_INTERNAL_URL: `http://127.0.0.1:${portalPort}`,
    PORTAL_PUBLIC_URL: "http://127.0.0.1:17080",
  };
  const child = spawn(process.execPath, ["services/opl-web-gateway/src/server.mjs"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  try {
    await waitFor(`${gatewayUrl}/healthz`);

    const jsonLogin = await fetch(`${gatewayUrl}/api/auth/signin`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email: "native-login@example.test",
        password: "PortalPass123!",
        task: "default",
      }),
      redirect: "manual",
    });
    assert(jsonLogin.status === 200, `json login expected 200, got ${jsonLogin.status}`);
    const loginPayload = await jsonLogin.json();
    assert(loginPayload.success === true, "json login should return success");
    assert(loginPayload.user?.email === "native-login@example.test", "json login user email mismatch");
    const launchCookieHeader = jsonLogin.headers.get("set-cookie") || "";
    const launchCookieMatch = launchCookieHeader.match(/opl_portal_launch=([^;]+)/);
    assert(launchCookieMatch, "json login should set launch cookie");
    const launchCookie = `opl_portal_launch=${launchCookieMatch[1]}`;

    const authUserResponse = await fetch(`${gatewayUrl}/api/auth/user`, {
      headers: { cookie: launchCookie, accept: "application/json" },
    });
    assert(authUserResponse.status === 200, `auth user expected 200, got ${authUserResponse.status}`);
    const authUser = await authUserResponse.json();
    assert(authUser.user?.email === "native-login@example.test", "auth user should resolve portal identity");
    assert(authUser.user?.source === "portal-launch", "auth user source mismatch");

    const badLogin = await fetch(`${gatewayUrl}/api/auth/signin`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email: "native-login@example.test",
        password: "wrong-password",
      }),
      redirect: "manual",
    });
    assert(badLogin.status === 401, `bad login expected 401, got ${badLogin.status}`);
    const badPayload = await badLogin.json();
    assert(badPayload.error === "invalid_credentials", "bad login should expose invalid_credentials");

    const formLogin = await fetch(`${gatewayUrl}/login`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "text/html",
      },
      body: new URLSearchParams({
        email: "native-login@example.test",
        password: "PortalPass123!",
      }),
      redirect: "manual",
    });
    assert(formLogin.status === 302, `form login expected 302, got ${formLogin.status}`);
    assert(formLogin.headers.get("location") === "/", "form login should redirect to root");
    assert((formLogin.headers.get("set-cookie") || "").includes("opl_portal_launch="), "form login should set launch cookie");

    const openWebUiLogin = await fetch(`${gatewayUrl}/api/v1/auths/signin`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email: "native-login@example.test",
        password: "PortalPass123!",
      }),
      redirect: "manual",
    });
    assert(openWebUiLogin.status === 200, `open-webui login expected 200, got ${openWebUiLogin.status}`);
    const openWebUiPayload = await openWebUiLogin.json();
    assert(openWebUiPayload.email === "native-login@example.test", "open-webui login email mismatch");
    assert(openWebUiPayload.token === undefined, "open-webui login should not expose token");
    assert(openWebUiPayload.token_type === undefined, "open-webui login should not expose bearer token type");
    assert(openWebUiPayload.launchToken === undefined, "open-webui login should not expose launch token");
    assert(!JSON.stringify(openWebUiPayload).includes("launch-native-123"), "open-webui login payload should not include launch token anywhere");
    assert((openWebUiLogin.headers.get("set-cookie") || "").includes("opl_portal_launch="), "open-webui login should set launch cookie");

    const openWebUiMe = await fetch(`${gatewayUrl}/api/v1/auths/`, {
      headers: {
        accept: "application/json",
        cookie: (openWebUiLogin.headers.get("set-cookie") || "").split(";")[0],
      },
    });
    assert(openWebUiMe.status === 200, `open-webui me expected 200, got ${openWebUiMe.status}`);
    const openWebUiMePayload = await openWebUiMe.json();
    assert(openWebUiMePayload.email === "native-login@example.test", "open-webui me email mismatch");
    assert(openWebUiMePayload.token === undefined, "open-webui me should not expose token");
    assert(openWebUiMePayload.token_type === undefined, "open-webui me should not expose bearer token type");
    assert(openWebUiMePayload.launchToken === undefined, "open-webui me should not expose launch token");
    assert(!JSON.stringify(openWebUiMePayload).includes("launch-native-123"), "open-webui me payload should not include launch token anywhere");

    assert(calls.portalLogin === 4, `portal login bridge expected 4 calls, got ${calls.portalLogin}`);
    assert(calls.upstreamLogin === 0, `upstream login should not be called, got ${calls.upstreamLogin}`);
    assert(calls.bootstrap.length >= 1, "bootstrap should be called at least once after native login");
  } finally {
    child.kill("SIGTERM");
    await Promise.all([
      close(upstreamServer),
      close(portalServer),
      close(runtimeBridgeServer),
    ]);
  }

  if (stderr.trim()) {
    throw new Error(`gateway stderr was not empty: ${stderr}`);
  }

  console.log("smoke-test-v22-opl-web-gateway-native-login: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
