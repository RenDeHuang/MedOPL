import assert from "node:assert/strict";

const {
  createLabPackageRoutes,
} = await import("../services/portal/src/routes/lab-package.routes.mjs");

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body += chunk;
    },
  };
}

async function dispatch(handler, { method, pathname, body = "", db, user }) {
  const req = {
    method,
    url: pathname,
    [Symbol.asyncIterator]: async function* iterator() {
      if (body) yield Buffer.from(body);
    },
  };
  const res = createResponse();
  const handled = await handler({
    req,
    res,
    url: new URL(pathname, "http://local"),
    db,
    user,
  });
  assert.equal(handled, true, `route_not_handled:${method}:${pathname}`);
  return {
    statusCode: res.statusCode || 200,
    payload: JSON.parse(res.body || "{}"),
  };
}

const db = {
  wallets: [{ userId: "user-v20-route", balance: 800 }],
  ledger: [],
  labSubscriptions: [],
  labPackageEvents: [],
  labStorageAddons: [],
  labDailyCharges: [],
  storageOrders: [],
  workspaceFiles: [],
};
const user = { id: "user-v20-route", tenantId: "tenant-v20-route" };
let writeCount = 0;
const handler = createLabPackageRoutes({
  readBody: async (req) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
  },
  sendJson: (res, payload, status = 200) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
  },
  writeDb: async () => {
    writeCount += 1;
  },
});

const packages = await dispatch(handler, { method: "GET", pathname: "/portal/api/lab-packages", db, user });
assert.equal(packages.statusCode, 200);
assert.equal(packages.payload.items.length, 2);

const activated = await dispatch(handler, {
  method: "POST",
  pathname: "/portal/api/lab-packages/activate",
  db,
  user,
  body: JSON.stringify({ packageId: "starter", workspaceId: "default", idempotencyKey: "route-activate" }),
});
assert.equal(activated.statusCode, 201);
assert.equal(activated.payload.subscription.packageId, "starter");
assert.equal(activated.payload.entitlement.storage.totalGb, 10);

const subscription = await dispatch(handler, { method: "GET", pathname: "/portal/api/lab-subscription?workspaceId=default", db, user });
assert.equal(subscription.payload.subscription.packageId, "starter");

const upgraded = await dispatch(handler, {
  method: "POST",
  pathname: "/portal/api/lab-packages/upgrade",
  db,
  user,
  body: JSON.stringify({ packageId: "pro", subscriptionId: activated.payload.subscription.id, idempotencyKey: "route-upgrade" }),
});
assert.equal(upgraded.statusCode, 200);
assert.equal(upgraded.payload.subscription.packageId, "pro");
assert.equal(upgraded.payload.entitlement.storage.totalGb, 100);

const addon = await dispatch(handler, {
  method: "POST",
  pathname: "/portal/api/lab-storage/addons",
  db,
  user,
  body: JSON.stringify({ subscriptionId: activated.payload.subscription.id, storageGb: 100, idempotencyKey: "route-addon" }),
});
assert.equal(addon.statusCode, 201);
assert.equal(addon.payload.entitlement.storage.totalGb, 200);

const entitlement = await dispatch(handler, { method: "GET", pathname: "/portal/api/lab-entitlement?workspaceId=default", db, user });
assert.equal(entitlement.payload.entitlement.packageId, "pro");
assert.equal(entitlement.payload.entitlement.gates.canDownload, true);
assert.equal(writeCount, 3);

console.log(JSON.stringify({
  ok: true,
  contract: "v20_lab_package_routes",
  writeCount,
  finalPackageId: entitlement.payload.entitlement.packageId,
}, null, 2));
