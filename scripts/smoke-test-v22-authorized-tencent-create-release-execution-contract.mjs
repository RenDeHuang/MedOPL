import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-authorized-tencent-create-release-execution-boundary.md";
const readmePath = "docs/contracts/README.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludesAny(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

const contract = await readFile(contractPath, "utf8");
const readme = await readFile(readmePath, "utf8");
const suite = await readFile(suitePath, "utf8");

assertIncludesAll(contract, [
  "v22 Authorized Tencent Create/Release Execution Boundary",
  "本分支只写合同和 smoke",
  "不实现真实 create/release",
  "不调用真实云",
], "execution_contract_scope");

assertIncludesAll(contract, [
  "readonly inventory 与 authorized create/release 必须分离",
  "readonly 只允许 Describe/List/Get/Head",
  "create/release 使用独立 RUN gate",
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "独立 mutation secret allowlist",
  "独立 runner/bridge",
  "不得复用 RUN_TENCENT_READONLY_INVENTORY",
  "不得复用 TENCENT_READONLY_SECRET_ID",
  "不得复用 TENCENT_READONLY_SECRET_KEY",
], "execution_contract_readonly_mutation_separation");

assertIncludesAll(contract, [
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "TENCENT_MUTATION_ALLOWED_APIS",
  "TENCENT_MUTATION_REGIONS",
  "TENCENT_MUTATION_ACCOUNT_ID",
  "TENCENT_MUTATION_DAILY_BUDGET_CNY",
  "TENCENT_MUTATION_MAX_OPERATION_COUNT",
  "TENCENT_MUTATION_TKE_CLUSTER_ID",
  "TENCENT_MUTATION_TKE_NODE_POOL_ID",
  "TENCENT_MUTATION_COS_BUCKET",
  "TENCENT_MUTATION_COS_REGION",
  "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT",
  "不允许 source env",
], "execution_contract_mutation_secret_allowlist");

assertIncludesAll(contract, [
  "工作空间是业务容器",
  "计算资源可独立开通/扩缩/释放",
  "文件空间可独立开通/扩容/删除",
  "释放计算资源不删除文件空间",
  "释放计算资源不触发 7 天保护期",
  "删除文件空间/存储资源才进入 7 天保护期",
  "计算资源已释放但文件空间仍保留，是合法状态",
], "execution_contract_lifecycle_separation");

assertIncludesAll(contract, [
  "TKE 节点池必须先分型再 mutation",
  "标准套餐不是一用户一个 node pool",
  "Package C 必须先写 compute allocation，再写 ResourceQuota / LimitRange / admission policy",
  "共享用户计算池只能做池级容量补足",
  "DescribeClusterNodePools",
  "ModifyNodePoolDesiredCapacityAboutAsg",
  "DescribeNodePools",
  "ScaleNodePool",
  "Native",
  "专属 node pool 只能绑定到一个 resourceBindingId 或一个明确的账号组",
  "专属池必须使用 taint / label / nodeSelector / toleration 防止平台服务和其他用户调度进入",
  "当前混跑 Portal/OPL/trace/billing/system 的节点池不得缩到 0",
  "replicas_0_1_0 只允许用于空闲测试池或专属计算池的闭环 canary",
  "不得用旧 `ModifyNodePoolDesiredCapacityAboutAsg` 判定节点池不存在",
], "execution_contract_tke_node_pool_shape_detection");

assertIncludesAll(contract, [
  "删除计算资源：释放计算资源",
  "停止相关新任务/运行",
  "不删除文件空间",
  "删除文件空间：进入 7 天保护期",
  "期满清理文件",
  "冻结金额用尽：停止计算资源和新任务",
  "文件空间进入 7 天保护期或欠费保护流程",
], "execution_contract_user_delete_semantics");

assertIncludesAll(contract, [
  "create 时必须生成并写入",
  "accountId",
  "workspaceId",
  "resourceBindingId",
  "cloudOperationId",
  "billingAttributionId",
  "serverPlanId",
  "resourceType",
  "region",
  "retiredResourceOrderIdentifiersForbidden",
  "release 时必须同时匹配 Portal ledger 和云资源标签",
  "标签、Portal `resourceBindingId`、compute allocation 和后台 `nodePoolRef` 缺失、冲突、归属不一致时 fail-closed",
  "admin 审计队列",
], "execution_contract_ownership_tags");

assertIncludesAll(contract, [
  "maxCpuCoresPerWorkspace: 16",
  "maxMemoryGbPerWorkspace: 32",
  "maxFileSpaceGbPerWorkspace: 500",
  "maxConcurrentTasksPerWorkspace: 5",
  "maxQueuedTasksPerWorkspace: 20",
  "balanceWarningThresholdCny: 20",
  "dailySpendAlertCny: 300",
  "dailyHardCapCny: null",
  "failedOperationRetryLimit: 2",
  "maxCreateReleaseOperationsPerDay: 10",
  "账号/账号组修改 override",
  "effective limits",
  "审计记录",
], "execution_contract_risk_limits");

assertIncludesAll(contract, [
  "create 前计算预估冻结金额",
  "冻结金额展示给用户",
  "120 分钟扣费核对",
  "T+1 COS 对账",
  "待对账",
  "对账异常",
  "运维处理中",
  "已补扣",
  "已退还",
], "execution_contract_billing_protection");

assertIncludesAll(contract, [
  "预校验 -> 创建资源 -> 打标签 -> 写 ledger -> 开通可用",
  "创建资源后标签或 ledger 写入失败",
  "进入回滚/冻结状态",
  "禁止对用户显示为可用",
  "rollback 失败进入 admin 审计队列",
  "冻结继续开通",
], "execution_contract_rollback");

assertIncludesAll(contract, [
  "开通中",
  "可用",
  "开通失败待处理",
  "释放中",
  "已释放",
  "文件保护期",
  "余额不足",
  "对账中",
  "对账异常",
], "execution_contract_user_visible_statuses");

assertIncludesAll(contract, [
  "普通用户不展示",
  "CVM/TKE/COS/K8s/nodePool",
  "云资源清单",
  "服务器编号",
  "Secret/token/objectKey",
], "execution_contract_user_language_boundary");

assertIncludesAll(contract, [
  "不真实 create/delete/modify/release",
  "不读取 mutation secret",
  "不调用真实腾讯云",
  "不改 deploy/.sentrux/adapters/upstream/Gateway/Runtime Bridge",
  "不把 user_owned/resource-order 旧叙事恢复为主线",
], "execution_contract_non_goals");

assertIncludesAll(contract, [
  "\"implementsRealCloudCall\": false",
  "\"readsMutationSecretNow\": false",
  "\"callsRealTencentCloudNow\": false",
  "\"readonlyRunGate\": \"RUN_TENCENT_READONLY_INVENTORY\"",
  "\"mutationRunGate\": \"RUN_TENCENT_CREATE_RELEASE_EXECUTION\"",
  "\"readonlyAndMutationGatesSeparated\": true",
  "\"portalLedgerAndCloudTagsRequiredForRelease\": true",
  "\"failClosedOnMissingOrConflictingOwnership\": true",
  "\"computeReleaseDeletesFileSpace\": false",
  "\"storageDeleteTriggersRetentionDays\": 7",
  "\"tkeNodePoolShapeMustBeDetectedBeforeMutation\": true",
  "\"nativeNodePoolReadApi\": \"DescribeNodePools\"",
  "\"nativeNodePoolMutationApi\": \"ScaleNodePool\"",
  "\"legacyRegularNodePoolMutationApi\": \"ModifyNodePoolDesiredCapacityAboutAsg\"",
  "\"nativeNodePoolCanaryLoop\": \"replicas_0_1_0_only_for_idle_canary_or_dedicated_pool\"",
  "\"standardPlansUseSharedUserComputePool\": true",
  "\"standardPlansRequireNamespaceQuota\": true",
  "\"overAllocationMustFailClosed\": true",
  "\"dedicatedNodePoolSupportedAsAdvancedIsolation\": true",
], "execution_contract_machine_readable_data");

assertNotIncludesAny(contract, [
  "RUN_TENCENT_READONLY_CREATE_RELEASE",
  "TENCENT_READONLY_MUTATION_SECRET_ID",
  "source .env",
  "legacyResourceOrderId",
  "legacyresourceorderid",
  "migration-only alias",
], "execution_contract_forbidden_mixed_gate_language");

assert(readme.includes("v22-authorized-tencent-create-release-execution-boundary.md"), "readme_must_index_execution_contract");
assert(readme.includes("authorized/tencent create/release execution"), "readme_must_name_execution_contract");
assert(suite.includes("smoke-test-v22-authorized-tencent-create-release-execution-contract.mjs"), "mvp_suite_must_include_execution_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_authorized_tencent_create_release_execution_boundary",
  checked: [
    "scope_contract_only",
    "readonly_mutation_gate_separation",
    "mutation_secret_allowlist",
    "compute_storage_lifecycle_separation",
    "user_delete_semantics",
    "ownership_tag_double_check",
    "risk_limits_and_portal_override",
    "billing_freeze_t120_tplus1",
    "rollback_admin_audit",
    "user_visible_status_language",
    "non_goals_and_pollution_guard",
  ],
}, null, 2));
