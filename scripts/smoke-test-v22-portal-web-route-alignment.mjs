import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routerSource = await readFile("services/portal/frontend/src/router/index.ts", "utf8");
const sidebarSource = await readFile("services/portal/frontend/src/layouts/AppSidebar.vue", "utf8");
const legacyRedirectSource = await readFile("services/portal/src/routes/portal-legacy-redirect.routes.mjs", "utf8");
const viteSource = await readFile("services/portal/frontend/vite.config.ts", "utf8");
const authSource = await readFile("services/portal/src/app/portal-auth-runtime-handler.mjs", "utf8");

const requiredRoutes = [
  "/home",
  "/login",
  "/register",
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
  "/admin/audit",
];

for (const route of requiredRoutes) {
  assert(
    routerSource.includes(`path: "${route}"`) || routerSource.includes(`to: "${route}"`),
    `portal_frontend_route_missing:${route}`,
  );
}

for (const route of ["/overview", "/resources", "/workspace", "/billing", "/trace"]) {
  assert(sidebarSource.includes(`to: "${route}"`), `portal_sidebar_route_missing:${route}`);
}

for (const label of ["总览", "计算资源", "任务执行", "文件空间", "账务", "平台总览", "客户账户", "资源管理", "任务记录", "账务管理", "审计记录", "站点设置"]) {
  assert(sidebarSource.includes(`label: "${label}"`), `portal_sidebar_label_missing:${label}`);
}

for (const redirect of [
  '["/portal", "/overview"]',
  '["/portal/billing", "/billing"]',
  '["/portal/servers", "/resources"]',
  '["/portal/workspace", "/workspace"]',
  '["/portal/admin", "/admin/dashboard"]',
  '["/portal/app/overview", "/overview"]',
  '["/portal/app/admin/system", "/admin/system"]',
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

assert(routerSource.includes("createWebHistory()"), "portal_router_base_must_be_top_level");
assert(routerSource.includes('{ path: "/portal", redirect: "/overview" }'), "portal_router_must_absorb_legacy_inner_portal_path");
assert(authSource.includes('const PORTAL_AUTH_SUCCESS_LOCATION = "/overview"'), "portal_auth_success_location_must_be_overview");
assert.equal(authSource.includes('const PORTAL_AUTH_SUCCESS_LOCATION = "/portal/app/overview"'), false, "portal_auth_must_not_redirect_success_to_internal_portal_app");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_web_route_alignment",
  routerBase: "/",
  canonicalLanding: "/overview",
  checkedRoutes: requiredRoutes,
}, null, 2));
