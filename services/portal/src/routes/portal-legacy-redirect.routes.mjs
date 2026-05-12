function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function requireAdmin({ res, user, sendHtml, layoutV2, allowAdminRedirect = false }) {
  if (allowAdminRedirect) return false;
  if (user.role === "admin") return false;
  sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
  return true;
}

export function createPortalLegacyRedirectRoutes({
  layoutV2,
  sendHtml,
}) {
  const userRedirects = new Map([
    ["/portal", "/overview"],
    ["/portal/billing", "/billing"],
    ["/portal/servers", "/resources"],
    ["/portal/workspace", "/workspace"],
    ["/portal/app", "/overview"],
    ["/portal/app/", "/overview"],
    ["/portal/app/overview", "/overview"],
    ["/portal/app/packages", "/packages"],
    ["/portal/app/resources", "/resources"],
    ["/portal/app/workspace", "/workspace"],
    ["/portal/app/billing", "/billing"],
    ["/portal/app/trace", "/trace"],
    ["/portal/app/opl-launch", "/opl-launch"],
  ]);

  const adminRedirects = new Map([
    ["/portal/admin", "/admin/dashboard"],
    ["/portal/admin/dashboard", "/admin/dashboard"],
    ["/portal/admin/alerts", "/admin/alerts"],
    ["/portal/admin/users", "/admin/users"],
    ["/portal/admin/groups", "/admin/groups"],
    ["/portal/admin/usage", "/admin/usage"],
    ["/portal/admin/billing-ops", "/admin/billing-ops"],
    ["/portal/admin/system", "/admin/system"],
    ["/portal/admin/ops", "/admin/ops"],
    ["/portal/admin/sandboxes", "/admin/sandboxes"],
    ["/portal/admin/audit", "/admin/audit"],
    ["/portal/app/admin/dashboard", "/admin/dashboard"],
    ["/portal/app/admin/alerts", "/admin/alerts"],
    ["/portal/app/admin/users", "/admin/users"],
    ["/portal/app/admin/groups", "/admin/groups"],
    ["/portal/app/admin/usage", "/admin/usage"],
    ["/portal/app/admin/billing-ops", "/admin/billing-ops"],
    ["/portal/app/admin/system", "/admin/system"],
    ["/portal/app/admin/ops", "/admin/ops"],
    ["/portal/app/admin/sandboxes", "/admin/sandboxes"],
    ["/portal/app/admin/audit", "/admin/audit"],
    ["/portal/admin/docs/pricing-rules", "/portal/admin"],
    ["/portal/admin/docs/final-gap", "/portal/admin"],
  ]);

  const adminRedirectsWithSearch = new Map([
    ["/portal/admin/user", "/admin/user"],
    ["/portal/admin/workspace", "/admin/workspace"],
    ["/portal/admin/run", "/admin/run"],
    ["/portal/app/admin/user", "/admin/user"],
    ["/portal/app/admin/workspace", "/admin/workspace"],
    ["/portal/app/admin/run", "/admin/run"],
  ]);

  return async function handlePortalLegacyRedirectRoutes({ req, res, url, user, allowAdminRedirect = false }) {
    if (req.method !== "GET") return false;

    const userTarget = userRedirects.get(url.pathname);
    if (userTarget) {
      redirect(res, `${userTarget}${url.search || ""}`);
      return true;
    }

    const adminTarget = adminRedirects.get(url.pathname);
    if (adminTarget) {
      if (requireAdmin({ res, user, sendHtml, layoutV2, allowAdminRedirect })) return true;
      redirect(res, adminTarget);
      return true;
    }

    const adminSearchTarget = adminRedirectsWithSearch.get(url.pathname);
    if (adminSearchTarget) {
      if (requireAdmin({ res, user, sendHtml, layoutV2, allowAdminRedirect })) return true;
      redirect(res, `${adminSearchTarget}${url.search || ""}`);
      return true;
    }

    return false;
  };
}
