function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function requireAdmin({ res, user, sendHtml, layoutV2 }) {
  if (user.role === "admin") return false;
  sendHtml(res, layoutV2("无权限", `<div class="card">无权限</div>`, user), 403);
  return true;
}

export function createPortalLegacyRedirectRoutes({
  layoutV2,
  sendHtml,
}) {
  const userRedirects = new Map([
    ["/", "/portal/app/overview"],
    ["/portal", "/portal/app/overview"],
    ["/portal/billing", "/portal/app/billing"],
    ["/portal/servers", "/portal/app/servers"],
    ["/portal/workspace", "/portal/app/workspace"],
  ]);

  const adminRedirects = new Map([
    ["/portal/admin", "/portal/app/admin/dashboard"],
    ["/portal/admin/dashboard", "/portal/app/admin/dashboard"],
    ["/portal/admin/alerts", "/portal/app/admin/alerts"],
    ["/portal/admin/users", "/portal/app/admin/users"],
    ["/portal/admin/groups", "/portal/app/admin/groups"],
    ["/portal/admin/usage", "/portal/app/admin/usage"],
    ["/portal/admin/billing-ops", "/portal/app/admin/billing-ops"],
    ["/portal/admin/system", "/portal/app/admin/system"],
    ["/portal/admin/ops", "/portal/app/admin/ops"],
    ["/portal/admin/sandboxes", "/portal/app/admin/sandboxes"],
    ["/portal/admin/audit", "/portal/app/admin/audit"],
    ["/portal/admin/docs/pricing-rules", "/portal/admin"],
    ["/portal/admin/docs/final-gap", "/portal/admin"],
  ]);

  const adminRedirectsWithSearch = new Map([
    ["/portal/admin/user", "/portal/app/admin/user"],
    ["/portal/admin/workspace", "/portal/app/admin/workspace"],
    ["/portal/admin/run", "/portal/app/admin/run"],
  ]);

  return async function handlePortalLegacyRedirectRoutes({ req, res, url, user }) {
    if (req.method !== "GET") return false;

    const userTarget = userRedirects.get(url.pathname);
    if (userTarget) {
      redirect(res, `${userTarget}${url.search || ""}`);
      return true;
    }

    const adminTarget = adminRedirects.get(url.pathname);
    if (adminTarget) {
      if (requireAdmin({ res, user, sendHtml, layoutV2 })) return true;
      redirect(res, adminTarget);
      return true;
    }

    const adminSearchTarget = adminRedirectsWithSearch.get(url.pathname);
    if (adminSearchTarget) {
      if (requireAdmin({ res, user, sendHtml, layoutV2 })) return true;
      redirect(res, `${adminSearchTarget}${url.search || ""}`);
      return true;
    }

    return false;
  };
}
