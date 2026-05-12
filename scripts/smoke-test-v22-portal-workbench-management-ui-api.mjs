import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const portalRuntimeRoot = path.join(repoRoot, ".runtime", "portal");
const adminEmail = "zitadel-admin@zitadel.localhost";
const adminPassword = "Password1!";

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function cookieHeaderFrom(response, name) {
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  assert(match, `${name}_cookie_required`);
  assert(setCookie.includes("HttpOnly"), `${name}_cookie_must_be_http_only`);
  return `${name}=${match[1]}`;
}

async function waitFor(url, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    assert.equal(child.exitCode, null, `portal_process_exited:${child.exitCode}`);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0 && response.status < 500) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    sleep(1500).then(() => false),
  ]);
  if (!exited) child.kill("SIGKILL");
}

async function withIsolatedPortalRuntime(fn) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-workbench-ui-api-"));
  const backupRoot = path.join(tempRoot, "portal-runtime-backup");
  const hadRuntime = await exists(portalRuntimeRoot);
  if (hadRuntime) await rename(portalRuntimeRoot, backupRoot);
  try {
    await mkdir(path.dirname(portalRuntimeRoot), { recursive: true });
    return await fn();
  } finally {
    await rm(portalRuntimeRoot, { recursive: true, force: true }).catch(() => {});
    if (hadRuntime && await exists(backupRoot)) {
      await rename(backupRoot, portalRuntimeRoot);
    }
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
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

async function getJson(url, { cookie = "" } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
    },
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

function assertPageHas(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
let portal = null;
let stdout = "";
let stderr = "";

try {
  await withIsolatedPortalRuntime(async () => {
    portal = spawn(process.execPath, [portalEntrypoint], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
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

    await waitFor(`${baseUrl}/healthz`, portal);

    const publicSettings = await getJson(`${baseUrl}/portal/api/public/settings`);
    assert.equal(publicSettings.response.status, 200, "public_settings_must_return_200");
    assert.equal(publicSettings.json.siteName, "MedOPL", "public_settings_site_name_default_mismatch");
    assert("siteLogo" in publicSettings.json, "public_settings_site_logo_missing");
    assert("siteSubtitle" in publicSettings.json, "public_settings_site_subtitle_missing");
    assert("homeContent" in publicSettings.json, "public_settings_home_content_missing");
    assert.equal(JSON.stringify(publicSettings.json).includes("Secret"), false, "public_settings_must_not_expose_secret");

    const home = await fetch(`${baseUrl}/`, { redirect: "manual" });
    const homeHtml = await home.text();
    assert.equal(home.status, 200, "public_home_must_return_200");
    assertPageHas(homeHtml, "One Person Lab", "public_home_default_intro");
    assertPageHas(homeHtml, "登录", "public_home_login_link");
    assertPageHas(homeHtml, "注册", "public_home_register_link");
    assert.equal(homeHtml.includes("使用统一账号登录"), false, "public_home_must_not_show_oidc_primary_copy");

    const loginPage = await fetch(`${baseUrl}/login`, { redirect: "manual" });
    const loginHtml = await loginPage.text();
    assert.equal(loginPage.status, 200, "login_page_must_return_200");
    assertPageHas(loginHtml, 'name="email"', "login_page_email_field");
    assertPageHas(loginHtml, 'name="password"', "login_page_password_field");
    assertPageHas(loginHtml, "注册新账号", "login_page_register_link");
    assert.equal(loginHtml.includes("使用统一账号登录"), false, "login_page_must_not_show_oidc_primary_copy");

    const legacyOverview = await fetch(`${baseUrl}/portal/app/overview`, { redirect: "manual" });
    assert.equal(legacyOverview.status, 302, "legacy_overview_must_redirect");
    assert.equal(legacyOverview.headers.get("location"), "/overview", "legacy_overview_location_mismatch");
    const legacyAdminSystem = await fetch(`${baseUrl}/portal/app/admin/system`, { redirect: "manual" });
    assert.equal(legacyAdminSystem.status, 302, "legacy_admin_system_must_redirect");
    assert.equal(legacyAdminSystem.headers.get("location"), "/admin/system", "legacy_admin_system_location_mismatch");

    const protectedOverview = await fetch(`${baseUrl}/overview`, { redirect: "manual" });
    assert.equal(protectedOverview.status, 302, "protected_overview_must_redirect_when_logged_out");
    assert.equal(protectedOverview.headers.get("location"), "/login", "protected_overview_login_location_mismatch");
    const protectedAdminSystem = await fetch(`${baseUrl}/admin/system`, { redirect: "manual" });
    assert.equal(protectedAdminSystem.status, 302, "protected_admin_system_must_redirect_when_logged_out");
    assert.equal(protectedAdminSystem.headers.get("location"), "/login", "protected_admin_system_login_location_mismatch");

    const login = await postForm(`${baseUrl}/login`, { email: adminEmail, password: adminPassword });
    assert.equal(login.status, 302, "login_must_redirect");
    assert.equal(login.headers.get("location"), "/overview", "login_success_location_mismatch");
    const cookie = cookieHeaderFrom(login, "portal_session");

    const adminSystemBefore = await getJson(`${baseUrl}/portal/api/admin/system`, { cookie });
    assert.equal(adminSystemBefore.response.status, 200, "admin_system_must_return_200");
    assert.equal(adminSystemBefore.json.publicSettings.siteName, "MedOPL", "admin_system_public_settings_missing");

    const customHome = '<main class="opl-home"><h1>OPL 科研工作台</h1><p>可配置首页内容</p></main>';
    const saveSettings = await postForm(`${baseUrl}/portal/admin/settings`, {
      allowRegistration: "1",
      siteName: "MedOPL Portal",
      siteLogo: "https://example.test/logo.png",
      siteSubtitle: "托管 OPL 科研工作台",
      homeContent: customHome,
      redirectTo: "/admin/system",
    }, { cookie });
    assert.equal(saveSettings.status, 302, "admin_settings_save_must_redirect");

    const settingsAfter = await getJson(`${baseUrl}/portal/api/public/settings`);
    assert.equal(settingsAfter.json.siteName, "MedOPL Portal", "public_settings_site_name_save_mismatch");
    assert.equal(settingsAfter.json.siteLogo, "https://example.test/logo.png", "public_settings_site_logo_save_mismatch");
    assert.equal(settingsAfter.json.siteSubtitle, "托管 OPL 科研工作台", "public_settings_site_subtitle_save_mismatch");
    assert.equal(settingsAfter.json.homeContent, customHome, "public_settings_home_content_save_mismatch");

    const customHomePage = await fetch(`${baseUrl}/`, { redirect: "manual" });
    const customHomeHtml = await customHomePage.text();
    assert.equal(customHomePage.status, 200, "custom_home_must_return_200");
    assertPageHas(customHomeHtml, "OPL 科研工作台", "custom_home_html");
    assert.equal(customHomeHtml.includes("可配置首页内容"), true, "custom_home_content_must_render");
  });

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_workbench_management_ui_api",
    baseUrl,
    checked: [
      "public_settings_api",
      "public_home_default",
      "login_password_form",
      "admin_settings_save",
      "public_home_custom_content",
    ],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    contract: "v22_portal_workbench_management_ui_api",
    baseUrl,
    error: String(error.message || error),
    stdout,
    stderr,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await stopChild(portal);
}
