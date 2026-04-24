import playwrightPkg from "../.runtime/browser-test/node_modules/playwright/index.js";
import { loginPortalOidc } from "./lib/portal-oidc-playwright.mjs";

const { chromium } = playwrightPkg;

const baseUrl = process.env.PORTAL_BASE_URL || "http://127.0.0.1:17080";
const adminEmail = process.env.PORTAL_ADMIN_EMAIL || "zitadel-admin@zitadel.localhost";
const adminPassword = process.env.PORTAL_ADMIN_PASSWORD || "Password1!";
const testLoginMode = process.env.PORTAL_TEST_LOGIN || "oidc";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectPage(page, path, textHint = "") {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  assert(page.url().startsWith(baseUrl), `${path} 未停留在 Portal 域：${page.url()}`);
  if (textHint) {
    assert(body.includes(textHint), `${path} 未出现关键文案：${textHint}`);
  }
  console.log(`PAGE OK ${path}`);
  return body;
}

async function expectJsonOk(page, path, validator) {
  const result = await page.evaluate(async (targetPath) => {
    const response = await fetch(targetPath, {
      headers: { accept: "application/json" },
      credentials: "include",
    });
    return {
      status: response.status,
      json: await response.json(),
    };
  }, path);

  assert(result.status === 200, `${path} 预期 200，实际 ${result.status}`);
  if (validator) validator(result.json);
  console.log(`API OK  ${path}`);
  return result.json;
}

async function loginPortalLocal(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.locator('input[name="email"]').fill(adminEmail);
  await page.locator('input[name="password"]').fill(adminPassword);
  await Promise.all([
    page.waitForURL((url) => url.href.startsWith(`${baseUrl}/portal`), { timeout: 120000 }),
    page.locator('button[type="submit"], input[type="submit"]').first().click(),
  ]);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    if (testLoginMode === "local") {
      await loginPortalLocal(page);
    } else {
      await loginPortalOidc(page, {
        baseUrl,
        email: adminEmail,
        password: adminPassword,
      });
    }

    await expectPage(page, "/portal/app/overview", "MedOPL 统一门户");
    await expectPage(page, "/portal/app/workspace?task=default", "任务空间");
    await expectPage(page, "/portal/app/billing", "账单");
    await expectPage(page, "/portal/app/trace", "轨迹");
    await expectPage(page, "/portal/app/admin/dashboard", "运行总台");
    await expectPage(page, "/portal/app/admin/alerts", "告警中心");
    await expectPage(page, "/portal/app/admin/users", "用户管理");
    await expectPage(page, "/portal/app/admin/trace", "Trace");
    await expectPage(page, "/portal/app/admin/groups", "分组");
    await expectPage(page, "/portal/app/admin/usage", "使用");
    await expectPage(page, "/portal/app/admin/billing-ops", "计费运维");
    await expectPage(page, "/portal/app/admin/system", "系统");
    await expectPage(page, "/portal/app/admin/ops", "运维");
    await expectPage(page, "/portal/app/admin/sandboxes", "K8s运维与分发");
    await expectPage(page, "/portal/app/admin/audit", "审计");

    const overview = await expectJsonOk(page, "/portal/api/overview", (json) => assert(Boolean(json?.kpis), "overview API 未返回 kpis"));
    const billing = await expectJsonOk(page, "/portal/api/billing", (json) => assert(Array.isArray(json?.taskCosts), "billing API 未返回 taskCosts"));
    const workspace = await expectJsonOk(page, "/portal/api/workspace?task=default", (json) => assert(Boolean(json?.workspace?.slug), "workspace API 未返回 workspace"));
    await expectJsonOk(page, "/portal/api/sessions?page_size=5", (json) => assert(Boolean(json?.pagination), "sessions API 未返回 pagination"));
    await expectJsonOk(page, "/portal/api/traces?page_size=5", (json) => assert(Array.isArray(json?.items), "traces API 未返回 items"));
    await expectJsonOk(page, "/portal/api/announcements", (json) => assert(Array.isArray(json?.items), "announcements API 未返回 items"));
    const adminOverview = await expectJsonOk(page, "/portal/api/admin/overview", (json) => assert(Array.isArray(json?.serviceStatuses), "admin overview 未返回服务状态"));
    const adminUsers = await expectJsonOk(page, "/portal/api/admin/users", (json) => assert(Array.isArray(json?.items), "admin users 未返回 items"));
    await expectJsonOk(page, "/portal/api/admin/groups", (json) => assert(Array.isArray(json?.groups), "admin groups 未返回 groups"));
    await expectJsonOk(page, "/portal/api/admin/billing-ops", (json) => assert(Boolean(json?.billingSync), "admin billing-ops 未返回 billingSync"));
    await expectJsonOk(page, "/portal/api/admin/usage", (json) => assert(Array.isArray(json?.items), "admin usage 未返回 items"));
    await expectJsonOk(page, "/portal/api/admin/system", (json) => assert(Array.isArray(json?.serviceStatuses), "admin system 未返回 serviceStatuses"));
    await expectJsonOk(page, "/portal/api/admin/ops", (json) => assert(Boolean(json?.systemMetrics), "admin ops 未返回 systemMetrics"));
    await expectJsonOk(page, "/portal/api/admin/sandboxes", (json) => assert(Array.isArray(json?.items), "admin sandboxes 未返回 items"));
    await expectJsonOk(page, "/portal/api/admin/audit", (json) => assert(Array.isArray(json?.items), "admin audit 未返回 items"));
    const alerts = await expectJsonOk(page, "/portal/api/admin/alerts", (json) => assert(Array.isArray(json?.alerts), "admin alerts 未返回 alerts"));

    console.log(JSON.stringify({
      ok: true,
      overviewKpis: Object.keys(overview.kpis || {}),
      billingTaskCount: billing.taskCosts.length,
      workspaceSlug: workspace.workspace.slug,
      adminUserCount: adminUsers.pagination?.total ?? adminUsers.items?.length ?? 0,
      alertCount: alerts.alerts.length,
      serviceStatusCount: adminOverview.serviceStatuses.length,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("ACCEPTANCE FAILED");
  console.error(error);
  process.exitCode = 1;
});
