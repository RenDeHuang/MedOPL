import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routerSource = await readFile("services/portal/frontend/src/router/index.ts", "utf8");
const sidebarSource = await readFile("services/portal/frontend/src/layouts/AppSidebar.vue", "utf8");
const legacyRedirectSource = await readFile("services/portal/src/routes/portal-legacy-redirect.routes.mjs", "utf8");
const viteSource = await readFile("services/portal/frontend/vite.config.ts", "utf8");
const authSource = await readFile("services/portal/src/app/portal-auth-runtime-handler.mjs", "utf8");

const requiredRoutes = [
  "/overview",
  "/packages",
  "/resources",
  "/workspace",
  "/billing",
  "/trace",
  "/admin/dashboard",
  "/admin/billing-ops",
  "/admin/usage",
  "/admin/users",
  "/admin/system",
];

for (const route of requiredRoutes) {
  assert(
    routerSource.includes(`path: "${route}"`) || routerSource.includes(`to: "${route}"`),
    `portal_frontend_route_missing:${route}`,
  );
}

for (const route of ["/overview", "/packages", "/resources", "/workspace", "/billing", "/trace"]) {
  assert(sidebarSource.includes(`to: "${route}"`), `portal_sidebar_route_missing:${route}`);
}

for (const redirect of [
  '["/portal", "/portal/app/overview"]',
  '["/portal/billing", "/portal/app/billing"]',
  '["/portal/servers", "/portal/app/resources"]',
  '["/portal/workspace", "/portal/app/workspace"]',
  '["/portal/admin", "/portal/app/admin/dashboard"]',
]) {
  assert(legacyRedirectSource.includes(redirect), `portal_legacy_redirect_missing:${redirect}`);
}

for (const proxyPrefix of [
  '"/portal/api"',
  '"/portal/workspace-session"',
  '"/portal/tasks"',
  '"/portal/admin"',
  '"/login"',
  '"/register"',
  '"/logout"',
  '"/auth"',
  '"/opl/entry/preflight"',
]) {
  assert(viteSource.includes(proxyPrefix), `portal_vite_proxy_missing:${proxyPrefix}`);
}

assert(routerSource.includes('createWebHistory("/portal/app/")'), "portal_router_base_must_be_portal_app");
assert(routerSource.includes('{ path: "/portal", redirect: "/overview" }'), "portal_router_must_absorb_legacy_inner_portal_path");
assert(authSource.includes('const PORTAL_AUTH_SUCCESS_LOCATION = "/portal/app/overview"'), "portal_auth_success_location_must_be_canonical_app_route");
assert.equal(authSource.includes('Location: "/portal"'), false, "portal_auth_must_not_redirect_success_to_legacy_portal_shell");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_web_route_alignment",
  routerBase: "/portal/app/",
  canonicalLanding: "/portal/app/overview",
  checkedRoutes: requiredRoutes,
}, null, 2));
