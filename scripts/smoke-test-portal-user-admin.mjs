import playwrightPkg from "../.runtime/browser-test/node_modules/playwright/index.js";
import fs from "node:fs";

const { chromium } = playwrightPkg;

async function registerAndLoginUser(baseUrl, email, password) {
  const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await page.goto(`${baseUrl}/register`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('input[name="name"]').fill("Portal User");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1500);

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);

  return { browser, page };
}

async function loginAdmin(baseUrl, email, password) {
  const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);

  return { browser, page };
}

(async () => {
  const baseUrl = "http://127.0.0.1:17080";
  const userEmail = `portal_${Date.now()}@example.com`;
  const userPassword = "PortalPass123!";
  const taskName = `task-${Date.now()}`;

  const { browser: userBrowser, page: userPage } = await registerAndLoginUser(baseUrl, userEmail, userPassword);
  console.log("USER_URL=" + userPage.url());
  console.log("USER_DASHBOARD=" + (await userPage.locator("body").innerText()).slice(0, 2000));

  await userPage.goto(`${baseUrl}/portal/workspace`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await userPage.locator('input[name="title"]').fill(taskName);
  await userPage.locator('form[action="/portal/tasks/create"] button[type="submit"]').click();
  await userPage.waitForTimeout(2000);
  const tmpFile = ".runtime/portal-upload-demo.txt";
  fs.writeFileSync(tmpFile, "portal upload demo");
  await userPage.locator('form[action^="/portal/workspace/upload?task="] input[type="file"]').setInputFiles(tmpFile);
  await userPage.locator('form[action^="/portal/workspace/upload?task="] button[type="submit"]').click();
  await userPage.waitForTimeout(3000);
  console.log("USER_WORKSPACE=" + (await userPage.locator("body").innerText()).slice(0, 2000));
  await userPage.screenshot({ path: ".runtime/portal-user-workspace.png", fullPage: true });

  const { browser: adminBrowser, page: adminPage } = await loginAdmin(baseUrl, "zitadel-admin@zitadel.localhost", "Password1!");
  await adminPage.goto(`${baseUrl}/portal/admin`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await adminPage.waitForTimeout(2000);
  console.log("ADMIN_DASHBOARD=" + (await adminPage.locator("body").innerText()).slice(0, 3000));

  const rechargeForms = adminPage.locator('form[action="/portal/admin/recharge"]');
  const formCount = await rechargeForms.count();
  const targetIndex = Math.max(0, formCount - 1);
  await rechargeForms.nth(targetIndex).locator('input[name="amount"]').fill("50");
  await rechargeForms.nth(targetIndex).locator('button[type="submit"]').click();
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: ".runtime/portal-admin.png", fullPage: true });

  await userPage.goto(`${baseUrl}/portal/billing`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await userPage.waitForTimeout(2000);
  console.log("USER_BILLING=" + (await userPage.locator("body").innerText()).slice(0, 2000));
  await userPage.screenshot({ path: ".runtime/portal-user-billing.png", fullPage: true });

  await adminBrowser.close();
  await userBrowser.close();
})();

