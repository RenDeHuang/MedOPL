import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-portal-customer-ops-ui-composition-boundary.md";
const readmePath = "docs/contracts/README.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

const CONTRACT_START = "<!-- v22-portal-customer-ops-ui-composition-contract:start -->";
const CONTRACT_END = "<!-- v22-portal-customer-ops-ui-composition-contract:end -->";

function extractContractJson(markdown) {
  const startIndex = markdown.indexOf(CONTRACT_START);
  assert.notEqual(startIndex, -1, "portal_customer_ops_ui_composition_start_marker_missing");
  const contentStart = startIndex + CONTRACT_START.length;
  const endIndex = markdown.indexOf(CONTRACT_END, contentStart);
  assert.notEqual(endIndex, -1, "portal_customer_ops_ui_composition_end_marker_missing");
  assert.equal(markdown.indexOf(CONTRACT_START, contentStart), -1, "portal_customer_ops_ui_composition_start_marker_must_be_unique");
  assert.equal(markdown.indexOf(CONTRACT_END, endIndex + CONTRACT_END.length), -1, "portal_customer_ops_ui_composition_end_marker_must_be_unique");

  const block = markdown.slice(contentStart, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, "portal_customer_ops_ui_composition_must_be_single_json_fence");
  return JSON.parse(match[1]);
}

function assertIncludesAll(actual, expected, label) {
  assert(Array.isArray(actual), `${label}_must_be_array`);
  for (const item of expected) {
    assert(actual.includes(item), `${label}_missing:${item}`);
  }
}

function assertNoOverlap(left, right, label) {
  for (const item of left) {
    assert.equal(right.includes(item), false, `${label}_overlap:${item}`);
  }
}

function componentByName(page, name) {
  const found = page.components.find((component) => component.name === name);
  assert(found, `component_missing:${page.id}:${name}`);
  return found;
}

function assertComponent(component, expected) {
  assert.equal(component.ui, expected.ui, `component_ui_mismatch:${component.name}`);
  assertIncludesAll(component.dataSources, expected.dataSources, `component_data_sources:${component.name}`);
  assertIncludesAll(component.dtoFields, expected.dtoFields, `component_dto_fields:${component.name}`);
  assertIncludesAll(component.labels, expected.labels, `component_labels:${component.name}`);
}

const markdown = await readFile(contractPath, "utf8");
const readme = await readFile(readmePath, "utf8");
const suite = await readFile(suitePath, "utf8");
const contract = extractContractJson(markdown);

assert.equal(contract.contract, "v22_portal_customer_ops_ui_composition_boundary", "portal_customer_ops_ui_composition_contract_name");
assert.equal(contract.version, 1, "portal_customer_ops_ui_composition_version");
assert.equal(contract.level, "tier_4_ui_composition", "portal_customer_ops_ui_composition_level");
assert.equal(contract.scope, "portal_only", "portal_customer_ops_ui_composition_scope");
assert.equal(contract.model, "gpt-5.4", "portal_customer_ops_ui_composition_model");
assert.equal(contract.definesProductNarrative, false, "portal_customer_ops_ui_composition_must_not_define_product_narrative");
assert.equal(contract.replacesRoleSurfaceContracts, false, "portal_customer_ops_ui_composition_must_not_replace_role_surface_contracts");
assert.equal(contract.implementsUi, false, "portal_customer_ops_ui_composition_must_not_implement_ui");
assert.equal(contract.callsRealCloud, false, "portal_customer_ops_ui_composition_must_not_call_real_cloud");
assert.equal(contract.readsSecrets, false, "portal_customer_ops_ui_composition_must_not_read_secrets");
assert.equal(contract.modifiesOplGateway, false, "portal_customer_ops_ui_composition_must_not_modify_gateway");
assert.equal(contract.modifiesRuntimeBridge, false, "portal_customer_ops_ui_composition_must_not_modify_runtime_bridge");

assertIncludesAll(contract.subscribedContracts, [
  "docs/contracts/v22-mvp-managed-opl-loop.md",
  "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md",
  "docs/contracts/v22-portal-user-surface-boundary.md",
  "docs/contracts/v22-portal-admin-ops-surface-boundary.md",
  "docs/contracts/v22-portal-files-billing-trace-boundary.md",
  "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
  "docs/recovery/mvp-contract-acceptance.md",
  "docs/recovery/status-matrix.md",
], "portal_customer_ops_ui_subscribed_contracts");

assert.deepEqual(contract.orderingRule, [
  "page_task",
  "business_components",
  "dto_api_sources",
  "page_composition_only",
], "portal_customer_ops_ui_ordering_rule");

const customerPages = contract.surfaces.customer.pages;
const opsPages = contract.surfaces.adminOps.pages;

assert.deepEqual(customerPages.map((page) => page.title), [
  "MedOPL 总览",
  "托管环境",
  "任务运行",
  "账单",
  "文件空间",
], "customer_pages_must_be_fixed");

assert.deepEqual(opsPages.map((page) => page.title), [
  "平台总览",
  "用户管理",
  "托管资源管理",
  "任务会话",
  "账单",
  "审计",
], "admin_ops_pages_must_be_fixed");

assertIncludesAll(contract.surfaces.customer.allowedPageTitles, [
  "MedOPL 总览",
  "托管环境",
  "任务运行",
  "账单",
  "文件空间",
], "customer_allowed_page_titles");
assertIncludesAll(contract.surfaces.adminOps.allowedPageTitles, [
  "平台总览",
  "用户管理",
  "托管资源管理",
  "任务会话",
  "账单",
  "审计",
], "admin_ops_allowed_page_titles");

assertIncludesAll(contract.copy.customer.requiredLabels, [
  "余额",
  "可用余额",
  "累计消费",
  "本月消费",
  "冻结金额",
  "运行中任务",
  "成功任务",
  "失败任务",
  "文件空间",
  "会话数",
  "服务状态",
  "服务目标",
  "进入 OPL 工作台",
  "申请充值",
], "customer_required_labels");
assertIncludesAll(contract.copy.customer.forbiddenLabels, [
  "商业化状态",
  "SaaS 状态",
  "providerKeyRef",
  "resourceBindingId",
  "tenantId",
  "serverPlanId",
  "TKE",
  "节点池",
  "COS bucket",
  "配置",
  "告警中心",
  "预扣费/冻结金额",
  "gflabtoken 模型调用密钥",
  "最近心跳",
  "SLO",
], "customer_forbidden_labels");
assertNoOverlap(contract.copy.customer.requiredLabels, contract.copy.customer.forbiddenLabels, "customer_required_forbidden_labels");

assert.equal(contract.providerKeyDisplay.portalPrimarySurface, false, "provider_key_must_not_be_portal_primary_surface");
assert.equal(contract.providerKeyDisplay.portalMainNavigation, false, "provider_key_must_not_be_portal_main_navigation");
assert.equal(contract.providerKeyDisplay.oplEntryPreflightOnly, true, "provider_key_must_be_opl_preflight_only");
assert.equal(contract.providerKeyDisplay.rawApiKeyInPortalUi, false, "raw_api_key_must_not_be_in_portal_ui");

const overview = customerPages.find((page) => page.id === "customer_overview");
assert(overview, "customer_overview_page_missing");
assert.equal(overview.question, "我现在能不能继续用？", "customer_overview_question_mismatch");
assert.equal(overview.primaryAction, "进入 OPL 工作台", "customer_overview_primary_action");
assertComponent(componentByName(overview, "CustomerAccountStatsCards"), {
  ui: "metric_cards",
  dataSources: [
    "GET /portal/api/overview",
    "GET /portal/api/billing/summary",
  ],
  dtoFields: [
    "kpis.balance",
    "kpis.availableBalance",
    "kpis.historicalCost",
    "kpis.exactCostMonth",
    "wallet.activeFreeze",
  ],
  labels: [
    "余额",
    "可用余额",
    "累计消费",
    "本月消费",
    "冻结金额",
  ],
});
assertComponent(componentByName(overview, "CustomerCostTrendChart"), {
  ui: "line_or_area_chart",
  dataSources: ["GET /portal/api/billing/details"],
  dtoFields: ["trend.labels", "trend.total"],
  labels: ["消费趋势"],
});
assertComponent(componentByName(overview, "CustomerServiceStatusPanel"), {
  ui: "status_panel",
  dataSources: ["required DTO addition: GET /portal/api/status/summary"],
  dtoFields: [
    "serviceStatus.state",
    "serviceStatus.serviceTarget",
    "serviceStatus.openIncidentCount",
    "serviceStatus.updatedAt",
  ],
  labels: [
    "服务状态",
    "服务目标",
    "影响事件",
    "最近更新时间",
  ],
});
assertComponent(componentByName(overview, "RecentTaskTable"), {
  ui: "data_table",
  dataSources: ["GET /portal/api/overview"],
  dtoFields: ["latestRuns[]"],
  labels: ["最近任务"],
});

const environment = customerPages.find((page) => page.id === "customer_environment");
assert(environment, "customer_environment_page_missing");
assertComponent(componentByName(environment, "ManagedEnvironmentCard"), {
  ui: "spec_card",
  dataSources: ["GET /portal/api/workspace"],
  dtoFields: [
    "managedResourceBindingPlan",
    "workspace.serverPlan",
  ],
  labels: ["托管环境", "环境状态"],
});
assertComponent(componentByName(environment, "StorageUsageBar"), {
  ui: "progress_bar",
  dataSources: ["GET /portal/api/workspace"],
  dtoFields: [
    "fileSpace.capacityGb",
    "fileSpace.usedGb",
  ],
  labels: ["文件空间"],
});

const runs = customerPages.find((page) => page.id === "customer_runs");
assert(runs, "customer_runs_page_missing");
assertComponent(componentByName(runs, "TaskRunStatsCards"), {
  ui: "metric_cards",
  dataSources: ["GET /portal/api/workspace"],
  dtoFields: [
    "counts.runs",
    "runStatus.running",
    "counts.completedRuns",
  ],
  labels: [
    "运行中任务",
    "成功任务",
    "失败任务",
  ],
});
assertComponent(componentByName(runs, "TaskRunTable"), {
  ui: "data_table",
  dataSources: ["GET /portal/api/workspace"],
  dtoFields: ["recentRuns[]"],
  labels: ["任务明细"],
});

const billing = customerPages.find((page) => page.id === "customer_billing");
assert(billing, "customer_billing_page_missing");
assertComponent(componentByName(billing, "BillingStatsCards"), {
  ui: "metric_cards",
  dataSources: ["GET /portal/api/billing/summary"],
  dtoFields: [
    "wallet.balance",
    "wallet.availableBalance",
    "wallet.activeFreeze",
    "summary.exactCost",
  ],
  labels: [
    "余额",
    "可用余额",
    "冻结金额",
    "本月消费",
  ],
});
assertComponent(componentByName(billing, "LedgerTable"), {
  ui: "data_table",
  dataSources: ["GET /portal/api/billing/details"],
  dtoFields: ["ledger[]"],
  labels: ["消费明细"],
});

const files = customerPages.find((page) => page.id === "customer_files");
assert(files, "customer_files_page_missing");
assertComponent(componentByName(files, "StorageStatsCards"), {
  ui: "metric_cards",
  dataSources: ["GET /portal/api/workspace"],
  dtoFields: [
    "fileSpace.capacityGb",
    "fileSpace.usedGb",
    "counts.inputs",
    "counts.outputs",
  ],
  labels: ["文件空间", "输入文件", "输出文件"],
});
assertComponent(componentByName(files, "WorkspaceFileTable"), {
  ui: "data_table",
  dataSources: ["GET /portal/api/workspace"],
  dtoFields: ["fileSpace.files[]"],
  labels: ["文件列表"],
});

const platform = opsPages.find((page) => page.id === "ops_overview");
assert(platform, "ops_overview_page_missing");
assertComponent(componentByName(platform, "OpsStatsCards"), {
  ui: "metric_cards",
  dataSources: ["GET /portal/api/admin/overview"],
  dtoFields: [
    "summary.activeUsers",
    "summary.runningRuns",
    "summary.billingRisk",
    "summary.backflowStatus",
  ],
  labels: [
    "活跃用户",
    "运行中任务",
    "账务风险",
    "回流状态",
  ],
});
assertComponent(componentByName(platform, "OpsServiceStatusPanel"), {
  ui: "status_panel",
  dataSources: ["required DTO addition: GET /portal/api/admin/service-status"],
  dtoFields: [
    "serviceStatus.state",
    "serviceStatus.serviceTarget",
    "serviceStatus.attainment",
    "serviceStatus.openIncidentCount",
    "serviceStatus.updatedAt",
  ],
  labels: [
    "服务状态",
    "服务目标达成率",
    "影响事件",
    "最近更新时间",
  ],
});

const adminUsers = opsPages.find((page) => page.id === "ops_users");
assert(adminUsers, "ops_users_page_missing");
assertComponent(componentByName(adminUsers, "AdminUserTable"), {
  ui: "data_table",
  dataSources: ["GET /portal/api/admin/users"],
  dtoFields: [
    "items[]",
    "financeRows[]",
  ],
  labels: ["用户列表"],
});

const resources = opsPages.find((page) => page.id === "ops_resources");
assert(resources, "ops_resources_page_missing");
assertComponent(componentByName(resources, "ResourceBindingTable"), {
  ui: "data_table",
  dataSources: ["GET /portal/api/admin/ops"],
  dtoFields: [
    "workspaceOperations.workspaces[]",
    "resourceUsage",
  ],
  labels: ["资源绑定"],
});
assertComponent(componentByName(resources, "ResourceUsageChart"), {
  ui: "bar_or_stacked_chart",
  dataSources: ["GET /portal/api/admin/ops"],
  dtoFields: ["summary.resourceUsage"],
  labels: ["资源占用"],
});

const sessions = opsPages.find((page) => page.id === "ops_sessions");
assert(sessions, "ops_sessions_page_missing");
assertComponent(componentByName(sessions, "RunMonitorTable"), {
  ui: "data_table",
  dataSources: [
    "GET /portal/api/admin/usage",
    "GET /portal/api/admin/agent-traces",
  ],
  dtoFields: [
    "runs[]",
    "sessions[]",
    "traces[]",
  ],
  labels: ["任务会话"],
});

const opsBilling = opsPages.find((page) => page.id === "ops_billing");
assert(opsBilling, "ops_billing_page_missing");
assertComponent(componentByName(opsBilling, "AdminBillingStatsCards"), {
  ui: "metric_cards",
  dataSources: ["GET /portal/api/admin/billing-ops"],
  dtoFields: [
    "balance",
    "frozen",
    "pendingReconciliation",
  ],
  labels: ["余额", "冻结金额", "待核对"],
});

const audit = opsPages.find((page) => page.id === "ops_audit");
assert(audit, "ops_audit_page_missing");
assertComponent(componentByName(audit, "AdminAuditTimeline"), {
  ui: "timeline_and_data_table",
  dataSources: ["GET /portal/api/admin/audit"],
  dtoFields: ["auditEvents[]"],
  labels: ["审计记录"],
});

assert.equal(contract.dtoRules.existingSourceAllowed, true, "existing_sources_must_be_allowed");
assert.equal(contract.dtoRules.requiredDtoAdditionMustBeDeclared, true, "required_dto_additions_must_be_declared");
assert.equal(contract.dtoRules.pagesMustNotAssembleRawPayloads, true, "pages_must_not_assemble_raw_payloads");
assert.equal(contract.dtoRules.pageDefaultLargePortalBarrelImport, false, "pages_must_not_default_to_large_portal_barrel");
assert.equal(contract.dtoRules.sourceOfTruth.workspaceAndStorage.api, "GET /portal/api/workspace", "workspace_storage_source_api");
assert.equal(contract.dtoRules.sourceOfTruth.customerBilling.api, "GET /portal/api/billing/summary", "customer_billing_source_api");
assert.equal(contract.dtoRules.sourceOfTruth.customerServiceStatus.api, "required DTO addition: GET /portal/api/status/summary", "customer_service_status_source_api");
assert.equal(contract.dtoRules.sourceOfTruth.opsServiceStatus.api, "required DTO addition: GET /portal/api/admin/service-status", "ops_service_status_source_api");
assertIncludesAll(contract.dtoRules.sourceOfTruth.workspaceAndStorage.labels, [
  "托管环境",
  "存储",
  "文件空间",
], "workspace_storage_source_labels");
assertIncludesAll(contract.dtoRules.sourceOfTruth.customerServiceStatus.labels, [
  "服务状态",
  "服务目标",
  "影响事件",
  "最近更新时间",
], "customer_service_status_source_labels");

for (const page of customerPages) {
  for (const component of page.components) {
    for (const label of component.labels || []) {
      assert.equal(
        contract.copy.customer.forbiddenLabels.includes(label),
        false,
        `customer_component_must_not_use_forbidden_label:${page.id}:${component.name}:${label}`,
      );
    }
  }
}

assert.equal(contract.pageComposition.viewResponsibilities.includes("load"), false, "page_view_must_not_own_loader_logic");
assertIncludesAll(contract.pageComposition.viewResponsibilities, [
  "template",
  "pass_props",
  "local_wiring",
], "page_view_responsibilities");
assertIncludesAll(contract.pageComposition.composableResponsibilities, [
  "load",
  "query_state",
  "formatters",
  "actions",
], "page_composable_responsibilities");

assert.equal(contract.failureIsolation.singleComponentFailureMustNotBlankPage, true, "single_component_failure_must_not_blank_page");
assert.equal(contract.failureIsolation.billingTrendFailureMustNotHideBalanceCards, true, "billing_trend_failure_must_not_hide_balance_cards");
assert.equal(contract.failureIsolation.taskTableFailureMustNotHideBillingCards, true, "task_table_failure_must_not_hide_billing_cards");
assert.equal(contract.failureIsolation.adminOpsFailureMustNotAffectCustomerSurface, true, "admin_ops_failure_must_not_affect_customer_surface");

assertIncludesAll(contract.validation.requiredSmoke, [
  "scripts/smoke-test-v22-portal-customer-ops-ui-composition-contract.mjs",
], "required_smoke");
assert.equal(contract.validation.browserSmokeRequiredBeforeUiAbsorption, true, "browser_smoke_required_before_ui_absorption");
assert.equal(contract.validation.defaultSmokeReadsSecrets, false, "default_smoke_must_not_read_secrets");
assert.equal(contract.validation.defaultSmokeCallsRealCloud, false, "default_smoke_must_not_call_real_cloud");

assert(readme.includes("v22-portal-customer-ops-ui-composition-boundary.md"), "contracts_readme_must_index_customer_ops_ui_composition");
assert(readme.includes("Portal customer / ops UI composition"), "contracts_readme_label_missing");
assert(suite.includes("smoke-test-v22-portal-customer-ops-ui-composition-contract"), "mvp_suite_must_run_customer_ops_ui_composition_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  level: contract.level,
  orderingRule: contract.orderingRule,
  customerPages: customerPages.map((page) => page.title),
  adminOpsPages: opsPages.map((page) => page.title),
}, null, 2));
