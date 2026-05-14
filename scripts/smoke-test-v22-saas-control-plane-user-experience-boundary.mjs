import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-saas-control-plane-user-experience-boundary.md";
const contractIndexPath = "docs/contracts/README.md";
const productTruthPath = "docs/recovery/product-truth.md";
const architectureTruthPath = "docs/recovery/architecture-truth.md";
const gapMatrixPath = "docs/recovery/v22-current-vs-ideal-gap-matrix.md";

const startMarker = "<!-- v22-saas-control-plane-user-experience-contract:start -->";
const endMarker = "<!-- v22-saas-control-plane-user-experience-contract:end -->";

async function source(path) {
  return readFile(path, "utf8");
}

function extractJson(markdown) {
  const start = markdown.indexOf(startMarker);
  assert.notEqual(start, -1, "saas_control_plane_contract_start_marker_missing");
  const end = markdown.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, "saas_control_plane_contract_end_marker_missing");
  assert.equal(markdown.indexOf(startMarker, start + startMarker.length), -1, "saas_control_plane_contract_start_marker_must_be_unique");
  assert.equal(markdown.indexOf(endMarker, end + endMarker.length), -1, "saas_control_plane_contract_end_marker_must_be_unique");

  const block = markdown.slice(start + startMarker.length, end).trim();
  const match = /^```json\n([\s\S]+)\n```$/u.exec(block);
  assert(match, "saas_control_plane_contract_must_be_single_json_fence");
  return JSON.parse(match[1]);
}

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

const [
  contractMarkdown,
  contractIndex,
  productTruth,
  architectureTruth,
  gapMatrix,
] = await Promise.all([
  source(contractPath),
  source(contractIndexPath),
  source(productTruthPath),
  source(architectureTruthPath),
  source(gapMatrixPath),
]);

const contract = extractJson(contractMarkdown);

assert.equal(contract.contract, "v22_saas_control_plane_user_experience_boundary", "contract_name_mismatch");
assert.equal(contract.model, "gpt-5.4", "contract_model_mismatch");
assert.equal(contract.scope.portalIsSaasControlPlane, true, "portal_must_be_saas_control_plane");
assert.equal(contract.scope.portalReimplementsOplChatbot, false, "portal_must_not_reimplement_opl_chatbot");
assert.equal(contract.scope.portalIsCloudConsole, false, "portal_must_not_be_cloud_console");
assert.equal(contract.scope.modifiesServices, false, "truth_leaf_must_not_modify_services");
assert.equal(contract.scope.callsRealCloud, false, "truth_leaf_must_not_call_real_cloud");
assert.equal(contract.scope.readsSecrets, false, "truth_leaf_must_not_read_secrets");
assert.equal(contract.scope.modifiesUpstream, false, "truth_leaf_must_not_modify_upstream");

assertIncludesAll(contract.userQuestions, [
  "我买的是什么服务？",
  "我的 OPL 工作台现在能不能用？",
  "如果不能用，还缺哪一步？",
  "下一步应该点哪里？",
  "我的文件、任务、结果在哪里？",
  "我的余额、预扣费、冻结金额、停止计费状态是否正常？",
  "我什么时候应该释放计算资源但保留文件空间？",
], "user_questions");

assertIncludesAll(contract.portalResponsibilities, [
  "账号和登录态",
  "套餐、余额、预扣费和冻结金额",
  "计算资源、文件空间和工作空间状态",
  "gflabtoken 模型调用密钥绑定状态和 OPL preflight 入口",
  "进入 OPL 工作台",
  "OPL session、run、artifact、trace 的回流展示",
  "账单、审计、释放和停止计费状态",
], "portal_responsibilities");

assertIncludesAll(contract.oplResponsibilities, [
  "chatbot",
  "agent",
  "科研任务执行",
  "文件理解",
  "结果生成",
  "工作台内交互体验",
], "opl_responsibilities");

assertIncludesAll(contract.portalMustNot, [
  "重做 OPL chatbot",
  "成为云资源控制台",
  "要求普通用户理解 CVM/COS/K8s/TKE",
  "把 raw API key、launchToken、runtimeToken、bearer token 写入浏览器持久化状态、日志、evidence 或 git",
], "portal_must_not");

assertIncludes(contractMarkdown, "MedOPL 是 One Person Lab 的 SaaS 控制面和托管交付平台", "contract_product_statement");
assertIncludes(contractMarkdown, "让用户知道自己买的是什么东西、接受的是什么服务", "contract_user_service_statement");
assertIncludes(contractMarkdown, "Portal 不回答科研问题，不复制 OPL 的 chatbot", "contract_no_chatbot_duplication");
assertIncludes(contractMarkdown, "OPL 负责科研执行", "contract_opl_execution_boundary");
assertIncludes(contractMarkdown, "Portal 负责准备、管理、进入、回流、计费、审计和释放", "contract_portal_lifecycle_boundary");

assertIncludes(contractIndex, "v22-saas-control-plane-user-experience-boundary.md", "contract_index_must_reference_new_contract");
assertIncludes(productTruth, "SaaS 控制面", "product_truth_must_name_saas_control_plane");
assertIncludes(productTruth, "托管交付平台", "product_truth_must_name_managed_delivery_platform");
assertIncludes(architectureTruth, "Portal 不重做 OPL chatbot", "architecture_truth_must_keep_opl_chatbot_boundary");
assertIncludes(architectureTruth, "OPL 负责科研执行", "architecture_truth_must_assign_opl_execution");
assertIncludes(gapMatrix, "saas-control-plane-user-experience-truth", "gap_matrix_must_track_truth_layer_gap");
assertIncludes(gapMatrix, "v22-saas-control-plane-user-experience-boundary.md", "gap_matrix_must_reference_contract");

for (const text of [
  contractMarkdown,
  productTruth,
  architectureTruth,
]) {
  assertExcludes(text, "Portal 是科研聊天界面", "truth_must_not_make_portal_chat_ui");
  assertExcludes(text, "Portal 是云资源控制台", "truth_must_not_make_portal_cloud_console");
}

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  checked: [
    contractPath,
    contractIndexPath,
    productTruthPath,
    architectureTruthPath,
    gapMatrixPath,
  ],
}, null, 2));
