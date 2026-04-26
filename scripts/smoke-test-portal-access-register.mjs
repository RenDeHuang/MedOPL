import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";

const repoRoot = process.cwd();
const portalRuntimeRoot = path.join(repoRoot, ".runtime", "portal");
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const adminEmail = "zitadel-admin@zitadel.localhost";
const adminPassword = "PortalAdmin-Access-2026!";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("free_port_failed"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function request(baseUrl, pathname, { method = "GET", headers = {}, body = null } = {}) {
  const url = new URL(pathname, baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function extractCookie(setCookie, name) {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const header of headers) {
    const cookie = String(header || "").split(";")[0] || "";
    const [cookieName, ...value] = cookie.split("=");
    if (cookieName === name && value.length) return `${cookieName}=${value.join("=")}`;
  }
  return "";
}

function formBody(values) {
  return new URLSearchParams(values).toString();
}

async function postForm(baseUrl, pathname, values, cookie = "") {
  const body = formBody(values);
  return request(baseUrl, pathname, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(Buffer.byteLength(body)),
      ...(cookie ? { cookie } : {}),
    },
    body,
  });
}

async function waitForPortal(baseUrl, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    assert(child.exitCode === null, `portal_process_exited:${child.exitCode}`);
    try {
      const response = await request(baseUrl, "/login");
      if (response.status > 0) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("portal_start_timeout");
}

async function withIsolatedPortalRuntime(fn) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "portal-access-register-"));
  const backupRoot = path.join(tempRoot, "portal-runtime-backup");
  const hadRuntime = await exists(portalRuntimeRoot);
  if (hadRuntime) await rename(portalRuntimeRoot, backupRoot);
  try {
    await mkdir(path.dirname(portalRuntimeRoot), { recursive: true });
    return await fn();
  } finally {
    await rm(portalRuntimeRoot, { recursive: true, force: true }).catch(() => {});
    if (hadRuntime && await exists(backupRoot)) {
      await rename(backupRoot, portalRuntimeRoot);
    }
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function withPortal(envOverrides, fn) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let child = null;
  let stdout = "";
  let stderr = "";

  try {
    child = spawn(process.execPath, [portalEntrypoint], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(port),
        PORTAL_STORAGE_MODE: "json",
        PORTAL_OIDC_ENABLED: "0",
        PORTAL_IDENTITY_SYNC_MODE: "local",
        PORTAL_ADMIN_EMAIL: adminEmail,
        PORTAL_ADMIN_PASSWORD: adminPassword,
        PORTAL_ADMIN_NAME: "ZITADEL Admin",
        ...envOverrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    await waitForPortal(baseUrl, child);
    return await fn({ baseUrl });
  } catch (error) {
    throw new Error(`${String(error.message || error)}\nSTDOUT:\n${stdout.trim()}\nSTDERR:\n${stderr.trim()}`.trim());
  } finally {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        sleep(3000),
      ]);
    }
    if (child && child.exitCode === null) child.kill("SIGKILL");
  }
}

async function runRegistrationEnabledScenario() {
  const email = `portal-self-register-${Date.now()}@example.test`;
  const password = "PortalSelfRegister-2026!";

  return await withIsolatedPortalRuntime(async () => {
    return await withPortal({ PORTAL_ALLOW_REGISTRATION: "1" }, async ({ baseUrl }) => {
      const loginPage = await request(baseUrl, "/login");
      assert(loginPage.status === 200, `login status expected 200, got ${loginPage.status}`);
      assert(loginPage.body.includes('href="/register"'), "login page missing register link");

      const registerPage = await request(baseUrl, "/register");
      assert(registerPage.status === 200, `register page expected 200, got ${registerPage.status}`);
      assert(registerPage.body.includes('action="/register"'), "register page missing form");

      const registerResponse = await postForm(baseUrl, "/register", {
        name: "Self Register Smoke",
        email,
        password,
      });
      assert(registerResponse.status === 302, `register expected 302, got ${registerResponse.status}: ${registerResponse.body}`);
      assert(registerResponse.headers.location === "/portal", `register redirect mismatch: ${registerResponse.headers.location || ""}`);

      const portalSession = extractCookie(registerResponse.headers["set-cookie"], "portal_session");
      assert(portalSession, "register missing portal_session cookie");

      const meResponse = await request(baseUrl, "/portal/api/me", {
        headers: { cookie: portalSession },
      });
      assert(meResponse.status === 200, `me expected 200, got ${meResponse.status}`);
      const mePayload = JSON.parse(meResponse.body || "{}");
      assert(mePayload.email === email, `registered email mismatch: ${meResponse.body}`);
      assert(mePayload.role === "user", `registered role mismatch: ${meResponse.body}`);
      assert(mePayload.currentTaskSlug === "default", `default task slug missing: ${meResponse.body}`);

      const workspaceResponse = await request(baseUrl, "/portal/api/workspace", {
        headers: { cookie: portalSession },
      });
      assert(workspaceResponse.status === 200, `workspace expected 200, got ${workspaceResponse.status}`);
      const workspacePayload = JSON.parse(workspaceResponse.body || "{}");
      assert(workspacePayload.workspace?.slug === "default", `default workspace missing: ${workspaceResponse.body}`);

      const tracesResponse = await request(baseUrl, "/portal/api/traces?userId=another-user-id", {
        headers: { cookie: portalSession },
      });
      assert(tracesResponse.status === 200, `traces expected 200, got ${tracesResponse.status}`);
      const tracesPayload = JSON.parse(tracesResponse.body || "{}");
      assert(tracesPayload.filters?.userId === mePayload.id, `trace user scope mismatch: ${tracesResponse.body}`);

      const adminUsersResponse = await request(baseUrl, "/portal/api/admin/users", {
        headers: { cookie: portalSession },
      });
      assert(adminUsersResponse.status === 403, `admin users expected 403, got ${adminUsersResponse.status}`);

      return {
        email,
        userId: mePayload.id,
      };
    });
  });
}

async function runRegistrationDisabledScenario() {
  return await withIsolatedPortalRuntime(async () => {
    return await withPortal({ PORTAL_ALLOW_REGISTRATION: "0" }, async ({ baseUrl }) => {
      const loginPage = await request(baseUrl, "/login");
      assert(loginPage.status === 200, `login status expected 200, got ${loginPage.status}`);
      assert(!loginPage.body.includes('href="/register"'), "login page should not expose register link when disabled");
      assert(loginPage.body.includes("当前关闭自由注册"), "login page missing registration closed note");

      const registerPage = await request(baseUrl, "/register");
      assert(registerPage.status === 403, `register page expected 403, got ${registerPage.status}`);

      const registerResponse = await postForm(baseUrl, "/register", {
        name: "Blocked Register",
        email: `blocked-${Date.now()}@example.test`,
        password: "BlockedRegister-2026!",
      });
      assert(registerResponse.status === 403, `register post expected 403, got ${registerResponse.status}`);
    });
  });
}

async function main() {
  assert(await exists(portalEntrypoint), `portal entrypoint missing: ${portalEntrypoint}`);
  const enabled = await runRegistrationEnabledScenario();
  await runRegistrationDisabledScenario();

  console.log(JSON.stringify({
    ok: true,
    registrationEnabled: {
      email: enabled.email,
      userId: enabled.userId,
      role: "user",
      defaultWorkspace: "default",
      traceScope: "self",
    },
    registrationDisabled: {
      loginRegisterLink: false,
      registerGetStatus: 403,
      registerPostStatus: 403,
    },
  }, null, 2));
}

await main();
