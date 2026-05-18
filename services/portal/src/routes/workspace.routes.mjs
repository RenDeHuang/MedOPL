function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function explicitWorkspaceSlug(slugify, values = []) {
  const raw = values
    .map((value) => String(value || "").trim())
    .find(Boolean);
  const taskSlug = raw ? slugify(raw) : "";
  return taskSlug ? { ok: true, taskSlug } : { ok: false };
}

function workspaceRequiredHtml() {
  return `<div class="card">必须指定目标工作空间。</div>`;
}

export function createPortalWorkspaceRoutes({
  archiveTaskSpace,
  createZipFromDir,
  defaultTaskTitle,
  ensureTaskSpace,
  evaluateUserPolicy,
  exists,
  findTaskSpace,
  handleUpload,
  hasActiveRuns,
  hasActiveWorkspaceSession,
  layoutV2,
  logPortalEvent,
  markTaskSpaceDeleted,
  mkdir,
  nextTaskSlug,
  parseCookies,
  parseForm,
  path,
  readBody,
  readWorkspaceSession,
  restoreTaskSpace,
  runtimeRoot,
  safeRelativePath,
  sendFile,
  sendHtml,
  sendJson,
  slugify,
  workspaceSessionCookie,
  writeDb,
}) {
  async function readForm(req) {
    return parseForm((await readBody(req)).toString("utf8"));
  }

  async function handleCurrentWorkspaceSession({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/workspace-session/current") return false;
    const cookies = parseCookies(req.headers.cookie);
    const session = readWorkspaceSession(db, cookies[workspaceSessionCookie()], user.id);
    sendJson(res, { ok: Boolean(session), workspaceSession: session });
    return true;
  }

  async function handleWorkspaceSwitch({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/workspaces/switch") return false;
    const taskResolution = explicitWorkspaceSlug(slugify, [url.searchParams.get("task")]);
    if (!taskResolution.ok) {
      sendHtml(res, layoutV2("需要选择工作空间", workspaceRequiredHtml(), user), 422);
      return true;
    }
    const { taskSlug } = taskResolution;
    const taskSpace = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    if (taskSpace.status === "active") user.currentTaskSlug = taskSpace.slug;
    await writeDb(db);
    redirect(res, `/portal/workspace?task=${taskSlug}`);
    return true;
  }

  async function handleWorkspaceCreate({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/workspaces/create") return false;
    const form = await readForm(req);
    const policy = await evaluateUserPolicy(db, user);
    if (!policy.allowWorkspaceCreate) {
      await logPortalEvent({ type: "policy_blocked_workspace_create", userId: user.id, groupId: policy.group?.id || "", reasons: ["当前分组不允许创建工作空间"] });
      sendHtml(res, layoutV2("策略限制", `<div class="card"><h2>当前分组不允许创建新工作空间</h2><p class="hint">请联系管理员调整分组策略。</p></div>`, user), 403);
      return true;
    }
    if (policy.blocked) {
      await logPortalEvent({ type: "policy_blocked_workspace_create", userId: user.id, groupId: policy.group?.id || "", reasons: policy.blocks });
      sendHtml(res, layoutV2("策略限制", `<div class="card"><h2>当前账号暂时不能创建工作空间</h2><ul class="list">${policy.blocks.map((item) => `<li>${item}</li>`).join("")}</ul></div>`, user), 403);
      return true;
    }
    const title = String(form.title || "").trim() || "New Task";
    const slug = nextTaskSlug(db, user.id, title);
    await ensureTaskSpace(db, user, slug, title);
    await writeDb(db);
    redirect(res, `/portal/workspace?task=${slug}`);
    return true;
  }

  async function handleWorkspaceArchive({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/workspaces/archive") return false;
    const form = await readForm(req);
    const taskResolution = explicitWorkspaceSlug(slugify, [form.task, user.currentTaskSlug]);
    if (!taskResolution.ok) {
      sendHtml(res, layoutV2("需要选择工作空间", workspaceRequiredHtml(), user), 422);
      return true;
    }
    const { taskSlug } = taskResolution;
    const taskSpace = findTaskSpace(db, user.id, taskSlug);
    if (!taskSpace) {
      sendHtml(res, layoutV2("工作空间不存在", `<div class="card">未找到目标工作空间。</div>`, user), 404);
      return true;
    }
    if (taskSpace.status !== "active") {
      sendHtml(res, layoutV2("无法归档", `<div class="card">只有 active 状态的工作空间可以归档。</div>`, user), 409);
      return true;
    }
    await archiveTaskSpace(db, user, taskSpace);
    await writeDb(db);
    redirect(res, `/portal/workspace?task=${taskSpace.slug}`);
    return true;
  }

  async function handleWorkspaceRestore({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/workspaces/restore") return false;
    const form = await readForm(req);
    const taskResolution = explicitWorkspaceSlug(slugify, [form.task]);
    if (!taskResolution.ok) {
      sendHtml(res, layoutV2("需要选择工作空间", workspaceRequiredHtml(), user), 422);
      return true;
    }
    const { taskSlug } = taskResolution;
    const taskSpace = findTaskSpace(db, user.id, taskSlug);
    if (!taskSpace) {
      sendHtml(res, layoutV2("工作空间不存在", `<div class="card">未找到目标工作空间。</div>`, user), 404);
      return true;
    }
    if (taskSpace.status !== "archived") {
      sendHtml(res, layoutV2("无法恢复", `<div class="card">只有 archived 状态的工作空间可以恢复。</div>`, user), 409);
      return true;
    }
    await restoreTaskSpace(db, user, taskSpace);
    await writeDb(db);
    redirect(res, `/portal/workspace?task=${taskSpace.slug}`);
    return true;
  }

  async function handleWorkspaceDelete({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/workspaces/delete") return false;
    const form = await readForm(req);
    const taskResolution = explicitWorkspaceSlug(slugify, [form.task]);
    if (!taskResolution.ok) {
      sendHtml(res, layoutV2("需要选择工作空间", workspaceRequiredHtml(), user), 422);
      return true;
    }
    const { taskSlug } = taskResolution;
    const taskSpace = findTaskSpace(db, user.id, taskSlug);
    if (!taskSpace) {
      sendHtml(res, layoutV2("工作空间不存在", `<div class="card">未找到目标工作空间。</div>`, user), 404);
      return true;
    }
    if (await hasActiveRuns(user.id, taskSpace.slug)) {
      sendHtml(res, layoutV2("无法删除", `<div class="card">当前工作空间仍有运行中的任务，暂时不能删除。</div>`, user), 409);
      return true;
    }
    if (hasActiveWorkspaceSession(db, user.id, taskSpace.slug)) {
      sendHtml(res, layoutV2("无法删除", `<div class="card">当前工作空间仍绑定活跃 MAS 会话，请等待会话过期后再删除。</div>`, user), 409);
      return true;
    }
    await markTaskSpaceDeleted(db, user, taskSpace);
    await writeDb(db);
    redirect(res, "/portal/workspace");
    return true;
  }

  async function handleDownloadFile({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/workspace/download-file") return false;
    const taskResolution = explicitWorkspaceSlug(slugify, [url.searchParams.get("task"), user.currentTaskSlug]);
    if (!taskResolution.ok) {
      sendHtml(res, layoutV2("需要选择工作空间", workspaceRequiredHtml(), user), 422);
      return true;
    }
    const { taskSlug } = taskResolution;
    const kind = url.searchParams.get("kind") === "outputs" ? "outputs" : "inputs";
    const file = safeRelativePath(url.searchParams.get("file") || "");
    const taskSpace = findTaskSpace(db, user.id, taskSlug);
    if (!taskSpace) {
      sendHtml(res, layoutV2("工作空间不存在", `<div class="card">未找到目标工作空间。</div>`, user), 404);
      return true;
    }
    const fullPath = path.join(taskSpace.path, kind, file);
    if (!(await exists(fullPath))) {
      sendHtml(res, layoutV2("文件不存在", `<div class="card">未找到要下载的文件。</div>`, user), 404);
      return true;
    }
    sendFile(res, fullPath, file);
    return true;
  }

  async function handleDownloadAll({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/workspace/download-all") return false;
    const taskResolution = explicitWorkspaceSlug(slugify, [url.searchParams.get("task"), user.currentTaskSlug]);
    if (!taskResolution.ok) {
      sendHtml(res, layoutV2("需要选择工作空间", workspaceRequiredHtml(), user), 422);
      return true;
    }
    const { taskSlug } = taskResolution;
    const kind = url.searchParams.get("kind") === "outputs" ? "outputs" : "inputs";
    const taskSpace = findTaskSpace(db, user.id, taskSlug);
    if (!taskSpace) {
      sendHtml(res, layoutV2("工作空间不存在", `<div class="card">未找到目标工作空间。</div>`, user), 404);
      return true;
    }
    const sourceDir = path.join(taskSpace.path, kind);
    await mkdir(sourceDir, { recursive: true });
    const zipPath = path.join(runtimeRoot, `${user.id}-${taskSlug}-${kind}.zip`);
    await createZipFromDir(sourceDir, zipPath);
    sendFile(res, zipPath, `${taskSlug}-${kind}.zip`, "application/zip");
    return true;
  }

  async function handleWorkspaceUpload({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/workspace/upload") return false;
    await handleUpload(req, res, user, db);
    return true;
  }

  return async function handlePortalWorkspaceRoutes(context) {
    if (await handleCurrentWorkspaceSession(context)) return true;
    if (await handleWorkspaceSwitch(context)) return true;
    if (await handleWorkspaceCreate(context)) return true;
    if (await handleWorkspaceArchive(context)) return true;
    if (await handleWorkspaceRestore(context)) return true;
    if (await handleWorkspaceDelete(context)) return true;
    if (await handleDownloadFile(context)) return true;
    if (await handleDownloadAll(context)) return true;
    if (await handleWorkspaceUpload(context)) return true;
    return false;
  };
}
