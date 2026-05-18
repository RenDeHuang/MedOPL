import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const adminEmail = "zitadel-admin@zitadel.localhost";
const adminPassword = "Password1!";
const userEmail = "portal-local-api-user@example.test";
const userPassword = "Password123!";

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

async function withRuntime(fn) {
  const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-local-api-closure-"));
  try {
    return await fn(runtimeRoot);
  } finally {
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
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

async function postJson(url, payload, { cookie = "" } = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
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

async function login(baseUrl, email, password) {
  const response = await postForm(`${baseUrl}/login`, { email, password });
  assert.equal(response.status, 302, `login_must_redirect:${email}`);
  return cookieHeaderFrom(response, "portal_session");
}

function firstNonAdminUser(usersPayload) {
  return (usersPayload.items || []).find((item) => item.role !== "admin" && item.email === userEmail);
}

function balanceFor(usersPayload, userId) {
  const user = (usersPayload.items || []).find((item) => item.id === userId);
  assert(user, `admin_user_missing:${userId}`);
  return Number(user.balance || 0);
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
let portal = null;
let stdout = "";
let stderr = "";

try {
  await withRuntime(async (runtimeRoot) => {
    portal = spawn(process.execPath, [portalEntrypoint], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        PORTAL_RUNTIME_ROOT: runtimeRoot,
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
    const adminCookie = await login(baseUrl, adminEmail, adminPassword);

    const createUser = await postForm(`${baseUrl}/portal/admin/create-user`, {
      name: "Portal Local API User",
      email: userEmail,
      password: userPassword,
      redirectTo: "/admin/users",
    }, { cookie: adminCookie });
    assert.equal(createUser.status, 302, "admin_create_user_must_redirect");

    const usersAfterCreate = await getJson(`${baseUrl}/portal/api/admin/users`, { cookie: adminCookie });
    assert.equal(usersAfterCreate.response.status, 200, "admin_users_after_create_must_return_200");
    const targetUser = firstNonAdminUser(usersAfterCreate.json);
    assert(targetUser?.id, "created_user_must_appear_in_admin_users_api");
    assert.equal(balanceFor(usersAfterCreate.json, targetUser.id), 0, "created_user_balance_must_start_zero");

    const recharge = await postForm(`${baseUrl}/portal/admin/recharge`, {
      userId: targetUser.id,
      amount: "120",
      redirectTo: "/admin/users",
    }, { cookie: adminCookie });
    assert.equal(recharge.status, 302, "admin_recharge_must_redirect");
    const usersAfterRecharge = await getJson(`${baseUrl}/portal/api/admin/users`, { cookie: adminCookie });
    assert.equal(balanceFor(usersAfterRecharge.json, targetUser.id), 120, "admin_recharge_must_update_user_balance");

    const refund = await postForm(`${baseUrl}/portal/admin/ledger-adjust`, {
      userId: targetUser.id,
      actionType: "refund",
      amount: "30",
      reason: "local api closure smoke",
      redirectTo: "/admin/users",
    }, { cookie: adminCookie });
    assert.equal(refund.status, 302, "admin_refund_must_redirect");
    const usersAfterRefund = await getJson(`${baseUrl}/portal/api/admin/users`, { cookie: adminCookie });
    assert.equal(balanceFor(usersAfterRefund.json, targetUser.id), 150, "admin_refund_must_update_user_balance");

    const saveAnnouncement = await postForm(`${baseUrl}/portal/admin/announcements/save`, {
      title: "本地闭环公告",
      content: "公告保存、发布、删除必须能被 API 读回。",
      status: "inactive",
      pinned: "0",
      redirectTo: "/admin/alerts",
    }, { cookie: adminCookie });
    assert.equal(saveAnnouncement.status, 302, "announcement_save_must_redirect");
    const announcementsAfterSave = await getJson(`${baseUrl}/portal/api/announcements?mode=all`, { cookie: adminCookie });
    const savedAnnouncement = (announcementsAfterSave.json.items || []).find((item) => item.title === "本地闭环公告");
    assert(savedAnnouncement?.id, "announcement_save_must_be_visible_in_api");
    assert.equal(savedAnnouncement.status, "inactive", "announcement_save_must_preserve_inactive_status");

    const publishAnnouncement = await postForm(`${baseUrl}/portal/admin/announcements/toggle`, {
      id: savedAnnouncement.id,
      actionType: "activate",
      redirectTo: "/admin/alerts",
    }, { cookie: adminCookie });
    assert.equal(publishAnnouncement.status, 302, "announcement_publish_must_redirect");
    const announcementsAfterPublish = await getJson(`${baseUrl}/portal/api/announcements?mode=all`, { cookie: adminCookie });
    const publishedAnnouncement = (announcementsAfterPublish.json.items || []).find((item) => item.id === savedAnnouncement.id);
    assert.equal(publishedAnnouncement?.status, "active", "announcement_publish_must_be_visible_in_api");

    const deleteAnnouncement = await postForm(`${baseUrl}/portal/admin/announcements/delete`, {
      id: savedAnnouncement.id,
      redirectTo: "/admin/alerts",
    }, { cookie: adminCookie });
    assert.equal(deleteAnnouncement.status, 302, "announcement_delete_must_redirect");
    const announcementsAfterDelete = await getJson(`${baseUrl}/portal/api/announcements?mode=all`, { cookie: adminCookie });
    assert.equal(
      (announcementsAfterDelete.json.items || []).some((item) => item.id === savedAnnouncement.id),
      false,
      "announcement_delete_must_remove_item_from_api",
    );

    const userCookie = await login(baseUrl, userEmail, userPassword);
    const activatePackage = await postJson(`${baseUrl}/portal/api/lab-packages/activate`, {
      packageId: "starter_2c4g_10gb",
      workspaceId: "workspace-local-api",
      idempotencyKey: "local-api-closure-starter",
    }, { cookie: userCookie });
    assert.equal(activatePackage.status, 201, "lab_package_activate_must_create_subscription");
    const activatedPayload = await activatePackage.json();
    assert.equal(activatedPayload.ok, true, "lab_package_activate_payload_ok");
    assert.equal(activatedPayload.currentPackageId, "starter_2c4g_10gb", "lab_package_activate_package_id_mismatch");

    const subscription = await getJson(`${baseUrl}/portal/api/lab-subscription?workspaceId=workspace-local-api`, { cookie: userCookie });
    assert.equal(subscription.response.status, 200, "lab_subscription_must_return_200");
    assert.equal(subscription.json.currentPackageId, "starter_2c4g_10gb", "lab_subscription_must_reflect_activation");

    const logout = await fetch(`${baseUrl}/logout`, { headers: { cookie: userCookie }, redirect: "manual" });
    assert.equal(logout.status, 302, "logout_must_redirect");
    assert.equal(logout.headers.get("location"), "/login?force_login=1", "logout_location_mismatch");
  });

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_local_api_action_closure",
    baseUrl,
    checked: [
      "admin_create_user",
      "admin_recharge",
      "admin_refund",
      "announcement_save_publish_delete",
      "user_lab_package_activation",
      "logout_route",
    ],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    contract: "v22_portal_local_api_action_closure",
    baseUrl,
    error: String(error.message || error),
    stdout,
    stderr,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await stopChild(portal);
}
