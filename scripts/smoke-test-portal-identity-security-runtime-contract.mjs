import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const runtimeSource = await readFile("services/portal/src/app/portal-runtime.mjs", "utf8");
const identitySource = await readFile("services/portal/src/app/portal-identity-security-runtime.mjs", "utf8");

assert.match(runtimeSource, /from "\.\/portal-identity-security-runtime\.mjs"/, "portal_runtime_must_import_identity_security_runtime");
assert.match(runtimeSource, /createPortalIdentitySecurityRuntime\(/, "portal_runtime_must_create_identity_security_runtime");
assert.doesNotMatch(runtimeSource, /async function runZitadelAdminUser\b/, "portal_runtime_must_not_inline_zitadel_admin_runner");
assert.doesNotMatch(runtimeSource, /async function exchangeOidcCode\b/, "portal_runtime_must_not_inline_oidc_token_exchange");
assert.doesNotMatch(runtimeSource, /async function fetchOidcUserInfo\b/, "portal_runtime_must_not_inline_oidc_userinfo_fetch");
assert.doesNotMatch(runtimeSource, /function securityConfigSummary\b/, "portal_runtime_must_not_inline_security_summary");

assert.match(identitySource, /export function createPortalIdentitySecurityRuntime\(/, "identity_runtime_must_export_factory");
assert.match(identitySource, /async function runZitadelAdminUser\b/, "identity_runtime_must_own_zitadel_admin_runner");
assert.match(identitySource, /async function exchangeOidcCode\b/, "identity_runtime_must_own_oidc_token_exchange");
assert.match(identitySource, /async function fetchOidcUserInfo\b/, "identity_runtime_must_own_oidc_userinfo_fetch");
assert.match(identitySource, /function securityConfigSummary\b/, "identity_runtime_must_own_security_summary");

const { createPortalIdentitySecurityRuntime } = await import("../services/portal/src/app/portal-identity-security-runtime.mjs");

const calls = [];
const runtime = createPortalIdentitySecurityRuntime({
  env: {
    adminSeed: { password: "changed-password" },
    HARBOR_PASSWORD: "changed-harbor",
    PORTAL_IDENTITY_SYNC_MODE: "local",
    PORTAL_OIDC_CLIENT_ID: "client-id",
    PORTAL_OIDC_CLIENT_SECRET: "client-secret",
    PORTAL_OIDC_ISSUER: "https://issuer.example",
    PORTAL_OIDC_REDIRECT_URI: "https://portal.example/callback",
    PORTAL_OIDC_SCOPE: "openid email profile",
    ZITADEL_ADMIN_USER_SCRIPT: "/tmp/zitadel-admin.mjs",
  },
  deps: {
    access: async () => {},
    execFileAsync: async (...args) => {
      calls.push(args);
      return { stdout: "{}" };
    },
    repoRoot: "/repo",
  },
});

const localSync = await runtime.runZitadelAdminUser(["create-user"]);
assert.deepEqual(localSync, { synced: false, source: "portal_local_identity" }, "local_identity_mode_must_skip_zitadel_runner");
const summary = runtime.buildAdminSecuritySummary();
assert.equal(summary.healthy, false, "summary_must_report_missing_jwt_refresh_secret");
assert.ok(summary.checks.some((item) => item.key === "JWT_REFRESH_SECRET"), "summary_must_include_jwt_refresh_secret_check");
assert.equal(calls.length, 0, "local_identity_mode_must_not_execute_admin_script");

console.log(JSON.stringify({
  ok: true,
  contract: "portal_identity_security_runtime",
}, null, 2));
