import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  oplEntrySource,
  oplApiSource,
  adapterSource,
] = await Promise.all([
  readFile("services/portal/frontend/src/app/pages/OPLEntry.tsx", "utf8"),
  readFile("services/portal/frontend/src/api/portal/opl.ts", "utf8"),
  readFile("services/portal/frontend/src/app/data/portalAdapters.ts", "utf8"),
]);

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

assertIncludes(oplApiSource, "bindProviderKeyForOplEntry", "opl_api_must_expose_go_provider_key_binding_action");
assertIncludes(oplApiSource, "goControlPlaneClient.post", "opl_api_provider_key_binding_must_use_go_control_plane_client");
assertIncludes(oplApiSource, '"/v22/provider-key"', "opl_api_provider_key_binding_must_call_go_v22_provider_key");

assertIncludes(oplEntrySource, "bindProviderKeyForOplEntry", "opl_entry_must_import_provider_key_binding_action");
assertIncludes(oplEntrySource, "providerKeyInput", "opl_entry_must_keep_provider_key_as_one_time_input_state");
assertIncludes(oplEntrySource, "handleProviderKeyBind", "opl_entry_must_have_explicit_provider_key_bind_handler");
assertIncludes(oplEntrySource, "type=\"password\"", "opl_entry_provider_key_input_must_be_password_field");
assertIncludes(oplEntrySource, "绑定后进入 OPL", "opl_entry_provider_key_cta_must_be_visible");
assertIncludes(oplEntrySource, "window.location.reload()", "opl_entry_must_reload_projection_after_provider_key_bind");
assertIncludes(adapterSource, "providerBound: status.providerBound", "opl_entry_adapter_must_still_forward_go_provider_bound");

for (const forbidden of [
  "localStorage",
  "sessionStorage",
  "document.cookie",
  "URLSearchParams(providerKeyInput",
  "launchToken",
  "runtimeToken",
  "bearerToken",
]) {
  assertExcludes(oplEntrySource, forbidden, "opl_entry_provider_key_ui_must_not_persist_or_expose_secret");
}

console.log(JSON.stringify({
  ok: true,
  regression: "v22_opl_entry_provider_key_go_local_rc_ui",
  canClaim: "OPL entry has a one-time Go control-plane provider key binding action for local RC testing.",
  cannotClaim: "This does not prove live provider, real cloud, production secret storage, deploy, kubectl or production OPL runtime.",
}, null, 2));
