import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contracts = {
  shared: "docs/specs/README.md",
  userRole: "docs/specs/README.md",
  adminRole: "docs/specs/README.md",
  structure: "docs/specs/README.md",
  composition: "docs/specs/README.md",
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

const shared = await source(contracts.shared);
const userRole = await source(contracts.userRole);
const adminRole = await source(contracts.adminRole);
const structure = await source(contracts.structure);
const composition = await source(contracts.composition);

assertIncludes(shared, "共享产品表面合同，不单独实现 UI", "shared_contract_role");
assertIncludes(shared, "Portal 可运行 UI、组件组合、路由入口和验证链路由 `spec:v22-portal-workbench-management-ui-composition-boundary` 承接", "shared_contract_ui_delegate");
assertIncludes(userRole, "role surface 合同，不实现新 UI", "user_role_contract_role");
assertIncludes(adminRole, "role surface 合同，不实现新 UI", "admin_role_contract_role");
assertIncludes(structure, "Portal 结构治理 / failure isolation 三级合同，不实现 UI，不改业务代码", "structure_contract_role");
assertIncludes(composition, "统一验证入口：`node tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs`", "composition_contract_role");
assertIncludes(composition, "具体页面、组件、API shape 和缺口必须进入 ZIP source、Portal adapter 或后续专门 UI leaf", "composition_surface_gate_owns_details");

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
    "shared_surface_delegates_ui",
    "role_contracts_remain_role_only",
    "structure_contract_remains_structure_only",
    "composition_contract_points_to_zip_surface_gate",
    "surface_details_not_embedded_in_contracts",
  ],
}, null, 2));
