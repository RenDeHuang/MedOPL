import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("services/portal/frontend/vite.config.ts", "utf8");

for (const marker of [
  "goControlPlaneTarget",
  '"/api": goControlPlaneTarget',
  "http://127.0.0.1:8789",
  "VITE_MEDOPL_GO_BACKEND_URL",
]) {
  assert(
    source.includes(marker),
    `portal_vite_dev_proxy_missing:${marker}`,
  );
}

for (const retiredNodePortalProxy of [
  "VITE_PORTAL_BACKEND_URL",
  '"/portal/billing"',
  '"/login"',
  '"/register"',
  '"/logout"',
  '"/auth"',
  '"/opl/entry/preflight"',
]) {
  assert.equal(
    source.includes(retiredNodePortalProxy),
    false,
    `portal_vite_dev_proxy_must_not_restore_node_portal:${retiredNodePortalProxy}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_dev_server_go_control_plane_proxy",
  target: "http://127.0.0.1:8789",
  isolatedOverride: "VITE_MEDOPL_GO_BACKEND_URL",
}, null, 2));
