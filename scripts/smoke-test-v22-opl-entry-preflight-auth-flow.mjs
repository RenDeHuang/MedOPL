import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_opl_entry_preflight_backend_only";
const PASSWORD = "portal-password-v22";

const contractPath = "docs/contracts/v22-opl-entry-preflight-auth-boundary.md";
const authHandlerPath = "services/portal/src/app/portal-auth-runtime-handler.mjs";
const oplLaunchViewPath = "services/portal/frontend/src/views/opl/OplLaunchView.vue";
const userVisibleEntryPath = "/opl/entry/preflight";
const internalImplementationPath = "/internal/opl/auth/login";

const { createPortalAuthRuntimeHandler } = await import("../services/portal/src/app/portal-auth-runtime-handler.mjs");
const {
  createGflabProviderConfig,
  normalizeProviderApiKey,
  redactProviderConfig,
} = await import("../services/portal/src/domain/provider-config.mjs");
const { createProviderSecretStore } = await import("../services/portal/src/domain/provider-secret-store.mjs");
const { hashPassword } = await import("../services/portal/src/domain/portal-auth.mjs");
const { createOplLaunchService } = await import("../services/portal/src/services/opl-launch.service.mjs");

function assertNoRawKey(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(/rawProviderKey|providerSecret|providerApiKey|apiKey/i.test(serialized), false, `${label}_must_not_expose_provider_key_fields`);
}

function assertNoBrowserSecretStorage(source, label) {
  assert.equal(/localStorage|sessionStorage/i.test(source), false, `${label}_must_not_use_browser_secret_storage`);
}

function createResponseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    payload: null,
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = "") {
      this.body += String(body || "");
    },
  };
}

function sendHtml(res, html, status = 200) {
  res.statusCode = status;
  res.body = html;
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

async function readBody(req) {
  return Buffer.from(req.body || "");
}

function parseForm(bodyText = "") {
  return Object.fromEntries(new URLSearchParams(bodyText));
}

function formBody(values = {}) {
  return new URLSearchParams(values).toString();
}

async function assertContract() {
  const contract = await readFile(contractPath, "utf8");
  for (const required of [
    "portal.medopl.cn 登录不需要 gflabtoken API Key",
    "Portal 普通登录页不需要 API Key",
    "路径 1：从 Portal SaaS 后台进入",
    "路径 2：直接访问 OPL 工作台",
    "两条路径最终进入同一套 Gateway / preflight / launch 逻辑",
    "从 Portal 进入时可复用 Portal session / workspace / launch context",
    "从 OPL 直接进入时需要 MedOPL 账号/密码/gflabtoken API Key，已绑定可显示“已绑定”",
    "opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key",
    "OPL 登录页输入顺序：账号/邮箱、密码、gflabtoken API Key",
    "API Key 放在密码下面",
    "API Key 只出现在 opl.medopl.cn entry/preflight 的密码下面",
    "已绑定则显示“已绑定”，不要求重复输入",
    "gflabtoken.cn 网站本身不进入 MedOPL 用户主流程",
    "raw API Key 只能进入后端密钥边界",
    "one-person-lab 是 clean upstream",
    "用户可见入口：GET /opl/entry/preflight",
    "用户可见入口：POST /opl/entry/preflight",
    "内部实现可以保留 /internal/opl/auth/login",
    "用户可见入口不是 /internal/opl/auth/login",
    "/internal/opl/auth/login 只能是 internal implementation path",
    "launchToken/runtimeToken 不进 URL query",
    "launchToken/runtimeToken 不进 localStorage/sessionStorage",
    "Gateway 不写 raw API Key 到 localStorage/sessionStorage",
  ]) {
    assert(contract.includes(required), `contract_missing:${required}`);
  }
  assert.equal(contract.includes(["用户可见入口：GET", internalImplementationPath].join(" ")), false, "contract_must_not_make_internal_get_user_visible");
  assert.equal(contract.includes(["用户可见入口：POST", internalImplementationPath].join(" ")), false, "contract_must_not_make_internal_post_user_visible");
}

function assertPreflightFormOrder(html) {
  const emailIndex = Math.min(
    ...["name=\"email\"", "name=\"account\""]
      .map((marker) => html.indexOf(marker))
      .filter((index) => index >= 0),
  );
  const passwordIndex = html.indexOf("name=\"password\"");
  const apiKeyIndex = html.indexOf("name=\"apiKey\"");
  assert(emailIndex >= 0, "opl_preflight_form_email_or_account_field_missing");
  assert(passwordIndex >= 0, "opl_preflight_form_password_field_missing");
  assert(apiKeyIndex >= 0, "opl_preflight_form_api_key_field_missing");
  assert(emailIndex < passwordIndex, "opl_preflight_email_must_precede_password");
  assert(passwordIndex < apiKeyIndex, "opl_preflight_api_key_must_be_below_password");
  assert(html.includes(`action="${userVisibleEntryPath}"`), "opl_preflight_form_action_must_use_user_visible_alias");
  assert.equal(html.includes(internalImplementationPath), false, "opl_preflight_form_must_not_expose_internal_path");
  assert(html.includes("gflabtoken API Key"), "opl_preflight_form_must_label_gflabtoken_api_key");
  assert(html.includes("已绑定"), "opl_preflight_form_must_explain_bound_status");
  assert.equal(html.includes("gflabtoken.cn"), false, "opl_preflight_form_must_not_send_user_to_gflabtoken_site");
  assertNoBrowserSecretStorage(html, "opl_preflight_form");
}

function createFixture({ providerSecretStore, events, writes, launchCalls }) {
  const db = {
    users: [{
      id: "user-v22-opl-entry",
      tenantId: "tenant-v22-opl-entry",
      email: "opl-entry@example.test",
      name: "OPL Entry User",
      role: "user",
      status: "active",
      authSource: "local",
      currentTaskSlug: "workspace-v22-opl-entry",
      passwordHash: hashPassword(PASSWORD),
    }],
    sessions: [],
    wallets: [{ userId: "user-v22-opl-entry", balance: 12000 }],
    taskSpaces: [{
      id: "taskspace-v22-opl-entry",
      userId: "user-v22-opl-entry",
      slug: "workspace-v22-opl-entry",
      title: "OPL Entry Workspace",
      status: "active",
    }],
    workspaceSessions: [],
    providerKeyBindings: [],
  };

  const oplLaunchService = createOplLaunchService({
    evaluateUserPolicy: async () => ({ ok: true, blocks: [] }),
    findTaskSpace: (targetDb, userId, taskSlug) =>
      targetDb.taskSpaces.find((item) => item.userId === userId && item.slug === taskSlug) || null,
    ensureTaskSpace: async (targetDb, user, taskSlug, title) => {
      const existing = targetDb.taskSpaces.find((item) => item.userId === user.id && item.slug === taskSlug);
      if (existing) return existing;
      const created = { id: `taskspace-${taskSlug}`, userId: user.id, slug: taskSlug, title, status: "active" };
      targetDb.taskSpaces.push(created);
      return created;
    },
    ensureWorkspaceSession: async (targetDb, user, taskSpace) => {
      const session = {
        id: `workspace-session-${targetDb.workspaceSessions.length + 1}`,
        userId: user.id,
        taskSlug: taskSpace.slug,
        status: "active",
      };
      targetDb.workspaceSessions.push(session);
      return session;
    },
    createOplLaunch: async ({ user, taskSpace, workspaceSession, providerConfig, providerConfigSecretRef, providerKeyPayload }) => {
      launchCalls.push({
        userId: user.id,
        taskSlug: taskSpace.slug,
        workspaceSessionId: workspaceSession.id,
        providerConfig,
        providerConfigSecretRef,
        providerKeyPayload,
      });
      return {
        launchId: `launch-${launchCalls.length}`,
        launchToken: `launch-token-${launchCalls.length}`,
        oplWebUrl: `https://opl.medopl.cn/session/${launchCalls.length}`,
        runtimeUrl: "",
        runtimeSessionId: `runtime-session-${launchCalls.length}`,
        oplSessionId: `opl-session-${launchCalls.length}`,
        providerKeyRef: providerConfig?.providerKeyRef || "",
      };
    },
    providerSecretStore,
    resolveStorageEntitlement: () => null,
    defaultTaskTitle: (taskSlug) => `Workspace ${taskSlug}`,
    logPortalEvent: async (event) => {
      events.push(event);
    },
    writeDb: async (targetDb) => {
      writes.push(JSON.parse(JSON.stringify(targetDb)));
    },
  });

  const handler = createPortalAuthRuntimeHandler({
    clearCookie: () => {},
    createGflabProviderConfig,
    defaultTaskTitle: (taskSlug) => `Workspace ${taskSlug}`,
    ensureTaskSpace: async () => null,
    ensureUserCommercialState: () => {},
    exchangeOidcCode: async () => ({}),
    fetchOidcUserInfo: async () => ({}),
    isBlockedUserStatus: (status) => status === "blocked",
    layoutV2: (_title, body) => body,
    logPortalEvent: async (event) => {
      events.push(event);
    },
    normalizeProviderApiKey,
    oplLaunchService,
    parseCookies: () => ({}),
    parseForm,
    portalInternalAuthAllowed: (req) => req.headers?.["x-portal-internal-token"] === "allow-opl-entry",
    portalOidc: { enabled: false },
    readBody,
    redactProviderConfig,
    sendHtml,
    sendJson,
    setCookie: () => {},
    writeDb: async (targetDb) => {
      writes.push(JSON.parse(JSON.stringify(targetDb)));
    },
  });

  async function request({ method = "GET", urlPath = userVisibleEntryPath, body = "", headers = {}, contentType = "" } = {}) {
    const res = createResponseRecorder();
    const nextHeaders = {
      "x-portal-internal-token": "allow-opl-entry",
      ...headers,
    };
    if (contentType) nextHeaders["content-type"] = contentType;
    const handled = await handler({
      req: { method, body, headers: nextHeaders },
      res,
      url: new URL(urlPath, "https://portal.medopl.cn"),
      db,
    });
    return { handled, res };
  }

  return { db, handler, request };
}

await assertContract();

const authSource = await readFile(authHandlerPath, "utf8");
const oplLaunchViewSource = await readFile(oplLaunchViewPath, "utf8");
assertNoBrowserSecretStorage(authSource, "portal_auth_handler");
assertNoBrowserSecretStorage(oplLaunchViewSource, "portal_opl_launch_view");
assert.equal(authSource.includes("one-person-lab"), false, "opl_entry_must_not_import_or_modify_upstream");

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-opl-entry-preflight-auth-"));
try {
  const providerSecretStore = createProviderSecretStore({ secretsRoot: tempRoot });
  const events = [];
  const writes = [];
  const launchCalls = [];
  const { db, request } = createFixture({ providerSecretStore, events, writes, launchCalls });

  const form = await request({ method: "GET", urlPath: userVisibleEntryPath });
  assert.equal(form.handled, true, "opl_preflight_get_must_be_handled");
  assert.equal(form.res.statusCode, 200, "opl_preflight_get_status_mismatch");
  assertPreflightFormOrder(form.res.body);

  const internalForm = await request({ method: "GET", urlPath: internalImplementationPath });
  assert.equal(internalForm.handled, true, "opl_preflight_internal_get_must_remain_handled");
  assert.equal(internalForm.res.body, form.res.body, "opl_preflight_alias_must_reach_same_form");

  const missingKey = await request({
    method: "POST",
    urlPath: userVisibleEntryPath,
    body: formBody({
      email: "opl-entry@example.test",
      password: PASSWORD,
      task: "workspace-v22-opl-entry",
    }),
    contentType: "application/x-www-form-urlencoded",
  });
  assert.equal(missingKey.handled, true, "opl_preflight_missing_key_must_be_handled");
  assert.equal(missingKey.res.statusCode, 400, "opl_preflight_missing_key_status_mismatch");
  assert.equal(missingKey.res.payload.error, "provider_api_key_required", "opl_preflight_missing_key_error_mismatch");
  assertNoRawKey(missingKey.res.payload, "opl_preflight_missing_key_response");

  const success = await request({
    method: "POST",
    urlPath: userVisibleEntryPath,
    body: formBody({
      email: "opl-entry@example.test",
      password: PASSWORD,
      task: "workspace-v22-opl-entry",
      apiKey: RAW_PROVIDER_KEY,
    }),
    contentType: "application/x-www-form-urlencoded",
  });
  assert.equal(success.res.statusCode, 200, "opl_preflight_success_status_mismatch");
  assert.equal(success.res.payload.ok, true, "opl_preflight_success_ok_mismatch");
  assert.equal(success.res.payload.providerBound, true, "opl_preflight_success_provider_bound_mismatch");
  assert.equal(success.res.payload.boundStatus, "bound", "opl_preflight_success_bound_status_mismatch");
  assert.ok(success.res.payload.providerKeyRef, "opl_preflight_success_provider_ref_missing");
  assert.equal(success.res.payload.providerConfigSecretRef, undefined, "opl_preflight_response_must_not_expose_secret_ref");
  assertNoRawKey(success.res.payload, "opl_preflight_success_response");
  assert.equal(db.providerKeyBindings.length, 1, "opl_preflight_success_must_create_single_provider_binding");
  assert.equal(db.providerKeyBindings[0].providerKeyRef, success.res.payload.providerKeyRef, "opl_preflight_binding_ref_mismatch");
  assert.equal(db.providerKeyBindings[0].boundStatus, "bound", "opl_preflight_binding_status_mismatch");
  const secret = await providerSecretStore.readProviderSecret(success.res.payload.providerKeyRef);
  assert.equal(secret.apiKey, RAW_PROVIDER_KEY, "opl_preflight_backend_secret_must_store_raw_key");
  assertNoRawKey(events, "opl_preflight_events");
  assertNoRawKey(writes, "opl_preflight_persisted_db");

  const alreadyBound = await request({
    method: "POST",
    urlPath: userVisibleEntryPath,
    body: JSON.stringify({
      email: "opl-entry@example.test",
      password: PASSWORD,
      task: "workspace-v22-opl-entry",
    }),
    contentType: "application/json",
  });
  assert.equal(alreadyBound.res.statusCode, 200, "opl_preflight_already_bound_status_mismatch");
  assert.equal(alreadyBound.res.payload.providerBound, true, "opl_preflight_already_bound_provider_bound_mismatch");
  assert.equal(alreadyBound.res.payload.boundStatus, "bound", "opl_preflight_already_bound_status_mismatch");
  assert.equal(alreadyBound.res.payload.providerKeyRef, success.res.payload.providerKeyRef, "opl_preflight_already_bound_ref_mismatch");
  assert.equal(db.providerKeyBindings.length, 1, "opl_preflight_already_bound_must_not_create_duplicate_binding");
  assertNoRawKey(alreadyBound.res.payload, "opl_preflight_already_bound_response");
  assert.equal(launchCalls.length, 2, "opl_preflight_success_and_already_bound_must_create_launches");
  assert.equal(launchCalls[1].providerKeyPayload, null, "opl_preflight_already_bound_must_not_replay_raw_key_payload");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_opl_entry_preflight_auth",
  entrypoint: userVisibleEntryPath,
  internalImplementationPath,
}, null, 2));
