export function createOplRoutes({
  appendCookie,
  layoutV2,
  oplLaunchService,
  readBody,
  sendHtml,
  sendJson,
  slugify,
  workspaceSessionCookie,
}) {
  async function handleOplLaunchApi({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/opl/launch") return false;

    const bodyText = (await readBody(req)).toString("utf8");
    const body = bodyText ? JSON.parse(bodyText) : {};
    const taskSlug = slugify(body.task || body.workspaceId || user.currentTaskSlug || "default");
    const result = await oplLaunchService.prepareLaunch({
      db,
      user,
      taskSlug,
      requireRealOplWeb: true,
      source: "portal-api",
    });

    if (!result.ok) {
      sendJson(res, {
        ok: false,
        error: result.error,
        message: result.message || "",
        reasons: result.reasons || [],
      }, result.error === "workspace_launch_blocked" ? 409 : result.status || 500);
      return true;
    }

    sendJson(res, {
      ok: true,
      launchId: result.launch.launchId || "",
      launchToken: result.launch.launchToken || "",
      oplWebUrl: result.launch.oplWebUrl || "",
      workspace: result.taskSpace,
      workspaceSession: result.workspaceSession,
      runtimeSession: {
        runtimeSessionId: result.launch.runtimeSessionId || "",
        oplSessionId: result.launch.oplSessionId || "",
      },
      launch: result.launch,
    });
    return true;
  }

  async function handleOplPage({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/opl") return false;

    const requestedTask = String(url.searchParams.get("task") || user.currentTaskSlug || "default").trim();
    const taskSlug = slugify(requestedTask);
    const result = await oplLaunchService.prepareLaunch({
      db,
      user,
      taskSlug,
      requireRealOplWeb: true,
      source: "portal-page",
    });

    if (!result.ok) {
      if (result.error === "workspace_launch_blocked") {
        const reasonList = (result.reasons || []).map((item) => `<li>${item}</li>`).join("");
        sendHtml(res, layoutV2("策略限制", `<div class="card"><h2>当前账号暂时不能启动 OPL</h2><ul class="list">${reasonList}</ul></div>`, user), result.status || 403);
        return true;
      }
      if (result.error === "workspace_not_active") {
        sendHtml(res, layoutV2("任务空间不可启动", `<div class="card"><h2>当前任务空间不可启动 OPL</h2><p class="hint">只有 active 状态的任务空间才能启动 OPL。</p><p><a href="/portal/workspace?task=${result.taskSpace.slug}">返回任务空间</a></p></div>`, user), 409);
        return true;
      }
      sendHtml(res, layoutV2("OPL Web 不可用", `<div class="card"><h2>OPL Web 暂时不可用</h2><p class="hint">${result.message || result.error}</p></div>`, user), result.status || 502);
      return true;
    }

    appendCookie(res, `${workspaceSessionCookie()}=${result.workspaceSession.id}; Path=/; HttpOnly; SameSite=Lax`);
    res.writeHead(302, { Location: result.launch.oplWebUrl });
    res.end();
    return true;
  }

  return async function handleOplRoutes(context) {
    const { req, res, url } = context;
    const appWorkspaceOplMatch = url.pathname.match(/^\/portal\/app\/workspaces\/([^/]+)\/opl$/);
    if (req.method === "GET" && appWorkspaceOplMatch) {
      res.writeHead(302, { Location: `/portal/opl?task=${encodeURIComponent(appWorkspaceOplMatch[1])}` });
      res.end();
      return true;
    }
    if (await handleOplLaunchApi(context)) return true;
    if (await handleOplPage(context)) return true;
    return false;
  };
}
