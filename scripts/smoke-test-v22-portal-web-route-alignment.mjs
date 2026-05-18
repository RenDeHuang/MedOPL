import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { retiredFrontendRoutes as retiredCoreFrontendRoutes } from "./smoke-test-v22-portal-retired-frontend-surface-gate.mjs";

const routesSource = await readFile("services/portal/frontend/src/app/routes.tsx", "utf8");
const layoutSource = await readFile("services/portal/frontend/src/app/components/Layout.tsx", "utf8");
const dispatcherSource = await readFile("services/portal/src/app/portal-http-dispatcher.mjs", "utf8");
const viteSource = await readFile("services/portal/frontend/vite.config.ts", "utf8");
const authSource = await readFile("services/portal/src/app/portal-auth-runtime-handler.mjs", "utf8");
const figmaContract = await readFile("docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md", "utf8");

const requiredRoutes = ["/overview", "/resources", "/workspace", "/trace", "/billing", "/opl-launch"];
const requiredAdminRoutes = [
  "/admin/dashboard",
  "/admin/users",
  "/admin/alerts",
  "/admin/billing-ops",
  "/admin/audit",
  "/admin/system",
  "/admin/ops",
];
const retiredFrontendRoutes = [...new Set([
  ...retiredCoreFrontendRoutes,
  "/admin/usage",
  "/admin/trace",
  "/admin/user",
  "/admin/groups",
  "/admin/workspace",
  "/admin/run",
  "/admin/sandboxes",
])];

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function assertRoutePathAbsent(source, route, label) {
  assert.equal(
    source.includes(`path: "${route.slice(1)}"`),
    false,
    `${label}_must_not_include_route:${route}`,
  );
  assert.equal(
    source.includes(`path: "${route}"`),
    false,
    `${label}_must_not_include_nav_route:${route}`,
  );
}

for (const route of requiredRoutes) {
  assertIncludes(routesSource, `path: "${route.slice(1)}"`, `portal_frontend_route_missing:${route}`);
  assertIncludes(dispatcherSource, `"${route}"`, `portal_dispatcher_shell_route_missing:${route}`);
}
for (const route of requiredAdminRoutes) {
  assertIncludes(routesSource, `path: "${route.slice(1)}"`, `portal_frontend_admin_route_missing:${route}`);
  assertIncludes(dispatcherSource, `"${route}"`, `portal_dispatcher_admin_shell_route_missing:${route}`);
}

for (const route of requiredRoutes) {
  assertIncludes(layoutSource, `path: "${route}"`, `portal_nav_route_missing:${route}`);
}
for (const route of requiredAdminRoutes) {
  assertIncludes(layoutSource, `path: "${route}"`, `portal_admin_nav_route_missing:${route}`);
}

for (const label of ["总览", "运行环境", "工作空间", "任务与结果", "账单与审计", "进入 OPL"]) {
  assertIncludes(layoutSource, `name: "${label}"`, `portal_nav_label_missing:${label}`);
}

for (const route of retiredFrontendRoutes) {
  assertRoutePathAbsent(routesSource, route, `portal_frontend_retired_route:${route}`);
  assertRoutePathAbsent(layoutSource, route, `portal_nav_retired_route:${route}`);
}

for (const proxyPrefix of [
  '"/portal/api"',
  '"/portal/billing"',
  '"/portal/workspace-session"',
  '"/portal/workspaces"',
  '"/portal/admin"',
  '"/login"',
  '"/register"',
  '"/logout"',
  '"/auth"',
  '"/opl/entry/preflight"',
]) {
  assertIncludes(viteSource, proxyPrefix, `portal_vite_proxy_missing:${proxyPrefix}`);
}

assertIncludes(routesSource, "createBrowserRouter", "portal_router_must_be_react_router");
assertIncludes(routesSource, 'from "react-router"', "portal_router_must_use_zip_react_router");
assertExcludes(routesSource, "react-router-dom", "portal_router_must_not_use_react_router_dom");
assertExcludes(routesSource, "vue-router", "portal_router_must_not_use_vue_router");
assertIncludes(authSource, 'const PORTAL_AUTH_SUCCESS_LOCATION = "/overview"', "portal_auth_success_location_must_be_overview");
assertIncludes(figmaContract, '"currentCoverage": "user_portal_and_admin_portal"', "figma_contract_must_keep_user_admin_coverage");
assertIncludes(figmaContract, '"activeAdminRouteMounted": true', "figma_contract_must_require_active_admin_mount");
assertIncludes(figmaContract, '"roleContextSecurityBoundary": false', "figma_contract_must_keep_role_context_non_security_boundary");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_web_route_alignment",
  router: "react-router",
  canonicalLanding: "/overview",
  checkedRoutes: requiredRoutes,
  checkedAdminRoutes: requiredAdminRoutes,
  retiredFrontendRoutes,
}, null, 2));
