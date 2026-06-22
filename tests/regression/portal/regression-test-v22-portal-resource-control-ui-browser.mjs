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
  for (const forbiddenEngineeringTerm of ["mutation", "runner phase", "claim", "future-authorized", "ops_surface_disabled"]) {
    assert.equal(
      bodyText.includes(forbiddenEngineeringTerm),
      false,
      `${label}_forbidden_engineering_ui_copy:${forbiddenEngineeringTerm}`,
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

async function assertHeadingHierarchy(page, label) {
  const headings = await page.locator("h1,h2,h3,h4,h5,h6").evaluateAll((nodes) =>
    nodes.map((node) => ({
      level: Number(node.tagName.slice(1)),
      text: node.textContent?.trim() || "",
    })).filter((item) => item.text.length > 0),
  );
  assert(headings.length > 0, `${label}_headings_missing`);
  assert.equal(headings[0].level, 1, `${label}_first_heading_must_be_h1:${JSON.stringify(headings)}`);
  for (let index = 1; index < headings.length; index += 1) {
    assert(
      headings[index].level <= headings[index - 1].level + 1,
      `${label}_heading_level_skip:${JSON.stringify(headings)}`,
    );
  }
}

async function assertStateFeedbackPatterns(page, label) {
  const metrics = await page.evaluate(() => ({
    stateFeedbackCount: document.querySelectorAll("[data-ui-pattern='state-feedback']").length,
    liveRegionCount: document.querySelectorAll("[data-ui-pattern='state-feedback'][role='status']").length,
    tableCount: document.querySelectorAll("[data-slot='table']").length,
    responsiveTableCount: document.querySelectorAll("[data-ui-pattern='responsive-data-table']").length,
  }));
  assert(metrics.stateFeedbackCount > 0, `${label}_state_feedback_pattern_missing:${JSON.stringify(metrics)}`);
  assert(metrics.liveRegionCount > 0, `${label}_state_feedback_live_region_missing:${JSON.stringify(metrics)}`);
  if (label.includes("billing")) {
    assert(metrics.tableCount > 0, `${label}_billing_table_missing:${JSON.stringify(metrics)}`);
  }
  if (metrics.tableCount > 0) {
    assert.equal(metrics.responsiveTableCount, metrics.tableCount, `${label}_responsive_data_table_pattern_missing:${JSON.stringify(metrics)}`);
  }
}

async function assertDisabledReasonVisible(page, label) {
  const missingReasons = await page.locator("button:disabled, [aria-disabled='true']").evaluateAll((nodes) =>
    nodes.map((node) => {
      const text = node.textContent?.trim() || "";
      const title = node.getAttribute("title") || "";
      const ariaDescription = node.getAttribute("aria-description") || "";
      const describedBy = node.getAttribute("aria-describedby") || "";
      const describedText = describedBy
        .split(/\s+/u)
        .map((id) => document.getElementById(id)?.textContent?.trim() || "")
        .filter(Boolean)
        .join(" ");
      return {
        text,
        title,
        ariaDescription,
        describedText,
      };
    }).filter((item) => {
      const reason = `${item.title} ${item.ariaDescription} ${item.describedText}`.trim();
      return reason.length === 0;
    }),
  );
  assert.deepEqual(missingReasons, [], `${label}_disabled_control_reason_missing:${JSON.stringify(missingReasons)}`);
}

async function assertEmptyErrorRecovery(page, label) {
  const metrics = await page.evaluate(() => {
    const recovery = document.querySelector("[data-ui-pattern='empty-error-recovery']");
    const alert = recovery?.getAttribute("role") === "alert" ? recovery : recovery?.querySelector("[role='alert']");
    const retry = [...document.querySelectorAll("button, a")]
      .find((node) => node.textContent?.includes("重试"));
    return {
      hasRecovery: Boolean(recovery),
      hasAlert: Boolean(alert),
      hasRetry: Boolean(retry),
      recoveryText: recovery?.textContent?.trim() || "",
      retryWidth: retry ? Math.round(retry.getBoundingClientRect().width) : 0,
      retryHeight: retry ? Math.round(retry.getBoundingClientRect().height) : 0,
    };
  });
  assert.equal(metrics.hasRecovery, true, `${label}_empty_error_recovery_marker_missing:${JSON.stringify(metrics)}`);
  assert.equal(metrics.hasAlert, true, `${label}_empty_error_recovery_alert_missing:${JSON.stringify(metrics)}`);
  assert.equal(metrics.hasRetry, true, `${label}_empty_error_recovery_retry_missing:${JSON.stringify(metrics)}`);
  assert(metrics.retryWidth >= 44 && metrics.retryHeight >= 44, `${label}_empty_error_recovery_retry_touch_target:${JSON.stringify(metrics)}`);
  assert(
    metrics.recoveryText.includes("Portal 数据暂时不可用，请稍后重试。"),
    `${label}_empty_error_recovery_user_copy_missing:${JSON.stringify(metrics)}`,
  );
  for (const leaked of ["Request failed", "status code", "Axios", "fixture_backend_failure", "HTTP 500", "stack"]) {
    assert.equal(metrics.recoveryText.includes(leaked), false, `${label}_empty_error_recovery_technical_copy_leaked:${leaked}`);
  }
}

async function assertReleaseOwnerReadinessBoundary(page, label) {
  const metrics = await page.evaluate(() => {
    const section = document.querySelector("[data-release-owner-readiness='partial_fail_closed_pending_owner_receipt']");
    const button = [...document.querySelectorAll("button")]
      .find((node) => node.textContent?.includes("释放交互接入中"));
    const reason = document.getElementById("release-owner-readiness-reason");
    const describedBy = button?.getAttribute("aria-describedby") || "";
    const buttonRect = button?.getBoundingClientRect();
    return {
      hasSection: Boolean(section),
      hasButton: Boolean(button),
      buttonDisabled: Boolean(button?.hasAttribute("disabled")),
      buttonDescribedBy: describedBy,
      hasReason: Boolean(reason),
      reasonText: reason?.textContent?.trim() || "",
      buttonWidth: buttonRect ? Math.round(buttonRect.width) : 0,
      buttonHeight: buttonRect ? Math.round(buttonRect.height) : 0,
      confirmDialogCount: document.querySelectorAll("[role='dialog']").length,
    };
  });
  assert.equal(metrics.hasSection, true, `${label}_release_owner_readiness_marker_missing:${JSON.stringify(metrics)}`);
  assert.equal(metrics.hasButton, true, `${label}_release_pending_button_missing:${JSON.stringify(metrics)}`);
  assert.equal(metrics.buttonDisabled, true, `${label}_release_pending_button_must_be_disabled:${JSON.stringify(metrics)}`);
  assert.equal(metrics.hasReason, true, `${label}_release_disabled_reason_missing:${JSON.stringify(metrics)}`);
  assert(
    metrics.buttonDescribedBy.split(/\s+/u).includes("release-owner-readiness-reason"),
    `${label}_release_button_must_reference_disabled_reason:${JSON.stringify(metrics)}`,
  );
  assert(
    metrics.reasonText.includes("释放能力仍在平台接入中") &&
      metrics.reasonText.includes("不能声明释放确认交互已完成") &&
      metrics.reasonText.includes("存储空间会继续保留"),
    `${label}_release_disabled_reason_copy_mismatch:${JSON.stringify(metrics)}`,
  );
  assert(
    metrics.buttonWidth >= 44 && metrics.buttonHeight >= 44,
    `${label}_release_pending_button_touch_target:${JSON.stringify(metrics)}`,
  );
  assert.equal(metrics.confirmDialogCount, 0, `${label}_release_confirm_dialog_must_not_render_before_owner_receipt:${JSON.stringify(metrics)}`);
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
    await assertHeadingHierarchy(page, "browser_overview");
    await assertTouchTargets(page, "nav a, nav button, header button", "browser_overview");
    await assertAgradeInteractionSystem(page, "browser_overview");
    await assertStateFeedbackPatterns(page, "browser_overview");
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

    const overviewErrorConsoleStart = consoleMessages.length;
    await page.route("**/api/overview*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "fixture_backend_failure" }),
      });
    });
    await page.goto(`${frontendBaseUrl}/overview`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取 Portal 总览数据");
    lastBodyText = await page.locator("body").innerText();
    await assertEmptyErrorRecovery(page, "browser_overview_error_recovery");
    assertResourceControlCopy(lastBodyText, "browser_overview_error_recovery", ["资源总览"]);
    await assertHeadingHierarchy(page, "browser_overview_error_recovery");
    await assertAgradeInteractionSystem(page, "browser_overview_error_recovery");
    await assertNoGlobalHorizontalOverflow(page, "browser_overview_error_recovery");
    await page.unroute("**/api/overview*");
    const expectedOverviewFetchError = "error:Failed to load resource: the server responded with a status of 500 (Internal Server Error)";
    const overviewErrorConsoleMessages = consoleMessages.slice(overviewErrorConsoleStart);
    assert(
      overviewErrorConsoleMessages.includes(expectedOverviewFetchError),
      `browser_overview_error_recovery_expected_fetch_error_missing:${JSON.stringify(overviewErrorConsoleMessages)}`,
    );
    consoleMessages = [
      ...consoleMessages.slice(0, overviewErrorConsoleStart),
      ...overviewErrorConsoleMessages.filter((message) => message !== expectedOverviewFetchError),
    ];

    await page.goto(`${frontendBaseUrl}/resources`, { waitUntil: "domcontentloaded" });
    await waitReady(page, "正在读取计算资源数据");
    await page.waitForSelector("text=计算资源", { timeout: 30000 });
    lastBodyText = await page.locator("body").innerText();
    assertResourceControlCopy(lastBodyText, "browser_runtime_environment", ["计算资源", "存储空间"]);
    await assertFirstH1(page, "计算资源", "browser_runtime_environment");
    await assertHeadingHierarchy(page, "browser_runtime_environment");
    await assertTouchTargets(page, "nav a, nav button, header button", "browser_runtime_environment");
    await assertAgradeInteractionSystem(page, "browser_runtime_environment");
    await assertStateFeedbackPatterns(page, "browser_runtime_environment");
    await assertDisabledReasonVisible(page, "browser_runtime_environment");
    assert(lastBodyText.includes("开通服务"), "browser_runtime_open_service_cta_missing");
    assert(lastBodyText.includes("当前订阅状态"), "browser_runtime_subscription_status_missing");
    assert(lastBodyText.includes("套餐价格尚待审批"), "browser_runtime_pricing_boundary_missing");
    assert.equal(lastBodyText.includes("CVM"), false, "browser_runtime_must_not_expose_cloud_console_copy");
    assert.equal(lastBodyText.includes("K8s"), false, "browser_runtime_must_not_expose_cloud_console_copy");
    if (lastBodyText.includes("释放与停止计费")) {
      assert(lastBodyText.includes("释放交互接入中"), "browser_runtime_release_partial_state_missing");
      assert.equal(lastBodyText.includes("mutation"), false, "browser_runtime_release_must_not_expose_mutation_copy");
      assert.equal(lastBodyText.includes("claim"), false, "browser_runtime_release_must_not_expose_claim_copy");
      assert.equal(lastBodyText.includes("runner phase"), false, "browser_runtime_release_must_not_expose_phase_copy");
      await assertReleaseOwnerReadinessBoundary(page, "browser_runtime_environment");
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
    await assertHeadingHierarchy(page, "browser_billing");
    await assertAgradeInteractionSystem(page, "browser_billing");
    await assertStateFeedbackPatterns(page, "browser_billing");
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
    await assertHeadingHierarchy(userPage, "browser_user_overview");
    await assertTouchTargets(userPage, "nav a, nav button, header button", "browser_user_overview");
    await assertAgradeInteractionSystem(userPage, "browser_user_overview");
    await assertStateFeedbackPatterns(userPage, "browser_user_overview");
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
    await assertHeadingHierarchy(page, "browser_admin_system");
    await assertStateFeedbackPatterns(page, "browser_admin_system");
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
