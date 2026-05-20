import assert from "node:assert/strict";

const { createPortalAdminApiRoutes } = await import("../../../services/portal/src/routes/admin-api.routes.mjs");

function responseRecorder() {
  return {
    statusCode: 0,
    payload: null,
  };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

const handler = createPortalAdminApiRoutes({
  sendJson,
  buildAdminAuditApiPayload: () => ({}),
  buildAdminBillingOpsApiPayload: () => ({}),
  buildAdminGroupsApiPayload: () => ({}),
  buildAdminOpsApiPayload: () => {
    throw new Error("admin_ops_payload_must_not_build_when_ops_surface_disabled");
  },
  buildAdminOverviewPayload: async () => ({
    productProfile: {
      opsSurfaceEnabled: false,
    },
  }),
  buildAdminRunPortraitApiPayload: () => ({}),
  buildAdminSandboxesApiPayload: () => {
    throw new Error("admin_sandboxes_payload_must_not_build_when_ops_surface_disabled");
  },
  buildAdminSystemApiPayload: () => ({}),
  buildAdminUsageApiPayload: () => ({}),
  buildAdminUserPortraitApiPayload: () => ({}),
  buildAdminUsersApiPayload: () => ({}),
  buildAdminWorkspacePortraitApiPayload: () => ({}),
  buildAdminCustomerAccountingPayload: () => ({}),
  buildAdminCustomerAccountingDetailPayload: () => ({}),
});

const res = responseRecorder();
const handled = await handler({
  req: { method: "GET" },
  res,
  url: new URL("http://127.0.0.1/portal/api/admin/ops"),
  db: {},
  user: { role: "admin" },
});

assert.equal(handled, true, "admin_ops_disabled_route_must_be_handled");
assert.equal(res.statusCode, 404, "admin_ops_disabled_status_must_be_404");
assert.deepEqual(res.payload, {
  ok: false,
  error: "ops_surface_disabled",
  message: "未启用平台托管运维入口。",
}, "admin_ops_disabled_payload_mismatch");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_admin_ops_disabled_product_state",
  route: "/portal/api/admin/ops",
  status: res.statusCode,
  error: res.payload.error,
}, null, 2));
