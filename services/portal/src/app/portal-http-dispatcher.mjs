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
  handlePortalLegacyRedirectRoutes,
  handlePortalTaskSpaceRoutes,
  handleResourceOrderRoutes,
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
}) {
  return async function dispatchPortalHttpRequest(req, res) {
    const url = new URL(req.url || "/", "http://local");
    const isGetAuthPage = req.method === "GET" && (url.pathname === "/login" || url.pathname === "/register");
    const isPortalAppShellRequest = req.method === "GET" &&
      (url.pathname === "/portal/app" || url.pathname === "/portal/app/" || url.pathname.startsWith("/portal/app/"));
    if (isGetAuthPage) {
      const authHandled = await handleAuthRoutes({ req, res, url, db: null });
      if (authHandled) return;
    }
    if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/status")) {
      sendJson(res, buildPortalHealthPayload());
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/portal/app/assets/")) {
      const relative = url.pathname.replace("/portal/app/assets/", "");
      const filePath = path.join(frontendDistRoot, "assets", relative);
      await sendStaticAsset(res, filePath, guessContentType(filePath));
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
    const currentUserMode = isPostAuthEntry && !hasPortalSessionCookie ? "auth_light" : "full";
    if (isPortalAppShellRequest) {
      const shellStartedAt = Date.now();
      const { user } = await currentUser(req, { mode: "shell" });
      const shell_ms = Date.now() - shellStartedAt;
      if (!user) {
        res.writeHead(302, { Location: "/login", "server-timing": `shell_ms;dur=${shell_ms}` });
        res.end();
        return;
      }
      await sendStaticAsset(res, path.join(frontendDistRoot, "index.html"), "text/html; charset=utf-8");
      return;
    }
    const { db, user } = await currentUser(req, { mode: currentUserMode });
    if (!isGetAuthPage && (await handleAuthRoutes({ req, res, url, db }))) return;
    if (await handleResourceOrderRoutes({ req, res, url, db, user: null })) return;
    if (!user) {
      res.writeHead(302, { Location: "/login" });
      res.end();
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
    if (await handleResourceOrderRoutes({ req, res, url, db, user })) return;
    if (await handleServerPlanRoutes({ req, res, url, db, user })) return;
    if (req.method === "GET" && url.pathname === "/portal/api/workspace") {
      const taskSlug = slugify(url.searchParams.get("task") || user.currentTaskSlug || "default");
      sendJson(res, await buildWorkspacePayload(db, user, taskSlug));
      return;
    }
    if (await handlePortalAdminApiRoutes({ req, res, url, db, user })) return;
    if (await handlePortalLegacyRedirectRoutes({ req, res, url, user })) return;
    if (await handlePortalBillingExportRoutes({ req, res, url, db, user })) return;
    if (await handlePortalTaskSpaceRoutes({ req, res, url, db, user })) return;
    if (await handlePortalAdminOpsRoutes({ req, res, url, db, user })) return;
    sendHtml(res, layoutV2("未找到", `<div class="card">未找到对应页面。</div>`, user), 404);
  };
}
