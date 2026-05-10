import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const contractPath = "docs/contracts/v22-portal-structure-failure-isolation-boundary.md";
const readmePath = "docs/contracts/README.md";

const CONTRACT_START = "<!-- v22-portal-structure-failure-isolation-contract:start -->";
const CONTRACT_END = "<!-- v22-portal-structure-failure-isolation-contract:end -->";

function extractContractJson(markdown) {
  const startIndex = markdown.indexOf(CONTRACT_START);
  assert.notEqual(startIndex, -1, "portal_structure_contract_start_marker_missing");

  const contentStart = startIndex + CONTRACT_START.length;
  const endIndex = markdown.indexOf(CONTRACT_END, contentStart);
  assert.notEqual(endIndex, -1, "portal_structure_contract_end_marker_missing");
  assert.equal(markdown.indexOf(CONTRACT_START, contentStart), -1, "portal_structure_contract_start_marker_must_be_unique");
  assert.equal(markdown.indexOf(CONTRACT_END, endIndex + CONTRACT_END.length), -1, "portal_structure_contract_end_marker_must_be_unique");

  const block = markdown.slice(contentStart, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, "portal_structure_contract_must_be_a_single_json_fence");

  return JSON.parse(match[1]);
}

function assertIncludesAll(actualItems, expectedItems, label) {
  for (const expected of expectedItems) {
    assert(actualItems.includes(expected), `${label}_missing:${expected}`);
  }
}

const markdown = await readFile(path.join(repoRoot, contractPath), "utf8");
const readme = await readFile(path.join(repoRoot, readmePath), "utf8");
const contract = extractContractJson(markdown);

assert.equal(contract.contract, "v22_portal_structure_failure_isolation_boundary", "portal_structure_contract_name_mismatch");
assert.equal(contract.version, 1, "portal_structure_contract_version_mismatch");
assert.equal(contract.level, "tier_3_structure_governance", "portal_structure_contract_level_mismatch");
assert.equal(contract.scope, "portal_only", "portal_structure_contract_scope_mismatch");
assert.equal(contract.definesProductNarrative, false, "portal_structure_must_not_define_product_narrative");
assert.equal(contract.replacesRoleSurfaceContracts, false, "portal_structure_must_not_replace_role_surface_contracts");
assert.equal(contract.callsRealCloud, false, "portal_structure_must_not_call_real_cloud");
assert.equal(contract.readsSecrets, false, "portal_structure_must_not_read_secrets");
assert.equal(contract.modifiesOplGateway, false, "portal_structure_must_not_modify_opl_gateway");
assert.equal(contract.modifiesRuntimeBridge, false, "portal_structure_must_not_modify_runtime_bridge");
assert.equal(contract.modifiesDeploy, false, "portal_structure_must_not_modify_deploy");
assert.equal(contract.modifiesUpstream, false, "portal_structure_must_not_modify_upstream");

assertIncludesAll(contract.requiredSurfaces, [
  "backend_routes_dispatcher",
  "payload_dto_builders",
  "frontend_views_composables",
  "frontend_api_modules",
  "portal_smoke_layers",
], "portal_structure_required_surface");

assertIncludesAll(contract.backendRoutesDispatcher.routeGroups, [
  "user",
  "admin",
  "ops",
  "billing",
  "workspace",
  "packages",
  "resources",
  "trace",
], "portal_structure_backend_route_group");
assertIncludesAll(contract.backendRoutesDispatcher.handlerResponsibilities, [
  "auth",
  "role",
  "request_parsing",
  "service_or_store_call",
  "dto_response",
], "portal_structure_handler_responsibility");
assertIncludesAll(contract.backendRoutesDispatcher.forbiddenResponsibilities, [
  "cloud_create_release_implementation",
  "opl_runtime_implementation",
  "secret_reading",
  "raw_provider_key_handling",
], "portal_structure_backend_forbidden_responsibility");

assertIncludesAll(contract.payloadDtoBuilders.builderFamilies, [
  "overview",
  "users",
  "groups",
  "billing",
  "system",
  "ops",
  "audit",
  "packages",
  "workspace",
  "resources",
], "portal_structure_payload_builder_family");
assert.equal(contract.payloadDtoBuilders.pureBuildersOnly, true, "portal_structure_payload_builders_must_be_pure");
assertIncludesAll(contract.payloadDtoBuilders.forbiddenBuilderEffects, [
  "io",
  "secret_reading",
  "external_service_call",
  "role_authorization",
], "portal_structure_payload_builder_forbidden_effect");

assertIncludesAll(contract.frontendViewsComposables.viewResponsibilities, [
  "template",
  "local_wiring",
], "portal_structure_frontend_view_responsibility");
assertIncludesAll(contract.frontendViewsComposables.composableResponsibilities, [
  "query_state",
  "loader",
  "formatter",
  "action_handler",
], "portal_structure_frontend_composable_responsibility");
assert.equal(contract.frontendViewsComposables.roleStateLeakageAllowed, false, "portal_structure_must_not_allow_role_state_leakage");

assert.equal(contract.frontendApiModules.usesLargePortalBarrelAsPageDefault, false, "portal_structure_must_not_default_to_large_api_barrel");
assertIncludesAll(contract.frontendApiModules.domainModules, [
  "billing",
  "packages",
  "workspace",
  "resources",
  "trace",
  "admin/users",
  "admin/system",
  "ops",
], "portal_structure_frontend_api_domain_module");
assert.equal(contract.frontendApiModules.carriesBusinessDecisions, false, "portal_structure_frontend_api_must_not_carry_business_decisions");

assertIncludesAll(contract.portalSmokeLayers.layers, [
  "portal_contract_smoke",
  "portal_role_boundary_smoke",
  "portal_payload_failure_isolation_smoke",
  "portal_browser_smoke",
], "portal_structure_smoke_layer");
assert.equal(contract.portalSmokeLayers.callsRealCloud, false, "portal_structure_smoke_must_not_call_real_cloud");
assert.equal(contract.portalSmokeLayers.readsSecrets, false, "portal_structure_smoke_must_not_read_secrets");
assert.equal(contract.portalSmokeLayers.liveTestAllowedByDefault, false, "portal_structure_smoke_must_not_live_test_by_default");

assert.equal(contract.failureIsolation.packageSurfaceFailureMustNotCrashPortalShell, true, "portal_structure_package_failure_must_not_crash_shell");
assert.equal(contract.failureIsolation.adminPayloadFailureMustNotCrashUserSurface, true, "portal_structure_admin_payload_failure_must_not_crash_user_surface");
assert.equal(contract.failureIsolation.singleDomainFailureMustRemainLocal, true, "portal_structure_single_domain_failure_must_remain_local");
assert.equal(contract.failureIsolation.portalShellMustRenderAuthAndErrorStates, true, "portal_structure_shell_must_render_auth_and_error_states");

assertIncludesAll(contract.forbiddenPaths, [
  "deploy",
  ".sentrux",
  "adapters",
  "one-person-lab upstream",
], "portal_structure_forbidden_path");
assertIncludesAll(contract.forbiddenSensitiveData, [
  "SecretId",
  "SecretKey",
  "token",
  "raw API Key",
  "bearer token",
  "launchToken",
  "runtimeToken",
  "kubeconfig",
  "objectKey",
  "storageKey",
  "localPath",
  "signedUrl",
], "portal_structure_forbidden_sensitive_data");
assertIncludesAll(contract.subscribedContracts, [
  "docs/contracts/v22-mvp-managed-opl-loop.md",
  "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md",
  "docs/contracts/v22-portal-user-surface-boundary.md",
  "docs/contracts/v22-portal-admin-ops-surface-boundary.md",
  "docs/contracts/v22-portal-files-billing-trace-boundary.md",
  "docs/recovery/mvp-contract-acceptance.md",
  "docs/recovery/status-matrix.md",
], "portal_structure_subscribed_contract");

assert(readme.includes("v22-portal-structure-failure-isolation-boundary.md"), "portal_structure_contract_must_be_indexed");
assert(readme.includes("Portal 结构治理 / failure isolation"), "portal_structure_contract_readme_label_missing");

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  level: contract.level,
  scope: contract.scope,
  requiredSurfaces: contract.requiredSurfaces,
  smokeLayers: contract.portalSmokeLayers.layers,
}, null, 2));
