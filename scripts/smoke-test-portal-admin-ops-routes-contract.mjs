import assert from "node:assert/strict";

const { createPortalAdminOpsRoutes } = await import("../services/portal/src/routes/admin-ops.routes.mjs");

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
  settings: {
    allowRegistration: false,
    announcements: [],
  },
  users: [
    { id: "admin-1", name: "Admin", email: "admin@example.test", role: "admin" },
    { id: "user-1", name: "Alice", email: "alice@example.test", role: "user", passwordHash: "old" },
  ],
  groups: [],
  sessions: [{ userId: "user-1" }],
  wallets: [{ userId: "user-1", balance: 10 }],
  workspaceSessions: [{ userId: "user-1" }],
  userSandboxes: [{ userId: "user-1" }],
  taskSpaces: [{ userId: "user-1", slug: "analysis" }],
};
const events = [];
const writes = [];
const identityCalls = [];
const route = createPortalAdminOpsRoutes({
  hashPassword: (password) => `hash:${password}`,
  layoutV2: (title, body) => `${title}:${body}`,
  logPortalEvent: async (event) => events.push(event),
  parseForm,
  readBody,
  runZitadelAdminUser: async (args) => {
    identityCalls.push(args);
    return { synced: true };
  },
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

let result = await request("/portal/admin/settings", {
  allowRegistration: "1",
  redirectTo: "/portal/admin/users",
});
assert.equal(result.handled, true, "settings_must_be_handled");
assert.equal(result.res.statusCode, 302, "settings_must_redirect");
assert.equal(db.settings.allowRegistration, true, "settings_must_update_registration_flag");

result = await request("/portal/admin/announcements/save", {
  title: "Maintenance",
  content: "Window",
  pinned: "1",
  redirectTo: "/portal/app/admin/alerts",
});
assert.equal(result.res.statusCode, 302, "announcement_save_must_redirect");
assert.equal(db.settings.announcements.length, 1, "announcement_save_must_create_record");
assert.equal(db.settings.announcements[0].title, "Maintenance");

result = await request("/portal/admin/announcements/toggle", {
  id: db.settings.announcements[0].id,
  actionType: "deactivate",
});
assert.equal(result.res.statusCode, 302, "announcement_toggle_must_redirect");
assert.equal(db.settings.announcements[0].status, "inactive", "announcement_toggle_must_update_status");

result = await request("/portal/admin/groups/create", {
  name: "Internal",
  plan: "beta",
  allowMas: "1",
  allowWorkspaceCreate: "1",
});
assert.equal(result.res.statusCode, 302, "group_create_must_redirect");
assert.equal(db.groups[0].name, "Internal", "group_create_must_create_group");

result = await request("/portal/admin/groups/assign", {
  userId: "user-1",
  groupId: db.groups[0].id,
});
assert.equal(result.res.statusCode, 302, "group_assign_must_redirect");
assert.equal(db.users[1].groupId, db.groups[0].id, "group_assign_must_update_user");

result = await request("/portal/admin/user-profile", {
  userId: "user-1",
  email: "alice2@example.test",
  name: "Alice Two",
});
assert.equal(result.res.statusCode, 302, "profile_update_must_redirect");
assert.equal(db.users[1].email, "alice2@example.test", "profile_update_must_update_email");
assert.deepEqual(identityCalls.at(-1), ["update-profile", "alice@example.test", "alice2@example.test", "Alice Two"]);

result = await request("/portal/admin/user-password", {
  userId: "user-1",
  password: "new-password",
});
assert.equal(result.res.statusCode, 302, "password_reset_must_redirect");
assert.equal(db.users[1].passwordHash, "hash:new-password", "password_reset_must_update_hash");

result = await request("/portal/admin/user-delete", {
  userId: "user-1",
  confirmEmail: "alice2@example.test",
});
assert.equal(result.res.statusCode, 302, "user_delete_must_redirect");
assert.ok(!db.users.some((item) => item.id === "user-1"), "user_delete_must_remove_user");
assert.ok(!db.sessions.some((item) => item.userId === "user-1"), "user_delete_must_remove_sessions");

result = await request("/portal/admin/settings", {}, { id: "user-2", role: "user" });
assert.equal(result.handled, true, "non_admin_must_be_handled");
assert.equal(result.res.statusCode, 403, "non_admin_must_forbid");

result = await request("/portal/admin/not-ops", {});
assert.equal(result.handled, false, "unknown_admin_ops_route_must_not_be_claimed");

console.log(JSON.stringify({
  ok: true,
  checked: [
    "settings",
    "announcements",
    "groups",
    "user-profile",
    "user-password",
    "user-delete",
    "forbidden",
    "unmatched",
  ],
  writes: writes.length,
}, null, 2));
