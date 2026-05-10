import assert from "node:assert/strict";

const config = await import("../services/portal/src/config/portal-config.mjs");
const store = await import("../services/portal/src/state/portal-store.mjs");

for (const name of [
  "RETIRED_COST_UI_URL",
  "RETIRED_REGISTRY_URL",
  "RETIRED_STORAGE_API_URL",
  "RETIRED_STORAGE_CONSOLE_URL",
]) {
  assert.equal(typeof config[name], "string", `${name}_must_be_exported_as_string`);
}

assert.equal(typeof store.createPortalStore, "function", "portal_store_must_import_without_runtime_config_errors");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_runtime_startup_config",
  retiredLinks: {
    cost: config.RETIRED_COST_UI_URL,
    registry: config.RETIRED_REGISTRY_URL,
    storageApi: config.RETIRED_STORAGE_API_URL,
    storageConsole: config.RETIRED_STORAGE_CONSOLE_URL,
  },
}, null, 2));
