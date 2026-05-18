import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_retire_portal_entry_backend_only";

const portalLoginPath = "services/portal/src/app/portal-auth-runtime-handler.mjs";
const portalUserSurfacePaths = [
  "services/portal/frontend/src/app/components/Layout.tsx",
  "services/portal/frontend/src/app/pages/Overview.tsx",
  "services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx",
  "services/portal/frontend/src/app/pages/Workspace.tsx",
  "services/portal/frontend/src/app/pages/BillingAudit.tsx",
  "services/portal/frontend/src/app/pages/TasksResults.tsx",
  "services/portal/frontend/src/app/pages/OPLEntry.tsx",
];
const routeBoundaryPath = "services/portal/src/routes/portal-api-v22-user-credit-provider-key.routes.mjs";
const contractPath = "docs/contracts/v22-user-credit-provider-key-boundary.md";

const { createPortalApiRoutes } = await import("../services/portal/src/routes/portal-api.routes.mjs");
const { createProviderSecretStore } = await import("../services/portal/src/domain/provider-secret-store.mjs");

function assertNoSecretLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(/launchToken|runtimeToken|bearerToken|providerSecret|rawProviderKey|providerApiKey|apiKey/i.test(serialized), false, `${label}_must_not_expose_secret_fields`);
}

function extractFunctionSection(source, functionName, nextFunctionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${functionName}_missing`);
  const next = source.indexOf(`function ${nextFunctionName}`, start + marker.length);
  assert.notEqual(next, -1, `${nextFunctionName}_missing`);
  return source.slice(start, next);
}

function extractTemplate(source) {
  return /<template>([\s\S]*?)<\/template>/.exec(source)?.[1] || "";
}

function extractQuotedAttribute(template, attributeName) {
  const values = [];
  const pattern = new RegExp(`\\s:?${attributeName}="([^"]*)"`, "g");
  let match;
  while ((match = pattern.exec(template)) !== null) {
    values.push(match[1]);
  }
  return values.join("\n");
}

function extractStringArrayConst(source, constName) {
  const match = new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\];`).exec(source);
  return match?.[1] || "";
}

function extractVisibleTemplateCopy(template) {
  const visibleAttributes = [
    "title",
    "subtitle",
    "description",
    "label",
    "hint",
    "placeholder",
  ].map((attribute) => extractQuotedAttribute(template, attribute));
  const textNodes = template
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/{{[\s\S]*?}}/g, " ")
    .replace(/<[^>]+>/g, " ");
  const interpolationStrings = [...template.matchAll(/"([^"]*[一-龥][^"]*)"/g)].map((match) => match[1]);
  return [...visibleAttributes, textNodes, ...interpolationStrings].join("\n");
}

function extractTsxVisibleCopy(source) {
  return [...source.matchAll(/["'`]([^"'`]*[一-龥][^"'`]*)["'`]/g)]
    .map((match) => match[1])
    .join("\n");
}

async function assertPortalLoginHasNoApiKeyField() {
  const source = await readFile(portalLoginPath, "utf8");
  const body = source.includes("function renderPortalLoginPage")
    ? extractFunctionSection(source, "renderPortalLoginPage", "renderPortalRegisterPage")
    : extractFunctionSection(source, "localLoginBody", "localRegisterBody");
  assert(body.includes('name="email"'), "portal_login_email_field_missing");
  assert(body.includes('name="password"'), "portal_login_password_field_missing");
  assert.equal(/api[_-]?key|provider[_-]?key|gflabtoken|模型调用密钥/i.test(body), false, "portal_login_must_not_include_provider_key_field");
}

async function assertPortalUserSurfaceHasNoProviderKeyEntry() {
  const contents = await Promise.all(portalUserSurfacePaths.map(async (filePath) => {
    const source = await readFile(filePath, "utf8");
    const copy = [
      extractTsxVisibleCopy(source),
      filePath.endsWith("Layout.tsx") ? extractStringArrayConst(source, "navigation") : "",
    ].join("\n");
    return { filePath, copy };
  }));

  const visibleCopy = contents.map(({ copy }) => copy).join("\n");
  assert(visibleCopy.includes("gflabtoken 模型调用密钥"), "portal_may_show_provider_key_bound_status_language");
  assert(visibleCopy.includes("已绑定") || visibleCopy.includes("未绑定") || visibleCopy.includes("是否已绑定"), "portal_must_only_show_provider_key_bound_status");

  const forbiddenCopy = [
    ["统一账号与", "gflabtoken", "绑定"].join(" "),
    ["gflabtoken", "绑定"].join(" "),
    ["在 Portal 绑定", "API Key"].join(" "),
    ["在 Portal 输入", "API Key"].join(" "),
    ["Portal 绑定", "API Key"].join(" "),
    ["Portal 输入", "API Key"].join(" "),
    ["Portal 登录需要", "API Key"].join(" "),
    ["Portal 登录需要", "gflabtoken"].join(" "),
    "API Key 输入框",
  ];
  for (const { filePath, copy } of contents) {
    for (const forbidden of forbiddenCopy) {
      assert.equal(copy.includes(forbidden), false, `portal_user_surface_must_not_include:${filePath}:${forbidden}`);
    }
    assert.equal(/<input[^>]+(?:api[_-]?key|provider[_-]?key|gflabtoken)/i.test(copy), false, `portal_user_surface_must_not_render_provider_key_input:${filePath}`);
    assert.equal(/(localStorage|sessionStorage)/i.test(copy), false, `portal_user_surface_must_not_persist_provider_key:${filePath}`);
  }
}

async function assertProviderKeyRouteIsInternalBoundary() {
  const source = await readFile(routeBoundaryPath, "utf8");
  assert(source.includes("/portal/api/v22/provider-key"), "provider_key_route_must_still_exist_for_backend_boundary_reuse");
  assert(source.includes("OPL entry/preflight"), "provider_key_route_must_be_marked_for_opl_entry_preflight");
  assert(source.includes("notPortalUserVisibleEntry"), "provider_key_route_must_not_be_portal_user_visible_entry");
  assert(source.includes("bindV22GflabProviderKey"), "provider_key_route_must_reuse_backend_secret_binding");
}

async function assertContractTruths() {
  const contract = await readFile(contractPath, "utf8");
  for (const required of [
    "portal.medopl.cn 登录不需要 gflabtoken API Key",
    "opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key",
    "API Key 输入框放在 OPL 登录页密码下面",
    "Portal 可以展示“是否已绑定”状态",
    "API Key 不是 Portal 普通登录字段",
    "raw API Key 只能进入后端密钥边界",
  ]) {
    assert(contract.includes(required), `contract_truth_missing:${required}`);
  }
}

async function assertProviderKeyResponseDoesNotLeakRawKey() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-retire-portal-provider-key-entry-"));
  try {
    const providerSecretStore = createProviderSecretStore({ secretsRoot: tempRoot });
    const db = {
      users: [],
      tenants: [],
      wallets: [],
      ledger: [],
      taskSpaces: [],
      workspaceResourceBindings: [],
      providerKeyBindings: [],
      announcements: [],
    };
    const route = createPortalApiRoutes({
      activeUserStatus: (status) => status || "active",
      adminScopeResult: () => ({ ok: false, status: 403, error: "forbidden" }),
      announcementRows: () => [],
      buildCommercialProfile: () => ({ accountStatus: "active", billingStatus: "funded", entitlementStatus: "active" }),
      buildSessionTraceDetailPayload: async () => null,
      buildSessionTracesApiPayload: async () => ({ items: [] }),
      collectRunsForUser: async () => [],
      currentServerPlanSelection: () => ({ id: "starter_2c4g_10gb" }),
      currentTaskSpaceForUser: (targetDb, targetUser) => targetDb.taskSpaces.find((item) => item.userId === targetUser.id) || null,
      evaluateUserPolicy: async () => ({ ok: true }),
      fetchBillingSummary: async () => ({ totals: { totalCost: 0 }, items: [] }),
      fetchHarborSummary: async () => ({ available: false }),
      fetchRuntimeBridgeCosts: async () => [],
      fetchRuntimeBridgeRuns: async () => [],
      fetchRuntimeBridgeTraceRows: async () => ({ rows: [] }),
      fetchOpsRegistryImageRows: async () => ({ items: [] }),
      fetchTraceRows: async () => ({ rows: [] }),
      formatDateTime: (value) => String(value || ""),
      isRunTerminal: () => true,
      normalizePageSize: (value) => Number(value || 20),
      paginateRows: (rows) => ({ rows, page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 }),
      parsePositiveInt: (value, fallback) => Number(value || fallback),
      providerSecretStore,
      readBody: async (req) => Buffer.from(req.body || ""),
      readSessionsRequestOptions: () => ({}),
      readTracesRequestOptions: () => ({}),
      sendJson: (res, payload, status = 200) => {
        res.statusCode = status;
        res.payload = payload;
      },
      visibleAnnouncementRows: () => [],
      workspaceChatSessionsForUser: () => [],
      writeDb: async () => {},
    });
    async function request({ method = "GET", urlPath = "/", body = null, user = null } = {}) {
      const res = { statusCode: 0, payload: null };
      const handled = await route({
        req: { method, body: body ? JSON.stringify(body) : "" },
        res,
        url: new URL(urlPath, "http://portal.local"),
        db,
        user,
      });
      return { handled, res };
    }

    const prepared = await request({
      method: "POST",
      urlPath: "/portal/api/v22/users/prepare",
      body: {
        tenantId: "tenant-v22-provider-entry",
        userId: "user-v22-provider-entry",
        email: "provider-entry@example.test",
        name: "Provider Entry User",
        workspaceId: "workspace-v22-provider-entry",
      },
    });
    assert.equal(prepared.res.statusCode, 201, "prepare_user_status_mismatch");
    const user = db.users.find((item) => item.id === "user-v22-provider-entry");
    assert.ok(user, "prepared_user_missing");

    const bound = await request({
      method: "POST",
      urlPath: "/portal/api/v22/provider-key",
      user,
      body: {
        workspaceId: "workspace-v22-provider-entry",
        provider: "gflabtoken",
        apiKey: RAW_PROVIDER_KEY,
      },
    });
    assert.equal(bound.handled, true, "provider_key_route_must_be_handled");
    assert.equal(bound.res.statusCode, 200, "provider_key_route_status_mismatch");
    assert.deepEqual(Object.keys(bound.res.payload).sort(), ["boundStatus", "ok", "provider", "providerBound", "providerKeyRef"].sort(), "provider_key_response_keys_mismatch");
    assertNoSecretLeak(bound.res.payload, "provider_key_response");
    const secret = await providerSecretStore.readProviderSecret(bound.res.payload.providerKeyRef);
    assert.equal(secret.apiKey, RAW_PROVIDER_KEY, "backend_secret_boundary_must_keep_raw_key");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await assertPortalLoginHasNoApiKeyField();
await assertPortalUserSurfaceHasNoProviderKeyEntry();
await assertProviderKeyRouteIsInternalBoundary();
await assertContractTruths();
await assertProviderKeyResponseDoesNotLeakRawKey();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_retire_portal_provider_key_entry",
  portalUserSurfacePaths,
  retainedBackendBoundary: "/portal/api/v22/provider-key",
}, null, 2));
