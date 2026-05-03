import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const runtimeSource = await readFile("services/portal/src/app/portal-runtime.mjs", "utf8");
const callStart = runtimeSource.indexOf("createPortalRuntimeRouteWiring({");
assert.notEqual(callStart, -1, "portal_runtime_must_call_route_wiring_factory");

const callEnd = runtimeSource.indexOf("});", callStart);
assert.notEqual(callEnd, -1, "portal_runtime_route_wiring_call_must_be_closed");

const callBody = runtimeSource.slice(callStart, callEnd);
assert.match(callBody, /\brunZitadelAdminUser\b/, "portal_runtime_must_pass_identity_sync_runner_to_route_wiring");

console.log(JSON.stringify({
  ok: true,
  contract: "portal_runtime_route_wiring",
}, null, 2));
