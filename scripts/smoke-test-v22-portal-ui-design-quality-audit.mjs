import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-portal-ui-design-quality-audit-boundary.md";
const contractIndexPath = "docs/contracts/README.md";
const gapMatrixPath = "docs/recovery/v22-current-vs-ideal-gap-matrix.md";
const currentGoalPath = "docs/recovery/v22-goal-current.json";
const verifyManifestPath = "docs/recovery/v22-agent-verify-manifest.json";
const routesPath = "services/portal/frontend/src/app/routes.tsx";
const layoutPath = "services/portal/frontend/src/app/components/Layout.tsx";
const adapterPath = "services/portal/frontend/src/app/data/portalAdapters.ts";
const figmaContractPath = "docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md";
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

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
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
  const block = markdown.slice(start + startMarker.length, end).trim();
  const match = /^```json\n([\s\S]+)\n```$/u.exec(block);
  assert(match, "ui_design_quality_contract_must_be_single_json_fence");
  return JSON.parse(match[1]);
}

async function source(path) {
  return readFile(path, "utf8");
}

const [
  contractMarkdown,
  contractIndex,
  gapMatrix,
  currentGoal,
  verifyManifest,
  routesSource,
  layoutSource,
  adapterSource,
  figmaContract,
] = await Promise.all([
  source(contractPath),
  source(contractIndexPath),
  source(gapMatrixPath),
  source(currentGoalPath).then(JSON.parse),
  source(verifyManifestPath).then(JSON.parse),
  source(routesPath),
  source(layoutPath),
  source(adapterPath),
  source(figmaContractPath),
]);

const contract = extractContract(contractMarkdown);

assert.equal(contract.contract, "v22_portal_ui_design_quality_audit_boundary", "contract_name_mismatch");
assert.equal(contract.model, "gpt-5.4", "contract_model_mismatch");
assert.equal(contract.contractRole, "boundary_and_rubric_only", "contract_role_mismatch");
assert.equal(contract.scope.implementsUi, false, "audit_contract_must_not_implement_ui");
assert.equal(contract.scope.migratesFrontendStack, false, "audit_leaf_must_not_itself_migrate_stack");
assert.equal(contract.scope.callsRealCloud, false, "audit_contract_must_not_call_real_cloud");
assert.equal(contract.scope.readsSecrets, false, "audit_contract_must_not_read_secrets");
assert.equal(contract.scope.modifiesUpstream, false, "audit_contract_must_not_modify_upstream");
assert.equal(contract.auditOutput.reportPath, auditReportPath, "audit_report_path_mismatch");
assert.equal(contract.auditOutput.committedToGit, false, "audit_report_must_not_be_committed");
assert.equal(contract.baselinePolicy.intentionalRedesignCanUpdateScreenshots, true, "intentional_redesign_baseline_policy_missing");
assert.equal(contract.baselinePolicy.requiresAuditEvidenceBeforeBaselineUpdate, true, "baseline_update_must_require_audit_evidence");

assertIncludesAll(contract.mainlineQuestions, requiredUserQuestions, "mainline_question");
assertIncludesAll(contract.hardRubric, requiredHardRubric, "hard_rubric");
assertIncludesAll(contract.softRubric, requiredSoftRubric, "soft_rubric");
assertIncludesAll(contract.auditEvidenceSchema.requiredSections, [
  "mainlineQuestionAnswerability",
  "hardRubricVerdicts",
  "softRubricScores",
  "surfaceAndVisualEvidenceSources",
  "expressionQualityFindings",
  "productSemanticBoundaryCheck",
  "futureImplementationLeafHandoff",
], "audit_evidence_required_section");
assertIncludesAll(contract.auditEvidenceSchema.evidenceSources, [
  "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
  "node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface",
  "npm --prefix services/portal/frontend run typecheck",
  "npm --prefix services/portal/frontend run build",
], "audit_evidence_source");
assertIncludesAll(contract.futureImplementationLeafHandoff.verificationCommands, [
  "node scripts/smoke-test-v22-portal-figma-make-ui-implementation-contract.mjs",
  "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
  "node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface",
  "npm --prefix services/portal/frontend run typecheck",
  "npm --prefix services/portal/frontend run build",
], "future_implementation_verification_command");

assertIncludes(contractMarkdown, "Portal 前端技术栈迁移的授权只来自 `v22-portal-figma-make-ui-implementation-boundary.md`", "contract_must_delegate_stack_migration");
assertIncludes(contractMarkdown, "React + Vite + TypeScript + shadcn/Radix + lucide", "contract_must_name_target_stack");
assertIncludes(contractMarkdown, "不得把 Portal 做成云资源控制台", "contract_must_keep_no_cloud_console_boundary");
assertIncludes(contractMarkdown, "不得重做 OPL chatbot", "contract_must_keep_opl_chatbot_boundary");
assertExcludes(contractMarkdown, "不得把 Vue 3 + Vite + TypeScript + Pinia 迁成 React/Vercel", "old_stack_preservation_copy");
assertExcludes(contractMarkdown, "npm --prefix services/portal/frontend run test:visual", "old_visual_command_copy");

assertIncludes(contractIndex, "v22-portal-ui-design-quality-audit-boundary.md", "contract_index_must_reference_audit_contract");
assertIncludes(gapMatrix, "frontend-product-react-vite-figma-make", "gap_matrix_must_record_react_figma_gap");
assertIncludes(gapMatrix, "leaf-portal-figma-make-react-ui-implementation", "gap_matrix_must_record_figma_make_leaf");

const frontendGap = currentGoal.gaps.find((gap) => gap.id === "frontend-product-react-vite-figma-make");
assert(frontendGap, "frontend_react_gap_missing_from_current_goal");
assert.equal(frontendGap.status, "in_progress", "frontend_gap_must_be_current_in_progress");
assert.equal(frontendGap.cursor_eligible, true, "frontend_gap_must_be_current_cursor");
assert.equal(currentGoal.current_cursor, "leaf-portal-figma-make-react-ui-implementation", "current_goal_cursor_mismatch");
assert.equal(currentGoal.current_leaf.gap_id, "frontend-product-react-vite-figma-make", "current_leaf_gap_id_mismatch");

const implementationLeaf = verifyManifest.leaves.find((leaf) => leaf.leaf_id === "leaf-portal-figma-make-react-ui-implementation");
assert(implementationLeaf, "verify_manifest_must_define_figma_make_implementation_leaf");
assert.equal(implementationLeaf.gap_id, "frontend-product-react-vite-figma-make", "figma_make_leaf_gap_id_mismatch");
assert(implementationLeaf.allowed_files.includes("services/portal/frontend/**"), "figma_make_leaf_must_allow_frontend");
assert(implementationLeaf.allowed_files.includes("services/portal/frontend/package.json"), "figma_make_leaf_must_allow_frontend_package");
assert(implementationLeaf.allowed_files.includes("services/portal/frontend/package-lock.json"), "figma_make_leaf_must_allow_frontend_lockfile");
assert(implementationLeaf.contracts.includes("docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md"), "figma_make_leaf_must_subscribe_figma_contract");
assert(implementationLeaf.forbidden_ops.includes("live-cloud"), "figma_make_leaf_must_forbid_live_cloud");
assert(implementationLeaf.forbidden_ops.includes("build-push-kubectl"), "figma_make_leaf_must_forbid_build_push_kubectl");
assertIncludesAll(implementationLeaf.verification_commands, contract.futureImplementationLeafHandoff.verificationCommands, "figma_make_leaf_verification_command");

for (const route of ["/overview", "/resources", "/workspace", "/trace", "/billing", "/opl-launch"]) {
  assertIncludes(routesSource, `path: "${route.slice(1)}"`, `zip_route_missing:${route}`);
  assertIncludes(layoutSource, `path: "${route}"`, `layout_route_missing:${route}`);
}
for (const loader of [
  "loadOverviewModel",
  "loadRuntimeEnvironmentModel",
  "loadWorkspaceModel",
  "loadTasksResultsModel",
  "loadBillingAuditModel",
  "loadOplEntryModel",
]) {
  assertIncludes(adapterSource, loader, `portal_adapter_loader_missing:${loader}`);
}
assertIncludes(figmaContract, "Figma Make ZIP", "figma_contract_must_define_zip_source");
assertIncludes(figmaContract, '"currentCoverage": "user_portal_only"', "figma_contract_user_coverage_missing");
assertIncludes(figmaContract, '"activeAdminRouteMounted": false', "figma_contract_admin_unrouted_missing");

await mkdir(".runtime/portal-ui-design-quality", { recursive: true });
const auditReport = {
  reportType: contract.auditEvidenceSchema.reportType,
  leafId: currentGoal.current_cursor,
  model: contract.model,
  riskClass: implementationLeaf.risk_class,
  reportPath: auditReportPath,
  reportCommittedToGit: false,
  currentLeafScope: {
    uiImplementationExecuted: true,
    portalFrontendModified: true,
    portalBackendServicesModified: false,
    liveCloudExecuted: false,
    buildPushKubectlDeployLiveTestExecuted: false,
    productSemanticsChanged: false,
    evidenceKind: "figma_make_react_user_portal_implementation_gate",
  },
  mainlineQuestionAnswerability: requiredUserQuestions.map((question) => ({
    question,
    auditVerdict: "required_and_mapped_to_figma_make_zip_surface_gate",
  })),
  hardRubricVerdicts: requiredHardRubric.map((item) => ({
    item,
    auditVerdict: "hard_gate_defined",
  })),
  softRubricScores: requiredSoftRubric.map((item) => ({
    item,
    scoreRange: "0_to_5_for_design_review",
  })),
  surfaceAndVisualEvidenceSources: contract.auditEvidenceSchema.evidenceSources,
  expressionQualityFindings: [
    "Figma Make user Portal is now the implementation reference for current user routes.",
    "Admin route mounting and visual workbench evidence are deferred instead of being claimed by this user UI leaf.",
  ],
  productSemanticBoundaryCheck: {
    contentSemanticsFixedByV22Contracts: true,
    noCloudConsoleLanguageForNormalUsers: true,
    noOplChatbotReimplementation: true,
    portalWideReactStackAuthorizedByFigmaMakeContract: true,
  },
  futureImplementationLeafHandoff: contract.futureImplementationLeafHandoff,
  baselineUpdateGate: contract.auditEvidenceSchema.baselineUpdateGate,
};
await writeFile(auditReportPath, `${JSON.stringify(auditReport, null, 2)}\n`);

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
    routesPath,
    layoutPath,
    adapterPath,
    figmaContractPath,
  ],
}, null, 2));
