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
  const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-resource-control-ui-browser-"));
  try {
    return await fn(runtimeRoot);
  } finally {
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function waitReady(page, loadingText) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => document.body.innerText.trim().length > 0,
    { timeout: 30000 },
  );
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

function assertResourceControlCopy(bodyText, label, markers = ["资源总览", "计算资源", "存储空间"]) {
  for (const marker of markers) {
    assert(bodyText.includes(marker), `${label}_resource_control_marker_missing:${marker}`);
  }
  assert.equal(bodyText.includes("客户工作台"), false, `${label}_forbidden_customer_workbench_copy`);
  assert.equal(bodyText.includes("Trace"), false, `${label}_forbidden_trace_nav_copy`);
  assert.equal(bodyText.includes("trace"), false, `${label}_forbidden_trace_nav_copy_lower`);
  assert.equal(bodyText.includes("Chat"), false, `${label}_forbidden_chat_copy`);
  assert.equal(bodyText.includes("Skill"), false, `${label}_forbidden_skill_copy`);
  assert.equal(bodyText.includes("SecretId"), false, `${label}_forbidden_secret_id_copy`);
  assert.equal(bodyText.includes("kubeconfig"), false, `${label}_forbidden_kubeconfig_copy`);
}

async function assertPrimaryActionReachable(page, label) {
  const primaryActions = await page.locator("a,button").filter({
    hasText: /购买|开通|进入 OPL|释放|查看|前往/u,
  }).count();
  assert(primaryActions > 0, `${label}_primary_action_missing`);
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
    page.on("console", (message) => {
      consoleMessages.push(`${message.type()}:${message.text()}`.slice(0, 500));
      consoleMessages = consoleMessages.slice(-40);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`.slice(0, 500));
      failedRequests = failedRequests.slice(-40);
    });

    await page.goto(`${frontendBaseUrl}/overview`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取 Portal 总览数据");
    await page.waitForSelector("text=总览", { timeout: 30000 });
    lastBodyText = await page.locator("body").innerText();
    assertResourceControlCopy(lastBodyText, "browser_overview");
    assert(lastBodyText.includes("选择套餐开通计算资源"), "browser_overview_open_compute_resource_cta_missing");
    assert(lastBodyText.includes("前往套餐与购买"), "browser_overview_packages_entry_missing");
    assert.equal(lastBodyText.includes("商业"), false, "browser_overview_forbidden_commercial_copy");
    await assertPrimaryActionReachable(page, "browser_overview");
    await assertNoGlobalHorizontalOverflow(page, "browser_overview");

    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoGlobalHorizontalOverflow(page, "browser_overview_mobile");
    await assertPrimaryActionReachable(page, "browser_overview_mobile");
    await page.setViewportSize({ width: 1440, height: 920 });

    await page.goto(`${frontendBaseUrl}/resources`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取计算资源数据");
    await page.waitForSelector("text=计算资源", { timeout: 30000 });
    lastBodyText = await page.locator("body").innerText();
    assertResourceControlCopy(lastBodyText, "browser_runtime_environment", ["计算资源", "存储空间"]);
    assert(lastBodyText.includes("开通服务"), "browser_runtime_open_service_cta_missing");
    assert(lastBodyText.includes("当前订阅状态"), "browser_runtime_subscription_status_missing");
    assert(lastBodyText.includes("套餐价格尚待审批"), "browser_runtime_pricing_boundary_missing");
    assert.equal(lastBodyText.includes("CVM"), false, "browser_runtime_must_not_expose_cloud_console_copy");
    assert.equal(lastBodyText.includes("K8s"), false, "browser_runtime_must_not_expose_cloud_console_copy");
    await assertPrimaryActionReachable(page, "browser_runtime_environment");
    await assertNoGlobalHorizontalOverflow(page, "browser_runtime_environment");

    await page.goto(`${frontendBaseUrl}/admin/system`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取站点设置");
    await page.waitForSelector("text=站点设置", { timeout: 30000 });
    lastBodyText = await page.locator("body").innerText();
    assert(lastBodyText.includes("站点 Logo"), "browser_admin_logo_field_missing");
    assert(lastBodyText.includes("首页文案 / 副标题"), "browser_admin_home_content_missing");
    assert(lastBodyText.includes("服务状态摘要"), "browser_admin_service_status_summary_missing");
    assert(lastBodyText.includes("真实云资源、真实扣费或高风险设置仍需单独授权接口"), "browser_admin_authorization_boundary_missing");
    assert.equal(lastBodyText.includes("商业"), false, "browser_admin_forbidden_commercial_copy");
    await assertNoGlobalHorizontalOverflow(page, "browser_admin_system");

    await assertNoBadConsole(consoleMessages, failedRequests);
    await page.close();
  });

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_resource_control_ui_browser",
    backendBaseUrl,
    frontendBaseUrl,
    checked: [
      "go_backend_vite_frontend_runtime",
      "overview_resource_control_copy",
      "runtime_open_service_entry",
      "admin_system_authorization_boundary",
    ],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    contract: "v22_portal_resource_control_ui_browser",
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
