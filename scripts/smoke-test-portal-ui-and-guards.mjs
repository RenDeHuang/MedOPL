import fs from "node:fs";
import playwrightPkg from "../.runtime/browser-test/node_modules/playwright/index.js";
import { loginPortalOidc } from "./lib/portal-oidc-playwright.mjs";

const { chromium } = playwrightPkg;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function login(page, email, password) {
  await loginPortalOidc(page, {
    baseUrl: "http://127.0.0.1:17080",
    email,
    password,
  });
}

async function postAsAdmin(page, url, params) {
  return page.evaluate(async ({ url, params }) => {
    const body = new URLSearchParams(params);
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      credentials: "include",
      redirect: "manual",
    });
    return response.status;
  }, { url, params });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    ignoreHTTPSErrors: true,
  });

  const admin = await context.newPage();
  await login(admin, "zitadel-admin@zitadel.localhost", "Password1!");
  await admin.waitForTimeout(1500);
  await admin.goto("http://127.0.0.1:17080/portal/app/overview", { waitUntil: "domcontentloaded", timeout: 60000 });
  await admin.waitForTimeout(1500);

  const overviewJson = await admin.evaluate(async () => {
    const response = await fetch("/portal/api/overview", { credentials: "include" });
    return response.json();
  });
  assert(overviewJson?.kpis, "overview API 未返回 KPI");

  await admin.goto("http://127.0.0.1:17080/portal/app/billing", { waitUntil: "domcontentloaded", timeout: 60000 });
  const billingText = await admin.locator("body").innerText();
  assert(billingText.includes("账单"), "账单页未进入新版页面");
  const billingJson = await admin.evaluate(async () => {
    const response = await fetch("/portal/api/billing", { credentials: "include" });
    return response.json();
  });
  assert(Array.isArray(billingJson?.taskCosts), "billing API 未返回 taskCosts");

  await admin.goto("http://127.0.0.1:17080/portal/app/admin/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  const adminText = await admin.locator("body").innerText();
  assert(adminText.includes("运营总台"), "管理员页未进入新版页面");
  const adminJson = await admin.evaluate(async () => {
    const response = await fetch("/portal/api/admin/overview", { credentials: "include" });
    return response.json();
  });
  assert(Array.isArray(adminJson?.serviceStatuses), "admin overview API 未返回服务状态");

  const userEmail = `guard_${Date.now()}@example.com`;
  const createUserResponse = await postAsAdmin(admin, "/portal/admin/create-user", {
    name: "Guard User",
    email: userEmail,
    password: "PortalPass123!",
    redirectTo: "/portal/app/admin/users",
  });
  assert([0, 200, 302].includes(createUserResponse), "管理员创建用户失败");

  const disableRegistration = await postAsAdmin(admin, "/portal/admin/settings", { redirectTo: "/portal/app/admin/users" });
  assert([0, 200, 302].includes(disableRegistration), "关闭注册失败");
  await admin.waitForTimeout(1200);
  const usersAfterDisable = await admin.evaluate(async () => {
    const response = await fetch("/portal/api/admin/users", { credentials: "include" });
    return response.json();
  });
  assert(usersAfterDisable?.allowRegistration === false, "关闭注册后 allowRegistration 未生效");

  const db = JSON.parse(fs.readFileSync(".runtime/portal/portal-db.json", "utf8"));
  const createdUser = db.users.find((item) => item.email === userEmail);
  assert(createdUser, "未在 portal-db 中找到新创建用户");

  const toggleStatus = await postAsAdmin(admin, "/portal/admin/toggle-user", {
    userId: createdUser.id,
    redirectTo: "/portal/app/admin/users",
  });
  assert([0, 200, 302].includes(toggleStatus), "禁用用户接口调用失败");
  await admin.waitForTimeout(1200);
  const disabledDb = JSON.parse(fs.readFileSync(".runtime/portal/portal-db.json", "utf8"));
  const disabledUser = disabledDb.users.find((item) => item.id === createdUser.id);
  assert(disabledUser?.status === "disabled", "禁用用户后 portal-db 状态未更新");

  const lowBalanceEmail = `lowbalance_${Date.now()}@example.com`;
  const createLowBalanceResponse = await postAsAdmin(admin, "/portal/admin/create-user", {
    name: "Low Balance User",
    email: lowBalanceEmail,
    password: "PortalPass123!",
    redirectTo: "/portal/app/admin/users",
  });
  assert([0, 200, 302].includes(createLowBalanceResponse), "创建低余额用户失败");
  await admin.waitForTimeout(1200);
  const alertsJson = await admin.evaluate(async () => {
    const response = await fetch("/portal/api/admin/alerts", { credentials: "include" });
    return response.json();
  });
  const lowBalanceDb = JSON.parse(fs.readFileSync(".runtime/portal/portal-db.json", "utf8"));
  const lowBalanceUserRecord = lowBalanceDb.users.find((item) => item.email === lowBalanceEmail);
  assert(lowBalanceUserRecord, "未找到低余额用户记录");
  const lowBalanceWallet = lowBalanceDb.wallets.find((item) => item.userId === lowBalanceUserRecord.id);
  assert(Number(lowBalanceWallet?.balance || 0) <= 0, "低余额用户钱包状态不正确");
  assert(Array.isArray(alertsJson?.alerts), "admin alerts 未返回 alerts");

  const reopenRegistration = await postAsAdmin(admin, "/portal/admin/settings", {
    allowRegistration: "1",
    redirectTo: "/portal/app/admin/users",
  });
  assert([0, 200, 302].includes(reopenRegistration), "恢复注册失败");

  await admin.screenshot({ path: ".runtime/portal-admin-ui-guards.png", fullPage: true });
  await admin.close();
  await browser.close();

  console.log(JSON.stringify({
    ok: true,
    overviewKeys: Object.keys(overviewJson.kpis || {}),
    billingTaskCount: billingJson.taskCosts.length,
    serviceStatusCount: adminJson.serviceStatuses.length,
    createdUsers: [userEmail, lowBalanceEmail],
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
