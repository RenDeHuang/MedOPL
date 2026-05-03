import assert from "node:assert/strict";

const { createPortalAdminApiRoutes } = await import("../services/portal/src/routes/admin-api.routes.mjs");
const {
  buildAdminCustomerAccountingPayload,
  buildAdminCustomerAccountingDetailPayload,
} = await import("../services/portal/src/app/portal-admin-api-payloads.mjs");

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

const db = {
  users: [
    { id: "admin", role: "admin" },
    { id: "user-v202-route", tenantId: "tenant-v202-route", role: "user", name: "客户 Route", email: "route@example.com" },
  ],
  wallets: [{ userId: "user-v202-route", balance: 88 }],
  ledger: [{ userId: "user-v202-route", tenantId: "tenant-v202-route", type: "topup", amount: 88, createdAt: "2026-05-03T01:00:00.000Z" }],
  labSubscriptions: [],
  resourceOrders: [],
};

const route = createPortalAdminApiRoutes({
  sendJson,
  buildAdminOverviewPayload: async () => ({}),
  buildAdminUsersApiPayload: () => ({}),
  buildAdminGroupsApiPayload: () => ({}),
  buildAdminUsageApiPayload: () => ({}),
  buildAdminBillingOpsApiPayload: () => ({}),
  buildAdminSystemApiPayload: () => ({}),
  buildAdminOpsApiPayload: () => ({}),
  buildAdminSandboxesApiPayload: () => ({}),
  buildAdminAuditApiPayload: () => ({}),
  buildAdminUserPortraitApiPayload: async () => null,
  buildAdminWorkspacePortraitApiPayload: async () => null,
  buildAdminRunPortraitApiPayload: async () => null,
  buildAdminCustomerAccountingPayload,
  buildAdminCustomerAccountingDetailPayload,
});

async function request(path) {
  const res = {};
  const handled = await route({
    req: { method: "GET" },
    res,
    url: new URL(path, "http://portal.local"),
    db,
    user: { id: "admin", role: "admin" },
  });
  return { handled, res };
}

let result = await request("/portal/api/admin/customer-accounting");
assert.equal(result.handled, true);
assert.equal(result.res.statusCode, 200);
assert.equal(result.res.payload.customers.length, 1);
assert.equal(result.res.payload.customers[0].tenantId, "tenant-v202-route");
assert.equal(result.res.payload.customers[0].rechargeTotalCents, 8800);

result = await request("/portal/api/admin/customer-accounting/detail?tenantId=tenant-v202-route");
assert.equal(result.handled, true);
assert.equal(result.res.statusCode, 200);
assert.equal(result.res.payload.tenantId, "tenant-v202-route");
assert.equal(result.res.payload.recharges.length, 1);

result = await request("/portal/api/admin/customer-accounting/detail?tenantId=missing");
assert.equal(result.handled, true);
assert.equal(result.res.statusCode, 404);
assert.deepEqual(result.res.payload, { error: "not_found" });

console.log(JSON.stringify({
  ok: true,
  contract: "v20.2_admin_customer_accounting_routes",
}, null, 2));
