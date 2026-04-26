import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";

const repoRoot = process.cwd();
const portalRuntimeRoot = path.join(repoRoot, ".runtime", "portal");
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const adminEmail = "zitadel-admin@zitadel.localhost";
const adminPassword = "PortalAdmin-Spa-2026!";

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
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "portal-spa-access-"));
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

async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_ENTRY,
    path.join(repoRoot, ".runtime", "browser-test", "node_modules", "playwright", "index.js"),
    path.join(os.homedir(), ".codex", "skills", "gstack", "browse", "node_modules", "playwright", "index.js"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await exists(candidate)) {
      const loaded = await import(pathToFileURL(candidate).href);
      return loaded.default || loaded;
    }
  }
  throw new Error(`playwright_not_found:${candidates.join(",")}`);
}

async function login(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL(/\/portal(\/app\/overview)?$/, { timeout: 30000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

async function main() {
  assert(await exists(portalEntrypoint), `portal entrypoint missing: ${portalEntrypoint}`);
  const { chromium } = await loadPlaywright();
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let child = null;
  let browser = null;
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
          PORTAL_IDENTITY_SYNC_MODE: "local",
          PORTAL_ALLOW_REGISTRATION: "1",
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

      browser = await chromium.launch({
        headless: true,
        executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
      });

      const adminContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
      const adminPage = await adminContext.newPage();
      await adminPage.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
      assert(await adminPage.locator('a[href="/register"]').isVisible(), "login page missing register link");
      await login(adminPage, baseUrl, adminEmail, adminPassword);

      await adminPage.goto(`${baseUrl}/portal/app/admin/users`, { waitUntil: "networkidle" });
      await adminPage.waitForSelector("text=用户管理", { timeout: 30000 });
      const adminBody = await adminPage.locator("body").innerText();
      assert(adminBody.includes("管理后台"), "admin sidebar missing management section");

      const managedEmail = `browser-managed-${Date.now()}@example.test`;
      const managedPassword = "BrowserManaged-2026!";
      let navigationCount = 0;
      adminPage.on("framenavigated", (frame) => {
        if (frame === adminPage.mainFrame()) navigationCount += 1;
      });
      const adminUsersUrl = adminPage.url();
      await adminPage.evaluate(() => {
        window.__portalSpaMarker = "kept";
        window.scrollTo(0, document.body.scrollHeight);
      });

      await adminPage.getByRole("button", { name: "开通账号" }).click();
      await adminPage.locator('input[name="name"]').fill("Browser Managed User");
      await adminPage.locator('input[name="email"]').fill(managedEmail);
      await adminPage.locator('input[name="password"]').fill(managedPassword);
      await adminPage.getByRole("button", { name: "创建", exact: true }).click();
      await adminPage.waitForSelector(`text=${managedEmail}`, { timeout: 30000 });

      const marker = await adminPage.evaluate(() => window.__portalSpaMarker || "");
      assert(marker === "kept", "admin user action caused a full page reload");
      assert(adminPage.url() === adminUsersUrl, `admin user action changed URL: ${adminPage.url()}`);
      assert(navigationCount === 0, `admin user action navigated ${navigationCount} time(s)`);

      const userContext = await browser.newContext({ viewport: { width: 1280, height: 840 } });
      const userPage = await userContext.newPage();
      await login(userPage, baseUrl, managedEmail, managedPassword);
      await userPage.goto(`${baseUrl}/portal/app/overview`, { waitUntil: "networkidle" });
      const userBody = await userPage.locator("body").innerText();
      assert(!userBody.includes("管理后台"), "ordinary user can see admin sidebar");

      const me = await userPage.evaluate(async () => {
        const response = await fetch("/portal/api/me", { credentials: "include" });
        return response.json();
      });
      assert(me.role === "user", `ordinary user role mismatch: ${JSON.stringify(me)}`);

      const traceScope = await userPage.evaluate(async () => {
        const response = await fetch("/portal/api/traces?userId=other-user", { credentials: "include" });
        return response.json();
      });
      assert(traceScope.filters?.userId === me.id, `trace scope mismatch: ${JSON.stringify(traceScope.filters || {})}`);

      const adminStatus = await userPage.evaluate(async () => {
        const response = await fetch("/portal/api/admin/users", { credentials: "include" });
        return response.status;
      });
      assert(adminStatus === 403, `ordinary user admin API expected 403, got ${adminStatus}`);

      await userPage.goto(`${baseUrl}/portal/app/admin/users`, { waitUntil: "domcontentloaded" });
      await userPage.waitForURL(/\/portal\/app\/overview/, { timeout: 30000 });
      await adminPage.screenshot({ path: path.join(repoRoot, ".runtime", "portal-spa-access-admin.png"), fullPage: true });
      await userPage.screenshot({ path: path.join(repoRoot, ".runtime", "portal-spa-access-user.png"), fullPage: true });

      console.log(JSON.stringify({
        ok: true,
        baseUrl,
        registerLinkVisible: true,
        adminCreateUserNoReload: true,
        managedEmail,
        ordinaryUserRole: me.role,
        ordinaryUserAdminApiStatus: adminStatus,
        ordinaryUserAdminRouteRedirect: userPage.url(),
        traceScope: "self",
        screenshots: [
          ".runtime/portal-spa-access-admin.png",
          ".runtime/portal-spa-access-user.png",
        ],
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
    if (browser) await browser.close().catch(() => {});
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
