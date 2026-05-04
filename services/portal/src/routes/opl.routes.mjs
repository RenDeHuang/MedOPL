function providerKeyCandidate(body = {}) {
  if (body.providerKeyPayload && typeof body.providerKeyPayload === "object") {
    return body.providerKeyPayload;
  }
  if (body.providerKey && typeof body.providerKey === "object") {
    return body.providerKey;
  }
  return null;
}

function normalizeProviderKeyPayload(body = {}) {
  const raw = providerKeyCandidate(body);
  if (!raw) return null;
  const provider = String(raw.provider || "").trim();
  const source = String(raw.source || "").trim();
  const apiKey = String(raw.apiKey || "").trim();
  if (!provider || !source || !apiKey) return null;
  return { provider, source, apiKey };
}

function launchSourceSurface(providerKeyPayload) {
  return providerKeyPayload ? "opl-web-native-message-reply" : "portal-control-plane";
}

function launchErrorStatus(result) {
  return result.error === "workspace_launch_blocked" ? 409 : result.status || 500;
}

function launchErrorPayload(result) {
  return {
    ok: false,
    error: result.error,
    message: result.message || "",
    reasons: result.reasons || [],
  };
}

function launchSuccessPayload(result) {
  return {
    ok: true,
    launchId: result.launch.launchId || "",
    launchToken: result.launch.launchToken || "",
    oplWebUrl: result.launch.oplWebUrl || "",
    runtimeUrl: result.launch.runtimeUrl || "",
    workspace: result.taskSpace,
    workspaceSession: result.workspaceSession,
    runtimeSession: {
      runtimeSessionId: result.launch.runtimeSessionId || "",
      oplSessionId: result.launch.oplSessionId || "",
    },
    launch: result.launch,
  };
}

async function readJsonBody(req, readBody) {
  const bodyText = (await readBody(req)).toString("utf8");
  return bodyText ? JSON.parse(bodyText) : {};
}

async function handleOplLaunchApi(context, deps) {
  const { req, res, url, db, user } = context;
  if (req.method !== "POST" || url.pathname !== "/portal/api/opl/launch") return false;

  const body = await readJsonBody(req, deps.readBody);
  const taskSlug = deps.slugify(body.task || body.workspaceId || user.currentTaskSlug || "default");
  const providerKeyPayload = normalizeProviderKeyPayload(body);
  const result = await deps.oplLaunchService.prepareLaunch({
    db,
    user,
    taskSlug,
    requireRealOplWeb: true,
    source: "portal-api",
    sourceSurface: launchSourceSurface(providerKeyPayload),
    providerKeyPayload,
  });

  if (!result.ok) {
    deps.sendJson(res, launchErrorPayload(result), launchErrorStatus(result));
    return true;
  }

  deps.sendJson(res, launchSuccessPayload(result));
  return true;
}

async function handleOplLaunchStatusApi(context, deps) {
  const { req, res, url, user } = context;
  const match = url.pathname.match(/^\/portal\/api\/opl\/launch-status\/(?<launchId>[^/]+)$/);
  if (req.method !== "GET" || !match?.groups?.launchId) return false;
  const status = deps.oplLaunchService.getLaunchStatus(decodeURIComponent(match.groups.launchId));
  if (!status || status.userId !== user.id) {
    deps.sendJson(res, { ok: false, error: "opl_launch_status_not_found" }, 404);
    return true;
  }
  if (status.workspaceSession?.id) {
    deps.appendCookie(res, `${deps.workspaceSessionCookie()}=${status.workspaceSession.id}; Path=/; HttpOnly; SameSite=Lax`);
  }
  deps.sendJson(res, status);
  return true;
}

function workspaceBlockedHtml(result) {
  const reasonList = (result.reasons || []).map((item) => `<li>${item}</li>`).join("");
  return `<div class="card"><h2>当前账号暂时不能启动 OPL</h2><ul class="list">${reasonList}</ul></div>`;
}

function workspaceInactiveHtml(result) {
  return `<div class="card"><h2>当前任务空间不可启动 OPL</h2><p class="hint">只有 active 状态的任务空间才能启动 OPL。</p><p><a href="/portal/workspace?task=${result.taskSpace.slug}">返回任务空间</a></p></div>`;
}

function oplUnavailableHtml(result) {
  return `<div class="card"><h2>OPL Web 暂时不可用</h2><p class="hint">${result.message || result.error}</p></div>`;
}

function sendOplLaunchErrorPage(res, result, user, deps) {
  if (result.error === "workspace_launch_blocked") {
    deps.sendHtml(res, deps.layoutV2("策略限制", workspaceBlockedHtml(result), user), result.status || 403);
    return;
  }
  if (result.error === "workspace_not_active") {
    deps.sendHtml(res, deps.layoutV2("任务空间不可启动", workspaceInactiveHtml(result), user), 409);
    return;
  }
  deps.sendHtml(res, deps.layoutV2("OPL Web 不可用", oplUnavailableHtml(result), user), result.status || 502);
}

async function recordBackgroundLaunchFailure({ error, intent, taskSlug, user, deps }) {
  try {
    await deps.logPortalEvent({
      type: "opl_launch_prepare_background_failed",
      userId: user.id,
      workspaceId: taskSlug,
      launchId: intent.launchId,
      source: "portal-page",
      error: String(error.message || error),
    });
  } catch (eventError) {
    console.error("opl launch background failure event failed", eventError);
  }
}

async function handleOplPage(context, deps) {
  const { req, res, url, db, user } = context;
  if (req.method !== "GET" || url.pathname !== "/portal/opl") return false;

  const requestedTask = String(url.searchParams.get("task") || user.currentTaskSlug || "default").trim();
  const taskSlug = deps.slugify(requestedTask);
  const intent = deps.oplLaunchService.createLaunchIntent({ user, taskSlug, source: "portal-page" });
  deps.oplLaunchService.prepareLaunchIntent({
    launchId: intent.launchId,
    db,
    user,
    taskSlug,
    requireRealOplWeb: true,
    source: "portal-page",
  }).then((result) => {
    if (result?.ok && result.workspaceSession?.id) {
      intent.workspaceSessionId = result.workspaceSession.id;
    }
  }).catch((error) => recordBackgroundLaunchFailure({ error, intent, taskSlug, user, deps }));

  res.writeHead(302, { Location: `/portal/app/opl-launch?launchId=${encodeURIComponent(intent.launchId)}` });
  res.end();
  return true;
}

function redirectWorkspaceOpl(req, res, url) {
  const appWorkspaceOplMatch = url.pathname.match(/^\/portal\/app\/workspaces\/([^/]+)\/opl$/);
  if (req.method !== "GET" || !appWorkspaceOplMatch) return false;
  res.writeHead(302, { Location: `/portal/opl?task=${encodeURIComponent(appWorkspaceOplMatch[1])}` });
  res.end();
  return true;
}

export function createOplRoutes({
  appendCookie,
  layoutV2,
  logPortalEvent,
  oplLaunchService,
  readBody,
  sendHtml,
  sendJson,
  slugify,
  workspaceSessionCookie,
}) {
  const deps = {
    appendCookie,
    layoutV2,
    logPortalEvent,
    oplLaunchService,
    readBody,
    sendHtml,
    sendJson,
    slugify,
    workspaceSessionCookie,
  };

  return async function handleOplRoutes(context) {
    const { req, res, url } = context;
    if (redirectWorkspaceOpl(req, res, url)) return true;
    if (await handleOplLaunchStatusApi(context, deps)) return true;
    if (await handleOplLaunchApi(context, deps)) return true;
    if (await handleOplPage(context, deps)) return true;
    return false;
  };
}
