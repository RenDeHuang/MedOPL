import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const adminEmail = "zitadel-admin@zitadel.localhost";
const adminPassword = "Password1!";
const userEmail = "portal-local-api-user@example.test";
const updatedUserEmail = "portal-local-api-updated-user@example.test";
const userPassword = "Password123!";
const eventsFileName = "events.jsonl";

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

function userStatusFor(usersPayload, userId) {
  const user = (usersPayload.items || []).find((item) => item.id === userId);
  assert(user, `admin_user_missing:${userId}`);
  return String(user.status || "");
}

function requireAuditEvent(events, predicate, label) {
  const found = events.find(predicate);
  assert(found, `${label}_missing`);
  for (const field of ["actor", "action", "target", "before", "after", "reason", "idempotencyKey", "createdAt"]) {
    assert.notEqual(
      typeof found[field] === "string" ? found[field].trim() : found[field],
      field === "before" || field === "after" ? undefined : "",
      `${label}_${field}_required`,
    );
  }
  return found;
}

async function readAuditEvents(runtimeRoot) {
  const raw = await readFile(path.join(runtimeRoot, eventsFileName), "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

    const updateUser = await postForm(`${baseUrl}/portal/admin/update-user`, {
      userId: targetUser.id,
      name: "Portal Local API Updated User",
      email: updatedUserEmail,
      password: "",
      reason: "local api closure update user",
      idempotencyKey: "admin-update-user-once",
      redirectTo: "/admin/users",
    }, { cookie: adminCookie });
    assert.equal(updateUser.status, 302, "admin_update_user_must_redirect");
    const usersAfterUpdate = await getJson(`${baseUrl}/portal/api/admin/users`, { cookie: adminCookie });
    const updatedUser = (usersAfterUpdate.json.items || []).find((item) => item.id === targetUser.id);
    assert.equal(updatedUser?.name, "Portal Local API Updated User", "admin_update_user_must_update_name");
    assert.equal(updatedUser?.email, updatedUserEmail, "admin_update_user_must_update_email");

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

    const makeupChargeIdempotencyKey = "admin-makeup-charge-once";
    const makeupCharge = await postForm(`${baseUrl}/portal/admin/ledger-adjust`, {
      userId: targetUser.id,
      actionType: "makeup_charge",
      amount: "20",
      reason: "local api closure makeup charge",
      idempotencyKey: makeupChargeIdempotencyKey,
      redirectTo: "/admin/billing-ops",
    }, { cookie: adminCookie });
    assert.equal(makeupCharge.status, 302, "admin_makeup_charge_must_redirect");
    const usersAfterMakeupCharge = await getJson(`${baseUrl}/portal/api/admin/users`, { cookie: adminCookie });
    assert.equal(balanceFor(usersAfterMakeupCharge.json, targetUser.id), 130, "admin_makeup_charge_must_decrease_user_balance");

    const replayMakeupCharge = await postForm(`${baseUrl}/portal/admin/ledger-adjust`, {
      userId: targetUser.id,
      actionType: "makeup_charge",
      amount: "20",
      reason: "local api closure makeup charge",
      idempotencyKey: makeupChargeIdempotencyKey,
      redirectTo: "/admin/billing-ops",
    }, { cookie: adminCookie });
    assert.equal(replayMakeupCharge.status, 302, "admin_makeup_charge_replay_must_redirect");
    const usersAfterMakeupChargeReplay = await getJson(`${baseUrl}/portal/api/admin/users`, { cookie: adminCookie });
    assert.equal(balanceFor(usersAfterMakeupChargeReplay.json, targetUser.id), 130, "admin_makeup_charge_replay_must_not_double_charge");

    const disableUser = await postForm(`${baseUrl}/portal/admin/toggle-user`, {
      userId: targetUser.id,
      reason: "local api closure disable",
      idempotencyKey: "admin-disable-user-once",
      redirectTo: "/admin/users",
    }, { cookie: adminCookie });
    assert.equal(disableUser.status, 302, "admin_disable_user_must_redirect");
    const usersAfterDisable = await getJson(`${baseUrl}/portal/api/admin/users`, { cookie: adminCookie });
    assert.equal(userStatusFor(usersAfterDisable.json, targetUser.id), "disabled", "admin_disable_user_must_update_status");

    const restoreUser = await postForm(`${baseUrl}/portal/admin/toggle-user`, {
      userId: targetUser.id,
      reason: "local api closure restore",
      idempotencyKey: "admin-restore-user-once",
      redirectTo: "/admin/users",
    }, { cookie: adminCookie });
    assert.equal(restoreUser.status, 302, "admin_restore_user_must_redirect");
    const usersAfterRestore = await getJson(`${baseUrl}/portal/api/admin/users`, { cookie: adminCookie });
    assert.equal(userStatusFor(usersAfterRestore.json, targetUser.id), "active", "admin_restore_user_must_update_status");
    const userCookie = await login(baseUrl, updatedUserEmail, userPassword);

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
      reason: "local api closure publish",
      idempotencyKey: "announcement-activate-once",
      redirectTo: "/admin/alerts",
    }, { cookie: adminCookie });
    assert.equal(publishAnnouncement.status, 302, "announcement_publish_must_redirect");
    const announcementsAfterPublish = await getJson(`${baseUrl}/portal/api/announcements?mode=all`, { cookie: adminCookie });
    const publishedAnnouncement = (announcementsAfterPublish.json.items || []).find((item) => item.id === savedAnnouncement.id);
    assert.equal(publishedAnnouncement?.status, "active", "announcement_publish_must_be_visible_in_api");

    const userAnnouncementsAfterPublish = await getJson(`${baseUrl}/portal/api/announcements`, { cookie: userCookie });
    assert.equal(userAnnouncementsAfterPublish.response.status, 200, "public_announcements_after_publish_must_return_200");
    assert.equal(
      (userAnnouncementsAfterPublish.json.items || []).some((item) => item.id === savedAnnouncement.id),
      true,
      "announcement_publish_must_be_visible_to_user_surface",
    );

    const pinAnnouncement = await postForm(`${baseUrl}/portal/admin/announcements/toggle`, {
      id: savedAnnouncement.id,
      actionType: "pin",
      reason: "local api closure pin",
      idempotencyKey: "announcement-pin-once",
      redirectTo: "/admin/alerts",
    }, { cookie: adminCookie });
    assert.equal(pinAnnouncement.status, 302, "announcement_pin_must_redirect");
    const announcementsAfterPin = await getJson(`${baseUrl}/portal/api/announcements?mode=all`, { cookie: adminCookie });
    const pinnedAnnouncement = (announcementsAfterPin.json.items || []).find((item) => item.id === savedAnnouncement.id);
    assert.equal(Boolean(pinnedAnnouncement?.pinned), true, "announcement_pin_must_persist");

    const deactivateAnnouncement = await postForm(`${baseUrl}/portal/admin/announcements/toggle`, {
      id: savedAnnouncement.id,
      actionType: "deactivate",
      reason: "local api closure deactivate",
      idempotencyKey: "announcement-deactivate-once",
      redirectTo: "/admin/alerts",
    }, { cookie: adminCookie });
    assert.equal(deactivateAnnouncement.status, 302, "announcement_deactivate_must_redirect");
    const userAnnouncementsAfterDeactivate = await getJson(`${baseUrl}/portal/api/announcements`, { cookie: adminCookie });
    assert.equal(
      (userAnnouncementsAfterDeactivate.json.items || []).some((item) => item.id === savedAnnouncement.id),
      false,
      "announcement_deactivate_must_hide_from_visible_surface",
    );

    const republishAnnouncement = await postForm(`${baseUrl}/portal/admin/announcements/toggle`, {
      id: savedAnnouncement.id,
      actionType: "activate",
      reason: "local api closure republish",
      idempotencyKey: "announcement-reactivate-once",
      redirectTo: "/admin/alerts",
    }, { cookie: adminCookie });
    assert.equal(republishAnnouncement.status, 302, "announcement_republish_must_redirect");

    const deleteAnnouncement = await postForm(`${baseUrl}/portal/admin/announcements/delete`, {
      id: savedAnnouncement.id,
      reason: "local api closure delete",
      idempotencyKey: "announcement-delete-once",
      redirectTo: "/admin/alerts",
    }, { cookie: adminCookie });
    assert.equal(deleteAnnouncement.status, 302, "announcement_delete_must_redirect");
    const announcementsAfterDelete = await getJson(`${baseUrl}/portal/api/announcements?mode=all`, { cookie: adminCookie });
    assert.equal(
      (announcementsAfterDelete.json.items || []).some((item) => item.id === savedAnnouncement.id),
      false,
      "announcement_delete_must_remove_item_from_api",
    );
    const userAnnouncementsAfterDelete = await getJson(`${baseUrl}/portal/api/announcements`, { cookie: adminCookie });
    assert.equal(
      (userAnnouncementsAfterDelete.json.items || []).some((item) => item.id === savedAnnouncement.id),
      false,
      "announcement_delete_must_hide_from_user_surface",
    );

    const settingsSave = await postForm(`${baseUrl}/portal/admin/settings`, {
      allowRegistration: "0",
      siteName: "MedOPL Portal Admin Closure",
      siteLogo: "https://example.test/logo.svg",
      siteSubtitle: "本地设置保存闭环",
      homeContent: "本地设置保存闭环",
      reason: "local api closure settings",
      idempotencyKey: "admin-settings-save-once",
      redirectTo: "/admin/system",
    }, { cookie: adminCookie });
    assert.equal(settingsSave.status, 302, "admin_settings_save_must_redirect");
    const systemPayload = await getJson(`${baseUrl}/portal/api/admin/system`, { cookie: adminCookie });
    assert.equal(systemPayload.response.status, 200, "admin_system_payload_must_return_200");
    assert.equal(systemPayload.json.allowRegistration, false, "admin_settings_must_persist_allow_registration");
    assert.equal(systemPayload.json.publicSettings?.siteName, "MedOPL Portal Admin Closure", "admin_settings_must_persist_site_name");
    assert.equal(systemPayload.json.publicSettings?.siteSubtitle, "本地设置保存闭环", "admin_settings_must_persist_site_subtitle");

    const billingOpsBefore = await getJson(`${baseUrl}/portal/api/admin/billing-ops`, { cookie: adminCookie });
    assert.equal(billingOpsBefore.response.status, 200, "admin_billing_ops_before_must_return_200");
    const billingOpsPayloadBefore = billingOpsBefore.json;
    const billingOpsUser = (billingOpsPayloadBefore.users || []).find((item) => item.id === targetUser.id);
    assert(billingOpsUser, "billing_ops_user_must_exist");

    const billingOpIdempotencyKey = "billing-op-refund-once";
    const billingOpRefund = await postForm(`${baseUrl}/portal/admin/ledger-adjust`, {
      userId: targetUser.id,
      actionType: "refund",
      amount: "10",
      reason: "billing op local closure refund",
      workspaceId: "default",
      idempotencyKey: billingOpIdempotencyKey,
      redirectTo: "/admin/billing-ops",
    }, { cookie: adminCookie });
    assert.equal(billingOpRefund.status, 302, "billing_op_refund_must_redirect");
    const billingOpsAfter = await getJson(`${baseUrl}/portal/api/admin/billing-ops`, { cookie: adminCookie });
    const billingOpAdjustment = (billingOpsAfter.json.adjustments || []).find((item) => item.reason === "billing op local closure refund");
    assert(billingOpAdjustment?.id, "billing_op_refund_must_have_operational_id");
    assert.equal(
      Boolean(billingOpAdjustment),
      true,
      "billing_op_refund_must_be_visible_in_billing_ops",
    );

    const billingOpMark = await postForm(`${baseUrl}/portal/admin/billing-ops/mark`, {
      itemId: billingOpAdjustment.id,
      status: "approved",
      anomaly: "1",
      note: "本地账单运营处理备注",
      reason: "billing op local closure mark",
      idempotencyKey: "billing-op-mark-once",
      redirectTo: "/admin/billing-ops",
    }, { cookie: adminCookie });
    assert.equal(billingOpMark.status, 302, "billing_op_mark_must_redirect");
    const billingOpsAfterMark = await getJson(`${baseUrl}/portal/api/admin/billing-ops`, { cookie: adminCookie });
    const markedBillingOp = (billingOpsAfterMark.json.adjustments || []).find((item) => item.id === billingOpAdjustment.id);
    assert.equal(markedBillingOp?.status, "approved", "billing_op_mark_must_update_status");
    assert.equal(Boolean(markedBillingOp?.anomaly), true, "billing_op_mark_must_flag_anomaly");
    assert.equal(markedBillingOp?.note, "本地账单运营处理备注", "billing_op_mark_must_persist_note");

    const auditPayload = await getJson(`${baseUrl}/portal/api/admin/audit`, { cookie: adminCookie });
    assert.equal(auditPayload.response.status, 200, "admin_audit_payload_must_return_200");
    assert((auditPayload.json.items || []).length > 0, "admin_audit_payload_must_not_be_empty");

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

    const auditEvents = await readAuditEvents(runtimeRoot);
    requireAuditEvent(auditEvents, (event) => event.action === "admin_user_created" && event.target?.userId === targetUser.id, "audit_user_created");
    requireAuditEvent(auditEvents, (event) => event.action === "admin_user_updated" && event.idempotencyKey === "admin-update-user-once", "audit_user_updated");
    requireAuditEvent(auditEvents, (event) => event.action === "admin_user_wallet_makeup_charge" && event.idempotencyKey === makeupChargeIdempotencyKey, "audit_makeup_charge");
    requireAuditEvent(auditEvents, (event) => event.action === "admin_user_disabled" && event.idempotencyKey === "admin-disable-user-once", "audit_user_disabled");
    requireAuditEvent(auditEvents, (event) => event.action === "admin_user_restored" && event.idempotencyKey === "admin-restore-user-once", "audit_user_restored");
    requireAuditEvent(auditEvents, (event) => event.action === "admin_announcement_deleted" && event.idempotencyKey === "announcement-delete-once", "audit_announcement_deleted");
    requireAuditEvent(auditEvents, (event) => event.action === "admin_system_settings_saved" && event.idempotencyKey === "admin-settings-save-once", "audit_system_settings");
    requireAuditEvent(auditEvents, (event) => event.action === "admin_billing_ops_marked" && event.idempotencyKey === "billing-op-mark-once", "audit_billing_ops_marked");
  });

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_local_api_action_closure",
    baseUrl,
    checked: [
      "admin_create_user",
      "admin_update_user",
      "admin_recharge",
      "admin_refund",
      "admin_makeup_charge_idempotent",
      "admin_disable_restore_delete",
      "announcement_save_publish_pin_deactivate_delete",
      "admin_system_settings_saved",
      "admin_billing_ops_adjustment",
      "admin_billing_ops_mark_status_note_anomaly",
      "audit_event_shape",
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
