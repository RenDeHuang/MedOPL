import assert from "node:assert/strict";
import {
  PORTAL_MODULE_SOURCE_BUILD_TAG,
  listPortalRequiredModuleSourcePayloads,
} from "../services/portal/src/app/portal-module-source-payloads.mjs";

const moduleSources = listPortalRequiredModuleSourcePayloads();
assert(moduleSources.length >= 6, "portal_required_module_sources_must_cover_core_nav");

for (const item of moduleSources) {
  assert.equal(typeof item.moduleSource, "string", "module_source_must_be_string");
  assert.equal(typeof item.apiSource, "string", "api_source_must_be_string");
  assert.equal(typeof item.capability, "string", "capability_must_be_string");
  assert.equal(item.buildTag, PORTAL_MODULE_SOURCE_BUILD_TAG, "build_tag_must_match_v20_3");
  assert(item.moduleSource.length > 0, "module_source_must_not_be_empty");
  assert(item.apiSource.startsWith("/portal/api/"), "api_source_must_point_to_portal_api");
  assert(item.capability.length > 0, "capability_must_not_be_empty");
}

console.log(JSON.stringify({
  ok: true,
  suite: "v20.3_portal_module_wiring_contract",
  buildTag: PORTAL_MODULE_SOURCE_BUILD_TAG,
  moduleSourceCount: moduleSources.length,
}, null, 2));
