import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-portal-ui-design-quality-audit-boundary.md";
const contractIndexPath = "docs/contracts/README.md";
const gapMatrixPath = "docs/recovery/v22-current-vs-ideal-gap-matrix.md";
const currentGoalPath = "docs/recovery/v22-goal-current.json";
const verifyManifestPath = "docs/recovery/v22-agent-verify-manifest.json";
const mvpAcceptancePath = "docs/recovery/mvp-contract-acceptance.md";
const mvpSuitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";
const auditReportPath = ".runtime/portal-ui-design-quality/report.json";

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

const requiredFutureForbiddenAllowedFilePatterns = [
  "services/portal/**/backend_or_api_except_frontend",
  "package_or_dependency_files",
  "deploy/*",
  "adapters/*",
  ".sentrux/*",
  "upstream/*",
  "secret-like paths",
  "true cloud runners",
];

const requiredFutureForbiddenVerificationCommandPatterns = [
  "build/push/kubectl",
  "deploy",
  "live-test",
  "live-cloud",
  "secret-read",
  "dependency-upgrade",
];

async function source(path) {
  return readFile(path, "utf8");
}

async function json(path) {
  return JSON.parse(await source(path));
}

function git(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_${args.join("_")}_failed:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function isAncestor(base, head) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", base, head], {
    encoding: "utf8",
    stdio: "pipe",
  });
  return result.status === 0;
}

async function writeAuditReport(report) {
  await mkdir(".runtime/portal-ui-design-quality", { recursive: true });
  await writeFile(auditReportPath, `${JSON.stringify(report, null, 2)}\n`);
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

function assertNoFutureAllowedFileExpansion(items, label) {
  for (const item of items) {
    const value = String(item);
    assert(value === "services/portal/frontend/**" || !value.startsWith("services/portal/"), `${label}_forbidden_backend_or_api_surface:${value}`);
    assert(!/^package(?:-lock)?\.json$/u.test(value), `${label}_forbidden_package_file:${value}`);
    assert(!/^(?:[^/]+\/)*package(?:-lock)?\.json$/u.test(value), `${label}_forbidden_nested_package_file:${value}`);
    assert(!/^(?:pnpm-lock|yarn.lock|package-lock\.json|npm-shrinkwrap\.json)$/u.test(value), `${label}_forbidden_dependency_lock:${value}`);
    assert(!value.startsWith("deploy/"), `${label}_forbidden_deploy_path:${value}`);
    assert(!value.startsWith("adapters/"), `${label}_forbidden_adapters_path:${value}`);
    assert(!value.startsWith(".sentrux/"), `${label}_forbidden_sentrux_path:${value}`);
    assert(!value.startsWith("upstream/") && !value.startsWith("one-person-lab/"), `${label}_forbidden_upstream_path:${value}`);
    assert(!/(?:^|\/)(?:\.env|secret|secrets|token|kubeconfig|private-key|credentials)(?:$|[./_-])/iu.test(value), `${label}_forbidden_secret_like_path:${value}`);
  }
}

function assertNoFutureCommandExpansion(commands, label) {
  for (const command of commands) {
    const value = String(command);
    assert(!/\b(?:build|push|kubectl)\b/iu.test(value), `${label}_forbidden_build_push_kubectl:${value}`);
    assert(!/\bdeploy\b/iu.test(value), `${label}_forbidden_deploy:${value}`);
    assert(!/live[-_ ]?test/iu.test(value), `${label}_forbidden_live_test:${value}`);
    assert(!/live[-_ ]?cloud|true[-_ ]?cloud/iu.test(value), `${label}_forbidden_live_cloud:${value}`);
    assert(!/secret|kubeconfig|token|SecretId|SecretKey/iu.test(value), `${label}_forbidden_secret_read:${value}`);
    assert(!/\b(?:npm|pnpm|yarn)\s+(?:install|add|update|upgrade)\b/iu.test(value), `${label}_forbidden_dependency_command:${value}`);
  }
}

function assertCurrentGitTruth(currentGoal) {
  const branch = git(["branch", "--show-current"]);
  const originHead = git(["rev-parse", "origin/recovery/platform-v22-trunk"]);
  const localHead = git(["rev-parse", "HEAD"]);
  const localHeadParent = git(["rev-parse", "HEAD^"]);
  assert(
    branch === currentGoal.authoring_branch || branch === currentGoal.target_branch,
    `audit_leaf_runtime_branch_mismatch:${branch}`,
  );
  assert.equal(currentGoal.branch_baseline, "origin/recovery/platform-v22-trunk", "audit_leaf_branch_baseline_mismatch");
  assert.equal(currentGoal.current_branch, currentGoal.authoring_branch, "audit_leaf_current_branch_must_record_authoring_branch");
  assert.equal(currentGoal.git_observation?.observed_git_head, currentGoal.base_trunk_head, "audit_leaf_observed_git_head_must_record_base");
  assert.equal(currentGoal.last_absorbed_commit, currentGoal.base_trunk_head, "audit_leaf_last_absorbed_must_record_base");
  if (branch === currentGoal.authoring_branch) {
    assert.equal(originHead, currentGoal.base_trunk_head, "audit_leaf_authoring_origin_must_match_base");
    assert.notEqual(localHead, currentGoal.base_trunk_head, "audit_leaf_authoring_head_must_be_ahead_of_base");
    assert.equal(localHeadParent, currentGoal.base_trunk_head, "audit_leaf_authoring_parent_must_match_base");
  } else {
    assert.equal(localHead, originHead, "audit_leaf_target_head_must_match_origin");
    assert.notEqual(localHead, currentGoal.base_trunk_head, "audit_leaf_target_head_must_not_remain_at_base");
    assert(
      localHeadParent === currentGoal.base_trunk_head || isAncestor(currentGoal.base_trunk_head, localHead),
      "audit_leaf_target_head_must_descend_from_base",
    );
  }
  assert.equal(currentGoal.current_cursor, "leaf-portal-ui-design-quality-audit", "audit_leaf_cursor_must_not_advance");
  assert.equal(currentGoal.next_leaf, "leaf-portal-ui-design-quality-audit", "audit_leaf_next_leaf_must_not_advance");
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
assert.equal(contract.auditEvidenceSchema.reportPath, ".runtime/portal-ui-design-quality/report.json", "audit_evidence_schema_report_path_mismatch");
assert.equal(contract.auditEvidenceSchema.reportType, "portal_ui_design_quality_audit_evidence", "audit_evidence_schema_report_type_mismatch");
assert.equal(contract.auditEvidenceSchema.reportCommittedToGit, false, "audit_evidence_schema_must_stay_runtime_only");
assertIncludesAll(contract.auditEvidenceSchema.requiredSections, [
  "mainlineQuestionAnswerability",
  "hardRubricVerdicts",
  "softRubricScores",
  "surfaceAndVisualEvidenceSources",
  "expressionQualityFindings",
  "productSemanticBoundaryCheck",
  "futureImplementationLeafHandoff",
], "audit_evidence_required_section");
assertIncludesAll(contract.auditEvidenceSchema.requiredMainlineQuestionVerdicts, requiredUserQuestions, "audit_evidence_mainline_question_verdict");
assertIncludesAll(contract.auditEvidenceSchema.requiredHardRubricVerdicts, requiredHardRubric, "audit_evidence_hard_rubric_verdict");
assertIncludesAll(contract.auditEvidenceSchema.requiredSoftRubricScores, requiredSoftRubric, "audit_evidence_soft_rubric_score");
assertIncludesAll(contract.auditEvidenceSchema.evidenceSources, [
  "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
  "node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface",
  "npm --prefix services/portal/frontend run test:visual",
], "audit_evidence_source");
assert.equal(contract.auditEvidenceSchema.findingScope, "expression_quality_only_not_product_semantics", "audit_evidence_finding_scope_mismatch");
assert.equal(contract.auditEvidenceSchema.baselineUpdateGate.requiresReportBeforeScreenshotBaselineUpdate, true, "baseline_update_gate_must_require_report");
assert.equal(contract.auditEvidenceSchema.baselineUpdateGate.reportPath, ".runtime/portal-ui-design-quality/report.json", "baseline_update_gate_report_path_mismatch");

assert.equal(contract.futureImplementationLeafHandoff.leafIntent, "portal_ui_design_quality_implementation", "future_implementation_leaf_intent_mismatch");
assertIncludesAll(contract.futureImplementationLeafHandoff.allowedFiles, [
  "services/portal/frontend/**",
  "docs/contracts/v22-portal-ui-design-quality-audit-boundary.md",
  "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md",
  "docs/contracts/v22-saas-control-plane-user-experience-boundary.md",
  "docs/contracts/README.md",
  "docs/recovery/v22-goal-current.json",
  "docs/recovery/v22-goal-state.md",
  "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  "docs/recovery/v22-agent-verify-manifest.json",
  "docs/recovery/mvp-contract-acceptance.md",
  "scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
  "scripts/smoke-test-v22-portal-runtime-suite.mjs",
], "future_implementation_allowed_file");
assertIncludesAll(contract.futureImplementationLeafHandoff.verificationCommands, [
  "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
  "node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface",
  "npm --prefix services/portal/frontend run test:visual",
  "node scripts/smoke-test-v22-contract-conflict-boundary.mjs",
  "node scripts/smoke-test-v22-goal-state-consistency.mjs",
  "node scripts/smoke-test-v22-agent-verify-entrypoint.mjs",
  "node scripts/smoke-test-v22-product-goal-harness.mjs",
  "git diff --check -- docs/contracts docs/recovery scripts services/portal/frontend",
], "future_implementation_verification_command");
assertIncludesAll(contract.futureImplementationLeafHandoff.truthWritebackTarget, [
  "docs/contracts/v22-portal-ui-design-quality-audit-boundary.md",
  "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md",
  "docs/contracts/README.md",
  "docs/recovery/v22-goal-current.json",
  "docs/recovery/v22-goal-state.md",
  "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  "docs/recovery/mvp-contract-acceptance.md",
], "future_implementation_truth_writeback_target");
assertIncludesAll(contract.futureImplementationLeafHandoff.stopConditions, [
  "requires_backend_services_change",
  "requires_package_or_dependency_change",
  "requires_secret_or_live_cloud",
  "requires_deploy_build_push_kubectl_or_live_test",
  "changes_product_semantics_instead_of_expression_quality",
  "updates_screenshot_baseline_without_runtime_audit_report",
], "future_implementation_stop_condition");
assertIncludesAll(contract.futureImplementationLeafHandoff.forbiddenAllowedFilePatterns, requiredFutureForbiddenAllowedFilePatterns, "future_implementation_forbidden_allowed_file_pattern");
assertIncludesAll(contract.futureImplementationLeafHandoff.forbiddenVerificationCommandPatterns, requiredFutureForbiddenVerificationCommandPatterns, "future_implementation_forbidden_verification_command_pattern");
assertNoFutureAllowedFileExpansion(contract.futureImplementationLeafHandoff.allowedFiles, "future_implementation_allowed_files");
assertNoFutureCommandExpansion(contract.futureImplementationLeafHandoff.verificationCommands, "future_implementation_verification_commands");

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
assertIncludes(contractMarkdown, "后续 UI implementation leaf handoff", "contract_must_define_future_implementation_handoff");
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
assertIncludes(contractIndex, "`.runtime/portal-ui-design-quality/report.json`", "contract_index_must_reference_audit_report_path");

assertIncludes(gapMatrix, "leaf-portal-ui-design-quality-audit", "gap_matrix_must_record_audit_leaf");
assertIncludes(gapMatrix, "v22-portal-ui-design-quality-audit-boundary.md", "gap_matrix_must_reference_audit_contract");
assertIncludes(gapMatrix, "status: in_progress", "gap_matrix_must_mark_frontend_gap_in_progress");
assertIncludes(gapMatrix, "cursor_eligible: true", "gap_matrix_must_make_frontend_gap_cursor_eligible");
assertIncludes(gapMatrix, "future UI implementation leaf handoff", "gap_matrix_must_record_future_ui_implementation_handoff");
assertIncludes(gapMatrix, "git diff --check -- docs/contracts docs/recovery scripts services/portal/frontend", "gap_matrix_must_record_future_ui_diff_check");

const frontendGap = currentGoal.gaps.find((gap) => gap.id === "frontend-product-vue-vite-ts-pinia");
assert(frontendGap, "frontend_gap_missing_from_current_goal");
assert.equal(frontendGap.next_leaf_step, "leaf-portal-ui-design-quality-audit", "frontend_gap_next_leaf_must_be_ui_design_quality_audit");
assert.equal(frontendGap.status, "in_progress", "frontend_gap_must_be_current_in_progress");
assert.equal(frontendGap.cursor_eligible, true, "frontend_gap_must_be_current_cursor");
assert.equal(currentGoal.current_cursor, "leaf-portal-ui-design-quality-audit", "current_goal_must_advance_to_ui_design_quality_audit");
assert.equal(currentGoal.current_stage, "S5 frontend/backend product completion", "current_goal_stage_must_be_s5");
assertCurrentGitTruth(currentGoal);

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
assertIncludes(mvpAcceptance, "audit evidence schema", "mvp_acceptance_must_record_audit_evidence_schema");
assertIncludes(mvpSuite, "smoke-test-v22-portal-ui-design-quality-audit", "mvp_suite_must_include_audit_smoke");

const auditReport = {
  reportType: contract.auditEvidenceSchema.reportType,
  leafId: "leaf-portal-ui-design-quality-audit",
  model: contract.model,
  riskClass: manifestLeaf.risk_class,
  reportPath: auditReportPath,
  reportCommittedToGit: false,
  currentLeafScope: {
    uiImplementationExecuted: false,
    servicesModified: false,
    liveCloudExecuted: false,
    buildPushKubectlDeployLiveTestExecuted: false,
    productSemanticsChanged: false,
    evidenceKind: "contract_rubric_eval_and_truth_writeback",
  },
  mainlineQuestionAnswerability: requiredUserQuestions.map((question) => ({
    question,
    auditVerdict: "rubric_required_for_future_ui_implementation",
    evidenceRequiredFrom: [
      "page_information_architecture",
      "state_empty_loading_error_surfaces",
      "operation_area",
      "billing_summary",
    ],
  })),
  hardRubricVerdicts: requiredHardRubric.map((item) => ({
    item,
    auditVerdict: "hard_gate_defined",
    failurePolicy: "blocks_baseline_or_implementation_claim",
  })),
  softRubricScores: requiredSoftRubric.map((item) => ({
    item,
    auditVerdict: "scoring_axis_defined",
    scoreRange: "0_to_5_for_future_implementation_report",
  })),
  surfaceAndVisualEvidenceSources: contract.auditEvidenceSchema.evidenceSources.map((command) => ({
    command,
    requiredForCurrentLeaf: command === "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
    requiredForFutureImplementationLeaf: true,
  })),
  expressionQualityFindings: [
    "audit_requires_service_clarity_next_action_clarity_workbench_scanability_and_mainline_question_coverage",
    "audit_may_reference_external_ui_ux_best_practices_only_for_expression_quality",
  ],
  productSemanticBoundaryCheck: {
    contentSemanticsFixedByV22Contracts: true,
    noCloudConsoleLanguageForNormalUsers: true,
    noOplChatbotReimplementation: true,
    vueViteTsPiniaPreserved: true,
  },
  futureImplementationLeafHandoff: contract.futureImplementationLeafHandoff,
  baselineUpdateGate: contract.auditEvidenceSchema.baselineUpdateGate,
};

await writeAuditReport(auditReport);

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  auditEvidenceReport: auditReportPath,
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
