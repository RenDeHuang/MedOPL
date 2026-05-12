import { randomUUID } from "node:crypto";

import { createPortalUserRecord } from "../app/portal-auth-runtime-handler.mjs";
import { hashPassword } from "../domain/portal-auth.mjs";

function zitadelErrorDetail(error) {
  return String(error.stdout || error.stderr || error.message || error);
}

function adminForbidden({ res, user, sendHtml, layoutV2 }) {
  if (user.role === "admin") return false;
  sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
  return true;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

export function createPortalAdminUserRoutes({
  activeUserStatus,
  appendLedgerEntry,
  defaultTaskTitle,
  ensureTaskSpace,
  ensureUserCommercialState,
  layoutV2,
  logPortalEvent,
  parseForm,
  readBody,
  runZitadelAdminUser,
  sendHtml,
  writeDb,
}) {
  async function readForm(req) {
    return parseForm((await readBody(req)).toString("utf8"));
  }

  async function handleCreateUser({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/create-user") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const redirectTo = String(form.redirectTo || "/portal/admin/users").trim();
    let identitySync = { synced: false, source: "portal_local_identity" };
    try {
      identitySync = await runZitadelAdminUser(["create-user", form.email, form.name, form.password]);
    } catch (error) {
      const detail = zitadelErrorDetail(error);
      sendHtml(res, layoutV2("创建失败", `<div class="card">ZITADEL 同步失败。<br/><code>${detail.slice(0, 400)}</code></div>`, user), 502);
      return true;
    }
    const createdResult = await createPortalUserRecord(db, form, {
      authSource: identitySync.source,
      defaultTaskTitle,
      ensureTaskSpace,
      ensureUserCommercialState,
    });
    if (!createdResult.ok) {
      sendHtml(res, layoutV2("创建失败", `<div class="card">${createdResult.message}</div>`, user), createdResult.status || 400);
      return true;
    }
    const created = createdResult.user;
    await logPortalEvent({ type: "admin_created_user", userId: created.id, operatorId: user.id, email: created.email, authSource: identitySync.source });
    await writeDb(db);
    redirect(res, redirectTo);
    return true;
  }

  async function handleUpdateUser({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/update-user") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const redirectTo = String(form.redirectTo || "/admin/users").trim();
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin" && activeUserStatus(item.status) !== "deleted");
    if (!target) {
      sendHtml(res, layoutV2("更新失败", `<div class="card">未找到目标用户。</div>`, user), 404);
      return true;
    }
    const nextEmail = String(form.email || target.email || "").trim().toLowerCase();
    const nextName = String(form.name || target.name || "").trim();
    const nextPassword = String(form.password || "").trim();
    if (!nextEmail || !nextName) {
      sendHtml(res, layoutV2("更新失败", `<div class="card">用户名和邮箱不能为空。</div>`, user), 400);
      return true;
    }
    const duplicated = db.users.find((item) => item.id !== target.id && String(item.email || "").toLowerCase() === nextEmail);
    if (duplicated) {
      sendHtml(res, layoutV2("更新失败", `<div class="card">邮箱已被其他账户占用。</div>`, user), 400);
      return true;
    }
    target.email = nextEmail;
    target.name = nextName;
    if (nextPassword) target.passwordHash = hashPassword(nextPassword);
    await logPortalEvent({ type: "user_profile_updated", userId: target.id, operatorId: user.id, email: target.email, name: target.name });
    await writeDb(db);
    redirect(res, redirectTo);
    return true;
  }

  async function handleRecharge({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/recharge") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const redirectTo = String(form.redirectTo || "/portal/admin/users").trim();
    const amount = Number(form.amount || 0);
    const wallet = db.wallets.find((item) => item.userId === form.userId);
    if (!wallet || !Number.isFinite(amount) || amount <= 0) {
      sendHtml(res, layoutV2("充值失败", `<div class="card">参数错误</div>`, user), 400);
      return true;
    }
    if (typeof writeDb.topupWallet !== "function") {
      sendHtml(res, layoutV2("充值失败", `<div class="card">账单事务未启用</div>`, user), 503);
      return true;
    }
    const idempotencyKey = String(form.idempotencyKey || `admin-recharge:${form.userId}:${amount}:${Date.now()}:${randomUUID()}`);
    const result = await writeDb.topupWallet({
      userId: form.userId,
      amount,
      operatorId: user.id,
      idempotencyKey,
      reason: "admin_recharge",
    });
    wallet.balance = Number(result.balance || wallet.balance);
    wallet.updatedAt = new Date().toISOString();
    redirect(res, redirectTo);
    return true;
  }

  async function handleToggleUser({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/toggle-user") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const redirectTo = String(form.redirectTo || "/portal/admin").trim();
    const target = db.users.find((item) => item.id === form.userId);
    if (!target || target.role === "admin") {
      sendHtml(res, layoutV2("操作失败", `<div class="card">目标用户不存在或不可操作。</div>`, user), 400);
      return true;
    }
    target.status = target.status === "disabled" ? "active" : "disabled";
    await logPortalEvent({ type: "user_status_changed", userId: target.id, operatorId: user.id, status: target.status });
    await writeDb(db);
    redirect(res, redirectTo);
    return true;
  }

  async function handleSoftDeleteUser({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/delete-user") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const redirectTo = String(form.redirectTo || "/admin/users").trim();
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    if (!target) {
      sendHtml(res, layoutV2("删除失败", `<div class="card">未找到目标用户。</div>`, user), 404);
      return true;
    }
    target.status = "deleted";
    target.deletedAt = new Date().toISOString();
    db.sessions = db.sessions.filter((session) => session.userId !== target.id);
    for (const session of db.workspaceSessions.filter((entry) => entry.userId === target.id)) {
      session.status = "deleted";
      session.lastUsedAt = new Date().toISOString();
    }
    await logPortalEvent({ type: "user_deleted", userId: target.id, operatorId: user.id });
    await writeDb(db);
    redirect(res, redirectTo);
    return true;
  }

  return async function handlePortalAdminUserRoutes(context) {
    if (await handleCreateUser(context)) return true;
    if (await handleUpdateUser(context)) return true;
    if (await handleRecharge(context)) return true;
    if (await handleToggleUser(context)) return true;
    if (await handleSoftDeleteUser(context)) return true;
    return false;
  };
}
