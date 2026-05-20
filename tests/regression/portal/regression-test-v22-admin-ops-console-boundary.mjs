import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { smokeEvalMetadataOf } from "../../../scripts/v22-test-classification.mjs";

const contractPath = "docs/specs/README.md";
const readmePath = "docs/specs/README.md";
const suitePath = "tests/contract/contract-test-v22-mvp-contract-suite.mjs";
const smokeScriptPath = "tests/regression/portal/regression-test-v22-admin-ops-console-boundary.mjs";

const CONTRACT_START = "<!-- v22-admin-ops-console-contract:start -->";
const CONTRACT_END = "<!-- v22-admin-ops-console-contract:end -->";

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertArrayIncludesAll(actual, expected, label) {
  for (const item of expected) {
    assert(actual.includes(item), `${label}_missing:${item}`);
  }
}

function extractContractJson(markdown) {
  const startIndex = markdown.indexOf(CONTRACT_START);
  assert.notEqual(startIndex, -1, "admin_ops_contract_start_marker_missing");
  const contentStart = startIndex + CONTRACT_START.length;
  const endIndex = markdown.indexOf(CONTRACT_END, contentStart);
  assert.notEqual(endIndex, -1, "admin_ops_contract_end_marker_missing");
  assert.equal(markdown.indexOf(CONTRACT_START, contentStart), -1, "admin_ops_contract_start_marker_must_be_unique");
  assert.equal(markdown.indexOf(CONTRACT_END, endIndex + CONTRACT_END.length), -1, "admin_ops_contract_end_marker_must_be_unique");
  const block = markdown.slice(contentStart, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, "admin_ops_contract_must_be_single_json_fence");
  return JSON.parse(match[1]);
}

const markdown = await readFile(contractPath, "utf8");
const readme = await readFile(readmePath, "utf8");
const suite = await readFile(suitePath, "utf8");

for (const phrase of [
  "这是 admin/ops console 合同，不实现 UI。",
  "普通用户资源页不得恢复云控制台或运维语义。",
  "管理员/运维视角可以查看后台归因和异常，也可以执行已接入的本地 Portal 管理动作，但不能执行真实云控制台式操作。",
  "不读取 secret",
  "不调用真实云",
  "不做真实扣费",
  "不创建、绑定或释放真实资源",
  "不修改 deploy / .sentrux / adapters / upstream",
]) {
  assertIncludes(markdown, phrase, "admin_ops_contract_boundary_copy");
}

const contract = extractContractJson(markdown);
assert.equal(contract.contract, "v22_admin_ops_console_boundary", "admin_ops_contract_name_mismatch");
assert.equal(contract.version, 1, "admin_ops_contract_version_mismatch");
assert.equal(contract.scope.implementsUi, false, "admin_ops_contract_must_not_implement_ui");
assert.equal(contract.scope.callsRealCloud, false, "admin_ops_contract_must_not_call_real_cloud");
assert.equal(contract.scope.readsSecret, false, "admin_ops_contract_must_not_read_secret");
assert.equal(contract.scope.realBillingMutation, false, "admin_ops_contract_must_not_mutate_real_billing");
assert.equal(contract.scope.realResourceMutation, false, "admin_ops_contract_must_not_mutate_real_resources");
assert.equal(contract.scope.localPortalAdminActionsEnabled, true, "admin_ops_contract_must_allow_local_portal_admin_actions");
assert.equal(contract.scope.localPortalAccountingActionsEnabled, true, "admin_ops_contract_must_allow_local_portal_accounting_actions");

assertArrayIncludesAll(contract.adminOpsVisibleCapabilities, [
  "租户列表",
  "账号状态",
  "开通/禁用状态",
  "workspace 列表和归属",
  "托管运行环境列表",
  "每个租户/环境的套餐",
  "CPU",
  "内存",
  "文件空间",
  "并发",
  "队列",
  "当前运行中的 session/run/task",
  "文件空间用量",
  "7 天保护期占用",
  "资源状态",
  "费用估算",
  "冻结金额",
  "T+1 对账状态",
  "分账标签",
  "审计事件",
  "异常",
  "释放失败",
  "账单异常",
  "公告管理入口",
], "admin_ops_visible_capabilities");

assertArrayIncludesAll(contract.resourceStates, [
  "计划中",
  "准备中",
  "可用",
  "释放中",
  "已释放",
  "异常",
], "admin_ops_resource_states");

assertArrayIncludesAll(contract.costAllocationTags, [
  "resourceBindingId",
  "cloudOperationId",
  "billingAttributionId",
  "accountId",
  "runId",
  "serverPlanId",
  "tenantId",
  "workspaceId",
  "environmentId",
  "retiredResourceOrderIdentifiersForbidden",
], "admin_ops_cost_allocation_tags");

assertArrayIncludesAll(contract.beginnerUserInvisibleCapabilities, [
  "CVM",
  "COS",
  "K8s",
  "TKE",
  "节点池",
  "kubeconfig",
  "真实云资源 ID",
  "objectKey",
  "storageKey",
  "cosPrefix",
  "storageBackend",
  "signedUrl",
  "SecretId",
  "SecretKey",
  "token",
  "raw API Key",
  "真实腾讯云控制台式操作",
  "直接删除节点池",
  "直接释放云资源",
  "直接改真实资源",
], "beginner_invisible_capabilities");

assert.equal(contract.beginnerSurfaceMustRemainProductLanguage, true, "beginner_surface_must_remain_product_language");
assert.equal(contract.adminOpsCanInspectAttribution, true, "admin_ops_must_inspect_attribution");
assert.equal(contract.adminOpsCanExecuteRealCloudConsoleOperation, false, "admin_ops_must_not_execute_real_cloud_console_operation");
assertArrayIncludesAll(contract.localPortalAdminActions, [
  "查看用户详情",
  "Portal 本地账户充值",
  "Portal 本地账本退款",
  "启用用户",
  "禁用用户",
  "软删除用户",
  "新建公告",
  "编辑公告",
  "发布公告",
  "下线公告",
  "置顶公告",
  "删除公告",
  "标记当前 billing ops 事实源中的本地账单运营项",
], "admin_ops_local_portal_admin_actions");
assertArrayIncludesAll(contract.readonlyOrDisabledProductStates, [
  "/admin/ops",
  "真实账单审批",
  "高风险站点设置",
  "真实待处理事项审批",
  "真实云资源操作",
  "真实扣费",
], "admin_ops_readonly_or_disabled_product_states");
assertArrayIncludesAll(contract.beginnerSurface.mustShowOnlyProductLanguage, [
  "工作台资源",
  "套餐",
  "文件空间",
  "费用估算",
  "释放策略",
  "审计状态",
], "beginner_surface_product_language");
assertArrayIncludesAll(contract.beginnerSurface.mustNotShow, [
  "tenantId",
  "resourceBindingId",
  "retired resource-order identifiers",
  "serverPlanId",
  "runId",
  "CVM",
  "COS",
  "K8s",
  "TKE",
  "节点池",
  "真实云资源 ID",
], "beginner_surface_must_not_show");
assert.equal(contract.costAllocationTags.includes("legacyResourceOrderId"), false, "admin_ops_cost_allocation_tags_must_not_retain_legacy_resource_order_id");
assert.equal(contract.accountAndTokenBoundary.rawApiKeyBackendOnly, true, "raw_api_key_must_be_backend_only");
assert.equal(contract.accountAndTokenBoundary.apiKeyPortalLoginField, false, "api_key_must_not_be_portal_login_field");
assert.equal(contract.accountAndTokenBoundary.launchTokenInUrlOrStorage, false, "launch_token_must_not_be_url_or_storage");
assert.equal(contract.accountAndTokenBoundary.runtimeTokenInUrlOrStorage, false, "runtime_token_must_not_be_url_or_storage");
assert.equal(contract.upstreamBoundary.cleanUpstream, true, "upstream_must_be_clean");
assert.equal(contract.upstreamBoundary.modifySource, false, "upstream_must_not_be_modified");
assert.equal(contract.upstreamBoundary.importInternalModules, false, "upstream_internal_modules_must_not_be_imported");

assertArrayIncludesAll(contract.forbiddenPaths, [
  "deploy",
  ".sentrux",
  "adapters",
  "one-person-lab upstream",
  "Gateway",
  "Runtime Bridge",
], "admin_ops_forbidden_paths");

assertIncludes(readme, "spec:v22-admin-ops-console-boundary", "contracts_readme_must_index_admin_ops_contract");
assertIncludes(suite, "listSmokeEvalScripts", "mvp_suite_must_use_eval_tier_selector");
assertIncludes(suite, "mvpLocalTiers", "mvp_suite_must_name_local_tier_scope");
assert.equal(smokeEvalMetadataOf(smokeScriptPath).tier, "local-regression", "admin_ops_boundary_must_be_local_regression");

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  covered: [
    "admin_ops_visible_capabilities",
    "beginner_invisible_capabilities",
    "cost_allocation_tags",
    "no_secret_cloud_deploy_side_effects",
    "readme_and_suite_index",
  ],
}, null, 2));
