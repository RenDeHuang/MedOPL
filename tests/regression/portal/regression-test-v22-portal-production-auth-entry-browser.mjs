import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const goBackendRoot = path.join(repoRoot, "services", "medopl-go-backend");
const frontendRoot = path.join(repoRoot, "services", "portal", "frontend");
const viteEntrypoint = path.join(frontendRoot, "node_modules", "vite", "bin", "vite.js");

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
    path.join(frontendRoot, "node_modules", "playwright", "index.js"),
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
  const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-production-auth-entry-"));
  try {
    return await fn(runtimeRoot);
  } finally {
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
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

function badConsoleMessages(messages) {
  return messages.filter((message) => {
    if (message.includes("[vite] connected")) return false;
    if (message.includes("[vite] connecting")) return false;
    if (message.includes("Download the React DevTools")) return false;
    return /^error:|^warning:/.test(message);
  });
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

try {
  await withRuntime(async (runtimeRoot) => {
    backend = spawn("go", ["run", "./cmd/server"], {
      cwd: goBackendRoot,
      env: {
        ...process.env,
        MEDOPL_BACKEND_MODE: "local",
        MEDOPL_BACKEND_PORT: String(backendPort),
        MEDOPL_PORTAL_STATE_ROOT: path.join(runtimeRoot, "portal-state"),
        PORTAL_OPL_PROVIDER_SECRET_ROOT: path.join(runtimeRoot, "provider-secrets"),
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
    await waitFor(`${frontendBaseUrl}/login`, vite, "vite");

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
    const consoleMessages = [];
    const failedRequests = [];
    const navigations = [];
    page.on("console", (message) => {
      consoleMessages.push(`${message.type()}:${message.text()}`.slice(0, 500));
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`.slice(0, 500));
    });
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });

    await page.goto(`${frontendBaseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=欢迎回来", { timeout: 30000 });
    await page.waitForTimeout(1500);
    const bodyText = await page.locator("body").innerText();
    assert(bodyText.includes("登录你的 MedOPL 账户"), "production_auth_entry_login_subtitle_missing");
    assert(bodyText.includes("邮箱"), "production_auth_entry_email_field_missing");
    assert(bodyText.includes("密码"), "production_auth_entry_password_field_missing");
    assert(bodyText.includes("忘记密码？"), "production_auth_entry_forgot_password_action_missing");
    assert(bodyText.includes("还没有账户？"), "production_auth_entry_register_prompt_missing");
    assert(bodyText.includes("免费注册"), "production_auth_entry_register_action_missing");
    assert(bodyText.includes("登录"), "production_auth_entry_primary_action_missing");
    assert(bodyText.includes("owner 创建或批准 MedOPL 账号"), "production_auth_entry_owner_approval_missing");
    assert(bodyText.includes("按需使用算力，弹性存储数据"), "production_auth_entry_figma_brand_panel_missing");
    assert(bodyText.includes("计算资源"), "production_auth_entry_compute_card_missing");
    assert(bodyText.includes("存储空间"), "production_auth_entry_storage_card_missing");
    assert(bodyText.includes("费用与用量"), "production_auth_entry_billing_card_missing");
    assert.equal(bodyText.includes("张伟"), false, "production_auth_entry_must_not_show_mock_user");
    assert.equal(bodyText.includes("Chat"), false, "production_auth_entry_must_not_show_chat_copy");
    assert.equal(bodyText.includes("SecretId"), false, "production_auth_entry_must_not_show_cloud_secret_copy");
    assert.equal(bodyText.includes("kubeconfig"), false, "production_auth_entry_must_not_show_kubeconfig_copy");
    assert.equal(
      failedRequests.some((message) => message.includes("/api/me")),
      false,
      `production_auth_entry_must_not_fetch_me_or_loop:${JSON.stringify(failedRequests)}`,
    );
    assert.deepEqual(badConsoleMessages(consoleMessages), [], `production_auth_entry_console_must_be_clean:${JSON.stringify(consoleMessages)}`);
    assert(
      navigations.length <= 2 && navigations.every((url) => url === `${frontendBaseUrl}/login`),
      `production_auth_entry_must_not_reload_loop:${JSON.stringify(navigations)}`,
    );
    await assertNoGlobalHorizontalOverflow(page, "production_auth_entry_desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${frontendBaseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=欢迎回来", { timeout: 30000 });
    await assertNoGlobalHorizontalOverflow(page, "production_auth_entry_mobile");
    const primaryAction = page.getByRole("button", { name: "登录" });
    const primaryBox = await primaryAction.boundingBox();
    assert(primaryBox && primaryBox.width >= 44 && primaryBox.height >= 44, `production_auth_entry_primary_action_touch_target:${JSON.stringify(primaryBox)}`);
  });

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_production_auth_entry_browser",
    checked: [
      "production_api_me_login_url_points_to_login",
      "login_route_renders_commercial_admission_page",
      "login_route_does_not_fetch_me_or_reload_loop",
      "login_route_has_desktop_mobile_visible_first_screen",
    ],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    contract: "v22_portal_production_auth_entry_browser",
    backendBaseUrl,
    frontendBaseUrl,
    error: String(error.message || error),
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
