import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-portal-ui-design-quality-audit-boundary.md";
const contractIndexPath = "docs/contracts/README.md";
const gapMatrixPath = "docs/recovery/v22-current-vs-ideal-gap-matrix.md";
const currentGoalPath = "docs/recovery/v22-goal-current.json";
const verifyManifestPath = "docs/recovery/v22-agent-verify-manifest.json";
const mvpAcceptancePath = "docs/recovery/mvp-contract-acceptance.md";
const mvpSuitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

const startMarker = "<!-- v22-portal-ui-design-quality-audit-contract:start -->";
const endMarker = "<!-- v22-portal-ui-design-quality-audit-contract:end -->";

const requiredUserQuestions = [
  "我买的是什么服务？",
  "我的 OPL 工作台现在能不能用？",
  "如果不能用，还缺哪一步？",
  "下一步应该点哪里？",
  "我的文件、任务、结果在哪里？",
  "我的余额、预扣费、冻结金额、停止计费状态是否正常？",
  "我什么时候应该释放计算资源但保留文件空间？",
];

const requiredHardRubric = [
  "mainline_questions_answered",
  "portal_opl_responsibility_boundary",
  "no_cloud_console_language_for_normal_users",
  "no_opl_chatbot_reimplementation",
  "role_surface_boundary",
  "secret_browser_hygiene",
  "responsive_no_overflow",
  "state_coverage",
  "audit_report_runtime_only",
];

const requiredSoftRubric = [
  "modern_saas_information_hierarchy",
  "workbench_scanability",
  "service_clarity",
  "next_action_clarity",
  "research_workspace_feel",
  "visual_density_balance",
  "copy_tone_quality",
];

const requiredReferenceBoundaries = [
  "external_ui_ux_best_practices_reference_only",
  "content_semantics_fixed_by_v22_contracts",
  "vue_vite_ts_pinia_stack_preserved",
  "no_react_or_vercel_migration_in_this_leaf",
];

const forbiddenDesignLocks = [
  "必须使用蓝色",
  "必须使用紫色",
  "必须使用渐变",
  "必须使用卡片布局",
  "必须使用三栏布局",
  "必须使用某个字体",
  "必须使用某个组件库",
  "固定字号",
  "固定间距",
  "固定圆角",
];

async function source(path) {
  return readFile(path, "utf8");
}

async function json(path) {
  return JSON.parse(await source(path));
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert(!text.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

function assertIncludesAll(items, expectedItems, label) {
  for (const expected of expectedItems) {
    assert(items.includes(expected), `${label}_missing:${expected}`);
  }
}

function extractContract(markdown) {
  const start = markdown.indexOf(startMarker);
  assert.notEqual(start, -1, "ui_design_quality_contract_start_marker_missing");
  const end = markdown.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, "ui_design_quality_contract_end_marker_missing");
  assert.equal(markdown.indexOf(startMarker, start + startMarker.length), -1, "ui_design_quality_contract_start_marker_must_be_unique");
  assert.equal(markdown.indexOf(endMarker, end + endMarker.length), -1, "ui_design_quality_contract_end_marker_must_be_unique");

  const block = markdown.slice(start + startMarker.length, end).trim();
  const match = /^```json\n([\s\S]+)\n```$/u.exec(block);
  assert(match, "ui_design_quality_contract_must_be_single_json_fence");
  return JSON.parse(match[1]);
}

const [
  contractMarkdown,
  contractIndex,
  gapMatrix,
  currentGoal,
  verifyManifest,
  mvpAcceptance,
  mvpSuite,
] = await Promise.all([
  source(contractPath),
  source(contractIndexPath),
  source(gapMatrixPath),
  json(currentGoalPath),
  json(verifyManifestPath),
  source(mvpAcceptancePath),
  source(mvpSuitePath),
]);

const contract = extractContract(contractMarkdown);

assert.equal(contract.contract, "v22_portal_ui_design_quality_audit_boundary", "contract_name_mismatch");
assert.equal(contract.model, "gpt-5.4", "contract_model_mismatch");
assert.equal(contract.contractRole, "boundary_and_rubric_only", "contract_role_mismatch");
assert.equal(contract.scope.implementsUi, false, "audit_contract_must_not_implement_ui");
assert.equal(contract.scope.prescribesSpecificAestheticSolution, false, "audit_contract_must_not_prescribe_aesthetic_solution");
assert.equal(contract.scope.callsRealCloud, false, "audit_contract_must_not_call_real_cloud");
assert.equal(contract.scope.readsSecrets, false, "audit_contract_must_not_read_secrets");
assert.equal(contract.scope.modifiesUpstream, false, "audit_contract_must_not_modify_upstream");
assert.equal(contract.scope.modifiesServices, false, "audit_contract_must_not_modify_services_in_this_leaf");
assert.equal(contract.scope.migratesFrontendStack, false, "audit_contract_must_not_migrate_frontend_stack");
assert.equal(contract.auditOutput.reportPath, ".runtime/portal-ui-design-quality/report.json", "audit_report_path_mismatch");
assert.equal(contract.auditOutput.committedToGit, false, "audit_report_must_not_be_committed");
assert.equal(contract.baselinePolicy.intentionalRedesignCanUpdateScreenshots, true, "intentional_redesign_baseline_policy_missing");
assert.equal(contract.baselinePolicy.requiresAuditEvidenceBeforeBaselineUpdate, true, "baseline_update_must_require_audit_evidence");

assertIncludesAll(contract.mainlineQuestions, requiredUserQuestions, "mainline_question");
assertIncludesAll(contract.hardRubric, requiredHardRubric, "hard_rubric");
assertIncludesAll(contract.softRubric, requiredSoftRubric, "soft_rubric");
assertIncludesAll(contract.referenceBoundaries, requiredReferenceBoundaries, "reference_boundary");
assertIncludesAll(contract.validationCommands, [
  "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
  "node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface",
  "npm --prefix services/portal/frontend run test:visual",
], "validation_command");

assertIncludes(contractMarkdown, "本合同只定义边界和评价标准，不规定具体审美解法", "contract_must_state_no_aesthetic_lock");
assertIncludes(contractMarkdown, "硬约束用于阻断污染和基础可用性退化", "contract_must_define_hard_rubric_role");
assertIncludes(contractMarkdown, "软评分用于形成审计报告", "contract_must_define_soft_rubric_role");
assertIncludes(contractMarkdown, "现代 SaaS 工作台", "contract_must_reference_modern_saas_workbench");
assertIncludes(contractMarkdown, "托管 OPL 科研工作台服务", "contract_must_keep_service_product_truth");
assertIncludes(contractMarkdown, "不得重做 OPL chatbot", "contract_must_keep_opl_chatbot_boundary");
assertIncludes(contractMarkdown, "不得把 Portal 做成云资源控制台", "contract_must_keep_no_cloud_console_boundary");
assertIncludes(contractMarkdown, ".runtime/portal-ui-design-quality/report.json", "contract_must_define_runtime_report");
assertIncludes(contractMarkdown, "截图 baseline 可以因有意 redesign 更新", "contract_must_define_baseline_policy");
assertIncludes(contractMarkdown, "外部 UI/UX best practices", "contract_must_allow_best_practices_reference");
assertIncludes(contractMarkdown, "只能作为表达质量参考", "contract_must_limit_best_practices_to_expression");
assertIncludes(contractMarkdown, "内容语义必须由 v22 合同固定", "contract_must_fix_content_semantics_by_contracts");
assertIncludes(contractMarkdown, "不得把 Vue 3 + Vite + TypeScript + Pinia 迁成 React/Vercel", "contract_must_preserve_frontend_stack");

for (const forbidden of forbiddenDesignLocks) {
  assertExcludes(contractMarkdown, forbidden, "contract_must_not_lock_specific_visual_solution");
}

assertIncludes(contractIndex, "v22-portal-ui-design-quality-audit-boundary.md", "contract_index_must_reference_audit_contract");
assertIncludes(contractIndex, "UI design quality audit", "contract_index_must_name_audit_leaf");
assertIncludes(contractIndex, "不替代 UI composition 合同", "contract_index_must_preserve_composition_contract");
assertIncludes(contractIndex, "不冻结具体布局、配色、字体、圆角或组件库", "contract_index_must_not_freeze_design_solution");

assertIncludes(gapMatrix, "leaf-portal-ui-design-quality-audit", "gap_matrix_must_record_audit_leaf");
assertIncludes(gapMatrix, "v22-portal-ui-design-quality-audit-boundary.md", "gap_matrix_must_reference_audit_contract");
assertIncludes(gapMatrix, "status: in_progress", "gap_matrix_must_mark_frontend_gap_in_progress");
assertIncludes(gapMatrix, "cursor_eligible: true", "gap_matrix_must_make_frontend_gap_cursor_eligible");

const frontendGap = currentGoal.gaps.find((gap) => gap.id === "frontend-product-vue-vite-ts-pinia");
assert(frontendGap, "frontend_gap_missing_from_current_goal");
assert.equal(frontendGap.next_leaf_step, "leaf-portal-ui-design-quality-audit", "frontend_gap_next_leaf_must_be_ui_design_quality_audit");
assert.equal(frontendGap.status, "in_progress", "frontend_gap_must_be_current_in_progress");
assert.equal(frontendGap.cursor_eligible, true, "frontend_gap_must_be_current_cursor");
assert.equal(currentGoal.current_cursor, "leaf-portal-ui-design-quality-audit", "current_goal_must_advance_to_ui_design_quality_audit");
assert.equal(currentGoal.current_stage, "S5 frontend/backend product completion", "current_goal_stage_must_be_s5");

const manifestLeaf = verifyManifest.leaves.find((leaf) => leaf.leaf_id === "leaf-portal-ui-design-quality-audit");
assert(manifestLeaf, "verify_manifest_must_define_ui_design_quality_leaf");
assert.equal(manifestLeaf.risk_class, "local_doc_eval", "ui_design_quality_leaf_risk_mismatch");
assert.equal(manifestLeaf.live_external_allowed, false, "ui_design_quality_leaf_must_not_allow_live_external");
assert(manifestLeaf.contracts.includes(contractPath), "ui_design_quality_leaf_must_subscribe_contract");
assert(manifestLeaf.verification_commands.includes("node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs"), "ui_design_quality_leaf_must_run_audit_smoke");
assert(manifestLeaf.forbidden_files.includes("services/*"), "ui_design_quality_contract_leaf_must_forbid_services_implementation");

const designPackage = verifyManifest.package_suites.find((suite) => suite.id === "portal-ui-design-quality");
assert(designPackage, "verify_manifest_must_define_design_quality_package_suite");
assert(designPackage.commands.includes("node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs"), "design_quality_package_must_run_audit_smoke");
assert(designPackage.commands.includes("node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface"), "design_quality_package_must_run_surface_runtime_suite");
assert(designPackage.commands.includes("npm --prefix services/portal/frontend run test:visual"), "design_quality_package_must_run_visual_test");
assert(!designPackage.commands.includes("node scripts/smoke-test-v22-portal-runtime-suite.mjs --group all"), "design_quality_package_must_not_pull_unrelated_all_suite");

assertIncludes(mvpAcceptance, "Portal UI design quality audit boundary", "mvp_acceptance_must_record_audit_boundary");
assertIncludes(mvpSuite, "smoke-test-v22-portal-ui-design-quality-audit", "mvp_suite_must_include_audit_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  checked: [
    contractPath,
    contractIndexPath,
    gapMatrixPath,
    currentGoalPath,
    verifyManifestPath,
    mvpAcceptancePath,
    mvpSuitePath,
  ],
}, null, 2));
