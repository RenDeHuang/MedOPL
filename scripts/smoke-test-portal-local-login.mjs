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
const adminPassword = "PortalAdmin-Smoke-2026!";
const managedEmail = `portal-managed-${Date.now()}@example.test`;
const managedPassword = "ManagedUser-Smoke-2026!";
const managedNextPassword = "ManagedUser-Smoke-2026-Next!";

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

async function login(baseUrl, email, password) {
  const response = await postForm(baseUrl, "/login", { email, password });
  assert(response.status === 302, `login for ${email} expected 302, got ${response.status}`);
  const cookie = extractCookie(response.headers["set-cookie"], "portal_session");
  assert(cookie, `portal_session cookie missing for ${email}`);
  return { response, cookie };
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
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "portal-local-login-"));
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

async function main() {
  assert(await exists(portalEntrypoint), `portal entrypoint missing: ${portalEntrypoint}`);
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let child = null;
  let stdout = "";
  let stderr = "";

  try {
    await withIsolatedPortalRuntime(async () => {
      child = spawn(process.execPath, [portalEntrypoint], {
        cwd: repoRoot,
        env: {
          ...process.env,
          PORT: String(port),
          PORTAL_STORAGE_MODE: "json",
          PORTAL_OIDC_ENABLED: "0",
          PORTAL_ADMIN_EMAIL: adminEmail,
          PORTAL_ADMIN_PASSWORD: adminPassword,
          PORTAL_ADMIN_NAME: "ZITADEL Admin",
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

      const { response: loginResponse, cookie: portalSession } = await login(baseUrl, adminEmail, adminPassword);
      assert(loginResponse.headers.location === "/portal", `login location mismatch: ${loginResponse.headers.location || ""}`);

      const meResponse = await request(baseUrl, "/portal/api/me", {
        headers: { cookie: portalSession },
      });
      assert(meResponse.status === 200, `portal api me expected 200, got ${meResponse.status}`);
      const mePayload = JSON.parse(meResponse.body || "{}");
      assert(mePayload?.email === adminEmail, `portal api me email mismatch: ${meResponse.body}`);

      const createResponse = await postForm(baseUrl, "/portal/admin/create-user", {
        email: managedEmail,
        name: "Managed Smoke User",
        password: managedPassword,
        redirectTo: "/portal/admin/users",
      }, portalSession);
      assert(createResponse.status === 302, `create user expected 302, got ${createResponse.status}: ${createResponse.body}`);

      const { cookie: managedSession } = await login(baseUrl, managedEmail, managedPassword);
      const managedMeResponse = await request(baseUrl, "/portal/api/me", {
        headers: { cookie: managedSession },
      });
      assert(managedMeResponse.status === 200, `managed api me expected 200, got ${managedMeResponse.status}`);
      const managedMe = JSON.parse(managedMeResponse.body || "{}");
      assert(managedMe.email === managedEmail, `managed user email mismatch: ${managedMeResponse.body}`);

      const usersResponse = await request(baseUrl, "/portal/api/admin/users", {
        headers: { cookie: portalSession },
      });
      assert(usersResponse.status === 200, `admin users expected 200, got ${usersResponse.status}`);
      const usersPayload = JSON.parse(usersResponse.body || "{}");
      const managed = (usersPayload.users || usersPayload.items || []).find((item) => item.email === managedEmail);
      assert(managed?.id, `managed user not found in admin users payload: ${usersResponse.body}`);

      const resetResponse = await postForm(baseUrl, "/portal/admin/user-password", {
        userId: managed.id,
        password: managedNextPassword,
      }, portalSession);
      assert(resetResponse.status === 302, `reset password expected 302, got ${resetResponse.status}: ${resetResponse.body}`);
      await login(baseUrl, managedEmail, managedNextPassword);

      console.log(JSON.stringify({
        ok: true,
        baseUrl,
        loginStatus: loginResponse.status,
        loginLocation: loginResponse.headers.location,
        cookie: "portal_session",
        meStatus: meResponse.status,
        userEmail: mePayload.email,
        managedUserEmail: managedEmail,
        managedPasswordReset: true,
      }, null, 2));
    });
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      baseUrl,
      error: String(error.message || error),
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    }, null, 2));
    process.exitCode = 1;
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

await main();
