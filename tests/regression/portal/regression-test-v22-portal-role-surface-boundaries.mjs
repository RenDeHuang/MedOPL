import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isSmokeClassifiedIn } from "../../../scripts/v22-test-classification.mjs";

const userContractPath = "docs/contracts/v22-portal-user-surface-boundary.md";
const adminContractPath = "docs/contracts/v22-portal-admin-ops-surface-boundary.md";
const readmePath = "docs/contracts/README.md";
const suitePath = "tests/contract/contract-test-v22-mvp-contract-suite.mjs";

const USER_CONTRACT_START = "<!-- v22-portal-user-surface-contract:start -->";
const USER_CONTRACT_END = "<!-- v22-portal-user-surface-contract:end -->";
const ADMIN_CONTRACT_START = "<!-- v22-portal-admin-ops-surface-contract:start -->";
const ADMIN_CONTRACT_END = "<!-- v22-portal-admin-ops-surface-contract:end -->";

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, unexpected, label) {
  assert.equal(source.includes(unexpected), false, `${label}_must_not_include:${unexpected}`);
}

function assertArrayIncludesAll(actual, expected, label) {
  assert(Array.isArray(actual), `${label}_must_be_array`);
  for (const item of expected) {
    assert(actual.includes(item), `${label}_missing:${item}`);
  }
}

function extractContractJson(markdown, startMarker, endMarker, label) {
  const startIndex = markdown.indexOf(startMarker);
  assert.notEqual(startIndex, -1, `${label}_start_marker_missing`);
  const contentStart = startIndex + startMarker.length;
  const endIndex = markdown.indexOf(endMarker, contentStart);
  assert.notEqual(endIndex, -1, `${label}_end_marker_missing`);
  assert.equal(markdown.indexOf(startMarker, contentStart), -1, `${label}_start_marker_must_be_unique`);
  assert.equal(markdown.indexOf(endMarker, endIndex + endMarker.length), -1, `${label}_end_marker_must_be_unique`);
  const block = markdown.slice(contentStart, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, `${label}_must_be_single_json_fence`);
  return JSON.parse(match[1]);
}

const userMarkdown = await readFile(userContractPath, "utf8");
const adminMarkdown = await readFile(adminContractPath, "utf8");
const combinedMarkdown = `${userMarkdown}\n${adminMarkdown}`;
const readme = await readFile(readmePath, "utf8");
const suite = await readFile(suitePath, "utf8");

for (const phrase of [
  "同一个 Portal 应用",
  "同一套登录",
  "同一套 UI shell",
  "role-based surface",
  "普通用户 surface 和管理员/运维 surface 严格分离",
  "管理员页面/API 独立分区",
  "普通用户不能看到 admin/ops 入口",
  "普通用户不能看到全局数据",
  "repo-tracked contracts/docs/scripts/tests 是 truth",
  "tmux session、agent 对话、本地状态、临时日志不进仓库",
  "并行写任务必须用独立 worktree",
  "根工作区只用于规划、审查、吸收、push、清理",
  "不把 upstream 内部逻辑写进 Portal",
  "旧入口、旧云控制台叙事、旧资源管理路线不得重新成为 v22 主线",
  "历史 v19/v20/v21 路线不得重新成为 v22 主线",
  "账号 / 工作空间 是 UI 主语言",
  "租户 / 运行环境 不是 UI 主叙事",
  "角色真相由 `v22-portal-user-surface-boundary.md` 和 `v22-portal-admin-ops-surface-boundary.md` 共同定义",
  "`v22-saas-portal-opl-ops-surface-boundary.md` 是更宽的 Portal、OPL 和管理台共享界面总述，不替代这两份 role surface 合同",
]) {
  assertIncludes(combinedMarkdown, phrase, "role_surface_shared_boundary_copy");
}

const userContract = extractContractJson(
  userMarkdown,
  USER_CONTRACT_START,
  USER_CONTRACT_END,
  "portal_user_surface_contract",
);

assert.equal(userContract.contract, "v22_portal_user_surface_boundary", "user_surface_contract_name");
assert.equal(userContract.version, 1, "user_surface_contract_version");
assert.equal(userContract.samePortalApp, true, "user_surface_same_portal_app");
assert.equal(userContract.sameLoginAndShell, true, "user_surface_same_login_shell");
assert.equal(userContract.roleSurface, "user", "user_surface_role");
assert.equal(userContract.implementsUi, false, "user_surface_must_not_implement_ui");
assert.equal(userContract.portalProvidesRawApiKeyInput, false, "user_surface_must_not_provide_raw_api_key_input");

assertArrayIncludesAll(userContract.entryPoints, [
  "Portal 总览",
  "工作空间",
  "工作台资源/套餐",
  "文件空间",
  "运行轨迹",
  "账单/余额/充值",
  "进入 OPL 工作台",
], "user_surface_entry_points");

assertArrayIncludesAll(userContract.visibleContent, [
  "自己的账号状态",
  "自己的工作空间",
  "自己的套餐",
  "CPU/内存/文件空间",
  "并发/队列",
  "自己的任务",
  "输出文件",
  "运行轨迹",
  "费用估算",
  "余额",
  "充值状态",
  "gflabtoken 模型调用密钥已绑定/未绑定状态",
], "user_surface_visible_content");

assertArrayIncludesAll(userContract.invisibleContent, [
  "管理员/运维入口",
  "全局账号列表",
  "其他账号/其他工作空间",
  "全局运行任务",
  "全局费用、冻结、T+1 对账",
  "审计异常、释放失败、账单异常总览",
  "公告管理",
  "CVM",
  "COS",
  "K8s",
  "TKE",
  "节点池",
  "服务器编号",
  "云资源清单",
  "tenantId",
  "resourceBindingId",
  "cloudOperationId",
  "billingAttributionId",
  "accountId",
  "retired resource-order identifiers",
  "serverPlanId",
  "runId",
  "SecretId",
  "SecretKey",
  "token",
  "raw API Key",
  "kubeconfig",
  "objectKey",
  "storageKey",
  "cosPrefix",
  "storageBackend",
  "signedUrl",
], "user_surface_invisible_content");

assertArrayIncludesAll(userContract.uiPrimaryLanguage, [
  "账号",
  "工作空间",
], "user_surface_primary_language");
assertArrayIncludesAll(userContract.notUiPrimaryNarrative, [
  "租户",
  "运行环境",
], "user_surface_not_primary_language");

for (const cloudTerm of ["CVM", "COS", "K8s", "TKE", "节点池"]) {
  assert(userContract.invisibleContent.includes(cloudTerm), `user_surface_cloud_term_must_be_invisible:${cloudTerm}`);
}
assertNotIncludes(userContract.visibleContent.join("\n"), "CVM", "user_surface_visible_content");
assertNotIncludes(userContract.visibleContent.join("\n"), "COS", "user_surface_visible_content");
assertNotIncludes(userContract.visibleContent.join("\n"), "K8s", "user_surface_visible_content");
assertNotIncludes(userContract.visibleContent.join("\n"), "TKE", "user_surface_visible_content");
assertNotIncludes(userContract.visibleContent.join("\n"), "节点池", "user_surface_visible_content");

const adminContract = extractContractJson(
  adminMarkdown,
  ADMIN_CONTRACT_START,
  ADMIN_CONTRACT_END,
  "portal_admin_ops_surface_contract",
);

assert.equal(adminContract.contract, "v22_portal_admin_ops_surface_boundary", "admin_surface_contract_name");
assert.equal(adminContract.version, 1, "admin_surface_contract_version");
assert.equal(adminContract.samePortalApp, true, "admin_surface_same_portal_app");
assert.equal(adminContract.roleSurface, "admin_ops", "admin_surface_role");
assert.equal(adminContract.adminRoutePrefix, "/admin/*", "admin_surface_route_prefix");
assert.equal(adminContract.adminRoleOnly, true, "admin_surface_admin_only");
assert.equal(adminContract.userNavigationShowsAdminEntry, false, "admin_entry_must_not_show_in_user_nav");
assert.equal(adminContract.localPortalAdminActionsEnabled, true, "admin_surface_local_portal_actions_enabled");
assert.equal(adminContract.readonlyOpsAndCloudMvp, true, "admin_surface_ops_and_cloud_must_remain_readonly");
assert.equal(adminContract.realCloudMutation, false, "admin_surface_real_cloud_mutation_forbidden");
assert.equal(adminContract.localPortalAccountingActionsEnabled, true, "admin_surface_local_accounting_actions_enabled");

assertArrayIncludesAll(adminContract.visibleContent, [
  "账号列表和状态",
  "工作空间列表和归属账号",
  "工作台资源套餐",
  "CPU",
  "内存",
  "文件空间",
  "并发",
  "队列",
  "当前运行中的 session/run/task",
  "文件空间用量",
  "7 天保护期占用",
  "费用估算",
  "冻结金额",
  "T+1 对账状态",
  "分账标签",
  "审计事件",
  "异常",
  "释放失败",
  "账单异常",
  "公告管理入口",
], "admin_surface_visible_content");

assertArrayIncludesAll(adminContract.costAllocationTags, [
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
], "admin_surface_cost_allocation_tags");
assert.equal(adminContract.costAllocationTags.includes("legacyResourceOrderId"), false, "admin_surface_cost_allocation_tags_must_not_retain_legacy_resource_order_id");

assertArrayIncludesAll(adminContract.forbiddenVisibilityAndActions, [
  "SecretId",
  "SecretKey",
  "token",
  "raw API Key",
  "kubeconfig",
  "objectKey",
  "storageKey",
  "cosPrefix",
  "storageBackend",
  "signedUrl",
  "未授权真实云创建/释放/修改",
  "未授权真实扣费",
], "admin_surface_forbidden_visibility_actions");

assertArrayIncludesAll(adminContract.localPortalAdminActions, [
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
], "admin_surface_local_portal_actions");

assertArrayIncludesAll(adminContract.readonlyOrDisabledProductStates, [
  "/admin/ops",
  "真实账单审批",
  "高风险站点设置",
  "真实待处理事项审批",
  "真实云资源操作",
  "真实扣费",
], "admin_surface_readonly_or_disabled_product_states");

assert.equal(adminContract.currentMvp.callsRealTencentCloud, false, "admin_surface_no_real_tencent_cloud");
assert.equal(adminContract.currentMvp.callsRealCos, false, "admin_surface_no_real_cos");
assert.equal(adminContract.currentMvp.callsRealLangfuse, false, "admin_surface_no_real_langfuse");
assert.equal(adminContract.currentMvp.callsRealOnePersonLab, false, "admin_surface_no_real_opl");
assert.equal(adminContract.currentMvp.createsRealResources, false, "admin_surface_no_real_resource_create");
assert.equal(adminContract.currentMvp.realBillingMutation, false, "admin_surface_no_real_billing");

assertArrayIncludesAll(adminContract.futureAuthorizationRequired, [
  "feat/*",
  "authorized implementation 合同",
  "secret",
  "真实云 API",
  "真实资源创建/释放",
  "真实扣费路径",
], "admin_surface_future_authorization");

assert.equal(adminContract.forbiddenPaths.includes("deploy"), true, "admin_surface_forbidden_deploy");
assert.equal(adminContract.forbiddenPaths.includes(".sentrux"), true, "admin_surface_forbidden_sentrux");
assert.equal(adminContract.forbiddenPaths.includes("adapters"), true, "admin_surface_forbidden_adapters");
assert.equal(adminContract.forbiddenPaths.includes("upstream"), true, "admin_surface_forbidden_upstream");

assertIncludes(readme, "v22-portal-user-surface-boundary.md", "contracts_readme_must_index_user_surface");
assertIncludes(readme, "v22-portal-admin-ops-surface-boundary.md", "contracts_readme_must_index_admin_surface");
assertIncludes(readme, "这两份合同是 Portal 角色真相", "contracts_readme_must_define_role_contract_priority");
assert(isSmokeClassifiedIn("tests/regression/portal/regression-test-v22-portal-role-surface-boundaries.mjs"), "mvp_suite_must_run_role_surface_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_role_surface_boundaries",
  covered: [
    "same_portal_app_role_based_surface",
    "user_surface_visible_and_invisible_boundaries",
    "admin_ops_admin_only_readonly_surface",
    "sub2api_role_based_pattern_without_external_code",
    "one_person_lab_contract_truth_and_pollution_guard",
    "mvp_no_real_cloud_or_billing_mutation",
  ],
}, null, 2));
