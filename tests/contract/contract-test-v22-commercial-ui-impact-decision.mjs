import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const specsPath = "docs/specs/README.md";
const productPath = "docs/product/README.md";
const activePath = "docs/active/README.md";

const startMarker = "<!-- v22-commercial-ui-impact-decision:start -->";
const endMarker = "<!-- v22-commercial-ui-impact-decision:end -->";

function extractJson(markdown) {
  const start = markdown.indexOf(startMarker);
  assert.notEqual(start, -1, "commercial_ui_impact_start_marker_missing");
  const end = markdown.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, "commercial_ui_impact_end_marker_missing");
  assert.equal(markdown.indexOf(startMarker, start + startMarker.length), -1, "commercial_ui_impact_start_marker_must_be_unique");
  assert.equal(markdown.indexOf(endMarker, end + endMarker.length), -1, "commercial_ui_impact_end_marker_must_be_unique");
  const block = markdown.slice(start + startMarker.length, end).trim();
  const match = /^```json\n([\s\S]+)\n```$/u.exec(block);
  assert(match, "commercial_ui_impact_must_be_single_json_fence");
  return JSON.parse(match[1]);
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function extractSection(markdown, heading) {
  const pattern = new RegExp(`## ${heading}\\n(?<section>[\\s\\S]*?)(?=\\n## |\\n$)`, "u");
  const match = markdown.match(pattern);
  assert(match?.groups?.section, `section_missing:${heading}`);
  return match.groups.section;
}

const [specs, product, active] = await Promise.all([
  readFile(specsPath, "utf8"),
  readFile(productPath, "utf8"),
  readFile(activePath, "utf8"),
]);

const decision = extractJson(specs);
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
  assertIncludes(section, "买了什么", "ui_decision_buying_question");
  assertIncludes(section, "能不能用", "ui_decision_availability_question");
  assertIncludes(section, "缺什么", "ui_decision_missing_step_question");
  assertIncludes(section, "下一步点哪里", "ui_decision_next_action_question");
  assertIncludes(section, "结果在哪里", "ui_decision_result_question");
  assertIncludes(section, "费用是否正常", "ui_decision_billing_question");
  assertIncludes(section, "customer_dedicated", "ui_decision_customer_dedicated_handoff");
  assertNotIncludes(section, "普通用户云资源控制台", "ui_decision_section");
  assertNotIncludes(section, "用户自配云资源", "ui_decision_section");
}

console.log(JSON.stringify({
  ok: true,
  contract: decision.contract,
  decision: decision.decision,
}, null, 2));
