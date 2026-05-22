import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const specsPath = "docs/specs/README.md";
const productPath = "docs/product/README.md";
const activePath = "docs/active/README.md";

const packageStartMarker = "<!-- v22-commercial-package-model:start -->";
const packageEndMarker = "<!-- v22-commercial-package-model:end -->";
const uiStartMarker = "<!-- v22-commercial-ui-impact-decision:start -->";
const uiEndMarker = "<!-- v22-commercial-ui-impact-decision:end -->";

function extractJson(markdown, startMarker, endMarker, label) {
  const start = markdown.indexOf(startMarker);
  assert.notEqual(start, -1, `${label}_start_marker_missing`);
  const end = markdown.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${label}_end_marker_missing`);
  assert.equal(markdown.indexOf(startMarker, start + startMarker.length), -1, `${label}_start_marker_must_be_unique`);
  assert.equal(markdown.indexOf(endMarker, end + endMarker.length), -1, `${label}_end_marker_must_be_unique`);
  const block = markdown.slice(start + startMarker.length, end).trim();
  const match = /^```json\n([\s\S]+)\n```$/u.exec(block);
  assert(match, `${label}_must_be_single_json_fence`);
  return JSON.parse(match[1]);
}

function assertIncludes(source, expected, label) {
  assert(String(source).includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert.equal(String(source).includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function extractSection(markdown, heading) {
  const pattern = new RegExp(`## ${heading}\\n(?<section>[\\s\\S]*?)(?=\\n## |\\n$)`, "u");
  const match = markdown.match(pattern);
  assert(match?.groups?.section, `section_missing:${heading}`);
  return match.groups.section;
}

function assertCommercialPackageModel({ specs, product, active }) {
  const model = extractJson(specs, packageStartMarker, packageEndMarker, "commercial_package_model");
  const packageIds = model.packages.map((item) => item.id);
  const productCommercialSection = extractSection(product, "Commercial Package Model");
  const activeCommercialSection = extractSection(active, "商业化主链路");

  assert.equal(model.contract, "v22_commercial_package_model", "commercial_package_model_contract_mismatch");
  assert.equal(model.version, 1, "commercial_package_model_version_mismatch");
  assert.deepEqual(packageIds, ["api_only", "full_runtime", "customer_dedicated"], "commercial_package_model_order_mismatch");
  assert.equal(model.customerRule.anyoneCanEnterOpl, true, "anyone_can_enter_opl_rule_mismatch");
  assert.equal(model.customerRule.medoplRequiredForCloudCompute, true, "medopl_cloud_compute_gate_mismatch");
  assert.equal(model.customerRule.portalIsCloudConsole, false, "portal_must_not_be_cloud_console");
  assert.equal(model.customerRule.ordinaryUserSelfConfiguresCloud, false, "ordinary_user_must_not_self_configure_cloud");

  const byId = new Map(model.packages.map((item) => [item.id, item]));
  assert.deepEqual(byId.get("api_only").includes, [
    "账号",
    "工作空间",
    "OPL 入口",
    "用户自己的 gflabtoken providerKeyRef",
    "文件/任务/结果索引",
  ], "api_only_includes_mismatch");
  assert.equal(byId.get("api_only").allowsPlatformManagedCompute, false, "api_only_must_not_allow_platform_compute");
  assert.equal(byId.get("full_runtime").allowsPlatformManagedCompute, true, "full_runtime_must_allow_platform_compute");
  assert.equal(byId.get("full_runtime").requiresBalanceFreeze, true, "full_runtime_must_require_balance_freeze");
  assert.equal(byId.get("full_runtime").requiresFileSpace, true, "full_runtime_must_require_file_space");
  assert.equal(byId.get("customer_dedicated").allowsPlatformManagedCompute, true, "customer_dedicated_must_allow_compute");
  assert.equal(byId.get("customer_dedicated").isolation, "dedicated_runtime_boundary", "customer_dedicated_isolation_mismatch");

  for (const packageModel of model.packages) {
    assertNotIncludes(JSON.stringify(packageModel), "CVM", `package_${packageModel.id}`);
    assertNotIncludes(JSON.stringify(packageModel), "COS", `package_${packageModel.id}`);
    assertNotIncludes(JSON.stringify(packageModel), "K8s", `package_${packageModel.id}`);
    assertNotIncludes(JSON.stringify(packageModel), "云资源控制台", `package_${packageModel.id}`);
  }
  assertIncludes(specs, "### spec:v22-commercial-package-model", "specs_anchor");
  assertIncludes(productCommercialSection, "谁都可以进入 OPL", "product_anyone_can_enter_opl");
  assertIncludes(productCommercialSection, "需要平台托管计算、文件空间、隔离环境、计费和审计时，必须进入 MedOPL", "product_medopl_cloud_gate");
  assertIncludes(activeCommercialSection, "api_only", "active_api_only");
  assertIncludes(activeCommercialSection, "full_runtime", "active_full_runtime");
  assertIncludes(activeCommercialSection, "customer_dedicated", "active_customer_dedicated");
  for (const text of [productCommercialSection, activeCommercialSection]) {
    assertNotIncludes(text, "允许用户自配", "commercial_truth");
    assertNotIncludes(text, "普通用户配置 CVM", "commercial_truth");
    assertNotIncludes(text, "普通用户配置 COS", "commercial_truth");
    assertNotIncludes(text, "普通用户配置 K8s", "commercial_truth");
    assertNotIncludes(text, "普通用户云资源控制台", "commercial_truth");
  }
}

function assertCommercialUiImpactDecision({ specs, product, active }) {
  const decision = extractJson(specs, uiStartMarker, uiEndMarker, "commercial_ui_impact");
  const productSection = extractSection(product, "Commercial UI Impact Decision");
  const activeSection = extractSection(active, "商业化 UI 影响决策");

  assert.equal(decision.contract, "v22_commercial_ui_impact_decision", "commercial_ui_impact_contract_mismatch");
  assert.equal(decision.version, 1, "commercial_ui_impact_version_mismatch");
  assert.equal(decision.decision, "no_immediate_ui_code_change", "commercial_ui_impact_decision_mismatch");
  assert.equal(decision.reason, "existing_portal_surface_already_answers_required_customer_questions", "commercial_ui_impact_reason_mismatch");
  assert.deepEqual(decision.requiredCustomerQuestions, [
    "买了什么",
    "能不能用",
    "缺什么",
    "下一步点哪里",
    "结果在哪里",
    "费用是否正常",
  ], "commercial_ui_required_questions_mismatch");
  assert.deepEqual(decision.existingUiCoverage, {
    overview: ["托管 OPL 科研工作台服务", "工作台可用性", "下一步动作"],
    resources: ["计算资源", "文件空间", "套餐规格", "释放状态"],
    workspace: ["文件列表", "任务入口", "输出结果"],
    trace: ["任务运行轨迹", "输出回流", "费用关联"],
    billing: ["余额", "冻结金额", "运行费用", "账本审计"],
    oplLaunch: ["进入 OPL 工作台", "启动阶段", "provider 绑定状态"],
  }, "commercial_ui_existing_coverage_mismatch");
  assert.deepEqual(decision.commercialModelImpacts, [
    "api_only_needs_entry_and_context_state_only",
    "full_runtime_uses_existing_runtime_resource_billing_surfaces",
    "customer_dedicated_requires_future_ui_leaf_before_customer_visible_launch",
  ], "commercial_ui_model_impacts_mismatch");
  assert.equal(decision.modifiesUiNow, false, "commercial_ui_must_not_modify_ui_now");
  assert.equal(decision.requiresFutureUiLeafForCustomerDedicated, true, "customer_dedicated_future_ui_leaf_required");

  for (const section of [productSection, activeSection]) {
    assertIncludes(section, "本阶段不修改 Portal UI 代码", "ui_decision_section");
    for (const question of decision.requiredCustomerQuestions) assertIncludes(section, question, `ui_decision_question:${question}`);
    assertIncludes(section, "customer_dedicated", "ui_decision_customer_dedicated_handoff");
    assertNotIncludes(section, "普通用户云资源控制台", "ui_decision_section");
    assertNotIncludes(section, "用户自配云资源", "ui_decision_section");
  }
}

const [specs, product, active] = await Promise.all([
  readFile(specsPath, "utf8"),
  readFile(productPath, "utf8"),
  readFile(activePath, "utf8"),
]);

assertCommercialPackageModel({ specs, product, active });
assertCommercialUiImpactDecision({ specs, product, active });

console.log(JSON.stringify({
  ok: true,
  contract: "v22_commercial_package_model",
  packages: ["api_only", "full_runtime", "customer_dedicated"],
  uiDecision: "no_immediate_ui_code_change",
}, null, 2));
