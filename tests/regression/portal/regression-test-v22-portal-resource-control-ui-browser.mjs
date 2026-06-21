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
  for (const forbiddenInternalTerm of ["workspace", "Runtime", "not_activated", "funded", "MedOPL plan catalog"]) {
    assert.equal(
      bodyText.includes(forbiddenInternalTerm),
      false,
      `${label}_forbidden_internal_ui_copy:${forbiddenInternalTerm}`,
    );
  }
}

async function assertPrimaryActionReachable(page, label) {
  const primaryActions = await page.locator("a,button").filter({
    hasText: /购买|开通|进入 OPL|释放|查看|前往/u,
  }).count();
  assert(primaryActions > 0, `${label}_primary_action_missing`);
}

async function assertFirstH1(page, expected, label) {
  const h1Texts = await page.locator("h1").evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()).filter(Boolean));
  assert.equal(h1Texts[0], expected, `${label}_first_h1_mismatch:${JSON.stringify(h1Texts)}`);
}

async function assertTouchTargets(page, selector, label) {
  const undersized = await page.locator(selector).evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        text: node.textContent?.trim() || node.getAttribute("aria-label") || "",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }).filter((item) => item.height < 44 || item.width < 44),
  );
  assert.deepEqual(undersized, [], `${label}_touch_target_below_44px:${JSON.stringify(undersized)}`);
}

async function assertAgradeInteractionSystem(page, label) {
  const system = await page.evaluate(() => {
    const rootStyles = getComputedStyle(document.documentElement);
    const visibleControlNodes = [...document.querySelectorAll("a,button,input,[role='button']")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const styles = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none";
      });
    return {
      primary: rootStyles.getPropertyValue("--primary").trim(),
      undersized: visibleControlNodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          text: node.textContent?.trim() || node.getAttribute("aria-label") || node.getAttribute("title") || node.getAttribute("data-slot") || node.tagName,
          tag: node.tagName.toLowerCase(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          disabled: node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true",
        };
      }).filter((item) => item.width < 44 || item.height < 44),
      defaultCursorControls: visibleControlNodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const styles = getComputedStyle(node);
        return {
          text: node.textContent?.trim() || node.getAttribute("aria-label") || node.getAttribute("title") || node.tagName,
          tag: node.tagName.toLowerCase(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          cursor: styles.cursor,
          disabled: node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true",
        };
      }).filter((item) => !item.disabled && item.cursor === "default"),
      transitionAllControls: visibleControlNodes.map((node) => {
        const styles = getComputedStyle(node);
        return {
          text: node.textContent?.trim() || node.getAttribute("aria-label") || node.getAttribute("title") || node.tagName,
          transitionProperty: styles.transitionProperty,
        };
      }).filter((item) => item.transitionProperty.split(",").map((part) => part.trim()).includes("all")),
    };
  });
  assert.equal(system.primary, "#0F766E", `${label}_brand_primary_must_be_frozen_teal:${JSON.stringify(system)}`);
  assert.deepEqual(system.undersized, [], `${label}_visible_control_touch_target_below_44px:${JSON.stringify(system.undersized)}`);
  assert.deepEqual(system.defaultCursorControls, [], `${label}_enabled_controls_must_not_use_default_cursor:${JSON.stringify(system.defaultCursorControls)}`);
  assert.deepEqual(system.transitionAllControls, [], `${label}_controls_must_not_transition_all:${JSON.stringify(system.transitionAllControls)}`);

  const focusCandidate = page.locator("nav a[href='/overview'], nav a[href='/resources'], button:enabled, a[href]").first();
  await focusCandidate.focus();
  const focusState = await focusCandidate.evaluate((node) => {
    const styles = getComputedStyle(node);
    return {
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,
      boxShadow: styles.boxShadow,
    };
  });
  assert(
    focusState.outlineStyle !== "none" ||
      focusState.outlineWidth !== "0px" ||
      (focusState.boxShadow && focusState.boxShadow !== "none"),
    `${label}_focus_visible_state_missing:${JSON.stringify(focusState)}`,
  );
}

async function assertBillingFirstViewDensity(page, label) {
  const metrics = await page.evaluate(() => {
    const billingRoot = document.querySelector("[data-page-id='usage_billing']");
    const firstView = document.querySelector("[data-ui-section='billing-first-view']");
    const extraKpiCards = document.querySelectorAll("[data-ui-section='billing-first-view'] [data-ui-pattern='billing-extra-kpi-card']");
    return {
      hasBillingRoot: Boolean(billingRoot),
      hasFirstView: Boolean(firstView),
      billingSummaryCount: document.querySelectorAll("[data-ui-section='billing-first-view'] [data-ui-component='BillingSummary']").length,
      statusBandCount: document.querySelectorAll("[data-ui-section='billing-first-view'] [data-ui-pattern='billing-status-band']").length,
      extraKpiCardCount: extraKpiCards.length,
      firstViewCardCount: document.querySelectorAll("[data-ui-section='billing-first-view'] [data-slot='card']").length,
    };
  });
  assert.equal(metrics.hasBillingRoot, true, `${label}_billing_page_marker_missing`);
  assert.equal(metrics.hasFirstView, true, `${label}_billing_first_view_missing`);
  assert.equal(metrics.billingSummaryCount, 1, `${label}_billing_summary_count_mismatch:${JSON.stringify(metrics)}`);
  assert.equal(metrics.statusBandCount, 1, `${label}_billing_status_band_count_mismatch:${JSON.stringify(metrics)}`);
  assert.equal(metrics.extraKpiCardCount, 0, `${label}_billing_extra_kpi_cards_must_be_zero:${JSON.stringify(metrics)}`);
  assert(metrics.firstViewCardCount <= 1, `${label}_billing_first_view_card_budget_exceeded:${JSON.stringify(metrics)}`);
}

async function assertOverviewMobileHeroPolish(page, label) {
  const metrics = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find((node) => node.textContent?.includes("选择套餐开通计算资源"));
    const cta = [...document.querySelectorAll("a,button")].find((node) => node.textContent?.includes("选择套餐"));
    const hero = heading?.closest("[data-ui-section='overview-primary-hero']");
    if (!heading || !cta || !hero) {
      return { hasHeading: Boolean(heading), hasCta: Boolean(cta), hasHero: Boolean(hero) };
    }
    const headingRect = heading.getBoundingClientRect();
    const ctaRect = cta.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();
    return {
      hasHeading: true,
      hasCta: true,
      hasHero: true,
      heroWidth: Math.round(heroRect.width),
      headingBottom: Math.round(headingRect.bottom),
      ctaTop: Math.round(ctaRect.top),
      ctaWidth: Math.round(ctaRect.width),
      ctaLeft: Math.round(ctaRect.left),
      heroLeft: Math.round(heroRect.left),
    };
  });
  assert.equal(metrics.hasHero, true, `${label}_overview_primary_hero_marker_missing:${JSON.stringify(metrics)}`);
  assert(metrics.ctaTop >= metrics.headingBottom + 12, `${label}_overview_mobile_cta_must_stack_below_heading:${JSON.stringify(metrics)}`);
  assert(metrics.ctaWidth >= metrics.heroWidth - 2, `${label}_overview_mobile_cta_must_use_available_width:${JSON.stringify(metrics)}`);
  assert(Math.abs(metrics.ctaLeft - metrics.heroLeft) <= 2, `${label}_overview_mobile_cta_must_align_to_hero_left:${JSON.stringify(metrics)}`);
}

async function assertRuntimePlanDensity(page, label) {
  const metrics = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-ui-component='PlanCard']")].map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        density: node.getAttribute("data-density"),
        height: Math.round(rect.height),
        specTiles: node.querySelectorAll("[data-ui-pattern='plan-spec-tile']").length,
      };
    });
    return { cards };
  });
  assert(metrics.cards.length > 0, `${label}_plan_cards_missing`);
  assert(
    metrics.cards.every((card) => card.density === "compact"),
    `${label}_plan_cards_must_use_compact_density:${JSON.stringify(metrics)}`,
  );
  assert(
    metrics.cards.every((card) => card.height <= 300),
    `${label}_plan_cards_too_tall:${JSON.stringify(metrics)}`,
  );
  assert(
    metrics.cards.every((card) => card.specTiles <= 4),
    `${label}_plan_cards_spec_tiles_unexpected:${JSON.stringify(metrics)}`,
  );
}

async function assertBillingSummaryLedgerShape(page, label) {
  const metrics = await page.evaluate(() => {
    const summary = document.querySelector("[data-ui-section='billing-first-view'] [data-ui-component='BillingSummary']");
    return {
      hasSummary: Boolean(summary),
      ledgerSummaryCount: summary?.querySelectorAll("[data-ui-pattern='billing-ledger-summary']").length || 0,
      ledgerFieldCount: summary?.querySelectorAll("[data-ui-pattern='billing-ledger-field']").length || 0,
      nestedMetricTileCount: summary?.querySelectorAll("[data-ui-pattern='plan-spec-tile']").length || 0,
    };
  });
  assert.equal(metrics.hasSummary, true, `${label}_billing_summary_missing`);
  assert.equal(metrics.ledgerSummaryCount, 1, `${label}_billing_summary_ledger_shape_missing:${JSON.stringify(metrics)}`);
  assert.equal(metrics.ledgerFieldCount, 4, `${label}_billing_summary_ledger_field_count_mismatch:${JSON.stringify(metrics)}`);
  assert.equal(metrics.nestedMetricTileCount, 0, `${label}_billing_summary_must_not_use_nested_metric_tiles:${JSON.stringify(metrics)}`);
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
    await assertFirstH1(page, "总览", "browser_overview");
    await assertTouchTargets(page, "nav a, nav button, header button", "browser_overview");
    await assertAgradeInteractionSystem(page, "browser_overview");
    assert(lastBodyText.includes("选择套餐开通计算资源"), "browser_overview_open_compute_resource_cta_missing");
    assert(lastBodyText.includes("前往套餐与购买"), "browser_overview_packages_entry_missing");
    assert.equal(lastBodyText.includes("商业"), false, "browser_overview_forbidden_commercial_copy");
    await assertPrimaryActionReachable(page, "browser_overview");
    await assertNoGlobalHorizontalOverflow(page, "browser_overview");

    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoGlobalHorizontalOverflow(page, "browser_overview_mobile");
    await assertPrimaryActionReachable(page, "browser_overview_mobile");
    await assertOverviewMobileHeroPolish(page, "browser_overview_mobile");
    await page.setViewportSize({ width: 1440, height: 920 });

    await page.goto(`${frontendBaseUrl}/resources`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取计算资源数据");
    await page.waitForSelector("text=计算资源", { timeout: 30000 });
    lastBodyText = await page.locator("body").innerText();
    assertResourceControlCopy(lastBodyText, "browser_runtime_environment", ["计算资源", "存储空间"]);
    await assertFirstH1(page, "计算资源", "browser_runtime_environment");
    await assertTouchTargets(page, "nav a, nav button, header button", "browser_runtime_environment");
    await assertAgradeInteractionSystem(page, "browser_runtime_environment");
    assert(lastBodyText.includes("开通服务"), "browser_runtime_open_service_cta_missing");
    assert(lastBodyText.includes("当前订阅状态"), "browser_runtime_subscription_status_missing");
    assert(lastBodyText.includes("套餐价格尚待审批"), "browser_runtime_pricing_boundary_missing");
    assert.equal(lastBodyText.includes("CVM"), false, "browser_runtime_must_not_expose_cloud_console_copy");
    assert.equal(lastBodyText.includes("K8s"), false, "browser_runtime_must_not_expose_cloud_console_copy");
    if (lastBodyText.includes("释放与停止计费")) {
      assert(lastBodyText.includes("释放交互接入中"), "browser_runtime_release_partial_state_missing");
    }
    await assertRuntimePlanDensity(page, "browser_runtime_environment");
    await assertPrimaryActionReachable(page, "browser_runtime_environment");
    await assertNoGlobalHorizontalOverflow(page, "browser_runtime_environment");

    await page.goto(`${frontendBaseUrl}/billing`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取费用与用量数据");
    await page.waitForSelector("text=费用与用量", { timeout: 30000 });
    lastBodyText = await page.locator("body").innerText();
    assertResourceControlCopy(lastBodyText, "browser_billing", ["费用与用量", "账单"]);
    await assertFirstH1(page, "费用与用量", "browser_billing");
    await assertAgradeInteractionSystem(page, "browser_billing");
    await assertBillingFirstViewDensity(page, "browser_billing");
    await assertBillingSummaryLedgerShape(page, "browser_billing");
    await assertNoGlobalHorizontalOverflow(page, "browser_billing");

    const userContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders: { "x-medopl-local-role": "user" },
    });
    const userPage = await userContext.newPage();
    await userPage.goto(`${frontendBaseUrl}/overview`, { waitUntil: "domcontentloaded" });
    await waitReady(userPage, "正在读取 Portal 总览数据");
    const userBodyText = await userPage.locator("body").innerText();
    assertResourceControlCopy(userBodyText, "browser_user_overview");
    assert.equal(userBodyText.includes("管理台"), false, "browser_user_overview_must_not_show_admin_nav");
    assert.equal(userBodyText.includes("站点设置"), false, "browser_user_overview_must_not_show_admin_system_nav");
    await assertFirstH1(userPage, "总览", "browser_user_overview");
    await assertTouchTargets(userPage, "nav a, nav button, header button", "browser_user_overview");
    await assertAgradeInteractionSystem(userPage, "browser_user_overview");
    await assertNoGlobalHorizontalOverflow(userPage, "browser_user_overview");
    await userContext.close();

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
      "billing_first_view_density",
      "customer_user_nav_visual_gate",
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
