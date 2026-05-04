import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_PORTAL_PAGES as V20_31_REQUIRED_PORTAL_PAGES } from "./smoke-test-v20.31-portal-module-wiring-contract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function read(relPath) {
  return readFileSync(path.join(repoRoot, relPath), "utf8");
}

function extractQuotedValues(source, name) {
  const marker = `const ${name} = [`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name}_must_exist`);
  const end = source.indexOf("];", start);
  assert.notEqual(end, -1, `${name}_must_be_array_literal`);
  return Array.from(source.slice(start, end).matchAll(/to:\s*"([^"]+)"/g)).map((match) => match[1]);
}

function stripPortalAppPrefix(route) {
  assert(route.startsWith("/portal/app/"), `route_must_be_portal_app:${route}`);
  return route.slice("/portal/app".length);
}

const routerSource = read("services/portal/frontend/src/router/index.ts");
const sidebarSource = read("services/portal/frontend/src/layouts/AppSidebar.vue");
const legacyRedirectSource = read("services/portal/src/routes/portal-legacy-redirect.routes.mjs");

const routerPaths = new Set(Array.from(routerSource.matchAll(/path:\s*"([^"]+)"/g)).map((match) => match[1]));
const sidebarUserRoutes = extractQuotedValues(sidebarSource, "userItems");
const sidebarAdminRoutes = extractQuotedValues(sidebarSource, "adminItems");
const requiredRoutes = V20_31_REQUIRED_PORTAL_PAGES.map((page) => stripPortalAppPrefix(page.route));

for (const route of requiredRoutes) {
  assert(routerPaths.has(route), `required_route_missing_from_router:${route}`);
}

assert.deepEqual(
  requiredRoutes.filter((route) => !route.startsWith("/admin/")),
  sidebarUserRoutes,
  "required_user_routes_must_match_sidebar_order",
);

assert.deepEqual(
  requiredRoutes.filter((route) => route.startsWith("/admin/")),
  sidebarAdminRoutes,
  "required_admin_routes_must_match_sidebar_order",
);

assert(!requiredRoutes.includes("/admin/customer-accounting"), "old_admin_customer_accounting_route_must_not_be_required");
assert(!requiredRoutes.includes("/admin/cloud-resources"), "old_admin_cloud_resources_route_must_not_be_required");
assert(!requiredRoutes.includes("/admin/pending-actions"), "old_admin_pending_actions_route_must_not_be_required");
assert(requiredRoutes.includes("/resources"), "resources_route_must_be_part_of_commercial_loop");
assert(
  legacyRedirectSource.includes('["/portal/servers", "/portal/app/resources"]'),
  "legacy_portal_servers_must_redirect_to_resources",
);
assert(
  !legacyRedirectSource.includes('["/portal/servers", "/portal/app/servers"]'),
  "legacy_portal_servers_must_not_redirect_to_removed_servers_route",
);

console.log(JSON.stringify({
  ok: true,
  suite: "v20.32_portal_routing_inheritance_contract",
  userRouteCount: sidebarUserRoutes.length,
  adminRouteCount: sidebarAdminRoutes.length,
}, null, 2));
