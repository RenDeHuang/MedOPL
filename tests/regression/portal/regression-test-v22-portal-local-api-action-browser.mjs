import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const goBackendRoot = path.join(repoRoot, "services", "medopl-go-backend");
const frontendRoot = path.join(repoRoot, "services", "portal", "frontend");
const viteEntrypoint = path.join(frontendRoot, "node_modules", "vite", "bin", "vite.js");
const localUserEmail = "local@medopl.test";
const localUserName = "MedOPL Local User";
const actionUserEmail = "go-browser-action-user@example.test";
const actionUserName = "Go Browser Action User";
const announcementTitle = "Go 浏览器动作公告";
const announcementContent = "公告通过 Go control-plane 本地动作闭环写入。";

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
  for (let attempt = 0; attempt < 180; attempt += 1) {
    assert.equal(child.exitCode, null, `${label}_process_exited:${child.exitCode}`);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status >= 200 && response.status < 400) return response;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label}_start_timeout:${url}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    sleep(2500).then(() => false),
  ]);
  if (!exited) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

async function withRuntime(fn) {
  const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-go-browser-"));
  try {
    return await fn(runtimeRoot);
  } finally {
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function waitReady(page, loadingText) {
  await page.waitForLoadState("domcontentloaded");
  if (loadingText) {
    await page.waitForFunction(
      () => document.body.innerText.trim().length > 0,
      { timeout: 30000 },
    );
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

async function backendGetJson(baseUrl, pathName) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function openUserActionMenu(page, name) {
  await page.getByRole("button", { name: `打开 ${name} 的用户操作菜单` }).click();
  await page.locator('[data-slot="dropdown-menu-content"]').waitFor({ timeout: 10000 });
}

async function assertUserBalance(baseUrl, email, expectedBalance) {
  const users = await backendGetJson(baseUrl, "/api/admin/users");
  assert.equal(users.response.status, 200, "admin_users_balance_check_must_return_200");
  const found = (users.json.items || []).find((item) => item.email === email);
  assert(found, "browser_target_user_missing_after_action");
  assert.equal(Number(found.balance), expectedBalance, `browser_user_balance_mismatch:${expectedBalance}`);
}

async function assertAnnouncementPresence(baseUrl, title, expectedPresent) {
  const announcements = await backendGetJson(baseUrl, "/api/announcements?mode=all");
  assert.equal(announcements.response.status, 200, "announcements_presence_check_must_return_200");
  assert.equal(
    (announcements.json.items || []).some((item) => item.title === title),
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
const backendPort = await freePort();
const vitePort = await freePort();
const backendBaseUrl = `http://127.0.0.1:${backendPort}`;
const frontendBaseUrl = `http://127.0.0.1:${vitePort}`;
let backend = null;
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
    backend = spawn("go", ["run", "./cmd/server"], {
      cwd: goBackendRoot,
      env: {
        ...process.env,
        MEDOPL_BACKEND_MODE: "local",
        MEDOPL_BACKEND_PORT: String(backendPort),
        PORTAL_OPL_PROVIDER_SECRET_ROOT: path.join(runtimeRoot, "provider-secrets"),
        MEDOPL_PORTAL_STATE_ROOT: path.join(runtimeRoot, "portal-state"),
        GOPROXY: process.env.GOPROXY || "https://goproxy.cn,direct",
        GOSUMDB: process.env.GOSUMDB || "sum.golang.google.cn",
      },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    backend.stdout.setEncoding("utf8");
    backend.stderr.setEncoding("utf8");
    backend.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-8000);
    });
    backend.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-8000);
    });

    await waitFor(`${backendBaseUrl}/healthz`, backend, "go_backend");

    vite = spawn(process.execPath, [viteEntrypoint, "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"], {
      cwd: frontendRoot,
      env: {
        ...process.env,
        VITE_MEDOPL_GO_BACKEND_URL: backendBaseUrl,
      },
      detached: true,
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
    assert(lastBodyText.includes("总览"), "overview_must_render_with_go_backend");
    assert(lastBodyText.includes("资源总览"), "overview_must_render_resource_control_spine");
    assert(lastBodyText.includes("选择套餐开通计算资源"), "overview_must_render_compute_resource_cta");
    assert(lastBodyText.includes("存储空间"), "overview_must_render_storage_space_spine");

    await page.getByRole("button", { name: "打开账号菜单" }).click();
    await page.getByRole("menuitem", { name: "账号信息" }).click();
    const accountDialog = page.getByRole("dialog", { name: "账号信息" });
    await accountDialog.waitFor({ timeout: 10000 });
    await accountDialog.getByText(localUserName).waitFor({ timeout: 10000 });
    await accountDialog.getByText(localUserEmail).waitFor({ timeout: 10000 });
    await page.keyboard.press("Escape");

    await page.goto(`${frontendBaseUrl}/admin/users`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取用户管理数据");
    await page.getByText(localUserEmail).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "新建用户" }).click();
    await page.getByRole("dialog", { name: "新建用户" }).waitFor({ timeout: 10000 });
    await page.locator("#createUserName").fill(actionUserName);
    await page.locator("#createUserEmail").fill(actionUserEmail);
    await page.locator("#createUserPassword").fill("Password123!");
    await page.getByRole("button", { name: "确认创建" }).click();
    await page.getByText(actionUserEmail).waitFor({ timeout: 30000 });

    await openUserActionMenu(page, actionUserName);
    await page.getByRole("menuitem", { name: "充值" }).click();
    await page.getByRole("dialog", { name: "账户充值" }).waitFor({ timeout: 10000 });
    await page.locator("#rechargeAmount").fill("120");
    await page.getByRole("button", { name: "确认充值" }).click();
    await page.getByText("¥120.00").waitFor({ timeout: 30000 });
    await assertUserBalance(backendBaseUrl, actionUserEmail, 120);

    await openUserActionMenu(page, actionUserName);
    await page.getByRole("menuitem", { name: "退款" }).click();
    await page.getByRole("dialog", { name: "账本退款" }).waitFor({ timeout: 10000 });
    await page.locator("#refundAmount").fill("30");
    await page.locator("#refundReason").fill("browser go action closure");
    await page.getByRole("button", { name: "确认退款" }).click();
    await page.getByText("¥90.00").waitFor({ timeout: 30000 });
    await assertUserBalance(backendBaseUrl, actionUserEmail, 90);

    await page.goto(`${frontendBaseUrl}/billing`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取账单与审计数据");
    await page.getByText("资金摘要").waitFor({ timeout: 30000 });
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.getByRole("button", { name: "导出明细" }).click(),
    ]);
    assert.equal(download.suggestedFilename(), "medopl-local-rc-billing.csv", "billing_export_filename_must_come_from_go_backend");
    const downloadPath = await download.path();
    assert(downloadPath, "billing_export_download_path_required");
    const csv = await readFile(downloadPath, "utf8");
    assert(csv.includes("id,type,amount,reason,created_at"), "billing_export_must_export_go_ledger_header");
    assert(csv.includes("local_rc_environment_open"), "billing_export_must_include_precloud_local_rc_entry");
    assert(csv.includes("topup"), "billing_export_must_include_go_topup_ledger");
    assert(csv.includes("refund"), "billing_export_must_include_go_refund_ledger");

    await page.goto(`${frontendBaseUrl}/admin/alerts`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取公告与待处理事项");
    await page.getByRole("button", { name: "新建公告" }).click();
    await page.getByRole("dialog", { name: "新建公告" }).waitFor({ timeout: 10000 });
    await page.locator("#announcementTitle").fill(announcementTitle);
    await page.locator("#announcementContent").fill(announcementContent);
    await page.getByRole("button", { name: "保存公告" }).click();
    await page.getByText(announcementTitle).waitFor({ timeout: 30000 });
    await assertAnnouncementPresence(backendBaseUrl, announcementTitle, true);

    await page.goto(`${frontendBaseUrl}/overview`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在加载总览");
    await page.getByRole("button", { name: /公告/ }).click();
    await page.getByText(announcementTitle).waitFor({ timeout: 30000 });
    await page.getByRole("heading", { name: "Local RC" }).waitFor({ timeout: 30000 });

    await page.goto(`${frontendBaseUrl}/admin/alerts`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取公告与待处理事项");
    const announcementCard = page.locator(".rounded-md.border.border-neutral-200.bg-neutral-50", { hasText: announcementTitle }).first();
    await announcementCard.locator("button.text-red-600").click();
    const deleteAnnouncementDialog = page.getByRole("dialog", { name: "删除公告" });
    await deleteAnnouncementDialog.waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "确认删除" }).click();
    await deleteAnnouncementDialog.waitFor({ state: "detached", timeout: 30000 });
    await assertAnnouncementPresence(backendBaseUrl, announcementTitle, false);

    for (const [urlPath, label] of [
      ["/overview", "desktop_overview"],
      ["/billing", "desktop_billing"],
      ["/portal/opl", "desktop_portal_opl_entry_alias"],
      ["/admin/users", "desktop_admin_users"],
      ["/admin/alerts", "desktop_admin_alerts"],
    ]) {
      await page.setViewportSize({ width: 1440, height: 920 });
      await page.goto(`${frontendBaseUrl}${urlPath}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("domcontentloaded");
      lastBodyText = await page.locator("body").innerText();
      assert(!lastBodyText.includes("Unexpected Application Error!"), `${label}_must_not_render_react_router_default_error`);
      assert(!lastBodyText.includes("404 Not Found"), `${label}_must_not_render_react_router_404`);
      await assertNoGlobalHorizontalOverflow(page, label);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${frontendBaseUrl}${urlPath}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("domcontentloaded");
      lastBodyText = await page.locator("body").innerText();
      assert(!lastBodyText.includes("Unexpected Application Error!"), `mobile_${label}_must_not_render_react_router_default_error`);
      assert(!lastBodyText.includes("404 Not Found"), `mobile_${label}_must_not_render_react_router_404`);
      await assertNoGlobalHorizontalOverflow(page, `mobile_${label}`);
    }

    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto(`${frontendBaseUrl}/overview`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在加载总览");
    await page.getByRole("button", { name: "打开账号菜单" }).click();
    await Promise.all([
      page.waitForURL(`${frontendBaseUrl}/`, { timeout: 30000 }),
      page.getByRole("menuitem", { name: "退出登录" }).click(),
    ]);

    await assertNoBadConsole(consoleMessages, failedRequests);
    await page.close();
    await context.close();
  });

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_local_api_action_browser",
    checked: [
      "go_backend_projection_browser",
      "account_info_dialog",
      "logout_click",
      "billing_go_csv_download",
      "admin_user_recharge_refund_clicks",
      "announcement_create_visible_delete",
      "desktop_mobile_global_overflow",
    ],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    contract: "v22_portal_local_api_action_browser",
    backendBaseUrl,
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
  await stopChild(backend);
}
