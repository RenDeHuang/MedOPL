import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authRuntimeSource = await readFile("services/portal/src/app/portal-auth-runtime-handler.mjs", "utf8");
const routesSource = await readFile("services/portal/frontend/src/app/routes.tsx", "utf8");

assert(
  authRuntimeSource.includes('"/overview"'),
  "portal_auth_success_landing_must_target_overview",
);

assert(
  !authRuntimeSource.includes('"/portal/app/overview"'),
  "portal_auth_success_redirect_must_not_target_internal_portal_app_path",
);

assert(
  routesSource.includes("createBrowserRouter"),
  "portal_frontend_router_must_use_react_browser_router",
);

assert(
  routesSource.includes('from "react-router"'),
  "portal_frontend_router_must_use_zip_react_router",
);

assert(
  !routesSource.includes("react-router-dom"),
  "portal_frontend_router_must_not_use_react_router_dom",
);

assert(
  !routesSource.includes('{ path: "/portal", redirect: "/overview" }'),
  "portal_frontend_must_not_alias_legacy_inner_portal_route_to_overview",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_auth_landing_route",
  loginSuccessLocation: "/overview",
  canonicalRouteRoot: "/",
}, null, 2));
