import assert from "node:assert/strict";
import path from "node:path";

const { createPortalTaskSpaceRoutes } = await import("../services/portal/src/routes/task-space.routes.mjs");

function encodeForm(fields = {}) {
  return new URLSearchParams(Object.entries(fields).map(([key, value]) => [key, String(value)])).toString();
}

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: null,
    payload: null,
    file: null,
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

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

function sendFile(res, filePath, downloadName, contentType = "") {
  res.statusCode = 200;
  res.file = { filePath, downloadName, contentType };
}

const db = {
  users: [{ id: "user-1", currentTaskSlug: "analysis" }],
  taskSpaces: [
    { userId: "user-1", slug: "analysis", title: "Analysis", status: "active", path: "/tmp/analysis" },
    { userId: "user-1", slug: "archive", title: "Archive", status: "archived", path: "/tmp/archive" },
  ],
  workspaceSessions: [{ id: "workspace-session-1", userId: "user-1", workspaceId: "analysis", status: "active" }],
};
const user = db.users[0];
const events = [];
const writes = [];
const route = createPortalTaskSpaceRoutes({
  archiveTaskSpace: async (_db, _user, taskSpace) => {
    taskSpace.status = "archived";
  },
  createZipFromDir: async (_sourceDir, outFile) => {
    events.push({ type: "zip_created", outFile });
  },
  defaultTaskTitle: (slug) => `Task ${slug}`,
  ensureTaskSpace: async (targetDb, targetUser, slug, title) => {
    const taskSpace = { userId: targetUser.id, slug, title, status: "active", path: `/tmp/${slug}` };
    targetDb.taskSpaces.push(taskSpace);
    return taskSpace;
  },
  evaluateUserPolicy: async () => ({ allowWorkspaceCreate: true, blocked: false }),
  exists: async (filePath) => filePath.endsWith("input.txt"),
  findTaskSpace: (targetDb, userId, slug) => targetDb.taskSpaces.find((item) => item.userId === userId && item.slug === slug) || null,
  handleUpload: async (_req, res) => {
    res.writeHead(204);
    res.end();
  },
  hasActiveRuns: async (_userId, workspaceId) => workspaceId === "busy",
  hasActiveWorkspaceSession: (_targetDb, _userId, workspaceId) => workspaceId === "session-busy",
  layoutV2: (title, body) => `${title}:${body}`,
  logPortalEvent: async (event) => events.push(event),
  markTaskSpaceDeleted: async (_targetDb, _user, taskSpace) => {
    taskSpace.status = "deleted";
  },
  mkdir: async () => {},
  nextTaskSlug: () => "new-task",
  parseCookies: () => ({ workspace_session: "workspace-session-1" }),
  parseForm,
  path,
  readBody,
  readWorkspaceSession: (targetDb, sessionId, userId) => targetDb.workspaceSessions.find((item) => item.id === sessionId && item.userId === userId) || null,
  restoreTaskSpace: async (_db, _user, taskSpace) => {
    taskSpace.status = "active";
  },
  runtimeRoot: "/tmp/runtime",
  safeRelativePath: (value) => String(value || "").replace(/^\/+/, ""),
  sendFile,
  sendHtml,
  sendJson,
  slugify: (value) => String(value || "default").toLowerCase().replace(/\s+/g, "-"),
  workspaceSessionCookie: () => "workspace_session",
  writeDb: async (targetDb) => writes.push(targetDb),
});

async function request(method, targetPath, fields = {}) {
  const res = createResponseRecorder();
  const handled = await route({
    req: { method, headers: {}, body: method === "POST" ? encodeForm(fields) : "" },
    res,
    url: new URL(targetPath, "http://portal.local"),
    db,
    user,
  });
  return { handled, res };
}

let result = await request("GET", "/portal/workspace-session/current");
assert.equal(result.handled, true, "workspace_session_current_must_be_handled");
assert.equal(result.res.payload.ok, true, "workspace_session_current_must_return_active_session");

result = await request("GET", "/portal/tasks/switch?task=analysis");
assert.equal(result.res.statusCode, 302, "task_switch_must_redirect");
assert.equal(result.res.headers.Location, "/portal/workspace?task=analysis");

result = await request("POST", "/portal/tasks/create", { title: "New Task" });
assert.equal(result.res.statusCode, 302, "task_create_must_redirect");
assert.equal(result.res.headers.Location, "/portal/workspace?task=new-task");
assert.ok(db.taskSpaces.some((item) => item.slug === "new-task"), "task_create_must_create_space");

result = await request("POST", "/portal/tasks/archive", { task: "analysis" });
assert.equal(result.res.statusCode, 302, "task_archive_must_redirect");
assert.equal(db.taskSpaces.find((item) => item.slug === "analysis").status, "archived");

result = await request("POST", "/portal/tasks/restore", { task: "archive" });
assert.equal(result.res.statusCode, 302, "task_restore_must_redirect");
assert.equal(db.taskSpaces.find((item) => item.slug === "archive").status, "active");

db.taskSpaces.push({ userId: "user-1", slug: "busy", title: "Busy", status: "active", path: "/tmp/busy" });
result = await request("POST", "/portal/tasks/delete", { task: "busy" });
assert.equal(result.res.statusCode, 409, "task_delete_must_block_active_runs");

result = await request("GET", "/portal/workspace/download-file?task=analysis&kind=inputs&file=input.txt");
assert.equal(result.res.statusCode, 200, "download_file_must_send_existing_file");
assert.equal(result.res.file.downloadName, "input.txt");

result = await request("GET", "/portal/workspace/download-all?task=analysis&kind=inputs");
assert.equal(result.res.statusCode, 200, "download_all_must_send_zip");
assert.equal(result.res.file.downloadName, "analysis-inputs.zip");

result = await request("POST", "/portal/workspace/upload");
assert.equal(result.res.statusCode, 204, "workspace_upload_must_delegate_to_upload_handler");

result = await request("GET", "/portal/not-task-space");
assert.equal(result.handled, false, "unknown_task_space_route_must_not_be_claimed");

console.log(JSON.stringify({
  ok: true,
  checked: [
    "workspace-session-current",
    "task-switch",
    "task-create",
    "task-archive-restore-delete",
    "workspace-download",
    "workspace-upload",
    "unmatched",
  ],
  writes: writes.length,
}, null, 2));
