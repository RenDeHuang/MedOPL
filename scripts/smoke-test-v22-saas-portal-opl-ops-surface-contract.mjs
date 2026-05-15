import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.join(__dirname, "../docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md");
const frontendUserSurfacePaths = [
  "../services/portal/frontend/src/layouts/AppHeader.vue",
  "../services/portal/frontend/src/layouts/AppSidebar.vue",
  "../services/portal/frontend/src/components/overview/OverviewHero.vue",
  "../services/portal/frontend/src/components/overview/OverviewFinancialMetricsPanel.vue",
  "../services/portal/frontend/src/components/overview/OverviewManagedEnvironmentPanel.vue",
  "../services/portal/frontend/src/components/overview/OverviewRecentRunsPanel.vue",
  "../services/portal/frontend/src/components/overview/OverviewWorkspacePanel.vue",
  "../services/portal/frontend/src/components/billing/BillingHero.vue",
  "../services/portal/frontend/src/components/billing/BillingCostBreakdownPanel.vue",
  "../services/portal/frontend/src/components/billing/BillingWorkspaceCostPanel.vue",
  "../services/portal/frontend/src/components/resources/ResourcesHero.vue",
  "../services/portal/frontend/src/components/resources/ResourcesCurrentPanel.vue",
  "../services/portal/frontend/src/components/resources/ResourcesReleaseAuditPanel.vue",
  "../services/portal/frontend/src/components/trace/TraceHero.vue",
  "../services/portal/frontend/src/components/trace/TraceSessionTablePanel.vue",
  "../services/portal/frontend/src/components/workspace/WorkspaceHero.vue",
  "../services/portal/frontend/src/components/workspace/WorkspaceFileSpacePanel.vue",
  "../services/portal/frontend/src/components/workspace/WorkspaceManagedPlanPanel.vue",
  "../services/portal/frontend/src/components/workspace/WorkspaceListPanel.vue",
  "../services/portal/frontend/src/components/workspace/WorkspaceFilesPanel.vue",
  "../services/portal/frontend/src/views/overview/OverviewView.vue",
  "../services/portal/frontend/src/views/resources/ResourcesView.vue",
  "../services/portal/frontend/src/views/workspace/WorkspaceView.vue",
  "../services/portal/frontend/src/views/billing/BillingView.vue",
  "../services/portal/frontend/src/views/trace/TraceView.vue",
  "../services/portal/frontend/src/views/opl/OplLaunchView.vue",
].map((relativePath) => path.join(__dirname, relativePath));
const traceViewPath = path.join(__dirname, "../services/portal/frontend/src/views/trace/TraceView.vue");

const CONTRACT_START = "<!-- v22-saas-portal-opl-ops-surface-contract:start -->";
const CONTRACT_END = "<!-- v22-saas-portal-opl-ops-surface-contract:end -->";

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function extractContractJson(markdown) {
  const startIndex = markdown.indexOf(CONTRACT_START);
  assert.notEqual(startIndex, -1, "saas_surface_contract_start_marker_missing");

  const contentStart = startIndex + CONTRACT_START.length;
  const endIndex = markdown.indexOf(CONTRACT_END, contentStart);
  assert.notEqual(endIndex, -1, "saas_surface_contract_end_marker_missing");
  assert.equal(markdown.indexOf(CONTRACT_START, contentStart), -1, "saas_surface_contract_start_marker_must_be_unique");
  assert.equal(markdown.indexOf(CONTRACT_END, endIndex + CONTRACT_END.length), -1, "saas_surface_contract_end_marker_must_be_unique");

  const block = markdown.slice(contentStart, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, "saas_surface_contract_must_be_a_single_json_fence");

  return JSON.parse(match[1]);
}

function assertIncludesAll(actualItems, expectedItems, label) {
  for (const expected of expectedItems) {
    assert(actualItems.includes(expected), `${label}_missing:${expected}`);
  }
}

function assertExcludesAll(actualItems, forbiddenItems, label) {
  for (const forbidden of forbiddenItems) {
    assert.equal(actualItems.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

function assertQuestions(actualItems, expectedItems, label) {
  assertIncludesAll(actualItems, expectedItems, label);
  for (const item of actualItems) {
    assert.equal(item.endsWith("？"), true, `${label}_must_be_question:${item}`);
  }
}

function assertNoForbiddenBeginnerText(text, label) {
  const forbidden = [
    "CVM",
    "COS",
    "COS 存储桶",
    "bucket",
    "K8s",
    "TKE",
    "Kubernetes",
    "tenant",
    "tenantId",
    "workspaceId",
    "retired resource-order identifiers",
    "resourceBinding",
    "serverPlan",
    "runId",
    "billing tags",
    "分账标签",
    "costAllocationTag",
    "launchToken",
    "runtimeToken",
    "raw API key",
    "raw provider key",
    "Ops Surface",
    "ops",
    "admin",
    "backend",
    "cloud console",
    "云资源控制台",
    "provider secret",
    "backend secret boundary",
    "session 数",
    "task 数",
    "input 文件",
    "output 文件",
    "workspace 文件夹",
    "session trace metadata",
    "API key",
    "API Key",
    "保护金",
    "编号",
  ];
  for (const term of forbidden) {
    assert.equal(text.includes(term), false, `${label}_must_not_include:${term}`);
  }
}

function extractQuotedAttribute(template, attributeName) {
  const values = [];
  const pattern = new RegExp(`\\s:?${attributeName}="([^"]*)"`, "g");
  let match;
  while ((match = pattern.exec(template)) !== null) {
    values.push(match[1]);
  }
  return values.join("\n");
}

function extractStringArrayConst(source, constName) {
  const match = new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\];`).exec(source);
  return match?.[1] || "";
}

function extractVisibleTemplateCopy(template) {
  const visibleAttributes = [
    "title",
    "subtitle",
    "description",
    "label",
    "hint",
    "placeholder",
  ].map((attribute) => extractQuotedAttribute(template, attribute));
  const textNodes = template
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/{{[\s\S]*?}}/g, " ")
    .replace(/<[^>]+>/g, " ");
  const interpolationStrings = [...template.matchAll(/"([^"]*[一-龥][^"]*)"/g)].map((match) => match[1]);
  return [...visibleAttributes, textNodes, ...interpolationStrings].join("\n");
}

function extractUserFacingScriptAssignments(source) {
  return [...source.matchAll(/(?:errorMessage|noticeMessage|actionFeedback)\.value\s*=\s*"([^"]*)"/g)]
    .map((match) => match[1])
    .join("\n");
}

async function assertFrontendBeginnerSurfaceCopy() {
  const visibleSurface = (await Promise.all(frontendUserSurfacePaths.map(async (filePath) => {
    const source = await readFile(filePath, "utf8");
    const templateMatch = /<template>([\s\S]*?)<\/template>/.exec(source);
    const visibleTemplate = [
      extractVisibleTemplateCopy(templateMatch?.[1] || ""),
      extractUserFacingScriptAssignments(source),
    ].join("\n");
    if (filePath.endsWith("AppHeader.vue")) {
      return [visibleTemplate, extractStringArrayConst(source, "helpPages")].join("\n");
    }
    if (filePath.endsWith("AppSidebar.vue")) {
      return [visibleTemplate, extractStringArrayConst(source, "userItems")].join("\n");
    }
    return visibleTemplate;
  }))).join("\n");
  assertIncludesAll(visibleSurface, [
    "科研工作台",
    "工作台",
    "托管运行环境",
    "工作空间",
    "文件空间",
    "会话",
    "任务",
    "输入文件",
    "输出文件",
    "运行轨迹",
    "余额",
    "消费",
    "账单",
    "预扣费",
    "冻结金额",
    "停止计费",
    "审计状态",
    "进入 OPL 工作台",
    "gflabtoken 模型调用密钥",
  ], "frontend_beginner_surface_copy");
  assertNoForbiddenBeginnerText(visibleSurface, "frontend_beginner_surface_copy");
}

async function assertTraceTaskHeaderCopy() {
  const source = await readFile(traceViewPath, "utf8");
  const templateMatch = /<template>([\s\S]*?)<\/template>/.exec(source);
  const visibleTemplate = extractVisibleTemplateCopy(templateMatch?.[1] || "");
  assert.equal(visibleTemplate.includes("任务编号"), false, "trace_view_task_header_must_not_use_number_label");
  assert(visibleTemplate.includes("任务"), "trace_view_task_header_must_use_task_label");
}

const markdown = await readFile(contractPath, "utf8");
assert(markdown.includes("MedOPL 是面向 AI 小白科研用户的 OPL 托管科研工作台。"), "product_statement_missing");
assert(markdown.includes("普通用户不需要理解云厂商控制台或工程后台。"), "not_cloud_console_statement_missing");
assert.equal(markdown.includes("本轮只落共享界面合同和 smoke，不写业务代码，不做 UI。"), false, "saas_surface_contract_must_not_claim_no_ui_globally");
assert(markdown.includes("本合同不单独实现 UI"), "saas_surface_contract_must_delegate_ui_implementation");
assert(markdown.includes("v22-portal-workbench-management-ui-composition-boundary.md"), "saas_surface_contract_must_reference_composition_contract");
await assertFrontendBeginnerSurfaceCopy();
await assertTraceTaskHeaderCopy();

const contract = extractContractJson(markdown);

assert.equal(contract.contract, "v22_saas_portal_opl_ops_surface_boundary", "contract_name_mismatch");
assert.equal(contract.version, 2, "contract_version_mismatch");
assert.equal(contract.implementationBoundary.thisContractImplementsUiDirectly, false, "saas_surface_contract_must_not_implement_ui_directly");
assert.equal(contract.implementationBoundary.portalUiImplementationContract, "v22-portal-workbench-management-ui-composition-boundary.md", "saas_surface_ui_implementation_contract_mismatch");
assert.equal(contract.implementationBoundary.mustNotClaimNoUiWhenCompositionImplementsUi, true, "saas_surface_must_not_conflict_with_composition_ui");
assert.deepEqual(
  sortedKeys(contract),
  [
    "accountAndApiKeyBoundary",
    "backendMultiTenantBoundary",
    "cloudResourceBoundary",
    "contract",
    "forbiddenBeginnerUserNarrative",
    "implementationBoundary",
    "nonGoals",
    "oplWebBeginnerSurface",
    "managementSurface",
    "personas",
    "portalBeginnerSurface",
    "productEffectQuestions",
    "productPositioning",
    "tencentCostAllocationTags",
    "upstreamBoundary",
    "version",
  ].sort(),
  "contract_top_level_keys_mismatch",
);

assert.equal(contract.productPositioning.statement, "MedOPL 是面向 AI 小白科研用户的 OPL 托管科研工作台。", "product_positioning_statement_mismatch");
assert.equal(contract.productPositioning.notCloudConsole, true, "product_must_not_be_cloud_console");
assertIncludesAll(contract.productPositioning.includes, [
  "Portal 工作台",
  "OPL Web 科研工作台",
  "管理台",
  "平台代开通计算和存储",
  "账单、余额、审计和管理",
  "one-person-lab clean upstream",
], "product_positioning_includes");

assert.deepEqual(contract.personas.mvpRoles, ["AI 小白科研用户", "管理人员"], "mvp_roles_mismatch");
assert.equal(contract.personas.tenantAdminIndependentRole, false, "tenant_admin_must_not_be_independent_mvp_role");
assert.equal(contract.personas.multiTenantIsBackendBoundary, true, "multi_tenant_must_be_backend_boundary");
assertExcludesAll(contract.personas.mvpRoles, ["租户管理员", "课题组管理员", "tenant admin"], "mvp_roles");

assertIncludesAll(contract.portalBeginnerSurface.mustShow, [
  "余额",
  "钱花在哪里",
  "会话数",
  "任务数",
  "科研任务进度",
  "托管运行环境状态",
  "文件空间状态",
  "输入文件",
  "输出文件",
  "工作空间文件夹",
  "运行轨迹",
  "账单摘要",
  "停止计费状态、审计状态",
  "进入 OPL 工作台的入口",
], "portal_beginner_surface");
assert.equal(contract.portalBeginnerSurface.cloudConsoleShown, false, "portal_must_not_show_cloud_console");

assertIncludesAll(contract.oplWebBeginnerSurface.mustDo, [
  "使用统一 MedOPL 账号登录",
  "进入 OPL 工作台后输入或绑定 gflabtoken 模型调用密钥",
  "发消息",
  "上传文件",
  "用文件跑任务",
  "下载输出文件",
], "opl_web_beginner_surface");
assert.equal(contract.oplWebBeginnerSurface.entrypoint, "opl.medopl.cn", "opl_entrypoint_mismatch");

assertIncludesAll(contract.managementSurface.mustShow, [
  "tenant 状态",
  "workspace 状态",
  "resourceBinding、cloudOperation、billingAttribution 状态",
  "serverPlan 状态",
  "run 状态",
  "COS bucket、prefix、object 状态",
  "分账标签状态",
  "任务失败",
  "账单日内核对状态",
  "120min 停止计费确认状态",
  "T+1 审计状态",
  "异常账单、异常资源",
], "operations_surface");
assertIncludesAll(contract.managementSurface.primaryPageLanguage, [
  "客户账户",
  "工作空间",
  "资源管理",
  "任务记录",
  "账单管理",
  "审计记录",
  "站点设置",
  "服务状态",
], "management_surface_primary_page_language");
assert.equal(contract.managementSurface.rawBackendTermsAllowedOnlyInDiagnosticDetail, true, "management_raw_backend_terms_must_be_detail_only");

assert.deepEqual(contract.backendMultiTenantBoundary.fields, [
  "tenantId",
  "userId",
  "workspaceId",
  "resourceBindingId",
  "cloudOperationId",
  "billingAttributionId",
  "accountId",
  "billingAccountId",
  "runId",
  "serverPlanId",
  "retiredResourceOrderIdentifiersForbidden",
], "backend_multi_tenant_fields_mismatch");
assertIncludesAll(contract.backendMultiTenantBoundary.usedFor, ["隔离", "计费", "审计", "运维"], "backend_multi_tenant_used_for");
assert.equal(contract.backendMultiTenantBoundary.beginnerUserPrimaryLanguage, false, "backend_fields_must_not_be_beginner_user_language");

assert.deepEqual(contract.tencentCostAllocationTags.fixedKeys, [
  "resourcebindingid",
  "cloudoperationid",
  "billingattributionid",
  "accountid",
  "runid",
  "serverplanid",
  "workspaceid",
  "tenantid",
], "tencent_cost_allocation_tags_mismatch");
assertIncludesAll(contract.tencentCostAllocationTags.usedFor, [
  "腾讯云账单核对",
  "COS 存储桶列表",
  "成本归因",
  "审计",
], "tencent_cost_allocation_tags_used_for");
assert.equal(contract.tencentCostAllocationTags.beginnerUserDirectOperation, false, "beginner_user_must_not_operate_billing_tags");
assert.equal(contract.tencentCostAllocationTags.managementCanInspectMappingAndAnomalies, true, "ops_must_inspect_tag_mapping_and_anomalies");

assert.equal(contract.cloudResourceBoundary.tencentCloudIsBackendPool, true, "tencent_cloud_must_be_backend_pool");
assert.deepEqual(contract.cloudResourceBoundary.userBuys, ["托管运行环境", "文件空间"], "user_buys_mismatch");
assert.deepEqual(contract.cloudResourceBoundary.backendProvisioning, ["CVM", "COS、文件空间", "runtime"], "backend_provisioning_mismatch");
assertIncludesAll(contract.cloudResourceBoundary.forbiddenBeginnerConfiguration, ["CVM", "COS", "K8s", "TKE"], "forbidden_beginner_cloud_configuration");

assert.equal(contract.accountAndApiKeyBoundary.medoplAccountUnifiedWithOplWeb, true, "medopl_account_must_be_unified_with_opl_web");
assert.equal(contract.accountAndApiKeyBoundary.identityPath, "MedOPL Gateway、SSO 和 Auth Bridge", "identity_path_mismatch");
assert.equal(contract.accountAndApiKeyBoundary.gflabtokenInputLocation, "OPL 登录页密码下面", "gflabtoken_input_location_mismatch");
assert.equal(contract.accountAndApiKeyBoundary.apiKeyIsPortalLoginField, false, "api_key_must_not_be_portal_login_field");
assert.equal(contract.accountAndApiKeyBoundary.rawApiKeyBackendOnly, true, "raw_api_key_must_be_backend_only");
assert.deepEqual(contract.accountAndApiKeyBoundary.frontendPublicFields, ["providerKeyRef", "bound status"], "frontend_public_fields_mismatch");
assert.equal(contract.accountAndApiKeyBoundary.beginnerVisibleName, "gflabtoken 模型调用密钥", "beginner_visible_key_name_mismatch");

assert.equal(contract.upstreamBoundary.repository, "https://github.com/gaofeng21cn/one-person-lab", "upstream_repository_mismatch");
assert.equal(contract.upstreamBoundary.cleanUpstream, true, "upstream_must_be_clean");
assert.equal(contract.upstreamBoundary.modifySource, false, "upstream_source_must_not_be_modified");
assert.equal(contract.upstreamBoundary.importInternalModules, false, "upstream_internal_modules_must_not_be_imported");
assert.equal(contract.upstreamBoundary.entryPreflightOwnedBy, "MedOPL Gateway、SSO 和 Auth Bridge", "entry_preflight_owner_mismatch");

assertIncludesAll(contract.forbiddenBeginnerUserNarrative, [
  "CVM",
  "COS bucket",
  "K8s",
  "TKE",
  "retired resource-order identifiers",
  "raw billing tags",
  "raw provider API key",
  "launchToken",
  "runtimeToken",
  "内部存储密钥",
  "one-person-lab upstream 内部模块",
], "forbidden_beginner_user_narrative");
assertExcludesAll(contract.backendMultiTenantBoundary.fields, ["legacyResourceOrderId"], "backend_multi_tenant_fields_retired_alias");
assertExcludesAll(contract.tencentCostAllocationTags.fixedKeys, ["legacyresourceorderid_optional_migration_only"], "tencent_cost_allocation_tags_retired_alias");

assertQuestions(contract.productEffectQuestions.beginnerUserCanAnswer, [
  "我还有多少钱？",
  "我的钱花在哪里？",
  "我有几个会话？",
  "我有几个任务？",
  "我的科研任务跑到哪一步？",
  "我的托管运行环境是否可用？",
  "我的文件空间是什么状态？",
  "我的输入文件和输出文件在哪里？",
  "我从哪里进入 OPL 工作台？",
  "我的 gflabtoken 模型调用密钥是否已绑定？",
  "我释放环境后是否停止扣费？",
  "账单核对和审计是否完成？",
], "beginner_user_questions");

assertQuestions(contract.productEffectQuestions.managementCanAnswer, [
  "哪个 account、workspace、resourceBinding、cloudOperation、billingAttribution、run、serverPlan 产生了费用？",
  "腾讯云账单标签是否完整？",
  "COS 对象是否有正确 accountid、workspaceid、resourcebindingid、cloudoperationid、billingattributionid、runid、serverplanid 归因？",
  "哪些任务失败？",
  "哪些停止计费还在 120min 确认中？",
  "哪些审计是 T+1 pending 或 ready？",
  "哪些资源或账单异常？",
], "ops_questions");

assert.deepEqual(contract.nonGoals, [
  "本合同不单独实现 UI",
  "不复制 Sub2API 代码、路由、鉴权或存储结构",
  "不读取 /home/dev/.secrets/medopl/secrets.env.txt",
  "不调用真实云 API",
  "不运行 build/push/kubectl/live-test",
], "non_goals_mismatch");

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  personas: contract.personas.mvpRoles,
  tencentCostAllocationTags: contract.tencentCostAllocationTags.fixedKeys,
}, null, 2));
