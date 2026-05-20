import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("services/portal/frontend/vite.config.ts", "utf8");

for (const route of [
  '"/portal/billing"',
  '"/login"',
  '"/register"',
  '"/logout"',
  '"/auth"',
  '"/opl/entry/preflight"',
]) {
  assert(
    source.includes(route),
    `portal_vite_dev_proxy_missing:${route}`,
  );
}

assert(source.includes("http://127.0.0.1:17080"), "portal_vite_dev_proxy_target_must_be_local_backend");
assert(source.includes("VITE_PORTAL_BACKEND_URL"), "portal_vite_dev_proxy_must_allow_isolated_backend_target");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_dev_server_auth_proxy",
  target: "http://127.0.0.1:17080",
  isolatedOverride: "VITE_PORTAL_BACKEND_URL",
}, null, 2));
