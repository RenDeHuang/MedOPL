import assert from "node:assert/strict";
import { Readable } from "node:stream";

const { handleAuthUser, handleNativeLogin } = await import("../services/opl-web-gateway/src/portal-auth-bridge.mjs");
const { portalLaunchClientScript } = await import("../services/opl-web-gateway/src/launch-client-script.mjs");
const { createOplInternalAuthRoutes } = await import("../services/portal/src/app/portal-auth-opl-routes.mjs");
const {
  createGflabProviderConfig,
  normalizeProviderApiKey,
  redactProviderConfig,
} = await import("../services/portal/src/domain/provider-config.mjs");
const { createOplLaunchService } = await import("../services/portal/src/services/opl-launch.service.mjs");
const { createOplAdapterClient } = await import("../services/portal/src/integrations/opl-adapter-client.mjs");
const { hashPassword } = await import("../services/portal/src/domain/portal-auth.mjs");

function createRequest({ method = "GET", url = "/", headers = {}, body = "" } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = { ...headers };
    },
    end(payload = "") {
      this.body += String(payload || "");
    },
  };
}

const gatewayScript = portalLaunchClientScript();
assert.match(gatewayScript, /injectGflabtokenApiKeyField/, "gateway_script_must_inject_login_provider_field");
assert.match(gatewayScript, /data-opl-provider-key/, "gateway_script_must_render_provider_key_input_selector");
assert.match(gatewayScript, /来源于 gflabtoken/, "gateway_script_must_show_gflabtoken_source_copy");
assert.match(gatewayScript, /模型服务来源于 gflabtoken/, "gateway_script_must_explicitly_show_gflabtoken_model_source");
assert.match(gatewayScript, /resolveCookieLaunchState/, "gateway_script_must_support_cookie_login_rehydration");
assert.doesNotMatch(gatewayScript, /name="mode"|name="resourceBindingId"|name="workspaceId"/, "gateway_script_must_not_render_scope_fields");

const fetchCalls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : String(input.url || input);
  fetchCalls.push({
    url,
    method: String(init.method || "GET"),
    headers: init.headers || {},
    body: init.body ? JSON.parse(String(init.body)) : null,
  });
  if (url.includes("/internal/opl/auth/login")) {
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          launchToken: "token-v21-login",
          user: { id: "user-v21-login", email: "login@example.test", name: "Login User" },
          launch: { launchId: "launch-v21-login", runtimeSessionId: "runtime-session-v21-login" },
          workspace: { slug: "scope-lab" },
          workspaceSession: { id: "workspace-session-v21-login" },
          runtimeSession: { runtimeSessionId: "runtime-session-v21-login", oplSessionId: "opl-session-v21-login" },
        };
      },
    };
  }
  return {
    ok: true,
    async json() {
      return {
        portal: {
          portalUserId: "user-v21-login",
          portalUserEmail: "login@example.test",
          portalUserName: "Login User",
        },
        workspace: { workspaceId: "scope-lab" },
        launch: { portalUserId: "user-v21-login" },
      };
    },
  };
};

try {
  const loginReq = createRequest({
    method: "POST",
    url: "/api/v1/auths/signin",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "email=login%40example.test&password=secret-pass-123&apiKey=gflabtoken_login_secret&redirectTo=%2F",
  });
  const loginRes = createResponse();
  const loginHandled = await handleNativeLogin(loginReq, loginRes, new URL("https://opl.medopl.cn/api/v1/auths/signin"));
  assert.equal(loginHandled, true, "native_login_route_must_handle_gateway_signin");
  assert.equal(loginRes.statusCode, 200, "native_login_route_must_return_success_json");

  const loginPayload = JSON.parse(loginRes.body);
  assert.equal(loginPayload.success, true, "native_login_response_must_succeed");
  assert.equal(typeof loginPayload.launchToken, "undefined", "native_login_response_must_not_return_launch_token");
  assert.equal(typeof loginPayload.token, "undefined", "native_login_response_must_not_return_token");
  assert.equal(typeof loginPayload.token_type, "undefined", "native_login_response_must_not_return_token_type");
  assert.match(String(loginRes.headers["set-cookie"] || ""), /opl_portal_launch=token-v21-login/, "native_login_response_must_set_http_only_launch_cookie");
  assert.match(String(loginRes.headers["set-cookie"] || ""), /HttpOnly/, "native_login_launch_cookie_must_be_http_only");
  assert.equal(String(loginRes.body).includes("token-v21-login"), false, "native_login_response_body_must_not_include_launch_token");
  assert.equal(loginPayload.user.email, "login@example.test", "native_login_response_must_keep_portal_identity");
  assert.equal(String(loginRes.body).includes("gflabtoken_login_secret"), false, "native_login_response_must_not_echo_plaintext_api_key");

  assert.equal(fetchCalls.length >= 1, true, "native_login_must_call_portal_internal_login");
  assert.equal(fetchCalls[0].body.email, "login@example.test", "native_login_must_forward_email");
  assert.equal(fetchCalls[0].body.apiKey, "gflabtoken_login_secret", "native_login_must_forward_gflabtoken_to_internal_auth");
  assert.equal(fetchCalls[0].body.mode, "api_only", "native_login_must_default_scope_to_api_only");
  assert.equal(typeof fetchCalls[0].body.resourceBindingId, "undefined", "native_login_default_scope_must_not_send_resource_binding");

  const authReq = createRequest({
    method: "GET",
    url: "/api/auth/user",
    headers: {
      accept: "application/json",
      cookie: "opl_portal_launch=token-v21-login",
    },
  });
  const authRes = createResponse();
  const authHandled = await handleAuthUser(authReq, authRes, { openWebUi: false });
  assert.equal(authHandled, true, "auth_user_route_must_handle_launch_cookie");
  assert.equal(authRes.statusCode, 200, "auth_user_route_must_succeed_with_launch_cookie");
  const authPayload = JSON.parse(authRes.body);
  assert.equal(authPayload.success, true, "auth_user_payload_must_succeed");
  assert.equal(typeof authPayload.launchToken, "undefined", "auth_user_payload_must_not_expose_launch_token");
  assert.equal(typeof authPayload.token, "undefined", "auth_user_payload_must_not_expose_token");
  assert.equal(typeof authPayload.token_type, "undefined", "auth_user_payload_must_not_expose_token_type");
  assert.equal(authPayload.user.email, "login@example.test", "auth_user_payload_must_keep_portal_identity");
  assert.equal(String(authRes.body).includes("gflabtoken_login_secret"), false, "auth_user_payload_must_not_echo_plaintext_api_key");
} finally {
  globalThis.fetch = originalFetch;
}

function createPortalDb() {
  return {
    users: [
      {
        id: "user-v21-portal",
        email: "login@example.test",
        name: "Portal Login User",
        role: "user",
        status: "active",
        authSource: "local",
        currentTaskSlug: "scope-lab",
        passwordHash: hashPassword("secret-pass-123"),
      },
    ],
    wallets: [
      {
        userId: "user-v21-portal",
        balance: 0,
      },
    ],
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function sendJsonCompat(res, payload, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

const prepareLaunchCalls = [];
const internalAuthRoute = createOplInternalAuthRoutes({
  createGflabProviderConfig,
  isBlockedUserStatus: () => false,
  logPortalEvent: async () => {},
  normalizeProviderApiKey,
  oplLaunchService: {
    async prepareLaunch(input) {
      prepareLaunchCalls.push(input);
      return {
        ok: true,
        taskSpace: { slug: "scope-lab", title: "Scope Lab", status: "active" },
        workspaceSession: { id: "workspace-session-v21-portal", workspaceId: "scope-lab" },
        launch: {
          launchToken: "token-v21-portal",
          launchId: "launch-v21-portal",
          runtimeSessionId: "runtime-session-v21-portal",
          oplSessionId: "opl-session-v21-portal",
        },
      };
    },
  },
  portalInternalAuthAllowed: () => true,
  readBody,
  redactProviderConfig,
  sendJson: sendJsonCompat,
});

{
  const req = createRequest({
    method: "POST",
    url: "/internal/opl/auth/login",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "login@example.test",
      password: "secret-pass-123",
      task: "scope-lab",
    }),
  });
  const res = createResponse();
  const handled = await internalAuthRoute({
    req,
    res,
    url: new URL("https://portal.example.test/internal/opl/auth/login"),
    db: createPortalDb(),
  });
  assert.equal(handled, true, "portal_internal_auth_must_handle_login_route");
  assert.equal(res.statusCode, 400, "portal_internal_auth_must_reject_missing_provider_key");
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, "provider_api_key_required", "portal_internal_auth_missing_provider_key_error_mismatch");
}

{
  const req = createRequest({
    method: "POST",
    url: "/internal/opl/auth/login",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "login@example.test",
      password: "secret-pass-123",
      task: "scope-lab",
      gflabtoken: "portal_route_gflabtoken_secret",
    }),
  });
  const res = createResponse();
  const handled = await internalAuthRoute({
    req,
    res,
    url: new URL("https://portal.example.test/internal/opl/auth/login"),
    db: createPortalDb(),
  });
  assert.equal(handled, true, "portal_internal_auth_must_accept_gflabtoken_alias");
  assert.equal(res.statusCode, 200, "portal_internal_auth_success_must_return_json");
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true, "portal_internal_auth_response_must_succeed");
  assert.equal(payload.launchToken, "token-v21-portal", "portal_internal_auth_must_return_launch_token");
  assert.equal(payload.providerConfigured, true, "portal_internal_auth_must_return_redacted_provider_status");
  assert.equal(String(res.body).includes("portal_route_gflabtoken_secret"), false, "portal_internal_auth_response_must_not_echo_plaintext_provider_key");
}

assert.equal(prepareLaunchCalls.length, 1, "portal_internal_auth_must_prepare_launch_once_for_success_case");
assert.equal(prepareLaunchCalls[0].providerKeyPayload.provider, "gflabtoken", "portal_internal_auth_must_forward_provider_name");
assert.equal(prepareLaunchCalls[0].providerKeyPayload.source, "user_input", "portal_internal_auth_must_mark_provider_key_source");
assert.equal(prepareLaunchCalls[0].providerKeyPayload.apiKey, "portal_route_gflabtoken_secret", "portal_internal_auth_must_forward_plaintext_provider_key_only_inside_portal");
assert.equal(prepareLaunchCalls[0].launchScope.mode, "api_only", "portal_internal_auth_must_default_launch_scope_to_api_only");
assert.equal(Boolean(String(prepareLaunchCalls[0].providerConfigSecretRef || "").trim()), true, "portal_internal_auth_must_create_provider_secret_ref");
assert.equal(prepareLaunchCalls[0].providerConfig.providerConfigSecretRef, prepareLaunchCalls[0].providerConfigSecretRef, "portal_internal_auth_provider_config_must_share_secret_ref");

const providerSecretWrites = [];
let adapterLaunchInput = null;
const launchService = createOplLaunchService({
  evaluateUserPolicy: async () => ({ blocks: [], group: { id: "group-v21" } }),
  findTaskSpace: () => ({ slug: "scope-lab", title: "Scope Lab", status: "active", path: "/workspace/scope-lab" }),
  ensureTaskSpace: async () => {
    throw new Error("ensureTaskSpace_should_not_be_called");
  },
  ensureWorkspaceSession: async () => ({ id: "workspace-session-v21-service", workspaceId: "scope-lab" }),
  createOplLaunch: async (input) => {
    adapterLaunchInput = input;
    return {
      launchToken: "token-v21-service",
      launchId: "launch-v21-service",
      runtimeUrl: "https://github.com/gaofeng21cn/one-person-lab",
      oplWebUrl: "https://opl.example.test/?launch_token=token-v21-service",
      providerKeyPayload: input.providerKeyPayload,
    };
  },
  providerSecretStore: {
    async writeProviderSecret(ref, secret) {
      providerSecretWrites.push({ ref, secret });
    },
  },
  resolveStorageEntitlement: () => ({ tier: "lab" }),
  defaultTaskTitle: (slug) => slug,
  logPortalEvent: async () => {},
  writeDb: async () => {},
});

const providerConfigResult = createGflabProviderConfig({
  userId: "user-v21-service",
  workspaceId: "scope-lab",
  apiKey: "service_level_gflabtoken_secret",
});
assert.equal(providerConfigResult.ok, true, "provider_config_result_must_be_constructed_for_secret_write_contract");

const launchResult = await launchService.prepareLaunch({
  db: { wallets: [] },
  user: { id: "user-v21-service", email: "service@example.test", name: "Service User" },
  taskSlug: "scope-lab",
  requireRealOplWeb: true,
  source: "portal-api",
  providerConfig: providerConfigResult.providerConfig,
  providerConfigSecretRef: providerConfigResult.providerConfigSecretRef,
  providerKeyPayload: {
    provider: "gflabtoken",
    source: "user_input",
    apiKey: "service_level_gflabtoken_secret",
  },
});

assert.equal(launchResult.ok, true, "portal_launch_service_must_succeed_with_provider_key");
assert.equal(providerSecretWrites.length, 1, "portal_launch_service_must_write_provider_secret_once");
assert.equal(providerSecretWrites[0].ref, providerConfigResult.providerConfigSecretRef, "provider_secret_write_ref_must_match_provider_config_secret_ref");
assert.equal(providerSecretWrites[0].secret.apiKey, "service_level_gflabtoken_secret", "provider_secret_store_must_receive_plaintext_key_at_write_boundary");
assert.equal(adapterLaunchInput.providerKeyPayload.provider, "gflabtoken", "portal_launch_service_must_forward_provider_key_metadata_to_adapter");
assert.equal(adapterLaunchInput.providerKeyPayload.source, "user_input", "portal_launch_service_must_forward_provider_key_source_to_adapter");
assert.equal(typeof adapterLaunchInput.providerKeyPayload.apiKey, "undefined", "portal_launch_service_must_not_forward_plaintext_provider_key_to_adapter");

const adapterRequests = [];
globalThis.fetch = async (input, init = {}) => {
  adapterRequests.push({
    url: typeof input === "string" ? input : String(input.url || input),
    body: init.body ? JSON.parse(String(init.body)) : null,
  });
  return {
    ok: true,
    async json() {
      return {
        launchToken: "token-v21-adapter",
        launchId: "launch-v21-adapter",
        runtimeUrl: "https://github.com/gaofeng21cn/one-person-lab",
        oplWebUrl: "https://opl.example.test/?launch_token=token-v21-adapter",
      };
    },
  };
};

try {
  const adapterClient = createOplAdapterClient({
    adapterUrl: "http://127.0.0.1:18080",
    oplWebUrl: "https://opl.example.test",
    timeoutMs: 1_000,
    formatDateTime: (value) => value,
  });
  await adapterClient.createLaunch({
    user: { id: "user-v21-adapter", email: "adapter@example.test", name: "Adapter User", tenantId: "tenant-v21" },
    taskSpace: { slug: "scope-lab", title: "Scope Lab", path: "/workspace/scope-lab" },
    workspaceSession: { id: "workspace-session-v21-adapter", workspaceId: "scope-lab" },
    requireRealOplWeb: true,
    providerConfig: providerConfigResult.providerConfig,
    providerConfigSecretRef: providerConfigResult.providerConfigSecretRef,
    providerKeyPayload: {
      provider: "gflabtoken",
      source: "user_input",
      apiKey: "adapter_level_gflabtoken_secret",
    },
  });
} finally {
  globalThis.fetch = originalFetch;
}

assert.equal(adapterRequests.length, 1, "portal_adapter_must_issue_single_launch_request");
assert.equal(adapterRequests[0].body.providerKeyPayload.provider, "gflabtoken", "portal_adapter_request_must_preserve_provider_name");
assert.equal(adapterRequests[0].body.providerKeyPayload.source, "user_input", "portal_adapter_request_must_preserve_provider_source");
assert.equal(typeof adapterRequests[0].body.providerKeyPayload.apiKey, "undefined", "portal_adapter_request_must_not_forward_plaintext_provider_key");

console.log(JSON.stringify({
  ok: true,
  contract: "v21_gflabtoken_login_contract",
}, null, 2));
