import { createPortalWorkflowFacade } from "../services/portal-workflow-facade.service.mjs";

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

function explicitTaskSlug(deps, values = []) {
  const raw = values
    .map((value) => String(value || "").trim())
    .find(Boolean);
  const taskSlug = raw ? deps.slugify(raw) : "";
  return taskSlug ? { ok: true, taskSlug } : { ok: false, error: "workspace_id_required" };
}

function sendWorkspaceRequiredJson(res, deps) {
  deps.sendJson(res, {
    ok: false,
    error: "workspace_id_required",
    message: "必须指定要进入的工作空间。",
  }, 422);
}

function publicLaunchPayload(launch = {}) {
  return {
    workspaceId: launch.workspaceId || "",
    workspaceSessionId: launch.workspaceSessionId || "",
    runtimeSessionId: launch.runtimeSessionId || "",
    oplSessionId: launch.oplSessionId || "",
    providerKeyRef: launch.providerKeyRef || launch.providerConfigSecretRef || "",
    runtimeUrl: launch.runtimeUrl || "",
    oplWebUrl: launch.oplWebUrl || "",
  };
}

function launchSuccessPayload(result) {
  const launch = publicLaunchPayload(result.launch || {});
  const publicLaunchId = result.launchId || "";
  return {
    ok: true,
    launchId: publicLaunchId,
    openUrl: launch.oplWebUrl || "",
    oplWebUrl: launch.oplWebUrl || "",
    runtimeUrl: launch.runtimeUrl || "",
    launchStatus: "ready",
    workspaceId: result.taskSpace?.slug || launch.workspaceId || "",
    providerBound: Boolean(launch.providerKeyRef || launch.providerConfigSecretRef),
    providerKeyRef: launch.providerKeyRef || launch.providerConfigSecretRef || "",
    workspace: result.taskSpace,
    workspaceSession: result.workspaceSession,
    runtimeSession: {
      runtimeSessionId: launch.runtimeSessionId || "",
      oplSessionId: launch.oplSessionId || "",
    },
    launch,
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
  const taskResolution = explicitTaskSlug(deps, [body.task, body.workspaceId, user.currentTaskSlug]);
  if (!taskResolution.ok) {
    sendWorkspaceRequiredJson(res, deps);
    return true;
  }
  const { taskSlug } = taskResolution;
  const providerKeyPayload = normalizeProviderKeyPayload(body);
  const result = await deps.workflowFacade.runOplLaunchCommand({
    payload: {
      source: "portal-api",
      taskSlug,
      userId: user.id,
      sourceSurface: launchSourceSurface(providerKeyPayload),
    },
    execute: () => deps.oplLaunchService.prepareLaunchForIntent({
      db,
      user,
      taskSlug,
      requireRealOplWeb: true,
      source: "portal-api",
      sourceSurface: launchSourceSurface(providerKeyPayload),
      providerKeyPayload,
    }),
  });

  if (!result.ok) {
    deps.sendJson(res, launchErrorPayload(result), launchErrorStatus(result));
    return true;
  }

  if (result.launch?.launchToken) {
    deps.appendCookie(res, `opl_portal_launch=${encodeURIComponent(result.launch.launchToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`);
  }
  deps.sendJson(res, launchSuccessPayload(result));
  return true;
}

function publicLaunchStatus(status = {}) {
  const launch = publicLaunchPayload(status.launch || {});
  return {
    ...status,
    openUrl: status.oplWebUrl || launch.oplWebUrl || "",
    launch,
  };
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
  if (status.launch?.launchToken) {
    deps.appendCookie(res, `opl_portal_launch=${encodeURIComponent(status.launch.launchToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`);
  }
  deps.sendJson(res, publicLaunchStatus(status));
  return true;
}

function launchTokenForRequest(url, deps, user) {
  const launchId = String(url.searchParams.get("launchId") || url.searchParams.get("launch_id") || "").trim();
  if (!launchId) return { ok: false, status: 422, error: "launch_id_required" };
  const status = deps.oplLaunchService.getLaunchStatus(launchId);
  if (!status?.launch?.launchToken || status.userId !== user.id) return { ok: false, status: 404, error: "opl_launch_status_not_found" };
  return { ok: true, launchToken: status.launch.launchToken, status };
}

async function proxyRuntimeBridgeApi(context, deps, {
  sourcePath,
  targetPath,
  method,
  body = null,
  successStatus = 200,
}) {
  const resolved = launchTokenForRequest(context.url, deps, context.user);
  if (!resolved.ok) {
    deps.sendJson(context.res, { ok: false, error: resolved.error }, resolved.status);
    return true;
  }
  try {
    const payload = await deps.runtimeBridgeClient.requestRuntimeBridgeApi({
      path: targetPath,
      method,
      launchToken: resolved.launchToken,
      body,
    });
    deps.sendJson(context.res, payload, successStatus);
  } catch (error) {
    deps.sendJson(context.res, error.payload || { ok: false, error: String(error.message || error) }, error.status || 502);
  }
  return true;
}

async function handlePortalOplBootstrapApi(context, deps) {
  const { req, url } = context;
  if (req.method !== "GET" || url.pathname !== "/portal/api/opl/bootstrap") return false;
  return proxyRuntimeBridgeApi(context, deps, {
    sourcePath: url.pathname,
    targetPath: "/api/opl/bootstrap",
    method: "GET",
  });
}

async function handlePortalOplSessionBindApi(context, deps) {
  const { req, url } = context;
  if (req.method !== "POST" || url.pathname !== "/portal/api/opl/sessions/bind") return false;
  return proxyRuntimeBridgeApi(context, deps, {
    sourcePath: url.pathname,
    targetPath: "/api/opl/sessions/bind",
    method: "POST",
    body: await readJsonBody(req, deps.readBody),
  });
}

async function handlePortalOplMessagesApi(context, deps) {
  const { req, url } = context;
  if (req.method !== "POST" || url.pathname !== "/portal/api/opl/messages") return false;
  return proxyRuntimeBridgeApi(context, deps, {
    sourcePath: url.pathname,
    targetPath: "/api/opl/messages",
    method: "POST",
    body: await readJsonBody(req, deps.readBody),
  });
}

async function handlePortalOplMessageStatusApi(context, deps) {
  const { req, url } = context;
  const match = url.pathname.match(/^\/portal\/api\/opl\/messages\/(?<messageId>[^/]+)\/status$/);
  if (req.method !== "GET" || !match?.groups?.messageId) return false;
  return proxyRuntimeBridgeApi(context, deps, {
    sourcePath: url.pathname,
    targetPath: `/api/opl/messages/${encodeURIComponent(decodeURIComponent(match.groups.messageId))}/status`,
    method: "GET",
  });
}

async function handlePortalOplFilesApi(context, deps) {
  const { req, url } = context;
  if (req.method !== "POST" || url.pathname !== "/portal/api/opl/files") return false;
  return proxyRuntimeBridgeApi(context, deps, {
    sourcePath: url.pathname,
    targetPath: "/api/opl/files",
    method: "POST",
    body: await readJsonBody(req, deps.readBody),
    successStatus: 201,
  });
}

async function handlePortalOplRunsApi(context, deps) {
  const { req, url } = context;
  if (req.method !== "POST" || url.pathname !== "/portal/api/opl/runs") return false;
  return proxyRuntimeBridgeApi(context, deps, {
    sourcePath: url.pathname,
    targetPath: "/api/opl/runs",
    method: "POST",
    body: await readJsonBody(req, deps.readBody),
    successStatus: 201,
  });
}

async function handlePortalOplRunStatusApi(context, deps) {
  const { req, url } = context;
  const match = url.pathname.match(/^\/portal\/api\/opl\/runs\/(?<runId>[^/]+)\/status$/);
  if (req.method !== "GET" || !match?.groups?.runId) return false;
  return proxyRuntimeBridgeApi(context, deps, {
    sourcePath: url.pathname,
    targetPath: `/api/opl/runs/${encodeURIComponent(decodeURIComponent(match.groups.runId))}/status`,
    method: "GET",
  });
}

async function handlePortalOplRunArtifactsApi(context, deps) {
  const { req, url } = context;
  const match = url.pathname.match(/^\/portal\/api\/opl\/runs\/(?<runId>[^/]+)\/artifacts$/);
  if (req.method !== "GET" || !match?.groups?.runId) return false;
  return proxyRuntimeBridgeApi(context, deps, {
    sourcePath: url.pathname,
    targetPath: `/api/opl/runs/${encodeURIComponent(decodeURIComponent(match.groups.runId))}/artifacts`,
    method: "GET",
  });
}

async function handlePortalOplArtifactApi(context, deps) {
  const { req, url } = context;
  const match = url.pathname.match(/^\/portal\/api\/opl\/artifacts\/(?<artifactRef>[^/]+)$/);
  if (req.method !== "GET" || !match?.groups?.artifactRef) return false;
  return proxyRuntimeBridgeApi(context, deps, {
    sourcePath: url.pathname,
    targetPath: `/api/opl/artifacts/${encodeURIComponent(decodeURIComponent(match.groups.artifactRef))}`,
    method: "GET",
  });
}

function workspaceBlockedHtml(result) {
  const reasonList = (result.reasons || []).map((item) => `<li>${item}</li>`).join("");
  return `<div class="card"><h2>当前账号暂时不能启动 OPL</h2><ul class="list">${reasonList}</ul></div>`;
}

function workspaceInactiveHtml(result) {
  return `<div class="card"><h2>当前工作空间不可启动 OPL</h2><p class="hint">只有 active 状态的工作空间才能启动 OPL。</p><p><a href="/portal/workspace?task=${result.taskSpace.slug}">返回工作空间</a></p></div>`;
}

function oplUnavailableHtml(result) {
  return `<div class="card"><h2>OPL Web 暂时不可用</h2><p class="hint">${result.message || result.error}</p></div>`;
}

function workspaceRequiredHtml() {
  return `<div class="card"><h2>需要选择工作空间</h2><p class="hint">请从 Portal 工作空间或资源页选择一个工作空间后再进入 OPL。</p></div>`;
}

function sendOplLaunchErrorPage(res, result, user, deps) {
  if (result.error === "workspace_launch_blocked") {
    deps.sendHtml(res, deps.layoutV2("策略限制", workspaceBlockedHtml(result), user), result.status || 403);
    return;
  }
  if (result.error === "workspace_not_active") {
    deps.sendHtml(res, deps.layoutV2("工作空间不可启动", workspaceInactiveHtml(result), user), 409);
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

  const taskResolution = explicitTaskSlug(deps, [url.searchParams.get("task"), user.currentTaskSlug]);
  if (!taskResolution.ok) {
    deps.sendHtml(res, deps.layoutV2("需要选择工作空间", workspaceRequiredHtml(), user), 422);
    return true;
  }
  const { taskSlug } = taskResolution;
  const intent = deps.oplLaunchService.createLaunchIntent({ user, taskSlug, source: "portal-page" });
  deps.workflowFacade.runOplLaunchCommand({
    commandId: intent.launchId,
    payload: {
      source: "portal-page",
      launchId: intent.launchId,
      taskSlug,
      userId: user.id,
    },
    execute: () => deps.oplLaunchService.prepareLaunchIntent({
      launchId: intent.launchId,
      db,
      user,
      taskSlug,
      requireRealOplWeb: true,
      source: "portal-page",
    }),
  }).then((result) => {
    if (result?.ok && result.workspaceSession?.id) {
      intent.workspaceSessionId = result.workspaceSession.id;
    }
  }).catch((error) => recordBackgroundLaunchFailure({ error, intent, taskSlug, user, deps }));

  res.writeHead(302, { Location: `/opl-launch?launchId=${encodeURIComponent(intent.launchId)}` });
  res.end();
  return true;
}

export function createOplRoutes({
  appendCookie,
  layoutV2,
  logPortalEvent,
  runtimeBridgeClient,
  oplLaunchService,
  workflowFacade = createPortalWorkflowFacade(),
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
    runtimeBridgeClient,
    oplLaunchService,
    workflowFacade,
    readBody,
    sendHtml,
    sendJson,
    slugify,
    workspaceSessionCookie,
  };

  return async function handleOplRoutes(context) {
    if (await handleOplLaunchStatusApi(context, deps)) return true;
    if (await handleOplLaunchApi(context, deps)) return true;
    if (await handlePortalOplBootstrapApi(context, deps)) return true;
    if (await handlePortalOplSessionBindApi(context, deps)) return true;
    if (await handlePortalOplMessagesApi(context, deps)) return true;
    if (await handlePortalOplMessageStatusApi(context, deps)) return true;
    if (await handlePortalOplFilesApi(context, deps)) return true;
    if (await handlePortalOplRunsApi(context, deps)) return true;
    if (await handlePortalOplRunStatusApi(context, deps)) return true;
    if (await handlePortalOplRunArtifactsApi(context, deps)) return true;
    if (await handlePortalOplArtifactApi(context, deps)) return true;
    if (await handleOplPage(context, deps)) return true;
    return false;
  };
}
