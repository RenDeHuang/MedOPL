export function createPortalHttpDispatcher({
  buildBillingDetailsPayload,
  buildBillingPayload,
  buildBillingSummaryPayload,
  buildOverviewPayload,
  buildPortalHealthPayload,
  buildWorkspacePayload,
  currentUser,
  frontendDistRoot,
  guessContentType,
  handleAuthRoutes,
  handleLabPackageRoutes,
  handleOplRoutes,
  handlePortalAdminApiRoutes,
  handlePortalAdminOpsRoutes,
  handlePortalAdminUserRoutes,
  handlePortalApiRoutes,
  handlePortalBillingExportRoutes,
  handlePortalWorkspaceRoutes,
  handleServerPlanRoutes,
  handleWorkspaceStorageRoutes,
  layoutV2,
  logPortalEvent,
  parseForm,
  path,
  readBillingRequestOptions,
  readBody,
  readOverviewRequestOptions,
  sendHtml,
  sendJson,
  sendStaticAsset,
  slugify,
  writeDb,
  renderPortalPublicHome,
  publicSettingsPayload,
}) {
  function isPortalApiRequest(url) {
    return url.pathname === "/portal/api" || url.pathname.startsWith("/portal/api/");
  }

  return async function dispatchPortalHttpRequest(req, res) {
    const url = new URL(req.url || "/", "http://local");
    const isGetAuthPage = req.method === "GET" && (url.pathname === "/login" || url.pathname === "/register");
    const spaShellPaths = new Set([
      "/overview",
      "/packages",
      "/resources",
      "/workspace",
      "/opl-launch",
      "/advanced/servers",
      "/billing",
      "/trace",
      "/__portal-harness/components",
      "/admin/dashboard",
      "/admin/users",
      "/admin/trace",
      "/admin/user",
      "/admin/groups",
      "/admin/workspace",
      "/admin/run",
      "/admin/billing-ops",
      "/admin/alerts",
      "/admin/usage",
      "/admin/system",
      "/admin/ops",
      "/admin/sandboxes",
      "/admin/audit",
    ]);
    const isHarnessComponentShellRequest = req.method === "GET" && url.pathname.startsWith("/__portal-harness/components/");
    const isPortalAppShellRequest = req.method === "GET" && (spaShellPaths.has(url.pathname) || isHarnessComponentShellRequest);
    if (isGetAuthPage) {
      const authHandled = await handleAuthRoutes({ req, res, url, db: null });
      if (authHandled) return;
    }
    if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/status")) {
      sendJson(res, buildPortalHealthPayload());
      return;
    }
    if (req.method === "GET" && url.pathname === "/portal/api/public/settings") {
      const { db } = await currentUser(req, { mode: "auth_light" });
      sendJson(res, publicSettingsPayload(db));
      return;
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/home")) {
      const { db } = await currentUser(req, { mode: "auth_light" });
      sendHtml(res, renderPortalPublicHome(db));
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
      const relative = url.pathname.replace("/assets/", "");
      const filePath = path.join(frontendDistRoot, "assets", relative);
      await sendStaticAsset(res, filePath, guessContentType(filePath));
      return;
    }
    const isPostAuthEntry = req.method === "POST" && (url.pathname === "/login" || url.pathname === "/register");
    const hasPortalSessionCookie = String(req.headers?.cookie || "").includes("portal_session=");
    if (isPortalApiRequest(url) && !hasPortalSessionCookie) {
      sendJson(res, { ok: false, error: "unauthenticated", loginUrl: "/login" }, 401);
      return;
    }
    const currentUserMode = isPostAuthEntry && !hasPortalSessionCookie ? "auth_light" : "full";
    const { db, user } = await currentUser(req, { mode: currentUserMode });
    if (!isGetAuthPage && (await handleAuthRoutes({ req, res, url, db }))) return;
    if (!user) {
      if (isPortalApiRequest(url)) {
        sendJson(res, { ok: false, error: "unauthenticated", loginUrl: "/login" }, 401);
        return;
      }
      res.writeHead(302, { Location: "/login" });
      res.end();
      return;
    }
    if (isPortalAppShellRequest) {
      await sendStaticAsset(res, path.join(frontendDistRoot, "index.html"), "text/html; charset=utf-8");
      return;
    }
    if (await handleOplRoutes({ req, res, url, db, user })) return;
    if (await handleLabPackageRoutes({ req, res, url, db, user })) return;
    if (await handleWorkspaceStorageRoutes({ req, res, url, db, user })) return;
    if (await handlePortalApiRoutes({ req, res, url, db, user })) return;
    if (await handlePortalAdminUserRoutes({ req, res, url, db, user })) return;
    if (req.method === "POST" && url.pathname === "/portal/api/theme") {
      const form = parseForm((await readBody(req)).toString("utf8"));
      const theme = ["dark", "light"].includes(String(form.theme || "").toLowerCase()) ? String(form.theme).toLowerCase() : "light";
      user.preferences = user.preferences || {};
      user.preferences.theme = theme;
      await writeDb(db);
      await logPortalEvent({ type: "theme_changed", userId: user.id, theme });
      sendJson(res, { ok: true, theme });
      return;
    }
    if (req.method === "GET" && url.pathname === "/portal/api/overview") {
      sendJson(res, await buildOverviewPayload(db, user, readOverviewRequestOptions(url)));
      return;
    }
    if (req.method === "GET" && url.pathname === "/portal/api/billing") {
      sendJson(res, await buildBillingPayload(db, user, readBillingRequestOptions(url)));
      return;
    }
    if (req.method === "GET" && url.pathname === "/portal/api/billing/summary") {
      sendJson(res, await buildBillingSummaryPayload(db, user, readBillingRequestOptions(url)));
      return;
    }
    if (req.method === "GET" && url.pathname === "/portal/api/billing/details") {
      sendJson(res, await buildBillingDetailsPayload(db, user, readBillingRequestOptions(url)));
      return;
    }
    if (await handleServerPlanRoutes({ req, res, url, db, user })) return;
    if (req.method === "GET" && url.pathname === "/portal/api/workspace") {
      const requestedTask = String(url.searchParams.get("task") || user.currentTaskSlug || "").trim();
      const taskSlug = requestedTask ? slugify(requestedTask) : "";
      if (!taskSlug) {
        sendJson(res, {
          ok: false,
          error: "workspace_id_required",
          message: "必须指定要查看的工作空间。",
        }, 422);
        return;
      }
      sendJson(res, await buildWorkspacePayload(db, user, taskSlug));
      return;
    }
    if (await handlePortalAdminApiRoutes({ req, res, url, db, user })) return;
    if (await handlePortalBillingExportRoutes({ req, res, url, db, user })) return;
    if (await handlePortalWorkspaceRoutes({ req, res, url, db, user })) return;
    if (await handlePortalAdminOpsRoutes({ req, res, url, db, user })) return;
    sendHtml(res, layoutV2("未找到", `<div class="card">未找到对应页面。</div>`, user), 404);
  };
}
