import assert from "node:assert/strict";

const { createPortalAdminApiRoutes } = await import("../services/portal/src/routes/admin-api.routes.mjs");

function createResponseRecorder() {
  return {
    statusCode: null,
    payload: null,
  };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

const calls = [];
const db = { users: [{ id: "user-1" }] };
const overview = { alerts: [{ severity: "warning", title: "contract" }], marker: "overview" };
const route = createPortalAdminApiRoutes({
  sendJson,
  buildAdminOverviewPayload: async (targetDb) => {
    calls.push(["overview", targetDb]);
    return overview;
  },
  buildAdminUsersApiPayload: (targetDb, payload, options) => {
    calls.push(["users", targetDb, payload, options]);
    return { route: "users", options };
  },
  buildAdminGroupsApiPayload: () => ({ route: "groups" }),
  buildAdminUsageApiPayload: (_payload, options) => ({ route: "usage", options }),
  buildAdminBillingOpsApiPayload: () => ({ route: "billing-ops" }),
  buildAdminSystemApiPayload: () => ({ route: "system" }),
  buildAdminOpsApiPayload: () => ({ route: "ops" }),
  buildAdminSandboxesApiPayload: () => ({ route: "sandboxes" }),
  buildAdminAuditApiPayload: (_payload, options) => ({ route: "audit", options }),
  buildAdminUserPortraitApiPayload: async (_targetDb, userId) => userId === "user-1" ? { user: { id: userId } } : null,
  buildAdminWorkspacePortraitApiPayload: async (_targetDb, userId, workspaceId) =>
    userId === "user-1" && workspaceId === "analysis" ? { workspace: { slug: workspaceId } } : null,
  buildAdminRunPortraitApiPayload: async (_targetDb, runId) => runId === "run-1" ? { run: { runId } } : null,
});

async function request({ path, role = "admin", method = "GET" }) {
  const res = createResponseRecorder();
  const handled = await route({
    req: { method },
    res,
    url: new URL(path, "http://portal.local"),
    db,
    user: { id: `${role}-1`, role },
  });
  return { handled, res };
}

let result = await request({ path: "/portal/api/admin/overview" });
assert.equal(result.handled, true, "admin_overview_must_be_handled");
assert.equal(result.res.statusCode, 200, "admin_overview_must_return_200");
assert.equal(result.res.payload, overview, "admin_overview_must_return_payload");

result = await request({ path: "/portal/api/admin/users?page=2&page_size=25&q=alice&workspace=analysis&userId=user-1&username=ali&email=a@example.test" });
assert.equal(result.handled, true, "admin_users_must_be_handled");
assert.equal(result.res.payload.route, "users", "admin_users_must_call_payload_builder");
assert.deepEqual(result.res.payload.options, {
  page: "2",
  pageSize: "25",
  q: "alice",
  workspace: "analysis",
  userId: "user-1",
  username: "ali",
  email: "a@example.test",
});

result = await request({ path: "/portal/api/admin/alerts" });
assert.deepEqual(result.res.payload, { alerts: overview.alerts }, "admin_alerts_must_return_overview_alerts");

result = await request({ path: "/portal/api/admin/user?userId=user-1" });
assert.equal(result.res.payload.user.id, "user-1", "admin_user_portrait_must_return_payload");

result = await request({ path: "/portal/api/admin/workspace?userId=user-1&workspaceId=analysis" });
assert.equal(result.res.payload.workspace.slug, "analysis", "admin_workspace_portrait_must_return_payload");

result = await request({ path: "/portal/api/admin/run?runId=run-1" });
assert.equal(result.res.payload.run.runId, "run-1", "admin_run_portrait_must_return_payload");

result = await request({ path: "/portal/api/admin/user?userId=missing" });
assert.equal(result.res.statusCode, 404, "missing_admin_user_portrait_must_404");
assert.deepEqual(result.res.payload, { error: "not_found" });

result = await request({ path: "/portal/api/admin/overview", role: "user" });
assert.equal(result.handled, true, "non_admin_admin_api_must_be_handled");
assert.equal(result.res.statusCode, 403, "non_admin_admin_api_must_forbid");
assert.deepEqual(result.res.payload, { error: "forbidden" });

result = await request({ path: "/portal/api/admin/overview", method: "POST" });
assert.equal(result.handled, false, "non_get_admin_api_must_not_be_claimed");

result = await request({ path: "/portal/api/workspace" });
assert.equal(result.handled, false, "non_admin_api_path_must_not_be_claimed");

assert(calls.some(([kind]) => kind === "overview"), "overview_builder_must_be_called");
assert(calls.some(([kind]) => kind === "users"), "users_builder_must_be_called");

console.log(JSON.stringify({
  ok: true,
  checked: [
    "overview",
    "users",
    "alerts",
    "portraits",
    "forbidden",
    "unmatched",
  ],
}, null, 2));
