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
const interactionFlowContract = await readJson("contracts/medopl-portal-interaction-flow-contract.json");
const uiQualityContract = await readJson("contracts/medopl-portal-ui-quality-contract.json");
const productProfile = await readJson("contracts/medopl-product-profile.json");
const routes = await readRepoFile("services/portal/frontend/src/app/routes.tsx");
const layout = await readRepoFile("services/portal/frontend/src/app/components/Layout.tsx");
const designSource = await readRepoFile("DESIGN.md");
const themeSource = await readRepoFile("services/portal/frontend/src/styles/theme.css");
const repoHygieneSource = await readRepoFile("scripts/v22-repo-hygiene.mjs");
const coreUiSource = await readRepoFile("services/portal/frontend/src/app/components/ui/core.tsx");
const tabsSource = await readRepoFile("services/portal/frontend/src/app/components/ui/tabs.tsx");
const switchSource = await readRepoFile("services/portal/frontend/src/app/components/ui/switch.tsx");
const tableSource = await readRepoFile("services/portal/frontend/src/app/components/ui/table.tsx");
const resourceControlComponents = await readRepoFile("services/portal/frontend/src/app/components/ResourceControlComponents.tsx");
const runtimeEnvironmentPage = await readRepoFile("services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx");
const packagesPurchasePage = await readRepoFile("services/portal/frontend/src/app/pages/PackagesPurchase.tsx");
const workspacePage = await readRepoFile("services/portal/frontend/src/app/pages/Workspace.tsx");
const billingAuditPage = await readRepoFile("services/portal/frontend/src/app/pages/BillingAudit.tsx");
const overviewPage = await readRepoFile("services/portal/frontend/src/app/pages/Overview.tsx");
const oplEntryPage = await readRepoFile("services/portal/frontend/src/app/pages/OPLEntry.tsx");

const userVisibleSource = [
  layout,
  runtimeEnvironmentPage,
  packagesPurchasePage,
  workspacePage,
  billingAuditPage,
  overviewPage,
  oplEntryPage,
].join("\n");

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
const consumedComponents = new Set([
  "ResourceStatusCard",
  "PlanCard",
  "StorageInventoryPanel",
  "BillingSummary",
  "ReadinessChecklist",
]);
const mappingByComponent = new Map(grammar.figma_code_mapping.map((mapping) => [mapping.code_component, mapping]));
for (const component of ["ResourceStatusCard", "PlanCard", "StorageInventoryPanel", "BillingSummary", "ReadinessChecklist", "ReleaseConfirmDialog", "OpsQueueTable"]) {
  const spec = grammar.component_grammar.find((item) => item.name === component);
  assert(spec, `portal_component_grammar_missing:${component}`);
  assert(spec.figma_component, `portal_component_figma_component_missing:${component}`);
  assert(spec.code_component, `portal_component_code_component_missing:${component}`);
  assert(mappingByComponent.has(spec.code_component), `portal_figma_code_mapping_missing:${spec.code_component}`);
  const mapping = mappingByComponent.get(spec.code_component);
  assert.equal(mapping.figma_component, spec.figma_component, `portal_figma_code_mapping_figma_mismatch:${component}`);
  assert.equal(mapping.variant_prop, "status", `portal_figma_code_mapping_variant_prop_mismatch:${component}`);
  for (const state of requiredComponentStates) {
    assert(mapping.allowed_values.includes(state), `portal_figma_code_mapping_state_missing:${component}:${state}`);
  }
  if (consumedComponents.has(component)) {
    assert(
      resourceControlComponents.includes(`function ${spec.code_component}`) ||
        resourceControlComponents.includes(`const ${spec.code_component}`),
      `portal_code_component_export_missing:${spec.code_component}`,
    );
  }
  assert(Array.isArray(spec.props) && spec.props.length > 0, `portal_component_props_missing:${component}`);
  for (const state of requiredComponentStates) {
    assert(spec.states.includes(state), `portal_component_state_missing:${component}:${state}`);
  }
}

for (const [pageName, pageSource, components] of [
  ["RuntimeEnvironment", runtimeEnvironmentPage, ["ResourceStatusCard", "PlanCard", "ReadinessChecklist"]],
  ["PackagesPurchase", packagesPurchasePage, ["PlanCard", "BillingSummary"]],
  ["Workspace", workspacePage, ["StorageInventoryPanel"]],
  ["BillingAudit", billingAuditPage, ["BillingSummary"]],
]) {
  for (const component of components) {
    assert(pageSource.includes(component), `portal_page_component_consumption_missing:${pageName}:${component}`);
  }
}

assert.equal(
  runtimeEnvironmentPage.includes("ReleaseConfirmDialog"),
  false,
  "portal_runtime_release_dialog_must_wait_for_release_mutation_owner",
);
assert(
  runtimeEnvironmentPage.includes('data-release-owner-readiness="partial_fail_closed_pending_owner_receipt"'),
  "portal_runtime_release_partial_state_marker_missing",
);
assert(
  runtimeEnvironmentPage.includes('aria-describedby="release-owner-readiness-reason"'),
  "portal_runtime_release_disabled_reason_must_be_programmatically_associated",
);
assert(
  runtimeEnvironmentPage.includes('id="release-owner-readiness-reason"'),
  "portal_runtime_release_disabled_reason_visible_copy_missing",
);
const releaseSpec = grammar.component_grammar.find((item) => item.name === "ReleaseConfirmDialog");
assert.equal(releaseSpec?.implementation_state, "partial_fail_closed_pending_release_mutation", "release_dialog_contract_must_mark_partial_state");
assert.equal(releaseSpec?.claimable, false, "release_dialog_must_not_be_claimable_before_mutation_owner");

for (const visualRule of [
  "customer_pages_max_width",
  "customer_pages_primary_cta_limit",
  "customer_pages_card_count_limit",
  "tables_only_for_comparable_sets",
  "ops_pages_queue_first",
]) {
  assert(grammar.visual_grammar[visualRule], `portal_visual_grammar_rule_missing:${visualRule}`);
}
assert.equal(grammar.visual_grammar.billing_first_view_layout, "billing_summary_status_band_then_ledger_details", "billing_first_view_layout_contract_missing");
assert.equal(grammar.visual_grammar.billing_first_view_extra_kpi_cards_max, 0, "billing_first_view_extra_kpi_budget_must_be_zero");
assert.equal(grammar.visual_grammar.required_h1_owner, "page_content", "portal_h1_owner_must_be_page_content");
assert.equal(grammar.visual_grammar.logo_heading_allowed, false, "portal_logo_must_not_own_h1");
assert.equal(grammar.visual_grammar.mobile_touch_target_min_px, 44, "portal_touch_target_min_must_be_44");
assert.equal(grammar.visual_grammar.card_radius_max_px, 8, "portal_card_radius_max_must_be_8");

for (const page of matrix.medopl_portal_page_state_matrix.pages) {
  assert(page.first_view_card_budget, `portal_page_first_view_card_budget_missing:${page.id}`);
  assert.equal(page.required_h1_owner, "page_content", `portal_page_h1_owner_mismatch:${page.id}`);
  assert.equal(page.mobile_touch_target_min_px, 44, `portal_page_mobile_touch_target_mismatch:${page.id}`);
}
const billingPage = matrix.medopl_portal_page_state_matrix.pages.find((page) => page.id === "usage_billing");
assert.equal(billingPage?.first_view_layout, "billing_summary_status_band_then_ledger_details", "billing_page_layout_contract_missing");
assert.equal(billingPage?.first_view_card_budget?.extra_kpi_cards, 0, "billing_page_extra_kpi_budget_must_be_zero");

assert.equal(uiQualityContract.medopl_portal_ui_quality_contract.touch_target.min_px, 44, "ui_quality_touch_target_min_mismatch");
assert.equal(uiQualityContract.medopl_portal_ui_quality_contract.card.radius_max_px, 8, "ui_quality_card_radius_mismatch");
assert.equal(uiQualityContract.medopl_portal_ui_quality_contract.semantic_heading.logo_h1_allowed, false, "ui_quality_logo_h1_mismatch");
assert.equal(uiQualityContract.medopl_portal_ui_quality_contract.billing.first_view_extra_kpi_cards_max, 0, "ui_quality_billing_kpi_budget_mismatch");
assert.equal(uiQualityContract.medopl_portal_ui_quality_contract.production_readiness.claim_requires_runtime_receipt, true, "ui_quality_production_claim_must_require_runtime_receipt");
assert.deepEqual(
  uiQualityContract.medopl_portal_ui_quality_contract.production_readiness.cannot_claim_from,
  ["ui_green", "contract_green", "local_browser_screenshot", "local_rc"],
  "ui_quality_production_claim_forbidden_evidence_mismatch",
);
for (const gate of [
  "staging_or_prod_like_canary",
  "role_boundary_browser_gate",
  "release_owner_receipt",
  "security_dependency_gate",
  "observability_receipt",
  "s_level_ui_polish_gate",
]) {
  assert(
    uiQualityContract.medopl_portal_ui_quality_contract.production_readiness.required_gates.includes(gate),
    `ui_quality_production_ready_gate_missing:${gate}`,
  );
}
const productionReadiness = uiQualityContract.medopl_portal_ui_quality_contract.production_readiness;
assert.equal(
  productionReadiness.security_dependency_gate?.command,
  "npm --prefix services/portal/frontend audit --omit=dev --audit-level=high --json",
  "ui_quality_security_dependency_gate_command_missing",
);
assert.equal(
  productionReadiness.security_dependency_gate?.max_prod_high_vulnerabilities,
  0,
  "ui_quality_security_dependency_gate_must_block_high_prod_vulnerabilities",
);
assert.equal(
  productionReadiness.security_dependency_gate?.consumer,
  "scripts/v22-repo-hygiene.mjs",
  "ui_quality_security_dependency_gate_consumer_missing",
);
assert.equal(
  productionReadiness.root_production_dependency_gate?.command,
  "npm audit --omit=dev --audit-level=high --json",
  "ui_quality_root_production_dependency_gate_command_missing",
);
assert.equal(
  productionReadiness.root_production_dependency_gate?.max_prod_high_or_critical_vulnerabilities,
  0,
  "ui_quality_root_production_dependency_gate_must_block_high_or_critical_prod_vulnerabilities",
);
assert.equal(
  productionReadiness.root_production_dependency_gate?.authorized_cloud_sdk_scope,
  "dev_dependency_tooling_only",
  "ui_quality_cloud_sdk_scope_must_be_tooling_only",
);
assert.equal(
  productionReadiness.accessibility_verification?.consumer,
  "tests/regression/portal/regression-test-v22-portal-resource-control-ui-browser.mjs",
  "ui_quality_accessibility_browser_consumer_missing",
);
for (const check of [
  "keyboard_focus_visible",
  "touch_targets_44px",
  "heading_hierarchy",
  "role_boundary_mobile_nav",
  "labelled_navigation_landmark",
  "no_horizontal_overflow",
  "disabled_reason_visible",
]) {
  assert(
    productionReadiness.accessibility_verification?.checks?.includes(check),
    `ui_quality_accessibility_verification_check_missing:${check}`,
  );
}
assert.equal(
  productionReadiness.observability_receipt?.required_before_production_claim,
  true,
  "ui_quality_observability_receipt_must_block_production_claim",
);
assert.equal(
  productionReadiness.observability_receipt?.receipt_type,
  "production_deploy_receipt",
  "ui_quality_observability_receipt_type_mismatch",
);
assert.equal(
  productionReadiness.release_owner_readiness?.receipt_type,
  "release_owner_receipt",
  "ui_quality_release_owner_readiness_receipt_missing",
);
assert.equal(
  productionReadiness.release_owner_readiness?.current_ui_state,
  "partial_fail_closed_pending_release_mutation",
  "ui_quality_release_owner_readiness_state_mismatch",
);
assert.equal(
  productionReadiness.release_owner_readiness?.ui_state_marker,
  "partial_fail_closed_pending_owner_receipt",
  "ui_quality_release_owner_readiness_ui_marker_mismatch",
);
assert.equal(
  productionReadiness.s_level_ui_polish_gate?.consumer,
  "tests/regression/portal/regression-test-v22-portal-resource-control-ui-browser.mjs",
  "ui_quality_s_level_ui_polish_gate_consumer_missing",
);
for (const check of [
  "component_state_consistency",
  "status_feedback",
  "responsive_data_tables",
  "admin_template_hierarchy",
  "empty_error_recovery",
]) {
  assert(
    productionReadiness.s_level_ui_polish_gate?.checks?.includes(check),
    `ui_quality_s_level_ui_polish_gate_check_missing:${check}`,
  );
}
assert(
  grammar.production_readiness.required_gates.includes("s_level_ui_polish_gate"),
  "portal_page_matrix_production_readiness_must_include_s_level_ui_polish_gate",
);
assert.equal(
  grammar.production_readiness.release_owner_readiness?.ui_state_marker,
  productionReadiness.release_owner_readiness?.ui_state_marker,
  "portal_page_matrix_release_owner_ui_marker_must_match_ui_quality_contract",
);
assert.deepEqual(
  grammar.production_readiness.s_level_ui_polish_gate?.checks,
  productionReadiness.s_level_ui_polish_gate?.checks,
  "portal_page_matrix_s_level_ui_polish_gate_must_match_ui_quality_contract",
);
assert(
  repoHygieneSource.includes("frontendProductionDependencyAudit"),
  "ui_quality_security_dependency_gate_must_be_consumed_by_repo_hygiene",
);
assert(
  repoHygieneSource.includes("rootProductionDependencyAudit"),
  "ui_quality_root_security_dependency_gate_must_be_consumed_by_repo_hygiene",
);
assert.equal(uiQualityContract.medopl_portal_ui_quality_contract.a_plus_s_floor.freeze_scope, "principles_not_pixels", "ui_quality_must_not_freeze_pixels");
for (const floor of ["component_state_consistency", "status_feedback", "responsive_data_tables", "admin_template_hierarchy", "empty_error_recovery"]) {
  assert(
    uiQualityContract.medopl_portal_ui_quality_contract.a_plus_s_floor.required.includes(floor),
    `ui_quality_a_plus_s_floor_missing:${floor}`,
  );
}

assert.equal(uiQualityContract.medopl_portal_ui_quality_contract.brand.primary_hex, "#0F766E", "ui_quality_brand_primary_hex_mismatch");
assert.deepEqual(
  uiQualityContract.medopl_portal_ui_quality_contract.brand.forbidden_primary_hues,
  ["default_technology_blue", "default_technology_purple"],
  "ui_quality_forbidden_primary_hues_mismatch",
);
assert.equal(uiQualityContract.medopl_portal_ui_quality_contract.motion.transition_all_allowed, false, "ui_quality_transition_all_must_be_forbidden");
for (const property of ["colors", "background-color", "border-color", "box-shadow", "transform", "opacity"]) {
  assert(
    uiQualityContract.medopl_portal_ui_quality_contract.motion.allowed_transition_properties.includes(property),
    `ui_quality_motion_property_missing:${property}`,
  );
}
for (const state of ["hover", "active", "focus-visible", "disabled", "cursor"]) {
  assert(
    uiQualityContract.medopl_portal_ui_quality_contract.interaction_states.required.includes(state),
    `ui_quality_interaction_state_missing:${state}`,
  );
}
for (const target of ["logo_link", "tabs_trigger", "input", "switch"]) {
  assert(
    uiQualityContract.medopl_portal_ui_quality_contract.touch_target.applies_to.includes(target),
    `ui_quality_touch_target_scope_missing:${target}`,
  );
}
for (const forbiddenTerm of ["workspace", "Runtime", "not_activated", "funded", "MedOPL plan catalog"]) {
  assert(
    uiQualityContract.medopl_portal_ui_quality_contract.copy.forbidden_visible_terms.includes(forbiddenTerm),
    `ui_quality_forbidden_visible_term_missing:${forbiddenTerm}`,
  );
}
for (const forbiddenVisiblePhrase of [
  "MedOPL plan catalog",
  "当前 workspace",
  "尚未开通 Runtime",
  "OPL workspace",
  "local ledger",
  "mutation",
  "runner phase",
  "claim",
  "future-authorized",
  "ops_surface_disabled",
]) {
  assert.equal(
    userVisibleSource.includes(forbiddenVisiblePhrase),
    false,
    `portal_visible_internal_phrase_must_be_retired:${forbiddenVisiblePhrase}`,
  );
}
assert(themeSource.includes("--primary: #0F766E;"), "portal_theme_primary_must_use_frozen_teal");
for (const forbiddenColor of [
  "--primary: #030213;",
  "--release-pending: #2563eb;",
  "--storage-protected: #6d28d9;",
  "--release-pending: #60a5fa;",
  "--storage-protected: #a78bfa;",
  "--release-pending-background: #1e3a8a;",
  "--storage-protected-background: #4c1d95;",
]) {
  assert.equal(themeSource.includes(forbiddenColor), false, `portal_theme_default_blue_purple_or_black_primary_must_retire:${forbiddenColor}`);
}
for (const [label, source] of [
  ["core", coreUiSource],
  ["tabs", tabsSource],
  ["switch", switchSource],
  ["layout", layout],
  ["resource_components", resourceControlComponents],
]) {
  assert.equal(source.includes("transition-all"), false, `portal_transition_all_must_not_be_used:${label}`);
}
assert(
  resourceControlComponents.includes("motion-reduce:transition-none"),
  "portal_resource_components_must_respect_reduced_motion",
);
assert(coreUiSource.includes("cursor-pointer"), "portal_button_cursor_pointer_missing");
assert(coreUiSource.includes("active:translate-y-px"), "portal_button_active_state_missing");
assert(coreUiSource.includes("disabled:cursor-not-allowed"), "portal_button_disabled_cursor_missing");
assert(coreUiSource.includes("min-h-11"), "portal_input_touch_target_min_height_missing");
assert(tabsSource.includes("min-h-11"), "portal_tabs_touch_target_min_height_missing");
assert(tabsSource.includes("cursor-pointer"), "portal_tabs_cursor_pointer_missing");
assert(switchSource.includes("min-h-11"), "portal_switch_touch_target_min_height_missing");
assert(switchSource.includes("min-w-11"), "portal_switch_touch_target_min_width_missing");
assert(tableSource.includes("data-ui-pattern=\"responsive-data-table\""), "portal_table_responsive_pattern_missing");
assert.equal(coreUiSource.includes("<h4"), false, "portal_card_title_must_not_create_heading_skip");
assert(resourceControlComponents.includes("data-ui-pattern=\"state-feedback\""), "portal_state_feedback_pattern_missing");
assert(resourceControlComponents.includes("role=\"status\""), "portal_state_feedback_live_region_missing");
assert(layout.includes("data-ui-pattern=\"mobile-nav-scroll-hint\""), "portal_mobile_nav_scroll_hint_missing");
assert(layout.includes("aria-current={isActive ? \"page\" : undefined}"), "portal_nav_current_page_semantics_missing");
assert(layout.includes("aria-label=\"主要资源导航\""), "portal_main_nav_accessible_label_missing");
assert(layout.includes("aria-label=\"管理台导航\""), "portal_admin_nav_accessible_label_missing");

const flowById = new Map(interactionFlowContract.medopl_portal_interaction_flow_contract.flows.map((flow) => [flow.id, flow]));
assert.equal(interactionFlowContract.medopl_portal_interaction_flow_contract.interaction_states.min_touch_target_px, 44, "interaction_flow_touch_target_min_mismatch");
assert.equal(interactionFlowContract.medopl_portal_interaction_flow_contract.interaction_states.transition_all_allowed, false, "interaction_flow_transition_all_must_be_forbidden");
assert.equal(interactionFlowContract.medopl_portal_interaction_flow_contract.production_claim_policy.claim_requires_runtime_receipt, true, "interaction_flow_production_claim_must_require_runtime_receipt");
assert.equal(interactionFlowContract.medopl_portal_interaction_flow_contract.production_claim_policy.release_partial_state_blocks_production_claim, true, "interaction_flow_release_partial_state_must_block_production_claim");
for (const requiredState of ["hover", "active", "focus-visible", "disabled", "cursor"]) {
  assert(
    interactionFlowContract.medopl_portal_interaction_flow_contract.interaction_states.required.includes(requiredState),
    `interaction_flow_required_state_missing:${requiredState}`,
  );
}
for (const flowId of [
  "open_compute_resource",
  "purchase_or_upgrade_plan",
  "bind_provider_key",
  "enter_opl",
  "upload_workspace_file",
  "download_workspace_file",
  "export_billing",
  "release_compute_resource",
]) {
  const flow = flowById.get(flowId);
  assert(flow, `portal_interaction_flow_missing:${flowId}`);
  assert(flow.entry_route, `portal_interaction_flow_entry_route_missing:${flowId}`);
  assert(flow.primary_action, `portal_interaction_flow_primary_action_missing:${flowId}`);
  assert(flow.backend_api, `portal_interaction_flow_backend_api_missing:${flowId}`);
  assert(flow.states, `portal_interaction_flow_states_missing:${flowId}`);
  for (const state of ["loading", "empty", "blocked", "failed", "success"]) {
    assert(flow.states[state], `portal_interaction_flow_state_missing:${flowId}:${state}`);
  }
  assert(Array.isArray(flow.consumer_tests) && flow.consumer_tests.length > 0, `portal_interaction_flow_consumer_tests_missing:${flowId}`);
}
assert.equal(flowById.get("release_compute_resource")?.implementation_state, "partial_fail_closed_pending_release_mutation", "release_flow_partial_state_missing");
assert.equal(flowById.get("release_compute_resource")?.ui_state_marker, "partial_fail_closed_pending_owner_receipt", "release_flow_ui_marker_missing");
assert.equal(flowById.get("release_compute_resource")?.claimable, false, "release_flow_must_not_be_claimable");

for (const layer of ["contract", "component_state", "interaction", "visual"]) {
  assert(grammar.eval_layers.includes(layer), `portal_eval_layer_missing:${layer}`);
}
assert.equal(grammar.production_readiness.claim_requires_runtime_receipt, true, "portal_page_matrix_production_claim_must_require_runtime_receipt");
assert.equal(grammar.production_readiness.release_partial_state_blocks_production_claim, true, "portal_page_matrix_release_partial_state_must_block_production_claim");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_page_state_matrix",
  pages: matrix.medopl_portal_page_state_matrix.pages.map((page) => page.id),
}, null, 2));
