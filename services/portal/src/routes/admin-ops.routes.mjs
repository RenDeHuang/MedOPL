import { randomUUID } from "node:crypto";

import { hashPassword as defaultHashPassword } from "../domain/portal-auth.mjs";
import { normalizeAnnouncementRecord } from "../domain/portal-presenters.mjs";

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

export function createPortalAdminOpsRoutes({
  hashPassword = defaultHashPassword,
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

  async function handleSettings({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/settings") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const redirectTo = String(form.redirectTo || "/portal/admin/users").trim();
    db.settings.allowRegistration = form.allowRegistration === "1";
    await logPortalEvent({ type: "portal_settings_updated", userId: user.id, allowRegistration: db.settings.allowRegistration });
    await writeDb(db);
    redirect(res, redirectTo);
    return true;
  }

  async function handleAnnouncementSave({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/announcements/save") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const redirectTo = String(form.redirectTo || "/portal/app/admin/alerts").trim();
    const title = String(form.title || "").trim();
    const content = String(form.content || "").trim();
    if (!title || !content) {
      sendHtml(res, layoutV2("公告保存失败", `<div class="card">标题和内容不能为空。</div>`, user), 400);
      return true;
    }
    db.settings.announcements = Array.isArray(db.settings.announcements) ? db.settings.announcements : [];
    const announcementId = String(form.id || "").trim();
    const rows = db.settings.announcements.map(normalizeAnnouncementRecord).filter(Boolean);
    const nextRecord = normalizeAnnouncementRecord({
      id: announcementId || randomUUID(),
      title,
      content,
      scope: form.scope || "all",
      status: form.status || "active",
      pinned: form.pinned === "1",
      createdAt: rows.find((item) => item.id === announcementId)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      operatorId: user.id,
    });
    if (!nextRecord) {
      sendHtml(res, layoutV2("公告保存失败", `<div class="card">公告格式无效。</div>`, user), 400);
      return true;
    }
    const nextRows = rows.filter((item) => item.id !== nextRecord.id);
    if (nextRecord.pinned) {
      for (const row of nextRows) row.pinned = false;
    }
    nextRows.push(nextRecord);
    db.settings.announcements = nextRows.map(normalizeAnnouncementRecord).filter(Boolean);
    await logPortalEvent({ type: "announcement_saved", userId: user.id, announcementId: nextRecord.id, title: nextRecord.title });
    await writeDb(db);
    redirect(res, redirectTo);
    return true;
  }

  async function handleAnnouncementToggle({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/announcements/toggle") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const redirectTo = String(form.redirectTo || "/portal/app/admin/alerts").trim();
    const announcementId = String(form.id || "").trim();
    const action = String(form.actionType || "").trim();
    const rows = Array.isArray(db.settings.announcements) ? db.settings.announcements.map(normalizeAnnouncementRecord).filter(Boolean) : [];
    const target = rows.find((item) => item.id === announcementId);
    if (!target) {
      sendHtml(res, layoutV2("公告操作失败", `<div class="card">未找到目标公告。</div>`, user), 404);
      return true;
    }
    if (action === "pin") {
      for (const row of rows) row.pinned = row.id === target.id;
    } else if (action === "activate") {
      target.status = "active";
    } else if (action === "deactivate") {
      target.status = "inactive";
    } else {
      sendHtml(res, layoutV2("公告操作失败", `<div class="card">不支持的公告动作。</div>`, user), 400);
      return true;
    }
    target.updatedAt = new Date().toISOString();
    target.operatorId = user.id;
    db.settings.announcements = rows.map(normalizeAnnouncementRecord).filter(Boolean);
    await logPortalEvent({ type: "announcement_toggled", userId: user.id, announcementId: target.id, action });
    await writeDb(db);
    redirect(res, redirectTo);
    return true;
  }

  async function handleAnnouncementDelete({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/announcements/delete") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const redirectTo = String(form.redirectTo || "/portal/app/admin/alerts").trim();
    const announcementId = String(form.id || "").trim();
    const rows = Array.isArray(db.settings.announcements) ? db.settings.announcements.map(normalizeAnnouncementRecord).filter(Boolean) : [];
    db.settings.announcements = rows.filter((item) => item.id !== announcementId);
    await logPortalEvent({ type: "announcement_deleted", userId: user.id, announcementId });
    await writeDb(db);
    redirect(res, redirectTo);
    return true;
  }

  async function handleGroupCreate({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/groups/create") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const redirectTo = String(form.redirectTo || "/portal/admin/groups").trim();
    const name = String(form.name || "").trim();
    if (!name) {
      sendHtml(res, layoutV2("创建失败", `<div class="card">分组名称不能为空。</div>`, user), 400);
      return true;
    }
    if (db.groups.some((group) => String(group.name || "").toLowerCase() === name.toLowerCase())) {
      sendHtml(res, layoutV2("创建失败", `<div class="card">分组名称已存在。</div>`, user), 400);
      return true;
    }
    db.groups.push({
      id: randomUUID(),
      name,
      plan: String(form.plan || "").trim(),
      status: String(form.status || "active").trim(),
      balanceFloor: Number(form.balanceFloor || 0),
      maxWorkspaces: Number(form.maxWorkspaces || 0),
      maxConcurrentRuns: Number(form.maxConcurrentRuns || 0),
      cpuRequest: String(form.cpuRequest || "").trim(),
      cpuLimit: String(form.cpuLimit || "").trim(),
      memoryRequest: String(form.memoryRequest || "").trim(),
      memoryLimit: String(form.memoryLimit || "").trim(),
      gpuCount: Number(form.gpuCount || 0),
      storageRequest: String(form.storageRequest || "").trim(),
      storageLimit: String(form.storageLimit || "").trim(),
      allowMas: form.allowMas === "1",
      allowWorkspaceCreate: form.allowWorkspaceCreate === "1",
      createdAt: new Date().toISOString(),
    });
    await logPortalEvent({ type: "group_created", userId: user.id, groupName: name });
    await writeDb(db);
    redirect(res, redirectTo);
    return true;
  }

  async function handleGroupAssign({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/groups/assign") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const redirectTo = String(form.redirectTo || "/portal/admin/groups").trim();
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const group = db.groups.find((item) => item.id === form.groupId);
    if (!target || !group) {
      sendHtml(res, layoutV2("分配失败", `<div class="card">用户或分组不存在。</div>`, user), 400);
      return true;
    }
    target.groupId = group.id;
    await logPortalEvent({ type: "group_assigned", userId: target.id, operatorId: user.id, groupId: group.id });
    await writeDb(db);
    redirect(res, redirectTo);
    return true;
  }

  async function handleUserProfile({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/user-profile") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const nextEmail = String(form.email || "").trim().toLowerCase();
    const nextName = String(form.name || "").trim();
    if (!target || !nextEmail || !nextName) {
      sendHtml(res, layoutV2("保存失败", `<div class="card">参数不完整。</div>`, user), 400);
      return true;
    }
    if (db.users.some((item) => item.id !== target.id && String(item.email || "").toLowerCase() === nextEmail)) {
      sendHtml(res, layoutV2("保存失败", `<div class="card">邮箱已存在。</div>`, user), 400);
      return true;
    }
    try {
      await runZitadelAdminUser([
        "update-profile",
        target.email,
        nextEmail,
        nextName,
      ]);
    } catch (error) {
      const detail = zitadelErrorDetail(error);
      sendHtml(res, layoutV2("同步失败", `<div class="card">ZITADEL 用户资料同步失败。<br/><code>${detail.slice(0, 400)}</code></div>`, user), 502);
      return true;
    }
    target.name = nextName;
    target.email = nextEmail;
    await logPortalEvent({ type: "user_profile_updated", userId: target.id, operatorId: user.id, email: nextEmail });
    await writeDb(db);
    redirect(res, `/portal/admin/user?userId=${target.id}`);
    return true;
  }

  async function handleUserPassword({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/user-password") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const password = String(form.password || "").trim();
    if (!target || password.length < 8) {
      sendHtml(res, layoutV2("保存失败", `<div class="card">密码至少 8 位。</div>`, user), 400);
      return true;
    }
    try {
      await runZitadelAdminUser([
        "reset-password",
        target.email,
        password,
      ]);
    } catch (error) {
      const detail = zitadelErrorDetail(error);
      sendHtml(res, layoutV2("同步失败", `<div class="card">ZITADEL 密码重置失败。<br/><code>${detail.slice(0, 400)}</code></div>`, user), 502);
      return true;
    }
    target.passwordHash = hashPassword(password);
    await logPortalEvent({ type: "user_password_reset", userId: target.id, operatorId: user.id });
    await writeDb(db);
    redirect(res, `/portal/admin/user?userId=${target.id}`);
    return true;
  }

  async function handleUserDelete({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/admin/user-delete") return false;
    if (adminForbidden({ res, user, sendHtml, layoutV2 })) return true;
    const form = await readForm(req);
    const target = db.users.find((item) => item.id === form.userId && item.role !== "admin");
    const confirmEmail = String(form.confirmEmail || "").trim().toLowerCase();
    if (!target || confirmEmail !== String(target.email || "").toLowerCase()) {
      sendHtml(res, layoutV2("删除失败", `<div class="card">确认邮箱不匹配。</div>`, user), 400);
      return true;
    }
    try {
      await runZitadelAdminUser([
        "delete",
        target.email,
      ]);
    } catch (error) {
      const detail = zitadelErrorDetail(error);
      sendHtml(res, layoutV2("同步失败", `<div class="card">ZITADEL 删除用户失败。<br/><code>${detail.slice(0, 400)}</code></div>`, user), 502);
      return true;
    }
    db.users = db.users.filter((item) => item.id !== target.id);
    db.sessions = db.sessions.filter((item) => item.userId !== target.id);
    db.wallets = db.wallets.filter((item) => item.userId !== target.id);
    db.workspaceSessions = db.workspaceSessions.filter((item) => item.userId !== target.id);
    db.userSandboxes = db.userSandboxes.filter((item) => item.userId !== target.id);
    db.taskSpaces = db.taskSpaces.filter((item) => item.userId !== target.id);
    await logPortalEvent({ type: "user_deleted", userId: target.id, operatorId: user.id, email: target.email });
    await writeDb(db);
    redirect(res, "/portal/admin");
    return true;
  }

  return async function handlePortalAdminOpsRoutes(context) {
    if (await handleSettings(context)) return true;
    if (await handleAnnouncementSave(context)) return true;
    if (await handleAnnouncementToggle(context)) return true;
    if (await handleAnnouncementDelete(context)) return true;
    if (await handleGroupCreate(context)) return true;
    if (await handleGroupAssign(context)) return true;
    if (await handleUserProfile(context)) return true;
    if (await handleUserPassword(context)) return true;
    if (await handleUserDelete(context)) return true;
    return false;
  };
}
