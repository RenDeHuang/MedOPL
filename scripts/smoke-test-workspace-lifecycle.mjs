import fs from "node:fs";
import playwrightPkg from "../.runtime/browser-test/node_modules/playwright/index.js";

const { chromium } = playwrightPkg;

const PORTAL_EMAIL = "huangrende@gmail.com";
const PORTAL_PASSWORD = "PortalPass123!";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function visibleEmail(page) {
  return page.locator('input[type="email"]:visible, input[name="username"]:visible, input[name="loginName"]:visible').first();
}

function visiblePassword(page) {
  return page.locator('input[type="password"]:visible').first();
}

async function loginPortal(page, baseUrl) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('a[href="/auth/oidc/login"]').click();

  for (let i = 0; i < 12; i += 1) {
    if (/\/portal(?:\?|$)/.test(page.url())) {
      return;
    }

    if (page.url().includes("auth.localhost")) {
      if (await visibleEmail(page).count().catch(() => 0)) {
        await visibleEmail(page).fill(PORTAL_EMAIL);
        await Promise.allSettled([
          page.waitForLoadState("domcontentloaded", { timeout: 15000 }),
          page.locator('button[type="submit"]:visible').first().click(),
        ]);
        await page.waitForTimeout(1200);
        continue;
      }

      if (await visiblePassword(page).count().catch(() => 0)) {
        await visiblePassword(page).fill(PORTAL_PASSWORD);
        await Promise.allSettled([
          page.waitForLoadState("domcontentloaded", { timeout: 15000 }),
          page.locator('button[type="submit"]:visible').first().click(),
        ]);
        await page.waitForTimeout(1800);
        continue;
      }
    }

    await page.waitForTimeout(800);
  }

  throw new Error(`Portal OIDC login failed: ${page.url()}`);
}

async function postWithSession(page, path, params) {
  return page.evaluate(async ({ path, params }) => {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams(params),
      credentials: "include",
      redirect: "manual",
    });
    return response.status;
  }, { path, params });
}

(async () => {
  const baseUrl = "http://127.0.0.1:17080";
  const activeTaskTitle = `lifecycle-active-${Date.now()}`;
  const deleteTaskTitle = `lifecycle-delete-${Date.now()}`;

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  await loginPortal(page, baseUrl);

  const createActive = await postWithSession(page, "/portal/tasks/create", { title: activeTaskTitle });
  assert([0, 200, 302].includes(createActive), "创建活跃任务空间失败");

  let db = JSON.parse(fs.readFileSync(".runtime/portal/portal-db.json", "utf8"));
  const createdUser = db.users.find((item) => item.email === PORTAL_EMAIL);
  assert(createdUser, "未在 portal-db 中找到目标用户");

  let activeTask = db.taskSpaces.find((item) => item.userId === createdUser.id && item.title === activeTaskTitle);
  assert(activeTask, "未在 portal-db 中找到新建任务空间");

  const archiveActive = await postWithSession(page, "/portal/tasks/archive", { task: activeTask.slug });
  assert([0, 200, 302].includes(archiveActive), "归档任务空间失败");

  db = JSON.parse(fs.readFileSync(".runtime/portal/portal-db.json", "utf8"));
  activeTask = db.taskSpaces.find((item) => item.userId === createdUser.id && item.title === activeTaskTitle);
  assert(activeTask?.status === "archived", "归档后状态不是 archived");

  const restoreActive = await postWithSession(page, "/portal/tasks/restore", { task: activeTask.slug });
  assert([0, 200, 302].includes(restoreActive), "恢复任务空间失败");

  db = JSON.parse(fs.readFileSync(".runtime/portal/portal-db.json", "utf8"));
  activeTask = db.taskSpaces.find((item) => item.userId === createdUser.id && item.title === activeTaskTitle);
  assert(activeTask?.status === "active", "恢复后状态不是 active");

  const createDelete = await postWithSession(page, "/portal/tasks/create", { title: deleteTaskTitle });
  assert([0, 200, 302].includes(createDelete), "创建待删任务空间失败");

  db = JSON.parse(fs.readFileSync(".runtime/portal/portal-db.json", "utf8"));
  let deletedTask = db.taskSpaces.find((item) => item.userId === createdUser.id && item.title === deleteTaskTitle);
  assert(deletedTask, "未在 portal-db 中找到待删任务空间");

  const archiveDelete = await postWithSession(page, "/portal/tasks/archive", { task: deletedTask.slug });
  assert([0, 200, 302].includes(archiveDelete), "归档待删任务空间失败");

  const deleteStatus = await postWithSession(page, "/portal/tasks/delete", { task: deletedTask.slug });
  assert([0, 200, 302].includes(deleteStatus), "删除任务空间失败");

  db = JSON.parse(fs.readFileSync(".runtime/portal/portal-db.json", "utf8"));
  deletedTask = db.taskSpaces.find((item) => item.userId === createdUser.id && item.title === deleteTaskTitle);
  assert(deletedTask?.status === "deleted", "删除后的任务空间状态不是 deleted");

  const eventsRaw = fs.existsSync(".runtime/portal/events.jsonl")
    ? fs.readFileSync(".runtime/portal/events.jsonl", "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const userEvents = eventsRaw.filter((item) => item.userId === createdUser.id);
  assert(userEvents.some((item) => item.type === "workspace_created" && item.workspaceId === activeTask.slug), "缺少 workspace_created 事件");
  assert(userEvents.some((item) => item.type === "workspace_archived" && item.workspaceId === activeTask.slug), "缺少 workspace_archived 事件");
  assert(userEvents.some((item) => item.type === "workspace_restored" && item.workspaceId === activeTask.slug), "缺少 workspace_restored 事件");
  assert(userEvents.some((item) => item.type === "workspace_deleted" && item.workspaceId === deletedTask.slug), "缺少 workspace_deleted 事件");

  await page.goto(`${baseUrl}/portal/workspace?task=${activeTask.slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.screenshot({ path: ".runtime/portal-workspace-lifecycle.png", fullPage: true });
  await browser.close();

  console.log(JSON.stringify({
    ok: true,
    email: PORTAL_EMAIL,
    activeTask: { slug: activeTask.slug, status: activeTask.status },
    deletedTask: { slug: deletedTask.slug, status: deletedTask.status },
    eventTypes: [...new Set(userEvents.map((item) => item.type))],
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
