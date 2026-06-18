import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const owners = {
  specsIndex: "docs/specs/README.md",
  shared: "specs/runtime/spec.md",
  userRole: "specs/product/spec.md",
  adminRole: "specs/operations/spec.md",
  structure: "specs/source/spec.md",
  composition: "specs/source/spec.md",
};

async function source(filePath) {
  return readFile(filePath, "utf8");
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

const specsIndex = await source(owners.specsIndex);
const shared = await source(owners.shared);
const userRole = await source(owners.userRole);
const adminRole = await source(owners.adminRole);
const structure = await source(owners.structure);
const composition = await source(owners.composition);

assertIncludes(specsIndex, "spec:v22-saas-portal-opl-ops-surface-boundary", "specs_index_shared_anchor");
assertIncludes(specsIndex, "spec:v22-portal-user-surface-boundary", "specs_index_user_anchor");
assertIncludes(specsIndex, "spec:v22-portal-admin-ops-surface-boundary", "specs_index_admin_anchor");
assertIncludes(specsIndex, "spec:v22-portal-structure-failure-isolation-boundary", "specs_index_structure_anchor");
assertIncludes(specsIndex, "spec:v22-portal-workbench-management-ui-composition-boundary", "specs_index_composition_anchor");
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_contract_role_json");

assertIncludes(shared, "`runtime:saas-portal-opl-ops-surface-boundary`", "shared_contract_runtime_owner");
assertIncludes(shared, "spec:v22-portal-workbench-management-ui-composition-boundary", "shared_contract_ui_delegate");
assertIncludes(userRole, "`product:portal-user-surface-boundary`", "user_role_product_owner");
assertIncludes(adminRole, "`operations:portal-admin-ops-surface-boundary`", "admin_role_operations_owner");
assertIncludes(structure, "`source:portal-workbench-management-ui-composition`", "structure_source_owner");
assertIncludes(composition, "services/portal/frontend/src/app/**", "composition_source_app_owner");
assertIncludes(composition, "services/portal/frontend/src/api/portal/**", "composition_source_api_owner");

for (const [label, markdown] of Object.entries({ shared, userRole, adminRole, structure })) {
  assertExcludes(markdown, '"sourceOfExecutableUiTruth": true', `${label}_must_not_claim_executable_ui_truth`);
  assertExcludes(markdown, "historical evalset fixed route", `${label}_must_not_own_evalset_details`);
  assertExcludes(markdown, '"surfaces": [', `${label}_must_not_embed_ui_surfaces`);
  assertExcludes(markdown, '"apiShapes": [', `${label}_must_not_embed_api_shapes`);
  assertExcludes(markdown, '"requiredDomAnchors"', `${label}_must_not_embed_dom_anchor_matrix`);
}

for (const forbidden of [
  '"executionMatrix"',
  '"surfaces": [',
  '"apiShapes": [',
  '"requiredDomAnchors": [',
]) {
  assertExcludes(composition, forbidden, "composition_contract_must_remain_light");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_contract_role_consolidation",
  checked: [
    "specs_index_is_anchor_only",
    "shared_surface_delegates_ui",
    "role_contracts_have_root_spec_owners",
    "composition_contract_points_to_source_surface",
    "surface_details_not_embedded_in_contracts",
  ],
}, null, 2));
