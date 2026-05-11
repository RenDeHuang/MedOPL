import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const portalRuntimeRoot = path.join(repoRoot, ".runtime", "portal");
const adminEmail = "zitadel-admin@zitadel.localhost";
const adminPassword = "Password1!";

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
        if (!address || typeof address === "string") reject(new Error("free_port_failed"));
        else resolve(address.port);
      });
    });
  });
}

async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_ENTRY,
    path.join(repoRoot, ".runtime", "browser-test", "node_modules", "playwright", "index.js"),
    path.join(repoRoot, "node_modules", "playwright", "index.js"),
    path.join(os.homedir(), ".codex", "skills", "gstack", "browse", "node_modules", "playwright", "index.js"),
    path.join("/home/dev/projects/gstack", "node_modules", "playwright", "index.js"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await exists(candidate)) {
      const loaded = await import(pathToFileURL(candidate).href);
      return loaded.default || loaded;
    }
  }
  throw new Error(`playwright_not_found:${candidates.join(",")}`);
}

async function waitForPortal(baseUrl, child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    assert.equal(child.exitCode, null, `portal_process_exited:${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/healthz`, { redirect: "manual" });
      if (response.status === 200) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("portal_start_timeout");
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    sleep(2500).then(() => false),
  ]);
  if (!exited) child.kill("SIGKILL");
}

async function withIsolatedPortalRuntime(fn) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-workbench-ui-browser-"));
  const backupRoot = path.join(tempRoot, "portal-runtime-backup");
  const hadRuntime = await exists(portalRuntimeRoot);
  if (hadRuntime) await rename(portalRuntimeRoot, backupRoot);
  try {
    await mkdir(path.dirname(portalRuntimeRoot), { recursive: true });
    return await fn();
  } finally {
    await rm(portalRuntimeRoot, { recursive: true, force: true }).catch(() => {});
    if (hadRuntime && await exists(backupRoot)) await rename(backupRoot, portalRuntimeRoot);
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function login(page, baseUrl) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(adminEmail);
  await page.locator('input[name="password"]').fill(adminPassword);
  await Promise.all([
    page.waitForURL(/\/portal\/app\/overview$/, { timeout: 30000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

const { chromium } = await loadPlaywright();
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
let portal = null;
let browser = null;
let stdout = "";
let stderr = "";
let lastBodyText = "";
let consoleMessages = [];
let failedRequests = [];

try {
  await withIsolatedPortalRuntime(async () => {
    portal = spawn(process.execPath, [portalEntrypoint], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        PORTAL_STORAGE_MODE: "json",
        PORTAL_OIDC_ENABLED: "0",
        PORTAL_IDENTITY_SYNC_MODE: "local",
        PORTAL_ALLOW_REGISTRATION: "1",
        PORTAL_ADMIN_EMAIL: adminEmail,
        PORTAL_ADMIN_PASSWORD: adminPassword,
        PORTAL_ADMIN_NAME: "Portal Admin",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    portal.stdout.setEncoding("utf8");
    portal.stderr.setEncoding("utf8");
    portal.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-8000);
    });
    portal.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-8000);
    });

    await waitForPortal(baseUrl, portal);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
    page.on("console", (message) => {
      consoleMessages.push(`${message.type()}:${message.text()}`.slice(0, 500));
      consoleMessages = consoleMessages.slice(-20);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`.slice(0, 500));
      failedRequests = failedRequests.slice(-20);
    });

    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const homeText = await page.locator("body").innerText();
    assert(homeText.includes("One Person Lab"), "browser_home_default_intro_missing");
    assert(homeText.includes("登录"), "browser_home_login_missing");
    assert.equal(homeText.includes("使用统一账号登录"), false, "browser_home_must_not_show_oidc_copy");

    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[name="email"]').waitFor({ timeout: 10000 });
    const loginText = await page.locator("body").innerText();
    assert(loginText.includes("注册新账号"), "browser_login_register_link_missing");
    assert.equal(loginText.includes("使用统一账号登录"), false, "browser_login_must_not_show_oidc_copy");

    await login(page, baseUrl);
    await page.waitForSelector("text=总览", { timeout: 30000 });
    await page.waitForFunction(() => !document.body.innerText.includes("正在加载总览"), null, { timeout: 30000 });
    const overviewText = await page.locator("body").innerText();
    lastBodyText = overviewText;
    assert(overviewText.includes("工作台"), "browser_workbench_shell_missing");
    assert(overviewText.includes("余额"), "browser_workbench_balance_missing");
    assert(overviewText.includes("累计消费") || overviewText.includes("钱花在哪里"), "browser_workbench_spend_missing");

    await page.goto(`${baseUrl}/portal/app/admin/system`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=站点设置", { timeout: 30000 });
    const adminText = await page.locator("body").innerText();
    lastBodyText = adminText;
    assert(adminText.includes("站点 logo") || adminText.includes("站点 Logo"), "browser_admin_logo_field_missing");
    assert(adminText.includes("首页内容"), "browser_admin_home_content_missing");
    assert(adminText.includes("服务状态"), "browser_admin_service_status_missing");
    assert.equal(adminText.includes("告警中心"), false, "browser_admin_forbidden_alert_copy");

    console.log(JSON.stringify({
      ok: true,
      contract: "v22_portal_workbench_management_ui_browser",
      baseUrl,
      checked: ["home", "login", "workbench", "management_site_settings"],
    }, null, 2));
  });
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    contract: "v22_portal_workbench_management_ui_browser",
    baseUrl,
    error: String(error.message || error),
    bodyText: lastBodyText.slice(0, 3000),
    consoleMessages,
    failedRequests,
    stdout,
    stderr,
  }, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  await stopChild(portal);
}
