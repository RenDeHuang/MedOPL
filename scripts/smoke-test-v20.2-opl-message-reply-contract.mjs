import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const runtimeUrl = "https://github.com/gaofeng21cn/one-person-lab";
const apiKey = ["gflab", "token_TEST", "VALUE_1234567890"].join("");

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: "",
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = "") {
      this.body += String(body || "");
    },
  };
}

function createRequest(method, path, body = "", headers = {}) {
  return {
    req: {
      method,
      headers,
      [Symbol.asyncIterator]: async function* iterator() {
        if (body) yield Buffer.from(body);
      },
    },
    res: createResponseRecorder(),
    url: new URL(path, "http://portal.local"),
  };
}

function createLaunchFixture(overrides = {}) {
  return {
    launchId: "launch-v20.2",
    launchToken: "launch-token-v20.2",
    oplWebUrl: "https://opl.example.test/?launch_token=launch-token-v20.2",
    runtimeSessionId: "runtime-session-v20.2",
    oplSessionId: "",
    runtimeUrl,
    ...overrides,
  };
}

function parseJsonBody(body = "") {
  return body ? JSON.parse(body) : {};
}

function parseRequestBody(body = "") {
  return body ? JSON.parse(String(body)) : null;
}

function recordAdapterRequest(input, init = {}) {
  const url = typeof input === "string" ? input : String(input);
  const request = {
    url,
    method: init.method || "GET",
    headers: init.headers || {},
    body: parseRequestBody(init.body || ""),
  };
  adapterRequests.push(request);
  return request;
}

function makeAdapterLaunchResponse() {
  return new Response(JSON.stringify(createLaunchFixture()), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function publicProviderConfigMeta(providerConfig) {
  if (!providerConfig) return null;
  return {
    providerName: providerConfig.providerName,
    configRef: providerConfig.providerConfigSecretRef,
    fingerprint: providerConfig.secretFingerprint,
  };
}

function sanitizedRouteCall(item) {
  return {
    taskSlug: item.taskSlug,
    source: item.source,
    sourceSurface: item.sourceSurface,
    providerKeyPayload: item.providerKeyPayload
      ? {
        provider: item.providerKeyPayload.provider,
        source: item.providerKeyPayload.source,
      }
      : null,
  };
}

function sanitizedLaunchResult(result) {
  if (!result?.launch) return null;
  return {
    launchId: result.launch.launchId,
    runtimeUrl: result.launch.runtimeUrl,
    providerKeyPayload: result.launch.providerKeyPayload || null,
  };
}

function sanitizedAdapterRequest(item) {
  return {
    url: item.url,
    method: item.method,
    body: item.body
      ? {
        sourceSurface: item.body.sourceSurface,
        runtimeUrl: item.body.runtimeUrl,
        providerKeyPayload: item.body.providerKeyPayload,
        providerConfigMeta: publicProviderConfigMeta(item.body.providerConfig),
        providerRef: item.body.providerConfigSecretRef || "",
      }
      : null,
  };
}

function buildSerializedLogs() {
  return JSON.stringify({
    routeCalls: routeCalls.map(sanitizedRouteCall),
    routeJsonResponses,
    launchInput: {
      sourceSurface: launchInput?.sourceSurface || "",
      providerKeyPayload: launchInput?.providerKeyPayload || null,
      providerConfigMeta: publicProviderConfigMeta(launchInput?.providerConfig),
      providerRef: launchInput?.providerConfigSecretRef || "",
    },
    launchResult: {
      launch: sanitizedLaunchResult(launchResult),
    },
    adapterRequests: adapterRequests.map(sanitizedAdapterRequest),
  });
}

const routeCalls = [];
const routeJsonResponses = [];

const { createOplRoutes } = await import("../services/portal/src/routes/opl.routes.mjs");
const routeHandler = createOplRoutes({
  appendCookie: () => {},
  layoutV2: (_title, body) => body,
  oplLaunchService: {
    async prepareLaunch(input) {
      routeCalls.push(input);
      return {
        ok: true,
        taskSpace: { slug: input.taskSlug, title: "Workspace", status: "active" },
        workspaceSession: { id: "workspace-session-v20.2", workspaceId: input.taskSlug },
        launch: createLaunchFixture(),
      };
    },
  },
  readBody: async (req) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
  },
  sendHtml: () => {},
  sendJson: (res, payload, status = 200) => {
    res.statusCode = status;
    res.body = JSON.stringify(payload);
    routeJsonResponses.push({ status, payload });
  },
  slugify: (value) => String(value || "").trim() || "default",
  workspaceSessionCookie: () => "workspace_session",
});

const routeRequest = createRequest(
  "POST",
  "/portal/api/opl/launch",
  JSON.stringify({
    task: "reply-lab",
    providerKey: {
      provider: "gflabtoken",
      source: "user_input",
      apiKey,
    },
  }),
  { "content-type": "application/json" }
);
const routeHandled = await routeHandler({
  ...routeRequest,
  db: { wallets: [] },
  user: { id: "user-v20.2", email: "reply@example.test", name: "Reply User", currentTaskSlug: "reply-lab" },
});
assert.equal(routeHandled, true, "opl_launch_route_must_handle_api_request");
assert.equal(routeCalls.length, 1, "opl_launch_route_must_call_prepare_launch");
assert.equal(routeCalls[0].source, "portal-api", "route_source_must_be_portal_api");
assert.equal(routeCalls[0].providerKeyPayload.provider, "gflabtoken", "route_must_pass_provider_key_provider");
assert.equal(routeCalls[0].providerKeyPayload.source, "user_input", "route_must_mark_provider_key_as_user_input");
assert.equal(routeCalls[0].providerKeyPayload.apiKey, apiKey, "route_must_forward_provider_key_to_launch_service");
const routeResponse = parseJsonBody(routeRequest.res.body);
assert.equal(routeResponse.ok, true, "opl_launch_route_must_succeed");
assert.equal(routeResponse.launch.runtimeUrl, runtimeUrl, "launch_response_must_keep_runtime_url");

const launchEvents = [];
let launchInput = null;
const providerSecretWrites = [];
const { createOplLaunchService, createGflabProviderConfig } = await import("../services/portal/src/services/opl-launch.service.mjs");
const { PORTAL_OPL_PROVIDER_SECRET_ROOT } = await import("../services/portal/src/config/portal-config.mjs");
assert.match(
  PORTAL_OPL_PROVIDER_SECRET_ROOT,
  /\.runtime\/portal-opl-adapter\/provider-secrets$/,
  "portal_default_provider_secret_root_must_match_adapter_shared_runtime",
);
const launchService = createOplLaunchService({
  evaluateUserPolicy: async () => ({ blocks: [], group: { id: "group-v20.2" } }),
  findTaskSpace: () => ({ slug: "reply-lab", title: "Reply Lab", status: "active", path: "/workspace/reply-lab" }),
  ensureTaskSpace: async () => {
    throw new Error("ensureTaskSpace_should_not_be_called");
  },
  ensureWorkspaceSession: async () => ({ id: "workspace-session-v20.2", workspaceId: "reply-lab" }),
  createOplLaunch: async (input) => {
    launchInput = input;
    return createLaunchFixture({
      providerKeyPayload: input.providerKeyPayload,
    });
  },
  providerSecretStore: {
    async writeProviderSecret(ref, secret) {
      providerSecretWrites.push({ ref, secret });
    },
  },
  resolveStorageEntitlement: () => ({ tier: "lab" }),
  defaultTaskTitle: (slug) => slug,
  logPortalEvent: async (event) => launchEvents.push(event),
  writeDb: async () => {},
});

const providerConfigResult = createGflabProviderConfig({
  userId: "user-v20.2",
  workspaceId: "reply-lab",
  apiKey,
});
assert.equal(providerConfigResult.ok, true, "provider_config_must_be_constructed");

const launchResult = await launchService.prepareLaunch({
  db: { wallets: [] },
  user: { id: "user-v20.2", email: "reply@example.test", name: "Reply User" },
  taskSlug: "reply-lab",
  requireRealOplWeb: true,
  source: "portal-api",
  providerConfig: providerConfigResult.providerConfig,
  providerConfigSecretRef: providerConfigResult.providerConfigSecretRef,
  providerKeyPayload: {
    provider: "gflabtoken",
    source: "user_input",
    apiKey,
  },
});

assert.equal(launchResult.ok, true, "launch_service_must_succeed");
assert.equal(launchInput.providerKeyPayload.provider, "gflabtoken", "launch_service_must_forward_provider_key_provider");
assert.equal(launchInput.providerKeyPayload.source, "user_input", "launch_service_must_forward_provider_key_source");
assert.equal(typeof launchInput.providerKeyPayload.apiKey, "undefined", "launch_service_must_not_forward_plaintext_provider_key");
assert.equal(launchInput.providerConfig.providerName, "gflab", "launch_service_must_translate_provider_key_into_provider_config");
assert.equal(Boolean(String(launchInput.providerConfigSecretRef || "").trim()), true, "launch_service_must_create_provider_secret_ref");
assert.equal(launchInput.providerConfig.providerConfigSecretRef, launchInput.providerConfigSecretRef, "launch_service_provider_config_must_match_secret_ref");
assert.equal(providerSecretWrites.length, 1, "launch_service_must_persist_provider_secret_once");
assert.equal(providerSecretWrites[0].ref, launchInput.providerConfigSecretRef, "provider_secret_ref_must_match_launch_ref");
assert.equal(providerSecretWrites[0].secret.provider, "gflabtoken", "provider_secret_provider_must_be_gflabtoken");
assert.equal(providerSecretWrites[0].secret.source, "user_input", "provider_secret_source_must_be_user_input");
assert.equal(providerSecretWrites[0].secret.apiKey, apiKey, "provider_secret_store_receives_plaintext_key_only_at_write_boundary");
assert.equal(launchResult.launch.runtimeUrl, runtimeUrl, "launch_service_must_return_runtime_url");
assert.equal(launchResult.launch.providerKeyPayload.provider, "gflabtoken", "launch_service_must_preserve_provider_payload_in_launch");
assert.equal(launchResult.launch.providerKeyPayload.source, "user_input", "launch_service_must_preserve_provider_source_in_launch");

const adapterRequests = [];
const { createOplAdapterClient } = await import("../services/portal/src/integrations/opl-adapter-client.mjs");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  recordAdapterRequest(input, init);
  return makeAdapterLaunchResponse();
};

try {
  const adapterClient = createOplAdapterClient({
    adapterUrl: "http://127.0.0.1:18793",
    oplWebUrl: "https://opl.example.test",
    timeoutMs: 1_000,
    formatDateTime: (value) => value,
  });

  const adapterLaunch = await adapterClient.createLaunch({
    user: { id: "user-v20.2", email: "reply@example.test", name: "Reply User", tenantId: "tenant-v20.2" },
    taskSpace: { slug: "reply-lab", title: "Reply Lab", path: "/workspace/reply-lab" },
    workspaceSession: { id: "workspace-session-v20.2", workspaceId: "reply-lab" },
    requireRealOplWeb: true,
    sourceSurface: "opl-web-native-message-reply",
    providerConfig: providerConfigResult.providerConfig,
    providerConfigSecretRef: providerConfigResult.providerConfigSecretRef,
    providerKeyPayload: {
      provider: "gflabtoken",
      source: "user_input",
      apiKey,
    },
  });

  assert.equal(adapterLaunch.runtimeUrl, runtimeUrl, "adapter_launch_must_keep_runtime_url");
  assert.equal(adapterRequests.length, 1, "adapter_must_issue_single_launch_request");
  assert.equal(adapterRequests[0].body.providerKeyPayload.provider, "gflabtoken", "adapter_request_must_include_provider_key_provider");
  assert.equal(adapterRequests[0].body.providerKeyPayload.source, "user_input", "adapter_request_must_include_provider_key_source");
  assert.equal(typeof adapterRequests[0].body.providerKeyPayload.apiKey, "undefined", "adapter_request_must_not_include_plaintext_provider_key");
  assert.equal(adapterRequests[0].body.sourceSurface, "opl-web-native-message-reply", "adapter_request_must_mark_message_reply_surface");
} finally {
  globalThis.fetch = originalFetch;
}

const serializedLogs = buildSerializedLogs();

assert.doesNotMatch(serializedLogs, /sk-|gflabtoken_[A-Za-z0-9]|AKID|SECRET/i, "logs_must_not_contain_plaintext_api_key");
assert.equal(launchResult.launch.runtimeUrl, "https://github.com/gaofeng21cn/one-person-lab", "launch_contract_runtime_url_must_match_upstream_repo");

const secretRoot = await mkdtemp(path.join(os.tmpdir(), "opl-provider-secret-store-"));
try {
  const { createProviderSecretStore } = await import("../services/portal/src/domain/provider-secret-store.mjs");
  const store = createProviderSecretStore({ root: secretRoot });
  await store.writeProviderSecret("gflab-secret-contract", {
    provider: "gflabtoken",
    source: "user_input",
    apiKey,
  });
  const stored = await store.readProviderSecret("gflab-secret-contract");
  assert.equal(stored.apiKey, apiKey, "provider_secret_store_must_roundtrip_api_key_by_ref");
  assert.equal(stored.provider, "gflabtoken", "provider_secret_store_must_keep_provider");
  assert.equal(stored.source, "user_input", "provider_secret_store_must_keep_source");
} finally {
  await rm(secretRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  checked: [
    "provider_key_provider_gflabtoken",
    "provider_key_source_user_input",
    "provider_secret_store_ref_roundtrip",
    "secret_redaction",
    "runtime_url_contract",
    "message_reply_source_surface",
  ],
}, null, 2));
