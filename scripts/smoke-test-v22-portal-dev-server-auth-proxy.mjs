import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("services/portal/frontend/vite.config.ts", "utf8");

for (const route of [
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

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_dev_server_auth_proxy",
  target: "http://127.0.0.1:17080",
}, null, 2));
