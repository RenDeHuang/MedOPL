export function createPortalAdminApiRoutes({
  sendJson,
  buildAdminAuditApiPayload,
  buildAdminBillingOpsApiPayload,
  buildAdminGroupsApiPayload,
  buildAdminOpsApiPayload,
  buildAdminOverviewPayload,
  buildAdminRunPortraitApiPayload,
  buildAdminSandboxesApiPayload,
  buildAdminSystemApiPayload,
  buildAdminUsageApiPayload,
  buildAdminUserPortraitApiPayload,
  buildAdminUsersApiPayload,
  buildAdminWorkspacePortraitApiPayload,
  buildAdminCustomerAccountingPayload,
  buildAdminCustomerAccountingDetailPayload,
}) {
  async function requireAdmin({ res, user }) {
    if (user.role === "admin") return true;
    sendJson(res, { error: "forbidden" }, 403);
    return false;
  }

  async function withOverview(db, handler) {
    const payload = await buildAdminOverviewPayload(db);
    return handler(payload);
  }

  function opsSurfaceEnabled(payload = {}) {
    return Boolean(payload.productProfile?.opsSurfaceEnabled);
  }

  function sendOpsSurfaceDisabled(res) {
    sendJson(res, {
      ok: false,
      error: "ops_surface_disabled",
      message: "默认 user-owned 模式未启用平台托管运维入口。",
    }, 404);
  }

  return async function handlePortalAdminApiRoutes({ req, res, url, db, user }) {
    if (req.method !== "GET" || !url.pathname.startsWith("/portal/api/admin/")) return false;
    if (!(await requireAdmin({ res, user }))) return true;

    if (url.pathname === "/portal/api/admin/overview") {
      sendJson(res, await buildAdminOverviewPayload(db));
      return true;
    }
    if (url.pathname === "/portal/api/admin/users") {
      await withOverview(db, (payload) => sendJson(res, buildAdminUsersApiPayload(db, payload, {
        page: url.searchParams.get("page"),
        pageSize: url.searchParams.get("page_size"),
        q: url.searchParams.get("q"),
        workspace: url.searchParams.get("workspace"),
        userId: url.searchParams.get("userId"),
        username: url.searchParams.get("username"),
        email: url.searchParams.get("email"),
      })));
      return true;
    }
    if (url.pathname === "/portal/api/admin/groups") {
      await withOverview(db, (payload) => sendJson(res, buildAdminGroupsApiPayload(db, payload)));
      return true;
    }
    if (url.pathname === "/portal/api/admin/usage") {
      await withOverview(db, (payload) => sendJson(res, buildAdminUsageApiPayload(payload, {
        page: url.searchParams.get("page"),
        pageSize: url.searchParams.get("page_size"),
      })));
      return true;
    }
    if (url.pathname === "/portal/api/admin/billing-ops") {
      await withOverview(db, (payload) => sendJson(res, buildAdminBillingOpsApiPayload(db, payload)));
      return true;
    }
    if (url.pathname === "/portal/api/admin/customer-accounting") {
      sendJson(res, buildAdminCustomerAccountingPayload(db));
      return true;
    }
    if (url.pathname === "/portal/api/admin/customer-accounting/detail") {
      const tenantId = String(url.searchParams.get("tenantId") || url.searchParams.get("userId") || "");
      const payload = buildAdminCustomerAccountingDetailPayload(db, tenantId);
      if (!payload) {
        sendJson(res, { error: "not_found" }, 404);
        return true;
      }
      sendJson(res, payload);
      return true;
    }
    if (url.pathname === "/portal/api/admin/system") {
      await withOverview(db, (payload) => sendJson(res, buildAdminSystemApiPayload(payload)));
      return true;
    }
    if (url.pathname === "/portal/api/admin/ops") {
      await withOverview(db, (payload) => {
        if (!opsSurfaceEnabled(payload)) return sendOpsSurfaceDisabled(res);
        return sendJson(res, buildAdminOpsApiPayload(payload));
      });
      return true;
    }
    if (url.pathname === "/portal/api/admin/sandboxes") {
      await withOverview(db, (payload) => {
        if (!opsSurfaceEnabled(payload)) return sendOpsSurfaceDisabled(res);
        return sendJson(res, buildAdminSandboxesApiPayload(payload));
      });
      return true;
    }
    if (url.pathname === "/portal/api/admin/audit") {
      await withOverview(db, (payload) => sendJson(res, buildAdminAuditApiPayload(payload, {
        page: url.searchParams.get("page"),
        pageSize: url.searchParams.get("page_size"),
      })));
      return true;
    }
    if (url.pathname === "/portal/api/admin/alerts") {
      await withOverview(db, (payload) => sendJson(res, { alerts: payload.alerts || [] }));
      return true;
    }
    if (url.pathname === "/portal/api/admin/user") {
      const userId = String(url.searchParams.get("userId") || "");
      const payload = await buildAdminUserPortraitApiPayload(db, userId);
      if (!payload) {
        sendJson(res, { error: "not_found" }, 404);
        return true;
      }
      sendJson(res, payload);
      return true;
    }
    if (url.pathname === "/portal/api/admin/workspace") {
      const userId = String(url.searchParams.get("userId") || "");
      const workspaceId = String(url.searchParams.get("workspaceId") || "");
      const payload = await buildAdminWorkspacePortraitApiPayload(db, userId, workspaceId);
      if (!payload) {
        sendJson(res, { error: "not_found" }, 404);
        return true;
      }
      sendJson(res, payload);
      return true;
    }
    if (url.pathname === "/portal/api/admin/run") {
      const runId = String(url.searchParams.get("runId") || "");
      const payload = await buildAdminRunPortraitApiPayload(db, runId);
      if (!payload) {
        sendJson(res, { error: "not_found" }, 404);
        return true;
      }
      sendJson(res, payload);
      return true;
    }

    return false;
  };
}
