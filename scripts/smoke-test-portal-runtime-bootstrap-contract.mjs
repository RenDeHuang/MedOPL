import assert from "node:assert/strict";

const { createPortalRuntimeBootstrap } = await import("../services/portal/src/app/portal-runtime-bootstrap.mjs");

const bootstrap = createPortalRuntimeBootstrap({
  layout: {
    safeJsonForHtml: (value) => JSON.stringify(value).replaceAll("<", "\\u003c"),
    userTheme: () => "light",
  },
  store: {
    atomicWriteJson: async () => {},
    exists: async () => false,
    getTaskPath: (userId, taskSlug) => `/tmp/${userId}/${taskSlug}`,
    sanitizeTaskTitle: (_slug, title) => String(title || "Default Task"),
  },
  clients: {
    billingServiceUrl: "http://127.0.0.1:1",
    billingTimeoutMs: 1000,
    formatDateTime: (value) => String(value || ""),
    harborApiUrl: "",
    harborPassword: "",
    harborUsername: "",
    langfuseProjectId: "",
    langfusePublicKey: "",
    langfuseSecretKey: "",
    langfuseUrl: "",
    mcBinary: "",
    minioApiUrl: "",
    oplRuntimeTimeoutMs: 1000,
    oplWebUrl: "http://127.0.0.1:1",
    portalOplAdapterUrl: "http://127.0.0.1:1",
    portalWorkdir: "/tmp",
    provisionerTimeoutMs: 1000,
    provisionerUrl: "http://127.0.0.1:1",
    repoRoot: "/tmp",
    syncWorkspaceToMinioScriptRelative: "scripts/sync.mjs",
  },
});

assert.equal(typeof bootstrap.layoutV2, "function", "bootstrap_must_expose_layout_v2");
assert.equal(typeof bootstrap.portalStore.readDb, "function", "bootstrap_must_expose_portal_store");
assert.equal(typeof bootstrap.clients.billingClient.fetchStatus, "function", "bootstrap_must_expose_billing_client");
assert.equal(typeof bootstrap.createOplLaunchService, "function", "bootstrap_must_expose_opl_launch_service_factory");
assert.equal(typeof bootstrap.createFeatureRuntimeHandlers, "function", "bootstrap_must_expose_feature_route_factory");
assert.equal(typeof bootstrap.createApiRuntimeHandlers, "function", "bootstrap_must_expose_api_route_factory");

console.log(JSON.stringify({
  ok: true,
  contract: "portal_runtime_bootstrap",
}, null, 2));
