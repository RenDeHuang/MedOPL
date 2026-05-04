import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";

const { createPortalFeatureRuntimeHandlers } = await import("../services/portal/src/app/portal-feature-runtime-handlers.mjs");

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = "") {
      this.body += String(body || "");
      this.ended = true;
    },
  };
}

const appendedCookies = [];
const handlers = createPortalFeatureRuntimeHandlers({
  appendCookie: (_res, cookie) => appendedCookies.push(cookie),
  buildWorkspaceFileChecksum: () => "",
  buildWorkspaceStorageKey: () => "",
  createOrUpdateStorageOrder: () => ({}),
  defaultTaskTitle: () => "Default",
  ensureTaskSpace: async () => ({}),
  exists: async () => false,
  fetchServerPlans: async () => [],
  fetchWorkspaceMinioState: async () => ({}),
  fetchWorkspaceStorageSnapshot: () => ({}),
  findTaskSpace: () => ({ slug: "default", status: "active" }),
  guessContentType: () => "text/plain",
  issueWorkspaceTransferToken: () => ({}),
  layoutV2: (_title, body) => body,
  listWorkspaceFiles: () => [],
  logPortalEvent: async () => {},
  markWorkspaceStorageDeleting: () => {},
  mkdir: async () => {},
  normalizeAuthEmail: (value) => String(value || "").toLowerCase(),
  oplLaunchService: {
    async prepareLaunch(input) {
      return {
        ok: true,
        taskSpace: { slug: input.taskSlug, status: "active" },
        workspaceSession: { id: "workspace-session-v20-32", workspaceId: input.taskSlug },
        launch: {
          launchId: "launch-v20-32",
          launchToken: "launch-token-v20-32",
          oplWebUrl: "https://opl.medopl.cn/",
          runtimeUrl: "https://opl.medopl.cn/runtime",
          runtimeSessionId: "runtime-session-v20-32",
          oplSessionId: "opl-session-v20-32",
        },
      };
    },
  },
  path: { join: (...parts) => parts.join("/") },
  portalInternalAuthAllowed: () => true,
  readBody: async () => Buffer.from(""),
  readDb: async () => ({}),
  readJsonBody: async () => ({}),
  readWorkspaceTransferToken: () => null,
  recordWorkspaceFile: () => ({}),
  resourceProvisionerClient: {},
  safeRelativePath: (value) => value,
  sendFile: async () => {},
  sendHtml: (res, body, status = 200) => {
    res.writeHead(status, { "content-type": "text/html" });
    res.end(body);
  },
  sendJson: (res, payload, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  },
  slugify: (value) => String(value || "").trim() || "default",
  stat: async () => ({ isFile: () => true }),
  syncWorkspaceFileToMinio: async () => ({}),
  workspaceSessionCookie: () => "workspace_session",
  workspaceStorageEntitlement: () => ({}),
  writeFile: async () => {},
  writeDb: async () => {},
});

const req = Object.assign(new EventEmitter(), {
  method: "GET",
  url: "/portal/opl",
  headers: {},
});
const res = createResponse();
const handled = await handlers.handleOplRoutes({
  req,
  res,
  url: new URL("https://portal.medopl.cn/portal/opl"),
  db: {},
  user: { id: "user-v20-32", email: "user@example.test", currentTaskSlug: "default" },
});

assert.equal(handled, true, "portal_opl_route_must_be_handled");
assert.equal(res.statusCode, 302, "portal_opl_route_must_redirect_to_opl_web");
assert.equal(res.headers.Location, "https://opl.medopl.cn/", "portal_opl_route_must_redirect_to_opl_web_url");
assert(
  appendedCookies.some((cookie) => cookie.startsWith("workspace_session=workspace-session-v20-32;")),
  "portal_opl_route_must_set_workspace_session_cookie",
);

const featureSource = await readFile("services/portal/src/app/portal-feature-runtime-handlers.mjs", "utf8");
assert.match(
  featureSource,
  /createOplRoutes\(\{[\s\S]*workspaceSessionCookie[\s\S]*\}\)/,
  "feature_runtime_handlers_must_wire_workspace_session_cookie_to_opl_routes",
);

const runtimeSource = await readFile("services/portal/src/app/portal-runtime.mjs", "utf8");
const featureRuntimeCallStart = runtimeSource.indexOf("} = createFeatureRuntimeHandlers({");
assert.notEqual(featureRuntimeCallStart, -1, "portal_runtime_must_create_feature_runtime_handlers");
const featureRuntimeCallEnd = runtimeSource.indexOf("});", featureRuntimeCallStart);
assert.notEqual(featureRuntimeCallEnd, -1, "portal_runtime_feature_runtime_handlers_call_must_close");
const featureRuntimeCall = runtimeSource.slice(featureRuntimeCallStart, featureRuntimeCallEnd);
assert.match(
  featureRuntimeCall,
  /workspaceSessionCookie,/,
  "portal_runtime_must_pass_workspace_session_cookie_to_feature_runtime_handlers",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v20.32_portal_opl_route_wiring",
}, null, 2));
