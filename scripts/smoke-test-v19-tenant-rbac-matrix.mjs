import assert from "node:assert/strict";

const scope = await import(new URL(["..", "services", "portal", "src", "domain", "tenant-scope.mjs"].join("/"), import.meta.url));
const resourceOrders = await import(new URL(["..", "services", "portal", "src", "domain", "resource-orders.mjs"].join("/"), import.meta.url));

const userA = { id: "user-a", tenantId: "tenant-a", role: "user" };
const userB = { id: "user-b", tenantId: "tenant-b", role: "user" };
const admin = { id: "admin", role: "admin" };
const db = {
  resourceOrders: [
    { id: "ro-a", userId: userA.id, tenantId: userA.tenantId, workspaceId: "ws-a", status: "running" },
    { id: "ro-b", userId: userB.id, tenantId: userB.tenantId, workspaceId: "ws-b", status: "running" },
  ],
  resourceOrderEvents: [],
  ledger: [],
};

assert.equal(scope.tenantIdForUser(userA), "tenant-a");
assert.equal(scope.resourceBelongsToUser(db.resourceOrders[0], userA), true);
assert.equal(scope.resourceBelongsToUser(db.resourceOrders[1], userA), false);
assert.equal(scope.resourceBelongsToUser(db.resourceOrders[1], admin), true);
assert.equal(scope.filterUserScopedRows(db.resourceOrders, userA).length, 1);
assert.equal(scope.adminScopeResult(userA).status, 403);
assert.equal(scope.adminScopeResult(admin).ok, true);
assert.deepEqual(resourceOrders.resourceOrdersForUser(db, userA.id).map((item) => item.id), ["ro-a"]);

console.log(JSON.stringify({
  ok: true,
  userScopedOrders: scope.filterUserScopedRows(db.resourceOrders, userA).map((item) => item.id),
  adminCanSee: scope.filterUserScopedRows(db.resourceOrders, admin).length,
}, null, 2));
