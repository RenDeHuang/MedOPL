import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const frontendRoot = path.join(repoRoot, "services", "portal", "frontend");
const viteEntrypoint = path.join(frontendRoot, "node_modules", "vite", "bin", "vite.js");
const adminEmail = "zitadel-admin@zitadel.localhost";
const adminPassword = "Password1!";
const userEmail = "portal-browser-api-user@example.test";
const userPassword = "Password123!";
const userName = "Portal Browser API User";
const announcementTitle = "浏览器闭环公告";
const announcementContent = "公告发布后必须能在 Portal 顶部公告入口被普通用户看到，删除后必须消失。";

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

async function waitFor(url, child, label) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    assert.equal(child.exitCode, null, `${label}_process_exited:${child.exitCode}`);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0 && response.status < 500) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label}_start_timeout:${url}`);
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

async function withRuntime(fn) {
  const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-browser-api-"));
  try {
    return await fn(runtimeRoot);
  } finally {
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function postForm(url, form, { cookie = "" } = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(form).toString(),
    redirect: "manual",
  });
}

function cookieHeaderFrom(response, name) {
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  assert(match, `${name}_cookie_required`);
  assert(setCookie.includes("HttpOnly"), `${name}_cookie_must_be_http_only`);
  return `${name}=${match[1]}`;
}

async function backendLogin(baseUrl, email, password) {
  const response = await postForm(`${baseUrl}/login`, { email, password });
  assert.equal(response.status, 302, `login_must_redirect:${email}`);
  return cookieHeaderFrom(response, "portal_session");
}

async function backendGetJson(baseUrl, pathName, cookie) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    headers: { accept: "application/json", cookie },
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function installCookie(context, frontendBaseUrl, cookieHeader) {
  const [name, value] = cookieHeader.split("=");
  await context.addCookies([{
    name,
    value,
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
    url: frontendBaseUrl,
  }]);
}

async function waitReady(page, loadingText) {
  await page.waitForLoadState("domcontentloaded");
  if (loadingText) {
    await page.waitForFunction(
      (text) => !document.body.innerText.includes(text),
      loadingText,
      { timeout: 30000 },
    );
  }
}

async function assertNoGlobalHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    htmlScrollWidth: document.documentElement.scrollWidth,
    htmlClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));
  assert(
    overflow.htmlScrollWidth <= overflow.htmlClientWidth + 2,
    `${label}_html_horizontal_overflow:${JSON.stringify(overflow)}`,
  );
  assert(
    overflow.bodyScrollWidth <= overflow.bodyClientWidth + 2,
    `${label}_body_horizontal_overflow:${JSON.stringify(overflow)}`,
  );
}

async function openUserActionMenu(page, name) {
  await page.getByRole("button", { name: `打开 ${name} 的用户操作菜单` }).click();
  await page.locator('[data-slot="dropdown-menu-content"]').waitFor({ timeout: 10000 });
}

async function createUserViaBackend(baseUrl, adminCookie) {
  const response = await postForm(`${baseUrl}/portal/admin/create-user`, {
    name: userName,
    email: userEmail,
    password: userPassword,
    redirectTo: "/admin/users",
  }, { cookie: adminCookie });
  assert.equal(response.status, 302, "admin_create_user_must_redirect");
  const users = await backendGetJson(baseUrl, "/portal/api/admin/users", adminCookie);
  assert.equal(users.response.status, 200, "admin_users_after_create_must_return_200");
  const created = (users.json.items || []).find((item) => item.email === userEmail);
  assert(created?.id, "created_user_must_be_visible_to_admin_api");
  return created;
}

async function assertUserBalance(baseUrl, adminCookie, expectedBalance) {
  const users = await backendGetJson(baseUrl, "/portal/api/admin/users", adminCookie);
  assert.equal(users.response.status, 200, "admin_users_balance_check_must_return_200");
  const found = (users.json.items || []).find((item) => item.email === userEmail);
  assert(found, "browser_target_user_missing_after_action");
  assert.equal(Number(found.balance), expectedBalance, `browser_user_balance_mismatch:${expectedBalance}`);
}

async function assertAnnouncementPresence(baseUrl, adminCookie, expectedPresent) {
  const announcements = await backendGetJson(baseUrl, "/portal/api/announcements?mode=all", adminCookie);
  assert.equal(announcements.response.status, 200, "announcements_presence_check_must_return_200");
  assert.equal(
    (announcements.json.items || []).some((item) => item.title === announcementTitle),
    expectedPresent,
    `announcement_presence_mismatch:${expectedPresent}`,
  );
}

async function assertNoBadConsole(consoleMessages, failedRequests) {
  const filteredConsole = consoleMessages.filter((message) => {
    if (message.includes("[vite] connected")) return false;
    if (message.includes("[vite] connecting")) return false;
    if (message.includes("Download the React DevTools")) return false;
    return /^error:|^warning:/.test(message);
  });
  const filteredRequests = failedRequests.filter((message) => !message.includes("net::ERR_ABORTED"));
  assert.deepEqual(filteredConsole, [], `browser_console_warning_or_error:${JSON.stringify(filteredConsole)}`);
  assert.deepEqual(filteredRequests, [], `browser_failed_requests:${JSON.stringify(filteredRequests)}`);
}

const { chromium } = await loadPlaywright();
const portalPort = await freePort();
const vitePort = await freePort();
const portalBaseUrl = `http://127.0.0.1:${portalPort}`;
const frontendBaseUrl = `http://127.0.0.1:${vitePort}`;
let portal = null;
let vite = null;
let browser = null;
let stdout = "";
let stderr = "";
let viteStdout = "";
let viteStderr = "";
let lastBodyText = "";
let consoleMessages = [];
let failedRequests = [];

try {
  await withRuntime(async (runtimeRoot) => {
    portal = spawn(process.execPath, [portalEntrypoint], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(portalPort),
        PORTAL_RUNTIME_ROOT: runtimeRoot,
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

    await waitFor(`${portalBaseUrl}/healthz`, portal, "portal");
    const adminCookie = await backendLogin(portalBaseUrl, adminEmail, adminPassword);
    await createUserViaBackend(portalBaseUrl, adminCookie);

    vite = spawn(process.execPath, [viteEntrypoint, "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"], {
      cwd: frontendRoot,
      env: {
        ...process.env,
        VITE_PORTAL_BACKEND_URL: portalBaseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    vite.stdout.setEncoding("utf8");
    vite.stderr.setEncoding("utf8");
    vite.stdout.on("data", (chunk) => {
      viteStdout = `${viteStdout}${chunk}`.slice(-8000);
    });
    vite.stderr.on("data", (chunk) => {
      viteStderr = `${viteStderr}${chunk}`.slice(-8000);
    });
    await waitFor(`${frontendBaseUrl}/overview`, vite, "vite");

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 920 },
      acceptDownloads: true,
    });
    await installCookie(context, frontendBaseUrl, adminCookie);
    const page = await context.newPage();
    page.on("console", (message) => {
      consoleMessages.push(`${message.type()}:${message.text()}`.slice(0, 500));
      consoleMessages = consoleMessages.slice(-40);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`.slice(0, 500));
      failedRequests = failedRequests.slice(-40);
    });

    await page.goto(`${frontendBaseUrl}/overview`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在加载总览");
    lastBodyText = await page.locator("body").innerText();
    assert(lastBodyText.includes("总览"), "overview_must_render_after_admin_cookie");
    await page.getByRole("button", { name: "打开账号菜单" }).click();
    await page.getByRole("menuitem", { name: "账号信息" }).click();
    const accountDialog = page.getByRole("dialog", { name: "账号信息" });
    await accountDialog.waitFor({ timeout: 10000 });
    await accountDialog.getByText(adminEmail).waitFor({ timeout: 10000 });
    await page.keyboard.press("Escape");

    await page.goto(`${frontendBaseUrl}/admin/users`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取用户管理数据");
    await page.getByText(userEmail).waitFor({ timeout: 30000 });
    await openUserActionMenu(page, userName);
    await page.getByRole("menuitem", { name: "充值" }).click();
    await page.getByRole("dialog", { name: "账户充值" }).waitFor({ timeout: 10000 });
    await page.locator("#rechargeAmount").fill("120");
    await page.getByRole("button", { name: "确认充值" }).click();
    await page.getByText("¥120.00").waitFor({ timeout: 30000 });
    await assertUserBalance(portalBaseUrl, adminCookie, 120);

    await openUserActionMenu(page, userName);
    await page.getByRole("menuitem", { name: "退款" }).click();
    await page.getByRole("dialog", { name: "账本退款" }).waitFor({ timeout: 10000 });
    await page.locator("#refundAmount").fill("30");
    await page.locator("#refundReason").fill("browser api closure smoke");
    await page.getByRole("button", { name: "确认退款" }).click();
    await page.getByText("¥150.00").waitFor({ timeout: 30000 });
    await assertUserBalance(portalBaseUrl, adminCookie, 150);

    const userCookie = await backendLogin(portalBaseUrl, userEmail, userPassword);
    const userContext = await browser.newContext({ viewport: { width: 1440, height: 920 } });
    await installCookie(userContext, frontendBaseUrl, userCookie);
    const userPage = await userContext.newPage();
    userPage.on("console", (message) => {
      consoleMessages.push(`${message.type()}:${message.text()}`.slice(0, 500));
      consoleMessages = consoleMessages.slice(-40);
    });
    userPage.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`.slice(0, 500));
      failedRequests = failedRequests.slice(-40);
    });
    await userPage.goto(`${frontendBaseUrl}/billing`, { waitUntil: "domcontentloaded" });
    await waitReady(userPage, "正在读取账单与审计数据");
    await userPage.getByText("资金摘要").waitFor({ timeout: 30000 });
    const [download] = await Promise.all([
      userPage.waitForEvent("download", { timeout: 30000 }),
      userPage.getByRole("button", { name: "导出明细" }).click(),
    ]);
    assert.equal(download.suggestedFilename(), "portal-billing-export.csv", "billing_export_filename_must_come_from_backend");
    const downloadPath = await download.path();
    assert(downloadPath, "billing_export_download_path_required");
    const csv = await readFile(downloadPath, "utf8");
    assert(csv.includes("entryId,type,amount,reason,createdAt"), "billing_export_must_export_portal_ledger_header");
    assert(csv.includes("topup"), "billing_export_must_include_user_topup_ledger");
    assert(csv.includes("refund"), "billing_export_must_include_user_refund_ledger");

    await page.goto(`${frontendBaseUrl}/admin/alerts`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取公告与待处理事项");
    await page.getByRole("button", { name: "新建公告" }).click();
    await page.getByRole("dialog", { name: "新建公告" }).waitFor({ timeout: 10000 });
    await page.locator("#announcementTitle").fill(announcementTitle);
    await page.locator("#announcementContent").fill(announcementContent);
    await page.getByRole("button", { name: "保存公告" }).click();
    await page.getByText(announcementTitle).waitFor({ timeout: 30000 });
    await assertAnnouncementPresence(portalBaseUrl, adminCookie, true);

    await userPage.goto(`${frontendBaseUrl}/overview`, { waitUntil: "domcontentloaded" });
    await waitReady(userPage, "正在加载总览");
    await userPage.getByRole("button", { name: /公告/ }).click();
    await userPage.getByText(announcementTitle).waitFor({ timeout: 30000 });
    await userPage.close();
    await userContext.close();

    await page.goto(`${frontendBaseUrl}/admin/alerts`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取公告与待处理事项");
    const announcementCard = page.locator("div", { hasText: announcementTitle }).filter({ has: page.locator("button") }).first();
    await announcementCard.locator("button.text-red-600").click();
    const deleteAnnouncementDialog = page.getByRole("dialog", { name: "删除公告" });
    await deleteAnnouncementDialog.waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "确认删除" }).click();
    await deleteAnnouncementDialog.waitFor({ state: "detached", timeout: 30000 });
    await assertAnnouncementPresence(portalBaseUrl, adminCookie, false);

    for (const [urlPath, label] of [
      ["/overview", "desktop_overview"],
      ["/billing", "desktop_billing"],
      ["/admin/users", "desktop_admin_users"],
      ["/admin/alerts", "desktop_admin_alerts"],
    ]) {
      await page.setViewportSize({ width: 1440, height: 920 });
      await page.goto(`${frontendBaseUrl}${urlPath}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("domcontentloaded");
      await assertNoGlobalHorizontalOverflow(page, label);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${frontendBaseUrl}${urlPath}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("domcontentloaded");
      await assertNoGlobalHorizontalOverflow(page, `mobile_${label}`);
    }

    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto(`${frontendBaseUrl}/overview`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在加载总览");
    await page.getByRole("button", { name: "打开账号菜单" }).click();
    await Promise.all([
      page.waitForURL(/\/login\?force_login=1$/, { timeout: 30000 }),
      page.getByRole("menuitem", { name: "退出登录" }).click(),
    ]);
    assert(page.url().endsWith("/login?force_login=1"), "logout_click_must_reach_login_force_url");

    await assertNoBadConsole(consoleMessages, failedRequests);
    await page.close();
    await context.close();
  });

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_local_api_action_browser",
    checked: [
      "account_info_dialog",
      "logout_click",
      "billing_backend_csv_download",
      "admin_user_recharge_refund_clicks",
      "announcement_create_visible_delete",
      "desktop_mobile_global_overflow",
    ],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    contract: "v22_portal_local_api_action_browser",
    portalBaseUrl,
    frontendBaseUrl,
    error: String(error.message || error),
    bodyText: lastBodyText.slice(0, 3000),
    consoleMessages,
    failedRequests,
    stdout,
    stderr,
    viteStdout,
    viteStderr,
  }, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  await stopChild(vite);
  await stopChild(portal);
}
