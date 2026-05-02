import assert from "node:assert/strict";

const { createPortalAdminUserRoutes } = await import("../services/portal/src/routes/admin-user.routes.mjs");

function encodeForm(fields = {}) {
  return new URLSearchParams(Object.entries(fields).map(([key, value]) => [key, String(value)])).toString();
}

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body += String(body || "");
    },
  };
}

async function readBody(req) {
  return Buffer.from(req.body || "");
}

function parseForm(raw) {
  return Object.fromEntries(new URLSearchParams(raw));
}

function sendHtml(res, body, status = 200) {
  res.writeHead(status, { "content-type": "text/html" });
  res.end(body);
}

const db = {
  users: [{ id: "admin-1", email: "admin@example.test", name: "Admin", role: "admin", status: "active" }],
  wallets: [],
  ledger: [],
  sessions: [],
  workspaceSessions: [],
  taskSpaces: [],
  userSandboxes: [],
};
const events = [];
const writes = [];
const route = createPortalAdminUserRoutes({
  activeUserStatus: (status) => status || "active",
  appendLedgerEntry: (targetDb, entry) => {
    targetDb.ledger.push(entry);
    return { created: true, entry };
  },
  defaultTaskTitle: (slug) => `Task ${slug}`,
  ensureTaskSpace: async (targetDb, user, slug, title) => {
    targetDb.taskSpaces.push({ userId: user.id, slug, title });
  },
  ensureUserCommercialState: (user) => {
    user.commercial = { trialEntitlement: { status: "active" } };
  },
  layoutV2: (title, body) => `${title}:${body}`,
  logPortalEvent: async (event) => events.push(event),
  parseForm,
  readBody,
  runZitadelAdminUser: async () => ({ synced: false, source: "portal_local_identity" }),
  sendHtml,
  writeDb: async (targetDb) => writes.push(targetDb),
});

async function request(path, fields = {}, user = db.users[0]) {
  const res = createResponseRecorder();
  const handled = await route({
    req: { method: "POST", body: encodeForm(fields) },
    res,
    url: new URL(path, "http://portal.local"),
    db,
    user,
  });
  return { handled, res };
}

let result = await request("/portal/admin/create-user", {
  name: "Tenant User",
  email: "tenant@example.test",
  password: "password-123",
  redirectTo: "/portal/admin/users",
});
assert.equal(result.handled, true, "create_user_must_be_handled");
assert.equal(result.res.statusCode, 302, "create_user_must_redirect");
const createdUser = db.users.find((item) => item.email === "tenant@example.test");
assert.ok(createdUser, "create_user_must_insert_user");
assert.ok(db.wallets.some((item) => item.userId === createdUser.id), "create_user_must_create_wallet");
assert.ok(db.taskSpaces.some((item) => item.userId === createdUser.id && item.slug === "default"), "create_user_must_create_default_task");
assert.ok(events.some((event) => event.type === "admin_created_user"), "create_user_must_log_event");

result = await request("/portal/admin/recharge", {
  userId: createdUser.id,
  amount: "25",
  redirectTo: "/portal/admin/users",
});
assert.equal(result.res.statusCode, 302, "recharge_must_redirect");
assert.equal(db.wallets.find((item) => item.userId === createdUser.id).balance, 25, "recharge_must_update_wallet");
assert.ok(db.ledger.some((entry) => entry.type === "topup" && entry.userId === createdUser.id), "recharge_must_append_ledger");

result = await request("/portal/admin/toggle-user", {
  userId: createdUser.id,
  redirectTo: "/portal/admin/users",
});
assert.equal(result.res.statusCode, 302, "toggle_must_redirect");
assert.equal(createdUser.status, "disabled", "toggle_must_disable_active_user");

result = await request("/portal/admin/delete-user", {
  userId: createdUser.id,
  redirectTo: "/portal/admin/users",
});
assert.equal(result.res.statusCode, 302, "soft_delete_must_redirect");
assert.equal(createdUser.status, "deleted", "soft_delete_must_mark_deleted");

result = await request("/portal/admin/create-user", {}, { id: "user-1", role: "user" });
assert.equal(result.handled, true, "non_admin_must_be_handled");
assert.equal(result.res.statusCode, 403, "non_admin_must_forbid");

result = await request("/portal/admin/not-owned", {});
assert.equal(result.handled, false, "unknown_admin_user_route_must_not_be_claimed");

console.log(JSON.stringify({
  ok: true,
  checked: [
    "create-user",
    "recharge",
    "toggle-user",
    "soft-delete",
    "forbidden",
    "unmatched",
  ],
  writes: writes.length,
}, null, 2));
