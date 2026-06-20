import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

const matrix = await readJson("contracts/medopl-portal-page-state-matrix.json");
const productProfile = await readJson("contracts/medopl-product-profile.json");
const routes = await readRepoFile("services/portal/frontend/src/app/routes.tsx");
const layout = await readRepoFile("services/portal/frontend/src/app/components/Layout.tsx");
const designSource = await readRepoFile("DESIGN.md");
const themeSource = await readRepoFile("services/portal/frontend/src/styles/theme.css");

const routeMarkers = new Map([
  ["resource_overview", ["Overview", "/overview"]],
  ["packages_purchase", ["PackagesPurchase", "/packages"]],
  ["compute_resource", ["RuntimeEnvironment", "/resources"]],
  ["storage_space", ["Workspace", "/workspace"]],
  ["usage_billing", ["BillingAudit", "/billing"]],
  ["opl_entry", ["OPLEntry", "/opl-launch"]],
  ["release", ["Workspace", "/workspace"]],
]);

for (const page of matrix.medopl_portal_page_state_matrix.pages) {
  assert(routeMarkers.has(page.id), `portal_page_matrix_route_owner_missing:${page.id}`);
  for (const marker of routeMarkers.get(page.id) || []) {
    assert(`${routes}\n${layout}`.includes(marker), `portal_page_state_marker_missing:${page.id}:${marker}`);
  }
  assert(Array.isArray(page.states) && page.states.length > 0, `portal_page_states_missing:${page.id}`);
}

for (const requiredSection of [
  "## 产品真相门",
  "## 产品对象语法",
  "## 用户任务流",
  "## 信息架构",
  "## 视觉语法",
  "## 语义令牌",
  "## 组件语法",
  "## 状态 / 变体矩阵",
  "## Figma 与代码映射",
  "## 页面模板",
  "## 交互和可访问性",
  "## 验证 / 回归",
]) {
  assert(designSource.includes(requiredSection), `portal_design_grammar_section_missing:${requiredSection}`);
}

for (const forbiddenDesignCopy of [
  "科研工作台控制面",
  "托管科研工作台",
  "### Trace",
  "Trace 表达",
  "Figma-code",
  "GUI truth",
]) {
  assert.equal(
    designSource.includes(forbiddenDesignCopy),
    false,
    `portal_design_old_truth_must_be_retired:${forbiddenDesignCopy}`,
  );
}

const grammar = matrix.medopl_portal_page_state_matrix.ui_grammar;
assert(grammar, "portal_ui_grammar_missing");
assert.deepEqual(
  grammar.user_information_architecture,
  ["resource_overview", "packages_purchase", "compute_resource", "storage_space", "usage_billing", "opl_entry"],
  "portal_user_information_architecture_mismatch",
);
assert.deepEqual(
  grammar.ops_information_architecture,
  [
    "provisioning_queue",
    "user_accounts",
    "resource_operations",
    "storage_operations",
    "billing_reconciliation",
    "audit",
    "system_status",
    "plan_catalog",
  ],
  "portal_ops_information_architecture_mismatch",
);

for (const forbiddenObject of ["chat", "project_session_surface", "skill_upload", "raw_trace", "cloud_console_fields"]) {
  assert(
    productProfile.medopl_product_profile.user_surface_forbidden_objects.includes(forbiddenObject),
    `portal_product_profile_forbidden_object_missing:${forbiddenObject}`,
  );
  assert(
    grammar.forbidden_user_objects.includes(forbiddenObject),
    `portal_ui_grammar_forbidden_object_missing:${forbiddenObject}`,
  );
}

for (const token of ["resource.active", "resource.blocked", "billing.warning", "release.pending", "storage.protected"]) {
  assert(grammar.semantic_tokens.includes(token), `portal_semantic_token_missing:${token}`);
  const cssVariable = `--${token.replace(".", "-")}`;
  assert(themeSource.includes(cssVariable), `portal_css_semantic_token_missing:${cssVariable}`);
}

const requiredComponentStates = ["loading", "empty", "ready", "blocked", "failed", "pending", "released", "protected"];
for (const component of ["ResourceStatusCard", "PlanCard", "StorageInventoryPanel", "BillingSummary", "ReadinessChecklist"]) {
  const spec = grammar.component_grammar.find((item) => item.name === component);
  assert(spec, `portal_component_grammar_missing:${component}`);
  assert(spec.figma_component, `portal_component_figma_component_missing:${component}`);
  assert(spec.code_component, `portal_component_code_component_missing:${component}`);
  assert(Array.isArray(spec.props) && spec.props.length > 0, `portal_component_props_missing:${component}`);
  for (const state of requiredComponentStates) {
    assert(spec.states.includes(state), `portal_component_state_missing:${component}:${state}`);
  }
}

for (const visualRule of [
  "customer_pages_max_width",
  "customer_pages_primary_cta_limit",
  "customer_pages_card_count_limit",
  "tables_only_for_comparable_sets",
  "ops_pages_queue_first",
]) {
  assert(grammar.visual_grammar[visualRule], `portal_visual_grammar_rule_missing:${visualRule}`);
}

for (const layer of ["contract", "component_state", "interaction", "visual"]) {
  assert(grammar.eval_layers.includes(layer), `portal_eval_layer_missing:${layer}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_page_state_matrix",
  pages: matrix.medopl_portal_page_state_matrix.pages.map((page) => page.id),
}, null, 2));
