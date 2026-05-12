import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md";
const evalsetPath = "services/portal/frontend/src/harness/portal-ui-evalset.json";
const start = "<!-- v22-portal-workbench-management-ui-composition-contract:start -->";
const end = "<!-- v22-portal-workbench-management-ui-composition-contract:end -->";

async function source(path) {
  return readFile(path, "utf8");
}

function extractJson(markdown) {
  const startIndex = markdown.indexOf(start);
  assert.notEqual(startIndex, -1, "composition_contract_start_marker_missing");
  const endIndex = markdown.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, "composition_contract_end_marker_missing");
  const block = markdown.slice(startIndex + start.length, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, "composition_contract_must_be_single_json_fence");
  return JSON.parse(match[1]);
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

const markdown = await source(contractPath);
const contract = extractJson(markdown);
const evalset = JSON.parse(await source(evalsetPath));
const runtimeSuite = await source("scripts/smoke-test-v22-portal-runtime-suite.mjs");
const portalConfig = await source("services/portal/src/config/portal-config.mjs");
const surfaceEvalSmoke = await source("scripts/smoke-test-v22-portal-frontend-surface-eval.mjs");
const browserSmoke = await source("scripts/smoke-test-v22-portal-workbench-management-ui-browser.mjs");
const apiSmoke = await source("scripts/smoke-test-v22-portal-workbench-management-ui-api.mjs");
const sharedSurfaceContract = await source("docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md");
const roleUserContract = await source("docs/contracts/v22-portal-user-surface-boundary.md");
const roleAdminContract = await source("docs/contracts/v22-portal-admin-ops-surface-boundary.md");
const structureContract = await source("docs/contracts/v22-portal-structure-failure-isolation-boundary.md");

assert.equal(contract.contract, "v22_portal_workbench_management_ui_composition_boundary", "contract_name_mismatch");
assert.equal(contract.version, 7, "contract_version_mismatch");
assert.equal(contract.model, "gpt-5.4", "contract_model_mismatch");
assert.equal(contract.scope.portalOnly, true, "composition_scope_must_be_portal_only");
assert.equal(contract.scope.implementsUi, true, "composition_contract_must_implement_ui");
assert.equal(contract.scope.callsRealCloud, false, "composition_contract_must_not_call_real_cloud");
assert.equal(contract.scope.readsSecrets, false, "composition_contract_must_not_read_secrets");
assert.equal(contract.scope.modifiesUpstream, false, "composition_contract_must_not_modify_upstream");
assert.equal(contract.scope.modifiesDeploy, false, "composition_contract_must_not_modify_deploy");
assert.equal(contract.contractRole, "ui_boundary_and_eval_entrypoint_only", "composition_contract_role_mismatch");

assert.equal(contract.evalset.path, evalsetPath, "evalset_path_mismatch");
assert.equal(contract.evalset.schemaVersion, "2026-05-harness-native", "evalset_schema_version_mismatch");
assert.equal(contract.evalset.smoke, "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs", "evalset_smoke_mismatch");
assert.equal(contract.evalset.runtimeReportPath, ".runtime/portal-surface-eval/report.json", "evalset_runtime_report_path_mismatch");
assert.equal(contract.evalset.runtimeReportCommitted, false, "evalset_runtime_report_must_not_be_committed");
assert.deepEqual(contract.evalset.owns, [
  "routes",
  "surfaces",
  "layouts",
  "apiShapes",
  "forbiddenCopy",
  "requiredDomAnchors",
  "pageTasks",
  "primitives",
  "copyRegistry",
  "fixtures",
  "visualRoutes",
  "pageComposition",
  "surfaceStates",
  "componentFixtures",
  "designTokens",
  "presentationRules",
  "owners",
  "acceptance",
  "artifactPolicy",
  "coverage",
], "evalset_owned_facts_mismatch");

assert.equal(contract.uiArchitecture.method, "sub2api_style_layout_first_with_executable_evalset", "ui_architecture_method_mismatch");
assert.equal(contract.uiArchitecture.pageRole, "orchestration_only", "page_role_must_be_orchestration_only");
assert.equal(contract.uiArchitecture.surfaceFactsLiveInEvalset, true, "surface_facts_must_live_in_evalset");
assert.equal(contract.uiArchitecture.apiShapeFactsLiveInEvalset, true, "api_shape_facts_must_live_in_evalset");
assert.equal(contract.uiArchitecture.productizedUiSystemFactsLiveInEvalset, true, "productized_ui_system_facts_must_live_in_evalset");
assert.equal(contract.uiArchitecture.pageCompositionFactsLiveInEvalset, true, "page_composition_facts_must_live_in_evalset");
assert.equal(contract.uiArchitecture.surfaceStateFactsLiveInEvalset, true, "surface_state_facts_must_live_in_evalset");
assert.equal(contract.uiArchitecture.componentFixtureFactsLiveInEvalset, true, "component_fixture_facts_must_live_in_evalset");
assert.equal(contract.uiArchitecture.designTokenFactsLiveInEvalset, true, "design_token_facts_must_live_in_evalset");
assert.equal(contract.uiArchitecture.presentationRuleFactsLiveInEvalset, true, "presentation_rule_facts_must_live_in_evalset");
assert.deepEqual(contract.uiArchitecture.layers, [
  "route_entry",
  "page_shell",
  "page_layout",
  "common_component",
  "feature_component",
  "page_orchestration",
  "state_composable",
  "api_module",
  "harness_eval",
], "ui_architecture_layers_mismatch");

assert.equal(contract.copyArchitecture.rawStatusVisible, false, "raw_status_must_not_be_visible");
assert.equal(contract.copyArchitecture.slashSeparatedUiCopyAllowed, false, "slash_copy_must_be_forbidden");
for (const term of [
  "客户工作台",
  "平台管理台",
  "商业化",
  "商业",
  "SaaS 总览",
  "运维面",
  "运营总台",
  "告警中心",
  "账务",
  "使用统一账号登录",
]) {
  assertIncludes(contract.copyArchitecture.forbiddenUiTerms.join("\n"), term, `forbidden_term_${term}`);
}

assert.equal(contract.contractDemotion.roleSurfaceContractsOwn, "role_boundary_only", "role_contract_demotion_mismatch");
assert.equal(contract.contractDemotion.structureContractOwns, "module_boundary_and_failure_isolation_only", "structure_contract_demotion_mismatch");
assert.equal(contract.contractDemotion.sharedSurfaceContractOwns, "shared_product_semantics_only", "shared_contract_demotion_mismatch");
assert.equal(contract.contractDemotion.compositionContractOwns, "ui_boundary_and_eval_entrypoint_only", "composition_contract_demotion_mismatch");
assert.equal(contract.contractDemotion.surfaceAndApiDetailsOwn, "portal_ui_evalset", "evalset_detail_owner_mismatch");

assert.equal(contract.runtimeSmokeEntrypoint, "scripts/smoke-test-v22-portal-runtime-suite.mjs", "runtime_suite_entrypoint_mismatch");
for (const group of ["contract", "surface", "architecture", "api", "build", "browser"]) {
  assertIncludes(contract.validationGroups.join("\n"), group, `validation_group_${group}`);
  assertIncludes(runtimeSuite, `"${group}"`, `runtime_suite_group_${group}`);
}
assertIncludes(runtimeSuite, "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs", "runtime_suite_must_include_surface_eval");
assertIncludes(portalConfig, "PORTAL_RUNTIME_ROOT", "portal_config_must_support_runtime_root_override");
for (const [label, smoke] of [
  ["surface_eval", surfaceEvalSmoke],
  ["browser", browserSmoke],
  ["api", apiSmoke],
]) {
  assertIncludes(smoke, "PORTAL_RUNTIME_ROOT", `portal_${label}_smoke_must_use_runtime_root_override`);
  assertExcludes(smoke, "rename(", `portal_${label}_smoke_must_not_rename_shared_runtime_root`);
}

assert.equal(evalset.schemaVersion, "2026-05-harness-native", "evalset_schema_version_mismatch");
assert.equal(evalset.scope.sourceOfExecutableUiTruth, true, "evalset_must_be_executable_truth");
assert.equal(evalset.artifactPolicy.runtimeReportPath, ".runtime/portal-surface-eval/report.json", "evalset_runtime_report_path_mismatch");
assert.equal(evalset.artifactPolicy.commitReports, false, "evalset_report_must_not_be_committed");
for (const key of contract.evalset.owns) {
  assert(evalset[key], `evalset_${key}_missing`);
}
for (const key of ["routes", "surfaces", "layouts", "apiShapes", "forbiddenCopy", "requiredDomAnchors", "pageTasks", "primitives", "copyRegistry", "fixtures", "visualRoutes"]) {
  assert(Array.isArray(evalset[key]), `evalset_${key}_must_be_array`);
}
assert.equal(evalset.surfaces.some((surface) => surface.status === "partial"), false, "evalset_must_not_leave_partial_admin_surfaces_in_absorbable_branch");
assert(evalset.apiShapes.length >= 8, "evalset_must_cover_core_api_shapes");
assert(evalset.primitives.length >= 9, "evalset_must_cover_common_primitives");
assert(evalset.copyRegistry.length >= 20, "evalset_must_cover_copy_registry");
assert(evalset.fixtures.length >= 6, "evalset_must_cover_core_fixtures");
assert(evalset.visualRoutes.length >= 8, "evalset_must_cover_visual_routes");
assert(evalset.version >= 4, "evalset_must_be_productized_ui_system_version");
assert(evalset.pageComposition.length >= 11, "evalset_must_cover_page_composition");
assert(evalset.surfaceStates.length >= evalset.surfaces.length, "evalset_must_cover_surface_states");
assert(evalset.componentFixtures.length >= evalset.surfaces.length, "evalset_must_cover_component_fixtures");
assert(evalset.designTokens.length >= 10, "evalset_must_cover_design_tokens");
assert(evalset.presentationRules.length >= 7, "evalset_must_cover_presentation_rules");
for (const apiShape of evalset.apiShapes) {
  assert(Array.isArray(apiShape.requiredPaths), `evalset_api_shape_required_paths_missing:${apiShape.id}`);
  assert(apiShape.requiredPaths.length > 0, `evalset_api_shape_required_paths_empty:${apiShape.id}`);
}

assertIncludes(sharedSurfaceContract, "本合同是共享产品表面合同，不单独实现 UI", "shared_surface_contract_must_not_own_ui_implementation");
assertIncludes(roleUserContract, "role surface 合同，不实现新 UI", "user_role_contract_must_not_own_ui_implementation");
assertIncludes(roleAdminContract, "role surface 合同，不实现新 UI", "admin_role_contract_must_not_own_ui_implementation");
assertIncludes(structureContract, "Portal 三级结构治理合同", "structure_contract_must_remain_structure_only");

assertExcludes(markdown, "\"executionMatrix\"", "composition_contract_must_not_embed_execution_matrix");
assertExcludes(markdown, "\"apiShapes\": [", "composition_contract_must_not_embed_api_shapes");
assertExcludes(markdown, "\"surfaces\": [", "composition_contract_must_not_embed_surfaces");

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  version: contract.version,
  checked: [
    "slim_contract_json",
    "evalset_entrypoint",
    "contract_demotion",
    "runtime_suite_groups",
    "ui_copy_boundary",
    "isolated_runtime_root",
  ],
}, null, 2));
