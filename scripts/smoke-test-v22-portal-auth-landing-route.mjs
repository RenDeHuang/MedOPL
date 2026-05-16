import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authRuntimeSource = await readFile("services/portal/src/app/portal-auth-runtime-handler.mjs", "utf8");
const routerSource = await readFile("services/portal/frontend/src/router/index.ts", "utf8");

assert(
  authRuntimeSource.includes('"/overview"'),
  "portal_auth_success_landing_must_target_overview",
);

assert(
  !authRuntimeSource.includes('"/portal/app/overview"'),
  "portal_auth_success_redirect_must_not_target_internal_portal_app_path",
);

assert(
  routerSource.includes("createWebHistory()"),
  "portal_frontend_history_base_must_be_top_level",
);

assert(
  !routerSource.includes('{ path: "/portal", redirect: "/overview" }'),
  "portal_frontend_must_not_alias_legacy_inner_portal_route_to_overview",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_auth_landing_route",
  loginSuccessLocation: "/overview",
  canonicalRouteRoot: "/",
}, null, 2));
